"use client";

import type {
  CSSProperties,
  HTMLAttributes,
  ImgHTMLAttributes,
} from "react";

import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import type { ThemeAssetVariant } from "@/lib/themes/theme-registry";
import { useThemeAsset } from "@/lib/themes/use-theme-asset";
import { useThemeVariant } from "@/lib/themes/theme-variant-provider";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt"> & {
  slot: ThemeAssetKey;
  alt: string;
  variant?: ThemeAssetVariant;
  optimized?: boolean;
  responsiveWidths?: readonly number[];
  pictureClassName?: string;
  pictureStyle?: CSSProperties;
  pictureProps?: Omit<HTMLAttributes<HTMLPictureElement>, "className" | "style">;
};

export function ThemeAssetPicture({
  slot,
  variant,
  optimized = true,
  responsiveWidths,
  alt,
  pictureClassName,
  pictureStyle,
  pictureProps,
  ...imageProps
}: Props): React.JSX.Element | null {
  const currentVariant = useThemeVariant();
  const assetBase = useThemeAsset(slot, variant ?? currentVariant);
  if (!assetBase) return null;

  const widths = assetBase.startsWith("/art/theme-builder/")
    ? []
    : responsiveWidths ?? [];
  const fallbackWidth = Number(imageProps.width);
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
      <img {...imageProps} src={`${assetBase}.png`} alt={alt} />
    </picture>
  );
}
