"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TOPICS = [
  { id: "jobb", label: "Jobb" },
  { id: "skole", label: "Skole" },
  { id: "helse", label: "Helse" },
  { id: "butikk", label: "Butikk" },
  { id: "reise", label: "Reise" },
  { id: "familie", label: "Familie" },
  { id: "mat", label: "Mat" },
  { id: "bolig", label: "Bolig" },
];

interface SettingsData {
  name: string;
  email: string;
  level: string;
  goal: string;
  coachStyle: string;
  explanationLanguage: string;
  topics: string[];
}

function snapshotSettings(data: SettingsData): SettingsData {
  return {
    ...data,
    topics: [...data.topics],
  };
}

function serializeSettings(data: SettingsData): string {
  return JSON.stringify({
    ...data,
    topics: [...data.topics].sort(),
  });
}

export function SettingsContent({
  initialData,
}: {
  initialData: SettingsData;
}) {
  const [data, setData] = useState(initialData);
  const [baseline, setBaseline] = useState(() =>
    snapshotSettings(initialData)
  );
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isDirty = useMemo(
    () => serializeSettings(data) !== serializeSettings(baseline),
    [data, baseline]
  );

  useEffect(() => {
    if (isDirty) {
      setSaved(false);
    }
  }, [isDirty]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setBaseline(snapshotSettings(data));
        setSaved(true);
        toast.success("Innstillinger lagret");
      } else {
        toast.error("Kunne ikke lagre innstillinger");
      }
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "norskcoach-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Data eksportert");
    } catch {
      toast.error("Kunne ikke eksportere data");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Kunne ikke slette konto");
        return;
      }
      setDeleteDialogOpen(false);
      setDeleteConfirm("");
      toast.success("Konto slettet");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setDeleting(false);
    }
  }

  function toggleTopic(id: string) {
    setData((prev) => ({
      ...prev,
      topics: prev.topics.includes(id)
        ? prev.topics.filter((t) => t !== id)
        : [...prev.topics, id],
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Profil</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Oppdater navnet ditt og se kontoinformasjon.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name" className="text-sm">
              Navn
            </Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) =>
                setData((p) => ({ ...p, name: e.target.value }))
              }
              className="max-w-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm">E-post</Label>
            <p className="text-sm text-muted-foreground">{data.email}</p>
          </div>
        </div>
      </section>

      {/* Learning preferences */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">
          Læringsinnstillinger
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Velg nivå, fokus og språk for forklaringer.
        </p>
        <div className="flex flex-col gap-5">
          {/* Level */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Nivå</Label>
            <div className="flex gap-2">
              {["A2", "B1"].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setData((p) => ({ ...p, level: l }))}
                  aria-pressed={data.level === l}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    data.level === l
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Fokus</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "snakke", label: "Samtale" },
                { value: "grammatikk", label: "Grammatikk" },
                { value: "ordforrad", label: "Ordforråd" },
              ].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setData((p) => ({ ...p, goal: g.value }))}
                  aria-pressed={data.goal === g.value}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    data.goal === g.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Coach Style */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Veilederstil</Label>
            <div className="flex gap-2">
              {[
                { value: "friendly", label: "Vennlig" },
                { value: "strict", label: "Streng" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() =>
                    setData((p) => ({ ...p, coachStyle: s.value }))
                  }
                  aria-pressed={data.coachStyle === s.value}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    data.coachStyle === s.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Explanation Language */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Forklaringsspråk</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "norwegian", label: "Norsk" },
                { value: "ukrainian", label: "Ukrainsk" },
                { value: "english", label: "Engelsk" },
              ].map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() =>
                    setData((p) => ({
                      ...p,
                      explanationLanguage: l.value,
                    }))
                  }
                  aria-pressed={data.explanationLanguage === l.value}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    data.explanationLanguage === l.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Temaer</Label>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(t.id)}
                  aria-pressed={data.topics.includes(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    data.topics.includes(t.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {data.topics.includes(t.id) && (
                    <Check className="h-3 w-3" />
                  )}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Data export */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground mb-1">
              Data og eksport
            </h2>
            <p className="text-sm text-muted-foreground">
              Last ned en kopi av dataene dine som JSON.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="gap-2 bg-transparent"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Eksporterer..." : "Eksporter data"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Inkluderer samtaler, meldinger, ordforråd og vanlige feil.
        </p>
      </section>

      {/* Personvern */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Personvern</h2>
        <p className="text-sm text-muted-foreground">
          Dataene dine (samtaler, meldinger, ordforråd og vanlige feil) lagres sikkert i vår database. Vi bruker dem kun til å levere tjenesten og forbedre din læringsopplevelse. Data slettes når du sletter kontoen din. Vi deler ikke dine data med tredjeparter for markedsføring.
        </p>
      </section>

      {/* Delete account */}
      <section className="bg-card border border-destructive/30 rounded-xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Slett konto</h2>
            <p className="text-sm text-muted-foreground">
              Slett kontoen din og alle data permanent. Denne handlingen kan ikke angres.
            </p>
          </div>
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setDeleteConfirm("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                Slett konto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slett konto</AlertDialogTitle>
                <AlertDialogDescription>
                  Er du sikker på at du vil slette kontoen din? Alle samtaler, meldinger, ordforråd og vanlige feil vil bli slettet permanent. Skriv DELETE nedenfor for å bekrefte.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="delete-confirm" className="text-sm">
                  Skriv DELETE for å bekrefte
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1 font-mono"
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (deleteConfirm === "DELETE") handleDeleteAccount();
                  }}
                  disabled={deleteConfirm !== "DELETE" || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Sletter..." : "Slett konto permanent"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? "Lagrer..." : "Lagre innstillinger"}
        </Button>
        {saved && !isDirty && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-primary" />
            Lagret
          </div>
        )}
      </div>
    </div>
  );
}
