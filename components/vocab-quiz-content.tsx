"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { BookOpen, Eye, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MASTERED_STRENGTH } from "@/lib/vocab-thresholds";
import { toast } from "sonner";
import { AnimatePresence, motion, type Variants } from "motion/react";

type QuizMode = "loading" | "running" | "completed" | "empty";

interface VocabItem {
  id: string;
  term: string;
  explanation: string | null;
  example_sentence: string | null;
  strength: number;
  next_review_at: string | null;
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

const contentVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(2px)",
    transition: { duration: 0.2 },
  },
};

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

function getReviewAtMs(nextReviewAt: string | null): number {
  if (!nextReviewAt) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(nextReviewAt);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
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
  const [quizRunId, setQuizRunId] = useState<string | null>(null);
  const [quizAttemptIndex, setQuizAttemptIndex] = useState(1);
  const [quizStartedAtMs, setQuizStartedAtMs] = useState<number | null>(null);

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
      mutate("/api/vocab?filter=all&kind=lexical"),
      mutate("/api/vocab?filter=new&kind=lexical"),
      mutate("/api/vocab?filter=due&kind=lexical"),
      mutate("/api/vocab?filter=mastered&kind=lexical"),
    ]);
  }, []);

  const buildDurationSec = useCallback(() => {
    if (!quizStartedAtMs) return null;
    return Math.max(0, Math.round((Date.now() - quizStartedAtMs) / 1000));
  }, [quizStartedAtMs]);

  const completeQuizRun = useCallback(async () => {
    if (!quizRunId) return true;

    const durationSec = buildDurationSec();
    const res = await fetch("/api/vocab/quiz/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizRunId,
        ...(durationSec != null ? { durationSec } : {}),
      }),
    });

    if (!res.ok) {
      return false;
    }

    await refreshVocabCaches();
    setQuizRunId(null);
    return true;
  }, [buildDurationSec, quizRunId, refreshVocabCaches]);

  const sendQuizExit = useCallback(async () => {
    if (!quizRunId || quizMode !== "running") return;

    const durationSec = buildDurationSec();
    try {
      await fetch("/api/vocab/quiz/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          quizRunId,
          ...(durationSec != null ? { durationSec } : {}),
        }),
      });
      await refreshVocabCaches();
      setQuizRunId(null);
    } catch {
      // non-blocking
    }
  }, [buildDurationSec, quizMode, quizRunId, refreshVocabCaches]);

  const handleReturnToVocab = useCallback(async () => {
    if (quizMode === "running") {
      await sendQuizExit();
    }
    router.push("/vocab");
  }, [quizMode, router, sendQuizExit]);

  const startQuiz = useCallback(async () => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    setIsStartingQuiz(true);
    setQuizMode("loading");

    try {
      const res = await fetch("/api/vocab?filter=all&kind=lexical");
      if (!res.ok) {
        throw new Error("Failed to load vocab");
      }

      const payload = (await res.json()) as { items?: VocabItem[] };
      const allItems = payload.items ?? [];
      const eligibleItems = allItems.filter(
        (item) => item.strength < MASTERED_STRENGTH
      );

      if (eligibleItems.length === 0) {
        toast.info("Ingen ord aa repetere naa.");
        setQuizQueue([]);
        setQuizStats(createEmptyQuizStats());
        setIsRevealed(false);
        setQuizRunId(null);
        setQuizAttemptIndex(1);
        setQuizStartedAtMs(null);
        setQuizMode("empty");
        return;
      }

      const now = Date.now();
      const dueItems = eligibleItems.filter(
        (item) => getReviewAtMs(item.next_review_at) <= now
      );
      const nonDueItems = eligibleItems.filter(
        (item) => getReviewAtMs(item.next_review_at) > now
      );

      const dueFirst = [...dueItems]
        .sort(
          (a, b) =>
            getReviewAtMs(a.next_review_at) - getReviewAtMs(b.next_review_at)
        )
        .slice(0, QUIZ_SESSION_SIZE);
      const remainingSlots = Math.max(0, QUIZ_SESSION_SIZE - dueFirst.length);
      const randomBackfill = shuffleItems(nonDueItems).slice(0, remainingSlots);

      const selectedItems = [...dueFirst, ...randomBackfill]
        .map((item) => ({
          itemId: item.id,
          term: item.term,
          explanation: item.explanation,
          example_sentence: item.example_sentence,
          repeatCount: 0,
        }));

      const startRes = await fetch("/api/vocab/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedCards: selectedItems.length,
          source: "vocab_quiz",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!startRes.ok) {
        throw new Error("Failed to start quiz run");
      }

      const startPayload = (await startRes.json()) as {
        quizRunId: string;
        startedAt: string;
      };

      setQuizQueue(selectedItems);
      setQuizStats(createEmptyQuizStats());
      setIsRevealed(false);
      setQuizRunId(startPayload.quizRunId);
      setQuizAttemptIndex(1);
      setQuizStartedAtMs(Date.parse(startPayload.startedAt) || Date.now());
      setQuizMode("running");
    } catch {
      toast.error("Kunne ikke starte quiz");
      setQuizRunId(null);
      setQuizAttemptIndex(1);
      setQuizStartedAtMs(null);
      setQuizMode("empty");
    } finally {
      setIsStartingQuiz(false);
      startLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    void startQuiz();
  }, [startQuiz]);

  useEffect(() => {
    return () => {
      if (!quizRunId || quizMode !== "running") return;

      const durationSec = quizStartedAtMs
        ? Math.max(0, Math.round((Date.now() - quizStartedAtMs) / 1000))
        : null;

      void fetch("/api/vocab/quiz/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          quizRunId,
          ...(durationSec != null ? { durationSec } : {}),
        }),
      });
    };
  }, [quizMode, quizRunId, quizStartedAtMs]);

  async function handleQuizAnswer(knew: boolean) {
    if (!currentQuizCard || isSubmittingQuizAnswer) return;

    setIsSubmittingQuizAnswer(true);
    try {
      const res = await fetch("/api/vocab/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: currentQuizCard.itemId,
          knew,
          quizRunId,
          attemptIndex: quizAttemptIndex,
          repeatCount: currentQuizCard.repeatCount,
        }),
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
      setQuizAttemptIndex((prev) => prev + 1);
      setIsRevealed(false);

      if (remaining.length === 0) {
        const completed = await completeQuizRun();
        if (!completed) {
          toast.error("Kunne ikke lagre quiz-resultatet.");
        }
        setQuizMode("completed");
      }
    } catch {
      toast.error("Kunne ikke oppdatere ordet. Prøv igjen.");
    } finally {
      setIsSubmittingQuizAnswer(false);
    }
  }

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
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
        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
          <Button type="button" size="sm" variant="outline" onClick={() => void handleReturnToVocab()}>
            Til ordliste
          </Button>
        </motion.div>
      </div>

      {quizMode === "running" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Fremdrift</span>
            <span>{quizProgressValue}%</span>
          </div>
          <motion.div initial={{ scaleX: 0.95, opacity: 0.8 }} animate={{ scaleX: 1, opacity: 1 }}>
            <Progress value={quizProgressValue} className="h-2" />
          </motion.div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {quizMode === "loading" && (
          <motion.div key="loading" variants={contentVariants} initial="initial" animate="animate" exit="exit" className="space-y-3">
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
          </motion.div>
        )}

        {quizMode === "empty" && (
          <motion.div
            key="empty"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-border bg-muted/20 p-8 text-center"
          >
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Ingen ord å repetere nå.</p>
            <Button type="button" variant="outline" asChild>
              <Link href="/vocab">Gå til ordliste</Link>
            </Button>
          </motion.div>
        )}

        {quizMode === "running" && currentQuizCard && (
          <motion.div key={`running-${currentQuizCard.itemId}`} variants={contentVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
            <motion.div
              className="rounded-xl border border-border bg-muted/20 p-5 md:p-7 text-center"
              initial={{ scale: 0.99 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <p className="text-2xl md:text-3xl font-semibold text-foreground break-words">{currentQuizCard.term}</p>

              <AnimatePresence mode="wait">
                {isRevealed ? (
                  <motion.div key="revealed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-4 space-y-2">
                    {currentQuizCard.explanation ? (
                      <p className="text-sm text-muted-foreground">{currentQuizCard.explanation}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Ingen forklaring lagret.</p>
                    )}
                    {currentQuizCard.example_sentence && (
                      <p className="text-sm italic text-muted-foreground">{currentQuizCard.example_sentence}</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p key="hidden" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-4 text-sm text-muted-foreground">
                    Prøv å huske betydningen, og vis så svaret.
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {!isRevealed ? (
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} className="sm:col-span-2">
                  <Button type="button" className="w-full" onClick={() => setIsRevealed(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Vis svar
                  </Button>
                </motion.div>
              ) : (
                <>
                  <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => void handleQuizAnswer(false)}
                      disabled={isSubmittingQuizAnswer}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Ikke sikker
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void handleQuizAnswer(true)}
                      disabled={isSubmittingQuizAnswer}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Jeg vet det
                    </Button>
                  </motion.div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Besvart: {quizStats.answered}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Vet: {quizStats.knew}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">Vet ikke: {quizStats.didntKnow}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Igjen: {quizQueue.length}</span>
            </div>
          </motion.div>
        )}

        {quizMode === "completed" && (
          <motion.div key="completed" variants={contentVariants} initial="initial" animate="animate" exit="exit" className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/20 p-5 md:p-6">
              <p className="text-sm text-muted-foreground">Du er ferdig med runden.</p>
              <p className="text-lg font-semibold text-foreground mt-1">{quizStats.knew} visste, {quizStats.didntKnow} usikre</p>
              <p className="text-xs text-muted-foreground mt-2">Totalt besvart: {quizStats.answered}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                <Button type="button" className="w-full" onClick={() => void startQuiz()} disabled={isStartingQuiz}>
                  {isStartingQuiz ? "Starter..." : "Start ny quiz"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                <Button type="button" className="w-full" variant="outline" onClick={() => void handleReturnToVocab()}>Tilbake til ordliste</Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
