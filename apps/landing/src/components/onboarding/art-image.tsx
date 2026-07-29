type Props = {
  /** Public path without extension, e.g. "/art/landing-slides/slide-bg-1" */
  src: string;
  alt: string;
  /** Classes for the <picture> wrapper — where the box is positioned. */
  className?: string;
  /** "contain" (default) for titles/icons, "cover" for full-bleed scenes */
  fit?: "contain" | "cover";
  /**
   * Classes for the INNER <img>. Anything that styles the replaced element
   * belongs here — above all `object-position`, which decides what a `cover`
   * crop throws away. Routing it through `className` lands it on the
   * <picture>, where it is inert and fails without a symptom: the crop still
   * renders, just anchored wherever the browser defaults to.
   */
  imgClassName?: string;
  /** Intrinsic size. Reserves the box so the layout does not jump on load. */
  width?: number;
  height?: number;
};

/**
 * `<picture>` wrapper for the project's standard png+webp+avif triplet.
 * `<picture>` is `display: inline` by default — sizing/positioning classes
 * passed via `className` (e.g. `absolute inset-0 h-full w-full`) silently
 * no-op unless it's forced to `block` first.
 */
export function ArtImage({
  src,
  alt,
  className = "",
  fit = "contain",
  imgClassName = "",
  width,
  height,
}: Props) {
  return (
    <picture className={`block ${className}`}>
      <source srcSet={`${src}.avif`} type="image/avif" />
      <source srcSet={`${src}.webp`} type="image/webp" />
      <img
        src={`${src}.png`}
        alt={alt}
        width={width}
        height={height}
        className={`block h-full w-full ${
          fit === "cover" ? "object-cover" : "object-contain"
        } ${imgClassName}`}
      />
    </picture>
  );
}
