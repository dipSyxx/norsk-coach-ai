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
  recent_miss_count?: number;
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
const QUIZ_REQUEUE_MIN_GAP = 2;
const QUIZ_REQUEUE_MAX_GAP = 3;
const SWIPE_PARTIAL_THRESHOLD = 24;
const SWIPE_COMMIT_THRESHOLD = 78;
const SWIPE_MAX_OFFSET = 160;
const SWIPE_EXIT_OFFSET = 360;
const SWIPE_MAX_ROTATION = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_WEIGHT = 3;
const STRENGTH_WEIGHT = 2;
const MISS_WEIGHT = 4;

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

function getRiskScore(item: VocabItem, nowMs: number): number {
  const reviewAtMs = getReviewAtMs(item.next_review_at);
  const overdueDays = Number.isFinite(reviewAtMs)
    ? Math.max(0, (nowMs - reviewAtMs) / DAY_MS)
    : 0;
  const lowStrengthPenalty = Math.max(0, MASTERED_STRENGTH - 1 - item.strength);
  const recentMisses = item.recent_miss_count ?? 0;

  return (
    overdueDays * OVERDUE_WEIGHT +
    lowStrengthPenalty * STRENGTH_WEIGHT +
    recentMisses * MISS_WEIGHT
  );
}

function getRequeueInsertIndex(queueLength: number): number {
  if (queueLength <= 0) return 0;
  const desiredGap =
    QUIZ_REQUEUE_MIN_GAP +
    Math.floor(Math.random() * (QUIZ_REQUEUE_MAX_GAP - QUIZ_REQUEUE_MIN_GAP + 1));
  return Math.min(queueLength, desiredGap);
}

