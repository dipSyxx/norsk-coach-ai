import { z } from "zod";

export const LEVEL_VALUES = ["A1", "A2", "B1", "B2", "C1"] as const;
export const GOAL_VALUES = [
  "snakke",
  "grammatikk",
  "ordforrad",
  "uttale",
  "lytting",
  "skriving",
] as const;
export const COACH_STYLE_VALUES = [
  "friendly",
  "balanced",
  "strict",
  "socratic",
] as const;
export const EXPLANATION_LANGUAGE_VALUES = [
  "norwegian",
  "ukrainian",
  "english",
] as const;
export const TOPIC_VALUES = [
  "jobb",
  "skole",
  "helse",
  "butikk",
  "reise",
  "familie",
  "mat",
  "bolig",
  "okonomi",
  "transport",
  "fritid",
  "teknologi",
  "samfunn",
  "kultur",
  "natur",
] as const;
export const VOCAB_KIND_FILTER_VALUES = ["lexical", "grammar"] as const;
export const CHAT_MODE_VALUES = [
  "free_chat",
  "rollespill",
  "rett_teksten",
  "ovelse",
  "grammatikk",
] as const;

const levelSchema = z.enum(LEVEL_VALUES);
const goalSchema = z.enum(GOAL_VALUES);
const coachStyleSchema = z.enum(COACH_STYLE_VALUES);
const explanationLanguageSchema = z.enum(EXPLANATION_LANGUAGE_VALUES);
const topicSchema = z.enum(TOPIC_VALUES);
const chatModeSchema = z.enum(CHAT_MODE_VALUES);
const vocabKindFilterSchema = z.enum(VOCAB_KIND_FILTER_VALUES);

const topicsSchema = z
  .array(topicSchema)
  .max(TOPIC_VALUES.length, "Too many topics selected")
  .superRefine((topics, ctx) => {
    const unique = new Set(topics);
    if (unique.size !== topics.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Topics must not contain duplicates",
      });
    }
  });

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional().nullable();

export const settingsUpdateSchema = z
  .object({
    level: levelSchema.optional(),
    goal: goalSchema.optional(),
    coachStyle: coachStyleSchema.optional(),
    explanationLanguage: explanationLanguageSchema.optional(),
    topics: topicsSchema.optional(),
    name: optionalText(80),
  })
  .strict()
  .refine(
    (value) =>
      Object.values(value).some((fieldValue) => fieldValue !== undefined),
    {
      message: "At least one field must be provided",
      path: ["_request"],
    }
  );

export const onboardingSchema = z
  .object({
    level: levelSchema.default("A2"),
    goal: goalSchema.default("snakke"),
    topics: topicsSchema.default([]),
    coachStyle: coachStyleSchema.default("friendly"),
    explanationLanguage: explanationLanguageSchema.default("norwegian"),
  })
  .strict();

export const sessionCreateSchema = z
  .object({
    mode: chatModeSchema.default("free_chat"),
    topic: optionalText(120),
    title: optionalText(80),
  })
  .strict();

const chatPartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const chatMessageSchema = z
  .object({
    role: z.string(),
    content: z.string().optional(),
    parts: z.array(chatPartSchema).optional(),
  })
  .passthrough();

const chatMessagesSchema = z.array(chatMessageSchema).max(200);

export const chatRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    messages: z.union([
      chatMessagesSchema,
      z.object({ messages: chatMessagesSchema }).passthrough(),
    ]),
  })
  .passthrough();

export const vocabCreateSchema = z
  .object({
    term: z.string().trim().min(1).max(80),
    explanation: optionalText(240),
    exampleSentence: optionalText(500),
    sessionId: z.string().uuid().optional().nullable(),
  })
  .strict();

export const vocabKindQuerySchema = z
  .object({
    kind: vocabKindFilterSchema.default("lexical"),
  })
  .strict();

export const vocabReviewSchema = z
  .object({
    itemId: z.string().uuid(),
    knew: z.boolean(),
    quizRunId: z.string().uuid().optional().nullable(),
    attemptIndex: z.number().int().min(1).max(10_000).optional(),
    repeatCount: z.number().int().min(0).max(10).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.quizRunId && value.attemptIndex == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attemptIndex"],
        message: "attemptIndex is required when quizRunId is provided",
      });
    }
  });

export const vocabQuizStartSchema = z
  .object({
    plannedCards: z.number().int().min(1).max(100).default(10),
    source: z.string().trim().min(1).max(50).optional().nullable(),
    timeZone: z.string().trim().min(1).max(80).optional().nullable(),
  })
  .strict();

export const vocabQuizCompleteSchema = z
  .object({
    quizRunId: z.string().uuid(),
    durationSec: z.number().int().min(0).max(24 * 60 * 60).optional().nullable(),
  })
  .strict();

export const vocabQuizExitSchema = z
  .object({
    quizRunId: z.string().uuid(),
    durationSec: z.number().int().min(0).max(24 * 60 * 60).optional().nullable(),
  })
  .strict();

export const deleteAccountSchema = z
  .object({
    password: z.string().min(1).max(128),
    confirm: z.literal("DELETE").optional(),
  })
  .strict();

export type ValidationErrorPayload = {
  error: string;
  code: "VALIDATION_ERROR";
  fields?: Record<string, string>;
};

function formatValidationFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_request";
    if (!fields[path]) {
      fields[path] = issue.message;
    }
  }
  return fields;
}

export function validationErrorPayload(
  error: z.ZodError
): ValidationErrorPayload {
  const fields = formatValidationFields(error);
  return {
    error: "Invalid request payload",
    code: "VALIDATION_ERROR",
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
  };
}

export function malformedJsonPayload(): ValidationErrorPayload {
  return {
    error: "Invalid request payload",
    code: "VALIDATION_ERROR",
    fields: { _request: "Malformed JSON payload" },
  };
}

export async function parseBodyWithSchema<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; error: ValidationErrorPayload }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { success: false, error: malformedJsonPayload() };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: validationErrorPayload(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

export function nullIfBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.trim() === "" ? null : value;
}
