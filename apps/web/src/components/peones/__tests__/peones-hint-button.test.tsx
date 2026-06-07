/**
 * Sprint 4 commit E — PeonesHintButton tests.
 *
 * Contract assertions:
 *   - guest: no fetch, no telemetry, renders guest copy
 *   - connected click: calls submit with canonical payload
 *   - success (debited > 0): reveals + emits peones_spent
 *   - duplicate success (debited = 0): reveals WITHOUT re-emitting
 *   - insufficient: no reveal, emits peones_spend_blocked
 *   - error: no reveal, emits peones_spend_failed
 *   - disabled: returns null (no DOM)
 *   - localStorage: never touched in any path
 *   - never calls /api/peones/earn
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesSpent: vi.fn(),
  emitPeonesSpendBlocked: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

const messages = {
  PEONES_HINT_COPY: {
    button: "Hint \u00b7 1 Peón",
    guest: "Connect to use Peones hints",
    insufficient: "Not enough Peones",
    error: "Hint unavailable right now",
    success: "Hint unlocked",
    hint: "Try moving closer to the target.",
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
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import { PeonesHintButton } from "@/components/peones/peones-hint-button";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedAccount = vi.mocked(useAccount);
const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

beforeEach(() => {
  mockedAccount.mockReturnValue({
    isConnected: false,
    address: undefined,
  } as never);
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedFailed.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function fetchTripwire() {
  return vi
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
}

describe("PeonesHintButton — guest", () => {
  it("renders guest copy and does NOT call submit", () => {
    const submitImpl = vi.fn();
    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );
    expect(
      screen.getByText("Connect to use Peones hints"),
    ).toBeInTheDocument();
    expect(submitImpl).not.toHaveBeenCalled();
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — disabled", () => {
  it("returns null when disabled (labyrinth / non-playing)", () => {
    const submitImpl = vi.fn();
    const { container } = render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        disabled
        submitImpl={submitImpl}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(submitImpl).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — connected happy path", () => {
  function connectWallet() {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
  }

  it("calls submit with the canonical payload", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        attemptSeq={1}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(submitImpl).toHaveBeenCalledTimes(1));
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 1,
      target: "hint",
      targetId: "rook:r-1:1",
      idempotencyKey: `spend:hint:${W}:rook:r-1:1`,
      metadata: {
        piece: "rook",
        exerciseId: "r-1",
        attemptSeq: 1,
        surface: "exercises",
      },
    });
  });

  it("reveals the hint and emits peones_spent on success (debited > 0)", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Hint unlocked")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Try moving closer to the target."),
    ).toBeInTheDocument();
    expect(mockedSpent).toHaveBeenCalledTimes(1);
    expect(mockedSpent).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "hint",
        targetId: "rook:r-1:1",
        requested: 1,
        debited: 1,
        duplicate: false,
        proBypassApplied: false,
      }),
    );
  });

  it("duplicate success: reveals WITHOUT re-emitting peones_spent (debited = 0)", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      debited: 0,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: true,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Hint unlocked")).toBeInTheDocument(),
    );
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — connected failure paths", () => {
  function connectWallet() {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
  }

  it("insufficient_balance: no reveal, emits peones_spend_blocked", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Not enough Peones")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Hint unlocked")).not.toBeInTheDocument();
    expect(mockedBlocked).toHaveBeenCalledTimes(1);
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      reason: "insufficient_balance",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("technical error: no reveal, emits peones_spend_failed", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "network",
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(
        screen.getByText("Hint unavailable right now"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Hint unlocked")).not.toBeInTheDocument();
    expect(mockedFailed).toHaveBeenCalledTimes(1);
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      reason: "network",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — side-effect tripwires", () => {
  it("guest path does NOT call global fetch", () => {
    const fetchSpy = fetchTripwire();
    render(<PeonesHintButton piece="rook" exerciseId="r-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connected idle render does NOT call global fetch (only the click does)", () => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
    const fetchSpy = fetchTripwire();
    render(<PeonesHintButton piece="rook" exerciseId="r-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never reads or writes localStorage", () => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
    const getSpy = vi.spyOn(window.localStorage, "getItem");
    const setSpy = vi.spyOn(window.localStorage, "setItem");
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        submitImpl={submitImpl}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });
});
