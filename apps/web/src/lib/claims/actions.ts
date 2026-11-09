import type { Claim } from "@/lib/claims/queue";

export type PerformClaimResult =
  | { ok: true; txHash: `0x${string}` }
  | { ok: false; error: Error };

/** Dispatch a claim to its respective on-chain flow. The actual write
 *  paths already exist (badges, scoreboard, victory mint) — this is a
 *  router so <PendingClaims> doesn't need to know the kinds. Wire each
 *  branch to the existing flow during integration (Task 4.2). */
export async function performClaim(claim: Claim): Promise<PerformClaimResult> {
  switch (claim.kind) {
    case "badge":
      throw new Error("performClaim badge: wire to existing badge.claim flow in Task 4.2");
    case "score":
      throw new Error("performClaim score: wire to existing scoreboard.save flow in Task 4.2");
    case "victory-nft":
      throw new Error("performClaim victory-nft: route to /victory/{txHash} mint flow in Task 4.2");
  }
}
