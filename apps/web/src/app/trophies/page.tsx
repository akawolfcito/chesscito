"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { TrophyPageShell } from "@/components/trophies/trophy-page-shell";
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

export default function TrophiesPage() {
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
    <TrophyPageShell
      title={TROPHY_VITRINE_COPY.pageTitle}
      subtitle={TROPHY_VITRINE_COPY.pageDescription}
      backHref="/"
    >
      {!configured && (
        <p className="py-6 text-center text-sm" style={{ color: "var(--paper-text-muted)" }}>
          {TROPHY_VITRINE_COPY.configError}
        </p>
      )}

      {configured && (
        <>
          <PageSection
            icon={<CandyIcon name="crown" className="h-4 w-4" />}
            title={TROPHY_VITRINE_COPY.myVictories}
          >
            {!isConnected ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-center text-sm" style={{ color: "var(--paper-text-muted)" }}>
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

            {isConnected && myVictories?.length === 0 && !myLoading && !myError && (
              <Link
                href="/arena"
                className="mt-3 flex min-h-[44px] items-center justify-center rounded-2xl px-6 text-center text-sm font-extrabold transition-all active:scale-[0.97]"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  border: "1px solid rgba(110, 65, 15, 0.28)",
                  color: "rgba(110, 65, 15, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {TROPHY_VITRINE_COPY.arenaLink}
              </Link>
            )}
          </PageSection>

          {(() => {
            const summary = computeAchievements(myVictories);
            return (
              <PageSection
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
          })()}

          <PageSection
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
        </>
      )}

      <PageSection
        icon={<CandyIcon name="crown" className="h-4 w-4" />}
        title={ROADMAP_COPY.sectionTitle}
        description={ROADMAP_COPY.sectionDescription}
      >
        <ul className="flex flex-col gap-2" role="list">
          {ROADMAP_COPY.items.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl px-3 py-2.5"
              style={{
                background: "rgba(255, 245, 215, 0.55)",
                border: "1px solid rgba(110, 65, 15, 0.22)",
                boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              <div className="flex items-center gap-2">
                <p
                  className="text-xs font-extrabold uppercase tracking-wider"
                  style={{
                    color: "rgba(110, 65, 15, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                  }}
                >
                  {item.title}
                </p>
                <span className="ml-auto">
                  <CandyChip variant="warm" tone="solid">
                    {ROADMAP_COPY.soonTag}
                  </CandyChip>
                </span>
              </div>
              <p
                className="mt-1 text-[11px] leading-tight"
                style={{ color: "rgba(110, 65, 15, 0.75)" }}
              >
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </PageSection>
    </TrophyPageShell>
  );
}
