/**
 * Shared verification-code logic used by:
 *   - POST /api/auth/signup   (send code right after user creation)
 *   - POST /api/verify/send   (resend / request new code)
 */
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  sendVerificationCodeEmail,
  isEmailConfigured,
  VERIFY_CODE_TTL_MINUTES,
} from '@/lib/email'

/** Minimum interval (ms) between consecutive code requests for the same email. */
export const RESEND_COOLDOWN_MS = 60_000

/** Hash a plain-text code with SHA-256 (deterministic, fast). */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Generate a 6-digit code, persist its SHA-256 hash in VerificationToken,
 * and send the code via Maileroo.
 *
 * @param email  - recipient address (must already exist in the users table)
 * @param name   - display name for the email greeting (optional)
 * @param skipCooldown - skip the resend cooldown check (e.g. first send during signup)
 * @returns `{ ok: true }` on success, `{ ok: false, error, retryAfter? }` on failure
 */
export async function generateAndSendVerificationCode(
  email: string,
  name?: string | null,
  skipCooldown = false,
): Promise<{ ok: boolean; error?: string; retryAfter?: number }> {
  // 1. Email service check
  if (!isEmailConfigured()) {
    return { ok: false, error: 'Email service is not configured' }
  }

  // 2. Rate-limit (unless explicitly skipped, e.g. first send after signup)
  if (!skipCooldown) {
    const existing = await prisma.verificationToken.findFirst({
      where: { identifier: email },
    })

    if (existing) {
      const ttlMs = VERIFY_CODE_TTL_MINUTES * 60_000
      const createdAt = new Date(existing.expires.getTime() - ttlMs)
      const elapsed = Date.now() - createdAt.getTime()

      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil(
          (RESEND_COOLDOWN_MS - elapsed) / 1000,
        )
        return {
          ok: false,
          error: `Please wait ${retryAfter}s before requesting a new code`,
          retryAfter,
        }
      }
    }
  }

  // 3. Delete any previous tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  // 4. Generate a 6-digit code
  const code = crypto.randomInt(100_000, 1_000_000).toString()
  const hashedToken = hashCode(code)
  const expires = new Date(
    Date.now() + VERIFY_CODE_TTL_MINUTES * 60_000,
  )

  // 5. Store the hashed code
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  })

  // 6. Send the email
  const result = await sendVerificationCodeEmail(email, {
    code,
    name: name ?? undefined,
    expiryMinutes: VERIFY_CODE_TTL_MINUTES,
  })

  if (!result.ok) {
    console.error('Failed to send verification email:', result.error)
    return { ok: false, error: 'Failed to send verification email' }
  }

  return { ok: true }
}
