import Link from "next/link";

import {
  EM_DASH,
  formatCount,
  formatLaunchDate,
  statsCopy,
  withCount,
  withTokens,
  type StatsCopy,
} from "@/lib/stats/copy";
import type { StatsFilters } from "@/lib/stats/filters";
import type { StatsLocale } from "@/lib/stats/locale";
import type { SurfaceBreakdown } from "@/lib/stats/aggregator";
import type { LeaderboardIdentityRow, PlayersCensus } from "@/lib/stats/players-census";
import { stepLabel } from "@/lib/stats/step-labels";
import type { ActivationFunnel, DailyBucket, PublicStats } from "@/lib/stats/types";

import { FilterChips } from "./filter-chips";
import { TrendChart } from "./trend-chart";
import {
  Bar,
  Callout,
  CardGrid,
  Disclosure,
  RetentionRow,
  ScrollBox,
  Section,
  StatCard,
  SubSection,
} from "./primitives";

/**
 * The consolidated public dashboard.
 *
 * One page, mobile-first, no tabs — tabs would create routes, and `/stats` must
 * stay a single canonical URL the MiniPay listing can declare.
 *
 * The order answers questions in the order a reader asks them:
 *
 *   header → launch context → **at a glance** → **from first visit to habit**
 *   → engagement → audience → activity → saved on Celo → methodology
 *
 * Five headline numbers come first, then one narrative walk, then the twelve
 * detailed measurements grouped under the idea each one serves. Nothing was
 * removed: what is not above is one `<details>` away, behind a summary that
 * says how much is inside.
 *
 * ⛔ This layer reorganises. It touches no RPC, no aggregator, no cache and no
 * data source — every number here already existed one commit ago.
 */

function fmtTime(iso: string, locale: StatsLocale): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getTime() === 0) return EM_DASH;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Ranked players shown before the disclosure. */
const PLAYERS_VISIBLE_ROWS = 10;
/** Ranked players rendered at all. Unchanged from the consolidated page — the
 *  disclosure changes what is VISIBLE, never what was read. */
const PLAYERS_MAX_ROWS = 50;
/** The habit bucket the glance and the journey both point at. */
const HABIT_SIGNAL_MIN_DAYS = 3;

/** One activation step by key, or `null` when the whole funnel is unmeasured.
 *  ⚠️ `null`, never `0`: a zero would assert nobody started an exercise. */
function stepSessions(funnel: ActivationFunnel | null, key: string): number | null {
  if (!funnel) return null;
  const found = funnel.find((s) => s.step === key);
  return found ? found.sessions : null;
}

