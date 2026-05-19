import { describe, it, expect } from "vitest";
import { resolveDisplayName, truncateWallet } from "@/lib/profile/display-name";

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

  it("returns Visitor when address is undefined", () => {
    expect(resolveDisplayName({ address: undefined })).toBe("Visitor");
  });

  it("trims custom name and rejects empty string", () => {
    expect(resolveDisplayName({ address: wallet, customName: "  " })).toBe("0x0924…eba4");
  });
});
