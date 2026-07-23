import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiagnosticScreen } from "../DiagnosticScreen";
import { SEND_CHAIN_ID } from "../chains";
import type { DiagnosticCallbacks, DiagnosticViewModel } from "../view-model";

const noopCallbacks: DiagnosticCallbacks = {
  onLogin: vi.fn(),
  onLogout: vi.fn(),
  onSign: vi.fn(),
  onEnsureTestnet: vi.fn(),
  onSend: vi.fn(),
  onCopyAddress: vi.fn(),
};

function makeVm(overrides: Partial<DiagnosticViewModel> = {}): DiagnosticViewModel {
  return {
    phase: "unauthenticated",
    configError: null,
    maskedAppId: "clab…7890",
    ready: true,
    authenticated: false,
    loginMethod: null,
    address: null,
    walletType: null,
    walletCreationStatus: "—",
    expectedChainId: SEND_CHAIN_ID,
    connectedChainId: null,
    balance: null,
    rpcStatus: "idle",
    signature: null,
    signError: null,
    txHash: null,
    txFrom: null,
    txTo: null,
    txValue: null,
    txStatus: null,
    txError: null,
    receiptStatus: null,
    busy: { signing: false, switching: false, sending: false },
    ...overrides,
  };
}

describe("DiagnosticScreen", () => {
  it("(1) config-error shows a clear message and no wallet UI", () => {
    render(
      <DiagnosticScreen
        vm={makeVm({ phase: "config-error", configError: "Missing VITE_PRIVY_APP_ID." })}
        cb={noopCallbacks}
      />,
    );
    expect(screen.getByTestId("config-error")).toHaveTextContent("Missing VITE_PRIVY_APP_ID");
    expect(screen.queryByTestId("sign-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("send-button")).not.toBeInTheDocument();
  });

  it("(2) unauthenticated → no address, sign & send disabled", () => {
    render(<DiagnosticScreen vm={makeVm()} cb={noopCallbacks} />);
    expect(screen.getByTestId("wallet-address")).toHaveTextContent("—");
    expect(screen.getByTestId("sign-button")).toBeDisabled();
    expect(screen.getByTestId("send-button")).toBeDisabled();
    expect(screen.getByTestId("copy-address")).toBeDisabled();
  });

  it("(3) authenticated without a ready wallet → loading, still no signing", () => {
    render(
      <DiagnosticScreen
        vm={makeVm({
          phase: "wallet-loading",
          authenticated: true,
          walletCreationStatus: "creating…",
          connectedChainId: SEND_CHAIN_ID,
        })}
        cb={noopCallbacks}
      />,
    );
    expect(screen.getByTestId("wallet-status")).toHaveTextContent("creating…");
    expect(screen.getByTestId("sign-button")).toBeDisabled();
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("(4) wallet-ready on testnet → address visible, sign enabled", () => {
    render(
      <DiagnosticScreen
        vm={makeVm({
          phase: "wallet-ready",
          authenticated: true,
          loginMethod: "google",
          address: "0x1234567890abcdef1234567890abcdef12345678",
          walletType: "embedded (privy)",
          walletCreationStatus: "created",
          connectedChainId: SEND_CHAIN_ID,
        })}
        cb={noopCallbacks}
      />,
    );
    expect(screen.getByTestId("wallet-address")).toHaveTextContent(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
    expect(screen.getByTestId("sign-button")).toBeEnabled();
    expect(screen.getByTestId("copy-address")).toBeEnabled();
    // send enabled only because connected chain matches expected testnet
    expect(screen.getByTestId("send-button")).toBeEnabled();
  });

  it("(5) wallet-ready but wrong chain → send stays disabled (never mainnet)", () => {
    render(
      <DiagnosticScreen
        vm={makeVm({
          phase: "wallet-ready",
          authenticated: true,
          address: "0xabc",
          connectedChainId: 42220, // Celo mainnet
        })}
        cb={noopCallbacks}
      />,
    );
    expect(screen.getByTestId("chain-matches")).toHaveTextContent("false");
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("expected chain shown is exactly the Celo testnet id (not mainnet 42220)", () => {
    render(<DiagnosticScreen vm={makeVm()} cb={noopCallbacks} />);
    const cell = screen.getByTestId("expected-chain");
    // Exact match — 11142220 contains "42220" as a substring, so substring
    // assertions would be misleading here.
    expect(cell.textContent).toBe(String(SEND_CHAIN_ID));
    expect(cell.textContent).not.toBe("42220");
  });
});
