"use client";

import * as React from "react";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types — discriminated union per variant.
//
// Full contract: docs/specs/ui/contextual-header-spec-2026-05-01.md (v1.1)
// Design-system entry: DESIGN_SYSTEM.md §10.5
//
// Why discriminated union (and not a flat interface): impossible prop
// combinations (`back + modeTabs`, `trailingControl` outside its allowed
// variants) must fail at compile time, not at runtime. See spec §3
// amendment for the rationale and the original red-team finding.
//
// v1.1 additions (header-consistency canary 2026-05-20):
//   - Optional `icon?: CandyIconName` on title / title-control /
//     back-control / close-control. Renders h-5 w-5 inline LEFT of the
//     title text with `gap-2`. Mandatory rule lives in the consumer
//     surface, not the primitive.
//   - New variant `close-control` — title (+ optional subtitle, + optional
//     icon) on the left, inline close button on the right. Replaces the
//     ad-hoc `border-b -mx-6 -mt-6 px-6 pb-5 pt-…` recipe copy-pasted
//     across every dock sheet, and the floating absolute close in
//     `sheet.tsx`.
// ─────────────────────────────────────────────────────────────────────────────

export type Sticky = "scroll";

export type TabOption = {
  key: string;
  label: string;
};

export type ModeTabsProp = {
  activeKey: string;
  options: readonly [TabOption, TabOption?, TabOption?, TabOption?];
  onChange: (key: string) => void;
};

export type BackProp = {
  onClick: () => void;
  label: string;
};

export type CloseProp = {
  onClick: () => void;
  /** Accessible label. Defaults to "Close" when omitted. */
  label?: string;
};

