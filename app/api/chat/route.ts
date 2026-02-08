import { generateText, streamText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { extractionSchema } from "@/lib/extract-schema";
import { encrypt, decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { isContentSafe } from "@/lib/moderation";
import type { PrismaClient } from "@prisma/client";

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

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) {
      return new Response("Session not found", { status: 404 });
    }

    const userContentForExtraction = userContent;
    if (userContent) {
      const { payload, keyVersion } = encrypt(userContent);
      await prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: payload,
          keyVersion,
        },
      });
    }

    const historyRows = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { role: true, content: true, keyVersion: true },
    });

    const historyMessages = historyRows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: decrypt(r.content, r.keyVersion),
    }));

    const systemPrompt = buildSystemPrompt(user);

    const result = streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages: historyMessages,
      maxRetries: 2,
      onFinish: async ({ text }) => {
        if (text) {
          const { payload, keyVersion } = encrypt(text);
          await prisma.message.create({
            data: {
              sessionId,
              role: "assistant",
              content: payload,
              keyVersion,
            },
          });

          const msgCount = await prisma.message.count({
            where: { sessionId },
          });

          if (msgCount <= 3) {
            const firstMsg = await prisma.message.findFirst({
              where: { sessionId, role: "user" },
              orderBy: { createdAt: "asc" },
              select: { content: true, keyVersion: true },
            });
            if (firstMsg) {
              const plain = decrypt(firstMsg.content, firstMsg.keyVersion);
              const title = plain.slice(0, 50);
              await prisma.chatSession.update({
                where: { id: sessionId },
                data: { title, updatedAt: new Date() },
              });
            }
          } else {
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { updatedAt: new Date() },
            });
          }

          try {
            await extractVocabAndMistakes(
              user.id,
              sessionId,
              text,
              userContentForExtraction,
              prisma
            );
          } catch {
            // Non-critical
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
  prismaClient: PrismaClient
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
    await prismaClient.vocabItem.upsert({
      where: {
        userId_term: {
          userId,
          term: v.term.trim(),
        },
      },
      create: {
        userId,
        sessionId,
        term: v.term.trim(),
        explanation: v.explanation?.trim() ?? null,
        exampleSentence: v.example?.trim() ?? null,
      },
      update: {
        explanation: v.explanation?.trim() ?? null,
        exampleSentence: v.example?.trim() ?? null,
        sessionId,
      },
    });
  }

  for (const m of output.mistakes) {
    if (!m.type?.trim()) continue;
    await prismaClient.mistakePattern.create({
      data: {
        userId,
        sessionId,
        mistakeType: m.type.trim(),
        example: m.example?.trim() ?? null,
        correction: m.correction?.trim() ?? null,
      },
    });
  }
}
