"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { GLOBAL_STATUS_BAR_COPY, HUD_COPY } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { HudResourceChip } from "@/components/hud/hud-resource-chip";

// ─────────────────────────────────────────────────────────────────────────────
// Types — discriminated union per variant.
//
// Full contract: docs/specs/ui/global-status-bar-spec-2026-05-02.md (v1)
// Design-system entry: DESIGN_SYSTEM.md §10.7
//
// Growth rule (spec §5): variants are reserved for STRUCTURAL layout
// differences only. Data slots (level, streak, currency) added in v2+
// land as typed props on `ConnectedProps`, NOT as new variants. A new
// variant requires a written justification + design-system owner sign-off.
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors the ProStatus type from `@/lib/pro/use-pro-status` so callers
 *  may pass the hook return through directly. Re-declared (not imported)
 *  to keep this primitive a pure layout component with no PRO-fetching
 *  coupling. */
export type GlobalStatusBarProStatus = {
  active: boolean;
  expiresAt: number | null;
};

export type ConnectedIdentity = {
  /** Future: ENS / Talent Protocol / on-chain handle. v1 always omits. */
  handle?: string;
  /** Truncated `0x` address. Format: `0xABCD…1234` (10 visible chars).
   *  Use `formatWalletShort` from `@/lib/wallet/format` to produce. */
  walletShort: string;
  /** Future: avatar URL. v1 uses the default candy silhouette. */
  avatarUrl?: string;
};

export type AnonymousProps = {
  variant: "anonymous";
  ariaLabel?: string;
  /** Optional frame-level back navigation (e.g. /exercises → /hub).
   *  Renders a chevron-left chip on the far left of the bar when
   *  defined. Omit on the surface that IS the hub. Structural, not a
   *  feature tap — counterpart to `onProTap` on the right edge. */
  onBack?: () => void;
  /** Optional signal to render a more passive/compact Z1 for core
   *  gameplay screens where the board is the hero. */
  compact?: boolean;
};

export type ConnectedProps = {
  variant: "connected";
  identity: ConnectedIdentity;
  /** `null` while loading. After resolution always a `GlobalStatusBarProStatus`. */
  proStatus: GlobalStatusBarProStatus | null;
  isProLoading: boolean;
  /**
   * Required in v1 (transitional). Becomes optional / removed when Shop
   * ships its PRO sub-section and the §6.1 day-61 hard-close fires.
   * `onProTap` is NOT a green light to add other taps to Z1.
   */
  onProTap: () => void;
  ariaLabel?: string;
  /** See `AnonymousProps.onBack`. */
  onBack?: () => void;
  /** See `AnonymousProps.compact`. */
  compact?: boolean;
};

/**
 * In-game / live diegetic Z1 layout.
 *
 * Used by surfaces where identity and PRO chips would compete for the
 * player's attention with the gameplay (active arena match). The
 * primitive owns the strip envelope (36 px height, max-width, safe-area
 * top padding) and the canonical two-slot grid. Caller owns the slot
 * content — typically a back-chip variant on the left (e.g. arena's
 * tap-to-confirm QUIT? button) and a live data chip on the right
 * (timer, move counter).
 *
 * Justified per the §5 growth rule (header-consistency canary pass 3):
 * neither `anonymous` nor `connected` can express this layout without
 * dramatic prop additions (custom back + drop PRO chip + drop identity)
 * that defeat the discriminated union. Variants are reserved for
 * structural layout differences — this is one.
 */
export type LiveProps = {
  variant: "live";
  /** Left-slot element. Caller owns the entire chip — useful when the
   *  back chip has bespoke interaction (e.g. arena's tap-to-confirm
   *  QUIT? state). The primitive only positions it. */
  leftSlot: React.ReactNode;
  /** Right-slot element. Live data (timer, mid-game counter, etc.).
   *  Caller owns animation + content; primitive owns position + envelope. */
  rightSlot: React.ReactNode;
  ariaLabel?: string;
};

/**
 * Props for `<GlobalStatusBar />` — discriminated union by `variant`.
 *
 * Spread escapes (`<GlobalStatusBar variant="anonymous" {...wider} />`)
 * are NOT blocked by TypeScript — the component runtime-narrows by
 * destructuring only valid fields and warns in dev if extras are present.
 * See spec §5 + §6 for the full safety net.
 */
