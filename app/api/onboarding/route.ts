import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level, goal, topics, coachStyle, explanationLanguage } =
      await req.json();

    const sql = getDb();
    await sql`
      UPDATE users SET 
        level = ${level || "A2"},
        goal = ${goal || "snakke"},
        topics = ${topics || []},
        coach_style = ${coachStyle || "friendly"},
        explanation_language = ${explanationLanguage || "norwegian"},
        onboarding_complete = true,
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
