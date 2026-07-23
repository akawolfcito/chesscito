"use client";

import type {
  CSSProperties,
  HTMLAttributes,
  ImgHTMLAttributes,
} from "react";

import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import type { ThemeAssetVariant } from "@/lib/themes/theme-registry";
import { getResponsiveAssetProfile } from "@/lib/themes/responsive-asset-profiles";
import { useThemeAsset } from "@/lib/themes/use-theme-asset";
import { useThemeVariant } from "@/lib/themes/theme-variant-provider";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt"> & {
  slot: ThemeAssetKey;
  alt: string;
  variant?: ThemeAssetVariant;
  optimized?: boolean;
  pictureClassName?: string;
  pictureStyle?: CSSProperties;
  /** `data-*` is spelled out because `HTMLAttributes` does not carry it: JSX
   *  accepts data attributes inline, but not through a typed prop object, and
   *  the passport flames hang their test/CSS hooks (`data-kind`, `data-glow`)
   *  on the <picture>, not the <img>. */
  pictureProps?: Omit<HTMLAttributes<HTMLPictureElement>, "className" | "style"> & {
    [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
  };
};

export function ThemeAssetPicture({
  slot,
  variant,
  optimized = true,
  alt,
  pictureClassName,
  pictureStyle,
  pictureProps,
  ...imageProps
}: Props): React.JSX.Element | null {
  const currentVariant = useThemeVariant();
  const assetBase = useThemeAsset(slot, variant ?? currentVariant);
  if (!assetBase) return null;

  const responsiveProfile = getResponsiveAssetProfile(slot);
  const widths = responsiveProfile?.widths ?? [];
  const fallbackWidth = responsiveProfile?.canonical.width
    ?? Number(imageProps.width);
  const intrinsicProps = responsiveProfile
    ? {
        ...imageProps,
        width: responsiveProfile.canonical.width,
        height: responsiveProfile.canonical.height,
      }
    : imageProps;
  const srcSet = (extension: "avif" | "webp") => widths.length
    ? [
        ...widths.map((width) => `${assetBase}-${width}w.${extension} ${width}w`),
        Number.isFinite(fallbackWidth)
          ? `${assetBase}.${extension} ${fallbackWidth}w`
          : `${assetBase}.${extension}`,
      ].join(", ")
    : `${assetBase}.${extension}`;

  return (
    <picture
      {...pictureProps}
      className={pictureClassName}
      style={pictureStyle}
      data-theme-slot={slot}
    >
      {optimized ? (
        <>
          <source srcSet={srcSet("avif")} sizes={widths.length ? imageProps.sizes : undefined} type="image/avif" />
          <source srcSet={srcSet("webp")} sizes={widths.length ? imageProps.sizes : undefined} type="image/webp" />
        </>
      ) : null}
      <img {...intrinsicProps} src={`${assetBase}.png`} alt={alt} />
    </picture>
  );
}
