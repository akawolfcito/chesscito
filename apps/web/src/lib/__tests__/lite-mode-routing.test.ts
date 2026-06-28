import { describe, expect, it } from "vitest";
import {
  isFullOnlyPath,
  getLiteRootTarget,
} from "@/lib/lite-mode-routing";

const LOCALES = ["en", "es"] as const;
const DEFAULT = "en";

describe("isFullOnlyPath", () => {
  it("detects /arena", () => {
    expect(isFullOnlyPath("/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /arena/subpath", () => {
    expect(isFullOnlyPath("/arena/anything", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /coach", () => {
    expect(isFullOnlyPath("/coach", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /coach/history", () => {
    expect(isFullOnlyPath("/coach/history", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /victory/[id]", () => {
    expect(isFullOnlyPath("/victory/abc123", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /shop (future route, guard noop)", () => {
    expect(isFullOnlyPath("/shop", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /pro", () => {
    expect(isFullOnlyPath("/pro", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /founder", () => {
    expect(isFullOnlyPath("/founder", LOCALES, DEFAULT)).toBe(true);
  });

  it("strips ES locale prefix before checking", () => {
    expect(isFullOnlyPath("/es/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("strips explicit EN locale prefix before checking", () => {
    expect(isFullOnlyPath("/en/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("is false for /hub", () => {
    expect(isFullOnlyPath("/hub", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /exercises", () => {
    expect(isFullOnlyPath("/exercises", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /stats", () => {
    expect(isFullOnlyPath("/stats", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /trophies", () => {
    expect(isFullOnlyPath("/trophies", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /share/score", () => {
    expect(isFullOnlyPath("/share/score", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /es/hub", () => {
    expect(isFullOnlyPath("/es/hub", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /", () => {
    expect(isFullOnlyPath("/", LOCALES, DEFAULT)).toBe(false);
  });
});

describe("getLiteRootTarget", () => {
  it("returns / for bare /arena (default locale, no prefix)", () => {
    expect(getLiteRootTarget("/arena", LOCALES, DEFAULT)).toBe("/");
  });

  it("returns /es for /es/arena", () => {
    expect(getLiteRootTarget("/es/arena", LOCALES, DEFAULT)).toBe("/es");
  });

  it("returns / for /en/arena (default locale, strip /en prefix)", () => {
    expect(getLiteRootTarget("/en/arena", LOCALES, DEFAULT)).toBe("/");
  });

  it("returns / for /coach/history", () => {
    expect(getLiteRootTarget("/coach/history", LOCALES, DEFAULT)).toBe("/");
  });

  it("returns /es for /es/coach/history", () => {
    expect(getLiteRootTarget("/es/coach/history", LOCALES, DEFAULT)).toBe("/es");
  });

  it("returns / for /victory/abc123", () => {
    expect(getLiteRootTarget("/victory/abc123", LOCALES, DEFAULT)).toBe("/");
  });
});
