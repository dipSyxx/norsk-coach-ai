/**
 * Check user content with OpenAI Moderation API.
 * Returns true if content is safe, false if flagged.
 */
export async function isContentSafe(input: string): Promise<{ safe: boolean; categories?: string[] }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !input?.trim()) {
    return { safe: true };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ input: input.slice(0, 32_000) }),
    });

    if (!res.ok) {
      return { safe: true }; // Fail open to avoid blocking on API errors
    }

    const data = (await res.json()) as {
      results?: Array<{ flagged: boolean; categories?: Record<string, boolean> }>;
    };
    const result = data.results?.[0];
    if (!result) return { safe: true };

    if (!result.flagged) return { safe: true };

    const categories: string[] = [];
    if (result.categories) {
      for (const [name, flagged] of Object.entries(result.categories)) {
        if (flagged) categories.push(name);
      }
    }
    return { safe: false, categories };
  } catch {
    return { safe: true };
  }
}
