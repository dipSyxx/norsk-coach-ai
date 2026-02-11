"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { BookOpen, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion, type Variants } from "motion/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VocabItem {
  id: string;
  term: string;
  explanation: string | null;
  example_sentence: string | null;
  strength: number;
  last_seen_at: string;
  next_review_at: string;
  created_at: string;
}

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Nye" },
  { value: "due", label: "Til repetering" },
  { value: "mastered", label: "Mestret" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export function VocabContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";

  const [filter, setFilter] = useState(initialFilter);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    `/api/vocab?filter=${filter}`,
    fetcher,
  );
  const items = data?.items || [];

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const term = formData.get("term") as string;
    const explanation = formData.get("explanation") as string;
    const exampleSentence = formData.get("exampleSentence") as string;

    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, explanation, exampleSentence }),
      });

      if (!res.ok) {
        throw new Error("Failed to add vocab");
      }

      toast.success(`"${term}" lagt til`);
      setShowAdd(false);
      await Promise.all([
        mutate(`/api/vocab?filter=${filter}`),
        mutate("/api/vocab?filter=all"),
      ]);
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Kunne ikke legge til ord");
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <motion.button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            {f.label}
          </motion.button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <motion.div whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Link
              href="/vocab/quiz"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="h-3 w-3" />
              Start quiz
            </Link>
          </motion.div>
          <motion.button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showAdd ? "Avbryt" : "Legg til ord"}
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <motion.form
            onSubmit={handleAdd}
            className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="term" className="text-xs">
                Ord / uttrykk
              </Label>
              <Input
                id="term"
                name="term"
                placeholder="f.eks. hyggelig"
                required
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="explanation" className="text-xs">
                Forklaring
              </Label>
              <Input
                id="explanation"
                name="explanation"
                placeholder="Betyr 'cozy' eller 'nice'"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exampleSentence" className="text-xs">
                Eksempel
              </Label>
              <Input
                id="exampleSentence"
                name="exampleSentence"
                placeholder="Det var en hyggelig kveld."
                className="text-sm"
              />
            </div>
            <Button type="submit" size="sm" className="self-end">
              Legg til
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <motion.div variants={itemVariants} className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </motion.div>
      ) : items.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded-xl p-8 text-center"
        >
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-1">
            {filter === "due"
              ? "Ingen ord til repetering akkurat nå"
              : filter === "mastered"
                ? "Du har ikke mestret noen ord ennå"
                : "Ingen ord ennå"}
          </p>
          <p className="text-xs text-muted-foreground">
            {filter === "all" || filter === "new"
              ? "Chat med veilederen for å samle nye ord, eller legg til manuelt."
              : "Fortsett å bruke appen for å bygge ordforrådet ditt."}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                className="bg-card border border-border rounded-lg px-4 py-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                whileHover={{ y: -1, scale: 1.002 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground text-sm">{item.term}</span>
                      <StrengthBadge strength={item.strength} />
                    </div>
                    {item.explanation && (
                      <p className="text-xs text-muted-foreground">{item.explanation}</p>
                    )}
                    {item.example_sentence && (
                      <p className="text-xs text-muted-foreground italic mt-1">{item.example_sentence}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

function StrengthBadge({ strength }: { strength: number }) {
  const colors = [
    "bg-destructive/10 text-destructive",
    "bg-orange-500/10 text-orange-600",
    "bg-yellow-500/10 text-yellow-600",
    "bg-primary/10 text-primary",
    "bg-green-500/10 text-green-600",
    "bg-green-600/10 text-green-700",
  ];

  const labels = ["Ny", "Svak", "Litt", "OK", "Bra", "Mestret"];

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
        colors[strength] || colors[0],
      )}
    >
      {labels[strength] || "Ny"}
    </span>
  );
}
