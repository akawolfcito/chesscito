import { describe, expect, it } from "vitest";

import { diagnoseChainConfiguration } from "@/lib/contracts/chain-config-diagnosis";

const CELO = 42220;
const CELO_SEPOLIA = 11142220;

describe("diagnoseChainConfiguration", () => {
  it("reports ok when the configured chain is the wallet default", () => {
    expect(
      diagnoseChainConfiguration({
        configuredChainId: CELO,
        defaultChainId: CELO,
      }),
    ).toEqual({ status: "ok" });
  });

  it("reports unset when no supported chain id resolved", () => {
    expect(
      diagnoseChainConfiguration({
        configuredChainId: null,
        defaultChainId: CELO,
      }),
    ).toEqual({ status: "unset", defaultChainId: CELO });
  });

  /**
   * The failure that had the VR red for months: a stray shell export pointed
   * the app at Celo Sepolia while wagmi reports its first chain (Celo) for a
   * disconnected visitor. The two can never agree, so every contract getter
   * returns null and the Shop renders "Coming soon".
   */
  it("reports default-mismatch when configured is supported but not the default", () => {
    expect(
      diagnoseChainConfiguration({
        configuredChainId: CELO_SEPOLIA,
        defaultChainId: CELO,
      }),
    ).toEqual({
      status: "default-mismatch",
      configuredChainId: CELO_SEPOLIA,
      defaultChainId: CELO,
    });
  });
});
