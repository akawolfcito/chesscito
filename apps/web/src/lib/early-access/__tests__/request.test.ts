import { describe, expect, it } from "vitest";

import {
  EARLY_ACCESS_STATUSES,
  normalizeEarlyAccessEmail,
} from "@/lib/early-access/request";

describe("early access status vocabulary", () => {
  /** The name is the contract: `allowlisted` says an action was taken in Privy.
   *  `approved` would claim this system decided something it does not own. */
  it("has no `approved` status — Privy grants, this table records", () => {
    expect(EARLY_ACCESS_STATUSES).toEqual(["waiting", "allowlisted"]);
    expect(EARLY_ACCESS_STATUSES).not.toContain("approved");
  });
});

describe("normalizeEarlyAccessEmail", () => {
  it("lowercases and trims so one person cannot occupy two queue slots", () => {
    expect(normalizeEarlyAccessEmail("  Ana@Example.COM \n")).toBe(
      "ana@example.com",
    );
  });

  it("is idempotent on an already-normalized address", () => {
    const once = normalizeEarlyAccessEmail("ana@example.com");
    expect(normalizeEarlyAccessEmail(once)).toBe(once);
  });

  it("accepts ordinary addresses, including plus-tags and subdomains", () => {
    expect(normalizeEarlyAccessEmail("ana+chesscito@mail.example.co.uk")).toBe(
      "ana+chesscito@mail.example.co.uk",
    );
  });

  it.each([
    ["not an email", "anaexample.com"],
    ["two @", "ana@@example.com"],
    ["empty local part", "@example.com"],
    ["empty domain", "ana@"],
    ["domain without a dot", "ana@example"],
    ["inner whitespace", "an a@example.com"],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("rejects %s", (_label, input) => {
    expect(normalizeEarlyAccessEmail(input)).toBeNull();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["an object", { email: "ana@example.com" }],
    ["an array", ["ana@example.com"]],
  ])("rejects a non-string body value: %s", (_label, input) => {
    expect(normalizeEarlyAccessEmail(input)).toBeNull();
  });

  it("rejects an address longer than RFC 5321 allows on the wire", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(normalizeEarlyAccessEmail(tooLong)).toBeNull();
  });

  it("rejects a local part longer than 64 octets", () => {
    // Total stays under 254 so this can only be caught by the local-part rule.
    expect(normalizeEarlyAccessEmail(`${"a".repeat(65)}@example.com`)).toBeNull();
  });

  it("accepts a local part of exactly 64 octets", () => {
    const boundary = `${"a".repeat(64)}@example.com`;
    expect(normalizeEarlyAccessEmail(boundary)).toBe(boundary);
  });
});
