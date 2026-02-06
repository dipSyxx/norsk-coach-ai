import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

      const messages = await sql`
        SELECT role, content, created_at
        FROM messages WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
      `;

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

    // Get messages for all sessions
    const sessionIds = sessions.map((s) => s.id);
    let allMessages: Record<string, unknown>[] = [];
    if (sessionIds.length > 0) {
      allMessages = await sql`
        SELECT session_id, role, content, created_at
        FROM messages WHERE session_id = ANY(${sessionIds})
        ORDER BY created_at ASC
      `;
    }

    const data = {
      user: { email: user.email, name: user.name, level: user.level },
      sessions: sessions.map((s) => ({
        ...s,
        messages: allMessages.filter((m) => m.session_id === s.id),
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
