"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount, useChainId, useDisconnect, useWriteContract } from "wagmi";
import { Link } from "@/i18n/navigation";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PendingClaims } from "@/components/profile/pending-claims";
import { GeneralStats } from "@/components/profile/general-stats";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { useClaimQueue, type PerformClaimFn } from "@/hooks/use-claim-queue";
import { useDisplayName } from "@/hooks/use-display-name";
import { computeTier } from "@/lib/profile/compute-tier";
import { truncateWallet } from "@/lib/profile/display-name";
import { track } from "@/lib/telemetry";
import { badgesAbi } from "@/lib/contracts/badges";
import { scoreboardAbi } from "@/lib/contracts/scoreboard";
import {
  getBadgesAddress,
  getScoreboardAddress,
  getMiniPayFeeCurrency,
} from "@/lib/contracts/chains";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { ProSheet } from "@/components/pro/pro-sheet";
import type { Claim } from "@/lib/claims/queue";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** M1 funnel (Commit 6, 2026-06-02) — Account PRO row. Shows active
 *  pass with days remaining + renew CTA. Surfaces post-expire copy
 *  when the pass lapsed. Hidden entirely for users who never had PRO
 *  so the Account sheet doesn't morph into a Shop surface. */
type ProRowState =
  | { kind: "hidden" }
  | { kind: "active"; daysLeft: number; expiring: boolean }
  | { kind: "expired" };

function deriveProRowState(
  status: { active: boolean; expiresAt: number | null } | null,
  now: number,
): ProRowState {
  if (status == null) return { kind: "hidden" };
  if (status.active) {
    const days = daysRemaining(status.expiresAt, now);
    if (days == null) return { kind: "expired" };
    return { kind: "active", daysLeft: days, expiring: days <= 7 };
  }
  // Status returned active=false but carries an expiresAt — that's a
  // user who DID hold PRO at some point. Free-from-day-one users never
  // get a status payload that mentions expiresAt, so the row stays
  // hidden and Account does not look like a Shop entry.
  if (status.expiresAt != null) return { kind: "expired" };
  return { kind: "hidden" };
}

