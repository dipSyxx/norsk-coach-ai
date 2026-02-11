import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  daysBetweenDateKeys,
  getDateKeyInTimeZone,
  getRecentDateKeysInTimeZone,
  getTodayDateKeyInTimeZone,
  normalizeTimeZone,
  shiftDateKey,
  toDateKeyFromUtcDate,
  toUtcDateFromDateKey,
} from "@/lib/analytics/date";

type TxClient = Prisma.TransactionClient;

type DailyDelta = {
  quizStartedCount?: number;
  quizCompletedCount?: number;
  reviewCount?: number;
  answeredCount?: number;
  didntKnowCount?: number;
};

const RETENTION_DAY_OFFSETS = [1, 7] as const;

function incrementIfPositive(value: number | undefined) {
  return value && value > 0 ? { increment: value } : undefined;
}

function hasPositiveDelta(delta: DailyDelta): boolean {
  return (
    (delta.quizStartedCount ?? 0) > 0 ||
    (delta.quizCompletedCount ?? 0) > 0 ||
    (delta.reviewCount ?? 0) > 0 ||
    (delta.answeredCount ?? 0) > 0 ||
    (delta.didntKnowCount ?? 0) > 0
  );
}

export class AnalyticsServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function applyDailyDelta(
  tx: TxClient,
  userId: string,
  timeZone: string,
  dateKey: string,
  delta: DailyDelta
) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const statDate = toUtcDateFromDateKey(dateKey);

  const existing = await tx.dailyLearningStat.findUnique({
    where: {
      userId_statDate: {
        userId,
        statDate,
      },
    },
  });

  if (!existing) {
    await tx.dailyLearningStat.create({
      data: {
        userId,
        statDate,
        timeZone: normalizedTimeZone,
        quizStartedCount: delta.quizStartedCount ?? 0,
        quizCompletedCount: delta.quizCompletedCount ?? 0,
        reviewCount: delta.reviewCount ?? 0,
        answeredCount: delta.answeredCount ?? 0,
        didntKnowCount: delta.didntKnowCount ?? 0,
      },
    });
  } else if (hasPositiveDelta(delta)) {
    await tx.dailyLearningStat.update({
      where: {
        userId_statDate: {
          userId,
          statDate,
        },
      },
      data: {
        timeZone: normalizedTimeZone,
        ...(incrementIfPositive(delta.quizStartedCount) && {
          quizStartedCount: incrementIfPositive(delta.quizStartedCount),
        }),
        ...(incrementIfPositive(delta.quizCompletedCount) && {
          quizCompletedCount: incrementIfPositive(delta.quizCompletedCount),
        }),
        ...(incrementIfPositive(delta.reviewCount) && {
          reviewCount: incrementIfPositive(delta.reviewCount),
        }),
        ...(incrementIfPositive(delta.answeredCount) && {
          answeredCount: incrementIfPositive(delta.answeredCount),
        }),
        ...(incrementIfPositive(delta.didntKnowCount) && {
          didntKnowCount: incrementIfPositive(delta.didntKnowCount),
        }),
      },
    });
  }

  let stat = await tx.dailyLearningStat.findUniqueOrThrow({
    where: {
      userId_statDate: {
        userId,
        statDate,
      },
    },
  });

  const nextUnknownRatio =
    stat.answeredCount > 0 ? stat.didntKnowCount / stat.answeredCount : null;
  const nextActive =
    stat.quizCompletedCount >= 1 || stat.reviewCount >= 3;

  const patch: Prisma.DailyLearningStatUpdateInput = {};
  if (stat.unknownRatioRaw !== nextUnknownRatio) {
    patch.unknownRatioRaw = nextUnknownRatio;
  }
  if (stat.active !== nextActive) {
    patch.active = nextActive;
  }

  if (Object.keys(patch).length > 0) {
    stat = await tx.dailyLearningStat.update({
      where: {
        userId_statDate: {
          userId,
          statDate,
        },
      },
      data: patch,
    });
  }

  return {
    stat,
    dateKey,
    becameActive: !Boolean(existing?.active) && stat.active,
  };
}

