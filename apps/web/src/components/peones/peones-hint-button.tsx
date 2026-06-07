"use client";

/**
 * PeonesHintButton — Sprint 4 commit E of Training Economy Alpha
 * 2026-06-08. First REAL spend surface. Wires the piece-exercise
 * Hint affordance to `submitPeonesSpend` + the spend-side telemetry
 * emitters added in commit D.
 *
 * Visibility:
 *  - guest    : muted chip with "Connect to use Peones hints" copy.
 *               No network call, no telemetry. Pure presentational.
 *  - disabled : parent passes `disabled` for labyrinth / non-playing
 *               phases. Component hides itself (returns null).
 *  - idle     : primary chip "Hint · 1 Peón".
 *  - loading  : same chip with `aria-busy=true` + disabled while
 *               the spend fetch is in flight.
 *  - revealed : reveal banner "Hint unlocked · {hint copy}".
 *  - insufficient / error : returns chip + transient label below
 *               with the short copy from PEONES_HINT_COPY. The
 *               exercise stays fully playable in all error paths.
 *
 * Spend contract:
 *  - target = "hint", amount = 1
 *  - idempotencyKey = `spend:hint:{wallet}:{piece}:{exerciseId}:{attemptSeq}`
 *  - metadata = { piece, exerciseId, attemptSeq, surface: "exercises" }
 *  - duplicate=true on the RPC returns the same hint with no debit
 *    (user already paid this attempt). Sprint 4 commit E ships with
 *    `attemptSeq = 1` always — retry-attempt tracking lights up in a
 *    later commit (see TODO in exercises-screen wire-up).
 *
 * NEVER throws. NEVER reads / writes localStorage. NEVER mutates the
 * global balance cache. NEVER calls /api/peones/earn. NEVER touches
 * Coach / Retry / Save game / PRO / Stablecoin paths.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { PieceId } from "@/lib/game/types";

type HintState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "revealed" }
  | { kind: "insufficient" }
  | { kind: "error" };

type Props = {
  piece: PieceId;
  exerciseId: string;
  /** Per-attempt counter. Sprint 4 commit E hard-codes to 1 from the
   *  parent; later commits will increment on user-initiated retries
   *  so a fresh hint can be paid for in a new attempt. */
  attemptSeq?: number;
  /** Parent's signal that the button should not render — labyrinth
   *  mode, non-playing phase, or any other "no hint right now" state. */
  disabled?: boolean;
  /** Test seam — production code passes nothing. */
  submitImpl?: typeof submitPeonesSpend;
};

export function PeonesHintButton({
  piece,
  exerciseId,
  attemptSeq = 1,
  disabled = false,
  submitImpl,
}: Props) {
  const t = useTranslations("PEONES_HINT_COPY");
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<HintState>({ kind: "idle" });

  if (disabled) return null;

  // Guest path — muted, no fetch.
  if (!isConnected || !address) {
    return (
      <div
        className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-amber-900/70 ring-1 ring-amber-800/15"
        role="status"
        data-testid="peones-hint-button"
        data-state="guest"
      >
        {t("guest")}
      </div>
    );
  }

  const wallet = address.toLowerCase();
  const idempotencyKey = `spend:hint:${wallet}:${piece}:${exerciseId}:${attemptSeq}`;
  const targetId = `${piece}:${exerciseId}:${attemptSeq}`;
  const submit = submitImpl ?? submitPeonesSpend;

  async function handleClick() {
    if (state.kind === "loading" || state.kind === "revealed") return;
    setState({ kind: "loading" });

    const result = await submit({
      wallet,
      amount: 1,
      target: "hint",
      targetId,
      idempotencyKey,
      metadata: {
        piece,
        exerciseId,
        attemptSeq,
        surface: "exercises",
      },
    });

    if (result.kind === "success") {
      // duplicate=true means the user already paid earlier this
      // attempt; reveal again without re-emitting peones_spent for a
      // zero-delta debit. The endpoint already returned debited > 0
      // on the FIRST call, which is when the event fired.
      if (result.debited > 0) {
        emitPeonesSpent({
          target: "hint",
          targetId,
          requested: 1,
          debited: result.debited,
          newBalance: result.newBalance,
          attestationHash: result.attestationHash,
          duplicate: result.duplicate,
          proBypassApplied: result.proBypassApplied,
        });
      }
      setState({ kind: "revealed" });
      return;
    }

    if (result.kind === "insufficient_balance") {
      emitPeonesSpendBlocked({
        target: "hint",
        targetId,
        requested: 1,
        reason: "insufficient_balance",
      });
      setState({ kind: "insufficient" });
      return;
    }

    emitPeonesSpendFailed({
      target: "hint",
      targetId,
      requested: 1,
      reason: result.error,
    });
    setState({ kind: "error" });
  }

  if (state.kind === "revealed") {
    return (
      <div
        className="inline-flex max-w-[18rem] flex-col items-start gap-0.5 rounded-2xl bg-amber-100/90 px-3 py-1.5 text-amber-900 shadow-sm ring-1 ring-amber-700/20"
        role="status"
        aria-live="polite"
        data-testid="peones-hint-button"
        data-state="revealed"
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
          {t("success")}
        </span>
        <span className="text-xs font-medium leading-tight">{t("hint")}</span>
      </div>
    );
  }

  const isLoading = state.kind === "loading";
  const subLabel =
    state.kind === "insufficient"
      ? t("insufficient")
      : state.kind === "error"
        ? t("error")
        : null;

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      data-testid="peones-hint-button"
      data-state={state.kind}
    >
      <button
        type="button"
        className="inline-flex items-center rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950 shadow-sm ring-1 ring-amber-700/30 hover:bg-amber-200 disabled:opacity-60"
        aria-busy={isLoading}
        aria-disabled={isLoading}
        disabled={isLoading}
        onClick={() => void handleClick()}
      >
        {t("button")}
      </button>
      {subLabel ? (
        <span
          className="text-[10px] font-medium text-amber-900/80"
          role="status"
          aria-live="polite"
        >
          {subLabel}
        </span>
      ) : null}
    </div>
  );
}
