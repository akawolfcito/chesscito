"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { formatUsd } from "@/lib/contracts/tokens";
import { CHAIN_NAMES } from "@/lib/content/editorial";

type SelectedItem = {
  label: string;
  subtitle: string;
  icon: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
};

type PurchaseConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: SelectedItem | null;
  chainId: number | undefined;
  shopAddress: string | null;
  paymentTokenSymbol: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isWriting: boolean;
  purchasePhase: "idle" | "approving" | "buying";
  onConfirm: () => void;
};

const FADE_MS = 300;

/**
 * Confirm Purchase modal (panel-mision shell — Register A).
 *
 * GENERIC TEMPLATE — reuse this for any future Shop item still on the
 * approve+buyItem rail (PRO and Coach/Shield moved off it onto the
 * no-approve Peones/treasury rail as of 2026-07). `selectedItem` is a
 * plain {label, subtitle, icon, price} shape, not hardcoded per-SKU —
 * a new item just needs a catalog entry + SHOP_TILE_ASSETS icon, no
 * changes here. Founder Badge is the one remaining live consumer.
 *
 * Replaces the earlier Radix bottom-Sheet that mixed cream
 * ContextualHeader with a brown `game-solid` confirm CTA. Now
 * adopts the same WARM UP vocabulary (`panel-mision-icon` frame,
 * red ⊗ close, `fantasy-title` + `adorno-icon` divider, per-SKU
 * icon at top-left, cream price pill with plant flanks, status
 * + network info rows, green soft-gate primary, lock + shield
 * trust footer).
 *
 * Same control surface as the previous implementation —
 * `selectedItem`, `purchasePhase`, `onConfirm` all unchanged so
 * callers don't migrate. Adds `selectedItem.icon` + `subtitle`
 * which the catalog already carries via `SHOP_TILE_ASSETS`.
 */