async function markUserActiveDay(
  tx: TxClient,
  userId: string,
  dateKey: string
) {
  const today = toUtcDateFromDateKey(dateKey);
  const yesterdayKey = shiftDateKey(dateKey, -1);

  const profile = await tx.userLearningProfile.findUnique({
    where: { userId },
  });

  let nextCurrentStreak = 1;
  let nextLongestStreak = 1;
  let nextFirstActiveDate = today;

  if (profile) {
    if (profile.lastActiveDate) {
      const lastActiveKey = toDateKeyFromUtcDate(profile.lastActiveDate);

      if (lastActiveKey === dateKey) {
        nextCurrentStreak = profile.currentStreak;
      } else if (lastActiveKey === yesterdayKey) {
        nextCurrentStreak = profile.currentStreak + 1;
      } else {
        nextCurrentStreak = 1;
      }
    } else {
      nextCurrentStreak = 1;
    }

    nextLongestStreak = Math.max(profile.longestStreak, nextCurrentStreak);
    nextFirstActiveDate = profile.firstActiveDate ?? today;

    await tx.userLearningProfile.update({
      where: { userId },
      data: {
        firstActiveDate: nextFirstActiveDate,
        lastActiveDate: today,
        currentStreak: nextCurrentStreak,
        longestStreak: nextLongestStreak,
      },
    });
  } else {
    await tx.userLearningProfile.create({
      data: {
        userId,
        firstActiveDate: today,
        lastActiveDate: today,
        currentStreak: 1,
        longestStreak: 1,
      },
    });
  }

  await tx.dailyLearningStat.updateMany({
    where: {
      userId,
      statDate: today,
    },
    data: {
      active: true,
      streakAtEndOfDay: nextCurrentStreak,
    },
  });

  return {
    currentStreak: nextCurrentStreak,
    longestStreak: nextLongestStreak,
  };
}

function computeNextReviewAt(strength: number): Date {
  const intervals: number[] = [0.5, 1, 2, 4, 8, 16];
  const intervalDays = intervals[strength] ?? 1;
  return new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
}

export async function recordQuizStarted(
  params: {
    userId: string;
    plannedCards: number;
    source?: string | null;
    timeZone?: string | null;
  },
  prismaClient: PrismaClient = prisma
) {
  const source = params.source?.trim() || "vocab_quiz";
  const requestedTimeZone =
    params.timeZone && params.timeZone.trim() !== ""
      ? normalizeTimeZone(params.timeZone)
      : null;

  return prismaClient.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true, timeZone: true },
    });

    if (!user) {
      throw new AnalyticsServiceError(404, "User not found");
    }

    const effectiveTimeZone =
      requestedTimeZone ?? normalizeTimeZone(user.timeZone);

    if (requestedTimeZone && effectiveTimeZone !== user.timeZone) {
      await tx.user.update({
        where: { id: params.userId },
        data: { timeZone: effectiveTimeZone },
      });
    }

    const now = new Date();
    const run = await tx.quizRun.create({
      data: {
        userId: params.userId,
        source,
        plannedCards: params.plannedCards,
        status: "started",
        timeZone: effectiveTimeZone,
        startedAt: now,
      },
      select: {
        id: true,
        startedAt: true,
      },
    });

    const dateKey = getDateKeyInTimeZone(now, effectiveTimeZone);
    await applyDailyDelta(tx, params.userId, effectiveTimeZone, dateKey, {
      quizStartedCount: 1,
    });

    return {
      quizRunId: run.id,
      startedAt: run.startedAt,
      timeZone: effectiveTimeZone,
    };
  });
}

