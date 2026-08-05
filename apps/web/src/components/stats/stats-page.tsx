import type {
  DailyBucket,
  DifficultyTally,
  PublicStats,
} from "@/lib/stats/public-aggregator";
import { StatCard } from "./stat-card";
import { PlayersTable } from "./players-table";
import type { PlayersCensus } from "@/lib/stats/players-census";
import { PlayerIdentityPill } from "@/components/identity/player-identity-pill";
import { formatNickname, type NicknameTokens } from "@/lib/identity/identity-lite";
import {
  statsFiltersToQuery,
  type ContainerFilter,
  type StatsFilters,
  type SurfaceFilter,
} from "@/lib/stats/filters";
import type {
  AccessFunnel,
  AccountLifecycle,
  ActivationFunnel,
  CountryCount,
  HabitDepth,
  Retention,
} from "@/lib/stats/funnels";

const ACTIVATION_STEP_LABELS: Record<string, string> = {
  app_opened: "App opened",
  hub_viewed: "Hub viewed",
  exercise_started: "Exercise started",
  exercise_completed: "Exercise completed",
  daily_focus_started: "Daily Focus started",
  daily_focus_completed: "Daily Focus done",
};

/** Plain-language step names. The dashboard is read by people deciding what to
 *  build next, not by whoever named the events. */
