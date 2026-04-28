import React from "react";
import { Composition } from "remotion";
import { ChesscitPromo } from "./ChesscitPromo";
import { ChesscitoPitch, A_DURATION } from "./ChesscitoPitch";
import { ChesscitoPitchCaregiver, B_DURATION } from "./ChesscitoPitchCaregiver";

const FPS = 30;
const PROMO_DURATION_FRAMES = 615; // legacy promo (~20.5s)

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChesscitPromo"
        component={ChesscitPromo}
        durationInFrames={PROMO_DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="ChesscitoPitch"
        component={ChesscitoPitch}
        durationInFrames={A_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ctaVariant: "social" as const }}
      />
      <Composition
        id="ChesscitoPitchCaregiver"
        component={ChesscitoPitchCaregiver}
        durationInFrames={B_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="ChesscitoPitch16x9"
        component={ChesscitoPitch}
        durationInFrames={A_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ ctaVariant: "social" as const }}
      />
      <Composition
        id="ChesscitoPitchCaregiver16x9"
        component={ChesscitoPitchCaregiver}
        durationInFrames={B_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
