import React from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  if (!user.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <AppNav />
      <main className="flex-1 overflow-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </div>
  );
}
