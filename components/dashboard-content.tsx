"use client";

import React from "react"

import useSWR from "swr";
import Link from "next/link";
import {
  MessageSquare,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DashboardData {
  stats: {
    totalSessions: number;
    totalVocab: number;
    newWordsThisWeek: number;
    masteredWords: number;
    dueWords: number;
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

export function DashboardContent() {
  const { data, isLoading } = useSWR<DashboardData>(
    "/api/dashboard",
    fetcher
  );

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const sessions = data?.recentSessions || [];
  const mistakes = data?.topMistakes || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/chat"
          className="flex items-center gap-4 bg-primary text-primary-foreground rounded-xl p-5 hover:opacity-90 transition-opacity"
        >
          <div className="h-10 w-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <Plus className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Ny samtale</div>
            <div className="text-sm opacity-80">
              Start en ny chat med veilederen
            </div>
          </div>
          <ArrowRight className="h-5 w-5 flex-shrink-0" />
        </Link>

        {stats?.dueWords ? (
          <Link
            href="/vocab?filter=due"
            className="flex items-center gap-4 bg-accent text-accent-foreground rounded-xl p-5 hover:opacity-90 transition-opacity"
          >
            <div className="h-10 w-10 rounded-lg bg-accent-foreground/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Repeter ord</div>
              <div className="text-sm opacity-80">
                {stats.dueWords} ord venter på repetering
              </div>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0" />
          </Link>
        ) : (
          <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-5">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">
                Ingen ord til repetering
              </div>
              <div className="text-sm text-muted-foreground">
                Chat for å samle nye ord
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Siste samtaler</h2>
          <Link
            href="/chat"
            className="text-sm text-primary hover:underline font-medium"
          >
            Se alle
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Du har ingen samtaler ennå. Start din første chat!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/chat?session=${session.id}`}
                className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {session.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMode(session.mode)}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {formatDate(session.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Common Mistakes */}
      {mistakes.length > 0 && (
        <div>
          <h2 className="font-semibold text-foreground mb-3">Vanlige feil</h2>
          <div className="flex flex-col gap-2">
            {mistakes.map((m, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg px-4 py-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {m.mistake_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.count}x
                  </span>
                </div>
                {m.example && (
                  <p className="text-xs text-muted-foreground">
                    <span className="line-through">{m.example}</span>
                    {m.correction && (
                      <span className="text-primary ml-2">
                        {" -> "}
                        {m.correction}
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
    <div
      className={`rounded-xl border p-4 ${highlight ? "bg-accent/10 border-accent/30" : "bg-card border-border"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={highlight ? "text-accent" : "text-muted-foreground"}>
          {icon}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
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
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function formatMode(mode: string): string {
  const modes: Record<string, string> = {
    free_chat: "Fri samtale",
    rollespill: "Rollespill",
    rett_teksten: "Rett teksten",
    ovelse: "Ovelse",
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
