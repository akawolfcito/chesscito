import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // /classic (existing hero, unmigrated) and /stats stay locale-agnostic,
    // exactly as they behave today. /api/* covers /api/enter. Anything
    // with a file extension is a static asset.
    "/((?!api|_next|_vercel|classic|stats|.*\\..*).*)",
  ],
};
