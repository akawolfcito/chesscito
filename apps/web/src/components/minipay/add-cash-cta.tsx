"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useMiniPay } from "@/hooks/use-minipay";
import { track } from "@/lib/telemetry";

const ADD_CASH_DEEPLINK = "https://minipay.opera.com/add_cash";

type Source = "mint-victory" | "shop-buy" | "coach-credits" | "get-peones" | "season-pass";

type Props = {
  /** Telemetry tag identifying which error surface rendered the CTA. */
  source: Source;
  /** Optional className for surface-specific spacing. */
  className?: string;
};

/**
 * Surfaces the official MiniPay "Add Cash" deeplink to users whose
 * transaction failed with insufficient balance. Renders ONLY when
 * the runtime is MiniPay — outside MiniPay the deeplink does not
 * resolve, so we keep the existing error message uncluttered.
 *
 * Copy is locale-aware via RESULT_OVERLAY_COPY.error.addCashCta:
 *   EN: "Deposit in MiniPay"
 *   ES: "Agregar fondos"
 *
 * Spec: docs/reviews/2026-06-03-low-balance-deeplink-audit.md
 */
export function AddCashCta({ source, className }: Props) {
  const { isMiniPay, isReady } = useMiniPay();
  const t = useTranslations("RESULT_OVERLAY_COPY");

  const handleClick = useCallback(() => {
    track("minipay_add_cash_click", { source });
  }, [source]);

  if (!isReady) return null;
  if (!isMiniPay) return null;

  return (
    <a
      href={ADD_CASH_DEEPLINK}
      target="_self"
      rel="noopener"
      onClick={handleClick}
      className={`arena-result-secondary-action ${className ?? ""}`.trim()}
      data-cta="add-cash"
    >
      <span>{t("error.addCashCta")}</span>
    </a>
  );
}
