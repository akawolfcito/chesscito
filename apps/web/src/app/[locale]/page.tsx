import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { preload } from "react-dom";

import { HubScaffoldClient } from "@/components/hub/hub-scaffold-client";
import { routing } from "@/i18n/routing";
import { appRootTitle } from "@/lib/content/app-branding";
import { CHESSCITO_MODE, isLiteModeServer } from "@/lib/feature-flags";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";
import { resolveThemeAsset } from "@/lib/themes/resolve-theme-asset";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

type SearchParams = {
  legacy?: string | string[];
  piece?: string | string[];
  action?: string | string[];
  sheet?: string | string[];
};

type HubInitialSheet =
  | "shop"
  | "pro"
  | "badges"
  | "trophies"
  | "profile"
  | "settings";

function pieceHasExercises(piece: string): piece is PieceId {
  const exercises = (EXERCISES as Record<string, unknown[] | undefined>)[piece];
  return Array.isArray(exercises) && exercises.length > 0;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseInitialSheet(value: string | undefined): HubInitialSheet | undefined {
  return value === "shop" ||
    value === "pro" ||
    value === "badges" ||
    value === "trophies" ||
    value === "profile" ||
    value === "settings"
    ? value
    : undefined;
}

function localizedPath(locale: string, path: string): string {
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return path === "/" ? localePrefix || "/" : `${localePrefix}${path}`;
}

export function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Metadata {
  const canonical = params.locale === routing.defaultLocale ? "/" : `/${params.locale}`;

  return {
    title: appRootTitle(CHESSCITO_MODE),
    robots: { index: false, follow: false },
    alternates: {
      canonical,
      languages: {
        en: "/",
        es: "/es",
        "x-default": "/",
      },
    },
  };
}

/**
 * Canonical Chesscito application entrypoint.
 *
 * Learn and Full deployments render the same Hub scaffold here; build-time
 * feature flags select the appropriate product experience. Legacy query
 * contracts from `/hub` remain intact because the temporary alias forwards
 * them to this page before the existing whitelist logic runs.
 */
export default function HomePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  const legacyFlag = firstParam(searchParams.legacy);
  const isLegacy = legacyFlag === "1" || legacyFlag === "true";

  if (isLegacy) {
    const action = firstParam(searchParams.action);

    if (action === "trophies") {
      redirect(localizedPath(params.locale, "/trophies"));
    }

    const actionSheet = parseInitialSheet(action);
    if (actionSheet) {
      redirect(`${localizedPath(params.locale, "/")}?sheet=${actionSheet}`);
    }

    const piece = firstParam(searchParams.piece);
    const query = new URLSearchParams();
    if (piece && pieceHasExercises(piece)) {
      query.set("piece", piece);
    }
    const qs = query.toString();
    redirect(
      `${localizedPath(params.locale, "/exercises")}${qs ? `?${qs}` : ""}`,
    );
  }

  const initialSheet = parseInitialSheet(firstParam(searchParams.sheet));

  if (isLiteModeServer()) {
    const ring = resolveThemeAsset("brand.ring-start-focus", "pro");
    if (ring) preload(`${ring}.avif`, { as: "image", type: "image/avif", fetchPriority: "high" });
  } else {
    // These three AVIFs are the established Full root-Hub LCP candidates.
    // Explicit preloads keep discovery ahead of CSS parsing and hydration.
    const lcpSlots: ThemeAssetKey[] = ["hub.bg", "hub.daily-icon", "hub.portal"];
    lcpSlots.forEach((slot) => {
      const asset = resolveThemeAsset(slot, "default");
      if (asset) preload(`${asset}.avif`, { as: "image", type: "image/avif", fetchPriority: "high" });
    });
  }

  return <HubScaffoldClient initialSheet={initialSheet} />;
}
