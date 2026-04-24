"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PageSection } from "@/components/redesign/page-section";
import { CandyChip } from "@/components/redesign/candy-chip";
import { Button } from "@/components/ui/button";
import { TrophyList } from "@/components/trophies/trophy-list";
import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { getVictoryAddress } from "@/lib/game/victory-events";
import { TROPHY_VITRINE_COPY, ACHIEVEMENTS_COPY, ROADMAP_COPY } from "@/lib/content/editorial";
import { computeAchievements } from "@/lib/achievements/compute";
import type { VictoryEntry } from "@/lib/game/victory-events";

type ApiVictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

function toVictoryEntry(row: ApiVictoryRow): VictoryEntry {
  return {
    tokenId: BigInt(row.tokenId),
    player: row.player,
    difficulty: row.difficulty,
    totalMoves: row.totalMoves,
    blockNumber: 0n,
    logIndex: 0,
    timestamp: row.timestamp,
    timeMs: row.timeMs,
  };
}

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

function getOptimisticVictory(): ApiVictoryRow | null {
  try {
    const raw = sessionStorage.getItem("chesscito:optimistic-victory");
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > OPTIMISTIC_TTL_MS) {
      sessionStorage.removeItem("chesscito:optimistic-victory");
      return null;
    }
    return {
      tokenId: entry.tokenId,
      player: entry.player,
      difficulty: entry.difficulty,
      totalMoves: entry.totalMoves,
      timeMs: entry.timeMs,
      timestamp: Math.floor(entry.ts / 1000),
    };
  } catch {
    return null;
  }
}

function clearOptimisticVictory() {
  try { sessionStorage.removeItem("chesscito:optimistic-victory"); } catch { /* ignore */ }
}

/**
 * TrophiesBody — pure content (no shell, no header). Renders three
 * sections (My Victories / Achievements / Hall of Fame) in rookie-
 * friendly order + a demoted roadmap footer. Consumed by the
 * standalone /trophies route AND by the dock TrophiesSheet so both
 * surfaces share behavior and data-fetching. No props: reads wallet
 * via wagmi and fetches /api routes directly.
 */
