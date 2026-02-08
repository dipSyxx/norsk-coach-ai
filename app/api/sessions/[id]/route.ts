import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

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
      SELECT id, title, mode, topic, created_at, updated_at
      FROM chat_sessions
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const messageRows = await sql`
      SELECT id, role, content, key_version, created_at
      FROM messages
      WHERE session_id = ${id}
      ORDER BY created_at ASC
    `;

    const messages = messageRows.map((m) => ({
      id: m.id,
      role: m.role,
      content: decrypt((m.content as string) ?? "", (m.key_version as number) ?? 0),
      created_at: m.created_at,
    }));

    return NextResponse.json({
      session: sessionRows[0],
      messages,
    });
  } catch (error) {
    console.error("Session detail error:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}

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

    await sql`
      DELETE FROM chat_sessions
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
