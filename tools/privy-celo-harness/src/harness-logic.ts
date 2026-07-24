import { MAINNET_CHAIN_ID, SEND_CHAIN_ID } from "./chains";

/** Exact message the manual validation signs. Kept as a constant so the test
 *  and the UI cannot drift apart. */
export const TEST_MESSAGE = "Chesscito Privy × Celo validation — 2026-07-23";

export type ConfigResult =
  | { ok: true; appId: string }
  | { ok: false; error: string };

/** Resolves the Privy App ID from env. The App ID is a PUBLIC client-side
 *  identifier. The App Secret is never read here. */
export function resolveAppId(raw: string | undefined): ConfigResult {
  const appId = (raw ?? "").trim();
  if (!appId) {
    return {
      ok: false,
      error:
        "Missing VITE_PRIVY_APP_ID. Copy .env.example to .env.local and set your Privy App ID.",
    };
  }
  return { ok: true, appId };
}

/** Masks the App ID for on-screen display / doc evidence. Never render the
 *  full value. */
export function maskAppId(appId: string): string {
  if (appId.length <= 8) return "•".repeat(appId.length);
  return `${appId.slice(0, 4)}…${appId.slice(-4)}`;
}

export type WalletPhase =
  | "config-error" // no App ID
  | "initializing" // Privy SDK not ready yet
  | "unauthenticated" // ready, but no user logged in
  | "wallet-loading" // authenticated, embedded wallet not yet available
  | "wallet-ready"; // embedded wallet address available

export type WalletInputs = {
  hasAppId: boolean;
  ready: boolean;
  authenticated: boolean;
  address: string | null;
};

export function resolveWalletPhase(i: WalletInputs): WalletPhase {
  if (!i.hasAppId) return "config-error";
  if (!i.ready) return "initializing";
  if (!i.authenticated) return "unauthenticated";
  if (!i.address) return "wallet-loading";
  return "wallet-ready";
}

/** Signing/sending are only ever enabled once a real embedded wallet address
 *  exists. This is what keeps the "unauthenticated → no active buttons"
 *  guarantee honest. */
export function canSign(phase: WalletPhase): boolean {
  return phase === "wallet-ready";
}

export function canSend(phase: WalletPhase): boolean {
  return phase === "wallet-ready";
}

/**
 * Hard guard: this harness must NEVER broadcast a transaction on Celo mainnet.
 * Any send path calls this first. Throws on mainnet or any non-testnet chain.
 */
export function assertTestnetForSend(chainId: number): void {
  if (chainId === MAINNET_CHAIN_ID) {
    throw new Error(
      `Refusing to send on Celo mainnet (${MAINNET_CHAIN_ID}). Harness sends only on testnet ${SEND_CHAIN_ID}.`,
    );
  }
  if (chainId !== SEND_CHAIN_ID) {
    throw new Error(
      `Unexpected send chain ${chainId}; expected Celo testnet ${SEND_CHAIN_ID}.`,
    );
  }
}

export function truncateHex(value: string | null, lead = 10, tail = 8): string {
  if (!value) return "—";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
