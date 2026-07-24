# Privy × Celo — Phase 0 Harness

Isolated, throwaway harness that empirically validates **Privy embedded EVM
wallets on Celo testnet** for Chesscito. It exists only to close the Phase 0
gate in `docs/validations/2026-07-23-privy-celo-phase-0.md`.

## Isolation contract (enforced by tests)

- Lives in `tools/privy-celo-harness/`, **outside** `apps/web/`.
- **Not** part of the pnpm workspace (`pnpm-workspace.yaml` globs `apps/*` only),
  so it has its own `package.json` and installs independently.
- **Never** imports productive Chesscito code (`apps/web`, `@/` alias) — checked
  by `src/__tests__/guards.test.ts`.
- **Never** reads `PRIVY_APP_SECRET`; the only env var is `VITE_PRIVY_APP_ID`
  (public, client-side) — checked by the same guard test.
- **Never** sends on Celo **mainnet**: every send path calls
  `assertTestnetForSend()`, which throws on chain `42220`.

It does not touch `WalletProvider`, root providers, the MiniPay branch, payments,
entitlements, Season Pass, PRO, Peones, Welcome Pack, rewards, migrations, or
production.

## Stack

React + TypeScript · Vite · `@privy-io/react-auth` · `@privy-io/wagmi` · `wagmi`
· `viem` · `@tanstack/react-query` · Vitest + Testing Library.

Chains are the first-class `celo` / `celoSepolia` objects from `wagmi/chains` —
the same ones the productive app uses (`celoSepolia` = testnet send target).

## Run

```bash
cd tools/privy-celo-harness
cp .env.example .env.local          # then set VITE_PRIVY_APP_ID=<your dev App ID>
npm install                          # or pnpm install --ignore-workspace
npm run dev                          # open the printed localhost URL
```

Scripts: `dev`, `build`, `typecheck`, `lint` (= typecheck; no eslint here), `test`.

> The App ID is a public client-side identifier — safe in `.env.local` and the
> browser bundle. The **App Secret is never used** by this harness.

## Manual validation checklist

1. Put the dev App ID in `.env.local` (`VITE_PRIVY_APP_ID=`).
2. `npm install` (or `pnpm install --ignore-workspace`).
3. `npm run dev`.
4. Open the printed `localhost` URL.
5. Click **Login** → sign in with Google (or email).
6. Confirm an **address** appears and wallet type is `embedded (privy)`.
7. Click **Sign test message** → a signature appears, no error.
8. Click **Ensure Celo testnet** → connected chain ID == expected (`11142220`).
9. If balance is 0 / RPC needs gas, fund from the **faucet** (below).
10. Click **Send 0 CELO to self (testnet)** → a tx hash appears; receipt resolves.
11. Copy **address**, **signature**, and **tx hash** for the evidence doc.
12. **Logout**, then **Login** again with the same Google account → confirm the
    **same embedded wallet address**. If it changes, that is a **blocker** — stop.

## Faucet (testnet gas)

If the embedded wallet needs testnet CELO for gas, use the **official Celo
faucet** — https://faucet.celo.org — and select the Celo Sepolia network. Do
**not** automate faucet requests and never move mainnet funds. A 0-value
self-transfer needs only enough testnet CELO to cover gas.

## What this proves (and what it can't)

Green `test` + `typecheck` + `build` prove the harness compiles, the isolation
guards hold, and the state machine gates signing/sending correctly. The
**empirical** facts (real address, signature, tx hash, cross-session
persistence) can only be produced by a human running the checklist above with a
real App ID and browser login. Record those in the validation doc.
