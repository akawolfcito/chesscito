"use client";

import { useTranslations } from "next-intl";
import { TrophyCard } from "./trophy-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import type { VictoryEntry } from "@/lib/game/victory-events";

function SkeletonCards() {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  return (
    <div className="space-y-3">
      <div className="h-[220px] animate-pulse rounded-[24px] border border-[rgba(255,255,255,0.45)] bg-white/15" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[60px] animate-pulse rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15"
        />
      ))}
      <p className="pt-2 text-center text-xs font-bold uppercase tracking-widest opacity-40">
        {t("loadingText")}
      </p>
    </div>
  );
}

type Props = {
  victories: VictoryEntry[] | undefined;
  loading: boolean;
  error?: string | null;
  emptyMessage: string;
  variant: "victory" | "hall-of-fame";
  onRetry?: () => void;
};

export function TrophyList({
  victories,
  loading,
  error,
  emptyMessage,
  variant,
  onRetry,
}: Props) {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  if (loading) return <SkeletonCards />;

  if (error) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          borderColor: "rgba(190, 18, 60, 0.35)",
          background: "rgba(254, 226, 226, 0.55)",
        }}
      >
        <p className="text-sm font-bold" style={{ color: "rgba(159, 18, 57, 0.95)" }}>
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-11 items-center justify-center px-6 rounded-xl bg-rose-600/10 text-xs font-black uppercase tracking-wider transition active:scale-95"
            style={{ color: "rgba(159, 18, 57, 0.95)" }}
          >
            {t("tapToRetry")}
          </button>
        )}
      </div>
    );
  }

  if (!victories || victories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 opacity-30">
          <CandyIcon name="trophy" className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium opacity-60 px-8 leading-relaxed">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Lead with a featured card for "My Victories", otherwise all compact for Hall of Fame
  const isPersonal = variant === "victory";
  const featured = isPersonal ? victories[0] : null;
  const history = isPersonal ? victories.slice(1) : victories;

  return (
    <div className="flex flex-col gap-4">
      {featured && (
        <div className="mb-2">
          <TrophyCard
            entry={featured}
            variant={variant}
            featured={true}
          />
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          {isPersonal && featured && (
            <h4 className="px-2 text-nano font-black uppercase tracking-[0.2em] opacity-40 mb-1">
              {t("historyHeading")}
            </h4>
          )}
          {history.map((v, i) => (
            <TrophyCard
              key={String(v.tokenId)}
              entry={v}
              variant={variant}
              rank={variant === "hall-of-fame" ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
