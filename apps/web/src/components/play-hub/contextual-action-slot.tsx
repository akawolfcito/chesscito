"use client";

import type { ContextAction } from "@/lib/game/context-action";
import type { LucideIcon } from "lucide-react";
import { Star, Shield, Award, RotateCcw, Wallet, ArrowLeftRight } from "lucide-react";
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
};

const ACTION_STYLES: Record<
  Exclude<ContextAction, null>,
  { bg: string; glow: string; text: string }
> = {
  submitScore: {
    bg: "bg-gradient-to-b from-[#23C8F3] to-[#16A9E0]",
    glow: "shadow-[0_0_20px_rgba(35,200,243,0.24)]",
    text: "text-white",
  },
  useShield: {
    bg: "bg-gradient-to-b from-[#F6A400] to-[#EE8B00]",
    glow: "shadow-[0_0_20px_rgba(246,164,0,0.22)]",
    text: "text-[#FFF8ED]",
  },
  claimBadge: {
    bg: "bg-gradient-to-b from-[#9B59FF] to-[#7B3FF2]",
    glow: "shadow-[0_0_20px_rgba(155,89,255,0.22)]",
    text: "text-white",
  },
  retry: {
    bg: "bg-[rgba(148,170,210,0.14)]",
    glow: "",
    text: "text-[rgba(234,242,255,0.82)]",
  },
  connectWallet: {
    bg: "bg-gradient-to-b from-[#23C8F3] to-[#16A9E0]",
    glow: "shadow-[0_0_20px_rgba(35,200,243,0.24)]",
    text: "text-white",
  },
  switchNetwork: {
    bg: "bg-gradient-to-b from-[#F6A400] to-[#EE8B00]",
    glow: "shadow-[0_0_20px_rgba(246,164,0,0.22)]",
    text: "text-[#FFF8ED]",
  },
};

const ACTION_ICON: Record<Exclude<ContextAction, null>, LucideIcon> = {
  submitScore: Star,
  useShield: Shield,
  claimBadge: Award,
  retry: RotateCcw,
  connectWallet: Wallet,
  switchNetwork: ArrowLeftRight,
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
  const { action, shieldsAvailable, isBusy } = props;

  if (!action) return null;

  const copy = FOOTER_CTA_COPY[action];
  const style = ACTION_STYLES[action];
  const handler = getHandler(action, props);
  const label = isBusy && copy.loading ? copy.loading : copy.label;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <button
        type="button"
        onClick={handler}
        disabled={isBusy}
        className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold uppercase tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] transition-all active:scale-[0.97] active:shadow-none active:brightness-90 disabled:opacity-70 ${style.bg} ${style.glow} ${style.text} ${action === "retry" ? "border border-[rgba(190,210,255,0.08)]" : ""}`}
      >
        {isBusy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          (() => { const Icon = ACTION_ICON[action]; return <Icon size={18} />; })()
        )}
        <span>{label}</span>
        {action === "useShield" && !isBusy ? (
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            {FOOTER_CTA_COPY.shieldsLeft(shieldsAvailable)}
          </span>
        ) : null}
      </button>
    </div>
  );
}
