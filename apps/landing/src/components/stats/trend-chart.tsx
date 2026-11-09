import { formatCount, type StatsCopy } from "@/lib/stats/copy";
import type { StatsLocale } from "@/lib/stats/locale";
import type { DailyBucket } from "@/lib/stats/types";

/**
 * Thirty days of sessions, as stacked columns.
 *
 * **Why a chart and not the table.** The job of this data is *change over time*,
 * and thirty rows of digits publish the numbers without publishing the shape —
 * a reader has to do the differencing in their head to answer "is this
 * growing?". Columns answer it at a glance. The exact figures are not lost:
 * they live one `<details>` away, which is also the required table view for the
 * palette's contrast warning.
 *
 * **Stacked, and honest about it.** `newInstalls + returningInstalls ===
 * sessions` per row by construction (see `DailyBucket`), so the two segments
 * partition the column instead of overlapping it. Returning sits at the base
 * and new installs ride on top, so the growth reads as growth on top of a base.
 *
 * **The scale is drawn, not hovered.** ⚠️ This page ships inside MiniPay, on a
 * touch screen: `title` never fires there, so a tooltip is not a scale. Two
 * recessive gridlines (peak and half) plus the 30-day average put a number
 * behind every bar height without labelling thirty of them.
 *
 * ⚠️ **The average line is what rescues a launch spike.** One day at 2,612
 * against days of ~30 flattens twenty-eight columns into an unreadable strip;
 * a reference line is the only thing that lets a reader tell those days apart.
 * ⛔ A log scale would do it too and is not an option: it makes a 10× gap look
 * like a small one on a page whose whole job is to be trusted.
 *
 * ⛔ **No JavaScript.** `/stats` has no `"use client"` anywhere, and that is
 * exactly why no env can reach the browser bundle. The hover layer is a native
 * `title` tooltip — a bonus on desktop, never the only way to read a value.
 *
 * 🎨 Palette: `#d9821e` (new) and `#8a6818` (returning), both already in the
 * Chesscito tokens. Validated against the `#f6e6b8` paper surface — worst
 * adjacent CVD ΔE 12.0 (protan), normal-vision ΔE 16.1. The contrast warning
 * against that pale surface is discharged the way the rule requires: a legend
 * with visible labels plus the table view.
 */

const NEW_FILL = "#d9821e";
const RETURNING_FILL = "#8a6818";

/** A column can never vanish: a day with traffic must be visibly taller than a
 *  day without. Days that are genuinely zero stay at zero. */
const MIN_VISIBLE_PCT = 2;

function pct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(MIN_VISIBLE_PCT, (value / max) * 100);
}

function Swatch({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: fill }}
      />
      <span style={{ color: "var(--paper-text-muted)" }}>{label}</span>
    </span>
  );
}

/** One horizontal reference line with its value printed at the right edge. */
function GridLine({
  label,
  offset,
  strong = false,
  side = "right",
  testId,
}: {
  label: string;
  /** Distance from the BOTTOM of the plot, in percent. */
  offset: number;
  strong?: boolean;
  /** ⚠️ The average line sits LOW and the tallest bars are usually the most
   *  recent ones, on the right — so its label goes left or it lands on top of
   *  the spike it is there to explain. */
  side?: "left" | "right";
  testId?: string;
}) {
  const rule = (
    <span
      className="flex-1"
      style={{
        borderTop: strong
          ? "1px solid rgba(110, 65, 15, 0.45)"
          : "1px dashed var(--paper-divider)",
      }}
    />
  );
  const text = (
    <span
      className={`shrink-0 rounded px-1 text-[0.6rem] tabular-nums ${strong ? "font-semibold" : ""}`}
      style={{
        color: strong ? "var(--paper-text-muted)" : "var(--paper-text-subtle)",
        // The chip keeps the number legible where the rule crosses a column.
        background: "var(--paper-bg)",
      }}
    >
      {label}
    </span>
  );
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className="pointer-events-none absolute inset-x-0 flex items-center gap-1"
      style={{ bottom: `${offset}%` }}
    >
      {side === "left" ? (
        <>
          {text}
          {rule}
        </>
      ) : (
        <>
          {rule}
          {text}
        </>
      )}
    </div>
  );
}

