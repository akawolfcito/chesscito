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
    <div className="flex items-center justify-around px-6 pb-[calc(4px+env(safe-area-inset-bottom))] pt-2">
      {badgeControl}
      {shopControl}
      <Link
        href="/arena"
        className="flex flex-col items-center gap-0.5 text-cyan-200/40 transition-colors hover:text-cyan-200/70"
      >
        <span className="text-base">&#9823;</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">{ARENA_COPY.title}</span>
      </Link>
      {leaderboardControl}
      {inviteControl}
    </div>
  );
}
