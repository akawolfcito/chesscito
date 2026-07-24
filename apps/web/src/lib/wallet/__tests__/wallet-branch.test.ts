import { describe, expect, it } from "vitest";

import { resolveWalletBranch } from "@/lib/wallet/wallet-branch";

// `isMiniPayEnv()` reads `window`, so it is FALSE during SSR (lib/minipay.ts:31).
// Branching on it at render time would make the server always pick the web tree
// while a MiniPay client hydrates into a different provider — a hydration
// mismatch plus a wagmi remount. The branch therefore takes hydration as an
// explicit input and refuses to decide before it.

describe("resolveWalletBranch", () => {
  describe("flag off — the tree must stay byte-identical to today", () => {
    it("stays on the injected tree before hydration", () => {
      expect(
        resolveWalletBranch({ privyEnabled: false, hydrated: false, isMiniPay: false }),
      ).toBe("injected");
    });

    it("stays on the injected tree after hydration, inside MiniPay or not", () => {
      expect(
        resolveWalletBranch({ privyEnabled: false, hydrated: true, isMiniPay: false }),
      ).toBe("injected");
      expect(
        resolveWalletBranch({ privyEnabled: false, hydrated: true, isMiniPay: true }),
      ).toBe("injected");
    });
  });

  describe("flag on", () => {
    it("never decides from unhydrated state", () => {
      // The dangerous case: SSR sees isMiniPay false because there is no window.
      // Committing to "web" here would strand every MiniPay user.
      expect(
        resolveWalletBranch({ privyEnabled: true, hydrated: false, isMiniPay: false }),
      ).toBe("undecided");
      expect(
        resolveWalletBranch({ privyEnabled: true, hydrated: false, isMiniPay: true }),
      ).toBe("undecided");
    });

    it("keeps MiniPay on the injected tree once hydrated", () => {
      expect(
        resolveWalletBranch({ privyEnabled: true, hydrated: true, isMiniPay: true }),
      ).toBe("injected");
    });

    it("routes hydrated non-MiniPay browsers to the Privy tree", () => {
      expect(
        resolveWalletBranch({ privyEnabled: true, hydrated: true, isMiniPay: false }),
      ).toBe("privy");
    });
  });

  it("never returns the Privy branch while inside MiniPay, under any input", () => {
    for (const privyEnabled of [true, false]) {
      for (const hydrated of [true, false]) {
        expect(
          resolveWalletBranch({ privyEnabled, hydrated, isMiniPay: true }),
        ).not.toBe("privy");
      }
    }
  });
});
