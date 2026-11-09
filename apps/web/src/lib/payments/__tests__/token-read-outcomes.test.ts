import { describe, expect, it } from "vitest";

import {
  describeTokenReads,
  selectPayableToken,
  tokenReadProps,
  type TokenBalanceInput,
  type TokenReadResult,
} from "@/lib/payments/use-get-peones-token-selection";

/**
 * Lote 1 de la pasada de evidencia (`docs/plans/2026-08-16-…-execution-plan.md`).
 *
 * La pregunta que esto contesta en producción: cuando un wallet de MiniPay toca
 * comprar PRO y le decimos "saldo insuficiente", ¿es que NO TIENE $1.99, o es que
 * la lectura de `balanceOf` falló? Hoy los dos casos —y un tercero, la lectura que
 * todavía no llegó— colapsan a `0n` y son indistinguibles.
 *
 * ⛔ `selectPayableToken` NO se toca. Sostiene el bug-fix del smoke de 2026-06-09
 * (USDC por defecto con saldo 0 → "transfer amount exceeds balance"). Esto se
 * agrega AL LADO y se prueba, explícitamente, que no mueve su resultado.
 */

const A = "0x0000000000000000000000000000000000000000";
const PRICE = 1_990_000n; // $1.99 — el precio real de PRO

const tok = (symbol: string, decimals: number): Omit<TokenBalanceInput, "balance"> => ({
  symbol,
  address: A,
  decimals,
});

/** Los tres del rail, con sus decimales REALES. cUSD a 18 es donde esto se
 *  rompe si se rompe. */
const RAIL = [tok("USDC", 6), tok("USDT", 6), tok("cUSD", 18)];

const ok = (result: bigint): TokenReadResult => ({ status: "success", result });
const failed: TokenReadResult = { status: "failure", error: new Error("rpc down") };

describe("describeTokenReads — los tres estados de la lectura", () => {
  it("distingue success, failure y absent, que hoy colapsan a 0n", () => {
    const out = describeTokenReads(PRICE, RAIL, [ok(0n), failed, undefined]);
    expect(out.map((o) => o.status)).toEqual(["success", "failure", "absent"]);
  });

  it("marca TODO absent cuando la lectura aún no llegó (data undefined)", () => {
    const out = describeTokenReads(PRICE, RAIL, undefined);
    expect(out.map((o) => o.status)).toEqual(["absent", "absent", "absent"]);
  });

  it("un índice ausente es absent, no failure — no llegó no es falló", () => {
    const out = describeTokenReads(PRICE, RAIL, [ok(0n)]);
    expect(out[1]?.status).toBe("absent");
    expect(out[2]?.status).toBe("absent");
  });

  it("un success con result que no es bigint cuenta como failure", () => {
    // No es una cuarta categoría: desde el punto de vista de quien lee el saldo,
    // una respuesta con forma inválida no produjo saldo. Sumar un estado más sólo
    // para este caso infla el vocabulario sin cambiar ninguna decisión.
    const out = describeTokenReads(PRICE, RAIL, [
      { status: "success", result: undefined },
      ok(0n),
      ok(0n),
    ]);
    expect(out[0]?.status).toBe("failure");
  });

  it("el bucket es null salvo que la lectura haya tenido éxito", () => {
    const out = describeTokenReads(PRICE, RAIL, [failed, undefined, ok(0n)]);
    expect(out[0]?.bucket).toBeNull();
    expect(out[1]?.bucket).toBeNull();
    expect(out[2]?.bucket).toBe("zero");
  });

  it("conserva el símbolo de cada token, en el orden en que se leyeron", () => {
    const out = describeTokenReads(PRICE, RAIL, [ok(0n), ok(0n), ok(0n)]);
    expect(out.map((o) => o.symbol)).toEqual(["USDC", "USDT", "cUSD"]);
  });
});

