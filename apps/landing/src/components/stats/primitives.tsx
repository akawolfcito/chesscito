import type { ReactNode } from "react";

import { EM_DASH, formatCount, type StatsCopy } from "@/lib/stats/copy";
import type { StatsLocale } from "@/lib/stats/locale";

/**
 * Presentational primitives for `/stats`. Server components — the page has no
 * interactivity beyond links, so nothing here is a client component and no
 * `process.env` is reachable from the browser bundle.
 *
 * Visual identity is the landing's existing one (`--landing-*` / `--paper-*`
 * tokens, `fantasy-title`). Phase D consolidates a dashboard; it does not
 * redesign Chesscito.
 */

export function Section({
  title,
  note,
  testId,
  children,
}: {
  title: string;
  note?: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 md:mb-8" data-testid={testId}>
      <h2
        className="fantasy-title mb-1 text-base font-extrabold uppercase tracking-[0.12em] md:text-lg"
        style={{ color: "var(--landing-text)", textShadow: "var(--landing-text-shadow-soft)" }}
      >
        {title}
      </h2>
      {note ? (
        <p
          className="mb-3 text-xs leading-relaxed md:text-sm"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          {note}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}

/**
 * A block inside one of the five top-level sections.
 *
 * The IA groups twelve measurements under five ideas; this is the heading that
 * keeps each measurement named without adding a sixth `h2` and blurring the
 * outline a screen reader announces.
 */
export function SubSection({
  title,
  note,
  testId,
  children,
}: {
  title: string;
  note?: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5" data-testid={testId}>
      <h3
        className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-[0.14em]"
        style={{ color: "var(--paper-text-muted)" }}
      >
        {title}
      </h3>
      {note ? (
        <p className="mb-2 text-xs leading-relaxed" style={{ color: "var(--paper-text-subtle)" }}>
          {note}
        </p>
      ) : (
        <div className="mb-2" />
      )}
      {children}
    </div>
  );
}

/**
 * Native progressive disclosure.
 *
 * ⛔ `<details>` and NOT a JavaScript accordion: the page has no `"use client"`
 * anywhere, and that is exactly why no env var can reach the browser bundle.
 *
 * ⚠️ The `summary` must NAME AND COUNT what is inside. A collapsed block with a
 * vague label ("More") reads as data that does not exist, which on a page whose
 * whole job is trust is worse than the extra scroll it saves.
 */
export function Disclosure({
  summary,
  testId,
  children,
}: {
  summary: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <details className="mt-3" data-testid={testId}>
      <summary
        className="cursor-pointer list-none rounded-xl border px-3 py-2 text-xs font-extrabold uppercase tracking-[0.1em]"
        style={{
          background: "var(--paper-bg-inner-tray)",
          borderColor: "var(--paper-divider)",
          color: "var(--paper-text-muted)",
        }}
      >
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * One metric.
 *
 * ⛔ `value === null` prints an em-dash. It NEVER prints 0: a zero asserts
 * "nobody did this", which is a different and much stronger claim than "we
 * could not measure this". A real zero still prints as `0` — `formatCount`
 * only dashes on null/undefined/NaN.
 */
export function StatCard({
  label,
  value,
  locale,
  hint,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  locale: StatsLocale;
  hint?: string;
  emphasis?: boolean;
}) {
  const text = formatCount(value, locale);
  const missing = text === EM_DASH;
  return (
    <div
      data-testid="stat-card"
      className="flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 md:gap-1 md:px-4 md:py-3"
      style={{
        background: emphasis ? "var(--landing-accent-bg)" : "var(--landing-card-bg)",
        borderColor: "var(--landing-card-border)",
        boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
      }}
    >
      <span
        className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em]"
        style={{ color: "var(--paper-text-muted)" }}
      >
        {label}
      </span>
      <span
        data-testid="stat-value"
        className="text-lg font-extrabold tabular-nums md:text-2xl"
        style={{ color: missing ? "var(--paper-text-subtle)" : "var(--landing-text)" }}
        aria-label={missing ? undefined : String(value)}
      >
        {text}
      </span>
      {hint ? (
        <span className="text-[0.65rem] leading-snug" style={{ color: "var(--paper-text-subtle)" }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">{children}</div>;
}

/** A labelled bar. `max` is passed in so a group of bars shares one scale;
 *  a bar that normalised against its own value would make every row full. */
export function Bar({
  label,
  value,
  max,
  locale,
  suffix,
}: {
  label: string;
  value: number | null;
  max: number;
  locale: StatsLocale;
  suffix?: string;
}) {
  const pct = value !== null && max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <li className="flex flex-col gap-0.5 md:gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span
          data-testid="bar-label"
          className="text-xs font-semibold md:text-sm"
          style={{ color: "var(--paper-text)" }}
        >
          {label}
        </span>
        <span
          className="text-xs font-extrabold tabular-nums md:text-sm"
          style={{ color: "var(--landing-text)" }}
        >
          {formatCount(value, locale)}
          {suffix ? <span className="font-semibold"> {suffix}</span> : null}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--paper-bg-inner-tray)" }}
        role="presentation"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--landing-accent-border)" }}
        />
      </div>
    </li>
  );
}

/** Scroll container for anything that can outgrow a 390 px viewport. The page
 *  body must never scroll horizontally; the table inside it may. */
export function ScrollBox({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[320px]">{children}</div>
    </div>
  );
}

export function Callout({
  tone = "muted",
  title,
  children,
}: {
  tone?: "muted" | "warn";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3 text-xs leading-relaxed md:text-sm"
      style={{
        background: tone === "warn" ? "var(--landing-accent-bg)" : "var(--paper-bg-inner-tray)",
        borderColor:
          tone === "warn" ? "var(--landing-accent-border)" : "var(--paper-divider)",
        color: "var(--paper-text-muted)",
      }}
    >
      {title ? (
        <strong className="mb-1 block" style={{ color: "var(--landing-text)" }}>
          {title}
        </strong>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Retention, the one place a percentage is dangerous.
 *
 * ⛔ `cohort === 0` renders "Not enough history yet" and NOT "0 %". Nobody was
 * eligible to return, so a 0 % would report a failure that never had a chance
 * to happen. `session_first_seen` was created on 2026-07-23, so the 15–21 day
 * band is genuinely empty until roughly 2026-08-20.
 */
export function RetentionRow({
  label,
  bucket,
  copy,
  locale,
}: {
  label: string;
  bucket: { returned: number; cohort: number } | null;
  copy: StatsCopy;
  locale: StatsLocale;
}) {
  const empty = !bucket || bucket.cohort === 0;
  return (
    <li
      className="flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 md:gap-1 md:px-4 md:py-3"
      style={{
        background: "var(--landing-card-bg)",
        borderColor: "var(--landing-card-border)",
      }}
    >
      <span
        className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em]"
        style={{ color: "var(--paper-text-muted)" }}
      >
        {label}
      </span>
      {empty ? (
        <span className="text-sm font-semibold" style={{ color: "var(--paper-text-subtle)" }}>
          {copy.notEnoughHistory}
        </span>
      ) : (
        <>
          <span
            className="text-xl font-extrabold tabular-nums md:text-2xl"
            style={{ color: "var(--landing-text)" }}
          >
            {((bucket.returned / bucket.cohort) * 100).toFixed(1)}%
          </span>
          <span className="text-[0.7rem] tabular-nums" style={{ color: "var(--paper-text-subtle)" }}>
            {formatCount(bucket.returned, locale)} {copy.ofCohort}{" "}
            {formatCount(bucket.cohort, locale)}
          </span>
        </>
      )}
    </li>
  );
}
