import { requireAuth } from "@/lib/auth";
import { SettingsContent } from "@/components/settings-content";

export default async function SettingsPage() {
  const user = await requireAuth();

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Innstillinger
        </h1>
        <p className="text-muted-foreground text-sm">
          Tilpass NorskCoach til dine behov
        </p>
      </div>
      <SettingsContent
        initialData={{
          name: user.name || "",
          email: user.email,
          level: user.level,
          goal: user.goal,
          coachStyle: user.coach_style,
          explanationLanguage: user.explanation_language,
          topics: user.topics || [],
        }}
      />
    </div>
  );
}
