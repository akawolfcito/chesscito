import createMiddleware from "next-intl/middleware";
import { defineRouting } from "next-intl/routing";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { isFullOnlyPath, getLiteHubTarget } from "@/lib/lite-mode-routing";

/**
 * `/es` is gated behind a server-side env flag during the migration:
 *
 *   NEXT_PUBLIC_I18N_ES_READY=1
 *
 * Until ES translations land (Stage 4 of the i18n cluster), exposing
 * `/es/*` to production users would render Spanglish — components
 * already migrated to `useTranslations` return ES copy, the rest
 * still import EN strings from editorial.ts.
 *
 * When the flag is OFF (production default today):
 *   1. The intl middleware is constructed with locales=['en'] so
 *      Accept-Language detection on naked `/` resolves directly to
 *      `/en` without an `/es` round-trip. One redirect hop.
 *   2. Any direct hit to `/es/*` (typed URL, stale bookmark, social
 *      share) is 307-redirected to its `/en` counterpart so testers
 *      land on a coherent EN page instead of mixed-locale content.
 *
 * Flip the flag (env var) when the LATAM testing cohort is ready.
 */
const ES_READY = process.env.NEXT_PUBLIC_I18N_ES_READY === "1";

const intlMiddleware = ES_READY
  ? createMiddleware(routing)
  : createMiddleware(
      defineRouting({
        locales: ["en"],
        defaultLocale: "en",
        localePrefix: "as-needed",
        localeDetection: true,
      }),
    );

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!ES_READY) {
    if (pathname === "/es" || pathname.startsWith("/es/")) {
      // Under `localePrefix: "as-needed"` the EN canonical lives at
      // the bare path (no `/en/` prefix), so redirect `/es/<path>`
      // straight to `/<path>` and avoid the `/es → /en → bare`
      // two-hop chain the previous `replace(/^\/es/, "/en")` produced.
      const target = pathname.replace(/^\/es/, "") || "/";
      const redirectUrl = new URL(target, request.url);
      redirectUrl.search = request.nextUrl.search;
      return NextResponse.redirect(redirectUrl, 307);
    }
  }

  if (CHESSCITO_LITE_MODE) {
    if (isFullOnlyPath(pathname, routing.locales, routing.defaultLocale)) {
      const targetPath = getLiteHubTarget(
        pathname,
        routing.locales,
        routing.defaultLocale,
      );
      return NextResponse.redirect(new URL(targetPath, request.url), 307);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Exclude API routes, Next internals, dev/VR fixtures (kept
    // locale-agnostic so VR baseline paths stay stable), and any path
    // with a file extension (static assets). Anything else gets
    // locale routing.
    "/((?!api|_next|_vercel|dev|.*\\..*).*)",
  ],
};
