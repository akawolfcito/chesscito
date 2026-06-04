import type {
  DailyBucket,
  DifficultyTally,
  PublicStats,
} from "@/lib/stats/public-aggregator";
import { StatCard } from "./stat-card";

type StatsPageProps = {
  stats: PublicStats;
};

// Sparkline accents — deep teal counterpoint for Sessions + warm
// terracotta for Mints. Replaces the prior brown / amber pair which
// blended into the cream scrim. Terracotta echoes the Anthropic /
// Claude Status accent family and stays brand-warm without
// competing with the page background.
const TREND_SESSIONS_ACCENT = "rgba(58, 128, 148, 0.78)";
const TREND_MINTS_ACCENT = "rgba(217, 119, 87, 0.9)";

// Segment colors for the stacked difficulty bar (Palette B —
// "brand-tone evolutiva"): sage / mustard / terracotta. The prior
// Easy forest-green + Medium amber clashed with the cream scrim;
// these tones hold their own against the lighter background while
// keeping the warm Chesscito palette.
const DIFFICULTY_SEGMENT_COLORS: Record<"easy" | "medium" | "hard", string> = {
  easy: "rgba(124, 184, 143, 0.88)",
  medium: "rgba(233, 177, 77, 0.92)",
  hard: "rgba(217, 119, 87, 0.92)",
};

function nf(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function difficultyMixCaption(tally: DifficultyTally): string {
  const max = Math.max(tally.easy, tally.medium, tally.hard);
  if (tally.easy === max) return "Most current mints are beginner/onboarding activity.";
  if (tally.medium === max) return "Most current mints are mid-skill activity.";
  return "Most current mints are advanced/expert activity.";
}

/**
 * Decorative SVG sparkline of 30 daily bars. Pure SVG, no chart
 * library. Empty days render as a 0.5-unit stub so the eye reads
 * "30 evenly spaced bars" instead of gaps that suggest missing data.
 * The series is exposed numerically above the chart and via the
 * dense bucket array in the aggregator, so screen readers don't
 * lose information by treating the SVG as decoration.
 */
function TrendSparkline({
  values,
  accent,
}: {
  values: number[];
  accent: string;
}) {
  const N = Math.max(1, values.length);
  const max = Math.max(1, ...values);
  const W = 300;
  const H = 56;
  const GAP = 1.2;
  const barW = Math.max(1, (W - GAP * (N - 1)) / N);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      role="img"
      aria-hidden
    >
      {values.map((v, i) => {
        const h = (v / max) * H;
        const x = i * (barW + GAP);
        const y = H - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h > 0 ? Math.max(h, 1) : 0.5}
            fill={accent}
            opacity={v > 0 ? 1 : 0.35}
          />
        );
      })}
    </svg>
  );
}

function TrendPanel({
  label,
  total,
  values,
  accent,
  rangeFrom,
  rangeTo,
}: {
  label: string;
  total: number;
  values: number[];
  accent: string;
  rangeFrom: string;
  rangeTo: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border px-4 py-3"
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        borderColor: "var(--paper-divider)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[0.625rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          {label}
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          {nf(total)}
          <span
            className="ml-1 text-[0.6875rem] font-normal"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            total 30d
          </span>
        </span>
      </div>
      <TrendSparkline values={values} accent={accent} />
      <div
        className="flex justify-between text-[0.625rem]"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        <span>{rangeFrom}</span>
        <span>{rangeTo}</span>
      </div>
    </div>
  );
}

/**
 * Renders the difficulty distribution as a single horizontal stacked
 * bar with a legend below. Replaces the prior 3-row treatment (one
 * label+bar+value per band) so the visual reads "composition" at a
 * glance instead of "three small comparisons". Each segment carries
 * a native `title` for hover detail; the outer bar exposes a single
 * `aria-label` summarising all three bands for screen readers.
 */
