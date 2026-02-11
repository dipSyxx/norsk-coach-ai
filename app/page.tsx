import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  toAbsoluteUrl,
} from "@/lib/site";
import { LandingContent } from "@/components/landing-content";

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
        width: 512,
        height: 512,
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
    logo: toAbsoluteUrl("/web-app-manifest-512x512.png"),
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
    <>
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
      <LandingContent />
    </>
  );
}