export async function recordQuizAnswerAndReview(
  params: {
    userId: string;
    itemId: string;
    knew: boolean;
    quizRunId?: string | null;
    attemptIndex?: number | null;
    repeatCount?: number | null;
  },
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (tx) => {
    const item = await tx.vocabItem.findFirst({
      where: { id: params.itemId, userId: params.userId },
    });

    if (!item) {
      throw new AnalyticsServiceError(404, "Item not found");
    }

    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { timeZone: true },
    });

    if (!user) {
      throw new AnalyticsServiceError(404, "User not found");
    }

    let effectiveTimeZone = normalizeTimeZone(user.timeZone);
    let runIdForCounters: string | null = null;

    if (params.quizRunId) {
      const run = await tx.quizRun.findFirst({
        where: { id: params.quizRunId, userId: params.userId },
        select: { id: true, status: true, timeZone: true },
      });

      if (!run) {
        throw new AnalyticsServiceError(404, "Quiz run not found");
      }

      effectiveTimeZone = normalizeTimeZone(run.timeZone);

      if (params.attemptIndex == null) {
        throw new AnalyticsServiceError(
          400,
          "attemptIndex is required when quizRunId is provided"
        );
      }

      const existingAnswer = await tx.quizRunAnswer.findUnique({
        where: {
          quizRunId_attemptIndex: {
            quizRunId: run.id,
            attemptIndex: params.attemptIndex,
          },
        },
        select: { id: true },
      });

      if (existingAnswer) {
        return {
          strength: item.strength,
          idempotent: true,
        };
      }

      if (run.status !== "started") {
        throw new AnalyticsServiceError(409, "Quiz run is not active");
      }

      try {
        await tx.quizRunAnswer.create({
          data: {
            quizRunId: run.id,
            userId: params.userId,
            vocabItemId: params.itemId,
            knew: params.knew,
            repeatCount: params.repeatCount ?? 0,
            attemptIndex: params.attemptIndex,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return {
            strength: item.strength,
            idempotent: true,
          };
        }
        throw error;
      }

      runIdForCounters = run.id;
    }

    const newStrength = params.knew
      ? Math.min(item.strength + 1, 5)
      : Math.max(item.strength - 1, 0);

    await tx.vocabItem.update({
      where: { id: params.itemId },
      data: {
        strength: newStrength,
        lastSeenAt: new Date(),
        nextReviewAt: computeNextReviewAt(newStrength),
      },
    });

    const now = new Date();
    const dateKey = getDateKeyInTimeZone(now, effectiveTimeZone);

    const statUpdate = await applyDailyDelta(
      tx,
      params.userId,
      effectiveTimeZone,
      dateKey,
      {
        reviewCount: 1,
        ...(runIdForCounters
          ? {
              answeredCount: 1,
              didntKnowCount: params.knew ? 0 : 1,
            }
          : {}),
      }
    );

    if (runIdForCounters) {
      await tx.quizRun.update({
        where: { id: runIdForCounters },
        data: {
          answeredCount: { increment: 1 },
          knewCount: { increment: params.knew ? 1 : 0 },
          didntKnowCount: { increment: params.knew ? 0 : 1 },
        },
      });
    }

    if (statUpdate.stat.active) {
      await markUserActiveDay(tx, params.userId, dateKey);
    }

    return {
      strength: newStrength,
      idempotent: false,
    };
  });
}

export async function recordQuizCompleted(
  params: {
    userId: string;
    quizRunId: string;
    durationSec?: number | null;
  },
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (tx) => {
    const run = await tx.quizRun.findFirst({
      where: { id: params.quizRunId, userId: params.userId },
    });

    if (!run) {
      throw new AnalyticsServiceError(404, "Quiz run not found");
    }

    if (run.status === "completed") {
      return {
        alreadyCompleted: true,
        run,
      };
    }

    if (run.status === "exited") {
      throw new AnalyticsServiceError(409, "Quiz run already exited");
    }

    const unknownRatio =
      run.answeredCount > 0 ? run.didntKnowCount / run.answeredCount : null;
    const now = new Date();

    const updatedRun = await tx.quizRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completedAt: now,
        durationSec: params.durationSec ?? run.durationSec,
        unknownRatio,
      },
    });

    const dateKey = getDateKeyInTimeZone(now, normalizeTimeZone(run.timeZone));
    const statUpdate = await applyDailyDelta(
      tx,
      params.userId,
      normalizeTimeZone(run.timeZone),
      dateKey,
      {
        quizCompletedCount: 1,
      }
    );

    if (statUpdate.stat.active) {
      await markUserActiveDay(tx, params.userId, dateKey);
    }

    return {
      alreadyCompleted: false,
      run: updatedRun,
    };
  });
}

