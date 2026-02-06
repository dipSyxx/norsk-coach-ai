"use client";

import React from "react"

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Plus,
  ThumbsUp,
  ThumbsDown,
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

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "new", label: "Nye" },
  { value: "due", label: "Til repetering" },
  { value: "mastered", label: "Mestret" },
];

export function VocabContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";
  const [filter, setFilter] = useState(initialFilter);
  const [showAdd, setShowAdd] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    `/api/vocab?filter=${filter}`,
    fetcher
  );
  const items = data?.items || [];

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
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

      if (res.ok) {
        toast.success(`"${term}" lagt til`);
        setShowAdd(false);
        mutate(`/api/vocab?filter=${filter}`);
        (e.target as HTMLFormElement).reset();
      }
    } catch {
      toast.error("Kunne ikke legge til ord");
    }
  }

  async function handleReview(itemId: string, knew: boolean) {
    setReviewingId(itemId);
    try {
      await fetch("/api/vocab/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, knew }),
      });
      mutate(`/api/vocab?filter=${filter}`);
    } catch {
      toast.error("Kunne ikke oppdatere");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
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
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdd ? (
            <X className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          {showAdd ? "Avbryt" : "Legg til ord"}
        </button>
      </div>

      {/* Add word form */}
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

      {/* Word list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-muted animate-pulse rounded-lg"
            />
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
              <div className="flex items-start justify-between gap-4">
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleReview(item.id, false)}
                    disabled={reviewingId === item.id}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Husker ikke"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleReview(item.id, true)}
                    disabled={reviewingId === item.id}
                    className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Husker"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
