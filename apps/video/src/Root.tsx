import React from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { ChesscitPromo } from "./ChesscitPromo";
import { ChesscitoPitch, A_DURATION } from "./ChesscitoPitch";
import { ChesscitoPitchCaregiver, B_DURATION } from "./ChesscitoPitchCaregiver";

const FPS = 30;
const PROMO_DURATION_FRAMES = 615; // legacy promo (~20.5s)

/**
 * v3.9 — Zod schemas drive the Remotion Studio props panel so the
 * editor renders dropdowns for `locale` and `ctaVariant`. Without a
 * schema, Studio only honors `defaultProps` silently and shows no
 * editor controls.
 */
const pitchSchema = z.object({
  ctaVariant: z.enum(["in-minipay", "social"]),
  locale: z.enum(["es", "en"]),
});

const caregiverSchema = z.object({
  locale: z.enum(["es", "en"]),
});

const PITCH_DEFAULTS: z.infer<typeof pitchSchema> = {
  ctaVariant: "social",
  locale: "es",
};

const CAREGIVER_DEFAULTS: z.infer<typeof caregiverSchema> = {
  locale: "es",
};

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
        schema={pitchSchema}
        defaultProps={PITCH_DEFAULTS}
      />
      <Composition
        id="ChesscitoPitchCaregiver"
        component={ChesscitoPitchCaregiver}
        durationInFrames={B_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        schema={caregiverSchema}
        defaultProps={CAREGIVER_DEFAULTS}
      />
      <Composition
        id="ChesscitoPitch16x9"
        component={ChesscitoPitch}
        durationInFrames={A_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        schema={pitchSchema}
        defaultProps={PITCH_DEFAULTS}
      />
      <Composition
        id="ChesscitoPitchCaregiver16x9"
        component={ChesscitoPitchCaregiver}
        durationInFrames={B_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        schema={caregiverSchema}
        defaultProps={CAREGIVER_DEFAULTS}
      />
    </>
  );
};
