/**
 * The technical event key must never reach the screen, in either language.
 *
 * The RPCs speak the event schema (`app_opened`, `web_access_gate_viewed`)
 * because that is what the stream is called. A reader of a public page has no
 * reason to learn it, and a raw `first_exercise_completed` reads as a leaked
 * internal rather than as a metric.
 */
import { describe, expect, it } from "vitest";

import { STATS_LOCALES } from "../locale";
import {
  ACCESS_STEP_KEYS,
  ACTIVATION_STEP_KEYS,
  STEP_LABELS,
  UNKNOWN_STEP_LABEL,
  stepLabel,
} from "../step-labels";

const ALL_KEYS = [...ACTIVATION_STEP_KEYS, ...ACCESS_STEP_KEYS];

describe("coverage", () => {
  it("names every activation step the funnel can return", () => {
    expect([...ACTIVATION_STEP_KEYS]).toEqual([
      "app_opened",
      "hub_viewed",
      "exercise_started",
      "exercise_completed",
      "daily_focus_completed",
    ]);
  });

  it("names every access checkpoint, including the literal the RPC really emits", () => {
    // ⚠️ `gate_viewed` is the STEP the SQL emits; `web_access_gate_viewed` is
    // the analytics EVENT its cohort is selected from. Mapping only the second
    // printed "Unknown step" on a public page.
    expect([...ACCESS_STEP_KEYS]).toEqual([
      "gate_viewed",
      "web_access_gate_viewed",
      "login_started",
      "login_succeeded",
      "wallet_ready",
      "first_exercise_completed",
    ]);
  });

  it("EN and ES cover exactly the same keys", () => {
    expect(Object.keys(STEP_LABELS.es).sort()).toEqual(Object.keys(STEP_LABELS.en).sort());
    expect(Object.keys(STEP_LABELS.en).sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe("the exact copy", () => {
  it("is right in English", () => {
    expect(ALL_KEYS.map((k) => stepLabel(k, "en"))).toEqual([
      "App opened",
      "Hub viewed",
      "Exercise started",
      "Exercise completed",
      "Daily focus completed",
      "Access screen viewed",
      "Access screen viewed",
      "Sign-in started",
      "Sign-in completed",
      "Wallet ready",
      "First exercise completed",
    ]);
  });

  it("is right in Spanish", () => {
    expect(ALL_KEYS.map((k) => stepLabel(k, "es"))).toEqual([
      "App abierta",
      "Centro visto",
      "Ejercicio iniciado",
      "Ejercicio completado",
      "Enfoque diario completado",
      "Pantalla de acceso vista",
      "Pantalla de acceso vista",
      "Inicio de sesión comenzado",
      "Inicio de sesión completado",
      "Wallet lista",
      "Primer ejercicio completado",
    ]);
  });
});

describe("no technical key survives translation", () => {
  it("no label contains an underscore, in either language", () => {
    for (const locale of STATS_LOCALES) {
      for (const key of ALL_KEYS) {
        expect(stepLabel(key, locale), `${locale}.${key}`).not.toContain("_");
      }
    }
  });

  it("no label is simply the key back", () => {
    for (const locale of STATS_LOCALES) {
      for (const key of ALL_KEYS) {
        expect(stepLabel(key, locale).toLowerCase()).not.toBe(key.toLowerCase());
      }
    }
  });
});

describe("an unknown key", () => {
  it("falls back instead of printing itself", () => {
    // A step added to a funnel later would otherwise ship its raw name to
    // production the day it lands.
    expect(stepLabel("some_future_step", "en")).toBe("Unknown step");
    expect(stepLabel("some_future_step", "es")).toBe("Paso desconocido");
  });

  it("never leaks the key into the fallback", () => {
    for (const locale of STATS_LOCALES) {
      const out = stepLabel("brand_new_event_key", locale);
      expect(out).not.toContain("brand_new");
      expect(out).not.toContain("_");
      expect(out).toBe(UNKNOWN_STEP_LABEL[locale]);
    }
  });

  it("handles the empty string and junk without throwing", () => {
    expect(() => stepLabel("", "en")).not.toThrow();
    expect(stepLabel("", "en")).toBe("Unknown step");
    expect(stepLabel("../../etc/passwd", "es")).toBe("Paso desconocido");
  });
});
