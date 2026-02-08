import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level, coachStyle, explanationLanguage, topics, goal, name } =
      await req.json();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(level != null && { level }),
        ...(coachStyle != null && { coachStyle }),
        ...(explanationLanguage != null && { explanationLanguage }),
        ...(topics != null && { topics: Array.isArray(topics) ? topics : undefined }),
        ...(goal != null && { goal }),
        ...(name != null && { name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
