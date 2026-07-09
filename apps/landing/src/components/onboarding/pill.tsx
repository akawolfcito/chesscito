import type { ReactNode } from "react";

/**
 * `.candy-tray-pill` + `.hub-hud-pill` are ported verbatim from apps/web
 * globals.css — the same HUD chip family used across the Hub — so these
 * pills match the in-app look exactly.
 *
 * A pill is a thing you own. Prices are not pills: they render as a line of
 * text next to the tray, never inside it.
 */
export function Pill({
  icon,
  label,
  sublabel,
  iconRem = 1.8,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  /** Overrides `.candy-tray-pill-icon--floating`'s default 1.8rem icon size. */
  iconRem?: number;
}) {
  return (
    <div className="candy-tray-pill hub-hud-pill w-full">
      <span
        className="candy-tray-pill-icon--floating"
        style={{ width: `${iconRem}rem`, height: `${iconRem}rem` }}
      >
        {icon}
      </span>
      {/* `text-left` is load-bearing: SlideShell centers its whole content box,
          and `items-start` only aligns the two spans as boxes, not the text
          inside them. A sublabel that wraps would center its second line under
          a left-aligned label. */}
      <span className="flex flex-col items-start text-left leading-tight">
        {/* The label names the thing, the sublabel qualifies it, and the scale
            has to agree. It used to say the opposite (label 0.6, sublabel 0.7)
            with the dimming on the larger of the two, so "21 focus days"
            outweighed "Focus Passport". */}
        <span className="text-[0.7rem]">{label}</span>
        {sublabel ? <span className="text-[0.6rem] opacity-80">{sublabel}</span> : null}
      </span>
    </div>
  );
}
