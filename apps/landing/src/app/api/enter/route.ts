import { NextResponse, type NextRequest } from "next/server";
import { destinationForMode } from "@/lib/app-urls";
import { ONBOARDING_COOKIE, type PreferredMode } from "@/lib/onboarding/types";

const ONE_YEAR_SECONDS = 31536000;

function parseMode(value: string | null): PreferredMode | null {
  return value === "learn" || value === "play" ? value : null;
}

export async function GET(request: NextRequest) {
  const mode = parseMode(request.nextUrl.searchParams.get("mode"));

  const response = mode
    ? NextResponse.redirect(`${destinationForMode(mode)}/`, 302)
    : NextResponse.redirect(new URL("/classic", request.url), 302);

  if (mode) {
    response.cookies.set(ONBOARDING_COOKIE.onboarded, "true", {
      path: "/",
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
    });
    response.cookies.set(ONBOARDING_COOKIE.preferredMode, mode, {
      path: "/",
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  return response;
}
