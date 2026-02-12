"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";

const TOPICS = [
  { id: "jobb", label: "Jobb og karriere" },
  { id: "skole", label: "Skole og utdanning" },
  { id: "helse", label: "Helse og lege" },
  { id: "butikk", label: "Butikk og handel" },
  { id: "reise", label: "Reise og ferie" },
  { id: "familie", label: "Familie og venner" },
  { id: "mat", label: "Mat og matlaging" },
  { id: "bolig", label: "Bolig og hjem" },
  { id: "okonomi", label: "Økonomi og bank" },
  { id: "transport", label: "Transport" },
  { id: "fritid", label: "Fritid og hobby" },
  { id: "teknologi", label: "Teknologi" },
  { id: "samfunn", label: "Samfunn" },
  { id: "kultur", label: "Kultur" },
  { id: "natur", label: "Natur og vær" },
];

const LEVEL_OPTIONS = [
  {
    value: "A1",
    label: "A1 - Nybegynner",
    desc: "Kan forstå og bruke helt enkle uttrykk",
  },
  {
    value: "A2",
    label: "A2 - Grunnleggende",
    desc: "Kan forstå og bruke enkle setninger i dagliglivet",
  },
  {
    value: "B1",
    label: "B1 - Mellomnivå",
    desc: "Kan forstå hovedpunkter i klart standardspråk",
  },
  {
    value: "B2",
    label: "B2 - Selvstendig",
    desc: "Kan delta aktivt i samtaler om mange emner",
  },
  {
    value: "C1",
    label: "C1 - Avansert",
    desc: "Kan uttrykke deg flytende og presist i komplekse situasjoner",
  },
] as const;

const GOAL_OPTIONS = [
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
  {
    value: "uttale",
    label: "Uttale",
    desc: "Jobbe med uttale, trykk og flyt",
  },
  {
    value: "lytting",
    label: "Lytting",
    desc: "Forstå muntlig norsk i naturlig tempo",
  },
  {
    value: "skriving",
    label: "Skriving",
    desc: "Skrive tydeligere og mer korrekt norsk",
  },
] as const;

const COACH_STYLE_OPTIONS = [
  {
    value: "friendly",
    label: "Vennlig",
    desc: "Oppmuntrende og tålmodig",
  },
  {
    value: "balanced",
    label: "Balansert",
    desc: "Kombinerer støtte med tydelige korreksjoner",
  },
  {
    value: "strict",
    label: "Streng",
    desc: "Direkte og utfordrende",
  },
  {
    value: "socratic",
    label: "Sokratisk",
    desc: "Stiller spørsmål som får deg til å finne svaret selv",
  },
] as const;

const EXPLANATION_LANGUAGE_OPTIONS = [
  { value: "norwegian", label: "Norsk" },
  { value: "ukrainian", label: "Ukrainsk" },
  { value: "english", label: "Engelsk" },
] as const;

const cardVariants: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.985, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.99,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
};

