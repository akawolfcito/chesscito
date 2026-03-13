import React from "react";
import { Composition } from "remotion";
import { ChesscitPromo } from "./ChesscitPromo";

const FPS = 30;
const DURATION_FRAMES = 615; // ~20.5s at 30fps (accounts for 3 fade transitions of 15 frames each)

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ChesscitPromo"
      component={ChesscitPromo}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
