import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SplashIntro } from "./scenes/SplashIntro";
import { PiecesShowcase } from "./scenes/PiecesShowcase";

export const ChesscitPromo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={120} premountFor={30}>
        <SplashIntro />
      </Sequence>
      <Sequence from={120} durationInFrames={240} premountFor={30}>
        <PiecesShowcase />
      </Sequence>
    </AbsoluteFill>
  );
};
