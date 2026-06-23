"use client";

/**
 * ChesitoCard — the rechargeable "wallet" surface (2026-06-15).
 *
 * Frames the connected player's Peones balance like a debit/credit card so
 * the spend economy reads as one recognizable place ("recharge and keep
 * playing") instead of scattered pack prompts. Visual-first, NO new payment
 * logic: the Top up CTA opens the existing GetPeonesSheet rail.
 *
 * Self-contained on purpose — it reads `usePeonesBalance` and mounts its own
 * GetPeonesSheet, so it drops into any surface with zero wiring:
 *   - hero at the top of the Account sheet
 *   - inside the modal opened by the Peones HUD chip
 *
 * Balance states mirror the HUD chip: success → number, loading → "…",
 * guest/error → "--" (never an aggressive error). Guests reaching the card
 * (e.g. via the Account sheet) still see the frame; the chip itself hides for
 * guests upstream.
 */

import { useState } from "react";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { GetPeonesSheet } from "@/components/payments/get-peones-sheet";
import { CHESITO_CARD_COPY } from "@/lib/content/editorial";
import { usePeonesBalance } from "@/lib/peones/use-peones-balance";

type Props = {
  className?: string;
};

export function ChesitoCard({ className = "" }: Props) {
  const { state, refetch } = usePeonesBalance();
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const balanceLabel =
    state.kind === "success"
      ? String(state.balance)
      : state.kind === "loading"
        ? "…"
        : "--";

  return (
    <>
      <section
        className={`chesito-card ${className}`.trim()}
        data-testid="chesito-card"
        aria-label={CHESITO_CARD_COPY.title}
      >
        <div className="chesito-card-content">
          <header className="chesito-card-head">
            <CandyIcon name="crown" className="chesito-card-crown" />
            <h3 className="chesito-card-title">{CHESITO_CARD_COPY.title}</h3>
          </header>

          <div className="chesito-card-divider" aria-hidden="true">
            <CandyIcon name="star" className="chesito-card-spark" />
          </div>

          <div className="chesito-card-balance">
            <span className="chesito-card-balance-num tabular-nums" aria-live="polite">
              {balanceLabel}
            </span>
            <span className="chesito-card-balance-unit">{CHESITO_CARD_COPY.unit}</span>
          </div>
          <p className="chesito-card-caption">{CHESITO_CARD_COPY.caption}</p>

          <button
            type="button"
            className="chesito-card-cta"
            onClick={() => setRechargeOpen(true)}
            aria-label={CHESITO_CARD_COPY.topUpAria}
          >
            <span className="chesito-card-cta-plus" aria-hidden="true">
              +
            </span>
            {CHESITO_CARD_COPY.topUp}
          </button>
        </div>

        <picture className="chesito-card-art">
          <source srcSet="/art/new-icons-chesscito/peon-piece-v1.avif" type="image/avif" />
          <source srcSet="/art/new-icons-chesscito/peon-piece-v1.webp" type="image/webp" />
          <img
            src="/art/new-icons-chesscito/peon-piece-v1.png"
            alt=""
            draggable={false}
          />
        </picture>
      </section>

      {rechargeOpen ? (
        <GetPeonesSheet
          open={rechargeOpen}
          onOpenChange={setRechargeOpen}
          onSuccess={() => void refetch()}
        />
      ) : null}
    </>
  );
}
