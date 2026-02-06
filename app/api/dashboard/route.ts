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

    const [sessionCount, recentSessions, vocabStats, mistakeStats, dueWords] =
      await Promise.all([
        sql`SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = ${user.id}`,
        sql`
          SELECT id, title, mode, updated_at 
          FROM chat_sessions 
          WHERE user_id = ${user.id} 
          ORDER BY updated_at DESC 
          LIMIT 5
        `,
        sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
            COUNT(*) FILTER (WHERE strength >= 4) as mastered
          FROM vocab_items WHERE user_id = ${user.id}
        `,
        sql`
          SELECT mistake_type, count, example, correction
          FROM mistake_patterns
          WHERE user_id = ${user.id}
          ORDER BY count DESC
          LIMIT 5
        `,
        sql`
          SELECT COUNT(*) as count FROM vocab_items
          WHERE user_id = ${user.id} AND next_review_at <= NOW()
        `,
      ]);

    return NextResponse.json({
      stats: {
        totalSessions: Number(sessionCount[0].count),
        totalVocab: Number(vocabStats[0].total),
        newWordsThisWeek: Number(vocabStats[0].new_this_week),
        masteredWords: Number(vocabStats[0].mastered),
        dueWords: Number(dueWords[0].count),
      },
      recentSessions,
      topMistakes: mistakeStats,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
