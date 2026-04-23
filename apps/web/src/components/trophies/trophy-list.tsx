import { TrophyCard } from "./trophy-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

function SkeletonCards() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-xl border border-[rgba(255,255,255,0.45)] bg-white/15"
        />
      ))}
      <p className="pt-1 text-center text-xs" style={{ color: "var(--paper-text-muted)" }}>
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
      <div
        className="rounded-xl border p-4 text-center"
        style={{
          borderColor: "rgba(190, 18, 60, 0.35)",
          background: "rgba(254, 226, 226, 0.55)",
        }}
      >
        <p className="text-sm" style={{ color: "rgba(159, 18, 57, 0.95)" }}>
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-[44px] items-center justify-center px-3 text-xs font-bold underline hover:opacity-80"
            style={{ color: "rgba(159, 18, 57, 0.95)" }}
          >
            {TROPHY_VITRINE_COPY.tapToRetry}
          </button>
        )}
      </div>
    );
  }

  if (!victories || victories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CandyIcon name="trophy" className="h-10 w-10 opacity-40" />
        <p className="text-sm" style={{ color: "var(--paper-text-muted)" }}>{emptyMessage}</p>
      </div>
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
