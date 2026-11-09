import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const localeMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Set only after bundling, in the local prerender process. Runtime requests
  // retain next-intl detection, locale cookies and canonical redirects.
  if (process.env.CHESSCITO_STATIC_PRERENDER === "1") return NextResponse.next();
  return localeMiddleware(request);
}

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
