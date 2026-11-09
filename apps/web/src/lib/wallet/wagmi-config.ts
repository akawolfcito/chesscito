import { createConfig, http } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * The single wagmi config for the injected (MiniPay) branch.
 *
 * ⚠️ THIS FILE MUST STAY A LEAF (spec 2026-08-07-wallet-branch-lazy-load).
 * It exists so that code which needs a config object — `lib/claims/sources.ts`
 * calling `readContract`, the test providers — can get one WITHOUT importing
 * `components/wallet-provider`. That component pulls the whole injected branch
 * (providers, `ChainConfigWarning`, the product contexts) behind it, and a
 * single non-lazy import of it is enough to drag the branch back into the shared
 * chunk and undo the code split.
 *
 * So: no React, no components, no `"use client"` — nothing that would give this
 * module a reason to reach back up. The component imports this; never the
 * reverse, and there is deliberately NO re-export from it.
 *
 * `chains[0]` is celo on purpose: wagmi answers a DISCONNECTED visitor with the
 * first chain, which is what `ChainConfigWarning` compares against (CLAUDE.md).
 *
 * Plain `injected()` connector (id: "injected") — the only wallet this app ever
 * offered. RainbowKit was removed in the P2 JS cluster (2026-06-12): its modal
 * listed a single "Browser wallet" entry while its package put ~64KB gz into
 * every route's first load. Connect CTAs use `useConnectWallet()`
 * (src/lib/wallet/use-connect-wallet.ts).
 */
export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
  ssr: true,
});
