import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { PITCH_A_COPY } from "./lib/pitch-copy";
import { PITCH_THEME } from "./lib/pitch-theme";
import { PitchHook } from "./scenes/pitch/PitchHook";
import { PitchProblem } from "./scenes/pitch/PitchProblem";
import { PitchCapabilityShow } from "./scenes/pitch/PitchCapabilityShow";
import { PitchSolution } from "./scenes/pitch/PitchSolution";
import { PitchCoachVO } from "./scenes/pitch/PitchCoachVO";
import { PitchArena } from "./scenes/pitch/PitchArena";
import { PitchSovereignty } from "./scenes/pitch/PitchSovereignty";
import { PitchTeamMini } from "./scenes/pitch/PitchTeamMini";
import { PitchCTA, type CtaVariant } from "./scenes/pitch/PitchCTA";

export const A_TRANSITION_FRAMES = 15;
const S = PITCH_A_COPY.scenes;

/**
 * v2 — premium / startup-game tone (2026-04-27).
 * The persistent A-Cut disclaimer was removed: the A-Cut deliberately
 * avoids any clinical or defensive language. The medical disclaimer
 * lives only in the B-Cut (`ChesscitoPitchCaregiver`) as fine-print.
 */
export const A_DURATION =
  Object.values(S).reduce((sum, scene) => sum + scene.durationFrames, 0) -
  8 * A_TRANSITION_FRAMES;

interface Props {
  ctaVariant?: CtaVariant;
}

export const ChesscitoPitch: React.FC<Props> = ({ ctaVariant = "social" }) => {
  const trans = (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: A_TRANSITION_FRAMES })}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH_THEME.bg.base }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={S.hook.durationFrames}>
          <PitchHook />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.problem.durationFrames}>
          <PitchProblem />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence
          durationInFrames={S.capabilityShow.durationFrames}
        >
          <PitchCapabilityShow />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.solution.durationFrames}>
          <PitchSolution />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.coachVo.durationFrames}>
          <PitchCoachVO />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.arena.durationFrames}>
          <PitchArena />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence
          durationInFrames={S.sovereignty.durationFrames}
        >
          <PitchSovereignty />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.teamMini.durationFrames}>
          <PitchTeamMini />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.cta.durationFrames}>
          <PitchCTA variant={ctaVariant} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
