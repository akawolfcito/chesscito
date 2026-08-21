import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concat, decodeFunctionData, encodeFunctionData, getAddress } from "viem";
import { fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";

import { erc20Abi } from "@/lib/contracts/tokens";
import {
  CELO_ATTRIBUTION_ENV_VAR,
  getChesscitoAttributionSuffix,
  isAttributionConfigured,
  resetAttributionCacheForTests,
  withChesscitoAttribution,
} from "@/lib/payments/attribution";

/**
 * ⛔ THE REAL ISSUED CODE APPEARS NOWHERE IN THIS FILE, AND NOWHERE IN THE REPO.
 *
 * `celo_deadbeef` is structurally valid — the issued format is `celo_` followed
 * by 8 hex characters — and is obviously fake to any reader. AT-9 below scans
 * tracked source for anything that looks like an issued code and fails if it
 * finds one that is not on this file's allow-list.
 */
const FAKE_CODE = "celo_deadbeef";
const OTHER_FAKE_CODE = "celo_0badcafe";

const TREASURY = "0x1234567890abcdef1234567890abcdef12345678" as const;
const AMOUNT = 50_000n; // $0.05 in a 6-decimal stablecoin — the smoke amount.

const WEB_SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(WEB_SRC, rel), "utf8");

/** Every production file that builds a Chesscito-originated Celo write. */
const WRITE_PATH_FILES = [
  "lib/payments/use-payment-rail.ts",
  "lib/pro/use-pro-rail.ts",
  "lib/season-pass/use-season-pass-rail.ts",
  "lib/coach/use-mint-victory.ts",
  "lib/shop/use-shop-sheet-state.ts",
  "components/exercises/exercises-screen.tsx",
  "components/profile/profile-sheet.tsx",
] as const;

/**
 * ⛔ `vi.stubEnv`, NOT a raw environment write.
 *
 * The environment is PROCESS-global, and vitest isolates modules per file but
 * not that. A raw write leaks into every other suite sharing the worker —
 * invisible under the default parallel pool, and a source of phantom failures
 * the moment anyone runs `--no-file-parallelism`. `vi.unstubAllEnvs()` restores
 * whatever was really there, including after a throw.
 */
const TAG_VAR = "NEXT_PUBLIC_CELO_ATTRIBUTION_TAG";

function setTag(value: string | undefined) {
  vi.stubEnv(TAG_VAR, value as string);
  resetAttributionCacheForTests();
}

beforeEach(() => setTag(FAKE_CODE));
afterEach(() => {
  vi.unstubAllEnvs();
  // The module memo is process-global too, and it is holding the FAKE code.
  resetAttributionCacheForTests();
  vi.restoreAllMocks();
});

