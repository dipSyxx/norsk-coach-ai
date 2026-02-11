const EDGE_PUNCTUATION = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

function cleanWhitespace(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function sanitizeVocabTerm(raw: string): string {
  return cleanWhitespace(raw).replace(EDGE_PUNCTUATION, "").trim();
}

export function normalizeVocabTerm(raw: string): string {
  return sanitizeVocabTerm(raw).toLocaleLowerCase("nb-NO");
}

export function prepareVocabTerm(raw: string): {
  term: string;
  normalized: string;
  rawTrimmed: string;
} | null {
  const rawTrimmed = cleanWhitespace(raw);
  const term = sanitizeVocabTerm(rawTrimmed);

  if (!term) return null;

  return {
    term,
    normalized: term.toLocaleLowerCase("nb-NO"),
    rawTrimmed,
  };
}
