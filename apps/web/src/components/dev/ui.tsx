"use client";

/**
 * Chrome primitives for the /dev authoring surfaces.
 *
 * ⚠️ These are for /dev ONLY. Nothing here ships to a player: the /dev subtree is
 * 404'd in production by `app/dev/layout.tsx`, and these components deliberately
 * use raw Tailwind neutrals instead of the app's design tokens so a restyle of
 * the game can never move the builder's furniture (or vice versa).
 *
 * They exist because every probe was inventing its own card, its own label and
 * its own toggle, and the authoring pages had drifted into five different looks.
 * The rule they encode is small but load-bearing: a section's title is a real
 * `<h2>`, a field's label is a real `<label>` bound to its control, and a
 * segmented control reports `aria-pressed`. That is what makes a page readable
 * BY STRUCTURE — the builder's panel order is asserted against headings, not
 * against class names, so it survives any amount of restyling.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A titled card. `hint` sits on the right of the header — a count, a caption,
 *  or a small control (Copy, sort toggle) the section owns. */
export function Section({
  title,
  hint,
  children,
  className,
  id,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-neutral-800 bg-neutral-900/60 p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-200">
          {title}
        </h2>
        {hint ? (
          <div className="shrink-0 text-xs text-neutral-500">{hint}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled control. The `<label>` WRAPS its child, so the binding holds
 *  without anyone having to invent and keep an `id` in sync. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm", className)}>
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      {children}
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export type SegmentedOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Shown on hover — say WHY an option is disabled rather than leaving a dead
   *  button (the Preview toggle's whole reason for existing). */
  title?: string;
};

/** A pill group where exactly one option is active. `aria-pressed` carries the
 *  state, so the active option is knowable without reading a background colour —
 *  which is also what lets a test assert it. */
export function Segmented({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
              active
                ? "bg-neutral-100 text-black"
                : o.disabled
                  ? "cursor-not-allowed text-neutral-600"
                  : "text-neutral-400 hover:text-neutral-100",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type LegendItem = {
  /** Tailwind classes for the swatch. Purely decorative — the label carries the
   *  meaning, so a colour-blind author still reads the key. */
  swatch: string;
  label: string;
};

/** The colour key under the board. */
export function Legend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1.5 border-t border-neutral-800 pt-3 text-xs text-neutral-500",
        className,
      )}
    >
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-sm", i.swatch)} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** A monospaced block meant to be COPIED. `data-allow-select` opts it out of the
 *  app-wide user-select:none — without it the export block cannot be selected,
 *  which defeats the only thing it is for. */
export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      data-allow-select="true"
      className={cn(
        "overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-950/60 p-3 font-mono text-xs text-neutral-300",
        className,
      )}
    >
      {children}
    </pre>
  );
}

/** Shared input styling, so a field looks the same on every probe. */
export const devInputClass =
  "rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
