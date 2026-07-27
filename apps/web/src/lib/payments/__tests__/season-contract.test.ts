import { describe, expect, it } from "vitest";

import { getSeasonPass, SEASON_PASSES } from "@/lib/payments/rail-config";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";

/**
 * El contrato de la temporada, fijado a propósito con literales.
 *
 * Spec: docs/specs/2026-07-27-focus-days-window-21-in-30.md (AC11, AC13).
 *
 * Este archivo es deliberadamente rígido. Una temporada futura con otros
 * números DEBE tocarlo, y ese toque es la revisión: convierte un cambio
 * silencioso de constante en un CI rojo. No "arreglarlo" leyendo la config
 * que pretende vigilar — eso lo volvería una tautología.
 */

const PASS = getSeasonPass("lite_season_pass_21");

describe("AC13 · contrato de la temporada 21-en-30", () => {
  it("la meta son 21 Focus Days", () => {
    expect(PASS.challengeGoalDays).toBe(21);
  });

  it("la ventana de acceso son 30 días", () => {
    expect(PASS.accessDurationDays).toBe(30);
  });

  it("la meta cabe en la ventana, y no la iguala", () => {
    // Igualarlas es el bug original: sin margen, un solo salteo vuelve el
    // desafío incompletable. Que sean distintas ES la feature.
    expect(PASS.challengeGoalDays).toBeLessThan(PASS.accessDurationDays);
  });

  it("el precio y el bonus no cambiaron con la ventana", () => {
    // El spec lo declara non-goal: más aire, no más producto.
    expect(PASS.priceUsd6).toBe(990_000n);
    expect(PASS.shieldsOnPurchase).toBe(3);
  });
});

describe("AC11 · sku y seasonId son identificadores, nunca copy", () => {
  const IDENTIFIERS = ["lite_season_pass_21", "21day-mind-challenge-2026-q3"];

  /** Toda cadena del bundle, recorriendo objetos anidados. */
  function collectStrings(node: unknown, out: string[] = []): string[] {
    if (typeof node === "string") {
      out.push(node);
    } else if (node && typeof node === "object") {
      for (const value of Object.values(node)) collectStrings(value, out);
    }
    return out;
  }

  for (const [locale, bundle] of [
    ["en", enMessages],
    ["es", esMessages],
  ] as const) {
    it(`ningún mensaje de ${locale} contiene un identificador interno`, () => {
      const strings = collectStrings(bundle);
      // Sanity: si el recorrido devolviera vacío, el test pasaría sin mirar nada.
      expect(strings.length).toBeGreaterThan(100);

      const leaked = strings.filter((s) =>
        IDENTIFIERS.some((id) => s.includes(id)),
      );
      expect(leaked).toEqual([]);
    });
  }

  it("siguen siendo exactamente los mismos en la config (regresión)", () => {
    // Renombrarlos rompe historia: viajan en filas de settlement ya escritas.
    // Que digan "21" está bien mientras nadie los muestre — eso es lo de arriba.
    expect(SEASON_PASSES.lite_season_pass_21.sku).toBe("lite_season_pass_21");
    expect(SEASON_PASSES.lite_season_pass_21.seasonId).toBe(
      "21day-mind-challenge-2026-q3",
    );
  });
});