export type TitleHeaderProps = {
  variant: "title";
  title: string;
  icon?: CandyIconName;
  /** Custom inline icon (e.g. raster PNG). Renders in the same left
   *  slot as `icon` and takes precedence when both are provided. Use
   *  this to anchor a sheet/page to its tile asset (Daily, Mate, etc.)
   *  so the entry point and the destination share identity. */
  iconSlot?: React.ReactNode;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type TitleControlHeaderProps = {
  variant: "title-control";
  title: string;
  subtitle?: string;
  icon?: CandyIconName;
  iconSlot?: React.ReactNode;
  trailingControl: React.ReactElement;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type ModeTabsHeaderProps = {
  variant: "mode-tabs";
  modeTabs: ModeTabsProp;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type BackControlHeaderProps = {
  variant: "back-control";
  title: string;
  subtitle?: string;
  icon?: CandyIconName;
  iconSlot?: React.ReactNode;
  /** Default back chip wiring. Renders `candy-nav-button` with the
   *  canonical CandyBanner btn-back image. Use this for the 95% case.
   *  Either this OR `backSlot` must be set. */
  back?: BackProp;
  /** Bespoke back element — e.g. arena's tap-to-confirm QUIT? state.
   *  When provided, REPLACES the default back chip. Caller owns the
   *  entire element including its own onClick + aria-label. Use this
   *  ONLY when the back interaction needs state the primitive can't
   *  express. Either this OR `back` must be set; dev-mode warns if
   *  both or neither are provided. */
  backSlot?: React.ReactElement;
  trailingControl?: React.ReactElement;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type CloseControlHeaderProps = {
  variant: "close-control";
  title: string;
  subtitle?: string;
  icon?: CandyIconName;
  iconSlot?: React.ReactNode;
  close: CloseProp;
  ariaLabel?: string;
  sticky?: Sticky;
};

/**
 * Props for `<ContextualHeader />` — discriminated union by `variant`.
 *
 * The TS narrowing inside the component switch guarantees that each
 * variant only sees the fields it owns. Callers cannot mix `back` +
 * `modeTabs`, cannot pass arrays / iterables / `null` / `undefined` as
 * `trailingControl`, and cannot exceed 4 entries in `modeTabs.options`.
 *
 * See DESIGN_SYSTEM.md §10.5 for the variant catalogue and the full
 * compile-time / runtime contract list.
 */
export type ContextualHeaderProps =
  | TitleHeaderProps
  | TitleControlHeaderProps
  | ModeTabsHeaderProps
  | BackControlHeaderProps
  | CloseControlHeaderProps;

// ─────────────────────────────────────────────────────────────────────────────
// Visual length caps (spec §6.1).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TITLE = 22;
const MAX_SUBTITLE = 32;
const MAX_TAB_LABEL = 16;
const MAX_BACK_LABEL = 16;
const MAX_TRIGGER_WIDTH_PX = 44;

const isDev = process.env.NODE_ENV !== "production";

function devWarn(message: string): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(`[ContextualHeader] ${message}`);
  }
}

function emitLengthWarnings(props: ContextualHeaderProps): void {
  if (!isDev) return;
  if (
    (props.variant === "title" ||
      props.variant === "title-control" ||
      props.variant === "back-control" ||
      props.variant === "close-control") &&
    props.title.length > MAX_TITLE
  ) {
    devWarn(
      `title is ${props.title.length} chars (cap ${MAX_TITLE}). Truncating.`,
    );
  }
  if (
    (props.variant === "title-control" ||
      props.variant === "close-control" ||
      props.variant === "back-control") &&
    props.subtitle &&
    props.subtitle.length > MAX_SUBTITLE
  ) {
    devWarn(
      `subtitle is ${props.subtitle.length} chars (cap ${MAX_SUBTITLE}). Truncating.`,
    );
  }
  if (props.variant === "mode-tabs") {
    const seen = new Set<string>();
    for (const option of props.modeTabs.options) {
      if (!option) continue;
      if (option.label.length > MAX_TAB_LABEL) {
        devWarn(
          `tab label "${option.label}" is ${option.label.length} chars (cap ${MAX_TAB_LABEL}). Truncating.`,
        );
      }
      if (seen.has(option.key)) {
        devWarn(`duplicate tab key "${option.key}". Last-wins.`);
      }
      seen.add(option.key);
    }
  }
  if (props.variant === "back-control") {
    const hasBack = Boolean(props.back);
    const hasBackSlot = Boolean(props.backSlot);
    if (hasBack && hasBackSlot) {
      devWarn(
        "back-control received BOTH `back` and `backSlot`. `backSlot` wins; drop `back` to silence this warning.",
      );
    } else if (!hasBack && !hasBackSlot) {
      devWarn(
        "back-control received NEITHER `back` nor `backSlot`. The header renders without a back affordance.",
      );
    }
    if (props.back && props.back.label.length > MAX_BACK_LABEL) {
      devWarn(
        `back.label is ${props.back.label.length} chars (cap ${MAX_BACK_LABEL}). Truncating.`,
      );
    }
  }
}

function checkFragmentEscape(element: React.ReactElement | undefined): void {
  if (!isDev || !element) return;
  if (element.type !== React.Fragment) return;
  const childrenProp = (element.props as { children?: React.ReactNode })
    .children;
  const count = React.Children.count(childrenProp);
  if (count > 1) {
    devWarn(
      `trailingControl received a fragment with ${count} children. Z2 trailing slot accepts a single trigger only.`,
    );
  }
}

/**
 * Dev-mode soft cap on the trailing trigger's rendered width. Z2's
 * trailing slot is meant for one ≤44×44 trigger; anything wider is a
 * code smell (a sheet, a multi-control row, a chip with a long label).
 *
 * Intentionally registered without a dependency array so it re-measures
 * on every render — CSS drift on a previously-OK trigger should still
 * fire the warning. jsdom returns 0 from getBoundingClientRect so this
 * never asserts in unit tests; coverage relies on real-browser runs.
 */
function useTriggerWidthGuard(
  ref: React.RefObject<HTMLDivElement | null>,
): void {
  React.useEffect(() => {
    if (!isDev) return;
    const slot = ref.current;
    if (!slot) return;
    const child = slot.firstElementChild as HTMLElement | null;
    if (!child) return;
    const width = child.getBoundingClientRect().width;
    if (width > MAX_TRIGGER_WIDTH_PX) {
      devWarn(
        `trailingControl rendered at ${Math.round(width)}px wide; soft cap is ${MAX_TRIGGER_WIDTH_PX}px.`,
      );
    }
  });
}

function deriveAriaLabel(props: ContextualHeaderProps): string {
  if (props.ariaLabel) return props.ariaLabel;
  if (
    props.variant === "title" ||
    props.variant === "title-control" ||
    props.variant === "back-control" ||
    props.variant === "close-control"
  ) {
    return `${props.title} header`;
  }
  return "Contextual header";
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared classes — Z2 strip envelope. 52–64px height, 390px max width.
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_CLASS = cn(
  "relative z-10 mx-auto flex w-full max-w-[var(--app-max-width)]",
  "min-h-[52px] max-h-[64px] items-center gap-2 px-3",
);

const TITLE_CLASS =
  "truncate text-base font-semibold text-[rgba(110,65,15,0.95)]";
const SUBTITLE_CLASS =
  "truncate text-xs font-medium text-[rgba(110,65,15,0.65)]";

/** Inline title icon — sits LEFT of the title text at h-5 w-5 with
 *  `gap-2`. Rule lives in the consumer surface (sheets mandate it, pages
 *  with a back chip make it optional). When `slot` is provided it wins
 *  over `name`, so consumers can anchor a screen to its tile asset
 *  (raster PNG) instead of the line-art CandyIcon set. */
function TitleIcon({
  name,
  slot,
}: {
  name?: CandyIconName;
  slot?: React.ReactNode;
}): React.JSX.Element | null {
  if (slot) {
    // Slot wrapper does NOT clamp size — the consumer's element owns
    // its own h-*/w-* so it can match the title+subtitle stack (raster
    // tile icons typically render at h-10 ≈ title line + subtitle line).
    // The line-art CandyIcon path below stays at the canonical h-5 w-5.
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center"
      >
        {slot}
      </span>
    );
  }
  if (name) {
    return <CandyIcon name={name} className="h-5 w-5 shrink-0" />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical Z2 (Contextual Header) primitive for Chesscito.
 *
 * Renders the screen-local context strip (52–64px height, 390px max
 * width) per the zone map in `DESIGN_SYSTEM.md` §10.1. State (open
 * pickers, active tab, back-nav target) is owned by the caller; this
 * primitive only renders structure, applies the canonical envelope, and
 * fires dev-mode warnings on contract drift.
 *
 * Accepts one of four variants — `title`, `title-control`, `mode-tabs`,
 * `back-control` — discriminated by the `variant` prop.
 *
 * For the full contract, including forbidden cases, length caps,
 * runtime guards, and the canary integration pattern, see
 * `docs/specs/ui/contextual-header-spec-2026-05-01.md` and
 * `DESIGN_SYSTEM.md` §10.5.
 *
 * @example title + chip
 * ```tsx
 * <ContextualHeader
 *   variant="title-control"
 *   title="Rook"
 *   subtitle="Move to h1"
 *   trailingControl={<PiecePickerTrigger onClick={openPicker} />}
 * />
 * ```
 */
export function ContextualHeader(props: ContextualHeaderProps): React.JSX.Element {
  emitLengthWarnings(props);
  const ariaLabel = deriveAriaLabel(props);

  switch (props.variant) {
    case "title":
      return (
        <header
          aria-label={ariaLabel}
          data-component="contextual-header"
          data-variant="title"
          className={HEADER_CLASS}
        >
          {props.icon || props.iconSlot ? (
            <TitleIcon name={props.icon} slot={props.iconSlot} />
          ) : null}
          <h1 className={TITLE_CLASS}>{props.title}</h1>
        </header>
      );

    case "title-control":
      return <TitleControlHeader {...props} ariaLabel={ariaLabel} />;

    case "mode-tabs":
      return <ModeTabsHeader {...props} ariaLabel={ariaLabel} />;

    case "back-control":
      return <BackControlHeader {...props} ariaLabel={ariaLabel} />;

    case "close-control":
      return <CloseControlHeader {...props} ariaLabel={ariaLabel} />;
  }
}

function TitleControlHeader(
  props: TitleControlHeaderProps & { ariaLabel: string },
): React.JSX.Element {
  const trailingRef = React.useRef<HTMLDivElement | null>(null);
  checkFragmentEscape(props.trailingControl);
  useTriggerWidthGuard(trailingRef);

  return (
    <header
      aria-label={props.ariaLabel}
      data-component="contextual-header"
      data-variant="title-control"
      className={HEADER_CLASS}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {props.icon || props.iconSlot ? (
          <TitleIcon name={props.icon} slot={props.iconSlot} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={TITLE_CLASS}>{props.title}</h1>
          {props.subtitle ? <p className={SUBTITLE_CLASS}>{props.subtitle}</p> : null}
        </div>
      </div>
      <div ref={trailingRef} className="shrink-0" data-slot="trailing-control">
        {props.trailingControl}
      </div>
    </header>
  );
}

function ModeTabsHeader(
  props: ModeTabsHeaderProps & { ariaLabel: string },
): React.JSX.Element {
  const visibleOptions = props.modeTabs.options.filter(
    (option): option is TabOption => Boolean(option),
  );

  return (
    <header
      aria-label={props.ariaLabel}
      data-component="contextual-header"
      data-variant="mode-tabs"
      className={HEADER_CLASS}
      role="tablist"
    >
      {visibleOptions.map((option) => {
        const active = option.key === props.modeTabs.activeKey;
        return (
          <button
            key={option.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => props.modeTabs.onChange(option.key)}
            className={cn(
              "min-h-[44px] flex-1 truncate rounded-lg px-2 text-sm font-medium transition-colors",
              active
                ? "bg-[rgba(120,65,5,0.95)] text-[rgb(255,240,180)]"
                : "text-[rgba(110,65,15,0.75)] hover:text-[rgba(110,65,15,1)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </header>
  );
}

function BackControlHeader(
  props: BackControlHeaderProps & { ariaLabel: string },
): React.JSX.Element {
  const trailingRef = React.useRef<HTMLDivElement | null>(null);
  const backSlotRef = React.useRef<HTMLDivElement | null>(null);
  checkFragmentEscape(props.trailingControl);
  checkFragmentEscape(props.backSlot);
  useTriggerWidthGuard(trailingRef);

  return (
    <header
      aria-label={props.ariaLabel}
      data-component="contextual-header"
      data-variant="back-control"
      className={HEADER_CLASS}
    >
      {props.backSlot ? (
        <div ref={backSlotRef} className="shrink-0" data-slot="back-control">
          {props.backSlot}
        </div>
      ) : props.back ? (
        <button
          type="button"
          onClick={props.back.onClick}
          aria-label={props.back.label}
          className="candy-nav-button"
        >
          <CandyBanner name="btn-back" className="h-8 w-8" />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {props.icon || props.iconSlot ? (
          <TitleIcon name={props.icon} slot={props.iconSlot} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={TITLE_CLASS}>{props.title}</h1>
          {props.subtitle ? <p className={SUBTITLE_CLASS}>{props.subtitle}</p> : null}
        </div>
      </div>
      {props.trailingControl ? (
        <div ref={trailingRef} className="shrink-0" data-slot="trailing-control">
          {props.trailingControl}
        </div>
      ) : null}
    </header>
  );
}

function CloseControlHeader(
  props: CloseControlHeaderProps & { ariaLabel: string },
): React.JSX.Element {
  const closeLabel = props.close.label ?? "Close";
  return (
    <header
      aria-label={props.ariaLabel}
      data-component="contextual-header"
      data-variant="close-control"
      className={HEADER_CLASS}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {props.icon || props.iconSlot ? (
          <TitleIcon name={props.icon} slot={props.iconSlot} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={TITLE_CLASS}>{props.title}</h1>
          {props.subtitle ? <p className={SUBTITLE_CLASS}>{props.subtitle}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={props.close.onClick}
        aria-label={closeLabel}
        className="candy-close-asset-button"
        data-slot="close-control"
      >
        <img
          src="/art/screen-mission/close-icon.png"
          alt=""
          aria-hidden="true"
          className="h-10 w-10 object-contain"
          draggable={false}
        />
      </button>
    </header>
  );
}
