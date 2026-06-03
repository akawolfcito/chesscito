# Copy Sweep Extended — Audit Closing P1-8

**Date:** 2026-06-03
**Mode:** read-only audit. No code modified.
**Scope:** scan user-facing copy in `apps/web/src/components/**` and `apps/web/src/app/[locale]/**` for MiniPay-banned terms and decide whether a code patch is needed to close P1-8 (per the readiness checklist).
**Outcome:** **closed by audit, no patch required.**

---

## TL;DR

The previous copy sweeps (MEMORY: `MiniPay safety rule activa`, `promise-first-copy`, `anti-ai-prose-ceiling`) already swept `lib/content/`, the single source of truth for all user-facing strings. This extended audit confirms that **components and pages contain zero new user-facing copy that breaches MiniPay UI copy rules** (`minipay-requirements.md` §3). The only mentions of `wallet`, `transaction`, `blockchain`, `0x` that remain are technical identifiers (i18n keys, icon names, types, variables, tests, comments) or live inside Terms of Service / Privacy Policy where technical precision is required for compliance.

P1-8 (copy sweep extended) is therefore **closed by audit** with no code change.

---

## 1. Terms searched

| Term | Why | Policy |
|---|---|---|
| `gas` | MiniPay banned (`§3`) | replace with `network fee` |
| `onramp` | MiniPay banned | replace with `deposit` / `add funds` |
| `offramp` | MiniPay banned | replace with `withdraw` |
| `crypto` | MiniPay banned | replace with `stablecoin` / `digital dollar` |
| `wallet address` | MiniPay banned as primary identifier | replace with phone / alias |
| `wallet` (broader) | Acceptable as action verb (Connect Wallet) but flagged for inspection | review per context |
| `0x` | Banned when used as primary user identifier in copy | inspect each occurrence |
| `transaction hash` / `tx hash` | Acceptable as technical term in receipts; flagged for context | leave when secondary |
| `blockchain` | Acceptable in educational / legal context; banned in onboarding sales copy | inspect per context |
| `transaction` | Not explicitly banned; checked for cosmetic replacement opportunities | informational |

---

## 2. Paths audited

- `apps/web/src/components/**` (≈ 86 components import `useTranslations`; copy resolves from `editorial.ts`).
- `apps/web/src/app/[locale]/about/`, `apps/web/src/app/[locale]/why/`, `apps/web/src/app/[locale]/support/`, `apps/web/src/app/[locale]/terms/`, `apps/web/src/app/[locale]/privacy/` (static pages — consume `ABOUT_COPY`, `LEGAL_COPY`, etc. from `editorial.ts`).
- `apps/web/src/components/landing/landing-page.tsx` (entry surface).
- Cross-check in `apps/web/src/lib/content/editorial.ts` for the actual translation values referenced by component i18n keys.

---

## 3. Hit inventory

### 3.1 User-facing copy hits (in components / pages)

**Zero.** No JSX text, button label, alert, or inline string in `components/**` or `app/[locale]/**` contains a banned term as user copy.

### 3.2 Technical identifiers (ignored per scope)

Per user instruction: "No reemplazar términos técnicos en variables, tipos, nombres de archivos o tests salvo que sean user-facing strings."

| Pattern | Example | Count | Decision |
|---|---|---|---|
| i18n keys | `t("ctaConnectWallet")`, `t("walletLabel")` | ~10 | Keep — keys are stable identifiers; values resolve from `editorial.ts` |
| Icon names | `icon="wallet"`, `name="wallet"` | ~6 | Keep — drawable identifier |
| Type unions | `\| "wallet"` in icon enum | ~3 | Keep |
| Action enum | `action="connectWallet"` (action-pin) | ~4 | Keep |
| Format spec / dev errors | `formatWalletShort`, `\`walletShort should be \`0xABCD…1234\` shape\`` (dev-time invariant) | ~3 | Keep — never visible to end users |
| Test names + fixtures | `it("returns null when no wallet address (not connected)")`, `walletShort: "0x1234567890"` | ~8 | Keep — test scaffolding |
| Comments / JSDocs | `// tx hashes are intentionally left alone — ...`, `/** Truncated 0x address ... */` | ~6 | Keep |
| Import paths | `import { ... } from "@/lib/contracts/transaction-helpers"` | ~2 | Keep |

