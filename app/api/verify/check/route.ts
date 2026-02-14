import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/** Hash a plain-text code with SHA-256 (must match the send route). */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(req: Request) {
  try {
    // 1. Auth check
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse & validate body
    const body = await req.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { verified: false, error: 'Invalid code format' },
        { status: 400 },
      )
    }

    const email = session.email
    const hashedToken = hashCode(code)

    // 3. Look up token by composite key (identifier + hashed token)
    const token = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email,
          token: hashedToken,
        },
      },
    })

    if (!token) {
      return NextResponse.json(
        { verified: false, error: 'Invalid or expired code' },
        { status: 400 },
      )
    }

    // 4. Check expiry
    if (token.expires < new Date()) {
      // Clean up the expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      })

      return NextResponse.json(
        { verified: false, error: 'Code has expired' },
        { status: 400 },
      )
    }

    // 5. Mark email as verified & delete token (atomic transaction)
    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      }),
    ])

    return NextResponse.json({ verified: true })
  } catch (error) {
    console.error('Verify/check error:', error)
    return NextResponse.json(
      { verified: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
