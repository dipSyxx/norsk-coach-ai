import { requireAuth } from "@/lib/auth";
import { VocabContent } from "@/components/vocab-content";

export default async function VocabPage() {
  await requireAuth();

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Ordforråd</h1>
        <p className="text-muted-foreground text-sm">
          Dine samlede ord og uttrykk fra samtaler
        </p>
      </div>
      <VocabContent />
    </div>
  );
}
