/**
 * EN message bundle for next-intl.
 *
 * Stage 2 of the i18n migration: bundles the existing editorial.ts
 * exports under a single default export so next-intl can resolve
 * messages by namespace (e.g. `t('COACH_COPY.yourSessions')` once
 * Stage 3 wires components onto `useTranslations`).
 *
 * editorial.ts remains the authoring source — every consumer still
 * imports named constants from there. This file is purely the
 * runtime bundle.
 *
 * Functions are stripped: NextIntlClientProvider is a Client
 * Component and the `messages` prop must be JSON-serializable.
 * editorial.ts exports a few computed-value helpers (e.g.
 * `submitFailed: (n) => ...`) — those stay accessible via their
 * named export from editorial.ts; they're not message-bundle
 * citizens. Stage 3 / Stage 4 will convert them to ICU
 * MessageFormat (`{count, plural, …}`) where they need to live
 * in the bundle.
 *
 * See: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md §4.2
 */
import * as editorial from "../editorial";

function stripFunctions(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function") return undefined;
  if (Array.isArray(value)) {
    return value
      .map(stripFunctions)
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripFunctions(entry);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

const messages = stripFunctions({ ...editorial }) as Record<string, unknown>;

// ICU MessageFormat overrides for helpers stripped by stripFunctions.
// These editorial.ts exports are still functions for legacy callers
// (e.g. `HUD_COPY.proRemainingFormat(5)`), but next-intl needs ICU
// template strings inside the bundle. As each consumer surface migrates
// to `useTranslations`, its helpers get an ICU mirror added here.
// See red-team M-3 (per-surface migration of helper-style copy).
// `any` is intentional: bundle keys are typed `unknown` after stripFunctions.
// `@typescript-eslint/no-explicit-any` is not configured in this project so
// the cast does not trigger a lint warning.
const m = messages as any;
m.HUD_COPY.proRemainingFormat = "{days}d";
m.TX_PROGRESS_COPY.stepCounter = "Step {current} of {total}";
m.SHARE_COPY.badge =
  "I earned the {piece} Ascendant badge on Chesscito! {stars}/15 stars — permanently on-chain.";
m.SHARE_COPY.score =
  "I just locked my Chesscito score on-chain! {stars}/15 stars — permanently recorded.";
m.SHARE_COPY.shop = "I just got {item} on Chesscito!";

export default messages;
