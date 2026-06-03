import type { DifficultyTally, PublicStats } from "@/lib/stats/public-aggregator";
import { StatCard } from "./stat-card";

type StatsPageProps = {
  stats: PublicStats;
};

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

export function StatsPage({ stats }: StatsPageProps) {
  const diff = stats.victoriesByDifficulty;

  return (
    <div className="space-y-6">
      <p
        className="text-[0.6875rem]"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        Public platform metrics. Updated hourly. As of{" "}
        <span style={{ color: "var(--paper-text-muted)" }}>
          {formatGeneratedAt(stats.generatedAt)}
        </span>
        .
      </p>

      {/* Primary headline metrics — platform-level signal, not
          player-level. Welcome Packs (potentially zero-state or env-
          dependent) sits in the secondary grid below. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Victories Minted"
          value={stats.totalVictories}
          sublabel="Lifetime on Celo mainnet"
        />
        <StatCard
          label="Approx. Active Sessions (7d)"
          value={stats.activeSessions7d}
          sublabel="Unique sessions; sub-counts cross-device users"
        />
        <StatCard
          label="Victories (30d)"
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
            label="Victories (7d)"
            value={stats.victories7d}
            variant="secondary"
          />
          <StatCard
            label="Unique Minter Wallets"
            value={stats.uniqueMintersLifetime}
            variant="secondary"
            sublabel="Wallets with Victory mints"
          />
          <StatCard
            label="Approx. Sessions (30d)"
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

      {/* Hall of Fame */}
      <section>
        <h3
          className="mb-2 text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          Hall of Fame
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

      {/* Leaderboard */}
      <section>
        <h3
          className="mb-1 text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          Top 10 Leaderboard
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

      {/* Methodology + caveats */}
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
          Active sessions counted by anonymous client-side IDs. A single
          user across multiple devices appears as multiple sessions.
          Wallet retention (D1 / D7 / D30), stablecoin volume, protocol
          revenue, and failed-tx rate are not yet available on this page.
        </p>
      </section>
    </div>
  );
}
