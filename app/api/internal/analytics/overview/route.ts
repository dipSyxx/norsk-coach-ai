import { NextResponse } from "next/server";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";
import {
  AnalyticsServiceError,
  getAnalyticsOverview,
} from "@/lib/analytics/service";
import {
  getDateKeyInTimeZone,
  shiftDateKey,
} from "@/lib/analytics/date";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const adminSecret = process.env.ANALYTICS_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json(
        {
          error:
            "ANALYTICS_ADMIN_SECRET is not configured for this environment.",
        },
        { status: 503 }
      );
    }

    const providedSecret = req.headers.get("x-analytics-admin-secret");
    if (!providedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (providedSecret !== adminSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await ensureAnalyticsMaintenanceRun();
    } catch (error) {
      console.error("Analytics overview maintenance failed (non-critical):", error);
    }

    const url = new URL(req.url);
    const today = getDateKeyInTimeZone(new Date(), "UTC");
    const from = url.searchParams.get("from") ?? shiftDateKey(today, -29);
    const to = url.searchParams.get("to") ?? today;

    if (!DATE_KEY_REGEX.test(from) || !DATE_KEY_REGEX.test(to)) {
      return NextResponse.json(
        { error: "'from' and 'to' must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const overview = await getAnalyticsOverview({
      fromDateKey: from,
      toDateKey: to,
    });

    return NextResponse.json({
      range: { from, to },
      ...overview,
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Failed to load analytics overview" },
      { status: 500 }
    );
  }
}
