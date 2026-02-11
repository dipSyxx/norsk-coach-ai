import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { ensureAnalyticsMaintenanceRun } from "@/lib/analytics/maintenance";

/** Return type of getSession() — snake_case to match API/database conventions. */
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  level: string;
  coach_style: string;
  explanation_language: string;
  time_zone: string;
  topics: string[];
  goal: string;
  onboarding_complete: boolean;
};

const SUPPORTED_EXPLANATION_LANGUAGES = new Set([
  "norwegian",
  "ukrainian",
  "english",
]);

export async function getSession() {
  const session = await auth();
  if (!session?.user) return null;
  const rawExplanationLanguage = session.user.explanationLanguage ?? "norwegian";
  const explanationLanguage = SUPPORTED_EXPLANATION_LANGUAGES.has(
    rawExplanationLanguage
  )
    ? rawExplanationLanguage
    : "norwegian";

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    level: session.user.level ?? "A2",
    coach_style: session.user.coachStyle ?? "friendly",
    explanation_language: explanationLanguage,
    time_zone: session.user.timeZone ?? "UTC",
    topics: session.user.topics ?? [],
    goal: session.user.goal ?? "snakke",
    onboarding_complete: session.user.onboardingComplete ?? false,
  };
}

export async function requireAuth(): Promise<NonNullable<Awaited<ReturnType<typeof getSession>>>> {
  const user = await getSession();
  if (!user) redirect("/login");
  try {
    await ensureAnalyticsMaintenanceRun();
  } catch (error) {
    console.error("Analytics maintenance failed (non-critical):", error);
  }
  return user;
}

export { auth, signIn, signOut };
