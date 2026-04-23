"use client";

import type { ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";

type PaperPanelProps = {
  /** Text shown inside the yellow ribbon at the top. */
  ribbonTitle: string;
  /** Called when the user taps the × button. */
  onClose?: () => void;
  /** Aria label for the close button. */
  closeLabel?: string;
  /** Main content inside the cream area. */
  children: ReactNode;
  /** Optional CTA row pinned to the bottom of the cream area. */
  cta?: ReactNode;
  /** Optional muted meta row under the CTA (timers, info). */
  meta?: ReactNode;
  /** When true, drop the cream fill so the ribbon + border chrome is
   *  drawn on a transparent body. The underlying scrim (or page bg)
   *  shows through — use when the panel should feel "floating" rather
   *  than a physical parchment artifact. */
  hollow?: boolean;
  className?: string;
};

/**
 * PaperPanel — light-candy modal surface.
 *
 * Uses `paper-panel.png` (ribbon + cream frame baked in) as a fixed-aspect
 * background so the ribbon never stretches. Content lives inside the cream
 * region via percentage padding — same layout at any on-screen size.
 */
export function PaperPanel({
  ribbonTitle,
  onClose,
  closeLabel = "Close",
  children,
  cta,
  meta,
  hollow = false,
  className = "",
}: PaperPanelProps) {
  return (
    <div className={`paper-panel${hollow ? " paper-panel-hollow" : ""} ${className}`.trim()}>
      {/* Ribbon title (text laid over the baked-in ribbon artwork). */}
      <h2 className="paper-panel-ribbon">{ribbonTitle}</h2>

      {/* Close button — outside the panel top-right, pinned. */}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="paper-panel-close"
          aria-label={closeLabel}
        >
          <CandyIcon name="close" className="h-5 w-5 text-white" />
        </button>
      ) : null}

      {/* Content area — flows inside the cream region. */}
      <div className="paper-panel-body">{children}</div>

      {cta ? <div className="paper-panel-cta">{cta}</div> : null}
      {meta ? <p className="paper-panel-meta">{meta}</p> : null}
    </div>
  );
}
