import React from "react";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  primary: string;
  secondary?: string;
  align?: "left" | "center";
  opacity?: number;
  onPaper?: boolean;
}

/**
 * Editorial signature block used by Coach + Origin scenes.
 * Renders a thin amber rule + primary line (uppercase tracked) +
 * optional secondary detail. Consistent across dark and paper bgs.
 */
export const SignatureBlock: React.FC<Props> = ({
  primary,
  secondary,
  align = "left",
  opacity = 1,
  onPaper = false,
}) => {
  const primaryColor = onPaper
    ? PITCH_THEME.text.onPaper
    : PITCH_THEME.text.primary;
  const secondaryColor = onPaper
    ? PITCH_THEME.text.onPaperMuted
    : PITCH_THEME.text.muted;

  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 64,
          height: 2,
          background: PITCH_THEME.accent.amber,
          opacity: 0.8,
          borderRadius: 2,
          boxShadow: `0 0 14px ${PITCH_THEME.accent.amberGlow}`,
        }}
      />
      <div
        style={{
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: primaryColor,
        }}
      >
        {primary}
      </div>
      {secondary && (
        <div
          style={{
            fontFamily: PITCH_THEME.type.sans,
            fontSize: 18,
            color: secondaryColor,
            letterSpacing: 0.2,
          }}
        >
          {secondary}
        </div>
      )}
    </div>
  );
};
