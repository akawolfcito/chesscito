"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDisconnect } from "wagmi";

/**
 * How the active wallet branch ends a session.
 *
 * The injected branch has nothing to end beyond the wagmi connection, so it
 * supplies no session and callers fall back to `useDisconnect()` — byte-for-byte
 * the behavior that shipped before Privy existed, which is also what the whole
 * app gets with `NEXT_PUBLIC_PRIVY_ENABLED=false`.
 *
 * The Privy branch does have more to end. Dropping only the wagmi connector
 * would leave the Privy session alive — and with HttpOnly cookies on
 * `.chesscito.com`, the cookie too — so the next render would walk the user
 * straight back in, and the sibling subdomain would never notice. That branch
 * supplies the real `logout()` (see `web-wallet-provider.tsx`).
 */
export type WalletSession = {
  signOut: () => void;
};

const WalletSessionContext = createContext<WalletSession | null>(null);

export function WalletSessionProvider({
  signOut,
  children,
}: WalletSession & { children: ReactNode }) {
  const value = useMemo(() => ({ signOut }), [signOut]);
  return (
    <WalletSessionContext.Provider value={value}>{children}</WalletSessionContext.Provider>
  );
}

/**
 * The one way a surface ends the session, whichever branch is mounted.
 *
 * `useDisconnect()` is called unconditionally — both branches mount a
 * `WagmiProvider`, and a hook cannot be called conditionally anyway. It is only
 * *used* when no branch claimed the session.
 */
export function useWalletSignOut(): () => void {
  const { disconnect } = useDisconnect();
  const session = useContext(WalletSessionContext);

  return useMemo(
    () => session?.signOut ?? (() => disconnect()),
    [session, disconnect],
  );
}
