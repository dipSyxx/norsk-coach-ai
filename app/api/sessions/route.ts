import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  nullIfBlank,
  parseBodyWithSchema,
  sessionCreateSchema,
} from "@/lib/validation";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });

    const sessionsWithCount = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      topic: s.topic,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      message_count: s._count.messages,
    }));

    return NextResponse.json({ sessions: sessionsWithCount });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Failed to load sessions" },
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

    const parsed = await parseBodyWithSchema(req, sessionCreateSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { mode, topic, title } = parsed.data;

    const session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        mode,
        topic: nullIfBlank(topic),
        title: nullIfBlank(title) ?? "Ny samtale",
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        mode: session.mode,
        topic: session.topic,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Session create error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
