import type { ReactNode } from "react";

type GameplayPanelProps = {
  mission?: ReactNode;
  stats?: ReactNode;
  action?: ReactNode;
};

export function GameplayPanel({ mission, stats, action }: GameplayPanelProps) {
  const hasAnySlot = mission || stats || action;
  if (!hasAnySlot) return null;

  return (
    <div
      className="panel-elevated mx-2 shrink-0 overflow-hidden"
      style={{
        marginTop: "var(--shell-gap-xs)",
        marginBottom: "var(--shell-gap-sm)",
      }}
    >
      {mission && (
        <div className="px-4 py-2.5">{mission}</div>
      )}
      {mission && stats && (
        <div
          className="h-px bg-[var(--shell-divider)]"
        />
      )}
      {stats && (
        <div className="px-3 py-1.5">{stats}</div>
      )}
      {(mission || stats) && action && (
        <div
          className="h-px bg-[var(--shell-divider)]"
        />
      )}
      {action && (
        <div className="px-3 pb-1.5 pt-1">{action}</div>
      )}
    </div>
  );
}
