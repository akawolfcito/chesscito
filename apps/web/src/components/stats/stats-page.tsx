import type {
  DailyBucket,
  DifficultyTally,
  PublicStats,
} from "@/lib/stats/public-aggregator";
import { StatCard } from "./stat-card";

type StatsPageProps = {
  stats: PublicStats;
};

const TREND_SESSIONS_ACCENT = "rgba(110, 65, 15, 0.55)";
const TREND_MINTS_ACCENT = "rgba(217, 119, 6, 0.85)";
const DIFFICULTY_BAR_TRACK = "rgba(110, 65, 15, 0.10)";
const DIFFICULTY_BAR_FILL = "rgba(217, 119, 6, 0.85)";

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
    <div className="paper-tray flex flex-col gap-2 px-4 py-3">
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

function DifficultyMixChart({ tally }: { tally: DifficultyTally }) {
  const total = tally.easy + tally.medium + tally.hard;
  if (total <= 0) return null;
  const bands: Array<{ key: keyof DifficultyTally; label: string }> = [
    { key: "easy", label: "Easy" },
    { key: "medium", label: "Medium" },
    { key: "hard", label: "Hard" },
  ];
  return (
    <div className="paper-tray flex flex-col gap-2 px-4 py-3">
      {bands.map((b) => {
        const value = tally[b.key];
        const pct = (value / total) * 100;
        return (
          <div key={b.key} className="flex items-center gap-3 text-xs">
            <span
              className="w-16 shrink-0 font-semibold"
              style={{ color: "var(--paper-text)" }}
            >
              {b.label}
            </span>
            <div
              className="flex-1 overflow-hidden rounded-full"
              style={{ background: DIFFICULTY_BAR_TRACK, height: "0.625rem" }}
              role="img"
              aria-label={`${b.label}: ${value} of ${total} mints (${pct.toFixed(0)}%)`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: DIFFICULTY_BAR_FILL,
                }}
              />
            </div>
            <span
              className="w-12 shrink-0 text-right font-semibold tabular-nums"
              style={{ color: "var(--paper-text)" }}
            >
              {nf(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const DIFFICULTY_LABELS: Record<keyof DifficultyTally, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

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

const WHAT_THIS_SHOWS: ReadonlyArray<string> = [
  "Recent app activity from anonymous sessions.",
  "On-chain saved victories from Chesscito records.",
  "Community activity from mints and scoreboards.",
];

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

      {/* What this shows — orientation block so a reviewer reads the
          numbers below as platform analytics, not as a personal
          dashboard or a marketing scoreboard. */}
      <section>
        <h2
          className="mb-2 text-sm font-bold md:text-base"
          style={{ color: "var(--paper-text)" }}
        >
          What this shows
        </h2>
        <ul
          className="space-y-1.5 text-xs md:text-sm"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {WHAT_THIS_SHOWS.map((line) => (
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
      </section>

      {/* Primary headline metrics — platform-level signal, not
          player-level. Welcome Packs (potentially zero-state or env-
          dependent) sits in the secondary grid below. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Victory NFTs Minted"
          value={stats.totalVictories}
          sublabel="Saved victories on Celo mainnet"
        />
        <StatCard
          label="Approx. App Sessions (7d)"
          value={stats.activeSessions7d}
          sublabel="Anonymous sessions; not connected wallets"
        />
        <StatCard
          label="Victory Mints (30d)"
          value={stats.victories30d}
          sublabel="Mints in the last 30 days"
        />
      </section>

      {/* Secondary metrics */}
      <section>
        <h3
          className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Activity windows
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard
            label="Victory Mints (7d)"
            value={stats.victories7d}
            variant="secondary"
          />
          <StatCard
            label="Wallets with Victory Mints"
            value={stats.uniqueMintersLifetime}
            variant="secondary"
            sublabel="Distinct wallets that minted a Victory"
          />
          <StatCard
            label="Approx. App Sessions (30d)"
            value={stats.activeSessions30d}
            variant="secondary"
          />
          <StatCard
            label="Welcome Packs Claimed"
            value={stats.welcomePacksLifetime}
            variant="secondary"
            sublabel="Claims tracked after launch"
          />
          <StatCard
            label="Welcome Packs (7d)"
            value={stats.welcomePacks7d}
            variant="secondary"
          />
        </div>
      </section>

      {/* Difficulty breakdown */}
      <section>
        <h3
          className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Victories by difficulty
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((key) => (
            <StatCard
              key={key}
              label={DIFFICULTY_LABELS[key]}
              value={diff ? diff[key] : null}
              variant="secondary"
            />
          ))}
        </div>
      </section>

      {/* Platform signals — short narrated insights derived from the
          numbers above. Each bullet is independently null-gated by
          computePlatformSignals, so a missing field drops its line
          instead of producing a partial sentence. Section is hidden
          entirely when no signal is computable. */}
      {platformSignals.length > 0 ? (
        <section>
          <h3
            className="mb-2 text-base font-bold md:text-lg"
            style={{ color: "var(--paper-text)" }}
          >
            Platform signals
          </h3>
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
        </section>
      ) : null}

      {/* Activity trend chart — two 30-day sparklines (sessions +
          mints) over the same time axis. Hidden entirely when the
          aggregator returned an empty trend (both upstream queries
          failed) rather than rendering an empty grid. */}
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

      {/* Victory difficulty mix — horizontal bars complement the
          three-card breakdown above; cards give precise integers,
          bars give visual proportion at a glance. */}
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

      {/* Recent Victory Mints (was: "Hall of Fame" — renamed so the
          section reads as a platform activity feed rather than an
          opinionated curatorial list). */}
      <section>
        <h3
          className="mb-2 text-base font-bold md:text-lg"
          style={{ color: "var(--paper-text)" }}
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
          <ul className="space-y-1.5">
            {stats.hallOfFame.map((row) => (
              <li
                key={row.tx_hash}
                className="paper-tray flex items-center justify-between gap-2 px-3 py-2 text-xs"
                style={{ color: "var(--paper-text)" }}
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

      {/* Community Leaderboard (was: "Top 10 Leaderboard"). */}
      <section>
        <h3
          className="mb-1 text-base font-bold md:text-lg"
          style={{ color: "var(--paper-text)" }}
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
          <ol className="space-y-1.5">
            {stats.leaderboardTop10.map((row) => (
              <li
                key={`${row.rank}-${row.player}`}
                className="paper-tray flex items-center justify-between gap-2 px-3 py-2 text-xs"
                style={{ color: "var(--paper-text)" }}
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
    </div>
  );
}
