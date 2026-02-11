"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { BookOpen, Eye, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type QuizMode = "loading" | "running" | "completed" | "empty";

interface VocabItem {
  id: string;
  term: string;
  explanation: string | null;
  example_sentence: string | null;
}

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

export function VocabQuizContent() {
  const router = useRouter();
  const startLockRef = useRef(false);

  const [quizMode, setQuizMode] = useState<QuizMode>("loading");
  const [quizQueue, setQuizQueue] = useState<QuizQueueItem[]>([]);
  const [quizStats, setQuizStats] = useState<QuizStats>(createEmptyQuizStats);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [isSubmittingQuizAnswer, setIsSubmittingQuizAnswer] = useState(false);

  const currentQuizCard = quizQueue[0] ?? null;
  const quizProgressTotal = quizStats.answered + quizQueue.length;
  const quizProgressValue =
    quizProgressTotal > 0
      ? Math.round((quizStats.answered / quizProgressTotal) * 100)
      : quizMode === "completed"
        ? 100
        : 0;

  const refreshVocabCaches = useCallback(async () => {
    await Promise.all([
      mutate("/api/vocab?filter=all"),
      mutate("/api/vocab?filter=new"),
      mutate("/api/vocab?filter=due"),
      mutate("/api/vocab?filter=mastered"),
    ]);
  }, []);

  const startQuiz = useCallback(async () => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    setIsStartingQuiz(true);
    setQuizMode("loading");

    try {
      const res = await fetch("/api/vocab?filter=all");
      if (!res.ok) {
        throw new Error("Failed to load vocab");
      }

      const payload = (await res.json()) as { items?: VocabItem[] };
      const allItems = payload.items ?? [];

      if (allItems.length === 0) {
        setQuizQueue([]);
        setQuizStats(createEmptyQuizStats());
        setIsRevealed(false);
        setQuizMode("empty");
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
      setQuizMode("running");
    } catch {
      toast.error("Kunne ikke starte quiz");
      setQuizMode("empty");
    } finally {
      setIsStartingQuiz(false);
      startLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    void startQuiz();
  }, [startQuiz]);

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

      await refreshVocabCaches();

      if (remaining.length === 0) {
        setQuizMode("completed");
      }
    } catch {
      toast.error("Kunne ikke oppdatere ordet. Prøv igjen.");
    } finally {
      setIsSubmittingQuizAnswer(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {quizMode === "running" && currentQuizCard
              ? `Kort ${quizStats.answered + 1} / ${quizProgressTotal}`
              : quizMode === "completed"
                ? "Quiz fullført"
                : "Ordquiz"}
          </p>
          <h2 className="font-semibold text-foreground text-base">Ordquiz</h2>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/vocab">Til ordliste</Link>
        </Button>
      </div>

      {quizMode === "running" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Fremdrift</span>
            <span>{quizProgressValue}%</span>
          </div>
          <Progress value={quizProgressValue} className="h-2" />
        </div>
      )}

      {quizMode === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-7 space-y-4">
            <Skeleton className="h-8 w-1/2 mx-auto" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Skeleton className="h-10 rounded-md sm:col-span-2" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      )}

      {quizMode === "empty" && (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Ingen ord i ordforrådet ennå.
          </p>
          <Button type="button" variant="outline" asChild>
            <Link href="/vocab">Gå til ordliste</Link>
          </Button>
        </div>
      )}

      {quizMode === "running" && currentQuizCard && (
        <>
          <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-7 text-center">
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
      )}

      {quizMode === "completed" && (
        <>
          <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-6">
            <p className="text-sm text-muted-foreground">
              Du er ferdig med runden.
            </p>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/vocab")}
            >
              Tilbake til ordliste
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
