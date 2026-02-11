import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    level?: string;
    coachStyle?: string;
    explanationLanguage?: string;
    timeZone?: string;
    topics?: string[];
    goal?: string;
    onboardingComplete?: boolean;
  }

  interface Session {
    user: User & {
      id: string;
      level: string;
      coachStyle: string;
      explanationLanguage: string;
      timeZone: string;
      topics: string[];
      goal: string;
      onboardingComplete: boolean;
    };
  }
}
