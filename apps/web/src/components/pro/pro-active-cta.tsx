"use client";

import { useRouter } from "next/navigation";

import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { PRO_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

export interface ProActiveCTAProps {
  /** Pathname captured once at sheet mount and frozen for the sheet's
   *  lifetime. Branches the CTA shape: /arena → close-only "Got it",
   *  any other path → navigational "Play in Arena". */
  source: string;
  /** Closes the parent sheet. Always invoked on tap, even when the CTA
   *  also navigates — sheet must dismiss cleanly. */
  onClose: () => void;
}

function isArenaSurface(source: string): boolean {
  return source === "/arena";
}

/**
 * Active-state primary CTA inside the candy panel. Renders the green
 * `PrincipalButton` so the candy-game treatment now anchors PLAY ARENA
 * (the JOURNAL row sits above as a cream card row). Subline is the
 * surface-aware pill chip below.
 */
export function ProActiveCTA({ source, onClose }: ProActiveCTAProps) {
  const router = useRouter();
  const arena = isArenaSurface(source);

  const label = arena ? PRO_COPY.activeCtaGotIt : PRO_COPY.activeCtaPlay;
  const subline = arena ? PRO_COPY.activeSublineArena : PRO_COPY.activeSublineHub;

  function handleClick() {
    track("pro_active_cta_tap", { source });
    if (!arena) {
      // Navigate away → don't call onClose(). When the sheet was
      // opened via /hub?legacy=1&action=pro, ExercisesScreen's bounce-
      // back useEffect listens for proSheetOpen flipping false and
      // races us to /hub — winning that race meant "Play in Arena"
      // ended up on /hub instead of /arena (B2 from
      // docs/audits/2026-05-07-hub-audit.md). The legacy host
      // unmounts cleanly when the route changes; no manual close
      // needed.
      router.push("/arena");
      return;
    }
    onClose();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <PrincipalButton
        size="medium"
        onClick={handleClick}
        aria-label={label}
        data-testid="pro-active-cta-button"
      >
        {label}
      </PrincipalButton>
      <span
        data-testid="pro-active-cta-subline"
        className="rounded-full px-3 py-1 text-nano font-bold uppercase tracking-wider"
        style={{
          background: "rgba(255, 245, 205, 0.55)",
          color: "rgba(110, 65, 15, 0.85)",
          border: "1px solid rgba(110, 65, 15, 0.18)",
        }}
      >
        {subline}
      </span>
    </div>
  );
}
