import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * DELETE /api/sessions/:id/messages — clear all messages in the session (session kept).
 */
export async function DELETE(
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

    await sql`DELETE FROM messages WHERE session_id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear messages error:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 }
    );
  }
}
