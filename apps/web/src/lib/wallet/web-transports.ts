import { fallback, http } from "wagmi";
import { celo } from "wagmi/chains";

/**
 * Public Celo mainnet (42220) RPC endpoints for the web (Privy) branch.
 * No API key — every endpoint is anonymous. Confirmed against provider docs
 * on 2026-07-24, not from memory.
 *
 * Ordered by resilience. Forno is last on purpose: it is best-effort,
 * rate-limited, and the endpoint that returned `403` under burst in-browser
 * (validation §10.7) — the reason this branch needs a rotating transport at
 * all. Ankr was excluded: its Celo endpoint is documented with
 * `YOUR_ANKR_API_KEY`, so it is not a key-less public endpoint.
 */
export const CELO_WEB_RPC_URLS = [
  "https://celo.drpc.org",
  "https://public.1rpc.io/celo",
  "https://forno.celo.org",
] as const;

/**
 * Transports for the web (Privy) branch — Celo mainnet only.
 *
 * The web branch reads the chain through wagmi (`useBalance`,
 * `useWaitForTransactionReceipt`), which hit OUR transport. `fallback()`
 * rotates to the next endpoint when one errors (e.g. Forno 403), so those
 * reads never strand. MiniPay never touches this: it injects its own RPC and
 * keeps its bare `http()` config byte-identical.
 *
 * `rank: false` keeps the declared order — resilient providers first, Forno
 * last — instead of latency-ranking on every request.
 */
export function createWebTransports() {
  return {
    [celo.id]: fallback(
      CELO_WEB_RPC_URLS.map((url) =>
        http(url, {
          timeout: 10_000,
          retryCount: 1,
        }),
      ),
      { rank: false },
    ),
  } as const;
}
