import { describe, it, expect } from "vitest";
import {
  isVisitor,
  resolveDisplayName,
  truncateWallet,
} from "@/lib/profile/display-name";

describe("truncateWallet", () => {
  it("returns short form with ellipsis", () => {
    expect(truncateWallet("0x0924abcdef1234567890abcdef1234567890eba4")).toBe("0x0924…eba4");
  });
  it("returns empty string when address is undefined", () => {
    expect(truncateWallet(undefined)).toBe("");
  });
});

describe("resolveDisplayName", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("returns custom name when present", () => {
    expect(resolveDisplayName({ address: wallet, customName: "Akawolf" })).toBe("Akawolf");
  });

  it("returns Talent Protocol name when no custom", () => {
    expect(
      resolveDisplayName({ address: wallet, talentProtocolName: "wolfcito.eth" }),
    ).toBe("wolfcito.eth");
  });

  it("custom name takes precedence over Talent Protocol", () => {
    expect(
      resolveDisplayName({
        address: wallet,
        customName: "Akawolf",
        talentProtocolName: "wolfcito.eth",
      }),
    ).toBe("Akawolf");
  });

  it("falls back to truncated wallet", () => {
    expect(resolveDisplayName({ address: wallet })).toBe("0x0924…eba4");
  });

  it("uses generatedNickname over truncated wallet when present", () => {
    expect(
      resolveDisplayName({ address: wallet, generatedNickname: "Golden Knight #4821" }),
    ).toBe("Golden Knight #4821");
  });

  it("custom name and Talent still win over generatedNickname", () => {
    expect(
      resolveDisplayName({
        address: wallet,
        customName: "Akawolf",
        generatedNickname: "Golden Knight #4821",
      }),
    ).toBe("Akawolf");
    expect(
      resolveDisplayName({
        address: wallet,
        talentProtocolName: "wolfcito.eth",
        generatedNickname: "Golden Knight #4821",
      }),
    ).toBe("wolfcito.eth");
  });

  it("ignores an empty generatedNickname and falls back to wallet", () => {
    expect(
      resolveDisplayName({ address: wallet, generatedNickname: "  " }),
    ).toBe("0x0924…eba4");
  });

  it("returns default Visitor label when address is undefined", () => {
    expect(resolveDisplayName({ address: undefined })).toBe("Visitor");
  });

  it("respects an injected visitorLabel (locale-aware override)", () => {
    expect(resolveDisplayName({ address: undefined }, "Visitante")).toBe(
      "Visitante",
    );
  });

  it("trims custom name and rejects empty string", () => {
    expect(resolveDisplayName({ address: wallet, customName: "  " })).toBe("0x0924…eba4");
  });
});

describe("isVisitor", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("returns true when address is undefined", () => {
    expect(isVisitor({ address: undefined })).toBe(true);
  });

  it("returns false when address is present, regardless of custom name", () => {
    expect(isVisitor({ address: wallet })).toBe(false);
    expect(isVisitor({ address: wallet, customName: "Akawolf" })).toBe(false);
  });
});
