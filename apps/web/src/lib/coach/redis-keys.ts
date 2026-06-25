export const REDIS_KEYS = {
  game: (wallet: string, gameId: string) => `coach:game:${wallet}:${gameId}`,
  gameList: (wallet: string) => `coach:games:${wallet}`,
  job: (jobId: string) => `coach:job:${jobId}`,
  jobByGame: (wallet: string, gameId: string) => `coach:job-ref:${wallet}:${gameId}`,
  /** Per-locale analysis cache. As of 2026-05-24, the cache key includes
   *  the locale segment so EN and ES analyses for the same `(wallet,
   *  gameId)` coexist instead of overwriting. Records written before
   *  that change live at the legacy key below — readers consult both
   *  in order via `getCachedAnalysisWithFallback()`. */
  analysis: (
    wallet: string,
    gameId: string,
    locale: "en" | "es",
  ) => `coach:analysis:${wallet}:${gameId}:${locale}`,
  /** Legacy locale-agnostic cache key. Still served on read for any
   *  record that predates the per-locale migration; writes always go
   *  to the new keyed form. Treat as "EN-by-convention" because the
   *  pre-migration default prompt was English. */
  analysisLegacy: (wallet: string, gameId: string) =>
    `coach:analysis:${wallet}:${gameId}`,
  analysisList: (wallet: string) => `coach:analyses:${wallet}`,
  credits: (wallet: string) => `coach:credits:${wallet}`,
  pendingJob: (wallet: string) => `coach:pending:${wallet}`,
  /** Chesscito PRO active pass — value is `expiresAt` in ms since
   *  epoch. TTL is derived from `expiresAt - now` so the key auto-purges
   *  the moment PRO lapses. Written by /api/verify-pro via an atomic
   *  Lua script that extends from `max(now, currentExpiresAt)`. */
  pro: (wallet: string) => `coach:pro:${wallet}`,
  /** Per-tx dedupe for PRO purchases. Mirrors `coach:processed-tx:` for
   *  Coach packs but lives in its own namespace so a Coach pack tx can
   *  never short-circuit a PRO verify (and vice versa). */
  proProcessedTx: (txHash: string) => `coach:pro:processed-tx:${txHash}`,
  /** PR 3 backfill claim lock — short-lived (60s). NX-set at the start
   *  of the one-shot Redis→Supabase backfill so concurrent /analyze
   *  requests for the same wallet don't double-write rows or both serve
   *  augmentation-less prompts. Spec §7 / red-team P0-5. */
  backfillClaim: (wallet: string) => `coach:backfill-claim:${wallet}`,
  /** PR 4 delete-by-self nonce — 5-minute TTL (set with `nx, ex=300`).
   *  Replays within the freshness window collide on this SETNX. The
   *  client generates the 32-hex nonce; the server simply claims it.
   *  Spec §8.2 / red-team P0-1. */
  deleteNonce: (nonce: string) => `coach:delete-nonce:${nonce}`,
  /** Per-wallet monotonic shield-credit counter (0..∞). No TTL —
   *  shields are durable. Crediting INCRs by `matches *
   *  SHIELDS_PER_PURCHASE`; client tracks spends locally. Cap is
   *  UI-only. Written by /api/credit-shield, read by
   *  /api/shields/me. Spec 2026-05-08-credit-shield-server-side §
   *  "Counter model". */
  shieldsCredited: (wallet: string) => `coach:shields:credited:${wallet}`,
  /** Per-tx dedupe for shield credits. SETNX inside Lua atomically
   *  with the credit INCR. 90-day TTL — long enough to outlive any
   *  reasonable client retry, short enough to keep the namespace
   *  bounded. */
  shieldProcessedTx: (txHash: string) =>
    `coach:shields:processed-tx:${txHash}`,
  /** Lite Season Pass active flag (TTL = pass duration in ms). Value is
   *  the ISO string of `expires_at`. Set at purchase; auto-expires so
   *  status checks fall back to Supabase after the Redis key purges. */
  seasonPass: (wallet: string) => `lite:season-pass:${wallet.toLowerCase()}`,
} as const;
