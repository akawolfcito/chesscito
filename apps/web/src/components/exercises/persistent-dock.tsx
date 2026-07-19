"use client";

import { useTranslations } from "next-intl";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { usePathname, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/telemetry";
import {
  requestCloseDockSheet,
  requestOpenDockSheet,
  useDockSheet,
} from "@/lib/ui/dock-sheet-store";
import { CHESSCITO_LITE_MODE, isPlayMode } from "@/lib/feature-flags";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

/**
 * Locale-aware navigation primitives. Critical for the i18n migration:
 *   - `usePathname()` from `@/i18n/navigation` returns the path WITHOUT
 *     the locale segment (`/exercises` rather than `/es/exercises`),
 *     so the `startsWith("/exercises")` host-route checks keep working
 *     post Stage 1.
 *   - `useRouter().push(href)` from this module preserves the active
 *     locale when navigating, so a user on `/es/*` who taps a dock
 *     item that falls back to `/` lands on `/es`, preserving locale.
 */

export type DockSlot = "badge" | "shop" | "arena" | "trophies" | "leaderboard";

type DockLabelKey = "pieces" | "arena" | "badge" | "shop" | "trophies" | "leaderboard";

type Item = {
  id: DockSlot;
  labelKey: DockLabelKey;
  icon: CandyIconName;
  /** Optional asset-backed icon base path (no extension). When set the
   *  dock renders a `<picture>` triplet (AVIF/WebP/PNG) instead of the
   *  abstract `<CandyIcon>` — gives the dock its rich game-art look
   *  for the slots that have dedicated artwork. */
  iconSlot?: ThemeAssetKey;
  /** Sheet key forwarded as `?sheet=<slug>` when the destination is an
   *  in-place sheet on /arena or /exercises. */
  sheet: string;
  /** Fallback route used when the user is on neither /arena nor
   *  /exercises (e.g., /, /trophies, /coach). */
  fallback: string;
  /** Pathname prefix that activates this slot purely by URL. Sheet-only
   *  destinations leave this undefined so they never light up just from
   *  the route (the host page owns the active-tab state for sheets). */
  activeWhen?: string;
};

/** Render either an asset-backed `<picture>` triplet or fall back to the
 *  abstract `<CandyIcon>`. Centralized so every dock slot uses the same
 *  sizing class without duplicating the conditional. */
function DockIcon({
  iconSlot,
  icon,
}: {
  iconSlot?: ThemeAssetKey;
  icon: CandyIconName;
}) {
  if (iconSlot) {
    return (
      <ThemeAssetPicture
        slot={iconSlot}
        pictureClassName="chesscito-dock-item-art"
        alt=""
        aria-hidden="true"
      />
    );
  }
  return <CandyIcon name={icon} className="h-full w-full p-1" />;
}

/** Resolve the destination for an in-place sheet. /arena and /exercises
 *  mount BadgeSheet / ShopSheet / TrophiesSheet / LeaderboardSheet and
 *  read `?sheet=…` to open them locally. From any other route, fall
 *  back to the slot's canonical destination. */
function resolveSheetHref(pathname: string, sheet: string, fallback: string): string {
  if (pathname.startsWith("/exercises")) return `/exercises?sheet=${sheet}`;
  if (pathname.startsWith("/arena")) return `/arena?sheet=${sheet}`;
  return fallback;
}

type ModeDescriptor = {
  href: string;
  labelKey: DockLabelKey;
  icon: CandyIconName;
  iconSlot: ThemeAssetKey;
  trackItem: string;
};

/** Per-route artwork + label + destination for the center slot. Keyed
 *  by base mode so the dock can either show the OTHER mode (route
 *  swap) or the CURRENT mode (overlay-close affordance) from the same
 *  source of truth. */
const MODE_DESCRIPTORS: Record<"exercises" | "arena", ModeDescriptor> = {
  exercises: {
    href: "/exercises",
    labelKey: "pieces",
    icon: "move",
    iconSlot: "hub.train-pieces",
    trackItem: "pieces",
  },
  arena: {
    href: "/arena?fresh=1",
    labelKey: "arena",
    icon: "crosshair",
    iconSlot: "hub.enter-arena",
    trackItem: "arena",
  },
};

/** Contextual center slot. From /arena → routes to /exercises (Pieces).
 *  From anywhere else → routes to /arena (Arena). Mirrors the pre-SPEC-1
 *  dock's center contextual swap.
 *  In Lite Mode Arena is hidden — always show PIECES. */
function resolveCenter(pathname: string): ModeDescriptor {
  if (isPlayMode()) return MODE_DESCRIPTORS.arena;
  if (CHESSCITO_LITE_MODE) return MODE_DESCRIPTORS.exercises;
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.exercises : MODE_DESCRIPTORS.arena;
}

/** Base-mode descriptor — the visible route under any open auxiliary
 *  sheet. Used when an overlay is open so the center button signals
 *  "return to the mode beneath this overlay" with the artwork of the
 *  current route, not the OTHER route's artwork. */
function resolveBase(pathname: string): ModeDescriptor {
  if (isPlayMode()) return MODE_DESCRIPTORS.arena;
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.arena : MODE_DESCRIPTORS.exercises;
}

const SIDE_LEFT: ReadonlyArray<Item> = [
  { id: "badge", labelKey: "badge", icon: "shield", iconSlot: "exercises.badge-menu", sheet: "badges", fallback: "/?sheet=badges" },
  { id: "shop", labelKey: "shop", icon: "shop", iconSlot: "exercises.shop-menu", sheet: "shop", fallback: "/?sheet=shop" },
];

const SIDE_RIGHT: ReadonlyArray<Item> = [
  { id: "trophies", labelKey: "trophies", icon: "trophy", iconSlot: "shared.trophy-epic", sheet: "trophies", fallback: "/trophies", activeWhen: "/trophies" },
  {
    id: "leaderboard",
    labelKey: "leaderboard",
    icon: "star",
    iconSlot: "exercises.leaderboard-menu",
    sheet: "leaderboard",
    // Play never has a reachable /exercises (PR2 redirects it to Learn) —
    // its cross-route fallback must land on /arena instead.
    fallback: isPlayMode() ? "/arena?sheet=leaderboard" : "/exercises?sheet=leaderboard",
  },
];

function SideItem({
  item,
  pathname,
  router,
  openSheet,
  label,
}: {
  item: Item;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  openSheet: ReturnType<typeof useDockSheet>;
  label: string;
}) {
  // Active in two situations: (a) the route matches activeWhen (e.g.
  // the standalone /trophies page), or (b) the matching auxiliary
  // sheet is currently mounted on /exercises or /arena. Without (b)
  // the slot that just opened a sheet went dark, so the user lost the
  // visual anchor for what they had just tapped.
  const isActive =
    openSheet === item.id ||
    Boolean(item.activeWhen && pathname.startsWith(item.activeWhen));
  const hostsOpener =
    pathname.startsWith("/exercises") || pathname.startsWith("/arena");
  const href = resolveSheetHref(pathname, item.sheet, item.fallback);
  return (
    <div
      className={`chesscito-dock-item${isActive ? " is-active" : ""}`}
      data-dock-id={item.id}
    >
      <button
        type="button"
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          track("dock_tap", { item: item.id });
          // Same-route taps on pages that mount the auxiliary sheets
          // dispatch through the store — no URL involvement, no race
          // with Radix's pointerdown-outside or with router.replace.
          // Cross-route taps (e.g. from the root Hub) still need the URL push
          // so the target page mounts with the right deep-link.
          if (hostsOpener && requestOpenDockSheet(item.id)) return;
          router.push(href);
        }}
      >
        <DockIcon iconSlot={item.iconSlot} icon={item.icon} />
      </button>
      <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
}

