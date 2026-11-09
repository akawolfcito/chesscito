import { describe, expect, it } from "vitest";

import {
  buildObservationSql,
  classifyAttempt,
  summarize,
  topCombinations,
  type AttemptRow,
} from "../no-token-observation";
import { isReadOnlySql } from "../lib/read-only-guard";

const attempt = (
  read_usdc: string | null,
  read_usdt: string | null,
  read_cusd: string | null,
  extra: Partial<AttemptRow> = {},
): AttemptRow => ({
  row_tag: "aaaaaaaa",
  at: "2026-08-17T05:35:59Z",
  raw_rows: 1,
  distinct_combos: 1,
  read_usdc,
  read_usdt,
  read_cusd,
  ...extra,
});

describe("buildObservationSql", () => {
  it("passes the read-only guard the monitor already uses", () => {
    // It runs against PRODUCTION. If this ever stops holding, the tool must not ship.
    expect(isReadOnlySql(buildObservationSql(1))).toBe(true);
  });

  it("selects only instrumented rows, so no pre-deploy row can dilute the window", () => {
    // Self-selecting on the key instead of a hardcoded deploy date: the old
    // build never emitted `read_usdc`, so it can never enter the denominator.
    expect(buildObservationSql(1)).toContain("read_usdc");
    expect(buildObservationSql(1)).toContain("no-token");
  });

  it("carries the dedup window into the query instead of hiding it", () => {
    expect(buildObservationSql(5)).toContain("5");
  });

  it("refuses a non-positive window rather than silently grouping everything", () => {
    expect(() => buildObservationSql(0)).toThrow();
    expect(() => buildObservationSql(-1)).toThrow();
  });
});

describe("classifyAttempt — precedence is deliberate", () => {
  it("a PAYABLE token that was still blocked outranks everything: it is a bug", () => {
    expect(classifyAttempt(attempt("success:payable", "failure", "absent"))).toBe(
      "payable_blocked",
    );
  });

  it("any failure outranks absent, because it names a different cause", () => {
    expect(classifyAttempt(attempt("failure", "absent", "absent"))).toBe("any_failure");
  });

  it("all three absent is its own outcome", () => {
    expect(classifyAttempt(attempt("absent", "absent", "absent"))).toBe("all_absent");
  });

  it("all read, none payable → the gate is seeing a real empty wallet", () => {
    expect(classifyAttempt(attempt("success:zero", "success:dust", "success:zero"))).toBe(
      "all_success_under",
    );
    expect(
      classifyAttempt(attempt("success:zero", "success:under_price", "success:zero")),
    ).toBe("all_success_under");
  });

  it("a mix of read and absent is NOT collapsed into either", () => {
    // ⛔ The founder's rule: do not collapse mixed states prematurely.
    expect(classifyAttempt(attempt("absent", "success:zero", "success:under_price"))).toBe(
      "mixed_other",
    );
  });

  it("a missing key is treated as absent, never as a successful zero", () => {
    expect(classifyAttempt(attempt(null, null, null))).toBe("all_absent");
  });
});

describe("summarize", () => {
  const rows: AttemptRow[] = [
    attempt("success:zero", "success:zero", "success:zero"),
    attempt("success:zero", "success:dust", "success:zero", { row_tag: "bbbbbbbb", raw_rows: 3 }),
    attempt("absent", "absent", "absent", { row_tag: "cccccccc" }),
    attempt("failure", "success:zero", "absent", { row_tag: "dddddddd" }),
  ];

  it("counts raw rows and deduplicated attempts separately", () => {
    // 200 raw rows are NOT 200 attempts — the whole reason this tool exists.
    const s = summarize(rows);
    expect(s.rawRows).toBe(6);
    expect(s.attempts).toBe(4);
    expect(s.wallets).toBe(4);
  });

  it("reports each outcome with its share of ATTEMPTS, not of rows", () => {
    const s = summarize(rows);
    const under = s.outcomes.find((o) => o.outcome === "all_success_under");
    expect(under?.attempts).toBe(2);
    expect(under?.pctAttempts).toBe(50);
  });

  it("flags a payable-but-blocked attempt as the P0 it is", () => {
    const s = summarize([...rows, attempt("success:payable", "absent", "absent", { row_tag: "e" })]);
    expect(s.payableBlocked).toBe(1);
  });

  it("says nothing dominates when nothing passes half the attempts", () => {
    expect(summarize(rows).dominant).toBeNull();
  });

  it("names a dominant outcome only above half the attempts", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      attempt("success:zero", "success:zero", "success:zero", { row_tag: `w${i}` }),
    );
    expect(summarize(many).dominant).toBe("all_success_under");
  });

  it("counts a wallet once even when it produced several attempts", () => {
    const s = summarize([
      attempt("absent", "absent", "absent", { row_tag: "same" }),
      attempt("absent", "absent", "absent", { row_tag: "same", at: "2026-08-17T06:00:00Z" }),
    ]);
    expect(s.attempts).toBe(2);
    expect(s.wallets).toBe(1);
  });

  it("surfaces attempts whose burst held DIFFERENT reads — the window may be too wide", () => {
    const s = summarize([attempt("absent", "absent", "absent", { distinct_combos: 2 })]);
    expect(s.suspiciousMerges).toBe(1);
  });

  it("an empty window is not an error and not a verdict", () => {
    const s = summarize([]);
    expect(s.attempts).toBe(0);
    expect(s.dominant).toBeNull();
  });
});

describe("topCombinations", () => {
  it("ranks the exact three-token combinations, most common first", () => {
    const rows: AttemptRow[] = [
      attempt("success:zero", "success:zero", "success:zero"),
      attempt("success:zero", "success:zero", "success:zero", { row_tag: "b" }),
      attempt("absent", "absent", "absent", { row_tag: "c" }),
    ];
    const top = topCombinations(rows, 5);
    expect(top[0]).toMatchObject({
      read_usdc: "success:zero",
      read_usdt: "success:zero",
      read_cusd: "success:zero",
      attempts: 2,
    });
    expect(top).toHaveLength(2);
  });

  it("does not collapse a mixed combination into a neighbouring one", () => {
    const top = topCombinations(
      [
        attempt("absent", "success:zero", "success:under_price"),
        attempt("absent", "success:zero", "success:zero", { row_tag: "b" }),
      ],
      5,
    );
    expect(top).toHaveLength(2);
  });
});
