"use client";

import { usePathname, useRouter } from "next/navigation";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

export type DockSlot = "badge" | "shop" | "arena" | "trophies" | "leaderboard";

type Item = {
  id: DockSlot;
  label: string;
  icon: CandyIconName;
  href: string;
  /** Pathname prefix that activates this slot. Sheet-only destinations
   *  (Badge / Shop open via query params on /hub) leave this undefined
   *  so they never light up by URL alone. */
  activeWhen?: string;
};

/** Shop stays on /arena when tapped from there — the arena page mounts
 *  its own ShopSheet and reads `?sheet=shop` to open it in place. */
const SHEET_AWARE_SHOP_ROUTES = new Set(["/arena"]);

function resolveShopHref(pathname: string): string {
  if (SHEET_AWARE_SHOP_ROUTES.has(pathname)) {
    return `${pathname}?sheet=shop`;
  }
  return "/hub?sheet=shop";
}

/** Contextual center slot. From /arena → routes to /exercises (Pieces).
 *  From anywhere else → routes to /arena (Arena). Mirrors the pre-SPEC-1
 *  dock's center contextual swap. */
function resolveCenter(pathname: string): {
  href: string;
  label: string;
  icon: CandyIconName;
  trackItem: string;
} {
  const isArena = pathname.startsWith("/arena");
  if (isArena) {
    return { href: "/exercises", label: DOCK_LABELS.pieces, icon: "move", trackItem: "pieces" };
  }
  return { href: "/arena?fresh=1", label: DOCK_LABELS.arena, icon: "crosshair", trackItem: "arena" };
}

const SIDE_LEFT: ReadonlyArray<Item> = [
  { id: "badge", label: DOCK_LABELS.badge, icon: "shield", href: "/hub?sheet=badges" },
  { id: "shop", label: DOCK_LABELS.shop, icon: "shop", href: "/hub?sheet=shop" },
];

const SIDE_RIGHT: ReadonlyArray<Item> = [
  { id: "trophies", label: DOCK_LABELS.trophies, icon: "trophy", href: "/trophies", activeWhen: "/trophies" },
  { id: "leaderboard", label: DOCK_LABELS.leaderboard, icon: "star", href: "/leaderboard", activeWhen: "/leaderboard" },
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
  const href = item.id === "shop" ? resolveShopHref(pathname) : item.href;
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
        <CandyIcon name={item.icon} className="h-full w-full p-1" />
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
  const center = resolveCenter(pathname);
  const isCenterActive = pathname.startsWith("/arena");

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
          aria-label={center.label}
          aria-current={isCenterActive ? "page" : undefined}
          onClick={() => {
            track("dock_tap", { item: center.trackItem });
            router.push(center.href);
          }}
        >
          <CandyIcon name={center.icon} className="h-full w-full p-1" />
        </button>
        <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
          {center.label}
        </span>
      </div>

      {SIDE_RIGHT.map((item) => (
        <SideItem key={item.id} item={item} pathname={pathname} router={router} />
      ))}
    </nav>
  );
}
