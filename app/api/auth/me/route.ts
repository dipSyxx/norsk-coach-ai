import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

const SUPPORTED_EXPLANATION_LANGUAGES = new Set([
  "norwegian",
  "ukrainian",
  "english",
]);

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const rawExplanationLanguage = session.user.explanationLanguage ?? "norwegian";
  const explanationLanguage = SUPPORTED_EXPLANATION_LANGUAGES.has(
    rawExplanationLanguage
  )
    ? rawExplanationLanguage
    : "norwegian";

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      level: session.user.level,
      coachStyle: session.user.coachStyle,
      explanationLanguage,
      topics: session.user.topics,
      goal: session.user.goal,
      onboardingComplete: session.user.onboardingComplete,
    },
  });
}
