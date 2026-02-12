import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  nullIfBlank,
  parseBodyWithSchema,
  settingsUpdateSchema,
} from "@/lib/validation";

export async function PUT(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBodyWithSchema(req, settingsUpdateSchema);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { level, coachStyle, explanationLanguage, topics, goal, name } =
      parsed.data;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(level != null && { level }),
        ...(coachStyle != null && { coachStyle }),
        ...(explanationLanguage != null && { explanationLanguage }),
        ...(topics != null && { topics }),
        ...(goal != null && { goal }),
        ...(name !== undefined && { name: nullIfBlank(name) }),
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
