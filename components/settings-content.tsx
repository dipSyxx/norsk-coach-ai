"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, type Variants } from "motion/react";
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
  { id: "okonomi", label: "Økonomi" },
  { id: "transport", label: "Transport" },
  { id: "fritid", label: "Fritid" },
  { id: "teknologi", label: "Teknologi" },
  { id: "samfunn", label: "Samfunn" },
  { id: "kultur", label: "Kultur" },
  { id: "natur", label: "Natur" },
];

const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1"] as const;
const GOAL_OPTIONS = [
  { value: "snakke", label: "Samtale" },
  { value: "grammatikk", label: "Grammatikk" },
  { value: "ordforrad", label: "Ordforråd" },
  { value: "uttale", label: "Uttale" },
  { value: "lytting", label: "Lytting" },
  { value: "skriving", label: "Skriving" },
] as const;
const COACH_STYLE_OPTIONS = [
  { value: "friendly", label: "Vennlig" },
  { value: "balanced", label: "Balansert" },
  { value: "strict", label: "Streng" },
  { value: "socratic", label: "Sokratisk" },
] as const;
const EXPLANATION_LANGUAGE_OPTIONS = [
  { value: "norwegian", label: "Norsk" },
  { value: "ukrainian", label: "Ukrainsk" },
  { value: "english", label: "Engelsk" },
] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const chipMotion = {
  whileHover: { y: -1, scale: 1.015 },
  whileTap: { scale: 0.985 },
} as const;

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
  const [deletePassword, setDeletePassword] = useState("");
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
      const payload = {
        name: data.name,
        level: data.level,
        goal: data.goal,
        coachStyle: data.coachStyle,
        explanationLanguage: data.explanationLanguage,
        topics: data.topics,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        body: JSON.stringify({ password: deletePassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Kunne ikke slette konto");
        return;
      }
      setDeleteDialogOpen(false);
      setDeletePassword("");
      toast.success("Konto slettet");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await signOut({ callbackUrl: "/" });
    toast.success("Du er logget ut");
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
    <motion.div
      className="flex flex-col gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.section variants={sectionVariants} className="bg-card border border-border rounded-xl p-5">
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
      </motion.section>

      <motion.section
        variants={sectionVariants}
        className="relative overflow-hidden bg-card border border-border rounded-xl p-5"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-16 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_58%)]"
          animate={{ opacity: [0.35, 0.5, 0.35], scale: [1, 1.04, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        <h2 className="relative font-semibold text-foreground mb-1">Læringsinnstillinger</h2>
        <p className="relative text-sm text-muted-foreground mb-4">
          Velg nivå, fokus og språk for forklaringer.
        </p>

        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Nivå</Label>
            <div className="flex gap-2 flex-wrap">
              {LEVEL_OPTIONS.map((l) => {
                const active = data.level === l;
                return (
                  <Button
                    key={l}
                    asChild
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-medium",
                      active
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <motion.button
                      type="button"
                      onClick={() => setData((p) => ({ ...p, level: l }))}
                      aria-pressed={active}
                      animate={active ? { y: -1 } : { y: 0 }}
                      {...chipMotion}
                    >
                      {l}
                    </motion.button>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Fokus</Label>
            <div className="flex gap-2 flex-wrap">
              {GOAL_OPTIONS.map((g) => {
                const active = data.goal === g.value;
                return (
                  <Button
                    key={g.value}
                    asChild
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-medium",
                      active
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <motion.button
                      type="button"
                      onClick={() => setData((p) => ({ ...p, goal: g.value }))}
                      aria-pressed={active}
                      animate={active ? { y: -1 } : { y: 0 }}
                      {...chipMotion}
                    >
                      {g.label}
                    </motion.button>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Veilederstil</Label>
            <div className="flex gap-2 flex-wrap">
              {COACH_STYLE_OPTIONS.map((s) => {
                const active = data.coachStyle === s.value;
                return (
                  <Button
                    key={s.value}
                    asChild
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-medium",
                      active
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <motion.button
                      type="button"
                      onClick={() => setData((p) => ({ ...p, coachStyle: s.value }))}
                      aria-pressed={active}
                      animate={active ? { y: -1 } : { y: 0 }}
                      {...chipMotion}
                    >
                      {s.label}
                    </motion.button>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Forklaringsspråk</Label>
            <div className="flex gap-2 flex-wrap">
              {EXPLANATION_LANGUAGE_OPTIONS.map((l) => {
                const active = data.explanationLanguage === l.value;
                return (
                  <Button
                    key={l.value}
                    asChild
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-medium",
                      active
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <motion.button
                      type="button"
                      onClick={() =>
                        setData((p) => ({
                          ...p,
                          explanationLanguage: l.value,
                        }))
                      }
                      aria-pressed={active}
                      animate={active ? { y: -1 } : { y: 0 }}
                      {...chipMotion}
                    >
                      {l.label}
                    </motion.button>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Temaer</Label>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t, index) => {
                const active = data.topics.includes(t.id);
                return (
                  <Button
                    key={t.id}
                    asChild
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn(
                      "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium",
                      active
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <motion.button
                      type="button"
                      onClick={() => toggleTopic(t.id)}
                      aria-pressed={active}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.015 }}
                      {...chipMotion}
                    >
                      <AnimatePresence mode="wait">
                        {active && (
                          <motion.span
                            key="check"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.4, opacity: 0 }}
                          >
                            <Check className="h-3 w-3" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {t.label}
                    </motion.button>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={sectionVariants} className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Data og eksport</h2>
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
      </motion.section>

      <motion.section variants={sectionVariants} className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Personvern</h2>
        <p className="text-sm text-muted-foreground">
          Dataene dine (samtaler, meldinger, ordforråd og vanlige feil) lagres sikkert i vår database. Vi bruker dem kun til å levere tjenesten og forbedre din læringsopplevelse. Data slettes når du sletter kontoen din. Vi deler ikke dine data med tredjeparter for markedsføring.
        </p>
      </motion.section>

      <motion.section variants={sectionVariants} className="bg-card border border-destructive/30 rounded-xl p-5">
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
              if (!open) setDeletePassword("");
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
                  Er du sikker på at du vil slette kontoen din? Alle samtaler,
                  meldinger, ordforråd og vanlige feil vil bli slettet
                  permanent. Skriv passordet ditt for å bekrefte.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="delete-password" className="text-sm">
                  Passord
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Skriv passordet ditt"
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (deletePassword.trim()) handleDeleteAccount();
                  }}
                  disabled={!deletePassword.trim() || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Sletter..." : "Slett konto permanent"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.section>

      <motion.div variants={sectionVariants} className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? "Lagrer..." : "Lagre innstillinger"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleLogout}
          className="md:hidden"
        >
          Logg ut
        </Button>

        <AnimatePresence>
          {saved && !isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 text-primary" />
              Lagret
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
