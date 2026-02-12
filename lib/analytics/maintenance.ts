import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDateKeyInTimeZone,
  shiftDateKey,
  toDateKeyFromUtcDate,
  toUtcDateFromDateKey,
} from "@/lib/analytics/date";
import { RETENTION_DAY_OFFSETS, recomputeRetentionForDate } from "@/lib/analytics/service";

const ANALYTICS_CURSOR_ID = "default";
const MAINTENANCE_LOCK_ID = 814_220_991;

async function tryAcquireLock(prismaClient: PrismaClient): Promise<boolean> {
  const rows = await prismaClient.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${MAINTENANCE_LOCK_ID}) AS locked
  `;

  return rows[0]?.locked === true;
}

async function releaseLock(prismaClient: PrismaClient): Promise<void> {
  await prismaClient.$queryRaw`
    SELECT pg_advisory_unlock(${MAINTENANCE_LOCK_ID})
  `;
}

export async function ensureAnalyticsMaintenanceRun(
  prismaClient: PrismaClient = prisma
) {
  const todayKeyUtc = getDateKeyInTimeZone(new Date(), "UTC");

  const cursor = await prismaClient.analyticsCursor.findUnique({
    where: { id: ANALYTICS_CURSOR_ID },
    select: { lastReconciledDate: true },
  });

  if (
    cursor &&
    toDateKeyFromUtcDate(cursor.lastReconciledDate) >= todayKeyUtc
  ) {
    return;
  }

  const locked = await tryAcquireLock(prismaClient);
  if (!locked) {
    return;
  }

  try {
    const freshCursor = await prismaClient.analyticsCursor.findUnique({
      where: { id: ANALYTICS_CURSOR_ID },
      select: { lastReconciledDate: true },
    });

    let currentKey = freshCursor
      ? shiftDateKey(toDateKeyFromUtcDate(freshCursor.lastReconciledDate), 1)
      : todayKeyUtc;

    if (currentKey > todayKeyUtc) {
      return;
    }

    while (currentKey <= todayKeyUtc) {
      for (const dayOffset of RETENTION_DAY_OFFSETS) {
        const cohortDateKey = shiftDateKey(currentKey, -dayOffset);
        await recomputeRetentionForDate(cohortDateKey, dayOffset, prismaClient);
      }

      await prismaClient.analyticsCursor.upsert({
        where: { id: ANALYTICS_CURSOR_ID },
        create: {
          id: ANALYTICS_CURSOR_ID,
          lastReconciledDate: toUtcDateFromDateKey(currentKey),
        },
        update: {
          lastReconciledDate: toUtcDateFromDateKey(currentKey),
        },
      });

      currentKey = shiftDateKey(currentKey, 1);
    }
  } finally {
    await releaseLock(prismaClient);
  }
}
