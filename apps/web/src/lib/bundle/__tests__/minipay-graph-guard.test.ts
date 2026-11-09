/**
 * Spec: docs/specs/2026-08-07-wallet-branch-lazy-load.md — AC9–AC14.
 *
 * The LOGIC of the bundle guard is tested here, with synthetic chunks, so it
 * runs in the normal suite and needs no build. The runner that reads a real
 * `.next` lives in `scripts/check-minipay-bundle.mjs` and is invoked by
 * `pnpm bundle:guard` — deliberately NOT a `*.test.ts`, because vitest's include
 * globs would collect it and it would then run against whatever stale `.next`
 * happened to be on disk (open question from 2026-08-07, closed here).
 *
 * ⚠️ Every fixture below is written in the form the MINIFIER actually emits,
 * copied from a real build (`"data-wallet-branch":"privy"`). A guard tested
 * against pretty-printed JSX passes forever and protects nothing.
 */
import { describe, expect, it } from "vitest";

import {
  auditMiniPayGraph,
  collectMiniPayGraph,
  findPrivyEvidence,
} from "@/lib/bundle/minipay-graph-guard";

/** The real emitted shape of the Privy branch's marker, from
 *  `.next/static/chunks/6882.c8dff0d8a75eaf75.js` (build of 2026-08-07). */
const PRIVY_CHUNK = `n}=e,t=(0,N.X)("brand.title-login");return(0,r.jsx)("div",{"data-wallet-branch":"privy",style:{display:"contents"},children:...`;
const INJECTED_CHUNK = `function b(n){let{children:t}=n;return(0,u.jsx)("div",{"data-wallet-branch":"injected",style:{display:"contents"},children:...`;
/** The shared chunk the hub legitimately needs: `lib/claims/sources.ts` reads
 *  contracts through wagmi/viem and is NOT part of either branch (AC13). */
const SHARED_WAGMI_CHUNK = `import{readContract as e}from"wagmi/actions";const t=viem.parseAbi(...);`;

describe("findPrivyEvidence — code that is alive, never names", () => {
  it("finds the branch marker in the form the minifier emits", () => {
    expect(findPrivyEvidence(PRIVY_CHUNK)?.kind).toBe("branch-marker");
  });

  it("tolerates the quoting and spacing a different minifier could produce", () => {
    expect(findPrivyEvidence(`{'data-wallet-branch' : 'privy'}`)?.kind).toBe(
      "branch-marker",
    );
  });

  it("finds bundled Privy package code as secondary evidence", () => {
    expect(findPrivyEvidence(`e.exports=require("@privy-io/react-auth")`)?.kind).toBe(
      "privy-package",
    );
  });

  it("does NOT flag the injected branch", () => {
    expect(findPrivyEvidence(INJECTED_CHUNK)).toBeNull();
  });

  it("does NOT flag shared wagmi/viem — the hub needs it for claims (AC13)", () => {
    expect(findPrivyEvidence(SHARED_WAGMI_CHUNK)).toBeNull();
  });

  it("does NOT flag the bare word, which is not evidence of anything", () => {
    // A component name, a comment or a copy string containing "privy" must not
    // turn the guard red: the whole point of C4 is evidence, not vocabulary.
    expect(findPrivyEvidence(`const privyEnabled=!1;// privy branch lives lazy`)).toBeNull();
  });
});

describe("collectMiniPayGraph — what a MiniPay player statically receives", () => {
  const manifest = {
    pages: {
      "/[locale]/layout": ["static/chunks/a.js", "static/css/x.css"],
      "/[locale]/page": ["static/chunks/a.js", "static/chunks/b.js"],
      "/[locale]/exercises/page": ["static/chunks/c.js"],
      "/dev/sign-probe/page": ["static/chunks/dev.js"],
    },
  };

  it("takes every /[locale] entry — a player reaches more than the hub", () => {
    expect(collectMiniPayGraph(manifest).sort()).toEqual([
      "static/chunks/a.js",
      "static/chunks/b.js",
      "static/chunks/c.js",
    ]);
  });

  it("leaves /dev out: those are their own routes, not the shared layout (E6)", () => {
    expect(collectMiniPayGraph(manifest)).not.toContain("static/chunks/dev.js");
  });

  it("drops CSS — this guard is about JavaScript bytes", () => {
    expect(collectMiniPayGraph(manifest)).not.toContain("static/css/x.css");
  });
});

describe("auditMiniPayGraph", () => {
  const chunks: Record<string, string> = {
    "static/chunks/shared.js": SHARED_WAGMI_CHUNK,
    "static/chunks/injected.js": INJECTED_CHUNK,
    "static/chunks/privy.js": PRIVY_CHUNK,
  };
  const readChunk = (file: string) => chunks[file] ?? "";

  it("passes when the static graph carries no Privy code", () => {
    const verdict = auditMiniPayGraph({
      manifest: {
        pages: {
          "/[locale]/layout": ["static/chunks/shared.js"],
          "/[locale]/page": ["static/chunks/injected.js"],
        },
      },
      readChunk,
    });

    expect(verdict.findings).toEqual([]);
    // Inspecting zero files and calling it a pass is the failure mode this
    // guard replaces: green by absence. The count is asserted, not assumed.
    expect(verdict.inspected).toBe(2);
  });

  it("fails when the Privy branch is in the graph — the pre-split shape", () => {
    const verdict = auditMiniPayGraph({
      manifest: {
        pages: {
          "/[locale]/layout": ["static/chunks/shared.js", "static/chunks/privy.js"],
        },
      },
      readChunk,
    });

    expect(verdict.findings).toHaveLength(1);
    expect(verdict.findings[0]).toMatchObject({
      file: "static/chunks/privy.js",
      kind: "branch-marker",
    });
  });

  it("refuses to pass on an empty graph", () => {
    // A manifest with no /[locale] entry means the build is not what we think
    // it is. Zero findings over zero files must never read as success.
    const verdict = auditMiniPayGraph({ manifest: { pages: {} }, readChunk });
    expect(verdict.inspected).toBe(0);
    expect(verdict.ok).toBe(false);
  });
});
