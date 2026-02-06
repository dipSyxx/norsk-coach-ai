"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function SettingsContent({
  initialData,
}: {
  initialData: SettingsData;
}) {
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
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
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data eksportert");
    } catch {
      toast.error("Kunne ikke eksportere data");
    } finally {
      setExporting(false);
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
        <h2 className="font-semibold text-foreground mb-4">Profil</h2>
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
        <h2 className="font-semibold text-foreground mb-4">
          Læringsinnstillinger
        </h2>
        <div className="flex flex-col gap-5">
          {/* Level */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Nivå</Label>
            <div className="flex gap-2">
              {["A2", "B1"].map((l) => (
                <button
                  key={l}
                  onClick={() => setData((p) => ({ ...p, level: l }))}
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
                  onClick={() => setData((p) => ({ ...p, goal: g.value }))}
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
                  onClick={() =>
                    setData((p) => ({ ...p, coachStyle: s.value }))
                  }
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
                  onClick={() =>
                    setData((p) => ({
                      ...p,
                      explanationLanguage: l.value,
                    }))
                  }
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
                  onClick={() => toggleTopic(t.id)}
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

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Lagrer..." : "Lagre innstillinger"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="gap-2 bg-transparent"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Eksporterer..." : "Eksporter data (JSON)"}
        </Button>
      </div>
    </div>
  );
}
