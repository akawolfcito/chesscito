"use client";

import { usePathname, useRouter } from "next/navigation";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";
import { requestCloseDockSheet, useDockSheet } from "@/lib/ui/dock-sheet-store";

export type DockSlot = "badge" | "shop" | "arena" | "trophies" | "leaderboard";

type Item = {
  id: DockSlot;
  label: string;
  icon: CandyIconName;
  /** Optional asset-backed icon base path (no extension). When set the
   *  dock renders a `<picture>` triplet (AVIF/WebP/PNG) instead of the
   *  abstract `<CandyIcon>` — gives the dock its rich game-art look
   *  for the slots that have dedicated artwork. */
  iconSrc?: string;
  /** Sheet key forwarded as `?sheet=<slug>` when the destination is an
   *  in-place sheet on /arena or /exercises. */
  sheet: string;
  /** Fallback route used when the user is on neither /arena nor
   *  /exercises (e.g., /hub, /trophies, /coach). */
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
  iconSrc,
  icon,
}: {
  iconSrc?: string;
  icon: CandyIconName;
}) {
  if (iconSrc) {
    return (
      <picture className="chesscito-dock-item-art">
        <source srcSet={`${iconSrc}.avif`} type="image/avif" />
        <source srcSet={`${iconSrc}.webp`} type="image/webp" />
        <img src={`${iconSrc}.png`} alt="" aria-hidden="true" />
      </picture>
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
  label: string;
  icon: CandyIconName;
  iconSrc: string;
  trackItem: string;
};

/** Per-route artwork + label + destination for the center slot. Keyed
 *  by base mode so the dock can either show the OTHER mode (route
 *  swap) or the CURRENT mode (overlay-close affordance) from the same
 *  source of truth. */
const MODE_DESCRIPTORS: Record<"exercises" | "arena", ModeDescriptor> = {
  exercises: {
    href: "/exercises",
    label: DOCK_LABELS.pieces,
    icon: "move",
    iconSrc: "/art/hub/train-pieces",
    trackItem: "pieces",
  },
  arena: {
    href: "/arena?fresh=1",
    label: DOCK_LABELS.arena,
    icon: "crosshair",
    iconSrc: "/art/hub/enter-arena",
    trackItem: "arena",
  },
};

/** Contextual center slot. From /arena → routes to /exercises (Pieces).
 *  From anywhere else → routes to /arena (Arena). Mirrors the pre-SPEC-1
 *  dock's center contextual swap. */
function resolveCenter(pathname: string): ModeDescriptor {
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.exercises : MODE_DESCRIPTORS.arena;
}

/** Base-mode descriptor — the visible route under any open auxiliary
 *  sheet. Used when an overlay is open so the center button signals
 *  "return to the mode beneath this overlay" with the artwork of the
 *  current route, not the OTHER route's artwork. */
function resolveBase(pathname: string): ModeDescriptor {
  const isArena = pathname.startsWith("/arena");
  return isArena ? MODE_DESCRIPTORS.arena : MODE_DESCRIPTORS.exercises;
}

const SIDE_LEFT: ReadonlyArray<Item> = [
  { id: "badge", label: DOCK_LABELS.badge, icon: "shield", iconSrc: "/art/badge-menu", sheet: "badges", fallback: "/hub?sheet=badges" },
  { id: "shop", label: DOCK_LABELS.shop, icon: "shop", iconSrc: "/art/shop-menu", sheet: "shop", fallback: "/hub?sheet=shop" },
];

const SIDE_RIGHT: ReadonlyArray<Item> = [
  { id: "trophies", label: DOCK_LABELS.trophies, icon: "trophy", sheet: "trophies", fallback: "/trophies", activeWhen: "/trophies" },
  { id: "leaderboard", label: DOCK_LABELS.leaderboard, icon: "star", iconSrc: "/art/leaderboard-menu", sheet: "leaderboard", fallback: "/exercises?sheet=leaderboard" },
];

function SideItem({
  item,
  pathname,
  router,
}: {
  item: Item;
  pathname: string;
  router: ReturnType<typeof useRouter>;
}) {
  const isActive = Boolean(item.activeWhen && pathname.startsWith(item.activeWhen));
  const href = resolveSheetHref(pathname, item.sheet, item.fallback);
  return (
    <div
      className={`chesscito-dock-item${isActive ? " is-active" : ""}`}
      data-dock-id={item.id}
    >
      <button
        type="button"
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          track("dock_tap", { item: item.id });
          router.push(href);
        }}
      >
        <DockIcon iconSrc={item.iconSrc} icon={item.icon} />
      </button>
      <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
        {item.label}
      </span>
    </div>
  );
}

export function PersistentDock() {
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
  const isCenterActive = false;

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      {SIDE_LEFT.map((item) => (
        <SideItem key={item.id} item={item} pathname={pathname} router={router} />
      ))}

      <div
        className={`chesscito-dock-center${isCenterActive ? " is-active" : ""}`}
        data-dock-id="arena"
      >
        <button
          type="button"
          aria-label={display.label}
          aria-current={isCenterActive ? "page" : undefined}
          onClick={() => {
            if (isOverlayOpen) {
              track("dock_center_close", { sheet: openSheet });
              requestCloseDockSheet();
              return;
            }
            track("dock_tap", { item: center.trackItem });
            router.push(center.href);
          }}
        >
          <DockIcon iconSrc={display.iconSrc} icon={display.icon} />
        </button>
        <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
          {display.label}
        </span>
      </div>

      {SIDE_RIGHT.map((item) => (
        <SideItem key={item.id} item={item} pathname={pathname} router={router} />
      ))}
    </nav>
  );
}