### 3.3 Legal copy hits (justified by context)

Per project rule and user instruction: "legal/terms/privacy que pueden quedar si el contexto lo justifica."

`editorial.ts` `LEGAL_COPY` (Terms + Privacy) contains 8 spans mentioning `blockchain`, `wallet`, `wallet address`, `NFT`, `transactions`:

| Line | Context | Why kept |
|---|---|---|
| 1609 | Terms — service description: `"educational pre-chess game experience on the Celo blockchain, accessible via MiniPay"` | Compliance accuracy. |
| 1621 | Terms — On-Chain Transactions clause: `"smart contracts on the Celo blockchain. These transactions are irreversible..."` | Compliance — irreversibility statement requires precise terms. |
| 1629 | Terms — Third-Party Infrastructure: `"third-party infrastructure, wallets, and blockchain networks..."` | Compliance — liability disclaimer. |
| 1637 | Terms — Limitation of Liability: `"...not liable for losses arising from blockchain transactions, wallet issues..."` | Compliance — explicit excluded causes. |
| 1647 | Privacy — Data collected: `"your public wallet address... visible on the Celo blockchain..."` | Privacy disclosure requires identifying the actual data. |
| 1655 | Privacy — Storage: `"...blockchain data are public by nature and may be transmitted through wallet and network infrastructure..."` | Same as above. |
| 1659 | Privacy — Third-party providers: `"...Celo RPC providers for blockchain reads and writes, and WalletConnect for wallet connection..."` | Required by privacy convention — name the processors. |
| 1667 | Privacy — Retention: `"On-chain data is permanent by nature of blockchain..."` | Right-to-erasure exception requires this fact. |

**All eight are inside `LEGAL_COPY.terms.sections[*].body` or `LEGAL_COPY.privacy.sections[*].body` — never surfaced outside `/terms` or `/privacy`.** A non-technical user touring the gameplay surfaces (`/`, `/hub`, `/exercises`, `/arena`, sheets) never sees them.

A separate **open TODO from the 2026-06-02 narrative audit** flagged "Terms legal review (`accessible via MiniPay`)" for legal-counsel sign-off — outside the scope of this copy sweep.

### 3.4 `Connect Wallet` action labels — gated by MiniPay runtime

`editorial.ts` carries 7 spans with `"Connect Wallet"` / `"Connect wallet to ..."` / `"Wallet"` (lines 49, 773, 774, 1334, 1864, 2059, 2767). These are the labels for the **wallet connect action** — not for displaying an address.

The labels never surface inside MiniPay because:

1. `apps/web/src/components/connect-button.tsx:16-22` — when `isMiniPay === true`, the component renders `CONNECT_BUTTON_COPY.miniPayDetected` (`"MiniPay detected"` / `"MiniPay conectado"`) instead of the RainbowKit Connect button.
2. `apps/web/src/components/wallet-provider.tsx:60` — auto-connects on mount inside MiniPay, so no manual "Connect Wallet" tap is needed.
3. `apps/web/src/components/landing/landing-page.tsx:90` — server-side wallet UA detection redirects MiniPay traffic to `/hub` without rendering the landing's wallet CTAs.

Outside MiniPay (desktop / regular mobile web), `"Connect Wallet"` is the industry-standard label and is the correct term for the action a user is taking. Replacing it with MiniPay-specific phrasing would be misleading for non-MiniPay users.

### 3.5 `transaction` in user-facing copy

`editorial.ts` uses `"transaction"` in 9 spans (lines 157, 166, 199, 205, 529, 539, 713, 718, 1725). `minipay-requirements.md` §3 does not list `transaction` as a banned term. It is intelligible to a non-technical user, and replacing every instance with `"payment"` would introduce inconsistency for surfaces where the transaction is not a payment (badge claim, score submit — signed transactions, not purchases).

