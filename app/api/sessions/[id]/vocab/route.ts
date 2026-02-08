import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/sessions/:id/vocab — vocab items from this session (for "New words from this chat" panel).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sql = getDb();

    const sessionRows = await sql`
      SELECT id FROM chat_sessions
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const items = await sql`
      SELECT id, term, explanation, example_sentence, created_at
      FROM vocab_items
      WHERE user_id = ${user.id} AND session_id = ${id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Session vocab error:", error);
    return NextResponse.json(
      { error: "Failed to load vocabulary" },
      { status: 500 }
    );
  }
}
