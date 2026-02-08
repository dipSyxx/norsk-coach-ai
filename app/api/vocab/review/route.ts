import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, knew } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Get current strength
    const rows = await sql`
      SELECT strength FROM vocab_items
      WHERE id = ${itemId} AND user_id = ${user.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    const currentStrength = rows[0].strength as number;
    const newStrength = knew
      ? Math.min(currentStrength + 1, 5)
      : Math.max(currentStrength - 1, 0);

    // Spaced repetition intervals (in days)
    const intervals: number[] = [0.5, 1, 2, 4, 8, 16];
    const intervalDays = intervals[newStrength] ?? 1;

    await sql`
      UPDATE vocab_items SET
        strength = ${newStrength},
        last_seen_at = NOW(),
        next_review_at = NOW() + make_interval(days => ${intervalDays})
      WHERE id = ${itemId} AND user_id = ${user.id}
    `;

    return NextResponse.json({ strength: newStrength });
  } catch (error) {
    console.error("Vocab review error:", error);
    return NextResponse.json(
      { error: "Failed to review word" },
      { status: 500 }
    );
  }
}
