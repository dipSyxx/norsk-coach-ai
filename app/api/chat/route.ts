import { createHash, randomUUID } from "crypto";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  streamText,
  type FinishReason,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildSystemPrompt,
  getCorrectionLabel,
  getExplanationLabels,
  type PromptTemplateId,
} from "@/lib/system-prompt";
import { extractionSchema } from "@/lib/extract-schema";
import { isExplanationIntent } from "@/lib/explanation-intent";
import {
  auditLanguagePolicy,
  type LanguagePolicyAuditResult,
} from "@/lib/language-policy";
import { computeNextReviewAtFromStrength } from "@/lib/srs";
import {
  mergeVocabKinds,
  normalizeVocabKind,
  normalizeVocabSource,
} from "@/lib/vocab-taxonomy";
import {
  normalizeVocabTerm,
  prepareVocabTerm,
} from "@/lib/vocab-normalization";
import {
  decrypt,
  encrypt,
  isEncryptionReadyForRuntime,
} from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { isContentSafe } from "@/lib/moderation";
import { chatRequestSchema, parseBodyWithSchema } from "@/lib/validation";
import type { PrismaClient } from "@prisma/client";

const MAX_INPUT_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 25;
const MAX_HISTORY_CHARS = 12_000;

const EXPLANATION_LANGUAGE_NAME: Record<string, string> = {
  norwegian: "Norwegian (bokmaal)",
  ukrainian: "Ukrainian",
  english: "English",
};

const MODE_LABELS: Record<string, string> = {
  free_chat: "Fri samtale",
  rollespill: "Rollespill",
  rett_teksten: "Rett teksten",
  ovelse: "Lag ovelse",
  grammatikk: "Grammatikk",
};

const EXPLANATION_LANG_INSTRUCTION: Record<string, string> = {
  ukrainian: "Give the explanation for each vocab item in Ukrainian.",
  english: "Give the explanation for each vocab item in English.",
  norwegian: "Give the explanation for each vocab item in simple Norwegian.",
};

const FALLBACK_BY_EXPLANATION_LANGUAGE: Record<string, string> = {
  norwegian:
    "Jeg kan ikke svare pa det innholdet. La oss holde oss til norskoving. Prov med et ord, en setning eller et grammatikksporsmal.",
  ukrainian:
    "Я не можу відповісти на такий запит. Давай зосередимось на вивченні норвезької: напиши слово, речення або граматичне питання.",
  english:
    "I can't answer that request. Let's keep the chat focused on Norwegian learning. Try a word, sentence, or grammar question.",
};

const STOP_WORDS = new Set([
  "og",
  "eller",
  "i",
  "pa",
  "til",
  "av",
  "for",
  "som",
  "det",
  "den",
  "de",
]);

type ModerationStatus = "ok" | "blocked" | "outage";
type LanguagePolicyStatus = "pass" | "repaired" | "repair_failed" | "fallback";

function getLastUserMessageText(rawMessages: unknown): string {
  const list = Array.isArray(rawMessages)
    ? rawMessages
    : ((rawMessages as { messages?: unknown[] })?.messages ?? []);

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const candidate = list[i] as {
      role?: string;
      content?: string;
      parts?: Array<{ type?: string; text?: string }>;
    };

    if (candidate?.role !== "user") continue;

    const fromParts =
      candidate.parts
        ?.filter(
          (part) => part?.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text)
        .join("") ?? "";

    return (fromParts || candidate.content || "").trim();
  }

  return "";
}

function trimHistoryByApproxBudget(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  let total = 0;
  const selected: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const size = msg.content.length;

    if (selected.length > 0 && total + size > MAX_HISTORY_CHARS) {
      break;
    }

    selected.push(msg);
    total += size;
  }

  return selected.reverse();
}

