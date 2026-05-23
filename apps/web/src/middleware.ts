import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale-detection middleware. Reads `Accept-Language` (and the
 * `NEXT_LOCALE` cookie on return visits) and 307-redirects to the
 * matching `/{locale}/...` URL. Skips API routes, Next internals,
 * and static assets.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Exclude API routes, Next internals, and any path with a file
    // extension (static assets). Anything else gets locale routing.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
