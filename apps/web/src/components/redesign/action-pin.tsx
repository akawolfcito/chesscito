"use client";

import type { ReactNode } from "react";

import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import {
  ActionRowIcon,
  type ActionRowIconName,
} from "@/components/action-row/action-row-icon";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { hapticTap } from "@/lib/haptics";

export type ActionPinAction =
  | "submitScore"
  | "useShield"
  | "claimBadge"
  | "retry"
  | "connectWallet"
  | "switchNetwork";

export type ActionPinSize = "pin" | "full";
export type ActionPinTone = "default" | "claim";
export type Atmosphere = "adventure" | "scholarly";

export type ActionPinBadgeContent = {
  /** Rendered when size="pin". Typically a raw value (e.g. shield count). */
  pin?: ReactNode;
  /** Rendered when size="full". Typically a formatted phrase. */
  full?: ReactNode;
};

type Props = {
  action: ActionPinAction;
  size: ActionPinSize;
  /** Visual tone. `"claim"` swaps the gradient for `candy-frame
   *  candy-frame-gold` — used by `claimBadge`. Default `"default"`. */
  tone?: ActionPinTone;
  /** Visible label. Always rendered by the primitive — orchestrators MUST
   *  NOT render their own label. On `size="pin"` the label is rendered as
   *  an external `<span class="action-pin-label">` BELOW the button. On
   *  `size="full"` it is rendered inline inside the button. */
  label: string;
  /** Accessibility name for the button. Often equals `label`; may differ
   *  when a contextual modifier is needed (e.g. "Use shield (3 left)"). */
  ariaLabel: string;
  badge?: ActionPinBadgeContent;
  /** Visual register. Adventure (default) = kingdom canon; Scholarly is
   *  reserved for future Scholarly slot consumers. */
  atmosphere?: Atmosphere;
  /** Loading flag. Wires `aria-busy` and renders the spinner in place of
   *  the icon. Blocks `onPress`. Distinct from `disabled`. */
  isBusy?: boolean;
  /** Disabled flag. Sets the button `disabled` attribute and applies
   *  `is-disabled`. Does NOT set `aria-busy`. Blocks `onPress`. */
  disabled?: boolean;
  onPress: () => void;
  className?: string;
};

const ACTION_STYLES: Record<
  ActionPinAction,
  { bg: string; glow: string; text: string }
> = {
  submitScore: {
    bg: "bg-gradient-to-b from-[var(--cta-brand-from)] to-[var(--cta-brand-to)]",
    glow: "shadow-[var(--cta-brand-glow)]",
    text: "text-white",
  },
  useShield: {
    bg: "bg-gradient-to-b from-[var(--cta-reward-from)] to-[var(--cta-reward-to)]",
    glow: "shadow-[var(--cta-reward-glow)]",
    text: "text-[var(--cta-reward-text)]",
  },
  claimBadge: {
    bg: "bg-gradient-to-b from-[var(--cta-special-from)] to-[var(--cta-special-to)]",
    glow: "shadow-[var(--cta-special-glow)]",
    text: "text-white",
  },
  retry: {
    bg: "bg-[var(--cta-muted-bg)]",
    glow: "",
    text: "text-[var(--cta-muted-text)]",
  },
  connectWallet: {
    bg: "bg-gradient-to-b from-[var(--cta-brand-from)] to-[var(--cta-brand-to)]",
    glow: "shadow-[var(--cta-brand-glow)]",
    text: "text-white",
  },
  switchNetwork: {
    bg: "bg-gradient-to-b from-[var(--cta-reward-from)] to-[var(--cta-reward-to)]",
    glow: "shadow-[var(--cta-reward-glow)]",
    text: "text-[var(--cta-reward-text)]",
  },
};

const ACTION_ICON: Record<ActionPinAction, CandyIconName> = {
  submitScore: "check",
  useShield: "shield",
  claimBadge: "trophy",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};

const ACTION_ROW_ICON: Record<ActionPinAction, ActionRowIconName> = {
  submitScore: "pergamino-tactico",
  useShield: "shield-king",
  claimBadge: "trofeo-epico",
  retry: "refresh",
  connectWallet: "wallet",
  switchNetwork: "refresh",
};

const PIN_BADGE_CLASSES =
  "absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[0.6rem] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]";
const FULL_BADGE_CLASSES =
  "ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold";
const PRINCIPAL_BADGE_CLASSES =
  "ml-2 rounded-full bg-[rgba(110,65,15,0.18)] px-2 py-0.5 text-xs font-semibold text-[rgba(63,34,8,0.85)]";

