import type { ReactNode } from "react";

/**
 * `.candy-tray-pill` + `.hub-hud-pill` are ported verbatim from apps/web
 * globals.css — the same HUD chip family used across the Hub — so these
 * pills match the in-app look exactly.
 */
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
  return (
    <div
      className={`candy-tray-pill hub-hud-pill w-full ${
        tone === "gold" ? "onboarding-pill--gold" : ""
      }`}
    >
      <span className="candy-tray-pill-icon--floating">{icon}</span>
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        {sublabel ? <span className="text-[0.7rem] opacity-80">{sublabel}</span> : null}
      </span>
    </div>
  );
}
