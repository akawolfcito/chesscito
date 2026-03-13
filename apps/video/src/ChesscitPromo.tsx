import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SplashIntro } from "./scenes/SplashIntro";
import { PiecesShowcase } from "./scenes/PiecesShowcase";
import { BoardBadge } from "./scenes/BoardBadge";

export const ChesscitPromo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={120} premountFor={30}>
        <SplashIntro />
      </Sequence>
      <Sequence from={120} durationInFrames={240} premountFor={30}>
        <PiecesShowcase />
      </Sequence>
      <Sequence from={360} durationInFrames={180} premountFor={30}>
        <BoardBadge />
      </Sequence>
    </AbsoluteFill>
  );
};
