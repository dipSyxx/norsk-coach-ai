import {
  CORRECTION_LABELS,
  EXPL_LABELS,
  type ExplanationLanguage,
  type ExplanationLabels,
  type PromptTemplateId,
} from "./system-prompt";

const LETTER_RE = /\p{L}/u;
const LATIN_RE = /\p{Script=Latin}/u;
const CYRILLIC_RE = /\p{Script=Cyrillic}/u;

type LanguagePolicyReasonCode =
  | "empty_text"
  | "template_mismatch"
  | "foreign_heading"
  | "no_explanation_letters"
  | "expected_cyrillic"
  | "expected_latin"
  | "too_much_cyrillic"
  | "too_much_latin";

export type LanguagePolicyAuditParams = {
  text: string;
  explanationLanguage: string;
  labels: ExplanationLabels;
  correctionLabel: string;
  expectedTemplate: PromptTemplateId;
};

export type LanguagePolicyAuditResult = {
  ok: boolean;
  reasonCode: LanguagePolicyReasonCode | null;
  expectedTemplate: PromptTemplateId;
};

function normalizeExplanationLanguage(
  value: string | null | undefined,
): ExplanationLanguage {
  if (value === "ukrainian" || value === "english" || value === "norwegian") {
    return value;
  }
  return "norwegian";
}

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function getLineRemainder(line: string, prefix: string): string {
  return line.slice(prefix.length).trim();
}

function hasPrefixLine(lines: string[], prefix: string): boolean {
  return lines.some((line) => line.startsWith(prefix));
}

function isTemplateShapeValid(
  lines: string[],
  labels: ExplanationLabels,
  expectedTemplate: PromptTemplateId,
): boolean {
  if (expectedTemplate === "template_1") {
    const required = [
      `${labels.expl}:`,
      `- ${labels.meaning}:`,
      `- ${labels.examples}:`,
      `- ${labels.exercise}:`,
    ];
    return required.every((prefix) => hasPrefixLine(lines, prefix));
  }

  if (expectedTemplate === "template_2") {
    const required = [
      `${labels.grammar}:`,
      `- ${labels.rule}:`,
      `- ${labels.commonMistake}:`,
      `- ${labels.examples}:`,
      `- ${labels.exercise}:`,
    ];
    return required.every((prefix) => hasPrefixLine(lines, prefix));
  }

  return true;
}

function collectExplanationSegments(
  lines: string[],
  labels: ExplanationLabels,
  correctionLabel: string,
  expectedTemplate: PromptTemplateId,
): string[] {
  const segments: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (expectedTemplate === "template_1") {
      const prefixes = [
        `${labels.expl}:`,
        `- ${labels.meaning}:`,
        `- ${labels.grammar}:`,
        `${labels.notes}:`,
      ];

      for (const prefix of prefixes) {
        if (line.startsWith(prefix)) {
          const remainder = getLineRemainder(line, prefix);
          if (remainder) segments.push(remainder);
        }
      }
      continue;
    }

    if (expectedTemplate === "template_2") {
      const prefixes = [
        `${labels.grammar}:`,
        `- ${labels.rule}:`,
        `- ${labels.commonMistake}:`,
        `${labels.notes}:`,
      ];

      for (const prefix of prefixes) {
        if (line.startsWith(prefix)) {
          const remainder = getLineRemainder(line, prefix);
          if (remainder) segments.push(remainder);
        }
      }
      continue;
    }

    if (line.startsWith(`${correctionLabel}:`)) {
      const emDashIndex = line.indexOf("—");
      if (emDashIndex >= 0) {
        const explanationPart = line.slice(emDashIndex + 1).trim();
        if (explanationPart) segments.push(explanationPart);
      } else {
        const remainder = getLineRemainder(line, `${correctionLabel}:`);
        if (remainder) segments.push(remainder);
      }
      continue;
    }

    if (line.startsWith(`${labels.notes}:`)) {
      const remainder = getLineRemainder(line, `${labels.notes}:`);
      if (remainder) segments.push(remainder);
    }
  }

  return segments;
}

