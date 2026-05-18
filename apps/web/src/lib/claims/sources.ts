import { readContract } from "wagmi/actions";

import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress, getConfiguredChainId } from "@/lib/contracts/chains";
import { wagmiConfig } from "@/components/wallet-provider";

/** Aggregates the raw inputs that computePendingClaims needs.
 *  Server/client agnostic — caller decides where to invoke. */
export async function readClaimSources(address: `0x${string}`) {
  const chainId = getConfiguredChainId();
  const badgesAddress = getBadgesAddress(chainId);

  // Local badges earned: persisted by the exercises flow when a piece arc
  // crosses the badge threshold; key shape is `chesscito:badge-earned:{id}`.
  const localBadgesEarned: bigint[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:badge-earned:")) continue;
      const idStr = key.replace("chesscito:badge-earned:", "");
      try {
        localBadgesEarned.push(BigInt(idStr));
      } catch {
        /* skip */
      }
    }
  }

  // On-chain badges: read hasClaimedBadge per locally-earned id so we can
  // suppress claims that the chain already records as completed.
  const badgesOnChain: bigint[] = [];
  if (badgesAddress) {
    for (const badgeId of localBadgesEarned) {
      try {
        const claimed = (await readContract(wagmiConfig, {
          abi: badgesAbi,
          address: badgesAddress,
          functionName: "hasClaimedBadge",
          args: [address, badgeId],
        })) as boolean;
        if (claimed) badgesOnChain.push(badgeId);
      } catch {
        /* tolerate failure → leave out; computePendingClaims will offer the claim */
      }
    }
  }

  // Local scores pending: keys `chesscito:score-pending:{key}` → JSON { points }.
  const localScoresPending: { scoreKey: string; points: number }[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:score-pending:")) continue;
      try {
        const value = window.localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value) as { points: number };
        localScoresPending.push({
          scoreKey: key.replace("chesscito:score-pending:", ""),
          points: parsed.points,
        });
      } catch {
        /* skip */
      }
    }
  }

  // Victory NFTs pending: localStorage keys `chesscito:victory-pending:{txHash}` → { difficulty, mintedAt }
  const victoryPending: { txHash: string; difficulty: number; mintedAt: number }[] = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("chesscito:victory-pending:")) continue;
      try {
        const value = window.localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value) as { difficulty: number; mintedAt: number };
        victoryPending.push({
          txHash: key.replace("chesscito:victory-pending:", ""),
          difficulty: parsed.difficulty,
          mintedAt: parsed.mintedAt,
        });
      } catch {
        /* skip */
      }
    }
  }

  return { localBadgesEarned, badgesOnChain, localScoresPending, victoryPending };
}
