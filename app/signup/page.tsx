"use client";

import React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Noe gikk galt");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/onboarding",
      });

      if (signInRes?.error) {
        toast.success("Konto opprettet. Logg inn for å fortsette.");
        router.push("/login");
        setLoading(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
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
            Opprett konto
          </h1>
          <p className="text-sm text-muted-foreground">
            Start din norsktrening i dag
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Navn (valgfritt)</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Ditt navn"
              autoComplete="name"
            />
          </div>

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
              placeholder="Minst 6 tegn"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Oppretter konto..." : "Opprett konto"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Har du allerede en konto?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline font-medium"
          >
            Logg inn
          </Link>
        </p>
      </div>
    </main>
  );
}
