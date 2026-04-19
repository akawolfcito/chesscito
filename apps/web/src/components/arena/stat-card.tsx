import type { ReactNode } from "react";

export function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5"
      style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.03), inset 0 -1px 2px rgba(0,0,0,0.15)" }}
    >
      <span className="flex h-5 items-center justify-center opacity-70">{icon}</span>
      <span className="text-base font-bold leading-none text-white">{value}</span>
      <span className="text-xs uppercase tracking-widest text-cyan-200/50">{label}</span>
    </div>
  );
}
