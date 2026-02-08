import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";

/** Return type of getSession() — snake_case to match API/database conventions. */
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  level: string;
  coach_style: string;
  explanation_language: string;
  topics: string[];
  goal: string;
  onboarding_complete: boolean;
};

export async function getSession() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    level: session.user.level ?? "A2",
    coach_style: session.user.coachStyle ?? "friendly",
    explanation_language: session.user.explanationLanguage ?? "norwegian",
    topics: session.user.topics ?? [],
    goal: session.user.goal ?? "snakke",
    onboarding_complete: session.user.onboardingComplete ?? false,
  };
}

export async function requireAuth(): Promise<NonNullable<Awaited<ReturnType<typeof getSession>>>> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export { auth, signIn, signOut };
