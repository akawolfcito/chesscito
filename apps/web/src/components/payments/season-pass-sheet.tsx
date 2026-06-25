"use client";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { formatUsd } from "@/lib/contracts/tokens";
import { getSeasonPass } from "@/lib/payments/rail-config";
import {
  useSeasonPassRail,
  type SeasonPassRailResult,
} from "@/lib/season-pass/use-season-pass-rail";

const SKU = "lite_season_pass_21" as const;
const DEFAULT_TOKEN = "USDC";

export type SeasonPassSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: SeasonPassRailResult) => void;
};

function ShieldIcon() {
  return (
    <span
      aria-hidden="true"
      className="text-5xl leading-none"
      style={{ filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.55))" }}
    >
      🛡️
    </span>
  );
}

export function SeasonPassSheet({ open, onOpenChange, onSuccess }: SeasonPassSheetProps) {
  if (!CHESSCITO_LITE_MODE) return null;
  if (!open) return null;

  return <SeasonPassSheetInner onOpenChange={onOpenChange} onSuccess={onSuccess} />;
}

function SeasonPassSheetInner({
  onOpenChange,
  onSuccess,
}: Omit<SeasonPassSheetProps, "open">) {
  const pass = getSeasonPass(SKU);
  const priceLabel = formatUsd(pass.priceUsd6);

  const rail = useSeasonPassRail({
    sku: SKU,
    tokenSymbol: DEFAULT_TOKEN,
    onVerified: onSuccess,
  });

  const busy =
    rail.phase === "preparing" ||
    rail.phase === "awaiting_signature" ||
    rail.phase === "pending_tx" ||
    rail.phase === "verifying";

  const payLabel =
    rail.phase === "awaiting_signature"
      ? "Confirm in wallet"
      : rail.phase === "pending_tx"
        ? "Sending..."
        : rail.phase === "verifying"
          ? "Verifying..."
          : `Get Pass — ${priceLabel}`;

  const isSuccess = rail.phase === "success" && rail.result;

  return (
    <VictoryPopupShell
      onClose={() => onOpenChange(false)}
      disableBackdropClose={busy}
      ariaLabel="21-Day Mind Challenge Pass"
      closeLabel="Close"
    >
      <div
        className="flex flex-col items-center gap-4 text-center"
        data-testid="season-pass-sheet"
      >
        {isSuccess && rail.result ? (
          <div
            data-testid="season-pass-success"
            className="flex flex-col items-center gap-3"
          >
            <ShieldIcon />
            <p className="arena-result-title">Pass Activated!</p>
            <p className="text-sm opacity-80">
              {rail.result.shieldsCredited > 0
                ? `+${rail.result.shieldsCredited} shields added`
                : "Shields will be credited shortly"}
            </p>
            <p className="text-xs opacity-60">
              Valid for {pass.durationDays} days
            </p>
            {rail.result.duplicate ? (
              <span className="candy-stat-pill text-[0.78rem]">Already active</span>
            ) : null}
            <PrincipalButton
              onClick={() => onOpenChange(false)}
              className="mt-1"
              data-testid="season-pass-done"
            >
              Let&apos;s play!
            </PrincipalButton>
          </div>
        ) : (
          <>
            <ShieldIcon />
            <p className="arena-result-title">21-Day Mind Challenge</p>
            <p className="text-sm opacity-80 max-w-[220px]">
              Unlock unlimited practice with +{pass.shieldsOnPurchase} shields for {pass.durationDays} days.
            </p>

            <span className="candy-stat-pill text-base font-bold">{priceLabel}</span>

            {!rail.available && (
              <p className="text-xs text-amber-400">
                Connect your wallet on Celo to purchase
              </p>
            )}

            {rail.phase === "error" && rail.errorReason && (
              <p className="text-xs text-red-400" data-testid="season-pass-error">
                {rail.errorReason === "wrong_chain"
                  ? "Switch to Celo mainnet"
                  : "Payment failed. Try again."}
              </p>
            )}

            <PrincipalButton
              onClick={rail.pay}
              disabled={!rail.available || busy}
              className="mt-1"
              data-testid="season-pass-pay"
            >
              {payLabel}
            </PrincipalButton>

            <p className="text-[0.7rem] opacity-50">
              Paid with USDC on Celo. No subscription.
            </p>
          </>
        )}
      </div>
    </VictoryPopupShell>
  );
}
