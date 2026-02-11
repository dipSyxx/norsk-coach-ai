import { generateText, streamText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { extractionSchema } from "@/lib/extract-schema";
import { prepareVocabTerm } from "@/lib/vocab-normalization";
import {
  decrypt,
  encrypt,
  isEncryptionReadyForRuntime,
} from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { isContentSafe } from "@/lib/moderation";
import type { PrismaClient } from "@prisma/client";

const MAX_INPUT_LENGTH = 4000;
const EXPLANATION_LANGUAGE_NAME: Record<string, string> = {
  norwegian: "Norwegian (bokmaal)",
  ukrainian: "Ukrainian",
  english: "English",
};

const EXPLANATION_REQUEST_REGEXES = [
  /\b(hva betyr|betyr|forklar|definer|oversett|oversetting)\b/i,
  /\b(what does|mean|meaning|define|definition|translate|translation)\b/i,
  /(що означає|що значить|поясни|пояснити|значення|переклад)/i,
];

function isExplanationRequest(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return EXPLANATION_REQUEST_REGEXES.some((re) => re.test(normalized));
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    const user = await getSession();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!isEncryptionReadyForRuntime()) {
      return new Response(
        JSON.stringify({
          error:
            "Message encryption is not configured for this environment.",
          code: "ENCRYPTION_NOT_CONFIGURED",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
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
        if (moderation.reason === "OUTAGE") {
          return new Response(
            JSON.stringify({
              error:
                "Message screening is temporarily unavailable. Please try again shortly.",
              code: "MODERATION_UNAVAILABLE",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

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

    const baseSystemPrompt = buildSystemPrompt(user, {
      mode: session.mode,
      topic: session.topic ?? undefined,
    });

    const strictExplanationOverride = isExplanationRequest(userContent)
      ? `\n\nStrict instruction for this reply: The user is asking for meaning/translation/explanation. Write the explanatory text fully in ${EXPLANATION_LANGUAGE_NAME[user.explanation_language] ?? EXPLANATION_LANGUAGE_NAME.norwegian}. Do not switch explanatory prose to any other language.`
      : "";

    const systemPrompt = `${baseSystemPrompt}${strictExplanationOverride}`;

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
            const modeLabels: Record<string, string> = {
              free_chat: "Fri samtale",
              rollespill: "Rollespill",
              rett_teksten: "Rett teksten",
              ovelse: "Lag øvelse",
              grammatikk: "Grammatikk",
            };
            const modeLabel = modeLabels[session.mode] ?? session.mode;
            const firstMsg = await prisma.message.findFirst({
              where: { sessionId, role: "user" },
              orderBy: { createdAt: "asc" },
              select: { content: true, keyVersion: true },
            });
            const rest = session.topic
              ? session.topic
              : firstMsg
                ? decrypt(firstMsg.content, firstMsg.keyVersion).slice(0, 30)
                : "Samtale";
            const title = (modeLabel + ": " + rest).slice(0, 50);
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { title, updatedAt: new Date() },
            });
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
              user.explanation_language,
              prisma
            );
          } catch (err) {
            console.error("Extract vocab/mistakes failed (non-critical):", err);
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

const EXPLANATION_LANG_INSTRUCTION: Record<string, string> = {
  ukrainian: "Give the explanation for each vocab item in Ukrainian.",
  english: "Give the explanation for each vocab item in English.",
  norwegian: "Give the explanation for each vocab item in simple Norwegian.",
};

async function extractVocabAndMistakes(
  userId: string,
  sessionId: string,
  assistantText: string,
  lastUserMessage: string,
  explanationLanguage: string,
  prismaClient: PrismaClient
) {
  const langInstruction =
    EXPLANATION_LANG_INSTRUCTION[explanationLanguage] ??
    EXPLANATION_LANG_INSTRUCTION.norwegian;

  const prompt = `You are analyzing a Norwegian tutor's reply to a student.

Last user message:
${lastUserMessage || "(none)"}

Assistant's reply:
${assistantText}

${langInstruction}

Extract:
1) Norwegian vocabulary or phrases from this reply: words or expressions the tutor introduced, explained, used, highlighted, or suggested. For each item provide:
   - term: the Norwegian word or phrase
   - explanation: brief meaning (in the language requested above)
   - example: a short Norwegian sentence that actually USES the term (e.g. "Jeg har jobbet med brukergrensesnittet."). Use only a real example sentence from the reply, or build one. Do NOT use the tutor's question or invitation (e.g. "Vil du prøve å skrive en setning..."). If there is no suitable example, use empty string "".
2) Mistakes the tutor corrected (type, example: what the student wrote wrong, correction: the correct form).

Return empty arrays only if there is truly nothing to extract.`;

  const { output } = await generateText({
    model: openai("gpt-4.1-mini"),
    prompt,
    output: Output.object({
      schema: extractionSchema,
      name: "extraction",
      description: "Extracted vocabulary and mistake corrections",
    }),
    maxRetries: 1,
  });

  for (const v of output.vocab) {
    if (!v.term?.trim()) continue;
    const preparedTerm = prepareVocabTerm(v.term);
    if (!preparedTerm) continue;

    const existingTerm = await prismaClient.vocabItem.findFirst({
      where: {
        userId,
        OR: [
          {
            term: {
              equals: preparedTerm.normalized,
              mode: "insensitive",
            },
          },
          {
            term: {
              equals: preparedTerm.rawTrimmed,
              mode: "insensitive",
            },
          },
        ],
      },
      select: { term: true },
    });

    await prismaClient.vocabItem.upsert({
      where: {
        userId_term: {
          userId,
          term: existingTerm?.term ?? preparedTerm.term,
        },
      },
      create: {
        userId,
        sessionId,
        term: preparedTerm.term,
        explanation: v.explanation?.trim() ?? null,
        exampleSentence: v.example?.trim() ?? null,
        nextReviewAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 0.5 days, same as strength 0 in review
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
    const mistakeType = m.type.trim();
    await prismaClient.mistakePattern.upsert({
      where: {
        userId_mistakeType: { userId, mistakeType },
      },
      create: {
        userId,
        sessionId,
        mistakeType,
        example: m.example?.trim() ?? null,
        correction: m.correction?.trim() ?? null,
      },
      update: {
        example: m.example?.trim() ?? null,
        correction: m.correction?.trim() ?? null,
        sessionId,
        count: { increment: 1 },
      },
    });
  }
}
