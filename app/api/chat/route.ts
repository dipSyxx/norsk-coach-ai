import { generateText, streamText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { extractionSchema } from "@/lib/extract-schema";
import { encrypt, decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { isContentSafe } from "@/lib/moderation";

const MAX_INPUT_LENGTH = 4000;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    const user = await getSession();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.ok) {
      return new Response(
        JSON.stringify({
          error: "Too many messages. Please wait a moment before sending again.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }

    const { messages, sessionId } = await req.json();

    if (!sessionId) {
      return new Response("Session ID required", { status: 400 });
    }

    const msgList = Array.isArray(messages) ? messages : (messages as { messages?: unknown[] })?.messages ?? [];
    const lastUserMsg = msgList[msgList.length - 1];
    const userContent =
      lastUserMsg && (lastUserMsg as { role: string }).role === "user"
        ? ((lastUserMsg as { parts?: { type: string; text: string }[]; content?: string }).parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("") ||
          (lastUserMsg as { content?: string }).content ||
          "")
        : "";

    if (userContent.length > MAX_INPUT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Message is too long. Please keep it under ${MAX_INPUT_LENGTH} characters.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (userContent.trim()) {
      const moderation = await isContentSafe(userContent);
      if (!moderation.safe) {
        return new Response(
          JSON.stringify({
            error: "Your message could not be sent. Please keep the conversation appropriate for a language learning context.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const sql = getDb();

    // Verify session ownership
    const sessionRows = await sql`
      SELECT id FROM chat_sessions 
      WHERE id = ${sessionId} AND user_id = ${user.id}
    `;
    if (sessionRows.length === 0) {
      return new Response("Session not found", { status: 404 });
    }

    // Save user message to DB and capture for extraction
    const userContentForExtraction = userContent;
    if (userContent) {
      const { payload, keyVersion } = encrypt(userContent);
      await sql`
        INSERT INTO messages (session_id, role, content, key_version)
        VALUES (${sessionId}, 'user', ${payload}, ${keyVersion})
      `;
    }

    // Load conversation history from DB for context (decrypt if encrypted)
    const historyRows = await sql`
      SELECT role, content, key_version FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 50
    `;

    const historyMessages = historyRows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: decrypt(
        r.content as string,
        (r.key_version as number) ?? 0,
      ),
    }));

    const systemPrompt = buildSystemPrompt(user);

    const result = streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages: historyMessages,
      maxRetries: 2,
      onFinish: async ({ text }) => {
        // Save assistant message (encrypted)
        if (text) {
          const { payload, keyVersion } = encrypt(text);
          await sql`
            INSERT INTO messages (session_id, role, content, key_version)
            VALUES (${sessionId}, 'assistant', ${payload}, ${keyVersion})
          `;

          // Update session timestamp and auto-generate title from first exchange
          const msgCount = await sql`
            SELECT COUNT(*) as count FROM messages WHERE session_id = ${sessionId}
          `;

          if (Number(msgCount[0].count) <= 3) {
            // Auto-title from first user message (decrypt for title)
            const firstMsg = await sql`
              SELECT content, key_version FROM messages 
              WHERE session_id = ${sessionId} AND role = 'user'
              ORDER BY created_at ASC LIMIT 1
            `;
            if (firstMsg.length > 0) {
              const raw = firstMsg[0];
              const plain = decrypt(
                raw.content as string,
                (raw.key_version as number) ?? 0,
              );
              const title = plain.slice(0, 50);
              await sql`
                UPDATE chat_sessions SET title = ${title}, updated_at = NOW()
                WHERE id = ${sessionId}
              `;
            }
          } else {
            await sql`
              UPDATE chat_sessions SET updated_at = NOW()
              WHERE id = ${sessionId}
            `;
          }

          // Structured extraction: vocab + mistakes
          try {
            await extractVocabAndMistakes(
              user.id,
              sessionId,
              text,
              userContentForExtraction,
              sql,
            );
          } catch {
            // Non-critical, don't fail the request
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

async function extractVocabAndMistakes(
  userId: string,
  sessionId: string,
  assistantText: string,
  lastUserMessage: string,
  sql: ReturnType<typeof import("@neondatabase/serverless").neon>,
) {
  const prompt = `You are analyzing a Norwegian tutor's reply to a student.

Last user message:
${lastUserMessage || "(none)"}

Assistant's reply:
${assistantText}

Extract:
1) New Norwegian vocabulary the tutor introduced or explained (term, brief explanation, optional example sentence).
2) Mistakes the tutor corrected in this exchange (type: short label e.g. ordstilling/verb/artikkel, example: what the student wrote wrong, correction: the correct form).

Return empty arrays if there is nothing to extract.`;

  const { output } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    output: Output.object({
      schema: extractionSchema,
      schemaName: "extraction",
      schemaDescription: "Extracted vocabulary and mistake corrections",
    }),
    maxRetries: 1,
  });

  for (const v of output.vocab) {
    if (!v.term?.trim()) continue;
    await sql`
      INSERT INTO vocab_items (user_id, session_id, term, explanation, example_sentence)
      VALUES (${userId}, ${sessionId}, ${v.term.trim()}, ${v.explanation?.trim() ?? null}, ${v.example?.trim() ?? null})
      ON CONFLICT (user_id, term) DO UPDATE SET
        explanation = EXCLUDED.explanation,
        example_sentence = EXCLUDED.example_sentence,
        session_id = EXCLUDED.session_id
    `;
  }

  for (const m of output.mistakes) {
    if (!m.type?.trim()) continue;
    await sql`
      INSERT INTO mistake_patterns (user_id, session_id, mistake_type, example, correction)
      VALUES (${userId}, ${sessionId}, ${m.type.trim()}, ${m.example?.trim() ?? null}, ${m.correction?.trim() ?? null})
    `;
  }
}
