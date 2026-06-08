"use client";

/**
 * PeonesRetryButton — paid Retry affordance for piece exercises.
 *
 * Sprint 5 commit C (2026-06-08). Second consumer surface where
 * Peones meet the player, after Hint. Mirrors the morphing-chip
 * pattern shipped in Sprint 4 commit M for PeonesHintButton — one
 * chip whose label swaps with state, no stacked sublabel, no layout
 * jitter.
 *
 * This commit ships the component in isolation. Wire-up to the
 * result overlay + the `incrementAttemptSeq` callback lives in
 * commit D so the surface can ship in two reviewable slices.
 *
 * Spend contract:
 *   - target = "retry", amount = 2
 *   - idempotencyKey = `spend:retry:{wallet}:{piece}:{exerciseId}:{attemptSeq}`
 *   - metadata = { piece, exerciseId, attemptSeq, surface: "result_overlay" }
 *   - Same attemptSeq → same key → RPC returns duplicate=true with
 *     no fresh debit. The component still fires `onRetryUnlocked`
 *     so the host (result overlay) can move forward; the gate on
 *     `peones_spent` keeps the dashboard rule "spent === real
 *     Peones left the wallet" intact (Sprint 4 commit M.1).
 *
 * Visibility states:
 *  - guest        : muted chip with "Connect to use Peones retries".
 *  - disabled     : returns null. Parent decides when to hide.
 *  - idle         : pill "Retry · 2 Peones".
 *  - loading      : same pill, aria-busy + disabled. Guards against
 *                   double-tap firing two spends.
 *  - revealed     : pill at muted opacity for the REVEAL_TTL_MS
 *                   while the host runs its reset animation.
 *  - insufficient : pill morphs to "Not enough Peones" for 2.5s.
 *  - error        : pill morphs to "Retry unavailable right now"
 *                   for 2.5s.
 *
 * NEVER throws. NEVER touches localStorage. NEVER mutates global
 * balance cache. NEVER calls /api/peones/earn. NEVER touches
 * Coach / Hint / Save game / PRO / Stablecoin paths.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { PieceId } from "@/lib/game/types";

const RETRY_COST = 2;

/** How long the chip stays in the muted "revealed" state after a
 *  successful retry purchase. Matches the Hint chip's REVEAL_TTL_MS
 *  so the two surfaces feel consistent. */
const REVEAL_TTL_MS = 4000;

/** Auto-clear duration for insufficient / error feedback before the
 *  chip returns to idle. Same as PeonesHintButton (Sprint 4 M.1). */
const FEEDBACK_TTL_MS = 2500;

type RetryState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "revealed" }
  | { kind: "insufficient" }
  | { kind: "error" };

type Props = {
  piece: PieceId;
  exerciseId: string;
  /** The attempt this purchase closes. Owned by the host (commit D
   *  reads `useExerciseProgress().attemptSeq` and passes it through).
   *  Defaults to 1 so isolated previews / tests don't need to set it. */
  attemptSeq?: number;
  /** Parent's signal that the button should not render — non-failure
   *  phases, labyrinth mode, anywhere a retry doesn't apply. */
  disabled?: boolean;
  /** Fires when the host should run its reset behaviour (reset board
   *  state, increment attemptSeq, etc). Called for any "paid" outcome
   *  — fresh debit, duplicate idempotent hit, or PRO bypass — because
   *  in all three cases the wallet has the right to start a new
   *  attempt. NOT called for insufficient / error / guest. */
  onRetryUnlocked?: () => void;
  /** Optional className passthrough so the host can tune positioning
   *  (e.g. inline next to result-overlay CTAs). */
  className?: string;
  /** Test seam — production code passes nothing. */
  submitImpl?: typeof submitPeonesSpend;
};

