import { z } from "zod";

export const vocabItemSchema = z.object({
  term: z.string().describe("Norwegian word or phrase"),
  explanation: z.string().describe("Brief explanation in Norwegian or target language"),
  example: z.string().describe("A short Norwegian sentence that uses the term (not the tutor's question); empty string if no suitable example"),
});

export const mistakeItemSchema = z.object({
  type: z.string().describe("Short label for the mistake type, e.g. ordstilling, verb, artikkel"),
  example: z.string().describe("The incorrect phrase or sentence the student wrote"),
  correction: z.string().describe("The correct form"),
});

export const extractionSchema = z.object({
  vocab: z.array(vocabItemSchema).describe("New Norwegian vocabulary introduced or explained in this message"),
  mistakes: z.array(mistakeItemSchema).describe("Mistakes the tutor corrected in this exchange"),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
