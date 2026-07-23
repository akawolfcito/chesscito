"use client";

/**
 * PeonesBalanceChip — Sprint 3 commit G of Training Economy Alpha
 * 2026-06-07. Minimal HUD chip rendering the connected wallet's
 * Peones balance. NO spend, NO top-up, NO pack-purchase. Read-only
 * surface backed by `usePeonesBalance`.
 *
 * Visibility:
 *  - guest    : returns null. Guests do NOT see a balance, NOT even
 *               a placeholder. Per Wolfcito directive 2026-06-07.
 *  - loading  : shows the chip with "…" so the layout reserves the
 *               width and doesn't pop in/out on first paint.
 *  - success  : shows "{balance} Peones".
 *  - error    : shows "Peones --" as a non-aggressive fallback.
 *               NEVER an error banner or modal — the chip is
 *               supposed to be unobtrusive.
 *
 * Visual family: reuses the canonical `candy-tray-pill hub-hud-pill`
 * chip class shared by the trophies chip and the connect chip in
 * `hub-scaffold.tsx`. The icon is the white pawn sprite reused from
 * Training Path (`/art/redesign/pieces/w-pawn.*`) so the chip reads
 * as "Peones currency" instead of clashing visually with the stars
 * chip. TODO(post-Sprint 4): swap for a dedicated Peón-moneda icon
 * once design ships one — keep the AVIF/WebP/PNG fallback chain.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** How long the delta badge stays up. Long enough to read mid-exercise,
 *  short enough that it never sits over the tray while playing. */
const FLASH_TTL_MS = 1800;

/** "+1 Peón" · "−2 Peones · Hint". Uses a real minus sign (U+2212), not
 *  a hyphen, so the number reads as arithmetic at nano size. */
function formatPeonesDelta(
  delta: number,
  reason?: PeonesChangeReason,
): string {
  const magnitude = Math.abs(delta);
  const unit =
    magnitude === 1
      ? PEONES_DELTA_COPY.unitOne
      : PEONES_DELTA_COPY.unitMany;
  const signed = `${delta < 0 ? "−" : "+"}${magnitude} ${unit}`;
  const label = reason ? PEONES_DELTA_COPY.reasons[reason] : null;
  return label ? `${signed} · ${label}` : signed;
}

import { ChesitoCard } from "@/components/peones/chesito-card";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { CHESITO_CARD_COPY, PEONES_DELTA_COPY } from "@/lib/content/editorial";
import {
  subscribeToPeonesChanges,
  type PeonesChangeReason,
} from "@/lib/peones/peones-events";
import {
  emitPeonesBalanceViewed,
  type PeonesBalanceViewSurface,
} from "@/lib/peones/telemetry";
import {
  usePeonesBalance,
  type PeonesBalanceState,
} from "@/lib/peones/use-peones-balance";

type Props = {
  /** Sprint 3 commit G mounts the chip only on `/hub`; the prop keeps
   *  the surface label out of the chip so a future cluster can mount
   *  it on `/exercises`, `/coach`, or `/arena` without code surgery. */
  surface?: PeonesBalanceViewSurface;
  /** Renders the green "+" recharge affordance inside the chip (the whole
   *  chip already opens the recharge card on tap; the "+" makes that
   *  discoverable). Opt-in so surfaces with tight headers stay unchanged. */
  showRecharge?: boolean;
};

type ViewProps = Props & {
  state: PeonesBalanceState;
  /** Called after the recharge card closes, so the chip reflects a balance the
   *  player may have topped up from inside it. */
  onRefetch: () => void;
};

/** The chip, told its balance instead of fetching it.
 *
 *  Split out 2026-07-13 so the LEARN and PLAY hub scaffolds can be mounted in a
 *  `/dev` probe and photographed. The connected `PeonesBalanceChip` below reads
 *  the wallet through `usePeonesBalance` → `useAccount`, and wagmi THROWS when
 *  no WagmiProvider is above it — which the `/dev` layout deliberately does not
 *  mount. A scaffold that renders it cannot be captured; Playwright would write
 *  a PNG of Next's error overlay and pass (it did exactly that with the arena
 *  rails, 0d69e30a).
 *
 *  Same convention as `HubProBadge` and `ArenaPlayerRail`: whatever a probe
 *  photographs receives its truth by prop, never from a wallet hook.
 *
 *  The recharge card (`ChesitoCard`) is still self-contained and still reads the
 *  wallet — but it only mounts on tap, and a hook that never runs cannot throw.
 *  A probe must not open it. */
