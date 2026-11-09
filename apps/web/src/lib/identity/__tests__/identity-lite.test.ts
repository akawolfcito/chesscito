import { describe, expect, it } from "vitest";
import {
  PIECES,
  STYLES,
  deriveAvatarVariant,
  deriveRowId,
  formatGuestNickname,
  formatNickname,
  formatNicknameCompact,
  hashSeed,
  validateNickname,
  type NicknameTokens,
} from "../identity-lite";

// Minimal locale token fixtures (EN adjective-first, ES noun-first).
const EN: NicknameTokens = {
  pieces: {
    pawn: "Pawn",
    knight: "Knight",
    rook: "Rook",
    bishop: "Bishop",
    queen: "Queen",
    king: "King",
  },
  styles: {
    golden: "Golden",
    green: "Green",
    blue: "Blue",
    coral: "Coral",
    tropical: "Tropical",
    bright: "Bright",
  },
  guestPrefix: "Guest",
  template: "{style} {piece} #{number}",
};

const ES: NicknameTokens = {
  pieces: {
    pawn: "Peón",
    knight: "Caballo",
    rook: "Torre",
    bishop: "Alfil",
    queen: "Reina",
    king: "Rey",
  },
  styles: {
    golden: "Dorado",
    green: "Verde",
    blue: "Azul",
    coral: "Coral",
    tropical: "Tropical",
    bright: "Brillante",
  },
  guestPrefix: "Invitado",
  template: "{piece} {style} #{number}",
};

const ADDR = "0x8f3aabbccddeeff00112233445566778899aa91ab";

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = hashSeed("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("differs for different inputs", () => {
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });

  it("matches the canonical FNV-1a value for a known input", () => {
    // FNV-1a 32-bit of "a" = 0xe40c292c
    expect(hashSeed("a")).toBe(0xe40c292c);
  });
});

describe("deriveAvatarVariant", () => {
  it("is deterministic for the same seed", () => {
    expect(deriveAvatarVariant(ADDR)).toEqual(deriveAvatarVariant(ADDR));
  });

  it("never throws and stays in-range for any string", () => {
    for (const seed of ["", "x", ADDR, "guest:" + ADDR, "💥non-hex"]) {
      const v = deriveAvatarVariant(seed);
      expect(PIECES).toContain(v.piece);
      expect(STYLES).toContain(v.style);
      expect(v.number).toBeGreaterThanOrEqual(0);
      expect(v.number).toBeLessThanOrEqual(9999);
    }
  });

  it("spreads acceptably across pieces and styles (salted independence)", () => {
    const pieceCounts = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const v = deriveAvatarVariant(`0x${i.toString(16).padStart(40, "0")}`);
      pieceCounts.set(v.piece, (pieceCounts.get(v.piece) ?? 0) + 1);
      styleCounts.set(v.style, (styleCounts.get(v.style) ?? 0) + 1);
    }
    // Every piece + style appears; none collapses to <50% of a fair share.
    const fair = N / 6;
    expect(pieceCounts.size).toBe(6);
    expect(styleCounts.size).toBe(6);
    for (const c of pieceCounts.values()) expect(c).toBeGreaterThan(fair * 0.5);
    for (const c of styleCounts.values()) expect(c).toBeGreaterThan(fair * 0.5);
  });
});

describe("deriveRowId", () => {
  it("is deterministic, opaque, and leaks no wallet", () => {
    const id = deriveRowId(ADDR.toLowerCase());
    expect(id).toBe(deriveRowId(ADDR.toLowerCase()));
    expect(id.startsWith("id_")).toBe(true);
    expect(id).not.toContain("0x");
    expect(id.toLowerCase()).not.toContain(ADDR.slice(2, 10));
  });
});

describe("formatNickname", () => {
  it("renders EN adjective-first order", () => {
    const v = { piece: "knight", style: "golden", number: 4821 } as const;
    expect(formatNickname(v, EN)).toBe("Golden Knight #4821");
  });

  it("renders ES noun-first order from the same variant", () => {
    const v = { piece: "knight", style: "golden", number: 4821 } as const;
    expect(formatNickname(v, ES)).toBe("Caballo Dorado #4821");
  });
});

describe("formatGuestNickname", () => {
  it("prefixes the localized guest label", () => {
    const v = { piece: "knight", style: "golden", number: 3842 } as const;
    expect(formatGuestNickname(v, EN)).toBe("Guest Knight #3842");
    expect(formatGuestNickname(v, ES)).toBe("Invitado Caballo #3842");
  });
});

describe("formatNicknameCompact", () => {
  it("drops the style adjective for the narrow header slot", () => {
    const v = { piece: "knight", style: "golden", number: 4821 } as const;
    expect(formatNicknameCompact(v, EN)).toBe("Knight #4821");
    expect(formatNicknameCompact(v, ES)).toBe("Caballo #4821");
  });
});

describe("validateNickname", () => {
  it("accepts a valid nickname and trims it", () => {
    expect(validateNickname("  Wolfcito ")).toEqual({ ok: true, value: "Wolfcito" });
    expect(validateNickname("a_b-c 1")).toEqual({ ok: true, value: "a_b-c 1" });
  });

  it("rejects too short (<3)", () => {
    expect(validateNickname("ab")).toEqual({ ok: false, reason: "too_short" });
  });

  it("rejects too long (>18)", () => {
    expect(validateNickname("a".repeat(19))).toEqual({ ok: false, reason: "too_long" });
  });

  it("rejects disallowed characters", () => {
    expect(validateNickname("bad@name")).toEqual({ ok: false, reason: "bad_chars" });
    expect(validateNickname("emoji💥here")).toEqual({ ok: false, reason: "bad_chars" });
  });

  it("rejects blocklisted words", () => {
    expect(validateNickname("admin")).toEqual({ ok: false, reason: "blocked" });
  });
});
