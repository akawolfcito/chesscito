import type { MetadataRoute } from "next";
import { CHESSCITO_MODE } from "@/lib/feature-flags";

export default function manifest(): MetadataRoute.Manifest {
  const isLearnMode = CHESSCITO_MODE === "learn";

  return {
    name: isLearnMode ? "Chesscito Learn" : "Chesscito",
    short_name: isLearnMode ? "Learn" : "Chesscito",
    description: isLearnMode
      ? "Build a daily training habit while learning chess piece movements on Celo."
      : "Learn chess piece movements with gamified on-chain challenges on Celo.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
