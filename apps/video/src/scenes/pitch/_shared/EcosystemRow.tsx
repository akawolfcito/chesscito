import React from "react";
import { Img, staticFile } from "remotion";
import { useBrand } from "../../../lib/pitch-locale";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  /** Label opacity (animated externally). */
  opacity?: number;
  /** Layout direction. Defaults to "row". */
  direction?: "row" | "column";
}

/**
 * Editorial ecosystem badge row showing:
 *   [MiniPay logo]  Próximamente en MiniPay
 *   [Celo logo]     Powered by Celo
 *   [DenLabs logo]  Construido por Den Labs
 *
 * Uses real brand assets:
 *   - public/brands/minipay.svg (rgb(7,149,95) ink)
 *   - public/brands/celo.svg (black wordmark + dot)
 *   - public/brands/denlabs.png (mascot)
 */
export const EcosystemRow: React.FC<Props> = ({
  opacity = 1,
  direction = "row",
}) => {
  const LIGHT = PITCH_THEME.light;
  const brand = useBrand();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: "center",
        gap: 32,
        opacity,
      }}
    >
      <EcosystemItem
        iconSrc={staticFile("brands/minipay.svg")}
        iconHeight={28}
        label={brand.miniPay}
      />
      <Separator />
      <EcosystemItem
        iconSrc={staticFile("brands/celo.svg")}
        iconHeight={20}
        iconAspect={220.895 / 49.977}
        label={brand.poweredBy}
      />
      <Separator />
      <EcosystemItem
        iconSrc={staticFile("brands/denlabs.png")}
        iconHeight={32}
        iconAspect={335 / 200}
        label={brand.byline}
      />
    </div>
  );
};

const Separator: React.FC = () => (
  <div
    aria-hidden
    style={{
      width: 1,
      height: 22,
      background: PITCH_THEME.light.border.mid,
    }}
  />
);

interface ItemProps {
  iconSrc: string;
  iconHeight: number;
  iconAspect?: number;
  label: string;
}

const EcosystemItem: React.FC<ItemProps> = ({
  iconSrc,
  iconHeight,
  iconAspect,
  label,
}) => {
  const width = iconAspect ? iconHeight * iconAspect : iconHeight;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Img
        src={iconSrc}
        style={{
          height: iconHeight,
          width,
          objectFit: "contain",
        }}
      />
      <span
        style={{
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 14,
          fontWeight: 600,
          color: PITCH_THEME.light.text.primary,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
    </div>
  );
};