/** Actions whose `size="full"` variant renders as a diegetic
 *  `<PrincipalButton>` instead of the legacy candy-frame full button.
 *  These are ceremonial actions — the player feels each tap as a small
 *  ritual (claim, submit a score, spend a saved shield). Utility
 *  actions (retry, connectWallet, switchNetwork) stay candy-frame
 *  because they're recovery/setup, not kingdom progression. Pin size
 *  (44×44 round) keeps candy-frame across all actions: the geometry
 *  doesn't fit PrincipalButton (280×80) and the pin slot is a peer of
 *  the action row, not a hero CTA. */
const CEREMONIAL_FULL_ACTIONS: readonly ActionPinAction[] = [
  "submitScore",
  "useShield",
  "claimBadge",
];

const PIN_BUTTON_LAYOUT =
  "relative flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-70";
const FULL_BUTTON_LAYOUT =
  "flex h-[52px] w-full items-center justify-center gap-2 text-sm font-extrabold uppercase tracking-wide disabled:opacity-70";

/** Visual atom for the contextual action slot. 44×44 circular pin OR 52px
 *  full-width button with per-action gradient + optional candy-frame-gold
 *  tone for `claimBadge`. The orchestrator (`<ContextualActionSlot>`) owns
 *  layout/entrance animations, dispatch, compact-vs-full mode, and the
 *  shield 6s window; this primitive owns the visual atom only. */
export function ActionPin({
  action,
  size,
  tone = "default",
  label,
  ariaLabel,
  badge,
  atmosphere = "adventure",
  isBusy = false,
  disabled = false,
  onPress,
  className = "",
}: Props) {
  const inert = isBusy || disabled;

  const handleClick = () => {
    if (inert) {
      return;
    }
    hapticTap();
    onPress();
  };

  const rootClasses = [
    "action-pin",
    `action-pin--${size}`,
    `is-atmosphere-${atmosphere}`,
    size === "pin" ? "flex flex-col items-center gap-1" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const isSubmitPedestalPin = size === "pin" && action === "submitScore";
  const baseLayout = size === "pin" ? PIN_BUTTON_LAYOUT : FULL_BUTTON_LAYOUT;
  const shape = size === "pin" ? "rounded-full" : "rounded-2xl";

  const toneClasses =
    isSubmitPedestalPin
      ? "action-pin-submit-pedestal"
      : tone === "claim"
        ? "candy-frame candy-frame-gold action-pin-attention"
        : (() => {
            const s = ACTION_STYLES[action];
            const border =
              action === "retry"
                ? " border border-[var(--cta-muted-border)]"
                : "";
            return `game-cta-depth ${shape} ${s.bg} ${s.glow} ${s.text}${border}`.trim();
          })();

  const buttonClasses = [
    baseLayout,
    toneClasses,
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const iconNode = isBusy ? (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  ) : size === "pin" ? (
    <ActionRowIcon
      name={ACTION_ROW_ICON[action]}
      className="h-8 w-8 object-contain"
    />
  ) : (
    <CandyIcon name={ACTION_ICON[action]} className="h-5 w-5" />
  );

  // Vocabulary unification (sprint 1A) — diegetic ceremonial CTAs via
  // composition with <PrincipalButton>. Originally only the claim path
  // was migrated in M3.5; this extends to submitScore + useShield (the
  // other two ceremonial full-size actions). Utility actions (retry,
  // connectWallet, switchNetwork) and ALL pin-size variants keep the
  // candy-frame treatment — geometry and intent don't match the
  // gold-carved primary CTA.
  if (size === "full" && CEREMONIAL_FULL_ACTIONS.includes(action)) {
    return (
      <div
        data-component="action-pin"
        data-action={action}
        data-size={size}
        data-tone={tone}
        className={rootClasses}
      >
        <PrincipalButton
          size="large"
          leadingIcon={
            isBusy ? undefined : (
              <CandyIcon name={ACTION_ICON[action]} className="h-5 w-5" />
            )
          }
          onClick={handleClick}
          disabled={disabled}
          loading={isBusy}
          aria-label={ariaLabel}
        >
          <span>{label}</span>
          {badge?.full != null ? (
            <span aria-hidden="true" className={PRINCIPAL_BADGE_CLASSES}>
              {badge.full}
            </span>
          ) : null}
        </PrincipalButton>
      </div>
    );
  }

  return (
    <div
      data-component="action-pin"
      data-action={action}
      data-size={size}
      data-tone={tone}
      className={rootClasses}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={inert}
        aria-label={ariaLabel}
        aria-busy={isBusy || undefined}
        className={buttonClasses}
      >
        {iconNode}
        {size === "full" ? <span>{label}</span> : null}
        {size === "pin" && badge?.pin != null ? (
          <span aria-hidden="true" className={PIN_BADGE_CLASSES}>
            {badge.pin}
          </span>
        ) : null}
        {size === "full" && badge?.full != null ? (
          <span aria-hidden="true" className={FULL_BADGE_CLASSES}>
            {badge.full}
          </span>
        ) : null}
      </button>
      {size === "pin" ? (
        <span
          aria-hidden="true"
          className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]"
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