export function PurchaseConfirmSheet({
  open,
  onOpenChange,
  selectedItem,
  chainId,
  shopAddress,
  paymentTokenSymbol,
  isConnected,
  isCorrectChain,
  isWriting,
  purchasePhase,
  onConfirm,
}: PurchaseConfirmSheetProps) {
  const t = useTranslations("PURCHASE_CONFIRM_COPY");
  const tField = useTranslations("PURCHASE_FIELD_LABELS");
  const tShop = useTranslations("SHOP_SHEET_COPY");

  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && purchasePhase === "idle") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onOpenChange, purchasePhase]);

  if (!mounted || !selectedItem) return null;

  const statusLabel = selectedItem.configured
    ? selectedItem.enabled
      ? tShop("status.available")
      : tShop("status.unavailable")
    : tShop("status.notConfigured");
  const statusTone =
    selectedItem.configured && selectedItem.enabled ? "active" : "inactive";
  const networkLabel = chainId
    ? (CHAIN_NAMES[chainId] ?? t("unknownNetwork"))
    : "—";
  const confirmDisabled =
    isWriting ||
    purchasePhase !== "idle" ||
    !shopAddress ||
    !paymentTokenSymbol ||
    !isConnected ||
    !isCorrectChain ||
    !selectedItem.configured ||
    !selectedItem.enabled;
  /* Resolve the single reason the Confirm CTA is disabled so the
   * modal can render a calm hint underneath instead of leaving the
   * user guessing. Order matches the most actionable first: connect
   * wallet > switch network > top up balance > item unavailable.
   * In-flight states (writing / approving / buying) bypass the hint
   * — the spinner + button label already communicate progress. */
  const disabledHint = (() => {
    if (isWriting || purchasePhase !== "idle") return null;
    if (!isConnected) return t("disabledHintConnect");
    if (!isCorrectChain) return t("disabledHintNetwork");
    if (!paymentTokenSymbol) return t("disabledHintBalance");
    if (!selectedItem.configured || !selectedItem.enabled)
      return t("disabledHintUnavailable");
    return null;
  })();
  const confirmLabel =
    purchasePhase === "approving"
      ? t("approving", { token: paymentTokenSymbol ?? "" })
      : purchasePhase === "buying"
        ? t("buying")
        : t("confirmButton");

  /* Type-D system modal that blocks the dock for the wallet round-trip.
   * The dock + its wrapper compose a stacking context at z-60 that
   * Tailwind utilities at z-[60..65] don't reliably beat, so we
   * commit to an inline `zIndex: 1000` here — high enough to win
   * the body-level paint order while staying well below any
   * future runtime debug overlay. `candy-modal-scrim` is duplicated
   * as an inline `backgroundColor` because the class lives inside
   * `@layer base` and a previous render order issue left the layer
   * style intermittently un-applied; the inline declaration is the
   * paint of last resort. createPortal mounts to document.body so
   * the modal escapes the persistent-dock wrapper's z-60 stacking
   * context entirely. */
  const modal = (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className={`pointer-events-auto fixed inset-0 flex items-center justify-center transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.60)", zIndex: 1000 }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="purchase-confirm-modal-title"
      onClick={() => {
        if (purchasePhase === "idle") onOpenChange(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain transition-opacity duration-300 ${
          exiting ? "opacity-0" : "animate-in fade-in duration-300"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full"
          style={{
            backgroundImage:
              'image-set(url("/art/screen-mission/panel-mision-icon.avif") type("image/avif"), url("/art/screen-mission/panel-mision-icon.webp") type("image/webp"), url("/art/screen-mission/panel-mision-icon.png") type("image/png"))',
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Red ⊗ close, suppressed while a transaction is in flight
           *  so the user doesn't half-cancel a wallet signature. */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("closeAriaLabel")}
            disabled={purchasePhase !== "idle"}
            className="candy-close-asset-button absolute right-[4%] top-[4%] z-10 disabled:opacity-50"
          >
            <picture>
              <source srcSet="/art/screen-mission/close-icon.avif" type="image/avif" />
              <source srcSet="/art/screen-mission/close-icon.webp" type="image/webp" />
              <img
                src="/art/screen-mission/close-icon.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 object-contain"
                draggable={false}
              />
            </picture>
          </button>

          {/* SKU icon — floats at top-left as a separate decorative
           *  element so the centered title doesn't compete with the
           *  close ⊗ for horizontal space. */}
          <picture className="pointer-events-none absolute left-[6%] top-[5%] z-[1]">
            <source srcSet={`${selectedItem.icon}.avif`} type="image/avif" />
            <source srcSet={`${selectedItem.icon}.webp`} type="image/webp" />
            <img
              src={`${selectedItem.icon}.png`}
              alt=""
              aria-hidden="true"
              className="h-14 w-14 object-contain drop-shadow-[0_3px_6px_rgba(120,65,5,0.35)]"
              draggable={false}
            />
          </picture>

          <div className="flex flex-col items-center px-[8%] pt-[6%] pb-[5%]">
            {/* Centered small-caps title between adorno flanks. The
             *  SKU icon (left) and close ⊗ (right) live as absolute
             *  siblings so the title can sit symmetrically. */}
            <h2
              id="purchase-confirm-modal-title"
              className="fantasy-title text-base font-extrabold uppercase tracking-wide"
              style={{
                color: "var(--popup-title-color)",
                textShadow: "var(--popup-title-text-shadow)",
              }}
            >
              {t("title")}
            </h2>

            {/* Item identity — name (h3) + subtitle. */}
            <p
              className="mt-3 text-center text-xl font-extrabold leading-tight"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
              }}
            >
              {selectedItem.label}
            </p>
            <p
              className="mt-1 text-center text-xs font-medium leading-snug"
              style={{
                color: "rgba(110, 65, 15, 0.75)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {selectedItem.subtitle}
            </p>

            {/* Adorno divider. */}
            <picture>
              <source srcSet="/art/screen-mission/adorno-icon.avif" type="image/avif" />
              <source srcSet="/art/screen-mission/adorno-icon.webp" type="image/webp" />
              <img
                src="/art/screen-mission/adorno-icon.png"
                alt=""
                aria-hidden="true"
                className="mt-3 h-3 w-32 object-contain"
                draggable={false}
              />
            </picture>

            {/* Price pill — cream with plant flanks. */}
            <div className="purchase-confirm-price-pill mt-3">
              <picture>
                <source srcSet="/art/new-assets-chesscito/plant1.avif" type="image/avif" />
                <source srcSet="/art/new-assets-chesscito/plant1.webp" type="image/webp" />
                <img
                  src="/art/new-assets-chesscito/plant1.png"
                  alt=""
                  aria-hidden="true"
                  className="purchase-confirm-price-flank"
                  draggable={false}
                />
              </picture>
              <span className="purchase-confirm-price-value">
                {formatUsd(selectedItem.onChainPrice)}
              </span>
              <picture>
                <source srcSet="/art/new-assets-chesscito/plant1.avif" type="image/avif" />
                <source srcSet="/art/new-assets-chesscito/plant1.webp" type="image/webp" />
                <img
                  src="/art/new-assets-chesscito/plant1.png"
                  alt=""
                  aria-hidden="true"
                  className="purchase-confirm-price-flank purchase-confirm-price-flank--mirror"
                  draggable={false}
                />
              </picture>
            </div>

            {/* Status + Network info block. */}
            <div className="purchase-confirm-info mt-3 w-full">
              <div className="purchase-confirm-info-row">
                <span className="purchase-confirm-info-dot" data-tone={statusTone}>
                  <CandyIcon name="check" className="h-3 w-3" />
                </span>
                <span className="purchase-confirm-info-label">
                  {tField("status")}:
                </span>
                <span
                  className="purchase-confirm-info-value"
                  style={{
                    color:
                      statusTone === "active"
                        ? "rgb(21, 128, 61)"
                        : "rgba(63, 34, 8, 0.95)",
                  }}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="purchase-confirm-info-row">
                <span className="purchase-confirm-info-dot" data-tone="celo">
                  <CandyIcon name="wallet" className="h-3 w-3" />
                </span>
                <span className="purchase-confirm-info-label">
                  {tField("network")}:
                </span>
                <span className="purchase-confirm-info-value">
                  {networkLabel}
                </span>
              </div>
            </div>

            {/* Primary confirm CTA — soft-gate green pill. */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="arena-scaffold-soft-gate-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(isWriting || purchasePhase !== "idle") && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {confirmLabel}
            </button>

            {/* Disabled reason hint — rendered only when the CTA is
             *  blocked and not in-flight, so the user knows WHAT to
             *  do next instead of staring at a grey button. */}
            {disabledHint ? (
              <p
                className="mt-2 text-center text-[0.7rem] font-semibold"
                style={{ color: "rgba(159, 18, 57, 0.85)" }}
              >
                {disabledHint}
              </p>
            ) : null}

            {/* MiniPay reassurance + lock. */}
            <p
              className="mt-3 flex items-center justify-center gap-1.5 text-center text-[0.7rem] font-semibold"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              <CandyIcon name="lock" className="h-3 w-3" />
              {t("minipayHint")}
            </p>

            {/* Secure payment footer. */}
            <p
              className="mt-2 flex items-center justify-center gap-1.5 text-center text-[0.65rem]"
              style={{ color: "rgba(110, 65, 15, 0.6)" }}
            >
              <CandyIcon name="shield" className="h-3 w-3" />
              {t("securePayment")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