function detectForeignHeading(
  lines: string[],
  labels: ExplanationLabels,
  correctionLabel: string,
): boolean {
  const allowedHeadings = new Set<string>([
    labels.expl,
    labels.meaning,
    labels.grammar,
    labels.examples,
    labels.exercise,
    labels.notes,
    labels.rule,
    labels.commonMistake,
    correctionLabel,
  ]);

  const allKnownHeadings = new Set<string>([
    ...Object.values(EXPL_LABELS.norwegian),
    ...Object.values(EXPL_LABELS.english),
    ...Object.values(EXPL_LABELS.ukrainian),
    ...Object.values(CORRECTION_LABELS),
  ]);

  const foreignHeadings = [...allKnownHeadings].filter(
    (heading) => !allowedHeadings.has(heading),
  );

  for (const line of lines) {
    for (const heading of foreignHeadings) {
      if (line.startsWith(`${heading}:`) || line.startsWith(`- ${heading}:`)) {
        return true;
      }
    }
  }

  return false;
}

function validateScriptRatios(
  explanationText: string,
  explanationLanguage: string,
  expectedTemplate: PromptTemplateId,
): { ok: boolean; reasonCode: LanguagePolicyReasonCode | null } {
  const letters = [...explanationText].filter((char) => LETTER_RE.test(char));

  if (letters.length === 0) {
    return {
      ok: expectedTemplate === "template_3",
      reasonCode:
        expectedTemplate === "template_3" ? null : "no_explanation_letters",
    };
  }

  const latinCount = letters.filter((char) => LATIN_RE.test(char)).length;
  const cyrillicCount = letters.filter((char) => CYRILLIC_RE.test(char)).length;

  const latinRatio = latinCount / letters.length;
  const cyrillicRatio = cyrillicCount / letters.length;

  const normalizedLanguage = normalizeExplanationLanguage(explanationLanguage);

  if (normalizedLanguage === "ukrainian") {
    if (cyrillicRatio < 0.45) {
      return { ok: false, reasonCode: "expected_cyrillic" };
    }
    if (latinRatio > 0.45) {
      return { ok: false, reasonCode: "too_much_latin" };
    }
    return { ok: true, reasonCode: null };
  }

  if (latinRatio < 0.55) {
    return { ok: false, reasonCode: "expected_latin" };
  }

  if (cyrillicRatio > 0.2) {
    return { ok: false, reasonCode: "too_much_cyrillic" };
  }

  return { ok: true, reasonCode: null };
}

export function auditLanguagePolicy(
  params: LanguagePolicyAuditParams,
): LanguagePolicyAuditResult {
  const normalized = normalizeText(params.text);
  if (!normalized) {
    return {
      ok: false,
      reasonCode: "empty_text",
      expectedTemplate: params.expectedTemplate,
    };
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!isTemplateShapeValid(lines, params.labels, params.expectedTemplate)) {
    return {
      ok: false,
      reasonCode: "template_mismatch",
      expectedTemplate: params.expectedTemplate,
    };
  }

  if (detectForeignHeading(lines, params.labels, params.correctionLabel)) {
    return {
      ok: false,
      reasonCode: "foreign_heading",
      expectedTemplate: params.expectedTemplate,
    };
  }

  const explanationSegments = collectExplanationSegments(
    lines,
    params.labels,
    params.correctionLabel,
    params.expectedTemplate,
  );

  const scriptCheck = validateScriptRatios(
    explanationSegments.join("\n"),
    params.explanationLanguage,
    params.expectedTemplate,
  );

  return {
    ok: scriptCheck.ok,
    reasonCode: scriptCheck.reasonCode,
    expectedTemplate: params.expectedTemplate,
  };
}