export function VocabQuizContent() {
  const router = useRouter();
  const startLockRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [quizMode, setQuizMode] = useState<QuizMode>("loading");
  const [quizQueue, setQuizQueue] = useState<QuizQueueItem[]>([]);
  const [quizStats, setQuizStats] = useState<QuizStats>(createEmptyQuizStats);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [isSubmittingQuizAnswer, setIsSubmittingQuizAnswer] = useState(false);
  const [quizRunId, setQuizRunId] = useState<string | null>(null);
  const [quizAttemptIndex, setQuizAttemptIndex] = useState(1);
  const [quizStartedAtMs, setQuizStartedAtMs] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeCommitting, setIsSwipeCommitting] = useState(false);

  const currentQuizCard = quizQueue[0] ?? null;
  const quizProgressTotal = quizStats.answered + quizQueue.length;
  const quizProgressValue =
    quizProgressTotal > 0
      ? Math.round((quizStats.answered / quizProgressTotal) * 100)
      : quizMode === "completed"
        ? 100
        : 0;
  const swipeStrength = Math.min(
    1,
    Math.abs(swipeOffset) / SWIPE_COMMIT_THRESHOLD
  );
  const leftOverlayOpacity =
    swipeOffset < -SWIPE_PARTIAL_THRESHOLD
      ? Math.min(0.2 + swipeStrength * 0.7, 0.95)
      : 0;
  const rightOverlayOpacity =
    swipeOffset > SWIPE_PARTIAL_THRESHOLD
      ? Math.min(0.2 + swipeStrength * 0.7, 0.95)
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
      const res = await fetch("/api/vocab?filter=all&kind=lexical&includeRisk=1");
      if (!res.ok) {
        throw new Error("Failed to load vocab");
      }

      const payload = (await res.json()) as { items?: VocabItem[] };
      const allItems = payload.items ?? [];
      const eligibleItems = allItems.filter(
        (item) => item.strength < MASTERED_STRENGTH
      );

      if (eligibleItems.length === 0) {
        toast.info("Ingen ord å repetere nå.");
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
      const selectedItems = shuffleItems(eligibleItems)
        .sort((a, b) => getRiskScore(b, now) - getRiskScore(a, now))
        .slice(0, QUIZ_SESSION_SIZE)
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

  const handleQuizAnswer = useCallback(
    async (knew: boolean) => {
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
          const queuedAgain = {
            ...currentQuizCard,
            repeatCount: currentQuizCard.repeatCount + 1,
          };
          const insertIndex = getRequeueInsertIndex(remaining.length);
          remaining.splice(insertIndex, 0, queuedAgain);
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
    },
    [
      completeQuizRun,
      currentQuizCard,
      isSubmittingQuizAnswer,
      quizAttemptIndex,
      quizQueue,
      quizRunId,
    ]
  );

  const commitSwipeAnswer = useCallback(
    async (knew: boolean, direction: -1 | 1) => {
      if (isSwipeCommitting || isSubmittingQuizAnswer) return;
      setIsSwipeCommitting(true);
      setSwipeOffset(direction * SWIPE_EXIT_OFFSET);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await handleQuizAnswer(knew);
      setSwipeOffset(0);
      setIsSwipeCommitting(false);
    },
    [handleQuizAnswer, isSubmittingQuizAnswer, isSwipeCommitting]
  );

  useEffect(() => {
    setSwipeOffset(0);
    setIsSwipeCommitting(false);
  }, [currentQuizCard?.itemId, isRevealed]);

  const handleCardTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isRevealed || isSubmittingQuizAnswer || isSwipeCommitting) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [isRevealed, isSubmittingQuizAnswer, isSwipeCommitting]
  );

  const handleCardTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      if (!start || !isRevealed || isSubmittingQuizAnswer || isSwipeCommitting) {
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      if (event.cancelable) {
        event.preventDefault();
      }
      const clamped = Math.max(-SWIPE_MAX_OFFSET, Math.min(SWIPE_MAX_OFFSET, deltaX));
      setSwipeOffset(clamped);
    },
    [isRevealed, isSubmittingQuizAnswer, isSwipeCommitting]
  );

  const handleCardTouchEnd = useCallback(() => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !isRevealed || isSubmittingQuizAnswer || isSwipeCommitting) {
      setSwipeOffset(0);
      return;
    }

    if (swipeOffset <= -SWIPE_COMMIT_THRESHOLD) {
      void commitSwipeAnswer(false, -1);
      return;
    }
    if (swipeOffset >= SWIPE_COMMIT_THRESHOLD) {
      void commitSwipeAnswer(true, 1);
      return;
    }
    setSwipeOffset(0);
  }, [
    commitSwipeAnswer,
    isRevealed,
    isSubmittingQuizAnswer,
    isSwipeCommitting,
    swipeOffset,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (quizMode !== "running" || isSubmittingQuizAnswer) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (!isRevealed) {
          setIsRevealed(true);
        }
        return;
      }

      if (!isRevealed) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void handleQuizAnswer(false);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void handleQuizAnswer(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleQuizAnswer, isRevealed, isSubmittingQuizAnswer, quizMode]);

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
          <motion.div
            key={`running-${currentQuizCard.itemId}`}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-4"
          >
            <div className="relative">
              {isRevealed && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-3 md:hidden">
                  <div
                    className="rounded-full px-3 py-1 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 transition-all duration-150"
                    style={{
                      opacity: leftOverlayOpacity,
                      filter: `blur(${Math.max(0, 5 - swipeStrength * 5)}px)`,
                      transform: `scale(${0.95 + swipeStrength * 0.08})`,
                    }}
                  >
                    Ikke sikker
                  </div>
                  <div
                    className="rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 transition-all duration-150"
                    style={{
                      opacity: rightOverlayOpacity,
                      filter: `blur(${Math.max(0, 5 - swipeStrength * 5)}px)`,
                      transform: `scale(${0.95 + swipeStrength * 0.08})`,
                    }}
                  >
                    Jeg vet det
                  </div>
                </div>
              )}
              <motion.div
                className="relative overflow-hidden rounded-xl border border-border bg-muted/20 p-5 md:p-7 min-h-[360px] md:min-h-0 text-center flex flex-col"
              initial={{ scale: 0.99 }}
              animate={{
                x: isRevealed ? swipeOffset : 0,
                rotate: isRevealed
                  ? Math.max(
                      -SWIPE_MAX_ROTATION,
                      Math.min(SWIPE_MAX_ROTATION, swipeOffset / 12)
                    )
                  : 0,
                scale: isSwipeCommitting ? 0.97 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              style={{ touchAction: isRevealed ? "pan-y" : "auto" }}
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onTouchCancel={handleCardTouchEnd}
            >
              <p className="text-2xl md:text-3xl font-semibold text-foreground break-words">{currentQuizCard.term}</p>

              <div className="mt-4 flex-1 flex items-center">
                <div className="w-full">
                  <div className="hidden md:block">
                    <AnimatePresence mode="wait">
                      {isRevealed ? (
                        <motion.div
                          key="revealed-desktop"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="space-y-2"
                        >
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
                        <motion.p
                          key="hidden-desktop"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-sm text-muted-foreground"
                        >
                          Prøv å huske betydningen, og vis så svaret.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative md:hidden">
                    <div
                      className={`space-y-2 transition-[filter,opacity] duration-200 ${
                        isRevealed ? "blur-0 opacity-100" : "blur-md opacity-80"
                      }`}
                      aria-hidden={!isRevealed}
                    >
                      {currentQuizCard.explanation ? (
                        <p className="text-sm text-muted-foreground">{currentQuizCard.explanation}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Ingen forklaring lagret.</p>
                      )}
                      {currentQuizCard.example_sentence && (
                        <p className="text-sm italic text-muted-foreground">{currentQuizCard.example_sentence}</p>
                      )}
                    </div>
                    {!isRevealed && (
                      <button
                        type="button"
                        onClick={() => setIsRevealed(true)}
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/45 backdrop-blur-[2px]"
                        aria-label="Vis svar"
                      >
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                          <Eye className="h-3.5 w-3.5" />
                          Vis svar
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </motion.div>
            </div>

            {!isRevealed ? (
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} className="hidden md:block">
                <Button type="button" className="w-full" onClick={() => setIsRevealed(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Vis svar (Space)
                </Button>
              </motion.div>
            ) : (
              <div className="hidden md:grid grid-cols-2 gap-2">
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
              </div>
            )}
            {isRevealed && (
              <p className="text-[11px] text-muted-foreground md:hidden">
                {swipeStrength >= 1
                  ? "Slipp for å velge."
                  : swipeStrength > 0
                    ? "Fortsett å sveipe."
                    : "Sveip venstre/høyre på kortet."}
              </p>
            )}
            <p className="hidden md:block text-[11px] text-muted-foreground">
              Space: vis svar. Piltast venstre/høyre: svar.
            </p>

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
