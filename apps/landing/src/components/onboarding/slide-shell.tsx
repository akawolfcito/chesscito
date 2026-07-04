import type { ReactNode } from "react";
import { ArtImage } from "@/components/onboarding/art-image";
import { MOBILE_SCENE_SRC, DESKTOP_SCENE_SRC, FRAME_SRC } from "@/lib/onboarding/slides";

/**
 * Shared visual chrome for every onboarding state (4 slides + the
 * returning-visitor welcome): full-bleed scene behind a fixed-aspect-ratio
 * gold frame, matching the frame PNG's native 1018:1768 proportions so its
 * ornate border never distorts. Content scrolls inside the frame if a
 * slide's copy runs long, rather than the frame stretching to fit it.
 */
export function SlideShell({
  topSlot,
  children,
  ctaSlot,
  footer,
}: {
  topSlot?: ReactNode;
  children: ReactNode;
  ctaSlot?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#1a3fae] px-4 py-6">
      <ArtImage
        src={MOBILE_SCENE_SRC}
        alt=""
        fit="cover"
        className="absolute inset-0 h-full w-full md:hidden"
      />
      <ArtImage
        src={DESKTOP_SCENE_SRC}
        alt=""
        fit="cover"
        className="absolute inset-0 hidden h-full w-full md:block"
      />

      {/* `relative` (not just DOM order) is required here: the scene
          images above are position:absolute with z-index:auto, which
          paint in DOM order among z:auto positioned siblings. Without
          `relative`, this wrapper is a non-positioned in-flow box, which
          per CSS stacking order paints BEFORE (behind) z:auto positioned
          siblings — the exact opposite of what we want. Confirmed via
          elementFromPoint() during development; do not remove. */}
      <div className="relative flex w-full max-w-[420px] flex-col items-center gap-4">
        {topSlot}

        <div
          className="relative w-full"
          style={{ aspectRatio: "1018 / 1768" }}
        >
          <ArtImage src={FRAME_SRC} alt="" className="absolute inset-0 h-full w-full" />
          <div className="relative z-10 flex h-full flex-col items-center gap-3 overflow-y-auto px-[9%] py-[8%] text-center">
            {children}
          </div>
        </div>

        {ctaSlot ? <div className="w-full">{ctaSlot}</div> : null}
        <div className="w-full">{footer}</div>
      </div>
    </div>
  );
}
