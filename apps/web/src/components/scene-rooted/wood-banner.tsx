"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type WoodBannerSize = "short" | "medium" | "large";

export type WoodBannerProps = {
  size: WoodBannerSize;
  children: ReactNode;
  accessory?: ReactNode;
  asTitle?: boolean;
  className?: string;
};

export function WoodBanner({
  size,
  children,
  accessory,
  asTitle = false,
  className = "",
}: WoodBannerProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  const setRootRef = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const computed = window.getComputedStyle(node).backgroundImage;
    setIsPlaceholder(!computed || computed === "none" || computed === "");
  }, [size]);

  const labelRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    if (process.env.NODE_ENV === "production") return;
    const { scrollWidth, clientWidth } = node;
    if (clientWidth <= 0) return;
    const ratio = scrollWidth / clientWidth;
    if (ratio > 1.25) {
      const overshoot = Math.round((ratio - 1) * 100);
      // eslint-disable-next-line no-console
      console.warn(
        `[WoodBanner] label overflows asset width by ${overshoot}%; pick a larger size or shorter copy.`,
      );
    }
  }, []);

  const classes = [
    "wood-banner",
    `wood-banner-${size}`,
    isPlaceholder ? "is-placeholder" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const commonProps = {
    "data-component": "wood-banner",
    "data-size": size,
    className: classes,
  } as const;

  const inner = (
    <>
      <span ref={labelRef} className="wood-banner-label">
        {children}
      </span>
      {accessory ? (
        <span className="wood-banner-accessory">{accessory}</span>
      ) : null}
    </>
  );

  if (asTitle) {
    return (
      <h2
        ref={setRootRef as (node: HTMLHeadingElement | null) => void}
        {...commonProps}
      >
        {inner}
      </h2>
    );
  }
  return (
    <div
      ref={setRootRef as (node: HTMLDivElement | null) => void}
      role="presentation"
      {...commonProps}
    >
      {inner}
    </div>
  );
}
