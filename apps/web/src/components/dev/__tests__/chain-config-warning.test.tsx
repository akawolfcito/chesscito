import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { ChainConfigWarning } from "../chain-config-warning";

const CELO = 42220;
const CELO_SEPOLIA = 11142220;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ChainConfigWarning", () => {
  it("stays hidden when the configured chain is the wallet default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", String(CELO));

    render(<ChainConfigWarning defaultChainId={CELO} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("chain-config-warning"),
      ).not.toBeInTheDocument();
    });
  });

  it("names both chain ids when the configured one is not the default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", String(CELO_SEPOLIA));

    render(<ChainConfigWarning defaultChainId={CELO} />);

    const warning = await screen.findByTestId("chain-config-warning");
    expect(warning).toHaveTextContent(String(CELO_SEPOLIA));
    expect(warning).toHaveTextContent(String(CELO));
    expect(warning).toHaveTextContent("Coming soon");
  });

  it("warns when no supported chain id resolved at all", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", "");

    render(<ChainConfigWarning defaultChainId={CELO} />);

    const warning = await screen.findByTestId("chain-config-warning");
    expect(warning).toHaveTextContent("NEXT_PUBLIC_CHAIN_ID");
  });

  it("never renders outside local development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", String(CELO_SEPOLIA));

    render(<ChainConfigWarning defaultChainId={CELO} />);

    expect(screen.queryByTestId("chain-config-warning")).not.toBeInTheDocument();
  });
});
