import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";
import {
  AnalyticsServiceError,
  recordQuizAnswerAndReview,
} from "@/lib/analytics/service";
import { parseBodyWithSchema, vocabReviewSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    try {
      await ensureAnalyticsMaintenanceRun();
    } catch (error) {
      console.error("Review maintenance failed (non-critical):", error);
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBodyWithSchema(req, vocabReviewSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { itemId, knew } = parsed.data;
    const result = await recordQuizAnswerAndReview({
      userId: user.id,
      itemId,
      knew,
      quizRunId: parsed.data.quizRunId,
      attemptIndex: parsed.data.attemptIndex,
      repeatCount: parsed.data.repeatCount,
    });

    return NextResponse.json({
      strength: result.strength,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Vocab review error:", error);
    return NextResponse.json(
      { error: "Failed to review word" },
      { status: 500 }
    );
  }
}
