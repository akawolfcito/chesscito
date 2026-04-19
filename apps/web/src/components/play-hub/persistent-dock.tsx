"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";

type PersistentDockProps = {
  badgeControl: ReactNode;
  shopControl: ReactNode;
  leaderboardControl: ReactNode;
  inviteControl: ReactNode;
};

export function PersistentDock({
  badgeControl,
  shopControl,
  leaderboardControl,
  inviteControl,
}: PersistentDockProps) {
  const pathname = usePathname();
  const isArenaActive = pathname === "/arena";

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <div className="chesscito-dock-item">{badgeControl}</div>
      <div className="chesscito-dock-item">{shopControl}</div>

      {/* Center — Arena / Free Play with route-aware active state */}
      <Link
        href="/arena"
        className={`chesscito-dock-center${isArenaActive ? " is-active" : ""}`}
      >
        <CandyBanner name="btn-battle" className="h-9 w-9" />
        <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
          {DOCK_LABELS.freePlay}
        </span>
      </Link>

      <div className="chesscito-dock-item">{leaderboardControl}</div>
      <div className="chesscito-dock-item">{inviteControl}</div>
    </nav>
  );
}
