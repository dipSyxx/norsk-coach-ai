import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareVocabTerm } from "@/lib/vocab-normalization";
import { computeNextReviewAtFromStrength } from "@/lib/srs";
import { MASTERED_STRENGTH } from "@/lib/vocab-thresholds";
import { mergeVocabKinds } from "@/lib/vocab-taxonomy";
import {
  nullIfBlank,
  parseBodyWithSchema,
  vocabCreateSchema,
} from "@/lib/validation";

const LEXICAL_KINDS = ["vocab", "phrase"] as const;

export async function GET(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const kindParam = url.searchParams.get("kind");
    const kindFilter = kindParam === "grammar" ? "grammar" : "lexical";

    const baseWhere = {
      userId: user.id,
      ...(kindFilter === "grammar"
        ? { kind: "grammar" as const }
        : { kind: { in: [...LEXICAL_KINDS] } }),
    };
    let items;

    if (filter === "due") {
      items = await prisma.vocabItem.findMany({
        where: { ...baseWhere, nextReviewAt: { lte: new Date() } },
        orderBy: { nextReviewAt: "asc" },
      });
    } else if (filter === "mastered") {
      items = await prisma.vocabItem.findMany({
        where: { ...baseWhere, strength: { gte: MASTERED_STRENGTH } },
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
      kind: i.kind,
      source: i.source,
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

    const parsed = await parseBodyWithSchema(req, vocabCreateSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { term, explanation, exampleSentence, sessionId } = parsed.data;
    const preparedTerm = prepareVocabTerm(term);

    if (!preparedTerm) {
      return NextResponse.json(
        { error: "Term must contain letters or numbers" },
        { status: 400 }
      );
    }

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { id: true },
      });
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
    }

    const nextReviewAt = computeNextReviewAtFromStrength(0);

    const existingTerm = await prisma.vocabItem.findFirst({
      where: {
        userId: user.id,
        OR: [
          {
            term: {
              equals: preparedTerm.normalized,
              mode: "insensitive",
            },
          },
          {
            term: {
              equals: preparedTerm.rawTrimmed,
              mode: "insensitive",
            },
          },
        ],
      },
      select: { term: true, kind: true },
    });

    const hasExistingMatch = Boolean(existingTerm);

    const item = await prisma.vocabItem.upsert({
      where: {
        userId_term: {
          userId: user.id,
          term: existingTerm?.term ?? preparedTerm.term,
        },
      },
      create: {
        userId: user.id,
        sessionId: sessionId ?? null,
        term: preparedTerm.term,
        kind: "vocab",
        source: "assistant_reply",
        explanation: nullIfBlank(explanation),
        exampleSentence: nullIfBlank(exampleSentence),
        nextReviewAt,
      },
      update: {
        kind: mergeVocabKinds(existingTerm?.kind, "vocab"),
        explanation: nullIfBlank(explanation),
        exampleSentence: nullIfBlank(exampleSentence),
        ...(sessionId != null && { sessionId }),
      },
    });

    return NextResponse.json({
      action: hasExistingMatch ? "updated" : "created",
      item: {
        id: item.id,
        term: item.term,
        explanation: item.explanation,
        example_sentence: item.exampleSentence,
        strength: item.strength,
        created_at: item.createdAt,
        kind: item.kind,
        source: item.source,
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
