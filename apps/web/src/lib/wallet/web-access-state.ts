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

/** The SDK's "the user walked away from the flow" codes, read off Privy's own
 *  `PrivyErrorCode` union. `useLogin` can only produce `exited_auth_flow`; the
 *  siblings are listed so a future flow (link, update) cannot silently become
 *  an error screen either. */
const USER_DISMISSED_CODES: ReadonlySet<string> = new Set([
  "exited_auth_flow",
  "exited_link_flow",
  "exited_update_flow",
  "user_exited_set_password_flow",
]);

/**
 * True when Privy is reporting that the user closed the modal themselves.
 *
 * This is the difference between "we failed you" and "you changed your mind",
 * and the gate must not answer the second with an error screen. Anything that
 * is not a known dismissal code — including a missing or non-string code — is a
 * real failure: swallowing an unknown error would strand the player on a gate
 * whose CTA looks broken.
 */
export function isUserDismissedLogin(code: unknown): boolean {
  return typeof code === "string" && USER_DISMISSED_CODES.has(code);
}

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