export function PersistentDock() {
  const t = useTranslations("DOCK_LABELS");
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const openSheet = useDockSheet();
  const center = resolveCenter(pathname);
  const base = resolveBase(pathname);
  // When an auxiliary sheet is open on top of /exercises or /arena, the
  // center button stops being a route swap and becomes "close the
  // overlay and stay on the current base route" — matches the user's
  // muscle-memory expectation that the big center action returns them
  // to the visible mode under the overlay (not to the OTHER mode). The
  // artwork mirrors the BASE route (the one the user is returning to)
  // so the affordance reads as "back to TRAIN" / "back to ARENA"
  // instead of an abstract close glyph.
  const isOverlayOpen = openSheet !== null;
  const display = isOverlayOpen ? base : center;
  // Center is a contextual "go to the other side" quick-action — it
  // always shows the route you're NOT on, so a route-based active
  // glow would mislead ("looks like you're in Pieces while standing
  // in Arena"). Visual prominence already comes from being larger +
  // warmer than the sides. Lift only on hover/press (CSS handles it).
  // Exception: Lite Mode pins center to PIECES, so it IS the current
  // route on /exercises and should glow as active.
  const isCenterActive =
    (CHESSCITO_LITE_MODE && pathname.startsWith("/exercises")) ||
    (isPlayMode() && pathname.startsWith("/arena"));
  const displayLabel = t(display.labelKey);

  // B5 (MiniPay delivery audit): hide the Leaderboard dock tab on /arena
  // (PLAY) until a real ELO/ranking exists. LEARN (/exercises) keeps its
  // puzzle leaderboard. Pure render-time filter — no leaderboard logic
  // touched; the sheet stays mounted for any deep link.
  const isArena = pathname.startsWith("/arena");
  const sideRight = isArena
    ? SIDE_RIGHT.filter((item) => item.id !== "leaderboard")
    : SIDE_RIGHT;

  return (
    <nav
      className={`chesscito-dock${CHESSCITO_LITE_MODE ? " chesscito-dock--lite" : ""}${isArena ? " chesscito-dock--four" : ""}`}
      aria-label={t("navAriaLabel")}
    >
      {SIDE_LEFT.map((item) => (
        <SideItem key={item.id} item={item} pathname={pathname} router={router} openSheet={openSheet} label={t(item.labelKey)} />
      ))}

      <div
        className={`chesscito-dock-center${isCenterActive ? " is-active" : ""}`}
        data-dock-id="arena"
      >
        <button
          type="button"
          aria-label={displayLabel}
          aria-current={isCenterActive ? "page" : undefined}
          onClick={() => {
            if (isOverlayOpen) {
              track("dock_center_close", { sheet: openSheet });
              requestCloseDockSheet();
              return;
            }
            // Play's center is permanently pinned to Arena — tapping it while
            // already on /arena has no "other side" to swap to and must not
            // fire a fresh-entry reset that would interrupt an active match.
            if (isPlayMode() && pathname.startsWith("/arena")) return;
            track("dock_tap", { item: center.trackItem });
            router.push(center.href);
          }}
        >
          <DockIcon iconSlot={display.iconSlot} icon={display.icon} />
        </button>
        <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
          {displayLabel}
        </span>
      </div>

      {sideRight.map((item) => (
        <SideItem key={item.id} item={item} pathname={pathname} router={router} openSheet={openSheet} label={t(item.labelKey)} />
      ))}
    </nav>
  );
}