describe("describeTokenReads — fronteras de bucket, por decimales", () => {
  const bucketOf = (decimals: number, balance: bigint) =>
    describeTokenReads(PRICE, [tok("X", decimals)], [ok(balance)])[0]?.bucket;

  // 6 decimales: el precio ES 1_990_000. 1% = 19_900.
  it("6 decimales: zero en 0", () => {
    expect(bucketOf(6, 0n)).toBe("zero");
  });
  it("6 decimales: dust justo debajo del 1% del precio", () => {
    expect(bucketOf(6, 19_899n)).toBe("dust");
  });
  it("6 decimales: under_price exactamente en el 1%", () => {
    expect(bucketOf(6, 19_900n)).toBe("under_price");
  });
  it("6 decimales: under_price a un átomo del precio", () => {
    expect(bucketOf(6, 1_989_999n)).toBe("under_price");
  });
  it("6 decimales: payable exactamente en el precio", () => {
    expect(bucketOf(6, 1_990_000n)).toBe("payable");
  });

  // 18 decimales: el precio se normaliza a 1_990_000 × 1e12.
  const P18 = 1_990_000n * 10n ** 12n;
  it("18 decimales: zero en 0", () => {
    expect(bucketOf(18, 0n)).toBe("zero");
  });
  it("18 decimales: dust justo debajo del 1%", () => {
    expect(bucketOf(18, P18 / 100n - 1n)).toBe("dust");
  });
  it("18 decimales: under_price exactamente en el 1%", () => {
    expect(bucketOf(18, P18 / 100n)).toBe("under_price");
  });
  it("18 decimales: payable exactamente en el precio normalizado", () => {
    expect(bucketOf(18, P18)).toBe("payable");
  });
  it("18 decimales: un saldo que alcanzaría a 6 decimales NO alcanza a 18", () => {
    // La trampa entera de cUSD: 1_990_000 unidades son $1.99 en USDC y
    // 0.00000000000199 en cUSD. Si el bucket no normalizara, esto daría payable.
    expect(bucketOf(18, 1_990_000n)).toBe("dust");
  });

  it("un precio de 0 hace payable a cualquier saldo, incluido 0", () => {
    // Coherencia con selectPayableToken, que compara balance >= expectedAmount.
    expect(bucketOf(6, 0n)).toBe("zero");
    expect(describeTokenReads(0n, [tok("X", 6)], [ok(0n)])[0]?.bucket).toBe("payable");
  });
});

describe("describeTokenReads — invariante contra selectPayableToken", () => {
  const CASES: bigint[][] = [
    [0n, 0n, 0n],
    [1_990_000n, 0n, 0n],
    [0n, 1_990_000n, 0n],
    [0n, 0n, 1_990_000n * 10n ** 12n],
    [1n, 2n, 3n],
    [1_989_999n, 1_989_999n, 1_990_000n * 10n ** 12n - 1n],
    [10n ** 12n, 10n ** 12n, 10n ** 30n],
  ];

  it.each(CASES)(
    "el conjunto payable coincide exactamente con el de la selección (%s)",
    (...balances) => {
      const reads = describeTokenReads(
        PRICE,
        RAIL,
        balances.map((b) => ok(b)),
      );
      const { tokens } = selectPayableToken(
        PRICE,
        RAIL.map((t, i) => ({ ...t, balance: balances[i] as bigint })),
      );
      const fromReads = reads.filter((o) => o.bucket === "payable").map((o) => o.symbol);
      const fromSelection = tokens.filter((t) => t.payable).map((t) => t.symbol);
      expect([...fromReads].sort()).toEqual([...fromSelection].sort());
    },
  );

  it("una lectura fallida nunca se puede leer como payable", () => {
    // Es la confusión que motivó el lote: hoy un fallo se ve igual que un saldo 0.
    const out = describeTokenReads(PRICE, RAIL, [failed, failed, failed]);
    expect(out.every((o) => o.bucket === null)).toBe(true);
  });
});

describe("tokenReadProps — la forma que SOBREVIVE a sanitizeProps", () => {
  /**
   * ⛔ El servidor descarta en SILENCIO cualquier valor de prop que no sea
   * string/number/boolean/null: `sanitizeProps` (`app/api/telemetry/route.ts:139`)
   * itera las entradas y sólo asigna primitivos. Un array de objetos —la forma que
   * proponía el plan— se cae entero y el evento se escribe igual, sin el dato y sin
   * error. Por eso esto aplana a strings.
   */
  it("emite una clave plana por token, con valor string", () => {
    const props = tokenReadProps(
      describeTokenReads(PRICE, RAIL, [ok(0n), failed, undefined]),
    );
    expect(props).toEqual({
      read_usdc: "success:zero",
      read_usdt: "failure",
      read_cusd: "absent",
    });
  });

  it("todos los valores son primitivos que sanitizeProps conserva", () => {
    const props = tokenReadProps(describeTokenReads(PRICE, RAIL, [ok(0n), ok(0n), ok(0n)]));
    for (const value of Object.values(props)) {
      expect(typeof value).toBe("string");
    }
  });

  it("el payload serializado entra holgado en el presupuesto de 4KB", () => {
    // Medido, no estimado — es la lección de claim-telemetry.ts.
    const props = {
      kind: "no-token",
      ...tokenReadProps(describeTokenReads(PRICE, RAIL, [ok(0n), failed, undefined])),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(props)).length;
    expect(bytes).toBeLessThan(4_096);
    expect(bytes).toBeLessThan(200);
  });

  it("la cardinalidad está acotada: nunca más de una clave por token del rail", () => {
    const props = tokenReadProps(describeTokenReads(PRICE, RAIL, [ok(0n), ok(0n), ok(0n)]));
    expect(Object.keys(props)).toHaveLength(RAIL.length);
  });
});
