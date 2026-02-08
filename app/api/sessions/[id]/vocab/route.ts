import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/:id/vocab — vocab items from this session (for "New words from this chat" panel).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const session = await prisma.chatSession.findFirst({
      where: { id, userId: user.id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const items = await prisma.vocabItem.findMany({
      where: { userId: user.id, sessionId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        term: true,
        explanation: true,
        exampleSentence: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        term: i.term,
        explanation: i.explanation,
        example_sentence: i.exampleSentence,
        created_at: i.createdAt,
      })),
    });
  } catch (error) {
    console.error("Session vocab error:", error);
    return NextResponse.json(
      { error: "Failed to load vocabulary" },
      { status: 500 }
    );
  }
}
