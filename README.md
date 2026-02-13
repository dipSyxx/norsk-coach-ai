# NorskCoach AI

NorskCoach AI is a personalized Norwegian learning web app for A1-C1 learners, with a practical focus on A2-B1 speaking progress.

It combines:
- AI chat tutoring
- auto-correction and grammar feedback
- vocabulary extraction from real conversations
- spaced-repetition review and quiz flows
- user and product learning analytics

## Why this app exists

Most language learners face three recurring problems:
- Practice is inconsistent.
- Corrections are not tracked in a reusable way.
- Progress is hard to measure over time.

NorskCoach AI solves this by turning every chat into structured learning data:
- messages are stored per session
- useful vocabulary is extracted and deduplicated
- each word gets review scheduling (`strength` + `nextReviewAt`)
- quiz outcomes feed streak, completion, and retention metrics

## Core product areas

### 1) Guided chat tutor
- Multiple session modes: `free_chat`, `rollespill`, `grammatikk`, `rett_teksten`, `ovelse`.
- Personalized tutor behavior from onboarding/settings:
  - CEFR level
  - learning goal
  - coach style
  - explanation language (`norwegian`, `ukrainian`, `english`)
  - preferred topics
- Session history is loaded from DB (server-trusted), not client-trusted.
- AI session titles are auto-generated once conversation context is sufficient.

### 2) Vocabulary and grammar capture
- Extracts items from assistant responses into `vocab_items`.
- Taxonomy:
  - `kind`: `vocab` | `phrase` | `grammar`
  - `source`: `assistant_reply` | `correction`
- Normalizes terms and prevents noisy duplicates via upsert logic.
- Supports separate views:
  - lexical (`vocab + phrase`)
  - grammar points

### 3) Spaced repetition and quiz
- Dedicated quiz route: `/vocab/quiz`.
- Session-based quiz runs with analytics-aware lifecycle:
  - `POST /api/vocab/quiz/start`
  - answer via `POST /api/vocab/review`
  - `POST /api/vocab/quiz/complete` or `POST /api/vocab/quiz/exit`
- SRS intervals (`lib/srs.ts`):
  - strength `0..5` -> `0.5, 1, 3, 7, 14, 30` days

### 4) Learning analytics
- Per-user dashboard metrics:
  - current streak
  - longest streak
  - quiz completion rate (7d)
  - known/unknown ratio (7d)
- Product-level internal analytics endpoint:
  - `GET /api/internal/analytics/overview`
  - includes D1/D7 retention and daily totals
- Lazy maintenance (no cron required):
  - reconciliation runs on app usage and key API calls

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS + shadcn/ui
- Motion (`motion/react`) for animations
- Prisma ORM + PostgreSQL (Neon compatible)
- NextAuth v5 (credentials provider)
- AI SDK + OpenAI
- SWR for client data fetching

## High-level architecture

- Frontend:
  - Route groups under `app/` (`/chat`, `/dashboard`, `/vocab`, `/settings`, onboarding/auth pages).
  - Client components in `components/` with SWR-driven API integration.
- Backend:
  - App Router API routes under `app/api/*`.
  - Domain logic in `lib/*` (auth, analytics, prompting, moderation, encryption, SRS, validation).
- Data:
  - Prisma schema in `prisma/schema.prisma`.
  - Incremental migrations in `prisma/migrations/*`.

## Main API overview

Authentication and profile:
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `POST /api/onboarding`
- `PUT /api/settings`
- `POST /api/settings/delete-account`

Chat and sessions:
- `POST /api/chat`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `DELETE /api/sessions/:id/messages`
- `GET /api/sessions/:id/vocab`

Vocabulary and review:
- `GET /api/vocab?filter=all|new|due|mastered&kind=lexical|grammar`
- `POST /api/vocab`
- `POST /api/vocab/review`

Quiz analytics lifecycle:
- `POST /api/vocab/quiz/start`
- `POST /api/vocab/quiz/complete`
- `POST /api/vocab/quiz/exit`

Dashboard and analytics:
- `GET /api/dashboard`
- `GET /api/internal/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD` (requires admin secret header)

Export:
- `GET /api/export` (full export)
- `GET /api/export?sessionId=<uuid>` (single session export)

## Environment variables

Create `.env` with at least:

```bash
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
AUTH_SECRET="your-random-auth-secret"
DATA_ENCRYPTION_KEY="base64-or-hex-32-byte-key"
ANALYTICS_ADMIN_SECRET="internal-analytics-secret"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
GOOGLE_SITE_VERIFICATION=""
```

Notes:
- `DATABASE_URL`: required by Prisma.
- `OPENAI_API_KEY`: required for chat generation, extraction, and moderation.
- `AUTH_SECRET`: required for production-safe auth sessions.
- `DATA_ENCRYPTION_KEY`:
  - production: required by runtime policy
  - local/dev: optional (messages can fallback to plaintext mode)
- `ANALYTICS_ADMIN_SECRET`: required only if you use internal analytics endpoint.

Generate a 32-byte base64 encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Local development

Install dependencies:

```bash
pnpm install
```

Apply migrations (local dev DB):

```bash
pnpm prisma migrate dev
```

Run app:

```bash
pnpm dev
```

Open: `http://localhost:3000`

## Production migration flow

Deploy migrations:

```bash
pnpm prisma migrate deploy
```

If your production DB is non-empty and not baselined yet, baseline first using Prisma migrate resolve, then deploy.

## Scripts

- `pnpm dev` - start development server
- `pnpm build` - Prisma generate + Next build
- `pnpm start` - start production server
- `pnpm typecheck` - TypeScript check
- `pnpm lint` - ESLint check
- `pnpm check` - typecheck + lint

## Security and reliability notes

- Authentication via NextAuth credentials + hashed passwords (`bcryptjs`).
- Message encryption support via AES-256-GCM (`DATA_ENCRYPTION_KEY`).
- Request validation via Zod (`lib/validation.ts`).
- Rate limiting and moderation on chat input.
- Assistant moderation telemetry is structured and avoids raw content logging.
- Ownership checks on user-scoped resources (`session`, `vocab`, `quiz` routes).

## Troubleshooting

### Prisma `P3005` (database schema is not empty)
- Cause: running `migrate deploy` on an existing DB that was never baselined.
- Fix: baseline existing schema with `prisma migrate resolve`, then run deploy.

### Prisma `P3018` with SQL syntax error near `DO`
- Common cause: migration file saved with UTF-8 BOM or malformed SQL.
- Fix: ensure migration SQL is UTF-8 without BOM and re-run migration flow.

### Internal analytics endpoint returns 503
- Cause: `ANALYTICS_ADMIN_SECRET` is not configured.
- Fix: set env variable and send header `x-analytics-admin-secret`.

## Current language support

- Tutor explanation languages:
  - Norwegian
  - Ukrainian
  - English

