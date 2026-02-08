import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";

export type SessionUser = Awaited<ReturnType<typeof auth>> extends infer S
  ? S extends { user: infer U } | null
    ? U extends null
      ? never
      : U
    : never
  : never;

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
