"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types — discriminated union per variant.
// Source spec: docs/specs/ui/contextual-header-spec-2026-05-01.md (v1).
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

export type TitleHeaderProps = {
  variant: "title";
  title: string;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type TitleControlHeaderProps = {
  variant: "title-control";
  title: string;
  subtitle?: string;
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
  back: BackProp;
  trailingControl?: React.ReactElement;
  ariaLabel?: string;
  sticky?: Sticky;
};

export type ContextualHeaderProps =
  | TitleHeaderProps
  | TitleControlHeaderProps
  | ModeTabsHeaderProps
  | BackControlHeaderProps;

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
      props.variant === "back-control") &&
    props.title.length > MAX_TITLE
  ) {
    devWarn(
      `title is ${props.title.length} chars (cap ${MAX_TITLE}). Truncating.`,
    );
  }
  if (
    props.variant === "title-control" &&
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
  if (
    props.variant === "back-control" &&
    props.back.label.length > MAX_BACK_LABEL
  ) {
    devWarn(
      `back.label is ${props.back.label.length} chars (cap ${MAX_BACK_LABEL}). Truncating.`,
    );
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
    props.variant === "back-control"
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

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
          <h1 className={TITLE_CLASS}>{props.title}</h1>
        </header>
      );

    case "title-control":
      return <TitleControlHeader {...props} ariaLabel={ariaLabel} />;

    case "mode-tabs":
      return <ModeTabsHeader {...props} ariaLabel={ariaLabel} />;

    case "back-control":
      return <BackControlHeader {...props} ariaLabel={ariaLabel} />;
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
      <div className="min-w-0 flex-1">
        <h1 className={TITLE_CLASS}>{props.title}</h1>
        {props.subtitle ? <p className={SUBTITLE_CLASS}>{props.subtitle}</p> : null}
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
  checkFragmentEscape(props.trailingControl);
  useTriggerWidthGuard(trailingRef);

  return (
    <header
      aria-label={props.ariaLabel}
      data-component="contextual-header"
      data-variant="back-control"
      className={HEADER_CLASS}
    >
      <button
        type="button"
        onClick={props.back.onClick}
        aria-label={props.back.label}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          "text-[rgba(110,65,15,0.85)] hover:bg-white/10 active:scale-[0.97]",
        )}
      >
        <span aria-hidden>←</span>
      </button>
      <h1 className={cn(TITLE_CLASS, "min-w-0 flex-1")}>{props.title}</h1>
      {props.trailingControl ? (
        <div ref={trailingRef} className="shrink-0" data-slot="trailing-control">
          {props.trailingControl}
        </div>
      ) : null}
    </header>
  );
}
