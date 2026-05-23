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

export default messages;