describe("AT-1 — a configured issued-style code produces a suffix", () => {
  it("encodes through the official package", () => {
    const suffix = getChesscitoAttributionSuffix();
    expect(suffix).toBeDefined();
    expect(suffix).toBe(toDataSuffix(FAKE_CODE));
    expect(suffix).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("round-trips back to the configured code and nothing else", () => {
    const decoded = fromDataSuffix(getChesscitoAttributionSuffix()!);
    expect(decoded).not.toBeNull();
    expect(decoded!.codes).toEqual([FAKE_CODE]);
  });

  it("is deterministic and memoised", () => {
    expect(getChesscitoAttributionSuffix()).toBe(getChesscitoAttributionSuffix());
  });

  it("ignores surrounding whitespace, which .env files collect", () => {
    setTag(`  ${FAKE_CODE}  `);
    expect(getChesscitoAttributionSuffix()).toBe(toDataSuffix(FAKE_CODE));
  });

  it("is SSR-safe: it reads no browser global", () => {
    // Comments stripped first: this is a claim about the CODE, and the module's
    // own header documents the ban by naming the things it bans.
    const source = read("lib/payments/attribution.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bnavigator\b|localStorage/);
  });
});

describe("AT-2 — missing config follows the chosen behaviour", () => {
  /** ⛔ NEVER THROW FROM A TRANSACTION PATH. A metadata mistake must not become
   *  a player who cannot pay; attribution is worth nothing next to that. */
  it("returns undefined and does not throw when unset", () => {
    setTag(undefined);
    expect(() => getChesscitoAttributionSuffix()).not.toThrow();
    expect(getChesscitoAttributionSuffix()).toBeUndefined();
    expect(isAttributionConfigured()).toBe(false);
  });

  it("returns undefined and does not throw when malformed", () => {
    setTag("NOT A VALID CODE!!!");
    expect(() => getChesscitoAttributionSuffix()).not.toThrow();
    expect(getChesscitoAttributionSuffix()).toBeUndefined();
  });

  it("treats an empty string as unset", () => {
    setTag("   ");
    expect(getChesscitoAttributionSuffix()).toBeUndefined();
  });

  it("leaves the request completely untouched when unconfigured", () => {
    setTag(undefined);
    const request = { address: TREASURY, functionName: "transfer", args: [1, 2] };
    const out = withChesscitoAttribution(request);
    expect(out).toEqual(request);
    expect("dataSuffix" in out).toBe(false);
  });

  it("is silent outside production — an unconfigured tag is normal locally", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setTag(undefined);
    getChesscitoAttributionSuffix();
    expect(warn).not.toHaveBeenCalled();
  });

  it("reports the VARIABLE NAME and never a value", () => {
    const source = read("lib/payments/attribution.ts");
    // ⛔ No interpolation of the raw tag into any log, ever.
    expect(source).not.toMatch(/console\.\w+\([^)]*\braw\b/);
    expect(source).toContain("CELO_ATTRIBUTION_ENV_VAR");
    expect(CELO_ATTRIBUTION_ENV_VAR).toBe("NEXT_PUBLIC_CELO_ATTRIBUTION_TAG");
  });
});

describe("AT-3 — a tagged ERC20 transfer moves exactly the same money", () => {
  const canonical = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [TREASURY, AMOUNT],
  });
  /* ⚠️ Derived INSIDE each test, never in the describe body. The previous shape
     built `tagged` at collection time — which runs before any `beforeEach` — so
     it had to write the environment behind the fixture's back, and that write
     outlived this file. `toDataSuffix` is pure, so deriving per test is free. */
  const getSuffix = () => getChesscitoAttributionSuffix()!;
  const taggedCalldata = () => concat([canonical, getSuffix()]);

  it("decodes to the same function, recipient and amount", () => {
    const base = decodeFunctionData({ abi: erc20Abi, data: canonical });
    const withTag = decodeFunctionData({ abi: erc20Abi, data: taggedCalldata() });
    expect(withTag.functionName).toBe(base.functionName);
    expect(withTag.functionName).toBe("transfer");
    expect(withTag.args).toEqual(base.args);
    // ⚠️ viem returns the CHECKSUMMED address; the fixture above is lowercase.
    expect(withTag.args).toEqual([getAddress(TREASURY), AMOUNT]);
  });

  it("keeps the canonical calldata as an exact PREFIX", () => {
    expect(taggedCalldata().startsWith(canonical)).toBe(true);
  });

  it("differs only in trailing bytes", () => {
    expect(taggedCalldata().slice(canonical.length)).toBe(getSuffix().slice(2));
  });
});

describe("AT-4 / AT-5 — the selector and args survive; the tag is trailing only", () => {
  it.each([
    ["transfer", [TREASURY, AMOUNT]],
    ["approve", [TREASURY, 1_000_000n]],
  ] as const)("%s keeps its selector and args", (functionName, args) => {
    const canonical = encodeFunctionData({
      abi: erc20Abi,
      functionName,
      args: args as never,
    });
    const tagged = concat([canonical, getChesscitoAttributionSuffix()!]);
    // The 4-byte selector is the first 10 hex chars including "0x".
    expect(tagged.slice(0, 10)).toBe(canonical.slice(0, 10));
    const decoded = decodeFunctionData({ abi: erc20Abi, data: tagged });
    const canonicalDecoded = decodeFunctionData({ abi: erc20Abi, data: canonical });
    expect(decoded.functionName).toBe(functionName);
    // Compared against the UNTAGGED decode, so the claim is exactly "the tag
    // changes nothing" rather than "the tag matches my fixture's casing".
    expect(decoded.args).toEqual(canonicalDecoded.args);
    expect(decoded.args).toEqual([getAddress(args[0]), args[1]]);
  });

  it("uses the supported `dataSuffix` field and touches nothing else", () => {
    const request = {
      address: TREASURY,
      abi: erc20Abi,
      functionName: "transfer" as const,
      args: [TREASURY, AMOUNT] as const,
      chainId: 42220,
      account: TREASURY,
    };
    const out = withChesscitoAttribution(request);
    expect(out.dataSuffix).toBe(getChesscitoAttributionSuffix());
    // ⛔ Every economic and routing field is identical.
    for (const key of ["address", "abi", "functionName", "args", "chainId", "account"] as const) {
      expect(out[key]).toBe(request[key]);
    }
    expect(Object.keys(out).sort()).toEqual(
      [...Object.keys(request), "dataSuffix"].sort(),
    );
  });

  it("never overwrites a dataSuffix a caller set on purpose", () => {
    const explicit = toDataSuffix(OTHER_FAKE_CODE);
    expect(withChesscitoAttribution({ dataSuffix: explicit }).dataSuffix).toBe(explicit);
  });
});

