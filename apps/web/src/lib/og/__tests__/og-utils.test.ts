import { describe, it, expect } from "vitest";
import {
  formatTime,
  clampMoves,
  clampTime,
  truncateId,
  formatPlayer,
} from "../og-utils.js";

describe("formatTime", () => {
  it("formats seconds-only time", () => {
    expect(formatTime(16000)).toEqual("0:16");
  });
  it("formats minutes and seconds", () => {
    expect(formatTime(125000)).toEqual("2:05");
  });
  it("formats zero", () => {
    expect(formatTime(0)).toEqual("0:00");
  });
  it("formats exactly 1 minute", () => {
    expect(formatTime(60000)).toEqual("1:00");
  });
});

describe("clampMoves", () => {
  it("returns number as string for normal values", () => {
    expect(clampMoves(7)).toEqual("7");
  });
  it("returns zero as string", () => {
    expect(clampMoves(0)).toEqual("0");
  });
  it("returns 999 as string", () => {
    expect(clampMoves(999)).toEqual("999");
  });
  it("clamps values above 999", () => {
    expect(clampMoves(1000)).toEqual("999+");
  });
  it("clamps extreme values", () => {
    expect(clampMoves(65535)).toEqual("999+");
  });
});

describe("clampTime", () => {
  it("returns normal time as-is", () => {
    expect(clampTime(16000)).toEqual("0:16");
  });
  it("clamps time at 99:59 boundary", () => {
    expect(clampTime(5999000)).toEqual("99:59");
  });
  it("clamps time above boundary", () => {
    expect(clampTime(6000000)).toEqual("99:59");
  });
  it("clamps extreme time", () => {
    expect(clampTime(4294967295)).toEqual("99:59");
  });
});

describe("truncateId", () => {
  it("returns short IDs unchanged", () => {
    expect(truncateId("42")).toEqual("42");
  });
  it("returns 10-digit IDs unchanged", () => {
    expect(truncateId("1234567890")).toEqual("1234567890");
  });
  it("truncates IDs over 10 digits", () => {
    expect(truncateId("12345678901")).toEqual("1234567890\u2026");
  });
  it("truncates very long IDs", () => {
    expect(truncateId("123456789012345678901234567890")).toEqual("1234567890\u2026");
  });
});

describe("formatPlayer", () => {
  it("formats full address", () => {
    expect(formatPlayer("0xA3b2C1d4E5f6A7B8C9D0E1F2A3B4C5D6E7F8A99F")).toEqual("0xA3b2\u2026A99F");
  });
  it("handles short address gracefully", () => {
    expect(formatPlayer("0x1234")).toEqual("0x1234");
  });
});
