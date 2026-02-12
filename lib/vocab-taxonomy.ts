export const VOCAB_KINDS = ["vocab", "phrase", "grammar"] as const;
export const VOCAB_SOURCES = ["assistant_reply", "correction"] as const;

export type VocabKindValue = (typeof VOCAB_KINDS)[number];
export type VocabSourceValue = (typeof VOCAB_SOURCES)[number];

const KIND_RANK: Record<VocabKindValue, number> = {
  grammar: 0,
  vocab: 1,
  phrase: 2,
};

export function normalizeVocabKind(value: string | null | undefined): VocabKindValue {
  if (!value) return "vocab";
  return VOCAB_KINDS.includes(value as VocabKindValue)
    ? (value as VocabKindValue)
    : "vocab";
}

export function normalizeVocabSource(
  value: string | null | undefined
): VocabSourceValue {
  if (!value) return "assistant_reply";
  return VOCAB_SOURCES.includes(value as VocabSourceValue)
    ? (value as VocabSourceValue)
    : "assistant_reply";
}

export function mergeVocabKinds(
  existingKind: string | null | undefined,
  incomingKind: string | null | undefined
): VocabKindValue {
  const current = normalizeVocabKind(existingKind);
  const incoming = normalizeVocabKind(incomingKind);

  return KIND_RANK[incoming] > KIND_RANK[current] ? incoming : current;
}

export function isLexicalKind(kind: string | null | undefined): boolean {
  const normalized = normalizeVocabKind(kind);
  return normalized === "vocab" || normalized === "phrase";
}
