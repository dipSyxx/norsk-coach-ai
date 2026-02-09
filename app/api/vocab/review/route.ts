import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBodyWithSchema, vocabReviewSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBodyWithSchema(req, vocabReviewSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { itemId, knew } = parsed.data;

    const item = await prisma.vocabItem.findFirst({
      where: { id: itemId, userId: user.id },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    const newStrength = knew
      ? Math.min(item.strength + 1, 5)
      : Math.max(item.strength - 1, 0);

    const intervals: number[] = [0.5, 1, 2, 4, 8, 16];
    const intervalDays = intervals[newStrength] ?? 1;
    const nextReviewAt = new Date(
      Date.now() + intervalDays * 24 * 60 * 60 * 1000
    );

    await prisma.vocabItem.update({
      where: { id: itemId },
      data: {
        strength: newStrength,
        lastSeenAt: new Date(),
        nextReviewAt,
      },
    });

    return NextResponse.json({ strength: newStrength });
  } catch (error) {
    console.error("Vocab review error:", error);
    return NextResponse.json(
      { error: "Failed to review word" },
      { status: 500 }
    );
  }
}
