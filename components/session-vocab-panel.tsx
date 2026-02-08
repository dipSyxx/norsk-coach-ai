"use client";

import useSWR from "swr";
import { BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const { data, isLoading } = useSWR<{ items: VocabItem[] }>(
    sessionId ? `/api/sessions/${sessionId}/vocab?t=${refreshKey ?? 0}` : null,
    fetcher,
    { refreshInterval: 20000 }
  );

  const items = data?.items ?? [];

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
            <p className="text-xs text-muted-foreground">Laster...</p>
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
        </div>
      </ScrollArea>
    </div>
  );
}
