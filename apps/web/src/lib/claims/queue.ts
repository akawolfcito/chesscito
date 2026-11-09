export type ClaimKind = "badge" | "score" | "victory-nft";

export type LocalScorePending = { scoreKey: string; points: number };
export type VictoryPending = { txHash: string; difficulty: number; mintedAt: number };

export type ClaimQueueState = {
  address: `0x${string}` | undefined;
  localBadgesEarned: bigint[];
  badgesOnChain: bigint[];
  localScoresPending: LocalScorePending[];
  victoryPending: VictoryPending[];
  optimisticRemoved: Set<string>;
};

export type Claim =
  | {
      id: string;
      kind: "badge";
      badgeId: bigint;
      costGasOnly: true;
    }
  | {
      id: string;
      kind: "score";
      scoreKey: string;
      points: number;
      costGasOnly: true;
    }
  | {
      id: string;
      kind: "victory-nft";
      txHash: string;
      difficulty: number;
      costGasOnly: false;
    };

const VICTORY_WINDOW_SEC = 24 * 60 * 60;

export function computePendingClaims(state: ClaimQueueState): Claim[] {
  if (!state.address) return [];

  const claims: Claim[] = [];
  const onChainSet = new Set(state.badgesOnChain.map((b) => b.toString()));

  for (const badgeId of state.localBadgesEarned) {
    const id = `badge-${badgeId.toString()}`;
    if (onChainSet.has(badgeId.toString())) continue; // chain dominates
    if (state.optimisticRemoved.has(id)) continue;
    claims.push({ id, kind: "badge", badgeId, costGasOnly: true });
  }

  for (const score of state.localScoresPending) {
    const id = `score-${score.scoreKey}`;
    if (state.optimisticRemoved.has(id)) continue;
    claims.push({
      id,
      kind: "score",
      scoreKey: score.scoreKey,
      points: score.points,
      costGasOnly: true,
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  for (const victory of state.victoryPending) {
    const id = `victory-${victory.txHash}`;
    if (state.optimisticRemoved.has(id)) continue;
    if (nowSec - victory.mintedAt > VICTORY_WINDOW_SEC) continue; // 24h window
    claims.push({
      id,
      kind: "victory-nft",
      txHash: victory.txHash,
      difficulty: victory.difficulty,
      costGasOnly: false,
    });
  }

  return claims;
}
