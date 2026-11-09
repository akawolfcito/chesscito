/**
 * Phase D presentation rules: locale resolution, copy parity, the em-dash
 * contract, and the filter/locale separation.
 *
 * These are the rules that turn a correct number into a number the reader can
 * trust — and every one of them has a matching defect in this project's
 * history.
 */
import { describe, expect, it } from "vitest";

import { buildStatsHref } from "@/components/stats/filter-chips";
import { EM_DASH, formatCount, statsCopy, STATS_COPY } from "../copy";
import { parseStatsFilters } from "../filters";
import { DEFAULT_STATS_LOCALE, resolveStatsLocale, STATS_LOCALES } from "../locale";

describe("locale resolution", () => {
  it("an explicit ?locale wins over the header", () => {
    expect(resolveStatsLocale("es", "en-US,en;q=0.9")).toBe("es");
    expect(resolveStatsLocale("en", "es-ES")).toBe("en");
  });

  it("falls back to Accept-Language, honouring its order", () => {
    expect(resolveStatsLocale(undefined, "es-419,es;q=0.9,en;q=0.8")).toBe("es");
    expect(resolveStatsLocale(undefined, "en-GB,en;q=0.9,es;q=0.8")).toBe("en");
  });

  it("matches on the base tag, not the region", () => {
    expect(resolveStatsLocale(undefined, "es-CO")).toBe("es");
  });

  it("skips languages we do not serve instead of defaulting early", () => {
    expect(resolveStatsLocale(undefined, "fr-FR,de;q=0.9,es;q=0.8")).toBe("es");
  });

  it("an unknown ?locale falls through to the header, it does not error", () => {
    // A bad query param must never be able to blank a public page.
    expect(resolveStatsLocale("klingon", "es-ES")).toBe("es");
    expect(resolveStatsLocale("", "es-ES")).toBe("es");
  });

  it("defaults to English with no signal at all", () => {
    expect(resolveStatsLocale(undefined, null)).toBe(DEFAULT_STATS_LOCALE);
    expect(resolveStatsLocale(undefined, "")).toBe("en");
  });

  it("takes the first value of a repeated param", () => {
    expect(resolveStatsLocale(["es", "en"], null)).toBe("es");
  });
});

describe("locale is presentation, never data", () => {
  it("parseStatsFilters ignores locale entirely", () => {
    const filters = parseStatsFilters({
      surface: "learn",
      container: "minipay",
      // @ts-expect-error — proving locale is not part of the filter contract
      locale: "es",
    });
    expect(filters).toEqual({ surface: "learn", container: "minipay" });
    expect(Object.keys(filters).sort()).toEqual(["container", "surface"]);
  });
});

describe("copy", () => {
  it("EN and ES have identical key sets", () => {
    // A missing key renders `undefined` on a public page — the failure mode a
    // top-level spread already produced once, printing raw key paths.
    expect(Object.keys(STATS_COPY.es).sort()).toEqual(Object.keys(STATS_COPY.en).sort());
  });

  it("no string is empty in either language", () => {
    for (const locale of STATS_LOCALES) {
      for (const [key, value] of Object.entries(STATS_COPY[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("never says on-chain, NFT or mint — the language brief", () => {
    for (const locale of STATS_LOCALES) {
      const all = Object.values(STATS_COPY[locale]).join(" ").toLowerCase();
      expect(all).not.toMatch(/on-chain|onchain/);
      expect(all).not.toMatch(/\bnft\b/);
      expect(all).not.toMatch(/\bmint(s|ed|ing)?\b/);
    }
  });

  it("says Saved on Celo instead", () => {
    expect(statsCopy("en").sectionCelo).toBe("Saved on Celo");
    expect(statsCopy("es").sectionCelo).toBe("Guardado en Celo");
  });

  it("carries the surface-null explanation in both languages", () => {
    expect(statsCopy("en").surfaceNullNote).toContain("lower than Total");
    expect(statsCopy("es").surfaceNullNote).toContain("menor que el Total");
  });

  it("says the access block is not a strict funnel", () => {
    expect(statsCopy("en").accessNote).toMatch(/not a strict funnel/i);
    expect(statsCopy("es").accessNote).toMatch(/no un embudo estricto/i);
  });

  it("labels app-open rows as approximate and says why", () => {
    expect(statsCopy("en").approximateNote).toMatch(/duplicates/i);
    expect(statsCopy("es").approximateNote).toMatch(/duplicados/i);
  });
});

describe("null renders as an em-dash and zero does not", () => {
  it("null and undefined become the dash", () => {
    expect(formatCount(null, "en")).toBe(EM_DASH);
    expect(formatCount(undefined, "en")).toBe(EM_DASH);
  });

  it("a real zero prints as 0", () => {
    // ⛔ The whole point. A zero asserts "nobody did this"; a dash says "we
    // could not measure this". Collapsing them is the defect.
    expect(formatCount(0, "en")).toBe("0");
    expect(formatCount(0, "es")).toBe("0");
  });

  it("NaN is treated as unmeasured, not printed", () => {
    expect(formatCount(Number.NaN, "en")).toBe(EM_DASH);
  });

  it("formats thousands per locale", () => {
    // ⚠️ Five digits, not four, on purpose: `es-ES` does NOT group a bare
    // four-digit number (`4670`, not `4.670`), so a 4-digit fixture would
    // assert a separator the locale never emits.
    expect(formatCount(16255, "en")).toBe("16,255");
    expect(formatCount(16255, "es")).toBe("16.255");
  });
});

describe("filter links", () => {
  it("omit `all` so the canonical URL stays clean", () => {
    expect(buildStatsHref({ surface: "all", container: "all" }, null)).toBe("/stats");
  });

  it("preserve the OTHER filter when one changes", () => {
    // Picking a product must not silently drop the app filter.
    expect(buildStatsHref({ surface: "play", container: "minipay" }, null)).toBe(
      "/stats?surface=play&container=minipay",
    );
  });

  it("carry an explicit locale across navigation", () => {
    expect(buildStatsHref({ surface: "learn", container: "all" }, "es")).toBe(
      "/stats?surface=learn&locale=es",
    );
  });

  it("do NOT add a locale that was never chosen", () => {
    // Otherwise every shared link becomes a language lock.
    expect(buildStatsHref({ surface: "learn", container: "all" }, null)).toBe(
      "/stats?surface=learn",
    );
  });

  it("never emit a locale-prefixed path", () => {
    for (const surface of ["all", "learn", "play"] as const) {
      const href = buildStatsHref({ surface, container: "all" }, "es");
      expect(href.startsWith("/stats")).toBe(true);
      expect(href).not.toMatch(/^\/(en|es)\//);
    }
  });
});

describe("invalid filters collapse to all", () => {
  it("an unknown value never reaches a query", () => {
    expect(parseStatsFilters({ surface: "'; drop table", container: "nope" })).toEqual({
      surface: "all",
      container: "all",
    });
  });
});
