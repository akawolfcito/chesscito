import type { ReactNode } from "react";
import { PhoneFrame } from "./phone-frame";

type ScreenSlot = {
  src: string;
  alt: string;
  label?: string;
};

type PhoneStackProps = {
  primary: ScreenSlot;
  secondary: ScreenSlot;
  variant?: "right" | "left";
  floatingNode?: ReactNode;
};

export function PhoneStack({ primary, secondary, variant = "right", floatingNode }: PhoneStackProps) {
  const secondaryOffset =
    variant === "right"
      ? "md:right-[-22%] md:rotate-[8deg]"
      : "md:left-[-22%] md:-rotate-[8deg]";

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div
        aria-hidden={true}
        className={`hidden md:absolute md:top-[10%] md:block md:w-[58%] md:opacity-95 ${secondaryOffset}`}
        style={{ filter: "drop-shadow(0 14px 24px rgba(40, 22, 8, 0.28))" }}
      >
        <PhoneFrame label={secondary.label}>
          <picture>
            <source srcSet={`${secondary.src}.avif`} type="image/avif" />
            <source srcSet={`${secondary.src}.webp`} type="image/webp" />
            <img src={`${secondary.src}.png`} alt={secondary.alt} className="h-full w-full object-cover" />
          </picture>
        </PhoneFrame>
      </div>
      <div className="relative z-10 mx-auto md:mt-0">
        <PhoneFrame label={primary.label}>
          <picture>
            <source srcSet={`${primary.src}.avif`} type="image/avif" />
            <source srcSet={`${primary.src}.webp`} type="image/webp" />
            <img src={`${primary.src}.png`} alt={primary.alt} className="h-full w-full object-cover" />
          </picture>
        </PhoneFrame>
        {floatingNode && (
          <div className="pointer-events-none absolute right-[-8%] top-[18%] z-20 hidden md:block">
            {floatingNode}
          </div>
        )}
      </div>
    </div>
  );
}
