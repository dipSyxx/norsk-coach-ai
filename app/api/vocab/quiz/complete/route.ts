import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";
import { AnalyticsServiceError, recordQuizCompleted } from "@/lib/analytics/service";
import { parseBodyWithSchema, vocabQuizCompleteSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    try {
      await ensureAnalyticsMaintenanceRun();
    } catch (error) {
      console.error("Quiz completion maintenance failed (non-critical):", error);
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBodyWithSchema(req, vocabQuizCompleteSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const result = await recordQuizCompleted({
      userId: user.id,
      quizRunId: parsed.data.quizRunId,
      durationSec: parsed.data.durationSec,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Quiz complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete quiz" },
      { status: 500 }
    );
  }
}