const optionHover = {
  whileHover: { y: -2, scale: 1.01 },
  whileTap: { scale: 0.985 },
} as const;

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
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
          animate={{ x: [0, 42, -18, 0], y: [0, -20, 26, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl"
          animate={{ x: [0, -30, 18, 0], y: [0, 28, -14, 0], scale: [1, 0.92, 1.06, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_58%)]"
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <motion.div
                key={i}
                className="h-2 rounded-full"
                animate={{
                  width: i === step || i < step ? 32 : 8,
                  opacity: i === step ? 1 : i < step ? 0.55 : 0.35,
                  backgroundColor:
                    i === step || i < step
                      ? "hsl(var(--primary))"
                      : "hsl(var(--border))",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {steps[step].title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {steps[step].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative rounded-xl border border-border bg-card/90 backdrop-blur-sm p-6 mb-6 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.45)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {step === 0 && (
                <div className="flex flex-col gap-3">
                  {LEVEL_OPTIONS.map((opt) => {
                    const active = data.level === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        asChild
                        type="button"
                      >
                        <motion.button
                          type="button"
                          onClick={() => setData((p) => ({ ...p, level: opt.value }))}
                          animate={active ? { y: -1 } : { y: 0 }}
                          className={`flex h-auto w-full flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/8 text-foreground"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                          {...optionHover}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-sm text-muted-foreground">{opt.desc}</span>
                        </motion.button>
                      </Button>
                    );
                  })}
                </div>
              )}

              {step === 1 && (
                <div className="flex flex-col gap-3">
                  {GOAL_OPTIONS.map((opt) => {
                    const active = data.goal === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        asChild
                        type="button"
                      >
                        <motion.button
                          type="button"
                          onClick={() => setData((p) => ({ ...p, goal: opt.value }))}
                          animate={active ? { y: -1 } : { y: 0 }}
                          className={`flex h-auto w-full flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/8 text-foreground"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                          {...optionHover}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-sm text-muted-foreground">{opt.desc}</span>
                        </motion.button>
                      </Button>
                    );
                  })}
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-2 gap-3">
                  {TOPICS.map((topic, index) => {
                    const active = data.topics.includes(topic.id);
                    return (
                      <Button
                        key={topic.id}
                        asChild
                        type="button"
                      >
                        <motion.button
                          type="button"
                          onClick={() => toggleTopic(topic.id)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={`flex h-auto w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                            active
                              ? "border-primary bg-primary/8 text-foreground"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                          {...optionHover}
                        >
                          <motion.div
                            className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              active ? "bg-primary border-primary" : "border-border"
                            }`}
                            animate={active ? { scale: 1.06 } : { scale: 1 }}
                            transition={{ type: "spring", stiffness: 420, damping: 24 }}
                          >
                            {active && <Check className="h-3 w-3 text-primary-foreground" />}
                          </motion.div>
                          {topic.label}
                        </motion.button>
                      </Button>
                    );
                  })}
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-foreground">Veilederstil</span>
                    {COACH_STYLE_OPTIONS.map((opt) => {
                      const active = data.coachStyle === opt.value;
                      return (
                        <Button
                          key={opt.value}
                          asChild
                          type="button"
                        >
                          <motion.button
                            type="button"
                            onClick={() => setData((p) => ({ ...p, coachStyle: opt.value }))}
                            animate={active ? { y: -1 } : { y: 0 }}
                            className={`flex h-auto w-full flex-col items-start rounded-lg border p-4 text-left transition-colors ${
                              active
                                ? "border-primary bg-primary/8 text-foreground"
                                : "border-border hover:border-primary/40 text-foreground"
                            }`}
                            {...optionHover}
                          >
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-sm text-muted-foreground">{opt.desc}</span>
                          </motion.button>
                        </Button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-foreground">Forklaringsspråk</span>
                    {EXPLANATION_LANGUAGE_OPTIONS.map((opt) => {
                      const active = data.explanationLanguage === opt.value;
                      return (
                        <Button
                          key={opt.value}
                          asChild
                          type="button"
                        >
                          <motion.button
                            type="button"
                            onClick={() =>
                              setData((p) => ({
                                ...p,
                                explanationLanguage: opt.value,
                              }))
                            }
                            animate={active ? { y: -1 } : { y: 0 }}
                            className={`h-auto w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                              active
                                ? "border-primary bg-primary/8 text-foreground"
                                : "border-border hover:border-primary/40 text-foreground"
                            }`}
                            {...optionHover}
                          >
                            {opt.label}
                          </motion.button>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          layout
          className="flex items-center justify-between"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
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
            <Button onClick={() => setStep((s) => s + 1)} className="gap-1">
              Neste
              <motion.span animate={{ x: [0, 2, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Button>
          ) : (
            <Button onClick={finish} disabled={loading} className="gap-1">
              {loading ? "Lagrer..." : "Fullfør"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </motion.div>
      </motion.div>
    </main>
  );
}
