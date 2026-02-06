import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level, coachStyle, explanationLanguage, topics, goal, name } =
      await req.json();

    const sql = getDb();
    await sql`
      UPDATE users SET
        level = COALESCE(${level}, level),
        coach_style = COALESCE(${coachStyle}, coach_style),
        explanation_language = COALESCE(${explanationLanguage}, explanation_language),
        topics = COALESCE(${topics}, topics),
        goal = COALESCE(${goal}, goal),
        name = COALESCE(${name}, name),
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
