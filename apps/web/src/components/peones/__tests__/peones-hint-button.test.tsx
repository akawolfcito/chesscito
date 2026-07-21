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
  emitPeonesSpendBypassed: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

const messages = {
  PEONES_HINT_COPY: {
    button: "Hint \u00b7 2 Peones",
    pinLabel: "Hint",
    guest: "Connect to use Peones hints",
    insufficient: "Need 2 Peones",
    error: "Hint unavailable",
    rateLimited: "One sec, try again",
    unavailable: "No hint",
    cost: "2",
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
import { PeonesHintButton } from "@/components/peones/peones-hint-button";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedAccount = vi.mocked(useAccount);
const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedBypassed = vi.mocked(emitPeonesSpendBypassed);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

/** A computable first step. Required for the button to be spendable at
 *  all (2026-07-21): with no step to glow there is nothing to sell, so
 *  the pin renders dead instead of charging. Tests that exercise the
 *  spend path must pass one. */
const STEP = { file: 0, rank: 7 } as const;

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
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );
    // Pin form (2026-06-11): connect nudge lives in the aria-label,
    // the visible nano label stays the pin name.
    expect(
      screen.getByLabelText("Connect to use Peones hints"),
    ).toBeInTheDocument();
    expect(screen.getByText("Hint")).toBeInTheDocument();
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
        firstStep={STEP}
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
      requested: 2,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={STEP}
        attemptSeq={1}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(submitImpl).toHaveBeenCalledTimes(1));
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 2,
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

  it("Sprint 5 commit E — attemptSeq prop threads into targetId, idempotencyKey, and metadata", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 2,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={STEP}
        attemptSeq={3}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(submitImpl).toHaveBeenCalledTimes(1));
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 2,
      target: "hint",
      // attemptSeq=3 must appear in BOTH the targetId tail and the
      // idempotency-key tail, otherwise two attempts on the same
      // exercise collapse onto a single ledger row (the bug Sprint 4
      // shipped with).
      targetId: "rook:r-1:3",
      idempotencyKey: `spend:hint:${W}:rook:r-1:3`,
      metadata: {
        piece: "rook",
        exerciseId: "r-1",
        attemptSeq: 3,
        surface: "exercises",
      },
    });
  });

  it("Sprint 5 commit E — default attemptSeq stays 1 when prop omitted (back-compat)", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 99,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(submitImpl).toHaveBeenCalledTimes(1));
    const payload = submitImpl.mock.calls[0]![0] as {
      idempotencyKey: string;
      metadata: { attemptSeq: number };
    };
    expect(payload.idempotencyKey).toBe(`spend:hint:${W}:rook:r-1:1`);
    expect(payload.metadata.attemptSeq).toBe(1);
  });

  it("on success (debited > 0): calls onReveal with firstStep + emits peones_spent + transitions state to revealed", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const firstStep = { file: 0, rank: 7 };
    const onReveal = vi.fn();

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={firstStep}
        onReveal={onReveal}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    // Hint is on the board, NOT in the button — no textual banner.
    expect(screen.queryByText("Hint unlocked")).not.toBeInTheDocument();
    expect(onReveal).toHaveBeenCalledWith(firstStep);
    expect(mockedSpent).toHaveBeenCalledTimes(1);
  });

  it("duplicate success (debited=0): still calls onReveal but skips peones_spent emit", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 0,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const firstStep = { file: 0, rank: 7 };
    const onReveal = vi.fn();

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={firstStep}
        onReveal={onReveal}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(onReveal).toHaveBeenCalledWith(firstStep);
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  it("duplicate idempotent (debited > 0 + duplicate=true): reveals WITHOUT emitting peones_spent", async () => {
    connectWallet();
    // Sprint 4 commit M.1 — RPC returns the ORIGINAL row's debited
    // amount (positive) on idempotent retry. The client must NOT
    // re-emit peones_spent because no fresh Peones left the wallet.
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 1,
      newBalance: 0,
      attestationHash: "sha256:abc",
      ledgerId: 40,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const onReveal = vi.fn();
    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={{ file: 0, rank: 7 }}
        onReveal={onReveal}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(onReveal).toHaveBeenCalled();
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBypassed).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
    expect(mockedFailed).not.toHaveBeenCalled();
  });

  /** Behaviour INVERTED 2026-07-21 (Peones V1 UX). This used to assert
   *  that a hint with no computable first step still charged and still
   *  reported `revealed` — i.e. the player paid 2 Peones and got nothing
   *  on the board. There is no refund path, so the only correct fix is
   *  to never take the money: no submit, no debit, visible dead state. */
  it("without a firstStep: never submits a spend and shows the unavailable state", async () => {
    connectWallet();
    const submitImpl = vi.fn();
    const onReveal = vi.fn();

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={null}
        onReveal={onReveal}
        submitImpl={submitImpl}
      />,
    );

    const root = screen.getByTestId("peones-hint-button");
    expect(root).toHaveAttribute("data-state", "unavailable");

    // Non-interactive by construction: there is no button to press, so
    // the spend cannot be triggered by a tap, a double-tap, or a race.
    expect(root.querySelector("button")).toBeNull();

    // The debit endpoint is never reached, so there is nothing to refund.
    expect(submitImpl).not.toHaveBeenCalled();
    expect(onReveal).not.toHaveBeenCalled();
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
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Need 2 Peones")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Hint unlocked")).not.toBeInTheDocument();
    expect(mockedBlocked).toHaveBeenCalledTimes(1);
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
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
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("Hint unavailable")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Hint unlocked")).not.toBeInTheDocument();
    expect(mockedFailed).toHaveBeenCalledTimes(1);
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      reason: "network",
    });
    expect(mockedSpent).not.toHaveBeenCalled();
    expect(mockedBlocked).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — side-effect tripwires", () => {
  it("guest path does NOT call global fetch", () => {
    const fetchSpy = fetchTripwire();
    render(<PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("connected idle render does NOT call global fetch (only the click does)", () => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
    const fetchSpy = fetchTripwire();
    render(<PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} />);
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
      requested: 2,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — PRO bypass (Sprint 4 commit G)", () => {
  function connectWallet() {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
  }

  it("proBypassApplied + quota: reveals hint, emits peones_spend_bypassed, NOT peones_spent", async () => {
    connectWallet();
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:bypass-x",
      ledgerId: 200,
      duplicate: false,
      proBypassApplied: true,
      quotaUsed: 6,
      quotaLimit: 20,
    } satisfies PeonesSpendResult);

    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={STEP}
        submitImpl={submitImpl}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "revealed",
      ),
    );
    expect(mockedBypassed).toHaveBeenCalledTimes(1);
    expect(mockedBypassed).toHaveBeenCalledWith({
      target: "hint",
      targetId: "rook:r-1:1",
      requested: 2,
      debited: 0,
      newBalance: 7,
      attestationHash: "sha256:bypass-x",
      quotaUsed: 6,
      quotaLimit: 20,
    });
    expect(mockedSpent).not.toHaveBeenCalled();
  });
});

