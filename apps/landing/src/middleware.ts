import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // /classic (existing hero, unmigrated), /stats and /pricing stay
    // locale-agnostic. /pricing especially: a business directory asks for the
    // exact address chesscito.com/pricing, and a locale prefix is how that
    // requirement quietly stops being met.
    // exactly as they behave today. /api/* covers /api/enter. Anything
    // with a file extension is a static asset.
    "/((?!api|_next|_vercel|classic|stats|pricing|.*\\..*).*)",
  ],
};