Recommendation: **keep `transaction`**. If MiniPay reviewers flag this during submission, a follow-up commit can swap on the specific user-paid surfaces (mint, shop, coach), but no preemptive change is warranted.

### 3.6 `costGasOnly: "Network fee only"`

The i18n key is named `costGasOnly` (technical key). The **value** is `"Network fee only"` — MiniPay-correct. Users only see the value. The key name does not surface anywhere. Keep both.

---

## 4. Why no code patch

| Question | Answer |
|---|---|
| Were any banned terms found in user-facing copy in `components/**`? | No. |
| Were any banned terms found in user-facing copy in `app/[locale]/**` pages outside legal/terms/privacy? | No. |
| Were any banned terms found in `editorial.ts` for non-legal surfaces? | No — `gas`, `onramp`, `offramp`, `crypto`, `wallet address` (as primary id), `blockchain` (outside legal) are all zero. |
| Does `transaction` violate MiniPay rules? | No — not in the banned list. |
| Does `"Connect Wallet"` violate MiniPay rules inside MiniPay? | No — runtime-gated to non-MiniPay users only. |
| Should LEGAL_COPY be rewritten to remove `blockchain` / `wallet`? | No — compliance copy requires technical precision. Separate "Terms legal review" TODO already tracked from 2026-06-02 narrative audit. |

**The previous sweeps closed the surface. The current state is clean. Touching code would either be a no-op or a regression.**

---

## 5. Audit trail for MiniPay submission

If a MiniPay reviewer asks "did you sweep your component-level copy for banned terms?" the answer is:

> Yes. The full sweep ran on 2026-06-03 (`docs/reviews/2026-06-03-copy-sweep-extended-audit.md`). Zero hits in user-facing copy across `components/**` and `app/[locale]/**`. All wallet-related identifier copy is gated behind `useMiniPay()` so MiniPay traffic never sees the desktop "Connect Wallet" label. Legal copy retains technical precision per ToS/Privacy convention.

---

## 6. Closure

| Item | Status |
|---|---|
| P1-8 (Copy sweep extended) | **CLOSED by audit, no patch required** |
| Follow-up: Terms legal review for "accessible via MiniPay" wording | Open (from 2026-06-02 narrative audit) |
| Recommendation if surveys arise: swap `"transaction"` → `"payment"` only on paid surfaces (mint/shop/coach) if MiniPay reviewer asks | Conditional follow-up |

---

## Appendix — Search commands run

```bash
# Components — JSX user-facing strings with banned terms
grep -rn -E ">\s*[A-Z]?gas\b|\"[^\"]*\bgas\b[^\"]*\"" apps/web/src/components --include="*.tsx"
grep -rn -i -E "onramp|offramp" apps/web/src/components --include="*.tsx" --include="*.ts"
grep -rn -E "\bcrypto\b" apps/web/src/components --include="*.tsx" --include="*.ts"
grep -rn -i "wallet address" apps/web/src/components --include="*.tsx" --include="*.ts"
grep -rn -i "blockchain" apps/web/src/components --include="*.tsx"
grep -rn -i -E "(transaction hash|tx hash)" apps/web/src/components --include="*.tsx"

# editorial.ts — translation values
grep -nE "\bgas\b|\bcrypto\b|\bblockchain\b|onramp|offramp" apps/web/src/lib/content/editorial.ts

# Pages (about / why / support / terms / privacy)
grep -rn -E "\bgas\b|\bcrypto\b|\bblockchain\b|wallet address|onramp|offramp" \
  apps/web/src/app/[locale]/about \
  apps/web/src/app/[locale]/why \
  apps/web/src/app/[locale]/support \
  apps/web/src/app/[locale]/terms \
  apps/web/src/app/[locale]/privacy
```

All commands re-runnable from repo root.
