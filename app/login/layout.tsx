import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logg inn",
  description: "Logg inn på NorskCoach AI for å fortsette norsktreningen.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
