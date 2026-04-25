"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { track } from "@/lib/telemetry";

export type DockTab = "badge" | "shop" | "trophies" | "leaderboard" | "arena" | null;

type PersistentDockProps = {
  badgeControl: ReactNode;
  shopControl: ReactNode;
  trophiesControl: ReactNode;
  leaderboardControl: ReactNode;
  /** Optional arena sheet trigger. When provided, the center button
   *  opens the arena entry sheet instead of navigating. When omitted
   *  (e.g., from /arena itself) the center falls back to a Link. */
  arenaControl?: ReactNode;
  /** Which destination tab is currently active. Drives the lift +
   *  label treatment on that item so the user always knows where
   *  they are. Null = no destination active. */
  activeDockTab: DockTab;
};

type ItemProps = {
  id: "badge" | "shop" | "trophies" | "leaderboard";
  label: string;
  control: ReactNode;
  activeDockTab: DockTab;
};

function DockItem({ id, label, control, activeDockTab }: ItemProps) {
  const isActive = activeDockTab === id;
  return (
    <div
      className={`chesscito-dock-item${isActive ? " is-active" : ""}`}
      data-dock-id={id}
      onClickCapture={() => track("dock_tap", { item: id })}
    >
      {control}
      <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
}

export function PersistentDock({
  badgeControl,
  shopControl,
  trophiesControl,
  leaderboardControl,
  arenaControl,
  activeDockTab,
}: PersistentDockProps) {
  const pathname = usePathname();
  const isArenaRoute = pathname === "/arena";
  const isArenaActive = isArenaRoute || activeDockTab === "arena";

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <DockItem id="badge" label={DOCK_LABELS.badge} control={badgeControl} activeDockTab={activeDockTab} />
      <DockItem id="shop" label={DOCK_LABELS.shop} control={shopControl} activeDockTab={activeDockTab} />

      {/* Center — Arena sheet trigger (preferred) or route Link fallback.
          Label is always visible (not gated on is-active) because the
          center button is the primary CTA — its meaning shouldn't
          depend on the icon alone, which players reported as
          ambiguous. */}
      {arenaControl ? (
        <div
          className={`chesscito-dock-center${isArenaActive ? " is-active" : ""}`}
          onClickCapture={() => track("dock_tap", { item: "arena" })}
        >
          {arenaControl}
          <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
            {DOCK_LABELS.arena}
          </span>
        </div>
      ) : (
        <Link
          href="/arena"
          className={`chesscito-dock-center${isArenaActive ? " is-active" : ""}`}
          onClick={() => track("dock_tap", { item: "arena" })}
        >
          <CandyBanner name="btn-battle" className="h-9 w-9" />
          <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
            {DOCK_LABELS.arena}
          </span>
        </Link>
      )}

      <DockItem id="trophies" label={DOCK_LABELS.trophies} control={trophiesControl} activeDockTab={activeDockTab} />
      <DockItem id="leaderboard" label={DOCK_LABELS.leaderboard} control={leaderboardControl} activeDockTab={activeDockTab} />
    </nav>
  );
}
