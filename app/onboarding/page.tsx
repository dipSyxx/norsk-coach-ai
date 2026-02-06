"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

const TOPICS = [
  { id: "jobb", label: "Jobb og karriere" },
  { id: "skole", label: "Skole og utdanning" },
  { id: "helse", label: "Helse og lege" },
  { id: "butikk", label: "Butikk og handel" },
  { id: "reise", label: "Reise og ferie" },
  { id: "familie", label: "Familie og venner" },
  { id: "mat", label: "Mat og matlaging" },
  { id: "bolig", label: "Bolig og hjem" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    level: "A2",
    goal: "snakke",
    topics: [] as string[],
    coachStyle: "friendly",
    explanationLanguage: "norwegian",
  });

  const steps = [
    { title: "Ditt nivå", subtitle: "Velg ditt nåværende norsknivå" },
    { title: "Ditt mål", subtitle: "Hva vil du fokusere på?" },
    { title: "Dine temaer", subtitle: "Velg temaer som interesserer deg" },
    {
      title: "Lærestil",
      subtitle: "Hvordan vil du at veilederen skal være?",
    },
  ];

  function toggleTopic(id: string) {
    setData((prev) => ({
      ...prev,
      topics: prev.topics.includes(id)
        ? prev.topics.filter((t) => t !== id)
        : [...prev.topics, id],
    }));
  }

  async function finish() {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        toast.error("Noe gikk galt");
        return;
      }

      router.push("/dashboard");
    } catch {
      toast.error("Kunne ikke koble til serveren");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step
                    ? "w-8 bg-primary"
                    : i < step
                      ? "w-8 bg-primary/40"
                      : "w-2 bg-border"
                }`}
              />
            ))}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {steps[step].title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {steps[step].subtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              {[
                {
                  value: "A2",
                  label: "A2 - Grunnleggende",
                  desc: "Kan forstå og bruke enkle setninger",
                },
                {
                  value: "B1",
                  label: "B1 - Mellomnivå",
                  desc: "Kan forstå hovedpunkter i klart standardspråk",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setData((p) => ({ ...p, level: opt.value }))}
                  className={`flex flex-col items-start p-4 rounded-lg border transition-colors text-left ${
                    data.level === opt.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
              {[
                {
                  value: "snakke",
                  label: "Samtale",
                  desc: "Trene på å snakke naturlig norsk",
                },
                {
                  value: "grammatikk",
                  label: "Grammatikk",
                  desc: "Fokusere på grammatikkregler og setningsbygning",
                },
                {
                  value: "ordforrad",
                  label: "Ordforråd",
                  desc: "Lære nye ord og uttrykk",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setData((p) => ({ ...p, goal: opt.value }))}
                  className={`flex flex-col items-start p-4 rounded-lg border transition-colors text-left ${
                    data.goal === opt.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left text-sm ${
                    data.topics.includes(topic.id)
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      data.topics.includes(topic.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    }`}
                  >
                    {data.topics.includes(topic.id) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  {topic.label}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-foreground">
                  Veilederstil
                </span>
                {[
                  {
                    value: "friendly",
                    label: "Vennlig",
                    desc: "Oppmuntrende og tålmodig",
                  },
                  {
                    value: "strict",
                    label: "Streng",
                    desc: "Direkte og utfordrende",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setData((p) => ({ ...p, coachStyle: opt.value }))
                    }
                    className={`flex flex-col items-start p-4 rounded-lg border transition-colors text-left ${
                      data.coachStyle === opt.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:border-primary/40 text-foreground"
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-foreground">
                  Forklaringsspråk
                </span>
                {[
                  { value: "norwegian", label: "Norsk" },
                  { value: "ukrainian", label: "Ukrainsk" },
                  { value: "english", label: "Engelsk" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        explanationLanguage: opt.value,
                      }))
                    }
                    className={`p-3 rounded-lg border transition-colors text-left text-sm ${
                      data.explanationLanguage === opt.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:border-primary/40 text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Button>

          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="gap-1"
            >
              Neste
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={loading} className="gap-1">
              {loading ? "Lagrer..." : "Fullfør"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
