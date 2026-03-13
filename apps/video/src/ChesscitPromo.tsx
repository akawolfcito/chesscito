import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { SplashIntro } from "./scenes/SplashIntro";
import { PiecesShowcase } from "./scenes/PiecesShowcase";
import { BoardBadge } from "./scenes/BoardBadge";
import { CtaOutro } from "./scenes/CtaOutro";

const FADE_DURATION = 15; // 0.5s at 30fps

export const ChesscitPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0f1a" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <SplashIntro />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        <TransitionSeries.Sequence durationInFrames={240}>
          <PiecesShowcase />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        <TransitionSeries.Sequence durationInFrames={180}>
          <BoardBadge />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        <TransitionSeries.Sequence durationInFrames={120}>
          <CtaOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