function safeFallbackText(explanationLanguage: string): string {
  return (
    FALLBACK_BY_EXPLANATION_LANGUAGE[explanationLanguage] ??
    FALLBACK_BY_EXPLANATION_LANGUAGE.norwegian
  );
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function logAssistantModerationTelemetry(params: {
  userId: string;
  sessionId: string;
  status: ModerationStatus;
  reasonCategory?: string | null;
  contentHash: string;
}) {
  console.info("assistant_moderation_telemetry", {
    userId: params.userId,
    sessionId: params.sessionId,
    assistantModerationStatus: params.status,
    blockedAt: params.status === "ok" ? null : new Date().toISOString(),
    reasonCategory: params.reasonCategory ?? null,
    contentHash: params.contentHash,
  });
}

function logLanguagePolicyTelemetry(params: {
  userId: string;
  sessionId: string;
  status: LanguagePolicyStatus;
  reasonCode?: string | null;
  expectedTemplate: PromptTemplateId;
  contentHash: string;
}) {
  console.info("language_policy_telemetry", {
    userId: params.userId,
    sessionId: params.sessionId,
    languagePolicyStatus: params.status,
    reasonCode: params.reasonCode ?? null,
    expectedTemplate: params.expectedTemplate,
    contentHash: params.contentHash,
    recordedAt: new Date().toISOString(),
  });
}

function isAutoGeneratedTitle(title: string): boolean {
  if (!title || title.trim() === "") return true;
  if (title.trim() === "Ny samtale") return true;

  return Object.values(MODE_LABELS).some((label) =>
    title.startsWith(`${label}: `),
  );
}

function shouldGenerateAiTitle(
  sessionTitle: string,
  messageCount: number,
): boolean {
  return (
    messageCount >= 3 && messageCount <= 5 && isAutoGeneratedTitle(sessionTitle)
  );
}

function buildFallbackTitle(
  mode: string,
  topic: string | null,
  firstUserText: string,
): string {
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const rest = topic?.trim() || firstUserText.trim().slice(0, 30) || "Samtale";
  return `${modeLabel}: ${rest}`.slice(0, 50);
}

function sanitizeTitle(raw: string | null | undefined): string | null {
  const normalized = (raw ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;
  return normalized.slice(0, 50);
}

async function generateSessionTitle(params: {
  mode: string;
  topic: string | null;
  firstUserText: string;
  assistantText: string;
}): Promise<string | null> {
  const modeLabel = MODE_LABELS[params.mode] ?? params.mode;

  try {
    const { text } = await generateText({
      model: openai("gpt-5.2"),
      prompt: `Create one short Norwegian Bokmal chat title (max 50 chars, no quotes).

Mode: ${modeLabel}
Topic: ${params.topic || "(none)"}
First user message: ${params.firstUserText || "(none)"}
Latest assistant answer: ${params.assistantText || "(none)"}

Return only the title.`,
      maxRetries: 1,
      temperature: 0.2,
    });

    return sanitizeTitle(text);
  } catch {
    return null;
  }
}

function normalizeFreeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLocaleLowerCase("nb-NO")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldKeepExtractedTerm(params: {
  rawTerm: string;
  assistantText: string;
  lastUserMessage: string;
}): boolean {
  const prepared = prepareVocabTerm(params.rawTerm);
  if (!prepared) return false;

  if (prepared.term !== "a" && prepared.term.length < 2) return false;
  if (!/\p{L}/u.test(prepared.term)) return false;

  const normalizedTerm = normalizeVocabTerm(prepared.term);
  if (STOP_WORDS.has(normalizedTerm)) return false;

  const assistantNormalized = normalizeFreeText(params.assistantText);
  if (!assistantNormalized.includes(normalizedTerm)) return false;

  const userNormalized = normalizeFreeText(params.lastUserMessage);
  if (
    userNormalized.includes(normalizedTerm) &&
    !assistantNormalized.includes(normalizedTerm)
  ) {
    return false;
  }

  return true;
}

function resolveExpectedTemplate(params: {
  isExplanationRequest: boolean;
  mode: string;
}): PromptTemplateId {
  if (params.isExplanationRequest) {
    return "template_1";
  }

  if (params.mode === "grammatikk") {
    return "template_2";
  }

  return "template_3";
}

function buildStrictExplanationOverride(params: {
  isExplanationRequest: boolean;
  explanationLanguage: string;
}): string {
  if (!params.isExplanationRequest) return "";

  const explanationLanguageName =
    EXPLANATION_LANGUAGE_NAME[params.explanationLanguage] ??
    EXPLANATION_LANGUAGE_NAME.norwegian;

  return `\n\nSTRICT OVERRIDE:\nThe user is asking for meaning/translation/explanation.\nYou MUST use TEMPLATE 1 exactly.\nAll explanatory prose and headings must be in ${explanationLanguageName}.\nNorwegian is allowed only for example sentences and the exercise prompt.`;
}

function buildTemplateDefinitionText(params: {
  labels: ReturnType<typeof getExplanationLabels>;
  correctionLabel: string;
}): string {
  const { labels, correctionLabel } = params;

  return `Template 1 (meaning/explanation request):
${labels.expl}:
- ${labels.meaning}: <explanation language text>
- ${labels.grammar}: <explanation language text (optional)>
- ${labels.examples}:
  1) <Norwegian example sentence>
  2) <Norwegian example sentence>
- ${labels.exercise}: <Norwegian micro-task line ending with a question mark.>

Template 2 (grammar mode):
${labels.grammar}:
- ${labels.rule}: <explanation language text>
- ${labels.commonMistake}: <explanation language text>
- ${labels.examples}:
  1) <Norwegian example sentence>
- ${labels.exercise}: <Norwegian micro-task line ending with a question mark.>

Template 3 (free chat/role-play):
- 2-4 Norwegian sentences.
- If correcting: "${correctionLabel}: [correct form] — [one-sentence explanation in explanation language]"
- Optional note: "${labels.notes}: <one sentence>".`;
}

async function repairAssistantText(params: {
  originalText: string;
  explanationLanguage: string;
  expectedTemplate: PromptTemplateId;
  labels: ReturnType<typeof getExplanationLabels>;
  correctionLabel: string;
}): Promise<string | null> {
  const languageName =
    EXPLANATION_LANGUAGE_NAME[params.explanationLanguage] ??
    EXPLANATION_LANGUAGE_NAME.norwegian;

  const templateDefinitions = buildTemplateDefinitionText({
    labels: params.labels,
    correctionLabel: params.correctionLabel,
  });

  const prompt = `You are repairing a Norwegian tutor response that violated a language/template policy.

Required explanation language: ${languageName}
Required template: ${params.expectedTemplate}

${templateDefinitions}

Original response:
${params.originalText}

Rewrite the response now.
Rules:
- Keep user intent and learning value.
- Keep explanatory prose/headings strictly in ${languageName}.
- Norwegian is allowed only where templates allow it.
- Return only the repaired response text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-5.2"),
      prompt,
      maxRetries: 1,
      temperature: 0.2,
    });

    const repaired = text.trim();
    return repaired || null;
  } catch {
    return null;
  }
}

async function persistAssistantFinalText(params: {
  userId: string;
  sessionId: string;
  session: { title: string; mode: string; topic: string | null };
  assistantText: string;
  explanationLanguage: string;
  userContentForExtraction: string;
  allowExtraction: boolean;
  prismaClient: PrismaClient;
}) {
  const { payload: encryptedAssistant, keyVersion: assistantKeyVersion } =
    encrypt(params.assistantText);

  await params.prismaClient.message.create({
    data: {
      sessionId: params.sessionId,
      role: "assistant",
      content: encryptedAssistant,
      keyVersion: assistantKeyVersion,
    },
  });

  const msgCount = await params.prismaClient.message.count({
    where: { sessionId: params.sessionId },
  });

  if (shouldGenerateAiTitle(params.session.title, msgCount)) {
    const firstUserRow = await params.prismaClient.message.findFirst({
      where: { sessionId: params.sessionId, role: "user" },
      orderBy: { createdAt: "asc" },
      select: { content: true, keyVersion: true },
    });

    const firstUserText = firstUserRow
      ? decrypt(firstUserRow.content, firstUserRow.keyVersion)
      : "";

    const aiTitle = await generateSessionTitle({
      mode: params.session.mode,
      topic: params.session.topic,
      firstUserText,
      assistantText: params.assistantText,
    });

    const nextTitle =
      aiTitle ??
      buildFallbackTitle(params.session.mode, params.session.topic, firstUserText);

    await params.prismaClient.chatSession.update({
      where: { id: params.sessionId },
      data: { title: nextTitle, updatedAt: new Date() },
    });
  } else {
    await params.prismaClient.chatSession.update({
      where: { id: params.sessionId },
      data: { updatedAt: new Date() },
    });
  }

  if (!params.allowExtraction) {
    return;
  }

  try {
    await extractVocabAndMistakes(
      params.userId,
      params.sessionId,
      params.assistantText,
      params.userContentForExtraction,
      params.explanationLanguage,
      params.prismaClient,
    );
  } catch (error) {
    console.error("Extract vocab/mistakes failed (non-critical):", error);
  }
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
          error: "Message encryption is not configured for this environment.",
          code: "ENCRYPTION_NOT_CONFIGURED",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
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
        },
      );
    }

    const parsed = await parseBodyWithSchema(req, chatRequestSchema);
    if (!parsed.success) {
      return new Response(JSON.stringify(parsed.error), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = parsed.data.sessionId;
    const userContent = getLastUserMessageText(parsed.data.messages);

    if (userContent.length > MAX_INPUT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Message is too long. Please keep it under ${MAX_INPUT_LENGTH} characters.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (userContent) {
      const moderation = await isContentSafe(userContent);
      if (!moderation.safe) {
        if (moderation.reason === "OUTAGE") {
          return new Response(
            JSON.stringify({
              error:
                "Message screening is temporarily unavailable. Please try again shortly.",
              code: "MODERATION_UNAVAILABLE",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            error:
              "Your message could not be sent. Please keep the conversation appropriate for a language learning context.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        title: true,
        mode: true,
        topic: true,
      },
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
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true, keyVersion: true },
    });

    const historyMessages = historyRows.reverse().map((row) => ({
      role: row.role as "user" | "assistant",
      content: decrypt(row.content, row.keyVersion),
    }));

    const trimmedHistory = trimHistoryByApproxBudget(historyMessages);

    const baseSystemPrompt = buildSystemPrompt(user, {
      mode: session.mode,
      topic: session.topic ?? undefined,
    });

    const isExplanationRequest = isExplanationIntent(userContent);
    const expectedTemplate = resolveExpectedTemplate({
      isExplanationRequest,
      mode: session.mode,
    });

    const strictExplanationOverride = buildStrictExplanationOverride({
      isExplanationRequest,
      explanationLanguage: user.explanation_language,
    });

    const systemPrompt = `${baseSystemPrompt}${strictExplanationOverride}`;
    const labels = getExplanationLabels(user.explanation_language);
    const correctionLabel = getCorrectionLabel(user.explanation_language);

    const streamResult = streamText({
      model: openai("gpt-5.2"),
      system: systemPrompt,
      messages: trimmedHistory,
      maxRetries: 2,
    });

    const assistantMessageId = randomUUID();
    const assistantTextPartId = randomUUID();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageId: assistantMessageId });
        writer.write({ type: "text-start", id: assistantTextPartId });

        let streamErrored = false;
        let streamedAssistantTextRaw = "";

        try {
          for await (const delta of streamResult.textStream) {
            streamedAssistantTextRaw += delta;
            writer.write({
              type: "text-delta",
              id: assistantTextPartId,
              delta,
            });
          }
        } catch (error) {
          streamErrored = true;
          console.error("Chat text stream error:", error);
        } finally {
          writer.write({ type: "text-end", id: assistantTextPartId });
        }

        const streamedAssistantText = streamedAssistantTextRaw.trim();
        const fallbackText = safeFallbackText(user.explanation_language);

        let finalText = streamedAssistantText || fallbackText;
        let moderationStatus: ModerationStatus = "ok";
        let languagePolicyStatus: LanguagePolicyStatus = "pass";
        let languagePolicyReason: string | null = null;
        let replacementReason: "language_policy" | "moderation" =
          "language_policy";
        let persisted = false;

        try {
          if (!streamErrored) {
            const firstAudit = auditLanguagePolicy({
              text: finalText,
              explanationLanguage: user.explanation_language,
              labels,
              correctionLabel,
              expectedTemplate,
            });

            if (!firstAudit.ok) {
              languagePolicyReason = firstAudit.reasonCode;
              const repairedText = await repairAssistantText({
                originalText: finalText,
                explanationLanguage: user.explanation_language,
                expectedTemplate,
                labels,
                correctionLabel,
              });

              if (repairedText) {
                const repairedAudit: LanguagePolicyAuditResult =
                  auditLanguagePolicy({
                    text: repairedText,
                    explanationLanguage: user.explanation_language,
                    labels,
                    correctionLabel,
                    expectedTemplate,
                  });

                if (repairedAudit.ok) {
                  finalText = repairedText;
                  languagePolicyStatus = "repaired";
                } else {
                  finalText = fallbackText;
                  languagePolicyStatus = "repair_failed";
                  languagePolicyReason = repairedAudit.reasonCode;
                }
              } else {
                finalText = fallbackText;
                languagePolicyStatus = "repair_failed";
              }
            }
          } else {
            finalText = fallbackText;
            languagePolicyStatus = "fallback";
            languagePolicyReason = "stream_error";
          }

          const assistantModeration = await isContentSafe(finalText);
          moderationStatus = assistantModeration.safe
            ? "ok"
            : assistantModeration.reason === "OUTAGE"
              ? "outage"
              : "blocked";

          logAssistantModerationTelemetry({
            userId: user.id,
            sessionId,
            status: moderationStatus,
            reasonCategory:
              assistantModeration.categories?.[0] ??
              assistantModeration.reason ??
              null,
            contentHash: hashContent(finalText),
          });

          if (moderationStatus !== "ok") {
            finalText = fallbackText;
            replacementReason = "moderation";
            languagePolicyStatus = "fallback";
          }

          await persistAssistantFinalText({
            userId: user.id,
            sessionId,
            session,
            assistantText: finalText,
            explanationLanguage: user.explanation_language,
            userContentForExtraction,
            allowExtraction: moderationStatus === "ok",
            prismaClient: prisma,
          });
          persisted = true;
        } catch (error) {
          console.error("Assistant post-stream finalize error:", error);
          finalText = fallbackText;
          replacementReason = "moderation";
          languagePolicyStatus = "fallback";
          moderationStatus = "outage";

          logAssistantModerationTelemetry({
            userId: user.id,
            sessionId,
            status: moderationStatus,
            reasonCategory: "post_stream_error",
            contentHash: hashContent(finalText),
          });
        }

        if (!persisted) {
          try {
            await persistAssistantFinalText({
              userId: user.id,
              sessionId,
              session,
              assistantText: finalText,
              explanationLanguage: user.explanation_language,
              userContentForExtraction,
              allowExtraction: false,
              prismaClient: prisma,
            });
          } catch (persistError) {
            console.error("Assistant fallback persistence failed:", persistError);
          }
        }

        const shouldEmitRepair =
          finalText.trim() !== streamedAssistantText.trim();

        if (shouldEmitRepair) {
          writer.write({
            type: "data-language_repair",
            data: {
              event: "language_repair",
              messageId: assistantMessageId,
              replacementText: finalText,
              reason:
                replacementReason === "moderation" || moderationStatus !== "ok"
                  ? "moderation"
                  : "language_policy",
              template: expectedTemplate,
            },
            transient: true,
          });
        }

        logLanguagePolicyTelemetry({
          userId: user.id,
          sessionId,
          status: languagePolicyStatus,
          reasonCode: languagePolicyReason,
          expectedTemplate,
          contentHash: hashContent(finalText),
        });

        let finishReason: FinishReason = "stop";
        if (streamErrored) {
          finishReason = "error";
        } else {
          try {
            finishReason = await streamResult.finishReason;
          } catch {
            finishReason = "error";
          }
        }

        writer.write({
          type: "finish",
          finishReason,
        });
      },
      onError: (error) => {
        console.error("Chat UI stream error:", error);
        return "Noe gikk galt. Prov igjen senere.";
      },
    });

    return createUIMessageStreamResponse({ stream });
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
  explanationLanguage: string,
  prismaClient: PrismaClient,
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
1) Norwegian vocabulary, phrases, and grammar points that the tutor introduced, explained, used, highlighted, or corrected in this assistant reply.
   For each vocab item provide:
   - term: the Norwegian word or phrase
   - kind: one of vocab | phrase | grammar
   - source: one of assistant_reply | correction
   - explanation: brief meaning/explanation in the requested explanation language
   - example: a short Norwegian sentence that uses the term. If there is no suitable example, use empty string "".
2) Mistakes the tutor corrected (type, example: what the student wrote wrong, correction: the correct form).

Rules:
- Do NOT extract terms that appear only in the user's message unless the tutor also used or explained them in the assistant reply.
- Do NOT include filler/service words unless they are explicitly taught as grammar points.

Return empty arrays only if there is truly nothing to extract.`;

  const { output } = await generateText({
    model: openai("gpt-5.2"),
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
    if (
      !shouldKeepExtractedTerm({
        rawTerm: v.term,
        assistantText,
        lastUserMessage,
      })
    ) {
      continue;
    }

    const preparedTerm = prepareVocabTerm(v.term);
    if (!preparedTerm) continue;

    const normalizedKind = normalizeVocabKind(v.kind);
    const normalizedSource = normalizeVocabSource(v.source);

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
      select: { term: true, kind: true },
    });

    const mergedKind = mergeVocabKinds(existingTerm?.kind, normalizedKind);

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
        kind: mergedKind,
        source: normalizedSource,
        explanation: v.explanation?.trim() ?? null,
        exampleSentence: v.example?.trim() ?? null,
        nextReviewAt: computeNextReviewAtFromStrength(0),
      },
      update: {
        kind: mergedKind,
        source: normalizedSource,
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