export function PeonesRetryButton({
  piece,
  exerciseId,
  attemptSeq = 1,
  disabled = false,
  onRetryUnlocked,
  className,
  submitImpl,
}: Props) {
  const t = useTranslations("PEONES_RETRY_COPY");
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<RetryState>({ kind: "idle" });
  /** Single timer ref for both the reveal-TTL and the feedback-TTL
   *  — either path replaces the other on a fresh tap. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (disabled) return null;

  // Guest path — muted, no fetch.
  if (!isConnected || !address) {
    return (
      <div
        className={[
          "pointer-events-auto inline-flex max-w-full items-center truncate rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-amber-900/80 shadow-sm ring-1 ring-amber-800/15",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
        data-testid="peones-retry-button"
        data-state="guest"
      >
        {t("guest")}
      </div>
    );
  }

  const wallet = address.toLowerCase();
  const targetId = `${piece}:${exerciseId}:${attemptSeq}`;
  const idempotencyKey = `spend:retry:${wallet}:${piece}:${exerciseId}:${attemptSeq}`;
  const submit = submitImpl ?? submitPeonesSpend;

  function scheduleClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState({ kind: "idle" });
      timerRef.current = null;
    }, REVEAL_TTL_MS);
  }

  function scheduleFeedbackClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState({ kind: "idle" });
      timerRef.current = null;
    }, FEEDBACK_TTL_MS);
  }

  async function handleClick() {
    if (state.kind === "loading" || state.kind === "revealed") return;
    setState({ kind: "loading" });

    const result = await submit({
      wallet,
      amount: RETRY_COST,
      target: "retry",
      targetId,
      idempotencyKey,
      metadata: {
        piece,
        exerciseId,
        attemptSeq,
        surface: "result_overlay",
      },
    });

    if (result.kind === "success") {
      // Emit precedence (Sprint 4 commits G + M.1):
      //   1. PRO bypass applied → peones_spend_bypassed
      //   2. Real debit, fresh row → peones_spent
      //   3. Duplicate idempotent hit → no emit (original peones_spent
      //      already fired when the row was first created)
      if (
        result.proBypassApplied &&
        result.quotaLimit != null &&
        result.quotaUsed != null
      ) {
        emitPeonesSpendBypassed({
          target: "retry",
          targetId,
          requested: RETRY_COST,
          debited: 0,
          newBalance: result.newBalance,
          attestationHash: result.attestationHash,
          quotaUsed: result.quotaUsed,
          quotaLimit: result.quotaLimit,
        });
      } else if (result.debited > 0 && !result.duplicate) {
        emitPeonesSpent({
          target: "retry",
          targetId,
          requested: RETRY_COST,
          debited: result.debited,
          newBalance: result.newBalance,
          attestationHash: result.attestationHash,
          duplicate: result.duplicate,
          proBypassApplied: result.proBypassApplied,
        });
      }
      onRetryUnlocked?.();
      setState({ kind: "revealed" });
      scheduleClear();
      return;
    }

    if (result.kind === "insufficient_balance") {
      emitPeonesSpendBlocked({
        target: "retry",
        targetId,
        requested: RETRY_COST,
        reason: "insufficient_balance",
      });
      setState({ kind: "insufficient" });
      scheduleFeedbackClear();
      return;
    }

    emitPeonesSpendFailed({
      target: "retry",
      targetId,
      requested: RETRY_COST,
      reason: result.error,
    });
    setState({ kind: "error" });
    scheduleFeedbackClear();
  }

  const isLoading = state.kind === "loading";
  const isRevealed = state.kind === "revealed";
  const isFeedback = state.kind === "insufficient" || state.kind === "error";

  // Single morphing chip — content swaps with state, footprint stays
  // roughly constant (cf. Sprint 4 commit M rationale).
  const label =
    state.kind === "insufficient"
      ? t("insufficient")
      : state.kind === "error"
        ? t("error")
        : t("button");

  return (
    <div
      className={[
        "pointer-events-auto inline-flex",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="peones-retry-button"
      data-state={state.kind}
    >
      <button
        type="button"
        className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-sm ring-1 transition-colors disabled:opacity-80 disabled:hover:bg-white ${
          isFeedback
            ? "bg-white text-sky-900/90 ring-sky-800/15"
            : isRevealed
              ? "bg-sky-200 text-sky-950/70 ring-sky-700/20"
              : "bg-sky-300 text-sky-950 ring-sky-700/30 hover:bg-sky-200"
        }`}
        aria-busy={isLoading}
        aria-disabled={isLoading || isRevealed || isFeedback}
        disabled={isLoading || isRevealed || isFeedback}
        role={isFeedback ? "status" : undefined}
        aria-live={isFeedback ? "polite" : undefined}
        onClick={() => void handleClick()}
      >
        {label}
      </button>
    </div>
  );
}