export function ProfileSheet({ open, onOpenChange }: Props) {
  const t = useTranslations("PROFILE_COPY");
  const tAbout = useTranslations("ABOUT_LINK_COPY");
  const tPro = useTranslations("PRO_COPY");
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { name, setName, isVisitor, variant } = useDisplayName(address);
  const tTier = useTranslations("TIER_LABELS");
  const { stats, refetch } = useProfileStats(address);
  // M1 funnel (Commit 6) — Profile-owned ProSheet instance. The Hub
  // also mounts its own ProSheet (via use-pro-sheet-state); here we
  // spin up a separate orchestration so a renew tap from the Account
  // row opens ProSheet ON TOP of the (closed) profile sheet without
  // depending on the Hub's tree.
  const proSheet = useProSheetState();
  const proStatus = proSheet.proStatus;
  const proRowState = deriveProRowState(proStatus, Date.now());
  // Fire pro_expired_view exactly once per (sheet open + expired
  // status). Reset when the sheet closes so a follow-up open ships
  // the event again as a distinct view intent.
  const expiredViewedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      expiredViewedRef.current = false;
      return;
    }
    if (proRowState.kind !== "expired" || expiredViewedRef.current) return;
    expiredViewedRef.current = true;
    track("monetization.pro_expired_view", {});
  }, [open, proRowState.kind]);
  const handleProRenewTap = useCallback(() => {
    const context =
      proRowState.kind === "expired"
        ? "expired_row"
        : proRowState.kind === "active" && proRowState.expiring
          ? "expiring_chip"
          : "account_row";
    track("monetization.pro_renew_tap", { context });
    onOpenChange(false);
    proSheet.openSheet();
  }, [onOpenChange, proRowState, proSheet]);

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
    <>
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
        title={t("pageTitle")}
        description={t("sheetDescription")}
        className="profile-sheet mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        {/* Canonical header strip. Was Pattern C (sr-only header, banner
         *  served as visual title) — now a real Z2 strip sits above the
         *  banner so the close affordance lives where the user expects
         *  it across every sheet. */}
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/new-icons-chesscito/avatar-blue" />}
            title={t("pageTitle")}
            close={{ onClick: () => onOpenChange(false), label: t("closeLabel") }}
          />
        </div>

        <ProfileBanner
          displayName={name}
          variant={variant}
          tierTitle={tTier(tier.tier)}
          tierKey={tier.tier}
          xp={tier.xp}
          truncatedWallet={truncateWallet(address)}
          onEditName={() => setEditing(true)}
        />

        <DisplayNameDialog
          open={editing}
          initialValue={isVisitor ? "" : name}
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

        {/* M1 funnel (Commit 6, 2026-06-02) — Account PRO row.
         *  - Hidden when the user has never held PRO.
         *  - Active: days left + renew CTA. CTA gains emphasis when
         *    expiring (≤ 7 days).
         *  - Expired: post-expire copy + renew CTA. */}
        {proRowState.kind !== "hidden" && (
          <section
            aria-label={tPro("label")}
            className="mt-3 rounded-2xl border px-3 py-3"
            style={{
              background: "rgba(255, 245, 215, 0.55)",
              borderColor:
                proRowState.kind === "active" && proRowState.expiring
                  ? "rgba(217, 119, 6, 0.55)"
                  : "rgba(110, 65, 15, 0.22)",
              boxShadow:
                proRowState.kind === "active" && proRowState.expiring
                  ? "inset 0 1px 0 rgba(255, 235, 175, 0.65)"
                  : "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            <p
              className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: "rgba(110, 65, 15, 0.78)" }}
            >
              {tPro("label")}
            </p>
            <p
              className="mt-1 text-sm font-extrabold leading-snug"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              {proRowState.kind === "active"
                ? tPro("daysLeftActiveLabel", { daysLeft: proRowState.daysLeft })
                : tPro("expiredLabel")}
            </p>
            <button
              type="button"
              onClick={handleProRenewTap}
              aria-label={tPro("renewTrainingCta")}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all active:scale-[0.98]"
              style={
                proRowState.kind === "expired" ||
                (proRowState.kind === "active" && proRowState.expiring)
                  ? {
                      background:
                        "linear-gradient(180deg, rgba(255, 235, 175, 0.95), rgba(232, 184, 84, 0.95))",
                      color: "rgba(63, 34, 8, 0.95)",
                      border: "1px solid rgba(180, 120, 35, 0.55)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.6)",
                      boxShadow:
                        "0 3px 0 rgba(135, 82, 13, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
                    }
                  : {
                      background: "rgba(255, 245, 215, 0.65)",
                      color: "rgba(110, 65, 15, 0.95)",
                      border: "1px solid rgba(110, 65, 15, 0.25)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                    }
              }
            >
              {proRowState.kind === "active" && !proRowState.expiring
                ? tPro("ctaRenew")
                : tPro("renewTrainingCta")}
            </button>
          </section>
        )}

        <div className="profile-utility-row">
          <div className="profile-utility-card">
            <span>{t("walletLabel")}</span>
            <span>{truncateWallet(address)}</span>
          </div>
          <div className="profile-utility-card">
            <span>{t("networkLabel")}</span>
            <span>{t("networkValue")}</span>
          </div>
        </div>

        {isConnected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="profile-disconnect-link"
          >
            {t("disconnect")}
          </button>
        ) : null}

        <div className="mt-4 flex justify-center">
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="text-nano opacity-60 transition-colors hover:opacity-100"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {tAbout("label")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>

    {/* M1 funnel (Commit 6) — Profile-owned ProSheet, rendered as a
     *  sibling so it survives the parent profile sheet closing.
     *  handleProRenewTap closes profile first then opens this. */}
    <ProSheet {...proSheet.sheetProps} />
    </>
  );
}
