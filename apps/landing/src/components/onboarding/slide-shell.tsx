'use client'

import { useRef, type ReactNode, type TouchEvent } from 'react'
import { ArtImage } from '@/components/onboarding/art-image'
import { SLIDE_STEPS, SLIDE_VISUALS } from '@/lib/onboarding/slides'
import type { SlideStep } from '@/lib/onboarding/types'

const SWIPE_THRESHOLD_PX = 40

/** Intrinsic size of the slide art. Declared so the box is reserved before
 *  the image decodes and the chrome above it does not jump. */
const ART_WIDTH = 941
const ART_HEIGHT = 1672

/**
 * Shared chrome for the onboarding carousel: a mobile-width column with the
 * active slide's illustration full-bleed behind it, and three rows on top —
 * nav pinned to the true top edge, content in the middle, footer pinned to
 * the bottom.
 *
 * The gold frame this replaced imposed a fixed 980:1398 box whose WIDTH was
 * derived from viewport height (`min(100%, calc(54dvh * 0.9))`), so short
 * screens shrank the copy or scrolled it inside a picture frame.
 */
export function SlideShell({
  activeStep,
  topSlot,
  children,
  actionSlot,
  footer,
  onSwipeLeft,
  onSwipeRight,
}: {
  activeStep: SlideStep
  topSlot?: ReactNode
  children: ReactNode
  /**
   * The action row at the foot of the slide. NOT "the button": slides 1-3 put
   * the gold advance button here and slide 4 puts the mode switch, so the
   * contract is the POSITION. Moving slide 4's control into the content block
   * would ask the thumb to unlearn three screens of muscle memory exactly
   * where the tap decides.
   */
  actionSlot?: ReactNode
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
    <div
      className="relative flex h-dvh w-full items-center justify-center overflow-hidden"
      // The letterbox behind the 420px column. Only ever visible on screens
      // wider than the slide art, so it reads as the frame around the phone
      // rather than as part of any slide.
      style={{
        background:
          'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.04) 0%, transparent 60%), linear-gradient(135deg, #2a2a2e 0%, #141416 100%)',
      }}
    >
      {/* ⚠️ The column is capped in HEIGHT as well as width, from `md` up.
       *
       * Width alone is not a frame. `cover` scales the art by whichever side
       * falls short, so on a tall desktop window the 420px column stretched to
       * the full viewport height (1300px is ordinary on a laptop) and the art
       * had to grow to 732px wide to cover it — 312px of it, 43%, cropped off
       * the sides. The wolf lost his staff and the footer sat on the art's
       * edge. On a phone this never showed: 390x844 is close enough to the
       * art's own proportion that the crop is a few pixels.
       *
       * 820, NOT the 746 that would match the art's ratio exactly. ⚠️ The asset
       * carries its own white passe-partout (~50px a side on 941x1672), which a
       * phone never sees because its 18% crop eats it. At 746 the column shows
       * the art WHOLE — margin included — and the slide reads as a poster in a
       * frame instead of a full-bleed scene. 820 keeps ~9% of crop: enough to
       * swallow the top margin and the sides, while the wolf keeps his staff.
       *
       * Gated at `md` because below it the column already spans the screen and
       * the letterbox has nowhere to sit; a phone is untouched by this rule.
       * Rounded for the same reason the backdrop above exists: at that size it
       * reads as the frame around the phone, and a floating square would read
       * as a mistake. */}
      <div className="relative h-full w-full max-w-[420px] overflow-hidden md:max-h-[820px] md:rounded-[28px]">
        {/* All four illustrations stay mounted, three of them transparent.
            Mounting only the active one makes each tap decode a fresh image
            and flash the blue underneath — a cost that did not exist when the
            four slides shared a single backdrop. */}
        {SLIDE_STEPS.map((step) => (
          <div
            key={step}
            data-slide-bg={step}
            data-active={step === activeStep ? 'true' : undefined}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
              step === activeStep ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ArtImage
              src={SLIDE_VISUALS[step].backgroundSrc}
              alt=""
              fit="cover"
              width={ART_WIDTH}
              height={ART_HEIGHT}
              className="h-full w-full"
              /* Anchored to the bottom: the wolf lives in the lower half and
                 the sky above is the sacrificial zone. Only bites when the
                 column is shorter than ~746px — above that, `cover` scales by
                 height and crops the sides instead, where this is inert.
                 Routed through imgClassName because object-position styles the
                 replaced element; on the <picture> it would do nothing, and it
                 would do it silently. */
              imgClassName="object-bottom"
            />
          </div>
        ))}

        <div
          className="relative flex h-full w-full flex-col items-center px-4 py-3"
          data-slide-step={activeStep}
        >
          <div className="w-full pt-1 text-center">{topSlot}</div>

          {/* The swipe surface is this row alone. Stretching it over the whole
              column would wrap the mode switch and the legal links, so a drag
              starting on a link could both navigate the carousel and follow
              the link. */}
          <div
            data-testid="slide-swipe-area"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex w-full min-h-0 flex-1 flex-col items-center justify-start gap-2 overflow-y-auto pt-2 text-center"
          >
            {children}
          </div>

          {actionSlot ? <div className="w-full pb-1">{actionSlot}</div> : null}

          <div className="w-full pb-1 pt-2">{footer}</div>
        </div>
      </div>
    </div>
  )
}
