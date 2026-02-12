import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";
import { getDashboardLearningMetrics } from "@/lib/analytics/service";

export async function GET() {
  try {
    try {
      await ensureAnalyticsMaintenanceRun();
    } catch (error) {
      console.error("Dashboard maintenance failed (non-critical):", error);
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      sessionCount,
      recentSessions,
      totalVocab,
      newThisWeek,
      mastered,
      dueWords,
      topMistakes,
      newWordsToday,
      mistakesToday,
      learningMetrics,
    ] = await Promise.all([
      prisma.chatSession.count({ where: { userId: user.id } }),
      prisma.chatSession.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, mode: true, updatedAt: true },
      }),
      prisma.vocabItem.count({ where: { userId: user.id } }),
      prisma.vocabItem.count({
        where: { userId: user.id, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.vocabItem.count({
        where: { userId: user.id, strength: { gte: 4 } },
      }),
      prisma.vocabItem.count({
        where: {
          userId: user.id,
          nextReviewAt: { lte: new Date() },
        },
      }),
      prisma.mistakePattern.findMany({
        where: { userId: user.id },
        orderBy: { count: "desc" },
        take: 5,
        select: {
          mistakeType: true,
          count: true,
          example: true,
          correction: true,
        },
      }),
      prisma.vocabItem.count({
        where: {
          userId: user.id,
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.mistakePattern.count({
        where: {
          userId: user.id,
          createdAt: { gte: startOfToday },
        },
      }),
      getDashboardLearningMetrics(user.id, user.time_zone, prisma),
    ]);

    const dagensMal =
      dueWords > 0
        ? { action: "repeter" as const, count: dueWords }
        : { action: "start_chat" as const };

    const knewRatio7d =
      learningMetrics.unknownRatio7d == null
        ? null
        : Math.max(0, Math.min(1, 1 - learningMetrics.unknownRatio7d));

    return NextResponse.json({
      stats: {
        totalSessions: sessionCount,
        totalVocab,
        newWordsThisWeek: newThisWeek,
        masteredWords: mastered,
        dueWords,
      },
      iDag: { newWordsToday, mistakesToday },
      learning: {
        ...learningMetrics,
        knewRatio7d,
      },
      dagensMal,
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode,
        updated_at: s.updatedAt,
      })),
      topMistakes: topMistakes.map((m) => ({
        mistake_type: m.mistakeType,
        count: m.count,
        example: m.example,
        correction: m.correction,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
