"use client";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PendingClaims } from "@/components/profile/pending-claims";
import { GeneralStats } from "@/components/profile/general-stats";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { useClaimQueue } from "@/hooks/use-claim-queue";
import { useDisplayName } from "@/hooks/use-display-name";
import { computeTier } from "@/lib/profile/compute-tier";
import { truncateWallet } from "@/lib/profile/display-name";
import { PROFILE_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ProfileSheet({ open, onOpenChange }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { name, setName } = useDisplayName(address);
  const { stats, refetch } = useProfileStats(address);
  const { claims, inFlight, claimOne, refresh } = useClaimQueue(address);

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
        className="profile-sheet mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{PROFILE_COPY.pageTitle}</SheetTitle>
          <SheetDescription>Profile and claims</SheetDescription>
        </SheetHeader>

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
