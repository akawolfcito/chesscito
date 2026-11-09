/**
 * Spoken narration script for the Chesscito A-Cut pitch video.
 *
 * Spec: docs/superpowers/specs/2026-04-29-pitch-audio-narration-design.md
 * Handoff: docs/handoffs/2026-04-29-pitch-audio-narration-handoff.md
 *
 * Status: text-only. Audio generation pipeline (ElevenLabs CLI,
 * manifest, Remotion <Audio> integration) is intentionally NOT
 * implemented yet — see spec for the full plan when ready.
 *
 * Authoring rules:
 * - This is SPOKEN text, not on-screen text. It can differ in tone,
 *   length and pacing from `pitch-copy.ts` overlays.
 * - Target ~150 wpm in ES, ~140 wpm in EN, leaving headroom for
 *   pauses and breaths inside each scene's `durationFrames`.
 * - One sentence per beat. Short, declarative, conversational.
 * - Never read the on-screen text verbatim — voice and screen
 *   should reinforce each other, not duplicate.
 */

import type { PitchLocale } from "./pitch-copy";

export type NarrationSceneId =
  | "hook"
  | "problem"
  | "capabilityShow"
  | "solution"
  | "coachVo"
  | "arena"
  | "sovereignty"
  | "teamMini"
  | "cta";

export interface SceneNarrationScript {
  sceneId: NarrationSceneId;
  text: Record<PitchLocale, string>;
}

export const PITCH_NARRATION_SCRIPT: readonly SceneNarrationScript[] = [
  {
    sceneId: "hook",
    text: {
      es: "El ajedrez antes del ajedrez. Retos breves para entrenar la mente.",
      en: "The chess before chess. Short challenges to train your mind.",
    },
  },
  {
    sceneId: "problem",
    text: {
      es: "No necesitas más pantalla. Necesitas mejor juego. Diez minutos, un reto, una pequeña victoria.",
      en: "You don't need more screen. You need better play. Ten minutes, one challenge, a small victory.",
    },
  },
  {
    sceneId: "capabilityShow",
    text: {
      es: "Atención, patrones, decisiones. Lo mejor del ajedrez, sin la presión del ajedrez.",
      en: "Attention, patterns, decisions. The best of chess, without the pressure of chess.",
    },
  },
  {
    sceneId: "solution",
    text: {
      es: "Abre MiniPay y empieza gratis. Sin descargas, sin registros. Acceso instantáneo.",
      en: "Open MiniPay and start free. No downloads, no signups. Instant access.",
    },
  },
  {
    sceneId: "coachVo",
    text: {
      es: "Antes de competir, hay que aprender a pensar jugando. César Litvinov, Maestro FIDE.",
      en: "Before competing, you must learn to think while playing. César Litvinov, FIDE Master.",
    },
  },
  {
    sceneId: "arena",
    text: {
      es: "Cuando estés listo, sube el reto. Practica, juega contra la IA, mejora a tu ritmo.",
      en: "When you're ready, raise the challenge. Practice, play against AI, improve at your own pace.",
    },
  },
  {
    sceneId: "sovereignty",
    text: {
      es: "Celebra tu progreso. Gana retos, desbloquea logros, guarda tus victorias.",
      en: "Celebrate your progress. Win challenges, unlock achievements, save your victories.",
    },
  },
  {
    sceneId: "teamMini",
    text: {
      es: "Nacido en el aula. Convertido en juego. Las personas detrás de Chesscito.",
      en: "Born in the classroom. Turned into a game. The people behind Chesscito.",
    },
  },
  {
    sceneId: "cta",
    text: {
      es: "Juega tu primer reto hoy. Próximamente en MiniPay.",
      en: "Play your first challenge today. Coming soon to MiniPay.",
    },
  },
] as const;

export type PitchNarrationScript = typeof PITCH_NARRATION_SCRIPT;
