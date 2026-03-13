import type { ReactNode } from "react";

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
      {leaderboardControl}
      {inviteControl}
    </div>
  );
}
