"use client";

import { usePathname, useRouter } from "next/navigation";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

export type DockSlot = "home" | "pieces" | "shop" | "board" | "settings";

type Item = {
  id: DockSlot;
  label: string;
  icon: CandyIconName;
  href: string;
  /** Pathname prefix that activates this slot. Sheet-only destinations
   *  (Shop / Settings open via query params) leave this undefined so
   *  they never light up by URL alone. */
  activeWhen?: string;
};

const ITEMS: ReadonlyArray<Item> = [
  { id: "home", label: DOCK_LABELS.home, icon: "crown", href: "/hub", activeWhen: "/hub" },
  { id: "pieces", label: DOCK_LABELS.pieces, icon: "move", href: "/exercises", activeWhen: "/exercises" },
  { id: "shop", label: DOCK_LABELS.shop, icon: "shop", href: "/hub?sheet=shop" },
  { id: "board", label: DOCK_LABELS.board, icon: "crosshair", href: "/leaderboard", activeWhen: "/leaderboard" },
  { id: "settings", label: DOCK_LABELS.settings, icon: "shield", href: "/hub?sheet=settings" },
];

export function PersistentDock() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      {ITEMS.map((item) => {
        const isActive = Boolean(item.activeWhen && pathname.startsWith(item.activeWhen));
        return (
          <div
            key={item.id}
            className={`chesscito-dock-item${isActive ? " is-active" : ""}`}
            data-dock-id={item.id}
          >
            <button
              type="button"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                track("dock_tap", { item: item.id });
                router.push(item.href);
              }}
            >
              <CandyIcon name={item.icon} className="h-full w-full p-1" />
            </button>
            <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
              {item.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
