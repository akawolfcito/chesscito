import Link from "next/link";
import type { ReactNode } from "react";
import { ARENA_COPY } from "@/lib/content/editorial";

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
  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <div className="chesscito-dock-item">{badgeControl}</div>
      <div className="chesscito-dock-item">{shopControl}</div>

      {/* Center — primary action with glow pill */}
      <Link
        href="/arena"
        className="chesscito-dock-center"
      >
        <img src="/art/play-menu.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
        <span className="text-[8px] font-bold uppercase tracking-[0.14em]">
          {ARENA_COPY.title}
        </span>
      </Link>

      <div className="chesscito-dock-item">{leaderboardControl}</div>
      <div className="chesscito-dock-item">{inviteControl}</div>
    </nav>
  );
}
