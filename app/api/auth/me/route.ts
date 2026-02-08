import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      level: session.user.level,
      coachStyle: session.user.coachStyle,
      explanationLanguage: session.user.explanationLanguage,
      topics: session.user.topics,
      goal: session.user.goal,
      onboardingComplete: session.user.onboardingComplete,
    },
  });
}
