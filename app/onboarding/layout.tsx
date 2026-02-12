import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Sett opp dine læringspreferanser i NorskCoach AI.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
