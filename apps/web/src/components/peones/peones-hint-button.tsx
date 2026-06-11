"use client";

/**
 * PeonesHintButton — paid Hint affordance for piece exercises.
 *
 * Sprint 4 commit E originally landed with a textual reveal banner.
 * Sprint 4 commit I (founder visual-first directive 2026-06-08)
 * REPLACES the banner with a board-cell glow: the consumer passes
 * `firstStep` (optimal first move computed via BFS) and an
 * `onReveal(square | null)` callback. This component owns the spend
 * orchestration + auto-fade timer; rendering of the hint lives on
 * the board itself, not in the button's footprint. Resolves the
 * layout regression where the banner overflowed the action row.
 *
 * Visibility states:
 *  - guest        : muted chip "Connect to use Peones hints".
 *  - disabled     : returns null (labyrinth / non-playing phase).
 *  - idle         : pill "Hint · 1 Peón".
 *  - loading      : same pill, aria-busy + disabled.
 *  - revealed     : same pill at slightly muted opacity for ~4s
 *                   while the board glow is up. Hint is on the
 *                   board, NOT in this component.
 *  - insufficient : pill + small "Not enough Peones" sublabel.
 *  - error        : pill + small "Hint unavailable right now"
 *                   sublabel.
 *
 * NEVER throws. NEVER touches localStorage. NEVER mutates global
 * balance cache. NEVER calls /api/peones/earn.
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
import type { BoardPosition, PieceId } from "@/lib/game/types";

/** How long the board glow stays after a successful reveal before the
 *  parent is told to clear it. Matches the candy-style consumable
 *  toast feel — long enough to read, short enough to not block UX. */
const REVEAL_TTL_MS = 4000;

/** How long the insufficient / error sublabel stays before the button
 *  returns to its idle state. Shorter than REVEAL_TTL_MS because the
 *  sublabel is text-only feedback, not a paid reveal. */
const FEEDBACK_TTL_MS = 2500;

/** Founder D3 follow-up (2026-06-11) — the HINT chip carries its own
 *  sprite so it reads as an action icon, consistent with the SAVE /
 *  CLAIM reward pins. Kept across every connected state (idle,
 *  loading, revealed, feedback) so the morphing chip never jumps
 *  between icon+text and text-only layouts. Guest chip stays
 *  text-only: it advertises connecting, not spending. */
const HINT_ICON_SRC = "/art/new-icons-chesscito/hint-icon.png";

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
   *  parent; retry-attempt tracking lights up in a later commit so a
   *  fresh hint can be paid for in a new attempt. */
  attemptSeq?: number;
  /** Parent's signal that the button should not render — labyrinth
   *  mode, non-playing phase, or any other "no hint right now" state. */
  disabled?: boolean;
  /** Sprint 4 commit I — square to glow when the hint is paid.
   *  Computed by the parent via `computeExerciseBfs(piece, exercise)`
   *  so this component stays free of game-logic knowledge. */
  firstStep?: BoardPosition | null;
  /** Called when the hint reveal state changes:
   *   - with `firstStep` → glow the cell
   *   - with `null`      → clear the glow (TTL elapsed) */
  onReveal?: (square: BoardPosition | null) => void;
  /** Test seam — production code passes nothing. */
  submitImpl?: typeof submitPeonesSpend;
};

export function PeonesHintButton({
  piece,
  exerciseId,
  attemptSeq = 1,
  disabled = false,
  firstStep = null,
  onReveal,
  submitImpl,
}: Props) {
  const t = useTranslations("PEONES_HINT_COPY");
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<HintState>({ kind: "idle" });
  /** Track the active TTL timer so navigation + remount cleans up
   *  reliably — otherwise a stale setTimeout could fire `onReveal(null)`
   *  on a new exercise. */
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
        className="pointer-events-auto inline-flex max-w-full items-center truncate rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-amber-900/80 shadow-sm ring-1 ring-amber-800/15"
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

  function scheduleClear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onReveal?.(null);
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
      // Sprint 4 commit G — emit precedence:
      //   1. PRO bypass applied  → peones_spend_bypassed
      //   2. real debit (debited>0) → peones_spent
      //   3. duplicate fresh row (debited=0, no bypass) → no emit
      if (
        result.proBypassApplied &&
        result.quotaLimit != null &&
        result.quotaUsed != null
      ) {
        emitPeonesSpendBypassed({
          target: "hint",
          targetId,
          requested: 1,
          debited: 0,
          newBalance: result.newBalance,
          attestationHash: result.attestationHash,
          quotaUsed: result.quotaUsed,
          quotaLimit: result.quotaLimit,
        });
      } else if (result.debited > 0 && !result.duplicate) {
        // Sprint 4 commit M.1 — emit gate tightened. Duplicate
        // idempotent retries return debited>0 in the response (the
        // ORIGINAL row's amount, not a new debit) but no fresh
        // Peones leave the wallet, so emitting `peones_spent` on
        // duplicate would double-count. Dashboard rule "spent ===
        // real Peones left the wallet" stays intact. Server-side
        // log.info("peones_spend_duplicate_hit") tracks duplicate
        // frequency for ops without polluting client telemetry.
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
      // Glow the board cell + schedule the clear. If firstStep is
      // null (BFS failed / unsolvable) we still credit the spend and
      // surface the revealed state — the player just doesn't get a
      // visual cue, which is rare enough to not warrant a refund flow.
      onReveal?.(firstStep ?? null);
      setState({ kind: "revealed" });
      scheduleClear();
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
      scheduleFeedbackClear();
      return;
    }

    emitPeonesSpendFailed({
      target: "hint",
      targetId,
      requested: 1,
      reason: result.error,
    });
    setState({ kind: "error" });
    scheduleFeedbackClear();
  }

  const isLoading = state.kind === "loading";
  const isRevealed = state.kind === "revealed";
  const isFeedback = state.kind === "insufficient" || state.kind === "error";

  // Sprint 4 commit M — single morphing chip. The chip itself swaps
  // its content based on state instead of stacking a sublabel below.
  // Eliminates the "appears, grows, shrinks again" jitter the user
  // saw with the previous two-line layout.
  const label =
    state.kind === "insufficient"
      ? t("insufficient")
      : state.kind === "error"
        ? t("error")
        : t("button");

  return (
    <div
      className="pointer-events-auto inline-flex"
      data-testid="peones-hint-button"
      data-state={state.kind}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2 pr-3 text-xs font-bold shadow-sm ring-1 transition-colors hover:bg-amber-200 disabled:opacity-80 disabled:hover:bg-white ${
          isFeedback
            ? "bg-white text-amber-900/90 ring-amber-800/15"
            : isRevealed
              ? "bg-amber-200 text-amber-950/70 ring-amber-700/20"
              : "bg-amber-300 text-amber-950 ring-amber-700/30"
        }`}
        aria-busy={isLoading}
        aria-disabled={isLoading || isRevealed || isFeedback}
        disabled={isLoading || isRevealed || isFeedback}
        role={isFeedback ? "status" : undefined}
        aria-live={isFeedback ? "polite" : undefined}
        onClick={() => void handleClick()}
      >
        <img
          src={HINT_ICON_SRC}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0 object-contain"
          draggable={false}
        />
        {label}
      </button>
    </div>
  );
}
