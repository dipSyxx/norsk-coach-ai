import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bekreft e-post",
  description: "Skriv inn bekreftelseskoden du mottok på e-post.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function VerifyEmailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
