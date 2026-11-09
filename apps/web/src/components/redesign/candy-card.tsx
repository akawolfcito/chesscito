"use client";

import { useId, type ReactNode } from "react";

export type CandyCardSize = "compact" | "regular" | "feature";
export type CandyCardAtmosphere = "hub" | "amber" | "gold";

export type CandyCardProps = {
  size?: CandyCardSize;
  atmosphere?: CandyCardAtmosphere;
  titleAs?: "h2" | "h3" | "h4";
  eyebrow?: ReactNode;
  title?: ReactNode;
  media?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  corner?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

const ATMOSPHERE_CLASSES: Record<CandyCardAtmosphere, string> = {
  hub: "sheet-bg-hub",
  amber: "candy-frame candy-frame-amber",
  gold: "candy-frame candy-frame-gold",
};

export function CandyCard({
  size = "regular",
  atmosphere = "hub",
  titleAs,
  eyebrow,
  title,
  media,
  children,
  footer,
  corner,
  className = "",
  "aria-label": ariaLabel,
}: CandyCardProps) {
  const generatedTitleId = useId();
  const titleId = title ? generatedTitleId : undefined;
  const TitleTag = titleAs ?? "h3";

  const chassisClasses = [
    "candy-card",
    `candy-card-${size}`,
    ATMOSPHERE_CLASSES[atmosphere],
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <section
      data-component="candy-card"
      data-size={size}
      data-atmosphere={atmosphere}
      className={chassisClasses}
      aria-labelledby={title ? titleId : undefined}
      aria-label={!title ? ariaLabel : undefined}
    >
      {corner ? <div className="candy-card-corner">{corner}</div> : null}
      {media ? <div className="candy-card-media">{media}</div> : null}
      {eyebrow || title ? (
        <header className="candy-card-header">
          {eyebrow ? <div className="candy-card-eyebrow">{eyebrow}</div> : null}
          {title ? (
            <TitleTag id={titleId} className="candy-card-title fantasy-title">
              {title}
            </TitleTag>
          ) : null}
        </header>
      ) : null}
      <div className="candy-card-body">{children}</div>
      {footer ? <div className="candy-card-footer">{footer}</div> : null}
    </section>
  );
}
