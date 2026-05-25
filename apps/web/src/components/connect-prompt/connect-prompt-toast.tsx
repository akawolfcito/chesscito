"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

import type { ConnectPromptMilestone } from "@/lib/connect-prompt/use-connect-prompt";

type Props = {
  milestone: ConnectPromptMilestone;
  onConnect: () => void;
  onDismiss: () => void;
};

/**
 * Non-blocking nudge shown to disconnected players when they hit a
 * meaningful milestone — ★★★ on a piece, arena victory, or opening
 * the badge sheet with claimables. Pure presentational; the parent
 * owns the `useConnectPrompt` hook and decides when to mount.
 *
 * Copy lives in `CONNECT_PROMPT_COPY` (editorial.ts). Subline is
 * picked per milestone — the title is shared.
 *
 * Layout: candy-tray card with the wallet glyph on the left, a
 * two-line title + subline in the middle, a small dismiss button
 * top-right, and the primary "Connect to save" CTA bottom-right.
 * Designed for the 390px MiniPay viewport — works inside the
 * mission-panel `contextualAction` slot, arena end-state, and the
 * badge sheet header.
 */
export function ConnectPromptToast({ milestone, onConnect, onDismiss }: Props) {
  const t = useTranslations("CONNECT_PROMPT_COPY");
  const subline =
    milestone === "stars"
      ? t("starsSubline")
      : milestone === "victory"
        ? t("victorySubline")
        : t("badgesSubline");

  return (
    <div
      role="alertdialog"
      aria-labelledby="connect-prompt-title"
      aria-describedby="connect-prompt-subline"
      data-component="connect-prompt-toast"
      data-milestone={milestone}
      className="candy-tray w-full"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="connect-prompt-toast-icon flex h-9 w-9 shrink-0 items-center justify-center"
        >
          <CandyIcon name="wallet" className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            id="connect-prompt-title"
            className="text-sm font-bold leading-tight"
            style={{ color: "rgba(63, 34, 8, 0.95)" }}
          >
            {t("title")}
          </p>
          <p
            id="connect-prompt-subline"
            className="mt-0.5 text-xs leading-snug"
            style={{ color: "rgba(110, 65, 15, 0.85)" }}
          >
            {subline}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("dismissAriaLabel")}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 transition active:scale-90"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
          <CandyIcon name="close" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onConnect}
          className="candy-tray-pill hub-hud-pill"
        >
          <CandyIcon
            name="wallet"
            className="candy-tray-pill-icon candy-tray-pill-icon--floating"
          />
          <span>{t("connectCta")}</span>
        </button>
      </div>
    </div>
  );
}
