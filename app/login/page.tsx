"use client";

import React from "react"

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Noe gikk galt");
        return;
      }

      if (data.user.onboarding_complete) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch {
      toast.error("Kunne ikke koble til serveren");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                N
              </span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              NorskCoach
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Velkommen tilbake
          </h1>
          <p className="text-sm text-muted-foreground">
            Logg inn for å fortsette treningen
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="din@epost.no"
              required
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Passord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Ditt passord"
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Logger inn..." : "Logg inn"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Ny her?{" "}
          <Link
            href="/signup"
            className="text-primary hover:underline font-medium"
          >
            Opprett konto
          </Link>
        </p>
      </div>
    </main>
  );
}