function DifficultyMixChart({ tally }: { tally: DifficultyTally }) {
  const total = tally.easy + tally.medium + tally.hard;
  if (total <= 0) return null;
  const bands: Array<{ key: keyof DifficultyTally; label: string }> = [
    { key: "easy", label: "Easy" },
    { key: "medium", label: "Medium" },
    { key: "hard", label: "Hard" },
  ];
  const pct = (n: number) => Math.round((n / total) * 100);
  const ariaLabel =
    "Difficulty mix: " +
    bands.map((b) => `${b.label} ${pct(tally[b.key])}%`).join(", ");
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={ariaLabel}
      >
        {bands.map((b) => {
          const value = tally[b.key];
          const percent = (value / total) * 100;
          return (
            <div
              key={b.key}
              className="h-full"
              style={{
                width: `${percent}%`,
                background: DIFFICULTY_SEGMENT_COLORS[b.key],
              }}
              title={`${b.label}: ${nf(value)} of ${nf(total)} (${pct(value)}%)`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {bands.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: DIFFICULTY_SEGMENT_COLORS[b.key] }}
            />
            <span
              className="font-semibold"
              style={{ color: "var(--paper-text)" }}
            >
              {b.label}
            </span>
            <span
              className="tabular-nums"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {pct(tally[b.key])}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function truncateWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function difficultyName(d: number): string {
  if (d === 1) return "Easy";
  if (d === 2) return "Medium";
  if (d === 3) return "Hard";
  return "—";
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatGeneratedAt(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * Derives short narrative insights from the current snapshot. Each
 * bullet is independently gated so a missing field (null from a
 * failed query) silently drops its line instead of rendering a
 * partial / nonsensical sentence.
 */
function computePlatformSignals(stats: PublicStats): string[] {
  const signals: string[] = [];

  if (
    stats.victories30d != null &&
    stats.totalVictories != null &&
    stats.totalVictories > 0
  ) {
    signals.push(
      `${stats.victories30d} of ${stats.totalVictories} Victory mints happened in the last 30 days.`,
    );
  }

  if (stats.victories7d != null) {
    signals.push(
      `${stats.victories7d} Victory mints happened in the last 7 days.`,
    );
  }

  const diff = stats.victoriesByDifficulty;
  if (diff) {
    const total = diff.easy + diff.medium + diff.hard;
    if (total > 0) {
      const max = Math.max(diff.easy, diff.medium, diff.hard);
      let label = "";
      let context = "";
      if (diff.easy === max) {
        label = "Easy";
        context = "showing beginner/onboarding usage";
      } else if (diff.medium === max) {
        label = "Medium";
        context = "showing steady mid-skill engagement";
      } else {
        label = "Hard";
        context = "showing strong advanced engagement";
      }
      signals.push(
        `Most minted victories are ${label} difficulty, ${context}.`,
      );
    }
  }

  return signals;
}

const TRACKED_TODAY: ReadonlyArray<string> = [
  "App sessions",
  "Victory mints",
  "Welcome pack claims",
  "Leaderboard scores",
];

const COMING_NEXT: ReadonlyArray<string> = [
  "Connected wallets",
  "Stablecoin volume",
  "Purchase conversion",
  "Failed transaction rate",
  "Retention cohorts",
];

export function StatsPage({ stats }: StatsPageProps) {
  const diff = stats.victoriesByDifficulty;
  const platformSignals = computePlatformSignals(stats);

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="space-y-2">
        <h1
          className="fantasy-title text-2xl font-bold md:text-4xl"
          style={{
            color: "var(--paper-text)",
            textShadow: "0 1px 0 rgba(255, 235, 180, 0.7)",
          }}
        >
          Chesscito Platform Stats
        </h1>
        <p
          className="text-sm md:text-base"
          style={{ color: "var(--paper-text-muted)" }}
        >
          Public activity metrics for Chesscito as a mini app: sessions,
          Victory mints, onboarding, and community activity.
        </p>
        <p
          className="text-xs md:text-sm leading-snug"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          These numbers describe platform-level activity, not a single
          player profile. Some metrics are exact counts from Chesscito
          records, while active sessions are anonymous usage estimates.
        </p>
        <p
          className="text-[0.6875rem]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Updated hourly · As of{" "}
          <span style={{ color: "var(--paper-text-muted)" }}>
            {formatGeneratedAt(stats.generatedAt)}
          </span>
        </p>
      </header>

      {/* Executive Snapshot — vital-signs cockpit. Three hero tiles
          deliver scale at a glance: total minted, weekly sessions,
          monthly mints. The Hero subtitle above already orients the
          reader (so a separate "What this shows" prose block would
          break visual momentum before the first chart). */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Victory NFTs Minted"
          value={stats.totalVictories}
          sublabel="Saved victories on Celo mainnet"
          variant="hero"
        />
        <StatCard
          label="Approx. App Sessions (7d)"
          value={stats.activeSessions7d}
          sublabel="Anonymous sessions; not connected wallets"
          variant="hero"
        />
        <StatCard
          label="Victory Mints (30d)"
          value={stats.victories30d}
          sublabel="Mints in the last 30 days"
          variant="hero"
        />
      </section>

      {/* Activity trend chart — first visual right after Snapshot so
          the reader's absorb-numbers mode carries straight into the
          sparklines without a prose block in between. Hidden entirely
          when the aggregator returned an empty trend. */}
      {stats.activityTrend30d.length > 0 ? (() => {
        const sessions = stats.activityTrend30d.map((b: DailyBucket) => b.sessions);
        const mints = stats.activityTrend30d.map((b: DailyBucket) => b.mints);
        const sessionsTotal = sessions.reduce((a, b) => a + b, 0);
        const mintsTotal = mints.reduce((a, b) => a + b, 0);
        const first = stats.activityTrend30d[0]?.date ?? "";
        const last =
          stats.activityTrend30d[stats.activityTrend30d.length - 1]?.date ?? "";
        return (
          <section>
            <h3
              className="mb-1 text-base font-bold md:text-lg"
              style={{ color: "var(--paper-text)" }}
            >
              Activity trend, last 30 days
            </h3>
            <p
              className="mb-3 text-[0.6875rem] leading-tight"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              Approx. app sessions and Victory mints over the last 30 days.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TrendPanel
                label="Approx. app sessions"
                total={sessionsTotal}
                values={sessions}
                accent={TREND_SESSIONS_ACCENT}
                rangeFrom={first}
                rangeTo={last}
              />
              <TrendPanel
                label="Victory mints"
                total={mintsTotal}
                values={mints}
                accent={TREND_MINTS_ACCENT}
                rangeFrom={first}
                rangeTo={last}
              />
            </div>
          </section>
        );
      })() : null}

      {/* Victory difficulty mix — second chart, single stacked bar.
          The redundant 3-card "Victories by difficulty" grid was
          removed; absolute counts moved into segment titles + legend
          percentages so the section delivers composition without
          repeating the data twice. */}
      {diff && diff.easy + diff.medium + diff.hard > 0 ? (
        <section>
          <h3
            className="mb-1 text-base font-bold md:text-lg"
            style={{ color: "var(--paper-text)" }}
          >
            Victory difficulty mix
          </h3>
          <p
            className="mb-3 text-[0.6875rem] leading-tight"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            {difficultyMixCaption(diff)}
          </p>
          <DifficultyMixChart tally={diff} />
        </section>
      ) : null}

      {/* Platform signals — sits AFTER the two charts so its three
          derived bullets read as confirmation of the visual story
          ("yes, the bar you just saw is mostly Easy") rather than
          preamble. When no signal is computable (every numeric field
          null), a defensive fallback paragraph keeps the page rhythm
          intact instead of leaving a gap between charts and the
          Activity windows grid. */}
      <section>
        <h3
          className="mb-2 text-base font-bold md:text-lg"
          style={{ color: "var(--paper-text)" }}
        >
          Platform signals
        </h3>
        {platformSignals.length > 0 ? (
          <ul
            className="space-y-1.5 text-xs md:text-sm"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {platformSignals.map((line) => (
              <li
                key={line}
                className="flex gap-2"
                style={{ color: "var(--paper-text-muted)" }}
              >
                <span aria-hidden style={{ color: "var(--paper-text-subtle)" }}>
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-xs md:text-sm leading-snug"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            Platform signals will appear here as activity accumulates.
          </p>
        )}
      </section>

      {/* Activity windows — tabular grid as supporting evidence
          after the dashboard's high-signal visuals. Tiles use the
          `bare` variant (no cream-amber fill) so the page reads
          as typography + whitespace instead of a wall of boxes
          competing with the Snapshot hero tiles above. */}
      <section>
        <h3
          className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Activity windows
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <StatCard
            label="Victory Mints (7d)"
            value={stats.victories7d}
            variant="bare"
          />
          <StatCard
            label="Wallets with Victory Mints"
            value={stats.uniqueMintersLifetime}
            variant="bare"
            sublabel="Distinct wallets that minted a Victory"
          />
          <StatCard
            label="Approx. App Sessions (30d)"
            value={stats.activeSessions30d}
            variant="bare"
          />
          <StatCard
            label="Welcome Packs Claimed"
            value={stats.welcomePacksLifetime}
            variant="bare"
            sublabel="Claims tracked after launch"
          />
          <StatCard
            label="Welcome Packs (7d)"
            value={stats.welcomePacks7d}
            variant="bare"
          />
        </div>
      </section>

      {/* Recent Victory Mints — appendix tone. Heading reduced to
          uppercase small caps so it reads as a supporting feed, not
          as headline content competing with the Snapshot above. */}
      <section>
        <h3
          className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Recent Victory Mints
        </h3>
        {stats.hallOfFame.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            No mints yet.
          </p>
        ) : (
          <ul
            className="border-t"
            style={{ borderColor: "var(--paper-divider)" }}
          >
            {stats.hallOfFame.map((row) => (
              <li
                key={row.tx_hash}
                className="flex items-center justify-between gap-2 border-b py-2 text-xs"
                style={{
                  color: "var(--paper-text)",
                  borderColor: "var(--paper-divider)",
                }}
              >
                <span className="font-mono">{truncateWallet(row.player)}</span>
                <span
                  className="text-[0.625rem] uppercase tracking-wide"
                  style={{ color: "var(--paper-text-subtle)" }}
                >
                  {difficultyName(row.difficulty)}
                </span>
                <span
                  className="text-[0.6875rem]"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  {formatRelative(row.minted_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Community Leaderboard — appendix tone (same demoted heading
          treatment as Recent Mints). Subtitle kept verbatim because
          the caveat ("game scores, not only minted victories") is
          load-bearing for honesty about the data source. */}
      <section>
        <h3
          className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Community Leaderboard
        </h3>
        <p
          className="mb-2 text-[0.6875rem] leading-tight"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Based on game scores, not only minted victories.
        </p>
        {stats.leaderboardTop10.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            Leaderboard is currently unavailable.
          </p>
        ) : (
          <ol
            className="border-t"
            style={{ borderColor: "var(--paper-divider)" }}
          >
            {stats.leaderboardTop10.map((row) => (
              <li
                key={`${row.rank}-${row.player}`}
                className="flex items-center justify-between gap-2 border-b py-2 text-xs"
                style={{
                  color: "var(--paper-text)",
                  borderColor: "var(--paper-divider)",
                }}
              >
                <span
                  className="w-6 text-center font-bold"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  #{row.rank}
                </span>
                <span className="flex-1 font-mono">
                  {truncateWallet(row.player)}
                </span>
                <span className="font-semibold">
                  {new Intl.NumberFormat("en-US").format(row.total_score)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Tracked today / Coming next — bifurcated scope so the page
          self-discloses both what it covers and what it deliberately
          excludes. Sits above the Methodology footnote because the
          enumeration is the higher-signal answer to "is this honest
          coverage?", and the methodology prose then explains the
          terms (sessions vs wallets). */}
      <section>
        <h3
          className="mb-2 text-base font-bold md:text-lg"
          style={{ color: "var(--paper-text)" }}
        >
          Tracked today / Coming next
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            className="paper-tray px-4 py-3"
            style={{ color: "var(--paper-text)" }}
          >
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              Tracked today
            </p>
            <ul className="space-y-1 text-xs md:text-sm">
              {TRACKED_TODAY.map((line) => (
                <li
                  key={line}
                  className="flex gap-2"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  <span
                    aria-hidden
                    style={{ color: "var(--paper-text-subtle)" }}
                  >
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="paper-tray px-4 py-3"
            style={{ color: "var(--paper-text)" }}
          >
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              Coming next
            </p>
            <ul className="space-y-1 text-xs md:text-sm">
              {COMING_NEXT.map((line) => (
                <li
                  key={line}
                  className="flex gap-2"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  <span
                    aria-hidden
                    style={{ color: "var(--paper-text-subtle)" }}
                  >
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Methodology — short footnote. The Tracked today / Coming
          next block above already enumerates scope; this block just
          gives the term-level definitions a reader needs to read
          "App sessions" and "Victory mints" correctly. */}
      <section
        className="rounded-xl border px-3 py-3 text-[0.6875rem] leading-snug"
        style={{
          borderColor: "var(--paper-divider)",
          color: "var(--paper-text-subtle)",
          background: "rgba(255, 235, 180, 0.18)",
        }}
      >
        <p className="mb-1 font-semibold" style={{ color: "var(--paper-text-muted)" }}>
          Methodology
        </p>
        <p>
          Active sessions are anonymous app sessions, not connected
          wallets. Victory mints count saved on-chain victories.
          Leaderboard entries are based on game scores and may include
          players who have not minted a Victory NFT.
        </p>
      </section>

      {/* External verification — third-party credibility footer. Two
          outbound links let a reviewer cross-reference our self-
          reported numbers against an independent source (Talent
          Protocol's project dashboard tracks DAU / transactions /
          gas fees) and against verified on-chain source (Celoscan).
          Programmatic integration with Talent Protocol's API was
          evaluated and deferred — see docs/references/
          talent-protocol-api-reference-2026-06-03.md for the
          conditions under which the API integration cluster would
          be opened. */}
      <section
        className="rounded-xl border px-3 py-3 text-[0.6875rem] leading-snug"
        style={{
          borderColor: "var(--paper-divider)",
          color: "var(--paper-text-subtle)",
          background: "rgba(255, 235, 180, 0.18)",
        }}
      >
        <p
          className="mb-1 font-semibold"
          style={{ color: "var(--paper-text-muted)" }}
        >
          External verification
        </p>
        <p className="mb-2">
          Independent on-chain metrics for Chesscito (DAU, transactions,
          gas fees) are tracked by Talent Protocol&apos;s project
          impact dashboard. Smart contract source is verified on
          Celoscan.
        </p>
        <ul className="flex flex-col gap-1.5">
          <li>
            <a
              href="https://talent.app/~/projects/e850a453-2b0c-4080-a070-781d712791a7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-[var(--paper-text)]"
              style={{ color: "var(--paper-text-muted)" }}
            >
              <span aria-hidden>→</span>
              <span>View live Talent Protocol dashboard</span>
            </a>
          </li>
          <li>
            <a
              href="https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-[var(--paper-text)]"
              style={{ color: "var(--paper-text-muted)" }}
            >
              <span aria-hidden>→</span>
              <span>Badges contract on Celoscan</span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