export function PeonesBalanceChipView({
  state,
  onRefetch,
  surface = "hub",
  showRecharge = false,
}: ViewProps) {
  const refetch = onRefetch;
  /** Chesito Card entry point. Tapping the chip opens the rechargeable card
   *  (its own Top up CTA routes into the Get Peones rail). Guests never see
   *  the chip, so there is no guest entry. Mounted only while open. */
  const [cardOpen, setCardOpen] = useState(false);
  /** Sprint 3 commit H — last balance we emitted `peones_balance_viewed`
   *  for. Re-renders with the same number do not re-emit; a real
   *  balance change does. Cleared implicitly when the component
   *  unmounts. */
  const lastEmittedBalanceRef = useRef<number | null>(null);

  /** Transaction feedback (Peones V1 UX, 2026-07-21).
   *
   *  The delta is DERIVED from the balance actually moving, never from
   *  what a caller claims it spent. That is what makes the two negative
   *  rules hold by construction rather than by discipline:
   *   - an idempotent duplicate re-debits nothing, so the balance is
   *     unchanged and no feedback appears;
   *   - a failed spend never dispatches, so there is no refetch, no
   *     change, and again no feedback.
   *  A "−2" can only ever render because two Peones really left.
   *
   *  The bus supplies only the REASON label; the number is the ledger's. */
  const [flash, setFlash] = useState<{
    delta: number;
    reason?: PeonesChangeReason;
  } | null>(null);
  const previousBalanceRef = useRef<number | null>(null);
  const pendingReasonRef = useRef<PeonesChangeReason | undefined>(undefined);

  // The dispatch lands before the refetch resolves, so park the reason
  // and pair it with the balance change when it arrives.
  useEffect(() => {
    return subscribeToPeonesChanges((reason) => {
      pendingReasonRef.current = reason;
    });
  }, []);

  useEffect(() => {
    if (state.kind !== "success") return;
    const previous = previousBalanceRef.current;
    previousBalanceRef.current = state.balance;

    // First resolved read is a baseline, not a change — otherwise every
    // mount would flash the whole balance as if it had just been earned.
    if (previous === null || previous === state.balance) return;

    setFlash({
      delta: state.balance - previous,
      reason: pendingReasonRef.current,
    });
    pendingReasonRef.current = undefined;

    const id = window.setTimeout(() => setFlash(null), FLASH_TTL_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    if (state.kind !== "success") return;
    if (lastEmittedBalanceRef.current === state.balance) return;
    lastEmittedBalanceRef.current = state.balance;
    emitPeonesBalanceViewed({
      balance: state.balance,
      dailyEarnedCapped: state.dailyEarnedCapped,
      dailyCap: state.dailyCap,
      surface,
    });
  }, [state, surface]);

  // Escape closes the card modal (the scrim handles backdrop + the X handles
  // an explicit tap; this covers keyboard users).
  useEffect(() => {
    if (!cardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCardOpen(false);
        void refetch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardOpen, refetch]);

  if (state.kind === "guest") return null;

  // Visual-first (founder 2026-06-11): the pawn sprite IS the
  // currency; the chip shows the number only, like the trophy chip.
  // The word lives in the aria-label.
  const label =
    state.kind === "success"
      ? `${state.balance}`
      : state.kind === "loading"
        ? "…"
        : "--";

  const ariaLabel =
    state.kind === "success"
      ? `Get Peones. Balance: ${state.balance}`
      : "Get Peones";

  const openSheet = () => setCardOpen(true);
  // Closing the card refetches so the chip reflects a balance the user may
  // have topped up from inside the card.
  const closeCard = () => {
    setCardOpen(false);
    void refetch();
  };

  return (
    <>
      {/* Kept as a <div> (not a <button>) so the chip's pixels are
       *  unchanged — interactivity is added via role/tabIndex/handlers so
       *  no VR baseline drifts. Balance changes still announce via the
       *  inner span's aria-live. */}
      <div
        className={[
          "candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left",
          flash ? (flash.delta < 0 ? "is-pulse-damage" : "is-pulse") : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="button"
        tabIndex={0}
        onClick={openSheet}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSheet();
          }
        }}
        aria-label={ariaLabel}
        data-testid="peones-balance-chip"
        data-state={state.kind}
        style={{ cursor: "pointer" }}
      >
        <ThemeAssetPicture slot="peones.piece" pictureClassName="candy-tray-pill-icon candy-tray-pill-icon--floating" alt="" aria-hidden="true" className="block h-full w-full object-contain p-1" />
        {/* Fixed-width value slot — reserves room for a ~3-digit balance
         *  so the chip keeps a stable width across loading ("…") →
         *  success ("116") → error ("--") and never visually jumps as
         *  the balance resolves (founder 2026-06-15). */}
        <span
          className="peones-balance-chip-value tabular-nums"
          aria-live="polite"
        >
          {label}
        </span>
        {showRecharge ? (
          <span className="peones-chip-plus" aria-hidden="true">
            +
          </span>
        ) : null}
        {/* Floating delta. Non-blocking by construction: it is a sibling
         *  span inside the chip, so it cannot cover the board or swallow
         *  a tap the way a modal would. Announced politely rather than
         *  assertively — a spend the player just initiated is not an
         *  alert. */}
        {flash ? (
          <span
            className={`peones-chip-delta ${flash.delta < 0 ? "is-spend" : "is-earn"}`}
            role="status"
            aria-live="polite"
            data-testid="peones-balance-delta"
          >
            {formatPeonesDelta(flash.delta, flash.reason)}
          </span>
        ) : null}
      </div>

      {/* Portaled to <body>. The chip is mounted inside the /exercises mission
       *  tray, whose `.atmosphere > * { position:relative; z-index:1 }` ancestor
       *  opens a stacking context per child. A fixed modal rendered in-tree is
       *  painted WITHIN the tray's context, so the board — a later sibling with
       *  the same z-index — covers it despite z-[70]. The portal escapes that
       *  context so the modal lands above the board everywhere it mounts
       *  (regression fixed 2026-07-22). Same convention as MissionDetailSheet. */}
      {cardOpen && typeof document !== "undefined"
        ? createPortal(
            // Lightweight centered modal so the Chesito Card "floats" on the
            // scrim (no extra panel frame around the already-framed card).
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              className="candy-modal-scrim pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center animate-in fade-in duration-300"
              role="dialog"
              aria-modal="true"
              aria-label={CHESITO_CARD_COPY.title}
              onClick={closeCard}
            >
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div
                className="relative mx-4 w-full max-w-[360px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeCard}
                  aria-label="Close"
                  className="candy-close-asset-button absolute -right-2 -top-4 z-10"
                >
                  <ThemeAssetPicture slot="shared.close" alt="" aria-hidden="true" className="h-9 w-9 object-contain" draggable={false} />
                </button>
                {/* Card modal is z-[70]; push its Top up sheet above it (default
                 *  z-[55] would render behind the card). */}
                <ChesitoCard rechargeScrimZClassName="z-[75]" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** The chip, wired to the wallet. Reads `usePeonesBalance` (→ wagmi's
 *  `useAccount`) and hands the result to the view above.
 *
 *  Mount this anywhere a WagmiProvider is in scope. Where one is NOT — the
 *  `/dev` probe layout — mount `PeonesBalanceChipView` and pass the state in.
 *  The LEARN and PLAY hub scaffolds do the latter, so that their callers own
 *  every wallet read and the scaffolds stay photographable. */
export function PeonesBalanceChip({ surface = "hub", showRecharge = false }: Props = {}) {
  const { state, refetch } = usePeonesBalance();
  return (
    <PeonesBalanceChipView
      state={state}
      onRefetch={() => void refetch()}
      surface={surface}
      showRecharge={showRecharge}
    />
  );
}
