# MiniPay Shop Payment Findings (2026-03-05)

## Context

We evaluated whether MiniPay fee-currency support could remove ERC-20 approval for Shop purchases.

## What we tested

1. Standard Shop checkout (USDC ERC-20):
   - `approve(shop, amount)`
   - `buyItem(itemId, quantity)`
2. Native CELO proof-of-concept checkout (temporary POC, later removed):
   - single payable tx path.

## Outcome

- For ERC-20 purchases, approval is still required.
- MiniPay fee-currency only affects **gas payment**, not token transfer authorization.
- Wallet prompts like `unknown contract` / `unknown transaction` are wallet-side UX and cannot be customized by app code.

## Decision

- Keep Shop checkout on ERC-20 path (`approve + buyItem`) as primary flow.
- Keep frontend with one-click chained UX (app triggers approve then buy), even though wallet still requests two signatures when allowance is missing.
- Remove native CELO POC code to avoid divergence from production architecture.

## Operational notes

- If allowance is enough, only `buyItem` is needed.
- To reduce repeated approvals, use a larger approval amount policy (with explicit risk acknowledgement).
- Do not commit secrets:
  - never commit `.env` files
  - never commit private keys or tokens
  - do not commit `private/` artifacts.

