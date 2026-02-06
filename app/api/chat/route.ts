import { streamText, convertToModelMessages } from "ai";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages, sessionId } = await req.json();

    if (!sessionId) {
      return new Response("Session ID required", { status: 400 });
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

    // Save user message to DB
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === "user") {
      const userContent =
        lastUserMsg.parts
          ?.filter((p: { type: string }) => p.type === "text")
          .map((p: { text: string }) => p.text)
          .join("") || lastUserMsg.content || "";

      if (userContent) {
        await sql`
          INSERT INTO messages (session_id, role, content)
          VALUES (${sessionId}, 'user', ${userContent})
        `;
      }
    }

    // Load conversation history from DB for context
    const historyRows = await sql`
      SELECT role, content FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 50
    `;

    const historyMessages = historyRows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content as string,
    }));

    const systemPrompt = buildSystemPrompt(user);

    const result = streamText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages: historyMessages,
      onFinish: async ({ text }) => {
        // Save assistant message
        if (text) {
          await sql`
            INSERT INTO messages (session_id, role, content)
            VALUES (${sessionId}, 'assistant', ${text})
          `;

          // Update session timestamp and auto-generate title from first exchange
          const msgCount = await sql`
            SELECT COUNT(*) as count FROM messages WHERE session_id = ${sessionId}
          `;

          if (Number(msgCount[0].count) <= 3) {
            // Auto-title from first user message
            const firstMsg = await sql`
              SELECT content FROM messages 
              WHERE session_id = ${sessionId} AND role = 'user'
              ORDER BY created_at ASC LIMIT 1
            `;
            if (firstMsg.length > 0) {
              const title = (firstMsg[0].content as string).slice(0, 50);
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

          // Extract vocab (simplified - in production would use structured outputs)
          try {
            await extractVocab(sql, user.id, sessionId, text);
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

async function extractVocab(
  sql: ReturnType<typeof import("@neondatabase/serverless").neon>,
  userId: string,
  sessionId: string,
  text: string
) {
  // Simple pattern matching for Norwegian vocab hints in assistant responses
  const vocabPattern =
    /(?:nytt ord|new word|vokabular|ordforråd)[:\s]+["«]?(\w+)["»]?\s*[-–]\s*(.+?)(?:\.|$)/gi;
  let match;
  while ((match = vocabPattern.exec(text)) !== null) {
    const term = match[1];
    const explanation = match[2].trim();
    await sql`
      INSERT INTO vocab_items (user_id, session_id, term, explanation)
      VALUES (${userId}, ${sessionId}, ${term}, ${explanation})
      ON CONFLICT DO NOTHING
    `;
  }
}
