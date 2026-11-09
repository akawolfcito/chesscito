import { describe, expect, it } from "vitest";

import { permitSignatureToVRS } from "@/lib/contracts/permit-signature";

const R = `0x${"11".repeat(32)}` as const;
const S = `0x${"22".repeat(32)}` as const;

function sig(lastByte: string): `0x${string}` {
  return `0x${"11".repeat(32)}${"22".repeat(32)}${lastByte}` as `0x${string}`;
}

describe("permitSignatureToVRS", () => {
  it("passes through legacy v=27 (0x1b) signatures", () => {
    expect(permitSignatureToVRS(sig("1b"))).toEqual({ v: 27, r: R, s: S });
  });

  it("passes through legacy v=28 (0x1c) signatures", () => {
    expect(permitSignatureToVRS(sig("1c"))).toEqual({ v: 28, r: R, s: S });
  });

  it("normalizes yParity=0 (0x00) to v=27 — regression: was silently mapped to v=0", () => {
    expect(permitSignatureToVRS(sig("00"))).toEqual({ v: 27, r: R, s: S });
  });

  it("normalizes yParity=1 (0x01) to v=28 — regression: was silently mapped to v=0", () => {
    expect(permitSignatureToVRS(sig("01"))).toEqual({ v: 28, r: R, s: S });
  });

  it("never returns v=0 for any wallet signature format", () => {
    for (const last of ["00", "01", "1b", "1c"]) {
      expect(permitSignatureToVRS(sig(last)).v).toBeGreaterThanOrEqual(27);
    }
  });
});
