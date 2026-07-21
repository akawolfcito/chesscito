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
 *  - idle         : pill "Hint · 2 Peones".
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
import { SPEND_COST_BY_TARGET } from "@/lib/peones/spend-service";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

/** Peones price of one hint. Read from the canonical table so the chip
 *  copy (PEONES_HINT_COPY, which spells the number out) and the debit
 *  move together. */
const HINT_PEONES_COST = SPEND_COST_BY_TARGET.hint;

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
/** Format-negotiated hint sprite — the raw PNG is 52KB while the avif
 *  sibling is 8KB, and /exercises is the slowest route of the app. */
function HintIcon() {
  return (
    <ThemeAssetPicture slot="peones.hint" alt="" aria-hidden="true" className="object-contain" draggable={false} />
  );
}

type HintState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "revealed" }
  | { kind: "insufficient" }
  /** Transient 429 — separate from `error` so the chip can say
   *  "try again in a moment" instead of reading as broken (founder
   *  hint-race report 2026-06-10: the spend worked after a delay,
   *  but the generic copy made it look unavailable). */
  | { kind: "rate_limited" }
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

  // Guest path — muted pin, no fetch. Founder action-row pass
  // (2026-06-11): the pin keeps its sprite so the row stays uniform;
  // the connect nudge lives in the aria-label, not a long chip.
  if (!isConnected || !address) {
    return (
      <div
        className="action-pin action-pin--pin flex flex-col items-center gap-1 opacity-50"
        role="status"
        aria-label={t("guest")}
        data-testid="peones-hint-button"
        data-state="guest"
      >
        <span className="action-pin-submit-pedestal relative flex shrink-0 items-center justify-center">
          <HintIcon />
        </span>
        <span className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]">
          {t("pinLabel")}
        </span>
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
      amount: HINT_PEONES_COST,
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
          requested: HINT_PEONES_COST,
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
          requested: HINT_PEONES_COST,
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
        requested: HINT_PEONES_COST,
        reason: "insufficient_balance",
      });
      setState({ kind: "insufficient" });
      scheduleFeedbackClear();
      return;
    }

    emitPeonesSpendFailed({
      target: "hint",
      targetId,
      requested: HINT_PEONES_COST,
      reason: result.error,
    });
    setState(
      result.error === "rate_limited"
        ? { kind: "rate_limited" }
        : { kind: "error" },
    );
    scheduleFeedbackClear();
  }

  const isLoading = state.kind === "loading";
  const isRevealed = state.kind === "revealed";
  const isFeedback =
    state.kind === "insufficient" ||
    state.kind === "rate_limited" ||
    state.kind === "error";

  // Founder action-row pass (2026-06-11) — the chip became a PIN so
  // HINT sits in the dock action row like SAVE/CLAIM: bare sprite +
  // nano label below. The label is the morphing surface (idle shows
  // the pin name; feedback states swap it), and a successful reveal
  // gets the green check marker from the check/dot system.
  const label =
    state.kind === "insufficient"
      ? t("insufficient")
      : state.kind === "rate_limited"
        ? t("rateLimited")
        : state.kind === "error"
          ? t("error")
          : t("pinLabel");

  return (
    <div
      className="action-pin action-pin--pin pointer-events-auto flex flex-col items-center gap-1"
      data-testid="peones-hint-button"
      data-state={state.kind}
    >
      <button
        type="button"
        className="action-pin-submit-pedestal relative flex shrink-0 items-center justify-center disabled:opacity-70"
        aria-label={t("button")}
        aria-busy={isLoading}
        aria-disabled={isLoading || isRevealed || isFeedback}
        disabled={isLoading || isRevealed || isFeedback}
        onClick={() => void handleClick()}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <HintIcon />
        )}
        {isRevealed ? (
          <span
            aria-hidden="true"
            className="action-pin-status action-pin-status--done"
          >
            ✓
          </span>
        ) : null}
      </button>
      <span
        className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]"
        role={isFeedback ? "status" : undefined}
        aria-live={isFeedback ? "polite" : undefined}
      >
        {label}
      </span>
    </div>
  );
}
