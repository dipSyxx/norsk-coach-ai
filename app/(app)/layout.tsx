import React from "react"
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";

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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
