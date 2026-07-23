import { describe, expect, it } from "vitest";
import {
  normalizeAppVersion,
  normalizeCampaign,
  normalizeContainer,
  normalizeCountry,
  normalizeLocale,
  normalizeSource,
  normalizeSurface,
} from "../dimensions";

describe("normalizeSurface", () => {
  it("accepts learn/play/full, rejects anything else", () => {
    expect(normalizeSurface("learn")).toBe("learn");
    expect(normalizeSurface("play")).toBe("play");
    expect(normalizeSurface("full")).toBe("full");
    expect(normalizeSurface("marketing")).toBeNull();
    expect(normalizeSurface(null)).toBeNull();
    expect(normalizeSurface(42)).toBeNull();
  });
});

describe("normalizeContainer", () => {
  it("accepts only minipay/browser", () => {
    expect(normalizeContainer("minipay")).toBe("minipay");
    expect(normalizeContainer("browser")).toBe("browser");
    expect(normalizeContainer("metamask")).toBeNull();
  });
});

describe("normalizeLocale", () => {
  it("allow-lists en/es case-insensitively", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("ES")).toBe("es");
    expect(normalizeLocale("fr")).toBeNull();
    expect(normalizeLocale("english")).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("returns ISO alpha-2 upper, rejects junk / placeholders", () => {
    expect(normalizeCountry("us")).toBe("US");
    expect(normalizeCountry("BR")).toBe("BR");
    expect(normalizeCountry("XX")).toBeNull(); // edge unknown placeholder
    expect(normalizeCountry("USA")).toBeNull();
    expect(normalizeCountry("1.2.3.4")).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
  });
});

describe("normalizeAppVersion", () => {
  it("accepts short sha / dev, rejects long or symbol-laden", () => {
    expect(normalizeAppVersion("a1b2c3d")).toBe("a1b2c3d");
    expect(normalizeAppVersion("dev")).toBe("dev");
    expect(normalizeAppVersion("feature/x")).toBeNull();
    expect(normalizeAppVersion("0123456789abc")).toBeNull(); // 13 chars
  });
});

describe("normalizeSource", () => {
  it("maps aliases to canonical vocabulary", () => {
    expect(normalizeSource("minipay")).toBe("minipay_discovery");
    expect(normalizeSource("WhatsApp")).toBe("share_whatsapp");
    expect(normalizeSource("challenge")).toBe("challenge_link");
    expect(normalizeSource("qr")).toBe("qr");
    expect(normalizeSource("direct")).toBe("direct");
  });
  it("returns null when absent, unknown when present-but-unrecognized", () => {
    expect(normalizeSource(null)).toBeNull();
    expect(normalizeSource("")).toBeNull();
    expect(normalizeSource("weird-affiliate-123")).toBe("unknown");
  });
});

describe("normalizeCampaign", () => {
  it("sanitizes to a bounded slug or null", () => {
    expect(normalizeCampaign("launch_2026")).toBe("launch_2026");
    expect(normalizeCampaign("Summer-Push")).toBe("summer-push");
    expect(normalizeCampaign("drop table users;")).toBeNull();
    expect(normalizeCampaign("x".repeat(33))).toBeNull();
    expect(normalizeCampaign(null)).toBeNull();
  });
});
