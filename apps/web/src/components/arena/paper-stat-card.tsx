import type { ReactNode } from "react";

/** Cream paper-tray variant of the StatCard — nested inside CandyGlassShell
 *  arena end-state panels (victory-celebration, claiming, claim-error,
 *  claim-success). The cream chip on translucent glass gives the stats a
 *  "parchment inside scroll" hierarchy distinct from the shell body. */
export function PaperStatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="paper-tray flex flex-1 flex-col items-center gap-1 !px-2 !py-2">
      <span className="flex h-5 items-center justify-center opacity-80">{icon}</span>
      <span className="text-base font-extrabold leading-none" style={{ color: "var(--paper-text)" }}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest" style={{ color: "var(--paper-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
