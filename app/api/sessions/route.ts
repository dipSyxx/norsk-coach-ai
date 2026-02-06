import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    const sessions = await sql`
      SELECT cs.id, cs.title, cs.mode, cs.topic, cs.created_at, cs.updated_at,
        (SELECT COUNT(*) FROM messages WHERE session_id = cs.id) as message_count
      FROM chat_sessions cs
      WHERE cs.user_id = ${user.id}
      ORDER BY cs.updated_at DESC
    `;

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode, topic, title } = await req.json();

    const sql = getDb();
    const rows = await sql`
      INSERT INTO chat_sessions (user_id, mode, topic, title)
      VALUES (${user.id}, ${mode || "free_chat"}, ${topic || null}, ${title || "Ny samtale"})
      RETURNING id, title, mode, topic, created_at, updated_at
    `;

    return NextResponse.json({ session: rows[0] });
  } catch (error) {
    console.error("Session create error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
