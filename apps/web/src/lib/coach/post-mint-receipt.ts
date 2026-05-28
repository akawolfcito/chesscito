import { track } from "@/lib/telemetry";

export type PostMintReceiptArgs = {
  gameId: string;
  walletAddress: `0x${string}`;
  tokenId: string;
  claimTxHash: `0x${string}`;
  shareCardUrl: string;
  shareLinkUrl: string;
  surface: "arena_endgame" | "coach_viewer";
};

/**
 * Persists the mint outcome onto the gameRecord. Fire-and-forget
 * from the consumer's mint-success effect. Telemetry surfaces both
 * the success and failure paths via coach_viewer_mint_receipt_write.
 *
 * Returns a void promise so the consumer can `await` if desired,
 * but the recommended pattern is `void postMintReceipt({...})` —
 * the hot-path CTA mutation is driven by in-memory mint state, not
 * by this network round-trip. The persist is for COLD load only.
 */
export async function postMintReceipt(args: PostMintReceiptArgs): Promise<void> {
  try {
    const res = await fetch(`/api/games/${encodeURIComponent(args.gameId)}/mint-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: args.walletAddress,
        tokenId: args.tokenId,
        claimTxHash: args.claimTxHash,
        shareCardUrl: args.shareCardUrl,
        shareLinkUrl: args.shareLinkUrl,
      }),
    });
    track("coach_viewer_mint_receipt_write", {
      gameId: args.gameId,
      outcome: res.ok ? "ok" : "fail",
      status_code: res.status,
      surface: args.surface,
    });
  } catch {
    track("coach_viewer_mint_receipt_write", {
      gameId: args.gameId,
      outcome: "fail",
      status_code: 0,
      surface: args.surface,
    });
  }
}
