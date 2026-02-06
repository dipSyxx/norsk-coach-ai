import { cookies } from "next/headers";
import { getDb } from "./db";
import { redirect } from "next/navigation";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  level: string;
  coach_style: string;
  explanation_language: string;
  topics: string[];
  goal: string;
  onboarding_complete: boolean;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;

  const sql = getDb();
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.level, u.coach_style, 
           u.explanation_language, u.topics, u.goal, u.onboarding_complete
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `;

  if (rows.length === 0) return null;
  return rows[0] as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
