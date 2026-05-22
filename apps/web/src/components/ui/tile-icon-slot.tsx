"use client";

import { THEME_CONFIG } from "@/lib/theme";

type Props = {
  /** Asset base path without extension, e.g.
   *  `"/art/new-icons-chesscito/play-chess"`. The helper emits the
   *  `<picture>` with avif/webp/png fallbacks when the active theme
   *  declares `hasOptimizedFormats`; otherwise it falls back to png. */
  src: string;
  /** Override the optimized-format probe — set `false` for assets that
   *  only ship as png (e.g. the close-icon raster). */
  optimized?: boolean;
  /** Sizing class. Defaults to `h-10 w-10` to match the canonical
   *  sheet-header tile-icon stack (title line + subtitle line). */
  className?: string;
};

/**
 * Canonical tile-icon renderer for `<MissionHeaderCandy>` / `<ContextualHeader>`
 * `iconSlot`. Anchors a sheet header to the asset of its launching tile
 * (Daily → calendar, Mate → play-chess, Shop → shop-menu, …) so the
 * entry point and the destination share identity.
 *
 * Lives in `components/ui` because every AUX sheet imports it — keeping
 * the markup local avoided 12× duplication of the same `<picture>` block
 * across sheets. Sizing is `h-10 w-10` to mirror the combined height of
 * title + subtitle in the Z2 envelope (52–64px header height).
 */
export function TileIconSlot({
  src,
  optimized = true,
  className = "h-10 w-10 object-contain",
}: Props): React.JSX.Element {
  const useOptimized = optimized && THEME_CONFIG.hasOptimizedFormats;
  return (
    <picture>
      {useOptimized ? (
        <>
          <source srcSet={`${src}.avif`} type="image/avif" />
          <source srcSet={`${src}.webp`} type="image/webp" />
        </>
      ) : null}
      <img
        src={`${src}.png`}
        alt=""
        aria-hidden="true"
        className={className}
        draggable={false}
      />
    </picture>
  );
}
