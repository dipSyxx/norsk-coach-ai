"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { BookOpen, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VocabItem {
  id: string;
  term: string;
  explanation: string | null;
  example_sentence: string | null;
  created_at: string;
}

export function SessionVocabPanel({
  sessionId,
  refreshKey,
}: {
  sessionId: string | null;
  refreshKey?: number;
}) {
  const { mutate } = useSWRConfig();
  const vocabKey = sessionId
    ? `/api/sessions/${sessionId}/vocab?t=${refreshKey ?? 0}`
    : null;
  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    vocabKey,
    fetcher,
    { refreshInterval: 20000 }
  );

  const [addTerm, setAddTerm] = useState("");
  const [addExplanation, setAddExplanation] = useState("");
  const [addExampleSentence, setAddExampleSentence] = useState("");
  const [adding, setAdding] = useState(false);

  const items = data?.items ?? [];

  async function handleAdd() {
    const term = addTerm.trim();
    if (!term || !sessionId) return;
    setAdding(true);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          explanation: addExplanation.trim() || undefined,
          exampleSentence: addExampleSentence.trim() || undefined,
          sessionId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Kunne ikke legge til ord");
        return;
      }
      setAddTerm("");
      setAddExplanation("");
      setAddExampleSentence("");
      if (vocabKey) mutate(vocabKey);
      toast.success("Ord lagt til");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setAdding(false);
    }
  }

  if (!sessionId) return null;

  return (
    <div className="hidden lg:flex flex-col w-64 border-l border-border bg-card flex-shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Nye ord fra samtalen
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/30 p-2"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-full mt-2" />
                  <Skeleton className="h-3 w-5/6 mt-1" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nye ord fra chatten vises her.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-muted/30 p-2 text-xs"
              >
                <div className="font-medium text-foreground">{item.term}</div>
                {item.explanation && (
                  <p className="text-muted-foreground mt-0.5">
                    {item.explanation}
                  </p>
                )}
                {item.example_sentence && (
                  <p className="text-muted-foreground mt-1 italic">
                    {item.example_sentence}
                  </p>
                )}
              </div>
            ))
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Legg til ord
            </p>
            <Input
              placeholder="Ord eller uttrykk"
              value={addTerm}
              onChange={(e) => setAddTerm(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              placeholder="Forklaring (valgfritt)"
              value={addExplanation}
              onChange={(e) => setAddExplanation(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              placeholder="Eksempelsetning (valgfritt)"
              value={addExampleSentence}
              onChange={(e) => setAddExampleSentence(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 gap-1 text-xs"
              onClick={handleAdd}
              disabled={adding || !addTerm.trim()}
            >
              <Plus className="h-3 w-3" />
              {adding ? "Legger til..." : "Legg til"}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
