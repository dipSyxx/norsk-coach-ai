"use client";

import React from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  MessageSquare,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Plus,
  Target,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "motion/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DashboardData {
  stats: {
    totalSessions: number;
    totalVocab: number;
    newWordsThisWeek: number;
    masteredWords: number;
    dueWords: number;
  };
  dagensMal?: { action: "repeter"; count: number } | { action: "start_chat" };
  iDag?: { newWordsToday: number; mistakesToday: number };
  learning?: {
    currentStreak: number;
    longestStreak: number;
    quizCompletionRate7d: number | null;
    knewRatio7d: number | null;
    unknownRatio7d: number | null;
  };
  recentSessions: Array<{
    id: string;
    title: string;
    mode: string;
    updated_at: string;
  }>;
  topMistakes: Array<{
    mistake_type: string;
    count: number;
    example: string;
    correction: string;
  }>;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

export function DashboardContent() {
  const { data, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher);

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const dagensMal = data?.dagensMal ?? { action: "start_chat" as const };
  const iDag = data?.iDag ?? { newWordsToday: 0, mistakesToday: 0 };
  const learning = data?.learning ?? {
    currentStreak: 0,
    longestStreak: 0,
    quizCompletionRate7d: null,
    knewRatio7d: null,
    unknownRatio7d: null,
  };
  const sessions = data?.recentSessions || [];
  const mistakes = data?.topMistakes || [];

  return (
    <motion.div
      className="flex flex-col gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className="bg-primary/5 border border-primary/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Dagens mål</h2>
        </div>
        {dagensMal.action === "repeter" ? (
          <Link href="/vocab/quiz" className="flex items-center justify-between group">
            <span className="text-sm text-muted-foreground">
              Repeter {dagensMal.count} ord som venter på repetering
            </span>
            <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : (
          <Link href="/chat" className="flex items-center justify-between group">
            <span className="text-sm text-muted-foreground">
              Start en ny samtale med veilederen
            </span>
            <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-6"
      >
        <span className="text-sm font-medium text-foreground">I dag</span>
        <span className="text-sm text-muted-foreground">{iDag.newWordsToday} nye ord</span>
        <span className="text-sm text-muted-foreground">{iDag.mistakesToday} feil rettet</span>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Samtaler"
          value={stats?.totalSessions ?? 0}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Ordforråd"
          value={stats?.totalVocab ?? 0}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="Nye ord (7d)"
          value={stats?.newWordsThisWeek ?? 0}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Ord til repetering"
          value={stats?.dueWords ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          highlight={!!stats?.dueWords}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Streak nå"
          value={learning.currentStreak}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Lengste streak"
          value={learning.longestStreak}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <RatioCard
          completionRate7d={learning.quizCompletionRate7d}
          knewRatio7d={learning.knewRatio7d}
          unknownRatio7d={learning.unknownRatio7d}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 320, damping: 24 }}>
          <Link
            href="/chat"
            className="flex items-center gap-4 bg-primary text-primary-foreground rounded-xl p-5 hover:opacity-90 transition-opacity"
          >
            <div className="h-10 w-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <Plus className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Ny samtale</div>
              <div className="text-sm opacity-80">Start en ny chat med veilederen</div>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0" />
          </Link>
        </motion.div>

        {stats?.dueWords ? (
          <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 320, damping: 24 }}>
            <Link
              href="/vocab/quiz"
              className="flex items-center gap-4 bg-accent text-accent-foreground rounded-xl p-5 hover:opacity-90 transition-opacity"
            >
              <div className="h-10 w-10 rounded-lg bg-accent-foreground/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Repeter ord</div>
                <div className="text-sm opacity-80">{stats.dueWords} ord venter på repetering</div>
              </div>
              <ArrowRight className="h-5 w-5 flex-shrink-0" />
            </Link>
          </motion.div>
        ) : (
          <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-5">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Ingen ord til repetering</div>
              <div className="text-sm text-muted-foreground">Chat for å samle nye ord</div>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-foreground">Sist øvd</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Dine siste samtaler</p>
          </div>
          <Link href="/chat" className="text-sm text-primary hover:underline font-medium">
            Se alle
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Du har ingen samtaler ennå. Start din første chat!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                whileHover={{ x: 2, scale: 1.005 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
                <Link
                  href={`/chat?session=${session.id}`}
                  className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{session.title}</div>
                      <div className="text-xs text-muted-foreground">{formatMode(session.mode)}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDate(session.updated_at)}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {mistakes.length > 0 && (
        <motion.div variants={itemVariants}>
          <h2 className="font-semibold text-foreground mb-3">Vanlige feil</h2>
          <div className="flex flex-col gap-2">
            {mistakes.map((m, i) => (
              <motion.div
                key={`${m.mistake_type}-${i}`}
                className="bg-card border border-border rounded-lg px-4 py-3"
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{m.mistake_type}</span>
                  <span className="text-xs text-muted-foreground">{m.count}x</span>
                </div>
                {m.example && (
                  <p className="text-xs text-muted-foreground">
                    <span className="line-through">{m.example}</span>
                    {m.correction && <span className="text-primary ml-2">{" -> "}{m.correction}</span>}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={`rounded-xl border p-4 ${highlight ? "bg-accent/10 border-accent/30" : "bg-card border-border"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={highlight ? "text-accent" : "text-muted-foreground"}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function RatioCard({
  completionRate7d,
  knewRatio7d,
  unknownRatio7d,
}: {
  completionRate7d: number | null;
  knewRatio7d: number | null;
  unknownRatio7d: number | null;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="rounded-xl border p-4 bg-card border-border"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Læring (7d)</span>
      </div>
      <div className="text-sm text-foreground">
        Quiz fullført:{" "}
        <span className="font-semibold">
          {formatPercent(completionRate7d)}
        </span>
      </div>
      <div className="text-sm text-foreground mt-1">
        Vet-ratio:{" "}
        <span className="font-semibold">{formatPercent(knewRatio7d)}</span>
      </div>
      <div className="text-sm text-foreground mt-1">
        Vet ikke-ratio:{" "}
        <span className="font-semibold">{formatPercent(unknownRatio7d)}</span>
      </div>
    </motion.div>
  );
}

function formatPercent(value: number | null): string {
  if (value == null) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatMode(mode: string): string {
  const modes: Record<string, string> = {
    free_chat: "Fri samtale",
    rollespill: "Rollespill",
    rett_teksten: "Rett teksten",
    ovelse: "Øvelse",
    grammatikk: "Grammatikk",
  };
  return modes[mode] || mode;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Akkurat nå";
  if (minutes < 60) return `${minutes} min siden`;
  if (hours < 24) return `${hours}t siden`;
  if (days < 7) return `${days}d siden`;
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

