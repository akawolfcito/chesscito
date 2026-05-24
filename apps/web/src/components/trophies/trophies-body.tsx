"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { PageSection } from "@/components/redesign/page-section";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { TrophyList } from "@/components/trophies/trophy-list";
import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { getVictoryAddress } from "@/lib/game/victory-events";
import { computeAchievements } from "@/lib/achievements/compute";
import type { VictoryEntry } from "@/lib/game/victory-events";

type RoadmapItem = { title: string; description: string };

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

export function TrophiesBody() {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  const tAch = useTranslations("ACHIEVEMENTS_COPY");
  const tRoad = useTranslations("ROADMAP_COPY");
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
      setHofError(t("loadError"));
    } finally {
      setHofLoading(false);
    }
  }, [configured, t]);

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
      setMyError(t("loadError"));
    } finally {
      setMyLoading(false);
    }
  }, [address, configured, t]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  useEffect(() => {
    if (isConnected && address) {
      void loadMyVictories();
    }
  }, [isConnected, address, loadMyVictories]);

  if (!configured) {
    return (
      <div className="candy-frame candy-frame-amber flex flex-col items-center gap-3 p-6 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(110, 65, 15, 0.18)" }}
        >
          <CandyIcon name="trophy" className="h-6 w-6" />
        </div>
        <p
          className="text-sm font-semibold leading-relaxed"
          style={{ color: "rgba(63, 34, 8, 0.85)" }}
        >
          {t("configError")}
        </p>
      </div>
    );
  }

  const hasVictories = (myVictories?.length ?? 0) > 0;
  const isChampion = isConnected && hasVictories;
  const isEmptyConnected = isConnected && myVictories?.length === 0 && !myLoading && !myError;
  const summary = computeAchievements(myVictories);

  const myVictoriesSection = (
    <PageSection
      key="my-victories"
      icon={<CandyIcon name="crown" className="h-4 w-4" />}
      title={t("myVictories")}
    >
      {!isConnected ? (
        <div className="candy-frame candy-frame-amber flex flex-col items-center gap-4 p-6 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(110, 65, 15, 0.18)" }}
          >
            <CandyIcon name="wallet" className="h-7 w-7" />
          </div>
          <p
            className="text-sm font-semibold leading-relaxed px-4"
            style={{ color: "rgba(63, 34, 8, 0.85)" }}
          >
            {t("connectWallet")}
          </p>
          <PrincipalButton
            size="medium"
            onClick={() => openConnectModal?.()}
          >
            {t("connectWalletButton")}
          </PrincipalButton>
        </div>
      ) : isEmptyConnected ? (
        <div className="candy-frame candy-frame-amber flex flex-col items-center gap-5 p-8 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: "rgba(255, 224, 102, 0.55)" }}
            />
            <CandyIcon name="trophy" className="relative h-10 w-10" />
          </div>
          <p
            className="text-sm font-semibold leading-relaxed px-2"
            style={{ color: "rgba(63, 34, 8, 0.85)" }}
          >
            {t("noVictories")}
          </p>
          <Link
            href="/arena?fresh=1"
            className="principal-button principal-button-medium inline-flex w-full items-center justify-center text-center"
          >
            <span className="principal-button-label">
              {t("arenaLink")}
            </span>
          </Link>
        </div>
      ) : (
        <TrophyList
          victories={myVictories}
          loading={myLoading}
          error={myError}
          emptyMessage={t("noVictories")}
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
      title={tAch("sectionTitle")}
    >
      <div className="mb-4 flex items-center justify-center gap-2">
        <span className="text-nano font-black uppercase tracking-[0.18em] opacity-30">
          {tAch("progressEyebrow")}
        </span>
        <CandyChip variant="warm" tone="subtle">
          {tAch("sectionDescription", {
            earned: summary.earnedCount,
            total: summary.total,
          })}
        </CandyChip>
      </div>

      <AchievementsGrid achievements={summary.list} />

      {summary.earnedCount === 0 && (
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-widest opacity-40">
          {tAch("emptyHint")}
        </p>
      )}
    </PageSection>
  );

  const hallOfFameSection = (
    <PageSection
      key="hall-of-fame"
      icon={<CandyIcon name="trophy" className="h-4 w-4" />}
      title={t("hallOfFame")}
    >
      <TrophyList
        victories={hallOfFame}
        loading={hofLoading}
        error={hofError}
        emptyMessage={t("noGlobalVictories")}
        variant="hall-of-fame"
        onRetry={loadHallOfFame}
      />
    </PageSection>
  );

  const ordered = isChampion
    ? [myVictoriesSection, achievementsSection, hallOfFameSection]
    : [hallOfFameSection, myVictoriesSection, achievementsSection];

  return (
    <div className="flex flex-col gap-10 pb-10">
      {ordered}

      {/* Roadmap — Footer */}
      <footer className="mt-4 border-t border-[rgba(110,65,15,0.15)] pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(110,65,15,0.15)]" />
          <h3 className="text-nano font-black uppercase tracking-[0.2em] text-[rgba(63,34,8,0.45)]">
            {tRoad("sectionTitle")}
          </h3>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(110,65,15,0.15)]" />
        </div>

        <ul className="flex flex-col gap-3" role="list">
          {(tRoad.raw("items") as RoadmapItem[]).map((item) => (
            <li key={item.title} className="roadmap-item">
              <div className="h-2 w-2 rounded-full bg-amber-500/60" />
              <div className="flex-1">
                <p className="text-xs font-bold text-[rgba(63,34,8,0.95)] leading-none">
                  {item.title}
                </p>
                <p className="text-xs text-[rgba(63,34,8,0.70)] mt-1">
                  {item.description}
                </p>
              </div>
              <CandyChip variant="warm" tone="subtle">
                {tRoad("soonTag")}
              </CandyChip>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
