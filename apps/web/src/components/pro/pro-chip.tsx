"use client";

import { useEffect, useRef } from "react";

import { PRO_COPY } from "@/lib/content/editorial";
import type { ProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

export type ProChipProps = {
  status: ProStatus | null;
  isLoading: boolean;
  onClick: () => void;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDaysLeft(expiresAt: number): string {
  const remainingMs = expiresAt - Date.now();
  const days = Math.ceil(remainingMs / MS_PER_DAY);
  if (days <= 1) return PRO_COPY.statusActiveSuffix(1);
  return `${days}d`;
}

/** Floating chip rendered absolute top-right inside the play-hub
 *  `<main>` shell. Always visible — single tap opens <ProSheet>.
 *
 *  - 28px tall, 64–120px wide. Below the dock z-index, above the HUD.
 *  - Skeleton shimmer while loading so the slot footprint is stable.
 *  - Inactive: gold→amber gradient with "GET PRO" label.
 *  - Active: purple→violet gradient with "PRO • Nd" or "Expires today".
 *
 *  Wired into the play-hub root in commit 6B.2. */
export function ProChip({ status, isLoading, onClick }: ProChipProps) {
  // Fire pro_card_viewed once per mount, after status has resolved.
  // The ref prevents the throttle from being load-bearing — even if the
  // chip re-renders 50× during a session, the event ships exactly once.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    if (isLoading || status === null) return;
    viewedRef.current = true;
    track("pro_card_viewed", { surface: "chip", active: status.active });
  }, [isLoading, status]);

  function handleClick() {
    track("pro_cta_clicked", { source: "chip" });
    onClick();
  }

  const isActive = Boolean(status?.active && status.expiresAt && status.expiresAt > Date.now());
  const showLoading = isLoading && status === null;

  const baseClasses =
    "pointer-events-auto flex h-7 min-w-[64px] max-w-[120px] items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] transition active:scale-[0.97]";

  if (showLoading) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label={PRO_COPY.label}
        className={`${baseClasses} animate-pulse bg-white/30 text-transparent`}
      >
        <span className="opacity-0">PRO</span>
      </button>
    );
  }

  if (isActive && status?.expiresAt) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${PRO_COPY.label} active`}
        className={`${baseClasses} bg-gradient-to-r from-[rgb(120,80,200)] to-[rgb(160,80,220)] text-white`}
      >
        <span aria-hidden="true">★</span>
        <span>PRO • {formatDaysLeft(status.expiresAt)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Get ${PRO_COPY.label}`}
      className={`${baseClasses} bg-gradient-to-r from-[rgb(255,200,80)] to-[rgb(255,160,40)] text-[rgb(80,40,5)]`}
    >
      <span aria-hidden="true">✦</span>
      <span>GET PRO</span>
    </button>
  );
}
