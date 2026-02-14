import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateAndSendVerificationCode } from "@/lib/verification";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const emailNorm = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: emailNorm },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        onboardingComplete: true,
      },
    });

    // Send verification code (fire-and-forget — signup succeeds even if
    // email delivery fails; the user can resend from /verify-email).
    generateAndSendVerificationCode(emailNorm, name || null, true).catch(
      (err) => console.error("Signup verification email error:", err)
    );

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
