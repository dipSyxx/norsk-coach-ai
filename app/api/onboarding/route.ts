import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level, goal, topics, coachStyle, explanationLanguage } =
      await req.json();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        level: level ?? "A2",
        goal: goal ?? "snakke",
        topics: Array.isArray(topics) ? topics : [],
        coachStyle: coachStyle ?? "friendly",
        explanationLanguage: explanationLanguage ?? "norwegian",
        onboardingComplete: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
