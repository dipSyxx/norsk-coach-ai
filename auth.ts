import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash
        );
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? (token as { id?: string }).id ?? "";
        const full = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            level: true,
            coachStyle: true,
            explanationLanguage: true,
            topics: true,
            goal: true,
            onboardingComplete: true,
          },
        });
        if (full) {
          session.user.level = full.level;
          session.user.coachStyle = full.coachStyle;
          session.user.explanationLanguage = full.explanationLanguage;
          session.user.topics = full.topics;
          session.user.goal = full.goal;
          session.user.onboardingComplete = full.onboardingComplete;
        }
      }
      return session;
    },
  },
});

