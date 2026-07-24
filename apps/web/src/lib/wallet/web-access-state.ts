/** The access state of the web (Privy) branch, from the environment being ready
 *  through an authenticated session with a provisioned embedded wallet.
 *
 *  - `environment-loading` — Privy has not reported `ready` yet → render a shell.
 *  - `unauthenticated`     — hydrated web user with no session → `WebAccessGate`.
 *  - `authenticating`      — a login is in flight (native Privy modal).
 *  - `wallet-pending`      — authenticated, embedded wallet not provisioned yet.
 *  - `wallet-ready`        — authenticated AND wallet ready → render children.
 *  - `error`              — login/environment failure → retry + exits.
 *
 *  Productive children render ONLY in `wallet-ready`. Everything else is a gate,
 *  a shell, or an interstitial. MiniPay never reaches this reducer: the wallet
 *  branch resolver sends it to the `injected` tree (see `wallet-branch.ts`).
 */
export type WebAccessState =
  | "environment-loading"
  | "unauthenticated"
  | "authenticating"
  | "wallet-pending"
  | "wallet-ready"
  | "error";

export type WebAccessInput = {
  /** `usePrivy().ready` — the SDK has resolved the session. */
  ready: boolean;
  /** `usePrivy().authenticated` — a Privy session exists. */
  authenticated: boolean;
  /** The embedded wallet is provisioned and exposes an address. */
  walletReady: boolean;
  /** A `login()` call is in flight (native modal open / resolving). */
  authenticating: boolean;
  /** Login or environment failed. */
  error: boolean;
};

/**
 * Picks the web access state.
 *
 * Precedence is fixed and total: `error` wins over everything (a failure must
 * never be masked by a stale ready/authenticated flag), then the environment
 * must be `ready`, then a session must exist, then the wallet must be
 * provisioned. Children render only in the final `wallet-ready` state.
 */
export function deriveWebAccessState({
  ready,
  authenticated,
  walletReady,
  authenticating,
  error,
}: WebAccessInput): WebAccessState {
  if (error) {
    return "error";
  }

  if (!ready) {
    return "environment-loading";
  }

  if (!authenticated) {
    return authenticating ? "authenticating" : "unauthenticated";
  }

  if (!walletReady) {
    return "wallet-pending";
  }

  return "wallet-ready";
}
