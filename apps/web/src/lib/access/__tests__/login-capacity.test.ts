/**
 * El tope duro de logins.
 *
 * ⚠️ Founder, 2026-08-13: *"la idea es que no tengamos costos inesperados como
 * nos pasó con la infra"*. El plan Core de Privy es gratis de 0 a 499 MAU y pasa
 * a $299/mes desde 500, y un pico orgánico cruza ese número sin que nadie
 * apriete nada.
 *
 * ⛔ La asimetría que decide todo acá: cerrar de más cuesta un usuario que se va
 * a la waitlist y al que se le puede escribir después. Abrir de más cuesta una
 * factura recurrente que sólo baja cuando esa gente deja de entrar durante 30
 * días. **Ante la duda, y sólo ante la duda de configuración, se cierra.**
 *
 * ⚠️ Ante la duda de INFRAESTRUCTURA es al revés — ver `fail-open` abajo. No es
 * una contradicción: una config rota es un error nuestro que podemos arreglar
 * antes de perder a nadie; una DB caída no debe dejar a todo el mundo afuera.
 */
import { describe, it, expect } from "vitest";
import {
  decideLoginCapacity,
  resolveCapacityEnabled,
  resolveCapacityLimit,
  DEFAULT_CAPACITY_LIMIT,
  type LoginCapacityConfig,
} from "../login-capacity";

const cfg = (over: Partial<LoginCapacityConfig> = {}): LoginCapacityConfig => ({
  limit: 460,
  enabled: true,
  ...over,
});

describe("decideLoginCapacity", () => {
  it("abre por debajo del tope", () => {
    expect(decideLoginCapacity({ browserAccounts: 5, config: cfg() })).toEqual({
      open: true,
    });
  });

  it("cierra AL llegar al tope, no después", () => {
    // 460 cuentas con tope 460 significa que el lugar 460 ya se usó.
    expect(decideLoginCapacity({ browserAccounts: 460, config: cfg() })).toEqual({
      open: false,
    });
  });

  it("sigue cerrado por encima", () => {
    expect(decideLoginCapacity({ browserAccounts: 999, config: cfg() })).toEqual({
      open: false,
    });
  });

  it("`enabled: false` reabre por completo — es el interruptor sin deploy", () => {
    expect(
      decideLoginCapacity({ browserAccounts: 10_000, config: cfg({ enabled: false }) }),
    ).toEqual({ open: true });
  });

  describe("configuración rota: se CIERRA", () => {
    // Una config inválida es un error nuestro, y el costo de equivocarse hacia
    // el lado abierto es la factura que este módulo existe para evitar.
    for (const [what, limit] of [
      ["un tope negativo", -1],
      ["un tope cero", 0],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ] as const) {
      it(`cierra con ${what}`, () => {
        expect(
          decideLoginCapacity({ browserAccounts: 0, config: cfg({ limit }) }),
        ).toEqual({ open: false });
      });
    }
  });

  describe("infraestructura caída: se ABRE (fail-open)", () => {
    // ⚠️ Al revés que arriba, y a propósito. El costo de un error acá es una
    // factura; el de fail-closed es que NADIE entre a la app. Y el allowlist
    // nativo de Privy sigue debajo como red real.
    it("abre cuando no se pudo contar", () => {
      expect(
        decideLoginCapacity({ browserAccounts: null, config: cfg() }),
      ).toEqual({ open: true });
    });

    it("abre cuando el conteo es basura", () => {
      expect(
        decideLoginCapacity({ browserAccounts: Number.NaN, config: cfg() }),
      ).toEqual({ open: true });
    });

    it("abre con un conteo negativo", () => {
      expect(
        decideLoginCapacity({ browserAccounts: -3, config: cfg() }),
      ).toEqual({ open: true });
    });
  });
});

describe("resolveCapacityLimit", () => {
  it("usa el valor configurado", () => {
    expect(resolveCapacityLimit("300")).toBe(300);
  });

  it("cae al default cuando no hay nada configurado", () => {
    expect(resolveCapacityLimit(undefined)).toBe(DEFAULT_CAPACITY_LIMIT);
    expect(resolveCapacityLimit("")).toBe(DEFAULT_CAPACITY_LIMIT);
  });

  it("cae al default ante un valor que no es un número", () => {
    expect(resolveCapacityLimit("muchos")).toBe(DEFAULT_CAPACITY_LIMIT);
  });

  it("⛔ el default deja MARGEN bajo los 499 del plan gratis", () => {
    // No es cosmético: el chequeo NO puede ser transaccional con el contador de
    // Privy, así que N visitantes simultáneos cerca del umbral pueden entrar
    // todos. El margen ES el diseño, no un redondeo.
    expect(DEFAULT_CAPACITY_LIMIT).toBeLessThan(499);
  });
});

describe("resolveCapacityEnabled", () => {
  it("⛔ viene PRENDIDO sin configuración", () => {
    // Un tope que hay que acordarse de prender no es un tope: el pico que esto
    // existe para sobrevivir es justamente el que nadie está mirando. El default
    // del límite ya es seguro (460), así que prender por defecto no cierra nada
    // que estuviera abierto.
    expect(resolveCapacityEnabled(undefined)).toBe(true);
    expect(resolveCapacityEnabled("")).toBe(true);
  });

  it("se apaga sólo si lo dicen explícitamente", () => {
    expect(resolveCapacityEnabled("false")).toBe(false);
    expect(resolveCapacityEnabled("FALSE")).toBe(false);
    expect(resolveCapacityEnabled("0")).toBe(false);
  });

  it("cualquier otro valor lo deja prendido", () => {
    // ⚠️ Hacia el lado seguro: un typo en la perilla no debe abrir la puerta de
    // par en par sin que nadie se entere.
    expect(resolveCapacityEnabled("true")).toBe(true);
    expect(resolveCapacityEnabled("sí")).toBe(true);
    expect(resolveCapacityEnabled("nope")).toBe(true);
  });
});