export async function recordQuizExited(
  params: {
    userId: string;
    quizRunId: string;
    durationSec?: number | null;
  },
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.$transaction(async (tx) => {
    const run = await tx.quizRun.findFirst({
      where: { id: params.quizRunId, userId: params.userId },
    });

    if (!run) {
      throw new AnalyticsServiceError(404, "Quiz run not found");
    }

    if (run.status === "completed") {
      return {
        alreadyCompleted: true,
        alreadyExited: false,
        run,
      };
    }

    if (run.status === "exited") {
      return {
        alreadyCompleted: false,
        alreadyExited: true,
        run,
      };
    }

    const updatedRun = await tx.quizRun.update({
      where: { id: run.id },
      data: {
        status: "exited",
        exitedAt: new Date(),
        durationSec: params.durationSec ?? run.durationSec,
      },
    });

    return {
      alreadyCompleted: false,
      alreadyExited: false,
      run: updatedRun,
    };
  });
}

export async function recomputeRetentionForDate(
  cohortDateKey: string,
  dayOffset: (typeof RETENTION_DAY_OFFSETS)[number],
  prismaClient: PrismaClient = prisma
) {
  const cohortDate = toUtcDateFromDateKey(cohortDateKey);
  const targetDate = toUtcDateFromDateKey(shiftDateKey(cohortDateKey, dayOffset));

  const cohortUsers = await prismaClient.userLearningProfile.findMany({
    where: { firstActiveDate: cohortDate },
    select: { userId: true },
  });

  const cohortSize = cohortUsers.length;
  let retainedUsers = 0;

  if (cohortSize > 0) {
    retainedUsers = await prismaClient.dailyLearningStat.count({
      where: {
        userId: { in: cohortUsers.map((row) => row.userId) },
        statDate: targetDate,
        active: true,
      },
    });
  }

  const retentionRate = cohortSize > 0 ? retainedUsers / cohortSize : 0;

  return prismaClient.retentionMetric.upsert({
    where: {
      cohortDate_dayOffset: {
        cohortDate,
        dayOffset,
      },
    },
    create: {
      cohortDate,
      dayOffset,
      cohortSize,
      retainedUsers,
      retentionRate,
    },
    update: {
      cohortSize,
      retainedUsers,
      retentionRate,
      calculatedAt: new Date(),
    },
  });
}

export async function getDashboardLearningMetrics(
  userId: string,
  timeZone: string,
  prismaClient: PrismaClient = prisma
) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const last7DateKeys = getRecentDateKeysInTimeZone(normalizedTimeZone, 7);
  const last7Dates = last7DateKeys.map((key) => toUtcDateFromDateKey(key));

  const [stats, profile] = await Promise.all([
    prismaClient.dailyLearningStat.findMany({
      where: {
        userId,
        statDate: {
          in: last7Dates,
        },
      },
      select: {
        quizStartedCount: true,
        quizCompletedCount: true,
        answeredCount: true,
        didntKnowCount: true,
      },
    }),
    prismaClient.userLearningProfile.findUnique({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
      },
    }),
  ]);

  let started = 0;
  let completed = 0;
  let answered = 0;
  let didntKnow = 0;

  for (const stat of stats) {
    started += stat.quizStartedCount;
    completed += stat.quizCompletedCount;
    answered += stat.answeredCount;
    didntKnow += stat.didntKnowCount;
  }

  const quizCompletionRate7d = started > 0 ? completed / started : null;
  const unknownRatio7d = answered > 0 ? didntKnow / answered : null;

  let currentStreak = 0;
  const longestStreak = profile?.longestStreak ?? 0;

  if (profile?.lastActiveDate) {
    const lastActiveKey = toDateKeyFromUtcDate(profile.lastActiveDate);
    const todayKey = getTodayDateKeyInTimeZone(normalizedTimeZone);
    const dayDiff = daysBetweenDateKeys(todayKey, lastActiveKey);

    if (dayDiff === 0 || dayDiff === 1) {
      currentStreak = profile.currentStreak;
    }
  }

  return {
    currentStreak,
    longestStreak,
    quizCompletionRate7d,
    unknownRatio7d,
  };
}

