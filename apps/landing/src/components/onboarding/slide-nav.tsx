import { CandyIcon } from '@/components/redesign/candy-icon'
import { ProgressPill } from '@/components/onboarding/progress-pill'

/**
 * Reuses the shared `chevron-down` asset rotated ±90deg instead of adding
 * dedicated left/right icon files (no canonical chevron-left/right asset
 * exists yet).
 */
export function SlideNav({
  step,
  total,
  onBack,
  onForward,
}: {
  step: number
  total: number
  onBack: () => void
  onForward: () => void
}) {
  const canGoBack = step > 1
  const canGoForward = step < total

  return (
    <div className="flex w-full items-center justify-between gap-2 px-1">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Previous slide"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d2a6b] disabled:opacity-0"
      >
        <CandyIcon name="chevron-down" className="h-4 w-4 rotate-90" />
      </button>
      <ProgressPill current={step} total={total} />
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Next slide"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d2a6b] disabled:opacity-0"
      >
        <CandyIcon name="chevron-down" className="h-4 w-4 -rotate-90" />
      </button>
    </div>
  )
}
