const FALLBACK_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(rawUrl?: string): string {
  if (!rawUrl) {
    return FALLBACK_SITE_URL;
  }

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    parsed.search = "";

    const pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = pathname || "/";

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_NAME = "NorskCoach AI";
export const SITE_DESCRIPTION =
  "Practice Norwegian with an AI tutor that adapts to your level. Track vocabulary, correct mistakes, and build fluency at A2-B1 level.";
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const OG_IMAGE_PATH = "/web-app-manifest-512x512.png";

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, `${SITE_URL}/`).toString();
}
