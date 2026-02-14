import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { generateAndSendVerificationCode } from '@/lib/verification'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await generateAndSendVerificationCode(
      session.email,
      session.name,
    )

    if (!result.ok) {
      const status = result.retryAfter ? 429 : 502
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Verify/send error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
