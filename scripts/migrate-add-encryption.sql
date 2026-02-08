-- Run once on existing DBs to add encryption support for messages.
-- New installs get this column from setup-database.sql.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 0;
