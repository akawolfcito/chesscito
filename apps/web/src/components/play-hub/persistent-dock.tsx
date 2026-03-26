"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DOCK_LABELS } from "@/lib/content/editorial";

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
  const isCenterActive = pathname === "/";

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <div className="chesscito-dock-item">{badgeControl}</div>
      <div className="chesscito-dock-item">{shopControl}</div>

      {/* Center — Practice Hub with route-aware active state */}
      <Link
        href="/"
        className={`chesscito-dock-center${isCenterActive ? " is-active" : ""}`}
      >
        <picture>
          <source srcSet="/art/play-menu.webp" type="image/webp" />
          <img
            src="/art/play-menu.png"
            alt=""
            aria-hidden="true"
            className={`h-6 w-6 object-contain ${isCenterActive ? "dock-treat-active" : "dock-treat-base"}`}
          />
        </picture>
        <span className="text-[7px] font-bold uppercase tracking-[0.12em]">
          {DOCK_LABELS.practice}
        </span>
      </Link>

      <div className="chesscito-dock-item">{leaderboardControl}</div>
      <div className="chesscito-dock-item">{inviteControl}</div>
    </nav>
  );
}
