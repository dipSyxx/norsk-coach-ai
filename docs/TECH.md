# NorskCoach AI — Technical Overview

## Storage and history

- **Neon Postgres**: All data lives in Neon (serverless driver `@neondatabase/serverless`). No ORM; raw SQL via tagged template literals.
- **Tables**: `users`, `user_sessions` (auth), `chat_sessions`, `messages`, `vocab_items`, `mistake_patterns`.
- **Flow**: Each user message and each assistant reply is written to `messages` (with optional encryption). Session list and message history are loaded from these tables. Vocab and mistakes are extracted from assistant replies via a structured extraction call and stored in `vocab_items` and `mistake_patterns`.

## Front ↔ Back

- **Auth**: Cookie `session_token`; every protected API calls `getSession()` (reads `user_sessions` + `users`). Session ownership is checked on sessions, messages, vocab, and export.
- **Main APIs**: `POST /api/chat` (streaming, body: `messages` + `sessionId`), `GET/POST/DELETE /api/sessions`, `GET/DELETE /api/sessions/:id`, `GET/DELETE /api/sessions/:id/messages`, `GET /api/sessions/:id/vocab`, `GET /api/vocab`, `POST /api/vocab/review`, `GET /api/export` (optional `?sessionId=`), `GET /api/dashboard`, `GET/PUT /api/settings`, onboarding.
- **Streaming**: Chat uses Vercel AI SDK `streamText`; response is streamed via `toUIMessageStreamResponse()`. Client uses `useChat` with `DefaultChatTransport`.

## Auth and encryption

- **Auth**: Custom cookie-based sessions (not NextAuth). Signup/login hash passwords with bcrypt; a random token is stored in `user_sessions` and set in an httpOnly cookie.
- **Encryption**: When `DATA_ENCRYPTION_KEY` (32-byte hex or base64) is set, `messages.content` is encrypted at rest with AES-256-GCM; `messages.key_version` supports key rotation. Encrypt/decrypt in `lib/encryption.ts`; used on write in `/api/chat` and on read in `/api/sessions/:id` and `/api/export`. Run `scripts/migrate-add-encryption.sql` on existing DBs to add `key_version`.

## Security and limits

- **Rate limit**: In-memory limiter on `POST /api/chat` (e.g. 30 req/min per user). See `lib/rate-limit.ts`.
- **Input**: Max message length 4000 chars; moderation via OpenAI Moderation API before calling the model. Retries (e.g. `maxRetries: 2`) on 429 from OpenAI.

## What we’d add next

- **NextAuth + Prisma**: Align with spec (DB sessions, Prisma schema/migrations).
- **Argon2**: Replace bcrypt for password hashing.
- **Redis (or similar) rate limit**: Persistent and shared across instances.
- **Key rotation**: Script to re-encrypt with a new key and bump `key_version`.
- **Analytics**: Anonymized usage (e.g. session count, message length) and optional feedback events.
