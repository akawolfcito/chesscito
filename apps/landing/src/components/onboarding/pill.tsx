import type { ReactNode } from "react";

export function Pill({
  icon,
  label,
  sublabel,
  tone = "cream",
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  tone?: "cream" | "gold";
}) {
  const toneClass =
    tone === "gold"
      ? "bg-[#d8a63a] text-[#3a2600]"
      : "bg-[#fbf1d6] text-[#3a2600]";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${toneClass}`}
    >
      <div className="h-8 w-8 shrink-0">{icon}</div>
      <div className="flex flex-col leading-tight">
        <span className="font-bold">{label}</span>
        {sublabel ? <span className="text-sm opacity-80">{sublabel}</span> : null}
      </div>
    </div>
  );
}
