ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "time_zone" TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS "quiz_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" TEXT NOT NULL DEFAULT 'vocab_quiz',
  "planned_cards" INTEGER NOT NULL DEFAULT 10,
  "status" TEXT NOT NULL DEFAULT 'started',
  "time_zone" TEXT NOT NULL DEFAULT 'UTC',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "exited_at" TIMESTAMP(3),
  "answered_count" INTEGER NOT NULL DEFAULT 0,
  "knew_count" INTEGER NOT NULL DEFAULT 0,
  "didnt_know_count" INTEGER NOT NULL DEFAULT 0,
  "duration_sec" INTEGER,
  "unknown_ratio" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "quiz_runs_user_id_started_at_idx"
  ON "quiz_runs"("user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "quiz_runs_status_started_at_idx"
  ON "quiz_runs"("status", "started_at" DESC);

CREATE TABLE IF NOT EXISTS "quiz_run_answers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quiz_run_id" UUID NOT NULL REFERENCES "quiz_runs"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vocab_item_id" UUID NOT NULL REFERENCES "vocab_items"("id") ON DELETE CASCADE,
  "knew" BOOLEAN NOT NULL,
  "repeat_count" INTEGER NOT NULL DEFAULT 0,
  "attempt_index" INTEGER NOT NULL,
  "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_run_answers_quiz_run_id_attempt_index_key" UNIQUE ("quiz_run_id", "attempt_index")
);

CREATE INDEX IF NOT EXISTS "quiz_run_answers_user_id_answered_at_idx"
  ON "quiz_run_answers"("user_id", "answered_at" DESC);

CREATE TABLE IF NOT EXISTS "daily_learning_stats" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stat_date" TIMESTAMP(3) NOT NULL,
  "time_zone" TEXT NOT NULL DEFAULT 'UTC',
  "quiz_started_count" INTEGER NOT NULL DEFAULT 0,
  "quiz_completed_count" INTEGER NOT NULL DEFAULT 0,
  "review_count" INTEGER NOT NULL DEFAULT 0,
  "answered_count" INTEGER NOT NULL DEFAULT 0,
  "didnt_know_count" INTEGER NOT NULL DEFAULT 0,
  "unknown_ratio_raw" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "streak_at_end_of_day" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_learning_stats_user_id_stat_date_key" UNIQUE ("user_id", "stat_date")
);

CREATE INDEX IF NOT EXISTS "daily_learning_stats_stat_date_idx"
  ON "daily_learning_stats"("stat_date");

CREATE TABLE IF NOT EXISTS "user_learning_profiles" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "first_active_date" TIMESTAMP(3),
  "last_active_date" TIMESTAMP(3),
  "current_streak" INTEGER NOT NULL DEFAULT 0,
  "longest_streak" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "retention_metrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cohort_date" TIMESTAMP(3) NOT NULL,
  "day_offset" INTEGER NOT NULL,
  "cohort_size" INTEGER NOT NULL,
  "retained_users" INTEGER NOT NULL,
  "retention_rate" DOUBLE PRECISION NOT NULL,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retention_metrics_cohort_date_day_offset_key" UNIQUE ("cohort_date", "day_offset")
);

CREATE INDEX IF NOT EXISTS "retention_metrics_cohort_date_idx"
  ON "retention_metrics"("cohort_date");

CREATE TABLE IF NOT EXISTS "analytics_cursor" (
  "id" TEXT PRIMARY KEY,
  "last_reconciled_date" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
