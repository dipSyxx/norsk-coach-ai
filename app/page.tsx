import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  toAbsoluteUrl,
} from "@/lib/site";

const landingTitle = "Snakk norsk med selvtillit";
const landingDescription =
  "NorskCoach AI er en personlig AI-veileder for norskstudenter på A2-B1 nivå med samtaler, ordforråd og progresjonssporing.";

export const metadata: Metadata = {
  title: landingTitle,
  description: landingDescription,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "nb_NO",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${landingTitle} | ${SITE_NAME}`,
    description: landingDescription,
    images: [
      {
        url: toAbsoluteUrl(OG_IMAGE_PATH),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} preview image`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${landingTitle} | ${SITE_NAME}`,
    description: landingDescription,
    images: [toAbsoluteUrl(OG_IMAGE_PATH)],
  },
};

export default async function LandingPage() {
  const user = await getSession();
  if (user) {
    redirect(user.onboarding_complete ? "/dashboard" : "/onboarding");
  }

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: toAbsoluteUrl("/icon-512.png"),
    description: SITE_DESCRIPTION,
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <main className="min-h-screen flex flex-col">
      <script
        id="organization-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        id="software-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />

      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <BrandLogo
          href="/"
          imageClassName="h-12 w-12"
          textClassName="text-xl"
          priority
        />
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Logg inn
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Kom i gang
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-20 pt-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>AI-drevet norsklærer</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground leading-tight text-balance mb-6">
            Snakk norsk med <span className="text-primary">selvtillit</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
            En personlig AI-veileder som tilpasser seg ditt nivå, retter feil
            med omtanke, og hjelper deg å bygge ordforråd gjennom ekte samtaler.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              Start gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 border border-border text-foreground px-8 py-3.5 rounded-xl text-base font-medium hover:bg-muted transition-colors"
            >
              Har allerede konto
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>NorskCoach AI</span>
          <span>Bygget for A2-B1 norskstudenter</span>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 text-left">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
