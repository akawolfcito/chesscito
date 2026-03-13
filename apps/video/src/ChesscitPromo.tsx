import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SplashIntro } from "./scenes/SplashIntro";

export const ChesscitPromo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={120} premountFor={30}>
        <SplashIntro />
      </Sequence>
    </AbsoluteFill>
  );
};
