"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  GLOBAL_STATUS_BAR_COPY,
  PRO_COPY,
} from "@/lib/content/editorial";

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
};

/**
 * Props for `<GlobalStatusBar />` — discriminated union by `variant`.
 *
 * Spread escapes (`<GlobalStatusBar variant="anonymous" {...wider} />`)
 * are NOT blocked by TypeScript — the component runtime-narrows by
 * destructuring only valid fields and warns in dev if extras are present.
 * See spec §5 + §6 for the full safety net.
 */
export type GlobalStatusBarProps = AnonymousProps | ConnectedProps;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HANDLE = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const AVATAR_BASE = cn(
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
  "bg-white/10 text-[14px] leading-none text-white/70",
);

const PRO_PILL_BASE =
  "inline-flex items-center px-2 h-6 rounded-full text-[10px] font-bold uppercase tracking-wide transition active:scale-[0.97]";

const PRO_PILL_ACTIVE = cn(
  PRO_PILL_BASE,
  "bg-gradient-to-r from-[rgb(255,200,80)] to-[rgb(255,160,40)] text-[rgb(80,40,5)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
);

/** Spec §8 P1-2 inactive-state lock (Amendment 2026-05-03) — these
 *  classes are exact, no tuning. The original amendment locked
 *  `text-white/40 ring-white/15 bg-transparent`, which was confirmed
 *  invisible against the candy-green hub backdrop in the 2026-05-02
 *  PRO smoke. New treatment: light cream fill + defined brown border at
 *  30% + brown text at 70% — visible on any candy palette tile, not a
 *  CTA (no gradient, no shadow). Same height/padding/font as active so
 *  the slot doesn't shift between states. */
const PRO_PILL_INACTIVE = cn(
  PRO_PILL_BASE,
  "text-[rgb(80,40,5)]/70 ring-1 ring-inset ring-[rgb(80,40,5)]/30 bg-white/85",
);

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

function formatDaysLeft(expiresAt: number): string {
  const remainingMs = expiresAt - Date.now();
  const days = Math.ceil(remainingMs / MS_PER_DAY);
  return PRO_COPY.statusActiveSuffix(days);
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
    return <AnonymousBar ariaLabel={props.ariaLabel} />;
  }
  return <ConnectedBar {...props} />;
}

function AnonymousBar({ ariaLabel }: { ariaLabel?: string }): React.JSX.Element {
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
        <div className={AVATAR_BASE} aria-hidden="true">
          <span aria-hidden>♟</span>
        </div>
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

  // Visible identity text: prefer handle (capped) → fallback to walletShort.
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
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            AVATAR_BASE,
            active && "ring-2 ring-[var(--pro-ring-gold)]",
          )}
          aria-hidden="true"
        >
          <span aria-hidden>♟</span>
        </div>
        <span className={HANDLE_CLASS}>{visibleHandle}</span>
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
          <button
            type="button"
            onClick={props.onProTap}
            aria-label={GLOBAL_STATUS_BAR_COPY.proManageLabel}
            data-pro-state="active"
            className={PRO_PILL_ACTIVE}
          >
            <span aria-hidden="true">★</span>
            <span className="ml-1">
              {GLOBAL_STATUS_BAR_COPY.proInactiveLabel}
              {" • "}
              {formatDaysLeft(props.proStatus.expiresAt)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onProTap}
            aria-label={GLOBAL_STATUS_BAR_COPY.proViewLabel}
            data-pro-state="inactive"
            className={PRO_PILL_INACTIVE}
          >
            {GLOBAL_STATUS_BAR_COPY.proInactiveLabel}
          </button>
        )}
      </div>
    </header>
  );
}