export function TrendChart({
  days,
  copy,
  locale,
}: {
  days: DailyBucket[];
  copy: StatsCopy;
  locale: StatsLocale;
}) {
  const max = Math.max(0, ...days.map((d) => d.sessions));
  const peak = days.reduce<DailyBucket | null>(
    (best, d) => (best === null || d.sessions > best.sessions ? d : best),
    null,
  );
  const average =
    days.length > 0
      ? Math.round(days.reduce((sum, d) => sum + d.sessions, 0) / days.length)
      : null;
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <figure className="m-0">
      {/* Legend BEFORE the plot: two series are never identified by colour
          alone, and the reader needs the key before the marks. Peak and latest
          are the two anchor values — the numbers behind the two bars a reader
          actually looks for. */}
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem]">
        <Swatch fill={NEW_FILL} label={copy.trendNew} />
        <Swatch fill={RETURNING_FILL} label={copy.trendReturning} />
        {peak ? (
          <span className="tabular-nums" style={{ color: "var(--paper-text-subtle)" }}>
            {copy.trendPeak}: {formatCount(peak.sessions, locale)} · {peak.date}
          </span>
        ) : null}
        {last ? (
          <span className="tabular-nums" style={{ color: "var(--paper-text-subtle)" }}>
            {copy.trendLatest}: {formatCount(last.sessions, locale)} · {last.date}
          </span>
        ) : null}
      </figcaption>

      <div className="relative h-32 w-full md:h-40" data-testid="trend-plot">
        <GridLine label={formatCount(max, locale)} offset={100} />
        <GridLine label={formatCount(Math.round(max / 2), locale)} offset={50} />
        {average !== null && max > 0 ? (
          <GridLine
            strong
            side="left"
            testId="trend-average-line"
            label={`${copy.trendAverage} ${formatCount(average, locale)}`}
            offset={(average / max) * 100}
          />
        ) : null}

        <div
          role="img"
          aria-label={`${copy.trendChartLabel} ${copy.trendPeak}: ${formatCount(max, locale)}. ${copy.trendAverage} ${formatCount(average ?? 0, locale)}.`}
          className="flex h-full w-full items-end gap-[2px]"
        >
          {days.map((d) => {
            const newPct = pct(d.newInstalls, max);
            const returningPct = pct(d.returningInstalls, max);
            const topIsNew = d.newInstalls > 0;
            return (
              <div
                key={d.date}
                className="flex h-full flex-1 flex-col justify-end"
                // Native tooltip — a desktop bonus, never the only way to read
                // a value: there is no hover on the touch screens this ships to.
                title={`${d.date} · ${copy.trendSessions} ${formatCount(d.sessions, locale)} · ${copy.trendNew} ${formatCount(d.newInstalls, locale)} · ${copy.trendReturning} ${formatCount(d.returningInstalls, locale)}`}
                data-testid="trend-column"
                data-date={d.date}
                data-sessions={d.sessions}
              >
                {newPct > 0 ? (
                  <div
                    data-testid="trend-segment-new"
                    style={{
                      height: `${newPct}%`,
                      background: NEW_FILL,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      // 2px of surface between the two fills, so the boundary
                      // is a gap and not a colour judgement.
                      marginBottom: returningPct > 0 ? 2 : 0,
                    }}
                  />
                ) : null}
                {returningPct > 0 ? (
                  <div
                    data-testid="trend-segment-returning"
                    style={{
                      height: `${returningPct}%`,
                      background: RETURNING_FILL,
                      borderTopLeftRadius: topIsNew ? 0 : 4,
                      borderTopRightRadius: topIsNew ? 0 : 4,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two ticks, not thirty: the axis says which window this is, and the
          exact per-day figures are in the table below. */}
      <div
        className="mt-1 flex justify-between text-[0.65rem] tabular-nums"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        <span>{first?.date ?? ""}</span>
        <span>{last?.date ?? ""}</span>
      </div>
    </figure>
  );
}