export type GlobalStatusBarProps = AnonymousProps | ConnectedProps | LiveProps;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HANDLE = 14;

const isDev = process.env.NODE_ENV !== "production";

function devWarn(message: string): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(`[GlobalStatusBar] ${message}`);
  }
}

const SHAPE_RE = /^0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}$/;

/** Detects the discriminated-union spread escape: `variant: "anonymous"`
 *  arriving with any of the connected-only keys. Per spec §6 row 1. */
function detectSpreadEscape(
  props: GlobalStatusBarProps & Record<string, unknown>,
): void {
  if (!isDev) return;
  if (props.variant !== "anonymous") return;
  const leakedKeys = ["identity", "proStatus", "isProLoading", "onProTap"];
  const found = leakedKeys.filter((key) =>
    Object.prototype.hasOwnProperty.call(props, key),
  );
  if (found.length > 0) {
    devWarn(
      `anonymous variant received connected-only keys via spread (${found.join(", ")}). The runtime guard ignores them; fix the caller.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Z1 envelope — 36px content (≤ 40px below safe-area-top per spec §2).
// ─────────────────────────────────────────────────────────────────────────────

const WRAPPER_CLASS = cn(
  "relative z-10 mx-auto flex w-full max-w-[var(--app-max-width)]",
  "h-9 items-center justify-between gap-2 px-2",
  "pt-[calc(env(safe-area-inset-top)+0.25rem)]",
);

const HANDLE_CLASS =
  "truncate text-xs font-semibold text-white/85";

/** Frame-level back chip — visual cluster (back · handle). The
 *  44×44 hit area lives in `.candy-nav-button` (globals.css), so no
 *  scale transform that would shrink the touch target below the
 *  WCAG-mandated 44 px minimum. Header-consistency audit 2026-05-20. */
const BACK_BUTTON_CLASS = "candy-nav-button";

const PRO_SKELETON_CLASS = cn(
  "inline-flex items-center justify-center h-6 w-12 rounded-full",
  "animate-pulse bg-white/15",
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (state-derivation only — no fetch, no router)
// ─────────────────────────────────────────────────────────────────────────────

function isProActive(status: GlobalStatusBarProStatus | null): boolean {
  if (!status) return false;
  if (!status.active) return false;
  if (!status.expiresAt) return false;
  return status.expiresAt > Date.now();
}

function emitConnectedWarnings(props: ConnectedProps): void {
  if (!isDev) return;
  if (props.identity.handle && props.identity.handle.length > MAX_HANDLE) {
    devWarn(
      `handle exceeds 14 chars (${props.identity.handle.length}); truncating with ellipsis.`,
    );
  }
  if (!SHAPE_RE.test(props.identity.walletShort)) {
    devWarn(
      `walletShort should be \`0xABCD…1234\` shape (got "${props.identity.walletShort}"). Use formatWalletShort.`,
    );
  }
  if (
    props.proStatus &&
    props.proStatus.active &&
    props.proStatus.expiresAt !== null &&
    props.proStatus.expiresAt < Date.now()
  ) {
    devWarn(
      "stale PRO status — expiresAt < Date.now() but active=true. Refetch upstream.",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical Z1 (Global Status Bar) primitive for Chesscito.
 *
 * Renders the persistent identity strip (≤ 40px below safe-area-top per
 * the zone map in `DESIGN_SYSTEM.md` §10.1 / §10.7). State (PRO fetch,
 * wallet connection, sheet open/close) is owned by the caller; this
 * primitive only renders structure, applies the canonical envelope, and
 * fires dev-mode warnings on contract drift.
 *
 * Two variants — `anonymous` (no wallet) and `connected` (wallet + PRO
 * indicator) — discriminated by the `variant` prop. A spread-prop escape
 * (TS does not narrow spreads against discriminated unions) is caught by
 * the runtime guard in §6.
 *
 * Forces `dir="ltr"` on the wrapper — RTL support is deferred per §17
 * Accessibility carry-forward.
 *
 * Spec: `docs/specs/ui/global-status-bar-spec-2026-05-02.md`
 */
export function GlobalStatusBar(
  props: GlobalStatusBarProps,
): React.JSX.Element {
  detectSpreadEscape(props as GlobalStatusBarProps & Record<string, unknown>);

  if (props.variant === "anonymous") {
    return (
      <AnonymousBar
        ariaLabel={props.ariaLabel}
        onBack={props.onBack}
      />
    );
  }
  if (props.variant === "live") {
    return <LiveBar {...props} />;
  }
  return <ConnectedBar {...props} />;
}

function LiveBar(props: LiveProps): React.JSX.Element {
  return (
    <header
      role="banner"
      dir="ltr"
      aria-label={props.ariaLabel ?? GLOBAL_STATUS_BAR_COPY.ariaLabelLive}
      data-component="global-status-bar"
      data-variant="live"
      className={WRAPPER_CLASS}
    >
      <div className="flex min-w-0 items-center">{props.leftSlot}</div>
      <div className="shrink-0">{props.rightSlot}</div>
    </header>
  );
}

function BackChip({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={GLOBAL_STATUS_BAR_COPY.backLabel}
      className={BACK_BUTTON_CLASS}
      data-back-chip
    >
      <CandyBanner name="btn-back" className="h-8 w-8" />
    </button>
  );
}

function AnonymousBar({
  ariaLabel,
  onBack,
}: {
  ariaLabel?: string;
  onBack?: () => void;
}): React.JSX.Element {
  return (
    <header
      role="banner"
      dir="ltr"
      aria-label={ariaLabel ?? GLOBAL_STATUS_BAR_COPY.ariaLabelAnonymous}
      data-component="global-status-bar"
      data-variant="anonymous"
      className={WRAPPER_CLASS}
    >
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? <BackChip onClick={onBack} /> : null}
        <span className={HANDLE_CLASS}>
          {GLOBAL_STATUS_BAR_COPY.guestLabel}
        </span>
      </div>
      <div className="shrink-0" />
    </header>
  );
}

function ConnectedBar(props: ConnectedProps): React.JSX.Element {
  emitConnectedWarnings(props);

  const ariaLabel =
    props.ariaLabel ?? GLOBAL_STATUS_BAR_COPY.ariaLabelConnected;
  const active = isProActive(props.proStatus);
  const showSkeleton = props.isProLoading && props.proStatus === null;

  // Screen-reader identity text: prefer handle (capped) → fallback to walletShort.
  const handle = props.identity.handle;
  const visibleHandle = handle
    ? handle.length > MAX_HANDLE
      ? `${handle.slice(0, MAX_HANDLE - 1)}…`
      : handle
    : props.identity.walletShort;

  return (
    <header
      role="banner"
      dir="ltr"
      aria-label={ariaLabel}
      data-component="global-status-bar"
      data-variant="connected"
      className={WRAPPER_CLASS}
    >
      <div className="flex min-w-0 items-center gap-1">
        {props.onBack ? <BackChip onClick={props.onBack} /> : null}
        <span className="sr-only">{visibleHandle}</span>
      </div>
      <div className="shrink-0">
        {showSkeleton ? (
          <span
            role="status"
            aria-busy="true"
            aria-label={GLOBAL_STATUS_BAR_COPY.proLoadingAriaLabel}
            className={PRO_SKELETON_CLASS}
          />
        ) : active && props.proStatus?.expiresAt ? (
          <AccountClusterButton
            active
            compact={props.compact}
            onClick={props.onProTap}
            label={GLOBAL_STATUS_BAR_COPY.proManageLabel}
            value={`PRO ${HUD_COPY.proRemainingFormat(
              Math.max(
                0,
                Math.ceil(
                  (props.proStatus.expiresAt - Date.now()) / 86_400_000,
                ),
              ),
            )}`}
          />
        ) : (
          <AccountClusterButton
            active={false}
            compact={props.compact}
            onClick={props.onProTap}
            label={GLOBAL_STATUS_BAR_COPY.proViewLabel}
            value="PRO"
          />
        )}
      </div>
    </header>
  );
}

function AccountClusterButton({
  onClick,
  label,
  value,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  /** Visible chip text. Pass `"PRO Nd"` when active to surface days
   *  remaining as cross-app recognition (mirrors the /hub HUD chip).
   *  Inactive callers pass `"PRO"` so the chip stays a CTA. */
  value: string;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <HudResourceChip
      tone="pro"
      size={compact ? "compact" : "md"}
      atmosphere="adventure"
      icon="wallet"
      value={value}
      ariaLabel={label}
      onClick={onClick}
      className={cn(
        "global-status-account-chip",
        compact && "opacity-80 shadow-none"
      )}
    />
  );
}
