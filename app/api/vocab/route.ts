import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";

    const sql = getDb();
    let items;

    if (filter === "due") {
      items = await sql`
        SELECT id, term, explanation, example_sentence, strength, last_seen_at, next_review_at, created_at
        FROM vocab_items
        WHERE user_id = ${user.id} AND next_review_at <= NOW()
        ORDER BY next_review_at ASC
      `;
    } else if (filter === "mastered") {
      items = await sql`
        SELECT id, term, explanation, example_sentence, strength, last_seen_at, next_review_at, created_at
        FROM vocab_items
        WHERE user_id = ${user.id} AND strength >= 4
        ORDER BY created_at DESC
      `;
    } else if (filter === "new") {
      items = await sql`
        SELECT id, term, explanation, example_sentence, strength, last_seen_at, next_review_at, created_at
        FROM vocab_items
        WHERE user_id = ${user.id} AND strength < 2
        ORDER BY created_at DESC
      `;
    } else {
      items = await sql`
        SELECT id, term, explanation, example_sentence, strength, last_seen_at, next_review_at, created_at
        FROM vocab_items
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({ items });
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

    const { term, explanation, exampleSentence } = await req.json();

    if (!term) {
      return NextResponse.json(
        { error: "Term is required" },
        { status: 400 }
      );
    }

    const sql = getDb();
    const rows = await sql`
      INSERT INTO vocab_items (user_id, term, explanation, example_sentence)
      VALUES (${user.id}, ${term}, ${explanation || null}, ${exampleSentence || null})
      RETURNING id, term, explanation, example_sentence, strength, created_at
    `;

    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    console.error("Vocab add error:", error);
    return NextResponse.json(
      { error: "Failed to add word" },
      { status: 500 }
    );
  }
}
