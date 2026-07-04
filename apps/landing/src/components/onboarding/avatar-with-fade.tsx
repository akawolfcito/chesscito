import { ArtImage } from "@/components/onboarding/art-image";

const FADE_MASK =
  "linear-gradient(to bottom, black 70%, transparent 100%)";

export function AvatarWithFade({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="h-32 w-32 shrink-0"
      style={{
        WebkitMaskImage: FADE_MASK,
        maskImage: FADE_MASK,
      }}
    >
      <ArtImage src={src} alt={alt} />
    </div>
  );
}
