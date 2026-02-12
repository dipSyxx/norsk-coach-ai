DO $$
BEGIN
  CREATE TYPE "VocabKind" AS ENUM ('vocab', 'phrase', 'grammar');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "VocabSource" AS ENUM ('assistant_reply', 'correction');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "vocab_items"
  ADD COLUMN IF NOT EXISTS "kind" "VocabKind" NOT NULL DEFAULT 'vocab';

ALTER TABLE "vocab_items"
  ADD COLUMN IF NOT EXISTS "source" "VocabSource" NOT NULL DEFAULT 'assistant_reply';

UPDATE "vocab_items"
SET "kind" = 'vocab'
WHERE "kind" IS NULL;

UPDATE "vocab_items"
SET "source" = 'assistant_reply'
WHERE "source" IS NULL;

CREATE INDEX IF NOT EXISTS "vocab_items_user_id_kind_created_at_idx"
  ON "vocab_items" ("user_id", "kind", "created_at");
