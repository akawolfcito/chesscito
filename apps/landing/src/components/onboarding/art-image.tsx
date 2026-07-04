type Props = {
  /** Public path without extension, e.g. "/art/landing-slides/avatar-chesscito-welcome" */
  src: string;
  alt: string;
  className?: string;
  /** "contain" (default) for avatars/titles/icons, "cover" for full-bleed scenes */
  fit?: "contain" | "cover";
};

/**
 * `<picture>` wrapper for the project's standard png+webp+avif triplet.
 * `<picture>` is `display: inline` by default — sizing/positioning classes
 * passed via `className` (e.g. `absolute inset-0 h-full w-full`) silently
 * no-op unless it's forced to `block` first.
 */
export function ArtImage({ src, alt, className = "", fit = "contain" }: Props) {
  return (
    <picture className={`block ${className}`}>
      <source srcSet={`${src}.avif`} type="image/avif" />
      <source srcSet={`${src}.webp`} type="image/webp" />
      <img
        src={`${src}.png`}
        alt={alt}
        className={`block h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />
    </picture>
  );
}
