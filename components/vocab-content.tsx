"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { BookOpen, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeVocabTerm } from "@/lib/vocab-normalization";
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

type VocabAddResponse = {
  action?: "created" | "updated";
  item: VocabItem;
};

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
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    term: "",
    explanation: "",
    exampleSentence: "",
  });

  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    `/api/vocab?filter=${filter}`,
    fetcher,
  );
  const { data: allVocabData, isLoading: isCheckingSimilar } = useSWR<{
    items: VocabItem[];
  }>(showAdd ? "/api/vocab?filter=all" : null, fetcher);

  const items = data?.items || [];
  const allVocabItems = allVocabData?.items;

  const { exactMatch, similarMatches } = useMemo(() => {
    const normalizedInput = normalizeVocabTerm(addForm.term);
    if (!showAdd || !normalizedInput) {
      return { exactMatch: null as VocabItem | null, similarMatches: [] as VocabItem[] };
    }

    const normalizedItems = (allVocabItems ?? []).map((item) => ({
      item,
      normalized: normalizeVocabTerm(item.term),
    }));
    const exact = normalizedItems.find(
      ({ normalized }) => normalized === normalizedInput,
    )?.item ?? null;

    if (normalizedInput.length < 3) {
      return { exactMatch: exact, similarMatches: [] as VocabItem[] };
    }

    const similar = normalizedItems
      .filter(({ item, normalized }) => {
        if (exact && item.id === exact.id) return false;
        return (
          normalized.startsWith(normalizedInput) ||
          normalizedInput.startsWith(normalized) ||
          normalized.includes(normalizedInput) ||
          normalizedInput.includes(normalized)
        );
      })
      .slice(0, 3)
      .map(({ item }) => item);

    return { exactMatch: exact, similarMatches: similar };
  }, [addForm.term, allVocabItems, showAdd]);

  function resetAddForm() {
    setAddForm({ term: "", explanation: "", exampleSentence: "" });
  }

  function handleToggleAdd() {
    setShowAdd((prev) => {
      const next = !prev;
      if (!next) {
        resetAddForm();
      }
      return next;
    });
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingAdd) return;

    const term = addForm.term.trim();
    const explanation = addForm.explanation.trim();
    const exampleSentence = addForm.exampleSentence.trim();
    if (!term) return;

    try {
      setIsSubmittingAdd(true);
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, explanation, exampleSentence }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Kunne ikke legge til ord");
      }

      const payload = (await res.json()) as VocabAddResponse;
      const action = payload.action || "created";
      if (action === "updated") {
        toast.success(`"${payload.item.term}" finnes allerede, oppdatert.`);
      } else {
        toast.success(`"${payload.item.term}" lagt til`);
      }

      setShowAdd(false);
      resetAddForm();
      await Promise.all([
        mutate(`/api/vocab?filter=${filter}`),
        mutate("/api/vocab?filter=all"),
        mutate("/api/vocab?filter=new"),
        mutate("/api/vocab?filter=due"),
        mutate("/api/vocab?filter=mastered"),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke legge til ord",
      );
    } finally {
      setIsSubmittingAdd(false);
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
          <Button
            key={f.value}
            asChild
            type="button"
            variant={filter === f.value ? "default" : "secondary"}
            size="sm"
            className={cn(
              "h-7 rounded-lg px-3 text-xs font-medium",
              filter !== f.value &&
                "text-muted-foreground hover:text-foreground",
            )}
          >
            <motion.button
              type="button"
              onClick={() => setFilter(f.value)}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
            >
              {f.label}
            </motion.button>
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <motion.div whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button asChild size="sm" className="h-7 gap-1 px-3 text-xs">
              <Link href="/vocab/quiz">
                <RotateCcw className="h-3 w-3" />
                Start quiz
              </Link>
            </Button>
          </motion.div>
          <Button
            asChild
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <motion.button
              type="button"
              onClick={handleToggleAdd}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
            >
              {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAdd ? "Avbryt" : "Legg til ord"}
            </motion.button>
          </Button>
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
                value={addForm.term}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, term: e.target.value }))
                }
              />
            </div>
            {addForm.term.trim() && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                {isCheckingSimilar ? (
                  <p className="text-xs text-muted-foreground">
                    Sjekker lignende ord...
                  </p>
                ) : exactMatch ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Lignende ord finnes allerede:{" "}
                      <span className="font-semibold">{exactMatch.term}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Når du lagrer nå, oppdaterer vi eksisterende ord i stedet
                      for å lage et nytt.
                    </p>
                  </div>
                ) : similarMatches.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Lignende ord i ordlisten:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {similarMatches.map((match) => (
                        <Button
                          key={match.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAddForm((prev) => ({
                              ...prev,
                              term: match.term,
                            }))
                          }
                          className="h-7 px-2 text-xs"
                        >
                          {match.term}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ingen lignende ord funnet.
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="explanation" className="text-xs">
                Forklaring
              </Label>
              <Input
                id="explanation"
                name="explanation"
                placeholder="Betyr 'cozy' eller 'nice'"
                className="text-sm"
                value={addForm.explanation}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    explanation: e.target.value,
                  }))
                }
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
                value={addForm.exampleSentence}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    exampleSentence: e.target.value,
                  }))
                }
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="self-end"
              disabled={isSubmittingAdd || addForm.term.trim().length === 0}
            >
              {isSubmittingAdd
                ? "Lagrer..."
                : exactMatch
                  ? "Oppdater eksisterende"
                  : "Legg til"}
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
