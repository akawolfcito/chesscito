import React from "react";
import { Img, staticFile } from "remotion";

interface Props {
  /** Pixel size of the icon (height = width, square asset 256×256). */
  size?: number;
}

/**
 * In-game chess king icon, served as a static asset from
 * `apps/video/public/pieces/w-king.png`. Source is the same artwork
 * used inside the Chesscito game (gold crown + silver body + blue
 * diamond), guaranteeing visual consistency between the pitch video
 * and the product UI.
 *
 * No SVG, no Unicode, no AI-generated art — the brand mark IS the
 * game piece.
 */
export const ChessKingIcon: React.FC<Props> = ({ size = 48 }) => (
  <Img
    src={staticFile("pieces/w-king.png")}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      display: "block",
    }}
  />
);
