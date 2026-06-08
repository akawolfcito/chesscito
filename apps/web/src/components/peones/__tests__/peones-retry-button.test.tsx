/**
 * Sprint 5 commit C — PeonesRetryButton tests.
 *
 * Contract assertions:
 *   - guest: muted chip, no fetch, no telemetry, no onRetryUnlocked
 *   - disabled: returns null
 *   - connected click: submit called with canonical payload
 *     (target=retry, amount=2, prefixed idempotency key, whitelisted
 *      metadata including surface="result_overlay")
 *   - success debited > 0 + !duplicate: onRetryUnlocked + peones_spent
 *   - duplicate success: onRetryUnlocked but NO peones_spent
 *   - PRO bypass: onRetryUnlocked + peones_spend_bypassed (no _spent)
 *   - insufficient: no onRetryUnlocked, emits peones_spend_blocked
 *   - error: no onRetryUnlocked, emits peones_spend_failed
 *   - localStorage: never read or written
 *   - never calls /api/peones/earn (no global fetch even on guest idle)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesSpent: vi.fn(),
  emitPeonesSpendBlocked: vi.fn(),
  emitPeonesSpendBypassed: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

const messages = {
  PEONES_RETRY_COPY: {
    button: "Retry \u00b7 2 Peones",
    guest: "Connect to use Peones retries",
    insufficient: "Not enough Peones",
    error: "Retry unavailable",
  },
};

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const dict =
      messages[ns as keyof typeof messages] as Record<string, string>;
    return dict?.[key] ?? `${ns}.${key}`;
  },
}));

import { useAccount } from "wagmi";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import { PeonesRetryButton } from "@/components/peones/peones-retry-button";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedAccount = vi.mocked(useAccount);
const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedBypassed = vi.mocked(emitPeonesSpendBypassed);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

function fetchTripwire() {
  return vi
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
}

function connectWallet() {
  mockedAccount.mockReturnValue({
    isConnected: true,
    address: W,
  } as never);
}

beforeEach(() => {
  mockedAccount.mockReturnValue({
    isConnected: false,
    address: undefined,
  } as never);
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedBypassed.mockReset();
  mockedFailed.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("PeonesRetryButton — guest", () => {
  it("renders the guest copy + does NOT call submit + does NOT fire telemetry", () => {
    const submitImpl = vi.fn();
    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );
    expect(
      screen.getByText("Connect to use Peones retries"),
    ).toBeInTheDocument();
    expect(submitImpl).not.toHaveBeenCalled();
    expect(onRetryUnlocked).not.toHaveBeenCalled();
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedBypassed).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });
});

describe("PeonesRetryButton — disabled", () => {
  it("returns null when disabled is true", () => {
    const { container } = render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        disabled
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("PeonesRetryButton — connected happy paths", () => {
  it("submits the canonical payload (retry, 2 Peones, prefixed key, metadata)", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "retry",
      targetId: "rook:rook-1:3",
      requested: 2,
      debited: 2,
      newBalance: 8,
      attestationHash: "sha256:rtry",
      ledgerId: 200,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={3}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(submitImpl).toHaveBeenCalledTimes(1));
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 2,
      target: "retry",
      targetId: "rook:rook-1:3",
      idempotencyKey: `spend:retry:${W}:rook:rook-1:3`,
      metadata: {
        piece: "rook",
        exerciseId: "rook-1",
        attemptSeq: 3,
        surface: "result_overlay",
      },
    });
  });

  it("fresh debit (debited > 0, !duplicate): fires onRetryUnlocked + emits peones_spent", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      debited: 2,
      newBalance: 8,
      attestationHash: "sha256:rtry",
      ledgerId: 200,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-retry-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(onRetryUnlocked).toHaveBeenCalledTimes(1);
    expect(mockedSpent).toHaveBeenCalledTimes(1);
    expect(mockedSpent).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "retry",
        requested: 2,
        debited: 2,
        duplicate: false,
        proBypassApplied: false,
      }),
    );
  });

  it("duplicate idempotent hit: fires onRetryUnlocked WITHOUT emitting peones_spent", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      debited: 2,
      newBalance: 0,
      attestationHash: "sha256:rtry-orig",
      ledgerId: 200,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-retry-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(onRetryUnlocked).toHaveBeenCalledTimes(1);
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBypassed).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("PRO bypass: fires onRetryUnlocked + emits peones_spend_bypassed (NOT peones_spent)", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:rtry-bypass",
      ledgerId: 201,
      duplicate: false,
      proBypassApplied: true,
      quotaUsed: 4,
      quotaLimit: 10,
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-retry-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(onRetryUnlocked).toHaveBeenCalledTimes(1);
    expect(mockedBypassed).toHaveBeenCalledTimes(1);
    expect(mockedBypassed).toHaveBeenCalledWith({
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:rtry-bypass",
      quotaUsed: 4,
      quotaLimit: 10,
    });
    expect(mockedSpent).not.toHaveBeenCalled();
  });
});

describe("PeonesRetryButton — connected failure paths", () => {
  it("insufficient_balance: NO onRetryUnlocked, emits peones_spend_blocked", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Not enough Peones")).toBeInTheDocument(),
    );
    expect(onRetryUnlocked).not.toHaveBeenCalled();
    expect(mockedBlocked).toHaveBeenCalledTimes(1);
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      reason: "insufficient_balance",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("technical error: NO onRetryUnlocked, emits peones_spend_failed", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "network",
    } satisfies PeonesSpendResult);

    const onRetryUnlocked = vi.fn();
    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        onRetryUnlocked={onRetryUnlocked}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Retry unavailable")).toBeInTheDocument(),
    );
    expect(onRetryUnlocked).not.toHaveBeenCalled();
    expect(mockedFailed).toHaveBeenCalledTimes(1);
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      reason: "network",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
  });
});

describe("PeonesRetryButton — side-effect tripwires", () => {
  it("guest path does NOT call global fetch", () => {
    const fetchSpy = fetchTripwire();
    render(<PeonesRetryButton piece="rook" exerciseId="rook-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connected idle render does NOT call global fetch (only the click does)", () => {
    connectWallet();
    const fetchSpy = fetchTripwire();
    render(<PeonesRetryButton piece="rook" exerciseId="rook-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never reads or writes localStorage", () => {
    connectWallet();
    const getSpy = vi.spyOn(window.localStorage, "getItem");
    const setSpy = vi.spyOn(window.localStorage, "setItem");
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "retry",
      targetId: "rook:rook-1:1",
      requested: 2,
      debited: 2,
      newBalance: 8,
      attestationHash: "sha256:rtry",
      ledgerId: 200,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    render(
      <PeonesRetryButton
        piece="rook"
        exerciseId="rook-1"
        attemptSeq={1}
        submitImpl={submitImpl}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });
});
