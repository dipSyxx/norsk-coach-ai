-- Run once on existing DBs to allow ON CONFLICT (user_id, term) in vocab inserts.
-- If duplicate (user_id, term) rows exist, deduplicate first or this will fail.
-- To deduplicate: DELETE FROM vocab_items a USING vocab_items b
--   WHERE a.id > b.id AND a.user_id = b.user_id AND a.term = b.term;
ALTER TABLE vocab_items ADD CONSTRAINT vocab_items_user_id_term_key UNIQUE (user_id, term);
