import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { PITCH_B_COPY } from "./lib/pitch-copy";
import { PITCH_THEME } from "./lib/pitch-theme";
import { PitchHookCaregiver } from "./scenes/pitch/caregiver/PitchHookCaregiver";
import { PitchProblemCaregiver } from "./scenes/pitch/caregiver/PitchProblemCaregiver";
import { PitchCapabilityShow } from "./scenes/pitch/PitchCapabilityShow";
import { PitchAcademicBlock } from "./scenes/pitch/caregiver/PitchAcademicBlock";
import { PitchSolutionCaregiver } from "./scenes/pitch/caregiver/PitchSolutionCaregiver";
import { PitchCoachVO } from "./scenes/pitch/PitchCoachVO";
import { PitchArena } from "./scenes/pitch/PitchArena";
import { PitchSovereignty } from "./scenes/pitch/PitchSovereignty";
import { PitchTeamMini } from "./scenes/pitch/PitchTeamMini";
import { PitchDisclaimerCaregiver } from "./scenes/pitch/caregiver/PitchDisclaimerCaregiver";
import { PitchCTACaregiver } from "./scenes/pitch/caregiver/PitchCTACaregiver";

export const B_TRANSITION_FRAMES = 15;
const S = PITCH_B_COPY.scenes;

/**
 * B-Cut deliberately omits the persistent disclaimer overlay used by
 * the A-Cut. The B-Cut already includes the verified academic block
 * (scene 4) with mandatory limitations caption AND a dedicated full
 * disclaimer scene (scene 10). Adding the persistent overlay on top
 * would push the visual register toward "medical advisory", which
 * contradicts locked guardrail #4 (no clinical promise framing).
 */

export const B_DURATION =
  Object.values(S).reduce((sum, scene) => sum + scene.durationFrames, 0) -
  10 * B_TRANSITION_FRAMES;

export const ChesscitoPitchCaregiver: React.FC = () => {
  const trans = (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: B_TRANSITION_FRAMES })}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: PITCH_THEME.bg.base }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={S.hook.durationFrames}>
          <PitchHookCaregiver />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.problem.durationFrames}>
          <PitchProblemCaregiver />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence
          durationInFrames={S.capabilityShow.durationFrames}
        >
          <PitchCapabilityShow />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence
          durationInFrames={S.academicBlock.durationFrames}
        >
          <PitchAcademicBlock />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.solution.durationFrames}>
          <PitchSolutionCaregiver />
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
        <TransitionSeries.Sequence
          durationInFrames={S.disclaimer.durationFrames}
        >
          <PitchDisclaimerCaregiver />
        </TransitionSeries.Sequence>
        {trans}
        <TransitionSeries.Sequence durationInFrames={S.cta.durationFrames}>
          <PitchCTACaregiver />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
