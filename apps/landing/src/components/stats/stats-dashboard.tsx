import Link from "next/link";

import { formatCount, statsCopy, EM_DASH } from "@/lib/stats/copy";
import type { StatsFilters } from "@/lib/stats/filters";
import type { StatsLocale } from "@/lib/stats/locale";
import type { SurfaceBreakdown } from "@/lib/stats/aggregator";
import type { PlayersCensus } from "@/lib/stats/players-census";
import { stepLabel } from "@/lib/stats/step-labels";
import type { PublicStats } from "@/lib/stats/types";

import { FilterChips } from "./filter-chips";
import { Bar, Callout, CardGrid, RetentionRow, ScrollBox, Section, StatCard } from "./primitives";

/**
 * The consolidated public dashboard.
 *
 * One page, mobile-first, no tabs — tabs would create routes, and `/stats` must
 * stay a single canonical URL the MiniPay listing can declare. Order is
 * summary → sections → methodology, so the answer comes before the caveats and
 * the caveats are still on the same screen as the claim.
 */

function fmtTime(iso: string, locale: StatsLocale): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getTime() === 0) return EM_DASH;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function StatsDashboard({
  stats,
  breakdown,
  census,
  locale,
  localeOverride,
}: {
  stats: PublicStats;
  breakdown: SurfaceBreakdown;
  census: PlayersCensus;
  locale: StatsLocale;
  localeOverride: StatsLocale | null;
}) {
  const c = statsCopy(locale);
  const f: StatsFilters = stats.filters;
  const n = (v: number | null | undefined) => formatCount(v ?? null, locale);

  const activationMax = stats.activation?.[0]?.sessions ?? 0;
  const accessMax = Math.max(0, ...(stats.accessFunnel?.steps ?? []).map((s) => s.sessions));
  const trendMax = Math.max(0, ...stats.activityTrend30d.map((d) => d.sessions));

  return (
    <main
      className="min-h-[100dvh] px-4 py-8 md:px-10"
      style={{ background: "var(--paper-bg)" }}
    >
      <div className="mx-auto w-full max-w-[860px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          {c.back}
        </Link>

        <h1
          className="fantasy-title mb-2 mt-6 text-2xl font-extrabold uppercase tracking-[0.14em] md:text-3xl"
          style={{ color: "var(--landing-text)", textShadow: "var(--landing-text-shadow-soft)" }}
        >
          {c.title}
        </h1>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--paper-text-muted)" }}>
          {c.intro}
        </p>

        <FilterChips filters={f} localeOverride={localeOverride} copy={c} />

        {/* Integrity notice — only when something actually failed, and it names
            WHICH measurements, because a blanket disclaimer is unactionable. */}
        {stats.dataIntegrity.failedRpcs.length > 0 ? (
          <div className="mb-8">
            <Callout tone="warn" title={c.integrityTitle}>
              {c.integrityBody}{" "}
              <span className="font-mono text-[0.7rem]">
                {stats.dataIntegrity.failedRpcs.join(", ")}
              </span>
            </Callout>
          </div>
        ) : null}

        {/* ── Summary ─────────────────────────────────────────────────── */}
        <Section title={c.sectionSummary}>
          <CardGrid>
            <StatCard label={c.sessions7d} value={stats.installs?.sessions7d ?? null} locale={locale} emphasis />
            <StatCard label={c.sessions30d} value={stats.installs?.sessions30d ?? null} locale={locale} emphasis />
            <StatCard
              label={c.appOpenSessions}
              value={stats.installs?.appOpenSessions30d ?? null}
              locale={locale}
            />
            {/* Labelled approximate ON THE CARD, not in a footnote: it counts
                rows and the stream carries exact duplicates. */}
            <StatCard
              label={`${c.appOpensRows} (${c.approximate})`}
              value={stats.installs?.appOpensRows30d ?? null}
              locale={locale}
              hint={c.approximateNote}
            />
          </CardGrid>
        </Section>

        {/* ── Learn / Play / Total ────────────────────────────────────── */}
        <Section title={c.sectionBreakdown}>
          <ScrollBox>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ color: "var(--paper-text-muted)" }}>
                  <th className="py-2 text-left text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                    {c.filterSurface}
                  </th>
                  <th className="py-2 text-right text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                    {c.sessions7d}
                  </th>
                  <th className="py-2 text-right text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                    {c.sessions30d}
                  </th>
                </tr>
              </thead>
              <tbody>
                {([
                  [c.learn, breakdown.learn],
                  [c.play, breakdown.play],
                  [c.total, breakdown.total],
                ] as const).map(([label, row]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--paper-divider)" }}>
                    <td className="py-2 font-semibold" style={{ color: "var(--paper-text)" }}>
                      {label}
                    </td>
                    <td className="py-2 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                      {n(row?.sessions7d)}
                    </td>
                    <td className="py-2 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                      {n(row?.sessions30d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
          <div className="mt-3">
            {/* The explanation lives HERE, beside the three numbers it
                reconciles — not on another screen. */}
            <Callout>{c.surfaceNullNote}</Callout>
          </div>
        </Section>

        {/* ── Activation ─────────────────────────────────────────────── */}
        <Section title={c.sectionActivation} note={c.activationNote}>
          {stats.activation ? (
            <ul className="flex flex-col gap-3">
              {stats.activation.map((step) => (
                <Bar
                  key={step.step}
                  label={stepLabel(step.step, locale)}
                  value={step.sessions}
                  max={activationMax}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
        </Section>

        {/* ── Access journey ─────────────────────────────────────────────
            NOT a funnel. Independent checkpoints, each scaled against the
            group max, deliberately WITHOUT connecting lines or a descending
            layout — `wallet_ready` can legitimately exceed `login_succeeded`
            and must not read as a rendering bug. */}
        <Section title={c.sectionAccess} note={c.accessNote}>
          {stats.accessFunnel ? (
            <>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {stats.accessFunnel.steps.map((step) => (
                  <div
                    key={step.step}
                    className="rounded-2xl border px-4 py-3"
                    style={{
                      background: "var(--landing-card-bg)",
                      borderColor: "var(--landing-card-border)",
                    }}
                  >
                    <Bar
                      label={stepLabel(step.step, locale)}
                      value={step.sessions}
                      max={accessMax}
                      locale={locale}
                    />
                  </div>
                ))}
              </ul>
              <p className="mt-3 text-xs" style={{ color: "var(--paper-text-subtle)" }}>
                {c.accessFailed}:{" "}
                <strong style={{ color: "var(--landing-text)" }}>
                  {n(stats.accessFunnel.failedSessions)}
                </strong>
              </p>
            </>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
        </Section>

        {/* ── Retention ──────────────────────────────────────────────── */}
        <Section title={c.sectionRetention}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <RetentionRow label={c.retentionD1} bucket={stats.retention?.d1 ?? null} copy={c} locale={locale} />
            <RetentionRow label={c.retentionD7} bucket={stats.retention?.d7 ?? null} copy={c} locale={locale} />
            <RetentionRow label={c.retentionWeek3} bucket={stats.retention?.week3 ?? null} copy={c} locale={locale} />
          </ul>
        </Section>

        {/* ── People ─────────────────────────────────────────────────── */}
        <Section title={c.sectionLifecycle}>
          <CardGrid>
            <StatCard label={c.known} value={stats.accountLifecycle?.known ?? null} locale={locale} emphasis />
            <StatCard label={c.active7d} value={stats.accountLifecycle?.active7d ?? null} locale={locale} />
            <StatCard label={c.dormant} value={stats.accountLifecycle?.dormant ?? null} locale={locale} />
            <StatCard label={c.inactive} value={stats.accountLifecycle?.inactive ?? null} locale={locale} />
            <StatCard label={c.newToday} value={stats.accountLifecycle?.newToday ?? null} locale={locale} />
            <StatCard label={c.new7d} value={stats.accountLifecycle?.new7d ?? null} locale={locale} />
            <StatCard
              label={c.resurrected7d}
              value={stats.accountLifecycle?.resurrected7d ?? null}
              locale={locale}
            />
          </CardGrid>
        </Section>

        {/* ── Habit depth ────────────────────────────────────────────── */}
        <Section title={c.sectionHabit}>
          {stats.habitDepth ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <StatCard label={c.habitCohort} value={stats.habitDepth.cohort} locale={locale} />
                <StatCard
                  label={c.habitMedian}
                  value={stats.habitDepth.medianActiveDays}
                  locale={locale}
                />
              </div>
              <ul className="flex flex-col gap-3">
                {stats.habitDepth.buckets.map((b) => (
                  <Bar
                    key={b.minDays}
                    label={`${b.minDays} ${c.habitBucket}`}
                    value={b.installs}
                    max={stats.habitDepth?.cohort ?? 0}
                    locale={locale}
                  />
                ))}
              </ul>
            </>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
        </Section>

        {/* ── 30-day trend ──────────────────────────────────────────────
            Sessions, new installs, returning. NO mints: the RPC does not
            return them and recovering them would need a ranged read. The
            mint totals live in the Celo block below. */}
        <Section title={c.sectionTrend}>
          {stats.activityTrend30d.length > 0 ? (
            <ScrollBox>
              <table className="w-full border-collapse text-xs md:text-sm">
                <thead>
                  <tr style={{ color: "var(--paper-text-muted)" }}>
                    <th className="py-2 text-left text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
                      {c.snapshotAt}
                    </th>
                    <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
                      {c.trendSessions}
                    </th>
                    <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
                      {c.trendNew}
                    </th>
                    <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
                      {c.trendReturning}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.activityTrend30d.map((d) => (
                    <tr key={d.date} style={{ borderTop: "1px solid var(--paper-divider)" }}>
                      <td className="py-1.5 tabular-nums" style={{ color: "var(--paper-text)" }}>
                        {d.date}
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                        {n(d.sessions)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                        {n(d.newInstalls)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                        {n(d.returningInstalls)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
          <p className="sr-only">{trendMax}</p>
        </Section>

        {/* ── Countries ─────────────────────────────────────────────── */}
        <Section title={c.sectionCountries}>
          {stats.topCountries.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {stats.topCountries.map((row) => (
                <Bar
                  key={row.country}
                  label={row.country}
                  value={row.sessions}
                  max={stats.topCountries[0]?.sessions ?? 0}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
        </Section>

        {/* ── Saved on Celo ─────────────────────────────────────────────
            Language brief: never "on-chain", never "NFT", never "mint". */}
        <Section title={c.sectionCelo}>
          <CardGrid>
            <StatCard
              label={c.celoUniquePlayers}
              value={stats.onchain.uniqueOnchainUsersLifetime}
              locale={locale}
              emphasis
            />
            <StatCard
              label={`${c.celoVictories} · ${c.lifetime}`}
              value={stats.onchain.methodTx.victoryMints.lifetime}
              locale={locale}
            />
            <StatCard
              label={`${c.celoScoreSaves} · ${c.lifetime}`}
              value={stats.onchain.methodTx.scoreSaves.lifetime}
              locale={locale}
            />
            <StatCard
              label={`${c.celoWelcomePacks} · ${c.lifetime}`}
              value={stats.onchain.methodTx.welcomePackClaims.lifetime}
              locale={locale}
            />
          </CardGrid>
        </Section>

        {/* ── Players ───────────────────────────────────────────────────
            `total` is the counted population and is NEVER rows.length. When
            the rows read fails the total can still be alive, so the two are
            rendered independently and the census carries its OWN timestamp. */}
        <Section title={c.sectionPlayers}>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard label={c.playersTotal} value={census.total} locale={locale} emphasis />
            <div
              className="flex flex-col justify-center rounded-2xl border px-4 py-3 text-xs"
              style={{
                background: "var(--paper-bg-inner-tray)",
                borderColor: "var(--paper-divider)",
                color: "var(--paper-text-subtle)",
              }}
            >
              {census.rowsRead === "unavailable"
                ? c.playersUnavailable
                : `${c.censusAt} ${fmtTime(census.asOf, locale)}`}
            </div>
          </div>
          {census.rowsRead === "ok" && census.rows.length > 0 ? (
            <ScrollBox>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ color: "var(--paper-text-muted)" }}>
                    <th className="py-2 text-left text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                      {c.playersRank}
                    </th>
                    <th className="py-2 text-left text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                      {c.sectionPlayers}
                    </th>
                    <th className="py-2 text-right text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
                      {c.playersScore}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {census.rows.slice(0, 50).map((row) => (
                    <tr key={row.rowId} style={{ borderTop: "1px solid var(--paper-divider)" }}>
                      <td className="py-1.5 tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                        {row.rank}
                      </td>
                      <td className="py-1.5" style={{ color: "var(--paper-text)" }}>
                        {row.variant.style} {row.variant.piece} #{row.variant.number}
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                        {n(row.totalScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          ) : null}
        </Section>

        {/* ── Methodology, last ─────────────────────────────────────── */}
        <Section title={c.sectionMethod}>
          <Callout>
            <p className="mb-2">{c.methodBody}</p>
            <p className="mb-2">{c.sharedDbNote}</p>
            <p>{c.surfaceNullNote}</p>
          </Callout>
          <p className="mt-3 text-xs tabular-nums" style={{ color: "var(--paper-text-subtle)" }}>
            {c.snapshotAt}: {fmtTime(stats.generatedAt, locale)}
          </p>
        </Section>
      </div>
    </main>
  );
}
