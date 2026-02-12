import { requireAuth } from "@/lib/auth";
import { VocabQuizContent } from "@/components/vocab-quiz-content";

export default async function VocabQuizPage() {
  await requireAuth();

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Ordquiz</h1>
        <p className="text-muted-foreground text-sm">
          Repeter ordforrådet ditt med kort og aktiv gjenkalling
        </p>
      </div>
      <VocabQuizContent />
    </div>
  );
}
