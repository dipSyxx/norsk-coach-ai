/**
 * Email sending via Maileroo templates.
 *
 * Required env vars:
 *   MAILEROO_API_KEY          – API key from Maileroo dashboard
 *   MAILEROO_FROM_ADDRESS     – verified sender address
 *   MAILEROO_FROM_NAME        – display name (default: "NorskCoach AI")
 *   MAILEROO_TEMPLATE_VERIFY_ID – numeric template id for verification email
 *   VERIFY_CODE_TTL_MINUTES   – code lifetime in minutes (default: 10)
 */

const apiKey = process.env.MAILEROO_API_KEY
const fromAddress = process.env.MAILEROO_FROM_ADDRESS
const fromName = process.env.MAILEROO_FROM_NAME ?? 'NorskCoach AI'
const templateVerifyId = process.env.MAILEROO_TEMPLATE_VERIFY_ID
  ? Number(process.env.MAILEROO_TEMPLATE_VERIFY_ID)
  : null

/** Code TTL in minutes (read once at module load). */
export const VERIFY_CODE_TTL_MINUTES = Number(
  process.env.VERIFY_CODE_TTL_MINUTES ?? '10',
)

const MAILEROO_TEMPLATE_URL =
  'https://smtp.maileroo.com/api/v2/emails/template'

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns `true` when all required Maileroo env vars are present. */
export function isEmailConfigured(): boolean {
  return Boolean(apiKey && fromAddress && templateVerifyId)
}

// ---------------------------------------------------------------------------
// Generic Maileroo template sender
// ---------------------------------------------------------------------------

async function sendMailerooTemplate(payload: {
  to: string
  subject: string
  template_id: number
  template_data: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey || !fromAddress) {
    return { ok: false, error: 'Email not configured' }
  }

  try {
    const body = {
      from: {
        address: fromAddress,
        display_name: fromName,
      },
      to: [{ address: payload.to }],
      subject: payload.subject,
      template_id: payload.template_id,
      template_data: payload.template_data,
      tracking: true,
      tags: { type: 'verification' },
    }

    const res = await fetch(MAILEROO_TEMPLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      const message =
        data?.message ?? data?.error ?? `HTTP ${res.status}`
      return { ok: false, error: message }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Verification code email
// ---------------------------------------------------------------------------

export interface VerifyCodeEmailParams {
  /** 6-digit verification code (plain text). */
  code: string
  /** Recipient display name (falls back to "there"). */
  name?: string
  /** Minutes until the code expires. */
  expiryMinutes?: number
}

/**
 * Send a verification-code email via Maileroo template
 * (MAILEROO_TEMPLATE_VERIFY_ID).
 */
export async function sendVerificationCodeEmail(
  to: string,
  params: VerifyCodeEmailParams,
): Promise<{ ok: boolean; error?: string }> {
  if (!templateVerifyId) {
    return { ok: false, error: 'MAILEROO_TEMPLATE_VERIFY_ID not set' }
  }

  const expiryMinutes = params.expiryMinutes ?? VERIFY_CODE_TTL_MINUTES
  const year = new Date().getFullYear()

  return sendMailerooTemplate({
    to,
    subject: `${params.code} is your NorskCoach AI verification code`,
    template_id: templateVerifyId,
    template_data: {
      code: params.code,
      name: params.name ?? 'there',
      expiryMinutes,
      year,
    },
  })
}
