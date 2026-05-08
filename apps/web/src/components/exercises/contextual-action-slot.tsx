"use client";

import type { ContextAction } from "@/lib/game/context-action";
import { ActionPin } from "@/components/redesign/action-pin";
import { FOOTER_CTA_COPY } from "@/lib/content/editorial";

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
  const { action, shieldsAvailable, isBusy, compact = false } = props;

  if (!action) return null;

  const copy = FOOTER_CTA_COPY[action];
  const handler = getHandler(action, props);
  const fullLabel = isBusy && copy.loading ? copy.loading : copy.label;
  const tone = action === "claimBadge" ? "claim" : "default";

  // useShield surfaces the live shield count via ActionPin's badge slot.
  // Pin mode renders the raw integer (matches /hub's HUD chip pattern);
  // full mode renders the formatted "N left" pill inline.
  const badge =
    action === "useShield" && !isBusy
      ? {
          pin: shieldsAvailable,
          full: FOOTER_CTA_COPY.shieldsLeft(shieldsAvailable),
        }
      : undefined;

  // Slot keeps its entrance-animation wrapper (compact pin vs full
  // bottom-slide). ActionPin owns visual atom + label rendering +
  // state animations.
  if (compact) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-200">
        <ActionPin
          action={action}
          size="pin"
          tone={tone}
          label={copy.compactLabel}
          ariaLabel={fullLabel}
          badge={badge}
          isBusy={isBusy}
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
