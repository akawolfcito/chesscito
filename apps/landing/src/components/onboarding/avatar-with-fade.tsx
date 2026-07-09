import { ArtImage } from '@/components/onboarding/art-image'

const FADE_MASK = 'linear-gradient(to bottom, black 60%, transparent 100%)'

/**
 * Every call site passes its own `w-*`. A default width here cannot be
 * overridden from `className`: both utilities land on the same element
 * with equal specificity, so the winner is whichever Tailwind emits last
 * (it sorts widths ascending), not whichever is written last. The old
 * `w-48` default silently beat slide 4's `w-24`.
 */
export function AvatarWithFade({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div
      className={`h-auto shrink-0 ${className}`.trim()}
      style={{
        WebkitMaskImage: FADE_MASK,
        maskImage: FADE_MASK,
      }}
    >
      <ArtImage src={src} alt={alt} />
    </div>
  )
}
