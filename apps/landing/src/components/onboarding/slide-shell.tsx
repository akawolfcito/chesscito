'use client'

import { useRef, type ReactNode, type TouchEvent } from 'react'
import { ArtImage } from '@/components/onboarding/art-image'
import {
  MOBILE_SCENE_SRC,
  DESKTOP_SCENE_SRC,
  FRAME_SRC,
} from '@/lib/onboarding/slides'

const SWIPE_THRESHOLD_PX = 40

/**
 * Shared visual chrome for every onboarding state (4 slides + the
 * returning-visitor welcome): full-bleed scene behind a fixed-aspect-ratio
 * gold frame, matching the frame PNG's native 980:1398 proportions (v3
 * asset, founder-updated 2026-07-04 — v1 was 1018:1768, v2 was 1070:1264)
 * so its ornate border never distorts. Content scrolls inside the frame
 * if a slide's copy runs long, rather than the frame stretching to fit it.
 */
export function SlideShell({
  topSlot,
  children,
  ctaSlot,
  footer,
  onSwipeLeft,
  onSwipeRight,
}: {
  topSlot?: ReactNode
  children: ReactNode
  ctaSlot?: ReactNode
  footer: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-[#1a3fae] px-4 py-4">
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
          elementFromPoint() during development; do not remove.

          3-row layout (was a single centered flex column): the frame
          never fills the full viewport height, which used to leave dead
          space equally above the progress counter and below the legal
          footer. Now topSlot pins to the true top edge, footer pins to
          the true bottom edge, and only the frame+CTA group centers in
          the leftover middle space (founder's on-screen markup request). */}
      <div className="relative flex h-full w-full max-w-[420px] flex-col items-center">
        <div className="w-full pt-1 text-center">{topSlot}</div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2 min-h-0">
          {/* The frame PNG has a fixed aspect ratio. The original 1018:1768
              asset was tall enough that sizing it by width alone (`w-full`
              up to max-w-420) produced a ~730px-tall frame that, with
              topSlot/ctaSlot/footer, overflowed real mobile viewports
              (browser chrome eats into `dvh`) and forced a page scroll.
              Fix: `width` is an explicit `min(100%, <height-budget-derived
              width>)` — deterministic, unlike relying on browser
              aspect-ratio+max-height auto-sizing (tried first, unreliable:
              content overflowed the frame's own bottom edge instead of
              scrolling). `height: auto` + `aspectRatio` then derives height
              from that resolved width, guaranteed to fit the budget. Kept
              after the v2 (shorter) asset landed — still correct, just
              binds less often now that the frame itself is shorter. */}
          <div
            className="relative"
            style={{
              aspectRatio: '980 / 1398',
              width: 'min(100%, calc(54dvh * 0.9))',
              height: 'auto',
            }}
          >
            <ArtImage
              src={FRAME_SRC}
              alt=""
              className="absolute inset-0 h-full w-full"
            />
            <div
              data-testid="slide-swipe-area"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="relative z-10 flex h-full flex-col items-center gap-2 overflow-y-auto px-[9%] py-[6%] text-center"
            >
              {children}
            </div>
          </div>

          {/* Full column width (was capped narrower via a dvh-derived
              max-width matching the frame's own budget) — founder wants
              Slide 4's 2-button row spread edge to edge like the Hub's
              Train Pieces / Enter Arena row, not squeezed to the frame's
              width. Applies to the single START/NEXT button too; a
              wider full-width button reads fine there as well. */}
          {ctaSlot ? <div className="w-full">{ctaSlot}</div> : null}
        </div>

        <div className="w-full pb-1">{footer}</div>
      </div>
    </div>
  )
}