const ACCESS_STEP_LABELS: Record<string, string> = {
  gate_viewed: "Login screen shown",
  login_started: "Tapped ENTER",
  login_succeeded: "Signed in",
  wallet_ready: "Wallet ready",
  first_exercise_completed: "First exercise finished",
};

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryLabel(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Surface + container filters as plain links (no client JS, no global state):
 *  each chip navigates to the same path with an updated querystring, keeping
 *  the other filter intact. */
function FilterControls({ filters }: { filters: StatsFilters }) {
  const surfaceOptions: Array<{ value: SurfaceFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "learn", label: "Learn" },
    { value: "play", label: "Play" },
  ];
  const containerOptions: Array<{ value: ContainerFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "minipay", label: "MiniPay" },
    { value: "browser", label: "Browser" },
  ];
  const chip = (active: boolean, href: string, label: string, key: string) => (
    <a
      key={key}
      href={href}
      aria-current={active ? "true" : undefined}
      className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
      style={{
        borderColor: "var(--paper-divider)",
        background: active ? "var(--paper-text)" : "rgba(255,255,255,0.6)",
        color: active ? "var(--paper-bg, #fff)" : "var(--paper-text-muted)",
      }}
    >
      {label}
    </a>
  );
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex items-center gap-1.5">
        <span
          className="text-[0.625rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Surface
        </span>
        {surfaceOptions.map((o) =>
          chip(
            filters.surface === o.value,
            statsFiltersToQuery({ ...filters, surface: o.value }) || "?",
            o.label,
            `s-${o.value}`,
          ),
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-[0.625rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Container
        </span>
        {containerOptions.map((o) =>
          chip(
            filters.container === o.value,
            statsFiltersToQuery({ ...filters, container: o.value }) || "?",
            o.label,
            `c-${o.value}`,
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Access funnel: door → value. Every step is scoped to the sessions that saw
 * the login screen, so the bars are monotonic by construction and each gap is
 * a real drop. Absolute counts, same as the activation funnel — a rate over
 * three sessions reads as 33% and means nothing.
 */
function AccessFunnelChart({ funnel }: { funnel: AccessFunnel }) {
  const top = Math.max(1, ...funnel.steps.map((s) => s.sessions));
  return (
    <div className="flex flex-col gap-1.5">
      {funnel.steps.map((s) => {
        const pct = (s.sessions / top) * 100;
        return (
          <div key={s.step} className="flex items-center gap-2 text-xs">
            <span
              className="w-40 shrink-0"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {ACCESS_STEP_LABELS[s.step] ?? s.step}
            </span>
            <span
              className="h-4 rounded"
              style={{
                width: `${Math.max(pct, s.sessions > 0 ? 3 : 0)}%`,
                minWidth: s.sessions > 0 ? "0.5rem" : 0,
                background: "rgba(191, 106, 74, 0.82)",
              }}
              aria-hidden
            />
            <span
              className="tabular-nums font-semibold"
              style={{ color: "var(--paper-text)" }}
            >
              {nf(s.sessions)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Account lifecycle: people, not browsers. The three buckets are a partition
 * of every known account, so the copy names the denominator — a reader can
 * check that they add up without trusting the page.
 */
function AccountLifecycleCards({ life }: { life: AccountLifecycle }) {
  const cards: Array<{ label: string; value: number | null; tone: string }> = [
    { label: "Active (7d)", value: life.active7d, tone: "rgba(58, 128, 148, 0.9)" },
    { label: "Dormant", value: life.dormant, tone: "rgba(191, 148, 74, 0.9)" },
    { label: "Inactive", value: life.inactive, tone: "rgba(150, 140, 130, 0.75)" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {cards.map(({ label, value, tone }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-xl border px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.92)",
              borderColor: "var(--paper-divider)",
            }}
          >
            <span
              className="text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              {label}
            </span>
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: tone }}
            >
              {formatStat(value)}
            </span>
          </div>
        ))}
      </div>
      <p
        className="text-[0.6875rem] leading-snug"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        {/* The three head counts are exact; the partition above may not be.
            "last 7 days" rather than "this week" because the window is a
            ROLLING one — the product's other weekly surface starts on Monday
            UTC and the two would disagree by up to six days. */}
        Of {nf(life.known)} accounts ever seen · {nf(life.newToday)} arrived
        today, {nf(life.new7d)} in the last 7 days ·{" "}
        {formatStat(life.resurrected7d)} came back after going quiet. Dormant
        means no activity for 8–29 days; inactive means none in the last 30.
        {life.active7d === null
          ? " The three figures above could not be measured for this snapshot — they are unavailable, not zero."
          : ""}
      </p>
    </div>
  );
}

/**
 * Habit depth: how many distinct days an install actually showed up. This is
 * the 21-day promise made checkable — a retention rate can look healthy while
 * everyone visits twice, and this cannot.
 */
function HabitDepthChart({ depth }: { depth: HabitDepth }) {
  const top = Math.max(1, ...depth.buckets.map((b) => b.installs));
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5">
        {depth.buckets.map((b) => (
          <div key={b.minDays} className="flex items-center gap-2 text-xs">
            <span
              className="w-20 shrink-0"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {b.minDays}+ days
            </span>
            <span
              className="h-4 rounded"
              style={{
                width: `${Math.max((b.installs / top) * 100, b.installs > 0 ? 3 : 0)}%`,
                minWidth: b.installs > 0 ? "0.5rem" : 0,
                background: "rgba(58, 128, 148, 0.7)",
              }}
              aria-hidden
            />
            <span
              className="tabular-nums font-semibold"
              style={{ color: "var(--paper-text)" }}
            >
              {nf(b.installs)}
            </span>
          </div>
        ))}
      </div>
      <p
        className="text-[0.6875rem] leading-snug"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        Distinct active days per install over the window · median{" "}
        {nf(depth.medianActiveDays)} of {nf(depth.cohort)} active installs.
      </p>
    </div>
  );
}

/** Activation funnel: distinct sessions per canonical step, absolute counts
 *  (no rates — a single session can read as 100% at early volume).
 *
 *  Takes the structural shape rather than `ActivationFunnel` so the Daily
 *  sibling renders through the SAME bars. Two charts that look different would
 *  imply the two funnels measure different things; they measure the same thing
 *  down two branches. Each chart scales to ITS OWN top, so a small Daily
 *  branch stays readable next to a large training one — the bars compare
 *  within a funnel, never across. */
function ActivationFunnelChart({
  funnel,
}: {
  funnel: ReadonlyArray<{ step: string; sessions: number }>;
}) {
  const top = Math.max(1, ...funnel.map((s) => s.sessions));
  return (
    <div className="flex flex-col gap-1.5">
      {funnel.map((s) => {
        const pct = (s.sessions / top) * 100;
        return (
          <div key={s.step} className="flex items-center gap-2 text-xs">
            <span
              className="w-32 shrink-0"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {ACTIVATION_STEP_LABELS[s.step] ?? s.step}
            </span>
            <span
              className="h-4 rounded"
              style={{
                width: `${Math.max(pct, s.sessions > 0 ? 3 : 0)}%`,
                minWidth: s.sessions > 0 ? "0.5rem" : 0,
                background: "rgba(58, 128, 148, 0.78)",
              }}
              aria-hidden
            />
            <span
              className="tabular-nums font-semibold"
              style={{ color: "var(--paper-text)" }}
            >
              {nf(s.sessions)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopCountriesList({ countries }: { countries: CountryCount[] }) {
  if (countries.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>
        No country data yet.
      </p>
    );
  }
  return (
    <ul className="border-t" style={{ borderColor: "var(--paper-divider)" }}>
      {countries.map((c) => (
        <li
          key={c.country}
          className="flex items-center justify-between gap-2 border-b py-2 text-xs"
          style={{
            color: "var(--paper-text)",
            borderColor: "var(--paper-divider)",
          }}
        >
          <span>
            {countryLabel(c.country)}{" "}
            <span style={{ color: "var(--paper-text-subtle)" }}>
              ({c.country})
            </span>
          </span>
          <span
            className="tabular-nums"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {nf(c.sessions)} {c.sessions === 1 ? "session" : "sessions"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function retentionPct(returned: number, cohort: number): string {
  if (cohort <= 0) return "—";
  return `${Math.round((returned / cohort) * 100)}%`;
}

function RetentionCards({ retention }: { retention: Retention }) {
  const cards: Array<{ label: string; b: Retention["d1"] }> = [
    { label: "D1 retention", b: retention.d1 },
    { label: "D7 retention", b: retention.d7 },
    // Named for the window it measures rather than "D21": it asks whether an
    // install was active at ANY point in its days 15–21, because landing on
    // one exact day three weeks out measures luck, not habit.
    { label: "Week 3 retention", b: retention.week3 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ label, b }) => (
        <div
          key={label}
          className="flex flex-col gap-1 rounded-xl border px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.92)",
            borderColor: "var(--paper-divider)",
          }}
        >
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-wide"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            {label}
          </span>
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: "var(--paper-text)" }}
          >
            {retentionPct(b.returned, b.cohort)}
          </span>
          <span
            className="text-[0.625rem]"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            {b.cohort > 0
              ? `${nf(b.returned)} of ${nf(b.cohort)} installs returned`
              : "Not enough cohort data yet"}
          </span>
        </div>
      ))}
    </div>
  );
}

type StatsPageProps = {
  stats: PublicStats;
  /** The players census — a SIBLING of `stats`, not a field of it.
   *
   *  It is global (no surface/container) and caches on its own entry, so it
   *  cannot live inside `PublicStats`: the page snapshot keys on the filters,
   *  and folding the census in would store an identical copy per combination
   *  and let two views hold censuses from different hours. The two degrade
   *  independently — a dark census does not blank the page. */
  census: PlayersCensus;
  /** Locale-aware tokens built server-side in the route; used to format each
   *  row's nickname from its variant. */
  nicknameTokens: NicknameTokens;
};

// Sparkline accents — deep teal counterpoint for Sessions + warm
// terracotta for Mints. Replaces the prior brown / amber pair which
// blended into the cream scrim. Terracotta echoes the Anthropic /
// Claude Status accent family and stays brand-warm without
// competing with the page background.
const TREND_SESSIONS_ACCENT = "rgba(58, 128, 148, 0.78)";
const TREND_MINTS_ACCENT = "rgba(217, 119, 87, 0.9)";
/** New vs returning are two halves of one quantity, so they share the sessions
 *  hue and separate by weight — not by two unrelated colors that would read as
 *  two unrelated metrics. */
const TREND_NEW_ACCENT = "rgba(58, 128, 148, 0.9)";
const TREND_RETURNING_ACCENT = "rgba(58, 128, 148, 0.42)";

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
  if (tally.easy === max) return "Most current saves are beginner/onboarding activity.";
  if (tally.medium === max) return "Most current saves are mid-skill activity.";
  return "Most current saves are advanced/expert activity.";
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
      `${stats.victories30d} of ${stats.totalVictories} progress saves happened in the last 30 days.`,
    );
  }

  if (stats.victories7d != null) {
    signals.push(
      `${stats.victories7d} progress saves happened in the last 7 days.`,
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
        `Most progress saves are ${label} difficulty, ${context}.`,
      );
    }
  }

  return signals;
}

const TRACKED_TODAY: ReadonlyArray<string> = [
  "App sessions",
  "On-chain tx by method (progress saves, Get Peones, score saves, welcome packs)",
  "Unique wallets transacting on-chain",
  "Get Peones stablecoin volume (USDC / USDT / cUSD)",
  "Leaderboard scores",
];

const COMING_NEXT: ReadonlyArray<string> = [
  "Network fees paid (needs indexer)",
  "Failed transaction rate (needs indexer)",
  "Retention D30 · D3 / D21 cohorts",
  "Monetization funnel · server-confirmed purchases",
];

/** §8 method-tx rows: label + the OnchainMethodTx key it reads. Column
 *  captions map our windows to MiniPay's day/week/month/lifetime ask
 *  (7d ≈ week, 30d ≈ month). */
const ONCHAIN_METHODS: ReadonlyArray<{
  label: string;
  key: "victoryMints" | "packPurchases" | "scoreSaves" | "welcomePackClaims";
}> = [
  { label: "Progress saves", key: "victoryMints" },
  { label: "Get Peones", key: "packPurchases" },
  { label: "Score saves (on-chain)", key: "scoreSaves" },
  { label: "Welcome packs", key: "welcomePackClaims" },
];

/** null → em-dash (a failed query, never "0"); number → grouped. */
function formatStat(n: number | null): string {
  return n === null ? "—" : new Intl.NumberFormat("en-US").format(n);
}

export function StatsPage({ stats, census, nicknameTokens }: StatsPageProps) {
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
          focus training, progress saves, and community activity.
        </p>
        <p
          className="text-xs md:text-sm leading-snug"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          These numbers describe platform-level activity, not a single
          player profile. Some metrics are exact counts from Chesscito
          records, while active sessions are anonymous usage estimates.
        </p>
        {/* An explicit stamp, NOT a cadence promise. `revalidate` is a floor,
            not a ceiling: with stale-while-revalidate the first request past
            the TTL still gets the old snapshot, so "Updated hourly" was
            measurably false — one surface served a 5h22m-old snapshot under
            that exact line. A timestamp the reader can check beats a promise
            the cache does not keep. */}
        <p
          data-testid="snapshot-stamp"
          className="text-[0.6875rem]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Snapshot taken{" "}
          <span style={{ color: "var(--paper-text-muted)" }}>
            {formatGeneratedAt(stats.generatedAt)}
          </span>
        </p>
        <FilterControls filters={stats.filters} />
      </header>

      {/* Integrity notice — above every number, not buried in methodology. A
          read that stopped at the ceiling looks exactly like a quiet decline,
          and that is the one misreading this page cannot afford. Silent when
          every read came back whole, which is the normal case. */}
      {stats.dataIntegrity.truncated.length > 0 ? (
        <p
          data-testid="integrity-notice"
          className="rounded-lg px-3 py-2 text-[0.6875rem] leading-snug"
          style={{
            background: "rgba(217, 119, 87, 0.12)",
            color: "var(--paper-text-muted)",
          }}
        >
          Some reads hit the {nf(stats.dataIntegrity.rowCeiling)}-row transport
          ceiling, so the metrics built on them are shown as{" "}
          <span style={{ color: "var(--paper-text)" }}>—</span> and are
          temporarily unavailable —{" "}
          <span style={{ color: "var(--paper-text)" }}>they are not zero</span>.
          Affected reads:{" "}
          <span style={{ color: "var(--paper-text)" }}>
            {stats.dataIntegrity.truncated.join(", ")}
          </span>
          . Everything still showing a number is an exact count.
        </p>
      ) : null}

      {/* Executive Snapshot — vital-signs cockpit. Three hero tiles
          deliver scale at a glance: total minted, weekly sessions,
          monthly mints. The Hero subtitle above already orients the
          reader (so a separate "What this shows" prose block would
          break visual momentum before the first chart). */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Verified Progress Saves"
          value={stats.totalVictories}
          sublabel="Progress saves on Celo mainnet"
          variant="hero"
        />
        <StatCard
          label="Approx. App Sessions (7d)"
          value={stats.activeSessions7d}
          sublabel="Anonymous sessions; not connected wallets"
          variant="hero"
        />
        <StatCard
          label="Progress Saves (30d)"
          value={stats.victories30d}
          sublabel="Saves in the last 30 days"
          variant="hero"
        />
      </section>

      {/* The product question this whole block answers:
          "Do people get in, reach value fast, and come back to build the
          21-day habit?" — read in that order: the door (access funnel), the
          first session (activation funnel), and the return (retention).
          All sub-blocks honor the surface/container filters above. Absolute
          counts, no rates (a single session reads as 100% at early volume). */}
      <section className="space-y-5">
        <div>
          <h3
            className="mb-1 text-base font-bold md:text-lg"
            style={{ color: "var(--paper-text)" }}
          >
            Do they get in, reach value, and come back?
          </h3>
          <p
            className="text-[0.6875rem] leading-tight"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            The door, the first session, and the return — last 30 days
            {stats.filters.surface !== "all" || stats.filters.container !== "all"
              ? `, filtered by ${[
                  stats.filters.surface !== "all" ? stats.filters.surface : null,
                  stats.filters.container !== "all"
                    ? stats.filters.container
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}`
              : ""}
            .
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="App Opens (30d)"
            value={stats.appOpens30d}
            sublabel="Distinct sessions that opened the app"
            variant="hero"
          />
        </div>

        {/* 1 — The door. First because it is the only mandatory step: since
            the gate shipped there is no guest path, so anyone lost here is
            lost entirely, and no later number can recover them. */}
        {stats.accessFunnel ? (
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              1 · Do they get in? · gate sessions, web only
            </p>
            <AccessFunnelChart funnel={stats.accessFunnel} />
            {stats.accessFunnel.failedSessions > 0 ? (
              <p
                className="mt-2 text-[0.6875rem]"
                style={{ color: "var(--paper-text-subtle)" }}
              >
                {nf(stats.accessFunnel.failedSessions)} of these sessions hit a
                login error at least once (they may still have signed in after
                retrying).
              </p>
            ) : null}
          </div>
        ) : null}

        {/* 2 — The first session, for everyone who is already inside
            (MiniPay included, which never sees the gate above). */}
        {/* Two SIBLING funnels, never one column. Both branch off the same
            `App opened → Hub viewed`; finishing the Daily is not a later stage
            of training, and stacking them implied a subset that does not
            exist (handoff 2026-08-05). */}
        {stats.activation || stats.dailyFocusFunnel ? (
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              2 · Do they reach value? · distinct sessions
            </p>
            <p
              className="mb-3 text-[0.625rem] leading-snug"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              Two branches off the same start. A session can appear in both,
              one, or neither — they are not stages of each other.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {stats.activation ? (
                <div>
                  <p
                    className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--paper-text-muted)" }}
                  >
                    Training
                  </p>
                  <ActivationFunnelChart funnel={stats.activation} />
                </div>
              ) : null}
              {stats.dailyFocusFunnel ? (
                <div>
                  <p
                    className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--paper-text-muted)" }}
                  >
                    Daily Focus
                  </p>
                  <ActivationFunnelChart funnel={stats.dailyFocusFunnel} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              Top countries · by sessions
            </p>
            <TopCountriesList countries={stats.topCountries} />
          </div>
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              3 · Do they come back?
            </p>
            {stats.retention ? (
              <RetentionCards retention={stats.retention} />
            ) : (
              <p
                className="text-xs"
                style={{ color: "var(--paper-text-subtle)" }}
              >
                Retention data unavailable.
              </p>
            )}
          </div>
        </div>

        {/* 4 — The habit itself. Retention rates above are snapshots; these two
            blocks say who those people ARE (accounts, not browsers) and how
            often they actually show up, which is the 21-day promise made
            checkable. Both are hidden rather than zeroed when unavailable:
            the account block needs a denominator that only exists once
            TELEMETRY_ACCOUNT_SECRET is configured. */}
        {stats.accountLifecycle ? (
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              4 · Who are they? · accounts, not devices
            </p>
            <AccountLifecycleCards life={stats.accountLifecycle} />
          </div>
        ) : null}

        {stats.habitDepth && stats.habitDepth.cohort > 0 ? (
          <div>
            <p
              className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--paper-text-subtle)" }}
            >
              5 · Is it becoming a habit? · active days per install
            </p>
            <HabitDepthChart depth={stats.habitDepth} />
          </div>
        ) : null}
      </section>

      {/* Activity trend chart — first visual right after Snapshot so
          the reader's absorb-numbers mode carries straight into the
          sparklines without a prose block in between. Hidden entirely
          when the aggregator returned an empty trend. */}
      {stats.activityTrend30d.length > 0 ? (() => {
        const sessions = stats.activityTrend30d.map((b: DailyBucket) => b.sessions);
        const mints = stats.activityTrend30d.map((b: DailyBucket) => b.mints);
        const newInstalls = stats.activityTrend30d.map(
          (b: DailyBucket) => b.newInstalls,
        );
        const returningInstalls = stats.activityTrend30d.map(
          (b: DailyBucket) => b.returningInstalls,
        );
        const sessionsTotal = sessions.reduce((a, b) => a + b, 0);
        const mintsTotal = mints.reduce((a, b) => a + b, 0);
        const newTotal = newInstalls.reduce((a, b) => a + b, 0);
        const returningTotal = returningInstalls.reduce((a, b) => a + b, 0);
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
              Approx. app sessions and progress saves over the last 30 days.
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
                label="Progress saves"
                total={mintsTotal}
                values={mints}
                accent={TREND_MINTS_ACCENT}
                rangeFrom={first}
                rangeTo={last}
              />
              {/* The same active installs as the sessions panel, partitioned
                  by whether today is their first day ever. The two panels
                  always add back up to it — growth and habit read apart. */}
              <TrendPanel
                label="New installs"
                total={newTotal}
                values={newInstalls}
                accent={TREND_NEW_ACCENT}
                rangeFrom={first}
                rangeTo={last}
              />
              <TrendPanel
                label="Returning installs"
                total={returningTotal}
                values={returningInstalls}
                accent={TREND_RETURNING_ACCENT}
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
            Progress difficulty mix
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
            label="Progress Saves (7d)"
            value={stats.victories7d}
            variant="bare"
          />
          <StatCard
            label="Unique active wallets"
            value={stats.uniqueMintersLifetime}
            variant="bare"
            sublabel="Distinct wallets that saved progress"
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

      {/* Top Minting Wallets — appendix tone. Aggregates the event
          feed by wallet so the same wallet doesn't repeat for every
          mint. Sort: total mints desc, tiebreak by most-recent mint.
          Per-row triplet: wallet · total mints · last mint. */}
      <section>
        <h3
          className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Top Active Wallets
        </h3>
        {stats.topMinters.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            No saves yet.
          </p>
        ) : (
          <ul
            className="border-t"
            style={{ borderColor: "var(--paper-divider)" }}
          >
            {stats.topMinters.map((row) => (
              <li
                key={row.rowId}
                className="flex items-center justify-between gap-2 border-b py-2 text-xs"
                style={{
                  color: "var(--paper-text)",
                  borderColor: "var(--paper-divider)",
                }}
              >
                <PlayerIdentityPill
                  variant={row.variant}
                  name={formatNickname(row.variant, nicknameTokens)}
                  size="sm"
                />
                <span
                  className="text-[0.625rem] uppercase tracking-wide tabular-nums"
                  style={{ color: "var(--paper-text-subtle)" }}
                >
                  {row.mintCount === 1 ? "1 save" : `${row.mintCount} saves`}
                </span>
                <span
                  className="text-[0.6875rem] tabular-nums"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  last save {formatRelative(row.lastMintedAt)}
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
          Based on game scores, not only saved progress.
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
                key={`${row.rank}-${row.rowId}`}
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
                <PlayerIdentityPill
                  variant={row.variant}
                  name={formatNickname(row.variant, nicknameTokens)}
                  size="sm"
                  className="flex-1"
                />
                <span className="font-semibold">
                  {new Intl.NumberFormat("en-US").format(row.totalScore)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Players census — the podium's companion, deliberately placed right
          after it. Two rankings on one screen only work if they answer
          different questions: the block above is WHO IS WINNING (top 10, the
          same cut Leaders shows), this one is HOW MANY THERE ARE. It exists so
          the "17" the Leaders hero states can actually be counted, which is
          why it ignores the filters above and says so in its own header. */}
      {/* The component owns its own <section> and heading, so that when the
          block hides there is no orphaned title left behind — and so the
          decision to hide lives in exactly one place. */}
      <PlayersTable census={census} nicknameTokens={nicknameTokens} />

      {/* §8 On-chain Activity (MiniPay Stage-2). Per-method tx counts +
          unique on-chain wallets + Get Peones stablecoin volume, all
          derived from the Supabase mirror tables. Network fees + failed-
          tx stay in the Coming-next lane (need an indexer). */}
      <section>
        <h3
          className="mb-2 text-base font-bold md:text-lg"
          style={{ color: "var(--paper-text)" }}
        >
          On-chain Activity
        </h3>
        <p
          className="mb-3 text-[0.6875rem]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Transactions settled on Celo, by contract method. 7d ≈ this week,
          30d ≈ this month, lifetime = all-time.
        </p>

        {/* Per-method tx table. */}
        <div
          className="border-t"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <div
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b py-2 text-[0.625rem] font-semibold uppercase tracking-wide"
            style={{
              color: "var(--paper-text-subtle)",
              borderColor: "var(--paper-divider)",
            }}
          >
            <span>Method</span>
            <span className="text-right">Lifetime</span>
            <span className="text-right">30d</span>
            <span className="text-right">7d</span>
          </div>
          {ONCHAIN_METHODS.map(({ label, key }) => {
            const row = stats.onchain.methodTx[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b py-2 text-xs"
                style={{
                  color: "var(--paper-text)",
                  borderColor: "var(--paper-divider)",
                }}
              >
                <span>{label}</span>
                <span className="text-right tabular-nums">{formatStat(row.lifetime)}</span>
                <span className="text-right tabular-nums">{formatStat(row.last30d)}</span>
                <span className="text-right tabular-nums">{formatStat(row.last7d)}</span>
              </div>
            );
          })}
        </div>

        {/* Unique wallets + Get Peones volume. */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <StatCard
            label="Unique on-chain wallets"
            value={stats.onchain.uniqueOnchainUsersLifetime}
            variant="bare"
            sublabel="Distinct wallets across mints, Get Peones & score saves"
          />
        </div>

        <div className="mt-3">
          <p
            className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            Get Peones volume
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <StatCard label="USDC" value={stats.onchain.getPeonesVolume.usdc} variant="bare" />
            <StatCard label="USDT" value={stats.onchain.getPeonesVolume.usdt} variant="bare" />
            <StatCard label="cUSD" value={stats.onchain.getPeonesVolume.cusd} variant="bare" />
          </div>
        </div>
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
          wallets. Progress saves count verified on-chain saves.
          Leaderboard entries are based on game scores and may include
          players who have not saved progress on-chain.
        </p>
      </section>

      {/* Challenge Funnel — B2.1. Only rendered when data is present
          (null = DB unavailable). Rates excluded intentionally:
          at early-stage volume a single share can read as 100%. */}
      {stats.challengeFunnel && (
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--paper-text-muted)" }}
          >
            Challenge Funnel
          </h2>
          <p
            className="text-xs"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            Activity from shared challenge links (last 30 days).
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard
              label="Opens"
              value={stats.challengeFunnel.opens}
              sublabel="Challenge link opened"
            />
            <StatCard
              label="Starts"
              value={stats.challengeFunnel.starts}
              sublabel="Puzzle interaction begun"
            />
            <StatCard
              label="Completed"
              value={stats.challengeFunnel.completions}
              sublabel="Puzzle solved"
            />
            <StatCard
              label="Shares"
              value={stats.challengeFunnel.shares}
              sublabel="Shared after completing"
            />
            <StatCard
              label="Continued to Learn"
              value={stats.challengeFunnel.continueToLite}
              sublabel="Tapped continue to app"
            />
          </div>
        </section>
      )}

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
          <li>
            <a
              href="https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-[var(--paper-text)]"
              style={{ color: "var(--paper-text-muted)" }}
            >
              <span aria-hidden>→</span>
              <span>Progress saves contract on Celoscan</span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
