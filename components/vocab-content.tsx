"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Eye,
  Plus,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

type QuizMode = "list" | "running" | "completed";

interface QuizQueueItem {
  itemId: string;
  term: string;
  explanation: string | null;
  example_sentence: string | null;
  repeatCount: number;
}

interface QuizStats {
  answered: number;
  knew: number;
  didntKnow: number;
}

const QUIZ_SESSION_SIZE = 10;
const QUIZ_MAX_REPEAT = 2;

function createEmptyQuizStats(): QuizStats {
  return { answered: 0, knew: 0, didntKnow: 0 };
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Nye" },
  { value: "due", label: "Til repetering" },
  { value: "mastered", label: "Mestret" },
];

export function VocabContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialFilter = searchParams.get("filter") || "all";
  const modeFromUrl = searchParams.get("mode");

  const [filter, setFilter] = useState(initialFilter);
  const [showAdd, setShowAdd] = useState(false);

  const [quizMode, setQuizMode] = useState<QuizMode>("list");
  const [quizQueue, setQuizQueue] = useState<QuizQueueItem[]>([]);
  const [quizStats, setQuizStats] = useState<QuizStats>(createEmptyQuizStats);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [isSubmittingQuizAnswer, setIsSubmittingQuizAnswer] = useState(false);

  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    `/api/vocab?filter=${filter}`,
    fetcher
  );
  const items = data?.items || [];

  const currentQuizCard = quizQueue[0] ?? null;
  const quizProgressTotal = quizStats.answered + quizQueue.length;

  const buildUrlWithMode = useCallback(
    (mode: "quiz" | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (mode === null) {
        params.delete("mode");
      } else {
        params.set("mode", mode);
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams]
  );

  const clearQuizModeParam = useCallback(() => {
    if (!searchParams.get("mode")) return;
    router.replace(buildUrlWithMode(null), { scroll: false });
  }, [buildUrlWithMode, router, searchParams]);

  const startQuiz = useCallback(async () => {
    if (isStartingQuiz) return;
    setIsStartingQuiz(true);

    try {
      const res = await fetch("/api/vocab?filter=all");
      if (!res.ok) {
        throw new Error("Failed to load vocab");
      }

      const payload = (await res.json()) as { items?: VocabItem[] };
      const allItems = payload.items ?? [];

      if (allItems.length === 0) {
        toast.error("Ingen ord i ordforrådet ennå");
        setQuizMode("list");
        setQuizQueue([]);
        setQuizStats(createEmptyQuizStats());
        setIsRevealed(false);
        clearQuizModeParam();
        return;
      }

      const selectedItems = shuffleItems(allItems)
        .slice(0, QUIZ_SESSION_SIZE)
        .map((item) => ({
          itemId: item.id,
          term: item.term,
          explanation: item.explanation,
          example_sentence: item.example_sentence,
          repeatCount: 0,
        }));

      setQuizQueue(selectedItems);
      setQuizStats(createEmptyQuizStats());
      setIsRevealed(false);
      setShowAdd(false);
      setQuizMode("running");
      router.replace(buildUrlWithMode("quiz"), { scroll: false });
    } catch {
      toast.error("Kunne ikke starte quiz");
      clearQuizModeParam();
    } finally {
      setIsStartingQuiz(false);
    }
  }, [buildUrlWithMode, clearQuizModeParam, isStartingQuiz, router]);

  useEffect(() => {
    if (modeFromUrl === "quiz" && quizMode === "list" && !isStartingQuiz) {
      void startQuiz();
    }
  }, [isStartingQuiz, modeFromUrl, quizMode, startQuiz]);

  const exitQuiz = useCallback(() => {
    setQuizMode("list");
    setQuizQueue([]);
    setQuizStats(createEmptyQuizStats());
    setIsRevealed(false);
    setIsSubmittingQuizAnswer(false);
    clearQuizModeParam();
  }, [clearQuizModeParam]);

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

  async function handleQuizAnswer(knew: boolean) {
    if (!currentQuizCard || isSubmittingQuizAnswer) return;

    setIsSubmittingQuizAnswer(true);
    try {
      const res = await fetch("/api/vocab/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: currentQuizCard.itemId, knew }),
      });

      if (!res.ok) {
        throw new Error("Failed to save quiz answer");
      }

      const remaining = quizQueue.slice(1);
      if (!knew && currentQuizCard.repeatCount < QUIZ_MAX_REPEAT) {
        remaining.push({
          ...currentQuizCard,
          repeatCount: currentQuizCard.repeatCount + 1,
        });
      }

      setQuizQueue(remaining);
      setQuizStats((prev) => ({
        answered: prev.answered + 1,
        knew: prev.knew + (knew ? 1 : 0),
        didntKnow: prev.didntKnow + (knew ? 0 : 1),
      }));
      setIsRevealed(false);

      await Promise.all([
        mutate(`/api/vocab?filter=${filter}`),
        mutate("/api/vocab?filter=all"),
      ]);

      if (remaining.length === 0) {
        setQuizMode("completed");
        clearQuizModeParam();
      }
    } catch {
      toast.error("Kunne ikke oppdatere ordet. Prøv igjen.");
    } finally {
      setIsSubmittingQuizAnswer(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {quizMode === "list" ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => void startQuiz()}
                disabled={isStartingQuiz}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3 w-3" />
                {isStartingQuiz ? "Starter..." : "Start quiz"}
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdd ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {showAdd ? "Avbryt" : "Legg til ord"}
              </button>
            </div>
          </div>

          {showAdd && (
            <form
              onSubmit={handleAdd}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
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
            </form>
          )}

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
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
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground text-sm">
                          {item.term}
                        </span>
                        <StrengthBadge strength={item.strength} />
                      </div>
                      {item.explanation && (
                        <p className="text-xs text-muted-foreground">
                          {item.explanation}
                        </p>
                      )}
                      {item.example_sentence && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          {item.example_sentence}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {quizMode === "running" && currentQuizCard
                  ? `Kort ${quizStats.answered + 1} / ${quizProgressTotal}`
                  : "Quiz fullført"}
              </p>
              <h2 className="font-semibold text-foreground text-base">Ordquiz</h2>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exitQuiz}
              disabled={isSubmittingQuizAnswer || isStartingQuiz}
            >
              Avslutt quiz
            </Button>
          </div>

          {quizMode === "running" && currentQuizCard ? (
            <>
              <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-7">
                <p className="text-2xl md:text-3xl font-semibold text-foreground break-words">
                  {currentQuizCard.term}
                </p>

                {isRevealed ? (
                  <div className="mt-4 space-y-2">
                    {currentQuizCard.explanation ? (
                      <p className="text-sm text-muted-foreground">
                        {currentQuizCard.explanation}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ingen forklaring lagret.
                      </p>
                    )}
                    {currentQuizCard.example_sentence && (
                      <p className="text-sm italic text-muted-foreground">
                        {currentQuizCard.example_sentence}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Prøv å huske betydningen, og vis så svaret.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!isRevealed ? (
                  <Button
                    type="button"
                    className="sm:col-span-2"
                    onClick={() => setIsRevealed(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Vis svar
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => void handleQuizAnswer(false)}
                      disabled={isSubmittingQuizAnswer}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Ikke sikker
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleQuizAnswer(true)}
                      disabled={isSubmittingQuizAnswer}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Jeg vet det
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Besvart: {quizStats.answered}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  Vet: {quizStats.knew}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                  Vet ikke: {quizStats.didntKnow}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Igjen: {quizQueue.length}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-6">
                <p className="text-sm text-muted-foreground">Du er ferdig med runden.</p>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {quizStats.knew} visste, {quizStats.didntKnow} usikre
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Totalt besvart: {quizStats.answered}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => void startQuiz()}
                  disabled={isStartingQuiz}
                >
                  {isStartingQuiz ? "Starter..." : "Start ny quiz"}
                </Button>
                <Button type="button" variant="outline" onClick={exitQuiz}>
                  Tilbake til ordliste
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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
        colors[strength] || colors[0]
      )}
    >
      {labels[strength] || "Ny"}
    </span>
  );
}
