import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      level TEXT DEFAULT 'A2' CHECK (level IN ('A2', 'B1')),
      coach_style TEXT DEFAULT 'friendly' CHECK (coach_style IN ('friendly', 'strict')),
      explanation_language TEXT DEFAULT 'norwegian' CHECK (explanation_language IN ('norwegian', 'ukrainian', 'english')),
      topics TEXT[] DEFAULT '{}',
      goal TEXT DEFAULT 'snakke' CHECK (goal IN ('snakke', 'grammatikk', 'ordforrad')),
      onboarding_complete BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Chat sessions
  await sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Ny samtale',
      mode TEXT DEFAULT 'free_chat' CHECK (mode IN ('free_chat', 'rollespill', 'rett_teksten', 'ovelse', 'grammatikk')),
      topic TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC)`;

  // Messages
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC)`;

  // Vocabulary items
  await sql`
    CREATE TABLE IF NOT EXISTS vocab_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
      term TEXT NOT NULL,
      explanation TEXT,
      example_sentence TEXT,
      strength INTEGER DEFAULT 0 CHECK (strength >= 0 AND strength <= 5),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      next_review_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocab_items(user_id, next_review_at ASC)`;

  // Mistake patterns
  await sql`
    CREATE TABLE IF NOT EXISTS mistake_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
      mistake_type TEXT NOT NULL,
      example TEXT,
      correction TEXT,
      count INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistake_patterns(user_id)`;

  // User sessions (auth)
  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)`;

  console.log('Database setup complete!');
}

setup().catch(console.error);
