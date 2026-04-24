"use client";

import type { ReactNode } from "react";

type CandyGlassShellProps = {
  /** Title rendered at the top-left of the panel header. */
  title: string;
  /** Called when the user taps the translucent red × close button. */
  onClose: () => void;
  /** Aria label for the close button. */
  closeLabel: string;
  /** Main body content. */
  children: ReactNode;
  /** Optional CTA row pinned below the body (buttons, links). */
  cta?: ReactNode;
  /** Optional meta row under the CTA (timers, brand tagline). */
  meta?: ReactNode;
  /** Extra class on the outer panel (width overrides, etc.). */
  className?: string;
};

/**
 * CandyGlassShell — the canonical "candy-light modal" shell.
 *
 * Uses the SAME `.sheet-bg-hub` painting as the dock sheets so the
 * forest bg-ch + cream wash are visible INSIDE the card, not just the
 * scrim behind it. Warm-brown fantasy title, red translucent × close
 * button, optional CTA + meta footers. Reference aesthetic:
 * piece-picker / mission-detail / dock sheets.
 *
 * Compose inside a `fixed inset-0 candy-modal-scrim` scrim
 * wrapper for modal-over-game presentations.
 */
export function CandyGlassShell({
  title,
  onClose,
  closeLabel,
  children,
  cta,
  meta,
  className = "",
}: CandyGlassShellProps) {
  return (
    <div
      className={`sheet-bg-hub flex w-full flex-col gap-3 rounded-3xl px-5 py-5 ${className}`.trim()}
      style={{
        border: "1px solid rgba(255, 255, 255, 0.45)",
        boxShadow:
          "0 10px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
      }}
    >
      <div className="flex items-center justify-between border-b border-[rgba(110,65,15,0.30)] pb-3 -mx-2">
        <h2
          className="fantasy-title px-2 text-lg font-extrabold"
          style={{
            color: "rgba(110, 65, 15, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="mr-2 flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-[0.94]"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            borderColor: "rgba(255, 255, 255, 0.45)",
            color: "#dc2626",
            backdropFilter: "blur(6px)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
      {cta}
      {meta ? (
        <p
          className="text-center text-xs"
          style={{ color: "rgba(110, 65, 15, 0.60)" }}
        >
          {meta}
        </p>
      ) : null}
    </div>
  );
}
