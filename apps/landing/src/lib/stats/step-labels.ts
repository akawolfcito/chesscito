import type { StatsLocale } from "./locale";

/**
 * Editorial labels for the activation and access step keys.
 *
 * ⛔ **The technical key never reaches the screen.** The RPCs return
 * `app_opened` / `web_access_gate_viewed` because that is what the event stream
 * is called; a reader of a public page has no reason to learn the event schema,
 * and `first_exercise_completed` with the underscores showing reads as a leaked
 * internal, not as a metric.
 *
 * The translation lives HERE, in presentation:
 *  - the eight RPCs are not touched;
 *  - the aggregator does not rewrite the keys either — it passes them through
 *    verbatim, so `dataIntegrity`, tests and any future export keep speaking
 *    the schema's language.
 *
 * ⚠️ An UNKNOWN key must never be printed literally. A step added to the funnel
 * later would otherwise ship its raw name to production the day it lands. It
 * falls back to a neutral label instead, in the reader's language.
 */

/** Every step this page knows how to name. Adding one to a funnel without
 *  adding it here is caught by a test that walks this list. */
export const ACTIVATION_STEP_KEYS = [
  "app_opened",
  "hub_viewed",
  "exercise_started",
  "exercise_completed",
  "daily_focus_completed",
] as const;

/**
 * ⚠️ The first key is **`gate_viewed`**, not `web_access_gate_viewed`.
 *
 * `web_access_gate_viewed` is the raw ANALYTICS EVENT the SQL selects the
 * cohort from; `gate_viewed` is the STEP LABEL the RPC emits
 * (`select 1 as ord, 'gate_viewed'::text as step` — migration line 295). They
 * are not the same string, and mapping only the event name silently rendered
 * "Unknown step" on the first checkpoint of a public page.
 *
 * Both are listed: the event name is harmless to map and covers a future
 * rename. `steps-match-migration.test.ts` reads the migration and fails if the
 * literals ever drift again.
 */
export const ACCESS_STEP_KEYS = [
  "gate_viewed",
  "web_access_gate_viewed",
  "login_started",
  "login_succeeded",
  "wallet_ready",
  "first_exercise_completed",
] as const;

export type ActivationStepKey = (typeof ACTIVATION_STEP_KEYS)[number];
export type AccessStepKey = (typeof ACCESS_STEP_KEYS)[number];
export type StepKey = ActivationStepKey | AccessStepKey;

type StepLabels = Record<StepKey, string>;

const EN: StepLabels = {
  app_opened: "App opened",
  hub_viewed: "Hub viewed",
  exercise_started: "Exercise started",
  exercise_completed: "Exercise completed",
  daily_focus_completed: "Daily focus completed",
  gate_viewed: "Access screen viewed",
  web_access_gate_viewed: "Access screen viewed",
  login_started: "Sign-in started",
  login_succeeded: "Sign-in completed",
  wallet_ready: "Wallet ready",
  first_exercise_completed: "First exercise completed",
};

const ES: StepLabels = {
  app_opened: "App abierta",
  hub_viewed: "Centro visto",
  exercise_started: "Ejercicio iniciado",
  exercise_completed: "Ejercicio completado",
  daily_focus_completed: "Enfoque diario completado",
  gate_viewed: "Pantalla de acceso vista",
  web_access_gate_viewed: "Pantalla de acceso vista",
  login_started: "Inicio de sesión comenzado",
  login_succeeded: "Inicio de sesión completado",
  wallet_ready: "Wallet lista",
  first_exercise_completed: "Primer ejercicio completado",
};

export const STEP_LABELS: Record<StatsLocale, StepLabels> = { en: EN, es: ES };

/** Shown instead of an unrecognised key. Neutral on purpose: it says the page
 *  does not know this step, not that the step failed. */
export const UNKNOWN_STEP_LABEL: Record<StatsLocale, string> = {
  en: "Unknown step",
  es: "Paso desconocido",
};

/**
 * Key → label. Anything not in the map returns the fallback, so a raw
 * `snake_case` name can never reach the screen.
 */
export function stepLabel(key: string, locale: StatsLocale): string {
  const table = STEP_LABELS[locale] ?? EN;
  return table[key as StepKey] ?? UNKNOWN_STEP_LABEL[locale] ?? UNKNOWN_STEP_LABEL.en;
}
