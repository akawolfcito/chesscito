"use client";
import type { Claim } from "@/lib/claims/queue";
import { CLAIM_COPY, PROFILE_COPY } from "@/lib/content/editorial";

type Props = {
  claims: Claim[];
  inFlight: Set<string>;
  onClaim: (claim: Claim) => void;
  onRefresh: () => void;
};

function labelFor(claim: Claim): string {
  switch (claim.kind) {
    case "badge":
      return CLAIM_COPY.kinds.badge.replace("{name}", `#${claim.badgeId.toString()}`);
    case "score":
      return CLAIM_COPY.kinds.score
        .replace("{points}", String(claim.points));
    case "victory-nft":
      return CLAIM_COPY.kinds.victoryNft.replace("{difficulty}", String(claim.difficulty));
  }
}

function costFor(claim: Claim): string {
  return claim.costGasOnly ? CLAIM_COPY.costGasOnly : CLAIM_COPY.costEstimateUsd.replace("{amount}", "0.02");
}

export function PendingClaims({ claims, inFlight, onClaim, onRefresh }: Props) {
  if (claims.length === 0) return null;

  return (
    <section className="profile-pending-claims" aria-label={PROFILE_COPY.pendingClaimsHeader}>
      <div className="profile-pending-claims-header">
        <h3>{PROFILE_COPY.pendingClaimsHeader} ({claims.length})</h3>
        <button
          type="button"
          onClick={onRefresh}
          aria-label={PROFILE_COPY.refreshAria}
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
                <span className="profile-claim-inflight">{CLAIM_COPY.inFlightLabel}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onClaim(claim)}
                  className="profile-claim-cta"
                >
                  {CLAIM_COPY.claimVerb}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
