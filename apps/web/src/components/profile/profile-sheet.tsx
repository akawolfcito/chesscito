"use client";
import { useCallback, useState } from "react";
import { useAccount, useChainId, useDisconnect, useWriteContract } from "wagmi";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PendingClaims } from "@/components/profile/pending-claims";
import { GeneralStats } from "@/components/profile/general-stats";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { useClaimQueue, type PerformClaimFn } from "@/hooks/use-claim-queue";
import { useDisplayName } from "@/hooks/use-display-name";
import { computeTier } from "@/lib/profile/compute-tier";
import { truncateWallet } from "@/lib/profile/display-name";
import { PROFILE_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";
import { badgesAbi } from "@/lib/contracts/badges";
import { scoreboardAbi } from "@/lib/contracts/scoreboard";
import {
  getBadgesAddress,
  getScoreboardAddress,
  getMiniPayFeeCurrency,
} from "@/lib/contracts/chains";
import type { Claim } from "@/lib/claims/queue";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ProfileSheet({ open, onOpenChange }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { name, setName } = useDisplayName(address);
  const { stats, refetch } = useProfileStats(address);

  const performClaim = useCallback<PerformClaimFn>(
    async (claim: Claim) => {
      if (!address) {
        return { ok: false as const, error: new Error("Connect wallet to claim") };
      }
      try {
        if (claim.kind === "badge") {
          const badgesAddress = getBadgesAddress(chainId);
          if (!badgesAddress) {
            return {
              ok: false as const,
              error: new Error("Badges contract not configured for this chain"),
            };
          }
          const signRes = await fetch("/api/sign-badge", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ player: address, levelId: Number(claim.badgeId) }),
          });
          const signed = (await signRes.json()) as {
            nonce: number;
            deadline: number;
            signature: `0x${string}`;
            error?: string;
          };
          if (!signRes.ok || signed.error) {
            return {
              ok: false as const,
              error: new Error(signed.error ?? "sign-badge failed"),
            };
          }
          const feeCurrency = getMiniPayFeeCurrency(chainId);
          const baseRequest = {
            address: badgesAddress,
            abi: badgesAbi,
            functionName: "claimBadgeSigned" as const,
            args: [
              claim.badgeId,
              BigInt(signed.nonce),
              BigInt(signed.deadline),
              signed.signature,
            ] as const,
            chainId,
            account: address,
          };
          try {
            const feeManaged = feeCurrency
              ? ({ ...baseRequest, feeCurrency } as unknown as typeof baseRequest)
              : baseRequest;
            const txHash = await writeContractAsync(feeManaged);
            return { ok: true as const, txHash };
          } catch (innerErr) {
            if (!feeCurrency) throw innerErr;
            const txHash = await writeContractAsync(baseRequest);
            return { ok: true as const, txHash };
          }
        }

        if (claim.kind === "score") {
          const scoreboardAddress = getScoreboardAddress(chainId);
          if (!scoreboardAddress) {
            return {
              ok: false as const,
              error: new Error("Scoreboard contract not configured for this chain"),
            };
          }
          // claim.scoreKey is format "{piece}-l{level}" (e.g. "rook-l3"). Sign
          // endpoint requires levelId + score + timeMs. v1 stores only points
          // in localStorage; infer levelId from the scoreKey suffix and use
          // timeMs=0 (server allows it).
          const levelMatch = claim.scoreKey.match(/-l(\d+)$/);
          const levelId = levelMatch ? Number(levelMatch[1]) : 0;
          const signRes = await fetch("/api/sign-score", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              player: address,
              levelId,
              score: claim.points,
              timeMs: 0,
            }),
          });
          const signed = (await signRes.json()) as {
            nonce: number;
            deadline: number;
            signature: `0x${string}`;
            error?: string;
          };
          if (!signRes.ok || signed.error) {
            return {
              ok: false as const,
              error: new Error(signed.error ?? "sign-score failed"),
            };
          }
          const feeCurrency = getMiniPayFeeCurrency(chainId);
          const baseRequest = {
            address: scoreboardAddress,
            abi: scoreboardAbi,
            functionName: "submitScoreSigned" as const,
            args: [
              BigInt(levelId),
              BigInt(claim.points),
              0n,
              BigInt(signed.nonce),
              BigInt(signed.deadline),
              signed.signature,
            ] as const,
            chainId,
            account: address,
          };
          try {
            const feeManaged = feeCurrency
              ? ({ ...baseRequest, feeCurrency } as unknown as typeof baseRequest)
              : baseRequest;
            const txHash = await writeContractAsync(feeManaged);
            return { ok: true as const, txHash };
          } catch (innerErr) {
            if (!feeCurrency) throw innerErr;
            const txHash = await writeContractAsync(baseRequest);
            return { ok: true as const, txHash };
          }
        }

        // victory-nft → route to /arena (existing resume flow handles retry)
        if (typeof window !== "undefined") {
          window.location.assign("/arena");
        }
        return {
          ok: false as const,
          error: new Error("Routed to arena for victory mint"),
        };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
    [address, chainId, writeContractAsync],
  );

  const { claims, inFlight, claimOne, refresh } = useClaimQueue(address, {
    performClaim,
  });

  const [editing, setEditing] = useState(false);

  const tier = computeTier({
    address,
    puzzlesSolved: stats?.puzzlesSolved ?? 0,
    piecesMastered: 0,
    arenaWins: stats?.arenaWins ?? 0,
    daysStreak: stats?.dailyStreak ?? 0,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          track("profile_opened");
          refetch();
          refresh();
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        hideClose
        className="profile-sheet mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        {/* Canonical header strip. Was Pattern C (sr-only header, banner
         *  served as visual title) — now a real Z2 strip sits above the
         *  banner so the close affordance lives where the user expects
         *  it across every sheet. */}
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            title={PROFILE_COPY.pageTitle}
            close={{ onClick: () => onOpenChange(false), label: "Close profile" }}
          />
        </div>

        <ProfileBanner
          displayName={name}
          tierTitle={tier.title}
          tierKey={tier.tier}
          xp={tier.xp}
          truncatedWallet={truncateWallet(address)}
          onEditName={() => setEditing(true)}
        />

        <DisplayNameDialog
          open={editing}
          initialValue={name === "Visitor" ? "" : name}
          onSave={(v) => {
            setName(v);
            setEditing(false);
            track("profile_name_edited");
          }}
          onCancel={() => setEditing(false)}
        />

        <PendingClaims
          claims={claims}
          inFlight={inFlight}
          onClaim={(c) => {
            track("claim_attempted", { kind: c.kind });
            void claimOne(c);
          }}
          onRefresh={() => {
            track("profile_refresh_tapped");
            refresh();
          }}
        />

        <GeneralStats
          piecesMastered={0}
          piecesTotal={6}
          dailyStreak={stats?.dailyStreak ?? 0}
          puzzlesSolved={stats?.puzzlesSolved ?? 0}
          arenaWins={stats?.arenaWins ?? 0}
          trophies={stats?.trophies ?? 0}
          nftsMinted={stats?.nftsMinted ?? 0}
        />

        <div className="profile-utility-row">
          <div className="profile-utility-card">
            <span>{PROFILE_COPY.walletLabel}</span>
            <span>{truncateWallet(address)}</span>
          </div>
          <div className="profile-utility-card">
            <span>{PROFILE_COPY.networkLabel}</span>
            <span>Celo</span>
          </div>
        </div>

        {isConnected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="profile-disconnect-link"
          >
            {PROFILE_COPY.disconnect}
          </button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
