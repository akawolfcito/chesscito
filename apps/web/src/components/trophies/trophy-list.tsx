import { TrophyCard } from "./trophy-card";
import type { VictoryEntry } from "@/lib/game/victory-events";

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-slate-600/50 bg-slate-800/60 backdrop-blur-sm"
        />
      ))}
    </div>
  );
}

type Props = {
  victories: VictoryEntry[] | undefined;
  loading: boolean;
  error?: string | null;
  emptyMessage: string;
  showPlayer?: boolean;
  showShare?: boolean;
  onRetry?: () => void;
};

export function TrophyList({
  victories,
  loading,
  error,
  emptyMessage,
  showPlayer,
  showShare,
  onRetry,
}: Props) {
  if (loading) return <SkeletonCards />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="text-sm text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-red-300 underline"
          >
            Tap to retry
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
    <div className="space-y-3">
      {victories.map((v) => (
        <TrophyCard
          key={String(v.tokenId)}
          entry={v}
          showPlayer={showPlayer}
          showShare={showShare}
        />
      ))}
    </div>
  );
}
