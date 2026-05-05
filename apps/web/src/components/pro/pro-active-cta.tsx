"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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

export function ProActiveCTA({ source, onClose }: ProActiveCTAProps) {
  const router = useRouter();
  const arena = isArenaSurface(source);

  const label = arena ? PRO_COPY.activeCtaGotIt : PRO_COPY.activeCtaPlay;
  const subline = arena ? PRO_COPY.activeSublineArena : PRO_COPY.activeSublineHub;
  const variant = arena ? "game-ghost" : "game-primary";

  function handleClick() {
    track("pro_active_cta_tap", { source });
    if (!arena) router.push("/arena");
    onClose();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-white/55 px-3 py-3">
      <Button
        type="button"
        data-testid="pro-active-cta-button"
        variant={variant}
        size="game"
        onClick={handleClick}
      >
        {label}
      </Button>
      <p
        data-testid="pro-active-cta-subline"
        className="text-xs leading-snug"
        style={{ color: "rgba(110, 65, 15, 0.80)" }}
      >
        {subline}
      </p>
    </div>
  );
}
