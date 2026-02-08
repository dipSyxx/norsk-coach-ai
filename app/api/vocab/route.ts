import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";

    const baseWhere = { userId: user.id };
    let items;

    if (filter === "due") {
      items = await prisma.vocabItem.findMany({
        where: { ...baseWhere, nextReviewAt: { lte: new Date() } },
        orderBy: { nextReviewAt: "asc" },
      });
    } else if (filter === "mastered") {
      items = await prisma.vocabItem.findMany({
        where: { ...baseWhere, strength: { gte: 4 } },
        orderBy: { createdAt: "desc" },
      });
    } else if (filter === "new") {
      items = await prisma.vocabItem.findMany({
        where: { ...baseWhere, strength: { lt: 2 } },
        orderBy: { createdAt: "desc" },
      });
    } else {
      items = await prisma.vocabItem.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
      });
    }

    const mapped = items.map((i) => ({
      id: i.id,
      term: i.term,
      explanation: i.explanation,
      example_sentence: i.exampleSentence,
      strength: i.strength,
      last_seen_at: i.lastSeenAt,
      next_review_at: i.nextReviewAt,
      created_at: i.createdAt,
    }));

    return NextResponse.json({ items: mapped });
  } catch (error) {
    console.error("Vocab list error:", error);
    return NextResponse.json(
      { error: "Failed to load vocabulary" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { term, explanation, exampleSentence, sessionId } = await req.json();

    if (!term) {
      return NextResponse.json(
        { error: "Term is required" },
        { status: 400 }
      );
    }

    const trimmedTerm = String(term).trim();
    const nextReviewAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 0.5 days

    const item = await prisma.vocabItem.upsert({
      where: {
        userId_term: { userId: user.id, term: trimmedTerm },
      },
      create: {
        userId: user.id,
        sessionId: sessionId ?? null,
        term: trimmedTerm,
        explanation: explanation ?? null,
        exampleSentence: exampleSentence ?? null,
        nextReviewAt,
      },
      update: {
        explanation: explanation ?? null,
        exampleSentence: exampleSentence ?? null,
        ...(sessionId != null && { sessionId }),
      },
    });

    return NextResponse.json({
      item: {
        id: item.id,
        term: item.term,
        explanation: item.explanation,
        example_sentence: item.exampleSentence,
        strength: item.strength,
        created_at: item.createdAt,
      },
    });
  } catch (error) {
    console.error("Vocab add error:", error);
    return NextResponse.json(
      { error: "Failed to add word" },
      { status: 500 }
    );
  }
}
