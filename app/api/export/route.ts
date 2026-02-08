import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function GET(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const messages = session.messages.map((m) => ({
        role: m.role,
        content: decrypt(m.content, m.keyVersion),
        created_at: m.createdAt,
      }));

      const data = {
        session: {
          id: session.id,
          title: session.title,
          mode: session.mode,
          topic: session.topic,
          created_at: session.createdAt,
        },
        messages,
        exportedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="session-${sessionId}.json"`,
        },
      });
    }

    const [sessions, vocab, mistakes] = await Promise.all([
      prisma.chatSession.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          mode: true,
          topic: true,
          createdAt: true,
        },
      }),
      prisma.vocabItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          term: true,
          explanation: true,
          exampleSentence: true,
          strength: true,
          createdAt: true,
        },
      }),
      prisma.mistakePattern.findMany({
        where: { userId: user.id },
        select: {
          mistakeType: true,
          example: true,
          correction: true,
          count: true,
        },
      }),
    ]);

    const sessionIds = sessions.map((s) => s.id);
    const allMessages = await prisma.message.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { createdAt: "asc" },
      select: {
        sessionId: true,
        role: true,
        content: true,
        keyVersion: true,
        createdAt: true,
      },
    });

    const data = {
      user: {
        email: user.email,
        name: user.name,
        level: user.level,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode,
        topic: s.topic,
        created_at: s.createdAt,
        messages: allMessages
          .filter((m) => m.sessionId === s.id)
          .map((m) => ({
            role: m.role,
            content: decrypt(m.content, m.keyVersion),
            created_at: m.createdAt,
          })),
      })),
      vocabulary: vocab.map((v) => ({
        term: v.term,
        explanation: v.explanation,
        example_sentence: v.exampleSentence,
        strength: v.strength,
        created_at: v.createdAt,
      })),
      mistakePatterns: mistakes.map((m) => ({
        mistake_type: m.mistakeType,
        example: m.example,
        correction: m.correction,
        count: m.count,
      })),
      exportedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="norskcoach-export.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
