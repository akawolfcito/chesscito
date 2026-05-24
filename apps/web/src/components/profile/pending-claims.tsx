"use client";
import { useTranslations } from "next-intl";
import type { Claim } from "@/lib/claims/queue";

type Props = {
  claims: Claim[];
  inFlight: Set<string>;
  onClaim: (claim: Claim) => void;
  onRefresh: () => void;
};

export function PendingClaims({ claims, inFlight, onClaim, onRefresh }: Props) {
  const t = useTranslations("PROFILE_COPY");
  const tClaim = useTranslations("CLAIM_COPY");

  function labelFor(claim: Claim): string {
    switch (claim.kind) {
      case "badge":
        return tClaim("kinds.badge", { name: `#${claim.badgeId.toString()}` });
      case "score":
        return tClaim("kinds.score", { points: claim.points });
      case "victory-nft":
        return tClaim("kinds.victoryNft", { difficulty: String(claim.difficulty) });
    }
  }

  function costFor(claim: Claim): string {
    return claim.costGasOnly
      ? tClaim("costGasOnly")
      : tClaim("costEstimateUsd", { amount: "0.02" });
  }

  if (claims.length === 0) return null;

  return (
    <section className="profile-pending-claims" aria-label={t("pendingClaimsHeader")}>
      <div className="profile-pending-claims-header">
        <h3>{t("pendingClaimsHeader")} ({claims.length})</h3>
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t("refreshAria")}
          className="profile-pending-claims-refresh"
        >
          ↻
        </button>
      </div>
      <ul className="profile-pending-claims-list">
        {claims.map((claim) => {
          const isInFlight = inFlight.has(claim.id);
          return (
            <li key={claim.id} className="profile-claim-row">
              <span className="profile-claim-label">{labelFor(claim)}</span>
              <span className="profile-claim-cost">{costFor(claim)}</span>
              {isInFlight ? (
                <span className="profile-claim-inflight">{tClaim("inFlightLabel")}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onClaim(claim)}
                  className="profile-claim-cta"
                >
                  {tClaim("claimVerb")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