function TrendTable({
  rows,
  copy,
  locale,
  testId,
}: {
  rows: DailyBucket[];
  copy: StatsCopy;
  locale: StatsLocale;
  testId?: string;
}) {
  return (
    <ScrollBox>
      <table className="w-full border-collapse text-xs md:text-sm" data-testid={testId}>
        <thead>
          <tr style={{ color: "var(--paper-text-muted)" }}>
            <th className="py-2 text-left text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
              {copy.trendDay}
            </th>
            <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
              {copy.trendSessions}
            </th>
            <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
              {copy.trendNew}
            </th>
            <th className="py-2 text-right text-[0.6rem] font-extrabold uppercase tracking-[0.1em]">
              {copy.trendReturning}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date} style={{ borderTop: "1px solid var(--paper-divider)" }}>
              <td className="py-1.5 tabular-nums" style={{ color: "var(--paper-text)" }}>
                {d.date}
              </td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                {formatCount(d.sessions, locale)}
              </td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                {formatCount(d.newInstalls, locale)}
              </td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                {formatCount(d.returningInstalls, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollBox>
  );
}

function PlayersTable({
  rows,
  copy,
  locale,
  testId,
}: {
  rows: LeaderboardIdentityRow[];
  copy: StatsCopy;
  locale: StatsLocale;
  testId?: string;
}) {
  return (
    <ScrollBox>
      <table className="w-full border-collapse text-sm" data-testid={testId}>
        <thead>
          <tr style={{ color: "var(--paper-text-muted)" }}>
            <th className="py-2 text-left text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
              {copy.playersRank}
            </th>
            <th className="py-2 text-left text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
              {copy.sectionPlayers}
            </th>
            <th className="py-2 text-right text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
              {copy.playersScore}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId} style={{ borderTop: "1px solid var(--paper-divider)" }}>
              <td className="py-1.5 tabular-nums" style={{ color: "var(--paper-text-muted)" }}>
                {row.rank}
              </td>
              <td className="py-1.5" style={{ color: "var(--paper-text)" }}>
                {row.variant.style} {row.variant.piece} #{row.variant.number}
              </td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--landing-text)" }}>
                {formatCount(row.totalScore, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollBox>
  );
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

  const habitSignal =
    stats.habitDepth?.buckets.find((b) => b.minDays === HABIT_SIGNAL_MIN_DAYS)?.installs ?? null;

  // ── The narrative walk ────────────────────────────────────────────────────
  // Four activation steps plus one habit bucket. ⛔ NOT a funnel: the steps
  // come from a nested prefix, the habit bucket counts installs over a rolling
  // window, and the two are not the same denominator. They share a bar scale so
  // the shape is comparable, and carry NO step-to-step percentage.
  const journeySteps: { label: string; value: number | null }[] = [
    { label: stepLabel("app_opened", locale), value: stepSessions(stats.activation, "app_opened") },
    {
      label: stepLabel("exercise_started", locale),
      value: stepSessions(stats.activation, "exercise_started"),
    },
    {
      label: stepLabel("exercise_completed", locale),
      value: stepSessions(stats.activation, "exercise_completed"),
    },
    {
      label: stepLabel("daily_focus_completed", locale),
      value: stepSessions(stats.activation, "daily_focus_completed"),
    },
    { label: c.journeyHabitStep, value: habitSignal },
    // A checkpoint we could not measure is DROPPED, not drawn at zero: an empty
    // bar at the end of a walk reads as "nobody got here".
  ].filter((s) => s.value !== null);
  const journeyMax = Math.max(0, ...journeySteps.map((s) => s.value ?? 0));

  // ── Progressive disclosure ────────────────────────────────────────────────
  // ⚠️ The trend is NOT truncated: every day is on the chart. What the
  // disclosure holds is the PRECISION (the per-day figures), not the data.
  const trend = stats.activityTrend30d;

  const playerRows = census.rows.slice(0, PLAYERS_MAX_ROWS);
  const playersTop = playerRows.slice(0, PLAYERS_VISIBLE_ROWS);
  const playersRest = playerRows.slice(PLAYERS_VISIBLE_ROWS);

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

        {/* Launch context. ⛔ Editorial constant — deriving it from telemetry
            would publish "when measurement started" as "when we launched", and
            would need a read this initiative is not allowed to add. */}
        <p
          data-testid="stats-launch-context"
          className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {c.launchPrefix} · {formatLaunchDate(locale)}
        </p>

        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--paper-text-muted)" }}>
          {c.intro}
        </p>

        <FilterChips filters={f} localeOverride={localeOverride} copy={c} />

        {/* Integrity notice — only when something actually failed, and it names
            WHICH measurements, because a blanket disclaimer is unactionable.
            ⛔ Never inside a `<details>`: a degraded state that has to be
            expanded to be seen is a degraded state nobody reads. */}
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

        {/* ── At a glance — exactly five ────────────────────────────────────
            The five a reviewer arriving from the listing needs first: how much
            traffic, how many people, how much of the product got used, and
            whether anyone is coming back. ⛔ No new ratio is computed here. */}
        <Section title={c.sectionGlance} testId="stats-glance">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
            <StatCard
              label={c.sessions7d}
              value={stats.installs?.sessions7d ?? null}
              locale={locale}
              emphasis
            />
            <StatCard
              label={c.glanceActivePeople7d}
              value={stats.accountLifecycle?.active7d ?? null}
              locale={locale}
              emphasis
            />
            <StatCard
              label={c.glanceExercisesStarted}
              value={stepSessions(stats.activation, "exercise_started")}
              locale={locale}
            />
            <StatCard
              label={c.glanceExercisesCompleted}
              value={stepSessions(stats.activation, "exercise_completed")}
              locale={locale}
            />
            {/* The fifth is the best existing habit datum, labelled as EARLY on
                the card itself — the 7/14/21-day windows are still maturing. */}
            <StatCard
              label={c.glanceEarlyHabit}
              value={habitSignal}
              locale={locale}
              hint={c.glanceEarlyHabitNote}
            />
          </div>
        </Section>

        {/* ── From first visit to habit ─────────────────────────────────── */}
        <Section title={c.sectionJourney} testId="stats-journey">
          {journeySteps.length > 0 ? (
            <ul className="flex flex-col gap-2 md:gap-3">
              {journeySteps.map((step) => (
                <Bar
                  key={step.label}
                  label={step.label}
                  value={step.value}
                  max={journeyMax}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <Callout>{c.notMeasured}</Callout>
          )}
          {/* Mandatory, and BELOW the walk it qualifies — not on another
              screen. Without it, five descending bars read as a cohort funnel. */}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--paper-text-subtle)" }}>
            {c.journeyNote}
          </p>
        </Section>

        {/* ── Engagement ───────────────────────────────────────────────────
            How far into the product people get, and whether they return. */}
        <Section title={c.sectionEngagement}>
          <SubSection title={c.sectionActivation} note={c.activationNote}>
            {stats.activation ? (
              <ul className="flex flex-col gap-2 md:gap-3">
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
          </SubSection>

          {/* NOT a funnel. Independent checkpoints, each scaled against the
              group max, deliberately WITHOUT connecting lines or a descending
              layout — `wallet_ready` can legitimately exceed `login_succeeded`
              and must not read as a rendering bug. */}
          <SubSection title={c.sectionAccess} note={c.accessNote}>
            {stats.accessFunnel ? (
              <>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                  {stats.accessFunnel.steps.map((step) => (
                    <div
                      key={step.step}
                      className="rounded-2xl border px-3 py-2 md:px-4 md:py-3"
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
          </SubSection>

          <SubSection title={c.sectionRetention}>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
              <RetentionRow label={c.retentionD1} bucket={stats.retention?.d1 ?? null} copy={c} locale={locale} />
              <RetentionRow label={c.retentionD7} bucket={stats.retention?.d7 ?? null} copy={c} locale={locale} />
              <RetentionRow label={c.retentionWeek3} bucket={stats.retention?.week3 ?? null} copy={c} locale={locale} />
            </ul>
          </SubSection>

          <SubSection title={c.sectionHabit}>
            {stats.habitDepth ? (
              <>
                <div className="mb-2 grid grid-cols-2 gap-2 md:mb-3 md:gap-3">
                  <StatCard label={c.habitCohort} value={stats.habitDepth.cohort} locale={locale} />
                  <StatCard
                    label={c.habitMedian}
                    value={stats.habitDepth.medianActiveDays}
                    locale={locale}
                  />
                </div>
                <ul className="flex flex-col gap-2 md:gap-3">
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
          </SubSection>
        </Section>

        {/* ── Audience ─────────────────────────────────────────────────────
            Who is on the other side: people, products, places, ranking. */}
        <Section title={c.sectionAudience}>
          <SubSection title={c.sectionLifecycle}>
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
          </SubSection>

          <SubSection title={c.sectionBreakdown}>
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
                  reconciles — not on another screen, and never collapsed. */}
              <Callout>{c.surfaceNullNote}</Callout>
            </div>
          </SubSection>

          <SubSection title={c.sectionCountries}>
            {stats.topCountries.length > 0 ? (
              <ul className="flex flex-col gap-2 md:gap-3">
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
          </SubSection>

          {/* `total` is the counted population and is NEVER rows.length. When
              the rows read fails the total can still be alive, so the two are
              rendered independently and the census carries its OWN timestamp. */}
          <SubSection title={c.sectionPlayers}>
            <div className="mb-2 grid grid-cols-1 gap-2 md:mb-3 md:grid-cols-2 md:gap-3">
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
            {census.rowsRead === "ok" && playersTop.length > 0 ? (
              <>
                <PlayersTable rows={playersTop} copy={c} locale={locale} testId="players-top" />
                {/* ⚠️ The cut is declared HERE, under the table it applies to.
                    The census counts every ranked player; this table renders
                    fifty. A reader who cannot reconcile the two reads the
                    smaller number as a lie — and never sees a note filed on
                    another screen. */}
                {census.total !== null && census.total > playerRows.length ? (
                  <p
                    data-testid="players-cut"
                    className="mt-2 text-xs"
                    style={{ color: "var(--paper-text-subtle)" }}
                  >
                    {withTokens(
                      c.playersCut,
                      { shown: playerRows.length, total: census.total },
                      locale,
                    )}
                  </p>
                ) : null}
                {playersRest.length > 0 ? (
                  <Disclosure
                    testId="players-more"
                    summary={withCount(c.morePlayers, playersRest.length, locale)}
                  >
                    <PlayersTable rows={playersRest} copy={c} locale={locale} />
                  </Disclosure>
                ) : null}
              </>
            ) : null}
          </SubSection>
        </Section>

        {/* ── Activity ─────────────────────────────────────────────────────
            Sessions, new installs, returning. NO mints: the RPC does not
            return them and recovering them would need a ranged read. The mint
            totals live in the Celo block below. */}
        <Section title={c.sectionActivity}>
          <SubSection title={c.sectionTrend}>
            {trend.length > 0 ? (
              <>
                {/* The SHAPE first. Thirty rows of digits publish the numbers
                    without publishing the trend — the reader has to difference
                    them mentally to answer "is this growing?". Columns answer
                    it at a glance, and no day is hidden to get there. */}
                <TrendChart days={trend} copy={c} locale={locale} />
                {/* The exact figures, one click away. This is also the table
                    view the palette's contrast warning requires. */}
                <Disclosure
                  testId="trend-table"
                  summary={withCount(c.trendTable, trend.length, locale)}
                >
                  <TrendTable rows={trend} copy={c} locale={locale} testId="trend-rows" />
                </Disclosure>
              </>
            ) : (
              <Callout>{c.notMeasured}</Callout>
            )}
          </SubSection>
        </Section>

        {/* ── Saved on Celo ─────────────────────────────────────────────────
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

        {/* ── Methodology, last ─────────────────────────────────────────────
            ⛔ Never collapsed. The caveats are what make the numbers above
            readable, and a reader who has to expand them is a reader who
            never sees them. */}
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
