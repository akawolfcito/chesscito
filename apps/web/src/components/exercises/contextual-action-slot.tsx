"use client";

import { useTranslations } from "next-intl";

import type { ContextAction } from "@/lib/game/context-action";
import { ActionPin } from "@/components/redesign/action-pin";

type ContextualActionSlotProps = {
  action: ContextAction;
  shieldsAvailable: number;
  isBusy: boolean;
  onSubmitScore: () => void;
  onUseShield: () => void;
  onClaimBadge: () => void;
  onRetry: () => void;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  /** When true, progressive actions collapse to a 44×44 icon pin that
   *  sits inline with the mission peek row. */
  compact?: boolean;
};

function getHandler(
  action: Exclude<ContextAction, null>,
  props: ContextualActionSlotProps
): () => void {
  switch (action) {
    case "submitScore": return props.onSubmitScore;
    case "useShield": return props.onUseShield;
    case "claimBadge": return props.onClaimBadge;
    case "retry": return props.onRetry;
    case "connectWallet": return props.onConnectWallet;
    case "switchNetwork": return props.onSwitchNetwork;
  }
}

export function ContextualActionSlot(props: ContextualActionSlotProps) {
  const t = useTranslations("FOOTER_CTA_COPY");
  const { action, shieldsAvailable, isBusy, compact = false } = props;

  if (!action) return null;

  const label = t(`${action}.label`);
  const compactLabel = t(`${action}.compactLabel`);
  const loadingKey = `${action}.loading`;
  // Loading copy is only defined for the in-flight actions; the others
  // (retry / connectWallet / switchNetwork) have `loading: null` in the
  // editorial source so we fall back to the regular label.
  const loadingLabel = isBusy && hasLoading(action) ? t(loadingKey) : null;
  const handler = getHandler(action, props);
  const fullLabel = loadingLabel ?? label;
  const tone = action === "claimBadge" ? "claim" : "default";

  // useShield surfaces the live shield count via ActionPin's badge slot.
  // Pin mode renders the raw integer (matches /hub's HUD chip pattern);
  // full mode renders the formatted "N left" pill inline.
  const badge =
    action === "useShield" && !isBusy
      ? {
          pin: shieldsAvailable,
          full: t("shieldsLeft", { count: shieldsAvailable }),
        }
      : undefined;

  // Slot keeps its entrance-animation wrapper (compact pin vs full
  // bottom-slide). ActionPin owns visual atom + label rendering +
  // state animations.
  // Check/dot system (2026-06-11): SAVE and CLAIM pins only mount
  // while their action is actually takeable, so they carry the
  // pending dot — the row reads "these are waiting for you".
  const status =
    action === "submitScore" || action === "claimBadge" ? "pending" : null;

  if (compact) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-200">
        <ActionPin
          action={action}
          size="pin"
          tone={tone}
          label={compactLabel}
          ariaLabel={fullLabel}
          badge={badge}
          isBusy={isBusy}
          status={status}
          onPress={handler}
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <ActionPin
        action={action}
        size="full"
        tone={tone}
        label={fullLabel}
        ariaLabel={fullLabel}
        badge={badge}
        isBusy={isBusy}
        onPress={handler}
      />
    </div>
  );
}

function hasLoading(action: Exclude<ContextAction, null>): boolean {
  return action === "submitScore" || action === "useShield" || action === "claimBadge";
}
