"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Loader2, MailCheck } from "lucide-react";

/** Cooldown between resend requests (seconds). */
const RESEND_COOLDOWN_S = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // ------------------------------------------------------------------
  // Cooldown timer
  // ------------------------------------------------------------------
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Start with a cooldown (the code was already sent during signup)
  useEffect(() => {
    setCooldown(RESEND_COOLDOWN_S);
  }, []);

  // ------------------------------------------------------------------
  // Submit verification code
  // ------------------------------------------------------------------
  const handleVerify = useCallback(
    async (value: string) => {
      if (value.length !== 6) return;
      setVerifying(true);

      try {
        const res = await fetch("/api/verify/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        const data = await res.json();

        if (data.verified) {
          toast.success("E-post bekreftet!");
          router.push("/onboarding");
          router.refresh();
          // Keep verifying=true so the auto-submit effect doesn't re-fire
          // while the redirect is in progress.
          return;
        }

        toast.error(data.error || "Ugyldig kode");
        setCode("");
      } catch {
        toast.error("Kunne ikke koble til serveren");
      }

      setVerifying(false);
    },
    [router],
  );

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !verifying) {
      handleVerify(code);
    }
  }, [code, verifying, handleVerify]);

  // ------------------------------------------------------------------
  // Resend code
  // ------------------------------------------------------------------
  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/verify/send", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        toast.success("Ny kode sendt!");
        setCooldown(RESEND_COOLDOWN_S);
        setCode("");
      } else {
        toast.error(data.error || "Kunne ikke sende kode");
      }
    } catch {
      toast.error("Kunne ikke koble til serveren");
    } finally {
      setResending(false);
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <motion.main
      className="min-h-screen flex items-center justify-center px-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="w-full max-w-sm"
        initial={{ scale: 0.99 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.24 }}
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <BrandLogo
              href="/"
              imageClassName="h-12 w-12"
              textClassName="text-xl"
              priority
            />
          </div>

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            Bekreft e-posten din
          </h1>
          <p className="text-sm text-muted-foreground">
            Vi har sendt en 6-sifret kode til e-posten din.
            <br />
            Skriv den inn nedenfor.
          </p>
        </div>

        {/* OTP input */}
        <div className="flex flex-col items-center gap-6">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={verifying}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          {/* Verify button */}
          <motion.div
            className="w-full"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
          >
            <Button
              className="w-full"
              disabled={code.length !== 6 || verifying}
              onClick={() => handleVerify(code)}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bekrefter...
                </>
              ) : (
                "Bekreft kode"
              )}
            </Button>
          </motion.div>

          {/* Resend */}
          <p className="text-center text-sm text-muted-foreground">
            Fikk du ikke koden?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              {resending
                ? "Sender..."
                : cooldown > 0
                  ? `Send på nytt (${cooldown}s)`
                  : "Send på nytt"}
            </button>
          </p>
        </div>
      </motion.div>
    </motion.main>
  );
}
