/**
 * Rotation Engine — internal rollout flag (slice E, 2026-06-08).
 *
 * Default OFF so the legacy linear-senda path stays bit-identical until
 * explicitly enabled. Turn on per environment with
 * `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION=true` (dev/preview while we
 * validate). Single constant on purpose — easy to delete at cluster
 * close once rotation is the default. Do NOT build a flag framework
 * around this.
 */
export const ENABLE_EXERCISE_ROTATION =
  process.env.NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION === "true";
