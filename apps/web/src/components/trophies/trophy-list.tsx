import { TrophyCard } from "./trophy-card";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

function SkeletonCards() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-xl border border-white/[0.08] bg-[var(--skeleton-bg)]"
        />
      ))}
      <p className="pt-1 text-center text-xs text-slate-500">
        {TROPHY_VITRINE_COPY.loadingText}
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
  if (loading) return <SkeletonCards />;

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
        <p className="text-sm text-rose-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-rose-300 underline"
          >
            {TROPHY_VITRINE_COPY.tapToRetry}
          </button>
        )}
      </div>
    );
  }

  if (!victories || victories.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {victories.map((v, i) => (
        <TrophyCard
          key={String(v.tokenId)}
          entry={v}
          variant={variant}
          rank={variant === "hall-of-fame" ? i + 1 : undefined}
        />
      ))}
    </div>
  );
}