export async function getAnalyticsOverview(
  params: {
    fromDateKey: string;
    toDateKey: string;
  },
  prismaClient: PrismaClient = prisma
) {
  const fromDate = toUtcDateFromDateKey(params.fromDateKey);
  const toDate = toUtcDateFromDateKey(params.toDateKey);

  if (fromDate.getTime() > toDate.getTime()) {
    throw new AnalyticsServiceError(400, "'from' must be before or equal to 'to'");
  }

  const [dailyRows, retentionRows] = await Promise.all([
    prismaClient.dailyLearningStat.groupBy({
      by: ["statDate"],
      where: {
        statDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        quizStartedCount: true,
        quizCompletedCount: true,
        answeredCount: true,
        didntKnowCount: true,
        reviewCount: true,
      },
    }),
    prismaClient.retentionMetric.findMany({
      where: {
        cohortDate: {
          gte: fromDate,
          lte: toDate,
        },
        dayOffset: {
          in: [...RETENTION_DAY_OFFSETS],
        },
      },
      orderBy: [{ cohortDate: "asc" }, { dayOffset: "asc" }],
      select: {
        cohortDate: true,
        dayOffset: true,
        cohortSize: true,
        retainedUsers: true,
        retentionRate: true,
      },
    }),
  ]);

  const daily = dailyRows
    .map((row) => {
      const started = row._sum.quizStartedCount ?? 0;
      const completed = row._sum.quizCompletedCount ?? 0;
      const answered = row._sum.answeredCount ?? 0;
      const didntKnow = row._sum.didntKnowCount ?? 0;
      const reviewCount = row._sum.reviewCount ?? 0;

      return {
        date: toDateKeyFromUtcDate(row.statDate),
        quizStartedCount: started,
        quizCompletedCount: completed,
        reviewCount,
        answeredCount: answered,
        didntKnowCount: didntKnow,
        quizCompletionRate: started > 0 ? completed / started : null,
        unknownRatio: answered > 0 ? didntKnow / answered : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = daily.reduce(
    (acc, row) => {
      acc.quizStartedCount += row.quizStartedCount;
      acc.quizCompletedCount += row.quizCompletedCount;
      acc.reviewCount += row.reviewCount;
      acc.answeredCount += row.answeredCount;
      acc.didntKnowCount += row.didntKnowCount;
      return acc;
    },
    {
      quizStartedCount: 0,
      quizCompletedCount: 0,
      reviewCount: 0,
      answeredCount: 0,
      didntKnowCount: 0,
    }
  );

  const retentionD1 = retentionRows
    .filter((row) => row.dayOffset === 1)
    .map((row) => ({
      cohortDate: toDateKeyFromUtcDate(row.cohortDate),
      cohortSize: row.cohortSize,
      retainedUsers: row.retainedUsers,
      retentionRate: row.retentionRate,
    }));

  const retentionD7 = retentionRows
    .filter((row) => row.dayOffset === 7)
    .map((row) => ({
      cohortDate: toDateKeyFromUtcDate(row.cohortDate),
      cohortSize: row.cohortSize,
      retainedUsers: row.retainedUsers,
      retentionRate: row.retentionRate,
    }));

  return {
    totals: {
      ...totals,
      quizCompletionRate:
        totals.quizStartedCount > 0
          ? totals.quizCompletedCount / totals.quizStartedCount
          : null,
      unknownRatio:
        totals.answeredCount > 0
          ? totals.didntKnowCount / totals.answeredCount
          : null,
    },
    daily,
    retentionD1,
    retentionD7,
  };
}

export { RETENTION_DAY_OFFSETS };
