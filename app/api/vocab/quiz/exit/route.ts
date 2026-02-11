import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";
import { AnalyticsServiceError, recordQuizExited } from "@/lib/analytics/service";
import { parseBodyWithSchema, vocabQuizExitSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    try {
      await ensureAnalyticsMaintenanceRun();
    } catch (error) {
      console.error("Quiz exit maintenance failed (non-critical):", error);
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBodyWithSchema(req, vocabQuizExitSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const result = await recordQuizExited({
      userId: user.id,
      quizRunId: parsed.data.quizRunId,
      durationSec: parsed.data.durationSec,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Quiz exit error:", error);
    return NextResponse.json(
      { error: "Failed to exit quiz" },
      { status: 500 }
    );
  }
}
