import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export async function GET(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    const sql = getDb();

    if (sessionId) {
      // Export single session
      const sessionRows = await sql`
        SELECT id, title, mode, topic, created_at
        FROM chat_sessions
        WHERE id = ${sessionId} AND user_id = ${user.id}
      `;

      if (sessionRows.length === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const messageRows = await sql`
        SELECT role, content, key_version, created_at
        FROM messages WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
      `;

      const messages = messageRows.map((m) => ({
        role: m.role,
        content: decrypt((m.content as string) ?? "", (m.key_version as number) ?? 0),
        created_at: m.created_at,
      }));

      const data = {
        session: sessionRows[0],
        messages,
        exportedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="session-${sessionId}.json"`,
        },
      });
    }

    // Export all data
    const [sessions, vocab, mistakes] = await Promise.all([
      sql`
        SELECT id, title, mode, topic, created_at
        FROM chat_sessions WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `,
      sql`
        SELECT term, explanation, example_sentence, strength, created_at
        FROM vocab_items WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `,
      sql`
        SELECT mistake_type, example, correction, count
        FROM mistake_patterns WHERE user_id = ${user.id}
      `,
    ]);

    // Get messages for all sessions (decrypt content)
    const sessionIds = sessions.map((s) => s.id);
    let allMessages: { session_id: string; role: string; content: string; key_version: number; created_at: unknown }[] = [];
    if (sessionIds.length > 0) {
      const rows = await sql`
        SELECT session_id, role, content, key_version, created_at
        FROM messages WHERE session_id = ANY(${sessionIds})
        ORDER BY created_at ASC
      `;
      allMessages = rows.map((m) => ({
        session_id: m.session_id as string,
        role: m.role as string,
        content: decrypt((m.content as string) ?? "", (m.key_version as number) ?? 0),
        key_version: (m.key_version as number) ?? 0,
        created_at: m.created_at,
      }));
    }

    const data = {
      user: { email: user.email, name: user.name, level: user.level },
      sessions: sessions.map((s) => ({
        ...s,
        messages: allMessages
          .filter((m) => m.session_id === s.id)
          .map(({ role, content, created_at }) => ({ role, content, created_at })),
      })),
      vocabulary: vocab,
      mistakePatterns: mistakes,
      exportedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="norskcoach-export.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
