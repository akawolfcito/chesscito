"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";

import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { getLevelId } from "@/lib/contracts/scoreboard";

type BadgeStateCardProps = {
  piece: string;
};

export function BadgeStateCard({ piece }: BadgeStateCardProps) {
  const chainId = useChainId();
  const { address } = useAccount();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(piece), [piece]);

  const { data: claimed } = useReadContract({
    address: badgesAddress ?? undefined,
    abi: badgesAbi,
    functionName: "hasClaimedBadge",
    args: address && levelId > 0n ? [address, levelId] : undefined,
    chainId,
    query: {
      enabled: Boolean(address && badgesAddress && levelId > 0n),
    },
  });

  return (
    <div className="rounded-2xl bg-slate-100 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Badge</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{claimed ? "Claimed" : "Pending"}</p>
    </div>
  );
}
