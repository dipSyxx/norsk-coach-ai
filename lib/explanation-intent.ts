const EXPLANATION_INTENT_PATTERNS: RegExp[] = [
  /\bwhat\s+does\b.+\bmean\b/i,
  /\bmeaning\s+of\b/i,
  /\bdefine\b/i,
  /\btranslation\s+of\b/i,
  /\btranslate\b/i,
  /\bhva\s+betyr\b/i,
  /\bbetyr\s+det\b/i,
  /\boversett\b/i,
  /\boversettelse\b/i,
  /\bщо\s+означає\b/ui,
  /\bщо\s+значить\b/ui,
  /\bпоясни\s+значення\b/ui,
  /\bзначення\s+слова\b/ui,
  /\bпереклади\b/ui,
  /\bпереклад\b/ui,
];

export function isExplanationIntent(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return EXPLANATION_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}