describe("PeonesHintButton — icon+label (founder D3 follow-up)", () => {
  it("connected chip renders the hint-icon sprite next to the label", () => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
    render(
      <PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} submitImpl={vi.fn()} />,
    );
    const button = screen.getByRole("button");
    const icon = button.querySelector("img");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute(
      "src",
      "/art/new-icons-chesscito/hint-icon-v1.png",
    );
    expect(icon).toHaveAttribute("aria-hidden", "true");
    // Perf 2026-06-12: the raw PNG is 52KB while the avif sibling is
    // 8KB — the sprite must negotiate formats via <picture>.
    const srcsets = Array.from(button.querySelectorAll("source")).map((s) =>
      s.getAttribute("srcset"),
    );
    expect(srcsets).toContain("/art/new-icons-chesscito/hint-icon-v1.avif");
    expect(srcsets).toContain("/art/new-icons-chesscito/hint-icon-v1.webp");
    // Pin form: cost detail is the aria-label; the nano label below
    // shows the pin name.
    expect(button).toHaveAttribute("aria-label", "Hint \u00b7 2 Peones");
    expect(screen.getByText("Hint")).toBeInTheDocument();
  });

  it("icon survives the insufficient morph (no layout-jump text-only chip)", async () => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
      error: "insufficient_balance",
    });
    render(
      <PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} submitImpl={submitImpl} />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "insufficient",
      ),
    );
    expect(
      screen.getByTestId("peones-hint-button").querySelector("img"),
    ).not.toBeNull();
  });

  it("guest pin keeps the sprite (uniform action row) but is non-interactive", () => {
    render(<PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} />);
    const root = screen.getByTestId("peones-hint-button");
    expect(root.querySelector("img")).not.toBeNull();
    expect(root.querySelector("button")).toBeNull();
  });
});

describe("PeonesHintButton — rate-limited gets its own transient copy (hint race fix)", () => {
  beforeEach(() => {
    mockedAccount.mockReturnValue({
      isConnected: true,
      address: W,
    } as never);
  });

  it("error=rate_limited: distinct state + retry copy, NOT the generic unavailable", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "rate_limited",
    } satisfies PeonesSpendResult);
    const onReveal = vi.fn();
    render(
      <PeonesHintButton
        piece="rook"
        exerciseId="r-1"
        firstStep={{ file: 7, rank: 0 }}
        onReveal={onReveal}
        submitImpl={submitImpl}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "rate_limited",
      ),
    );
    expect(screen.getByText("One sec, try again")).toBeInTheDocument();
    expect(onReveal).not.toHaveBeenCalled();
    expect(mockedFailed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "rate_limited" }),
    );
  });

  it("other technical errors keep the generic unavailable copy", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "ledger_unavailable",
    } satisfies PeonesSpendResult);
    render(
      <PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} submitImpl={submitImpl} />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "error",
      ),
    );
    expect(screen.getByText("Hint unavailable")).toBeInTheDocument();
  });

  it("insufficient copy states the cost (D1 alignment): Need 2 Peones", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);
    render(
      <PeonesHintButton piece="rook" exerciseId="r-1" firstStep={STEP} submitImpl={submitImpl} />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByTestId("peones-hint-button")).toHaveAttribute(
        "data-state",
        "insufficient",
      ),
    );
    expect(screen.getByText("Need 2 Peones")).toBeInTheDocument();
  });
});