export function TrophiesBody() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [myVictories, setMyVictories] = useState<VictoryEntry[]>();
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [myLoading, setMyLoading] = useState(false);
  const [hofLoading, setHofLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [hofError, setHofError] = useState<string | null>(null);

  const configured = getVictoryAddress() !== null;

  const loadHallOfFame = useCallback(async () => {
    if (!configured) {
      setHofLoading(false);
      return;
    }
    setHofLoading(true);
    setHofError(null);
    try {
      const res = await fetch("/api/hall-of-fame");
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        const found = entries.some((e) => e.player.toLowerCase() === optimistic.player.toLowerCase());
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setHallOfFame(entries);
    } catch {
      setHofError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setHofLoading(false);
    }
  }, [configured]);

  const loadMyVictories = useCallback(async () => {
    if (!address || !configured) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const res = await fetch(`/api/my-victories?player=${address}`);
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic && optimistic.player.toLowerCase() === address?.toLowerCase()) {
        const found = entries.some((e) => String(e.tokenId) === optimistic.tokenId);
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setMyVictories(entries);
    } catch {
      setMyError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setMyLoading(false);
    }
  }, [address, configured]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  useEffect(() => {
    if (isConnected && address) {
      void loadMyVictories();
    }
  }, [isConnected, address, loadMyVictories]);

  return (
    <>
      {!configured && (
        <p className="py-6 text-center text-sm" style={{ color: "var(--paper-text-muted)" }}>
          {TROPHY_VITRINE_COPY.configError}
        </p>
      )}

      {configured && (() => {
        /* Rookie = not connected yet, OR connected but no wins recorded.
           Champions = at least one recorded victory. Rookies lead with
           Hall of Fame (social proof / inspiration); champions lead
           with their own trophies (identity). Achievements sits after
           the hero in both cases — it's the bridge, not the anchor. */
        const hasVictories = (myVictories?.length ?? 0) > 0;
        const isChampion = isConnected && hasVictories;
        const isEmptyConnected =
          isConnected && myVictories?.length === 0 && !myLoading && !myError;
        const summary = computeAchievements(myVictories);

        const myVictoriesSection = (
          <PageSection
            key="my-victories"
            icon={<CandyIcon name="crown" className="h-4 w-4" />}
            title={TROPHY_VITRINE_COPY.myVictories}
          >
            {!isConnected ? (
              <div
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-5 text-center"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  border: "1px solid rgba(110, 65, 15, 0.22)",
                  boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                <CandyIcon name="wallet" className="h-8 w-8" />
                <p className="text-sm" style={{ color: "var(--paper-text-muted)" }}>
                  {TROPHY_VITRINE_COPY.connectWallet}
                </p>
                <Button
                  type="button"
                  variant="game-primary"
                  size="game-sm"
                  onClick={() => openConnectModal?.()}
                >
                  {TROPHY_VITRINE_COPY.connectWalletButton}
                </Button>
              </div>
            ) : isEmptyConnected ? (
              /* Rookie CTA card — trophy hero + invitation + primary
                 Button wrapping a Link to /arena (asChild). */
              <div
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-5 text-center"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  border: "1px solid rgba(110, 65, 15, 0.22)",
                  boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, rgba(217, 180, 74, 0.12) 55%, transparent 80%)",
                    }}
                  />
                  <CandyIcon name="trophy" className="relative h-10 w-10" />
                </div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--paper-text)" }}
                >
                  {TROPHY_VITRINE_COPY.noVictories}
                </p>
                <Button asChild variant="game-primary" size="game-sm">
                  <Link href="/arena">{TROPHY_VITRINE_COPY.arenaLink}</Link>
                </Button>
              </div>
            ) : (
              <TrophyList
                victories={myVictories}
                loading={myLoading}
                error={myError}
                emptyMessage={TROPHY_VITRINE_COPY.noVictories}
                variant="victory"
                onRetry={loadMyVictories}
              />
            )}
          </PageSection>
        );

        const achievementsSection = (
          <PageSection
            key="achievements"
            icon={<CandyIcon name="star" className="h-4 w-4" />}
            title={ACHIEVEMENTS_COPY.sectionTitle}
            description={ACHIEVEMENTS_COPY.sectionDescription(summary.earnedCount, summary.total)}
          >
            <AchievementsGrid achievements={summary.list} />
            {summary.earnedCount === 0 && (
              <p
                className="mt-3 text-center text-[11px]"
                style={{ color: "rgba(110, 65, 15, 0.60)" }}
              >
                {ACHIEVEMENTS_COPY.emptyHint}
              </p>
            )}
          </PageSection>
        );

        const hallOfFameSection = (
          <PageSection
            key="hall-of-fame"
            icon={<CandyIcon name="trophy" className="h-4 w-4" />}
            title={TROPHY_VITRINE_COPY.hallOfFame}
          >
            <TrophyList
              victories={hallOfFame}
              loading={hofLoading}
              error={hofError}
              emptyMessage={TROPHY_VITRINE_COPY.noGlobalVictories}
              variant="hall-of-fame"
              onRetry={loadHallOfFame}
            />
          </PageSection>
        );

        const ordered = isChampion
          ? [myVictoriesSection, achievementsSection, hallOfFameSection]
          : [hallOfFameSection, myVictoriesSection, achievementsSection];

        return <>{ordered}</>;
      })()}

      {/* Roadmap — footer register. Demoted from full PageSection so
          it reads as transparency, not a competing surface. */}
      <footer
        className="mt-2 border-t pt-4"
        style={{ borderColor: "var(--paper-divider)" }}
      >
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "rgba(110, 65, 15, 0.60)" }}
        >
          {ROADMAP_COPY.sectionTitle}
        </p>
        <ul className="flex flex-col gap-1.5" role="list">
          {ROADMAP_COPY.items.map((item) => (
            <li
              key={item.title}
              className="flex items-baseline gap-2 text-[11px] leading-tight"
            >
              <span
                className="font-bold"
                style={{ color: "rgba(110, 65, 15, 0.80)" }}
              >
                {item.title}
              </span>
              <span style={{ color: "rgba(110, 65, 15, 0.55)" }}>
                · {item.description}
              </span>
              <span className="ml-auto shrink-0">
                <CandyChip variant="warm" tone="subtle">
                  {ROADMAP_COPY.soonTag}
                </CandyChip>
              </span>
            </li>
          ))}
        </ul>
      </footer>
    </>
  );
}
