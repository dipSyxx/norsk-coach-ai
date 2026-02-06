import { requireAuth } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Hei, {user.name || "student"}!
        </h1>
        <p className="text-muted-foreground">
          Klar for å trene norsk i dag?
        </p>
      </div>
      <DashboardContent />
    </div>
  );
}