describe("AT-6 — every Chesscito-owned write path is attributed", () => {
  it.each(WRITE_PATH_FILES)("%s routes its writes through the helper", (rel) => {
    expect(read(rel)).toContain("withChesscitoAttribution");
  });

  /** ⛔ THE ONE DELIBERATE EXCLUSION, pinned so it cannot become an accident.
   *  `verifyCanaryTransaction` compares the on-chain input to a re-encoded
   *  canonical transfer with STRICT EQUALITY, so a tagged canary transfer would
   *  be refused server-side AFTER the money moved. */
  it("leaves the canary rail unattributed, on purpose and in writing", () => {
    const rail = read("lib/payments/use-payment-rail.ts");
    expect(rail).toContain("const base = intent ? canonical : withChesscitoAttribution(canonical)");
    expect(rail).toMatch(/CANARY RAIL SHIPS UNATTRIBUTED/);
  });

  it("still verifies the canary by exact calldata — the reason for the exclusion", () => {
    const verifier = read("lib/payments/get-peones-canary-verifier.ts");
    expect(verifier).toContain("canonicalInput.toLowerCase() !== transaction.input.toLowerCase()");
  });
});

describe("AT-7 / AT-8 — no platform codes, no hostname derivation", () => {
  it("adds no MiniPay or other platform code anywhere", () => {
    for (const rel of [...WRITE_PATH_FILES, "lib/payments/attribution.ts"]) {
      expect(read(rel)).not.toMatch(/toDataSuffix\(\s*\[/);
      expect(read(rel)).not.toMatch(/["']minipay["']\s*[,\]]/i);
    }
  });

  it("never calls codeFromHostname in the production path", () => {
    for (const rel of [...WRITE_PATH_FILES, "lib/payments/attribution.ts"]) {
      const source = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(source).not.toContain("codeFromHostname");
    }
  });

  it("sends exactly one code", () => {
    expect(fromDataSuffix(getChesscitoAttributionSuffix()!)!.codes).toHaveLength(1);
  });
});

describe("AT-9 — no real issued code is committed", () => {
  const ALLOWED = new Set([FAKE_CODE, OTHER_FAKE_CODE]);

  /**
   * Scans every tracked source file for anything shaped like a Celo
   * attribution code. The two fakes are allow-listed; anything else is a leak,
   * and this is what turns it into a red suite instead of a public mapping.
   *
   * ⛔ THE PATTERN IS THE PACKAGE'S RULE, NOT THE GUIDE'S EXAMPLE.
   * `BUILDERS.md` illustrates issued codes as `celo_` + 8 HEX characters, and
   * an earlier version of this scanner took that literally — `celo_[0-9a-f]{8}`.
   * The code Celo actually issued to Chesscito is 13 characters beginning
   * `celo_` and is NOT all hex, so that pattern would have sailed straight past
   * the real thing: a guard that could not catch the one value it exists to
   * catch. The package accepts `[a-z0-9_]{1,32}`, so that is what is scanned.
   *
   * ⛔ IT REPORTS COUNTS AND FILE PATHS, NEVER THE MATCH. A failing assertion
   * prints its actual value, so asserting on the matched strings would dump the
   * leaked code into the CI log at exactly the moment the guard fires — the
   * guard would publish the secret it was written to protect.
   */
  it("finds no attribution-shaped code outside the test allow-list", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const tracked = execSync("git ls-files", { cwd: process.cwd(), encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx|js|mjs|json|md|template|example|yml|yaml)$/.test(f));

    const offenders: string[] = [];
    for (const file of tracked) {
      let body = "";
      try {
        body = readFileSync(join(process.cwd(), file), "utf8");
      } catch {
        continue;
      }
      for (const match of body.matchAll(/\bcelo_[a-z0-9_]{4,27}\b/g)) {
        if (!ALLOWED.has(match[0])) {
          // File path only. The value stays out of the message.
          offenders.push(file);
          break;
        }
      }
    }

    expect(
      offenders,
      "A Celo attribution code was found in tracked source. " +
        "Remove it and configure it through the environment instead.",
    ).toEqual([]);
  });

  /**
   * The guard is only worth anything if it matches the shape actually issued.
   *
   * ⚠️ The sample shapes are ASSEMBLED AT RUNTIME rather than written as
   * literals — a literal here would be a match the scanner above finds in this
   * very file, which is exactly how this test first went red. That is also the
   * proof the scanner works: the first thing it caught was its own author.
   */
  it("would catch a real issued code, not just the guide's hex example", () => {
    const pattern = /\bcelo_[a-z0-9_]{4,27}\b/;
    const shape = (body: string) => ["celo", body].join("_");

    // Non-hex bodies included on purpose: the real issued code is one.
    for (const body of ["deadbeef", "ab3x9qk2", "chesscito", "a1b2c3d4"]) {
      expect(pattern.test(shape(body))).toBe(true);
    }

    // And it must not fire on ordinary prose or identifiers.
    for (const innocent of ["celo", "celoscan", shape(""), "getCeloChain"]) {
      expect(pattern.test(innocent)).toBe(false);
    }
  });

  it("keeps the public env reference declaring the variable and EMPTY", () => {
    // `.env.template` is this repo's public env reference (CLAUDE.md).
    const template = readFileSync(join(process.cwd(), ".env.template"), "utf8");
    expect(template).toMatch(/^NEXT_PUBLIC_CELO_ATTRIBUTION_TAG=\s*$/m);
  });
});

describe("AT-10 / AT-11 / AT-12 — economics are untouched by attribution", () => {
  /* ⛔ Attribution is calldata METADATA. Nothing below is allowed to move, and
     these read the real config rather than a fixture so a regression in either
     direction goes red here. The deep suites for each of these live in
     `flexible-topup-safety.test.ts` and `canary-sku-invariants.test.ts`; this
     block is the cross-check that THIS pass did not disturb them. */

  it("AT-10: the 5-Peones flexible top-up is unchanged", async () => {
    const { getPeonesPack } = await import("@/lib/payments/rail-config");
    const { buildPeonesPackTransfer } = await import("@/lib/payments/transfer-builder");
    const { normalizePrice } = await import("@/lib/contracts/tokens");

    const pack = getPeonesPack("peones_pack_5");
    expect(pack.peonesReward).toBe(5);
    expect(pack.priceUsd6).toBe(50_000n); // $0.05

    const tx = buildPeonesPackTransfer({
      sku: "peones_pack_5",
      treasury: TREASURY,
      tokenSymbol: "USDC",
    });
    expect(tx.expectedAmount).toBe(normalizePrice(pack.priceUsd6, 6));
    // ⛔ The BUILDER stays attribution-free: the suffix is a wagmi request
    // field, never baked into the transfer's encoded data.
    expect(read("lib/payments/transfer-builder.ts")).not.toContain("Attribution");
  });

  it("AT-11: the canary SKU and reward are unchanged", async () => {
    const { GET_PEONES_CANARY_SKU, GET_PEONES_CANARY_REWARD, isCanaryEligibleSku } =
      await import("@/lib/payments/get-peones-canary");
    const { getPeonesPack } = await import("@/lib/payments/rail-config");

    expect(GET_PEONES_CANARY_SKU).toBe("peones_pack_50");
    expect(GET_PEONES_CANARY_REWARD).toBe(50);
    expect(getPeonesPack("peones_pack_50").priceUsd6).toBe(500_000n);
    expect(isCanaryEligibleSku("peones_pack_5")).toBe(false);
  });

  it("AT-12: PRO / Season Pass / mint keep their function and args", () => {
    // Attribution touches only the request wrapper, so the write sites must
    // still name the same functions they always did.
    expect(read("lib/pro/use-pro-rail.ts")).toContain('functionName: "transfer" as const');
    expect(read("lib/season-pass/use-season-pass-rail.ts")).toContain(
      'functionName: "transfer" as const',
    );
    const mint = read("lib/coach/use-mint-victory.ts");
    expect(mint).toContain('functionName: "mintSigned"');
    expect(mint).toContain('functionName: "mintSignedWithPermit"');
  });
});
