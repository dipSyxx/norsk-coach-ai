import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opprett konto",
  description: "Opprett konto i NorskCoach AI og start norsktreningen.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
