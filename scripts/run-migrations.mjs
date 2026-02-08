/**
 * Run migrations: encryption (key_version), vocab UNIQUE.
 * Load .env manually so DATABASE_URL is set when run via: node scripts/run-migrations.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Create .env or set the variable.");
    process.exit(1);
  }

  console.log("Running migration: messages.key_version...");
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 0`;
  console.log("  Done: key_version");

  console.log("Running migration: vocab_items UNIQUE(user_id, term)...");
  try {
    await sql`ALTER TABLE vocab_items ADD CONSTRAINT vocab_items_user_id_term_key UNIQUE (user_id, term)`;
    console.log("  Done: UNIQUE(user_id, term)");
  } catch (err) {
    if (err.code === "23505" || err.message?.includes("already exists")) {
      console.log("  Constraint already exists, skipping.");
    } else if (err.message?.includes("duplicate key") || err.code === "23505") {
      console.error("  Failed: duplicate (user_id, term) rows exist. Deduplicate first:");
      console.error("  DELETE FROM vocab_items a USING vocab_items b");
      console.error("  WHERE a.id > b.id AND a.user_id = b.user_id AND a.term = b.term;");
      process.exit(1);
    } else {
      throw err;
    }
  }

  console.log("Migrations complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
