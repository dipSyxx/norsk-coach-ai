"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { motion, type Variants } from "motion/react";
import { BrandLogo } from "@/components/brand-logo";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

export function LandingContent() {
  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-primary/14 blur-3xl"
          animate={{ x: [0, 36, -18, 0], y: [0, -24, 22, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ x: [0, -32, 20, 0], y: [0, 26, -14, 0], scale: [1, 0.94, 1.06, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </div>

      <motion.header
        className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <BrandLogo href="/" imageClassName="h-12 w-12" textClassName="text-xl" priority />
        <nav className="flex items-center gap-3">
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Logg inn
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/signup"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Kom i gang
            </Link>
          </motion.div>
        </nav>
      </motion.header>

      <motion.section
        className="flex-1 flex flex-col items-center justify-center px-6 pb-20 pt-10"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI-drevet norsklærer</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display text-4xl md:text-6xl font-bold text-foreground leading-tight text-balance mb-6"
          >
            Snakk norsk med <span className="text-primary">selvtillit</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-pretty"
          >
            En personlig AI-veileder som tilpasser seg ditt nivå, retter feil
            med omtanke, og hjelper deg å bygge ordforråd gjennom ekte samtaler.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <motion.div whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link
                href="/signup"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                Start gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link
                href="/login"
                className="flex items-center gap-2 border border-border text-foreground px-8 py-3.5 rounded-xl text-base font-medium hover:bg-muted transition-colors"
              >
                Har allerede konto
              </Link>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Naturlige samtaler"
              description="Chat med en AI-veileder som tilpasser seg nivå A2-B1 og dine interesser."
            />
            <FeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Ordforråd og repetering"
              description="Automatisk samling av nye ord med smart repetisjonsplan."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Spor fremgangen"
              description="Se dine vanligste feil, nye ord per uke, og total treningstid."
            />
          </motion.div>
        </div>
      </motion.section>

      <motion.footer
        className="border-t border-border py-6 px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.25 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>NorskCoach AI</span>
          <span>Bygget for A2-B1 norskstudenter</span>
        </div>
      </motion.footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-6 text-left"
      whileHover={{ y: -4, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
