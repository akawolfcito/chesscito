import { ArtImage } from '@/components/onboarding/art-image'

const FADE_MASK = 'linear-gradient(to bottom, black 70%, transparent 100%)'

export function AvatarWithFade({
  src,
  alt,
  className = "",
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div
      className={`h-auto w-40 shrink-0 ${className}`.trim()}
      style={{
        WebkitMaskImage: FADE_MASK,
        maskImage: FADE_MASK,
      }}
    >
      <ArtImage src={src} alt={alt} />
    </div>
  )
}
