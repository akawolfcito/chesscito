"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";

export type DockTab = "badge" | "shop" | "leaderboard" | null;

type PersistentDockProps = {
  badgeControl: ReactNode;
  shopControl: ReactNode;
  leaderboardControl: ReactNode;
  inviteControl: ReactNode;
  /** Which destination tab is currently active. Drives the lift +
   *  label treatment on that item so the user always knows where
   *  they are. Null = no destination active (e.g., on /arena, which
   *  uses route-based active state on the center button). */
  activeDockTab: DockTab;
};

type ItemProps = {
  id: "badge" | "shop" | "leaderboard";
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
    >
      {control}
      {isActive && (
        <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
          {label}
        </span>
      )}
    </div>
  );
}

export function PersistentDock({
  badgeControl,
  shopControl,
  leaderboardControl,
  inviteControl,
  activeDockTab,
}: PersistentDockProps) {
  const pathname = usePathname();
  const isArenaActive = pathname === "/arena";

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <DockItem id="badge" label={DOCK_LABELS.badge} control={badgeControl} activeDockTab={activeDockTab} />
      <DockItem id="shop" label={DOCK_LABELS.shop} control={shopControl} activeDockTab={activeDockTab} />

      {/* Center — Arena with route-aware active state */}
      <Link
        href="/arena"
        className={`chesscito-dock-center${isArenaActive ? " is-active" : ""}`}
      >
        <CandyBanner name="btn-battle" className="h-9 w-9" />
        <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
          {DOCK_LABELS.arena}
        </span>
      </Link>

      <DockItem id="leaderboard" label={DOCK_LABELS.leaderboard} control={leaderboardControl} activeDockTab={activeDockTab} />
      {/* Invite is a transient share action — no persistent active state. */}
      <div className="chesscito-dock-item">{inviteControl}</div>
    </nav>
  );
}
