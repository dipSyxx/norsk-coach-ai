/**
 * Check user content with OpenAI Moderation API.
 * In production, moderation outage blocks requests (fail-closed).
 * In development, moderation outage is allowed (fail-open).
 */
export async function isContentSafe(input: string): Promise<{
  safe: boolean;
  categories?: string[];
  reason?: "FLAGGED" | "OUTAGE";
}> {
  const key = process.env.OPENAI_API_KEY;
  const isProd = process.env.NODE_ENV === "production";
  if (!key || !input?.trim()) {
    return { safe: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ input: input.slice(0, 32_000) }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return isProd
        ? { safe: false, reason: "OUTAGE" }
        : { safe: true };
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
    return { safe: false, categories, reason: "FLAGGED" };
  } catch {
    return isProd ? { safe: false, reason: "OUTAGE" } : { safe: true };
  } finally {
    clearTimeout(timeout);
  }
}
