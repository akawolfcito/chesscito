# Identity, Wallet And Transaction Funnel Audit

Date: 2026-07-18  
Scope: visitors, guest sessions, social login, wallet, MiniPay, web, payments, mints, proofs and interrupted transaction intents. No implementation changes were made.

## 1. Current State

Chesscito currently separates "guest local identity" from "wallet-connected identity", but it does not implement a persistent account layer or social login. Account identity is effectively wallet-first for backend entitlements and on-chain actions, while Learn progress, Focus Passport, Daily Session quota and many UX flags live in browser storage.

MiniPay is detected by an injected provider flag and auto-connected once. Web users without an injected wallet can still play, but transactional CTAs either no-op at connect time or show unavailable copy with no recovery action. There is no durable pending transaction intent for Season Pass checkout, badge claim, proof save or other transactional moments.

## 2. Flow Diagrams

### MiniPay

```text
Open app
  -> WalletProvider checks isMiniPayEnv + injected provider
  -> connect({ connector: injected })
  -> useAccount exposes address
  -> LEARN hydrates local progress + wallet entitlements
  -> transactional CTA opens sheet
  -> writeContractAsync sends tx through MiniPay
  -> waitForReceipt
  -> backend verify / grant
  -> UI success or error
```

Critical weakness: if tx is broadcast and the app reloads before backend verification, no pending intent is restored.

### Web With Wallet

```text
Open app
  -> no auto-connect unless MiniPay
  -> user taps Connect
  -> injected connector prompt
  -> address available
  -> payment/mint/proof CTA can call writeContractAsync
  -> backend verify or on-chain receipt path
```

Critical weakness: only injected wallet is offered. No WalletConnect modal, no social login, no embedded wallet.

### Web Without Wallet

```text
Open app
  -> user plays as guest
  -> user taps transactional CTA
  -> Connect chip calls useConnectWallet
  -> no injected connector => return with no UI state
  -> SeasonPassSheet shows "Connect your wallet on Celo to purchase" but no action
```

Critical weakness: the user can generate intent but gets no clear instruction to install/open a wallet or use MiniPay.

### Guest

```text
Open app
  -> getOrCreateGuestId writes chesscito_guest_id
  -> local avatar/name derive from guest seed
  -> Daily Focus and exercises write localStorage
  -> transactional value requires wallet
```

Critical weakness: guest progress is not bound to backend and can be lost across devices/storage loss.

### Signed-In Without Wallet

```text
No implemented social/login account state found
  -> behaves like guest
  -> no server identity for progress restore
  -> no account-wallet association
```

## 3. Matrix: Account × Wallet × Channel

| Account state | Wallet state | Channel | Actual behavior | Transaction result |
|---|---|---|---|---|
| Visitor/guest | No wallet | Web | Can play; guest ID local | Connect may no-op; purchase unavailable |
| Visitor/guest | Injected wallet available, disconnected | Web | Can play; Connect chip shown | User must connect; then tx possible on Celo |
| Visitor/guest | Connected wallet | Web | Wallet becomes backend identity | Payments/mints/proofs possible if chain/config valid |
| Visitor/guest | MiniPay provider | MiniPay | Auto-connect attempted once | Native-feeling tx if connected and funded |
| Local profile name | No wallet | Any | Guest avatar/name only | No backend entitlement |
| Local profile name | Wallet connected | Any | Derived public ID from wallet; custom display name local | Backend rows keyed by wallet |
| Social account | Any | Any | Not implemented | Not available |
| PRO holder | Wallet connected | Any | Effective Training Pass source `pro` | Direct Season Pass rejected |
| Direct Season Pass holder | Same wallet | Any | Active Season Pass until expiry | +3 Shields direct purchase |
| Direct Season Pass holder | Different device, same wallet | Any | Entitlement restores; Passport/progress may not | Focus Passport not restored |

## 4. Transactional CTAs

| CTA | Surface | Requires wallet | Requires tx | Current behavior by state |
|---|---|---:|---:|---|
| Connect | Hub HUD / contextual toast | No | No | Calls injected connector; silent no-op if absent (`use-connect-wallet.ts:24-31`). |
| Join Challenge | Challenge card | Eventually yes | Yes | Opens sheet if inactive; unavailable if no wallet/wrong chain/config (`learn-hub-client.tsx:428-434`; `season-pass-sheet.tsx:181-188`). |
| Get Pass | SeasonPassSheet | Yes | Yes | Direct ERC20 transfer, receipt wait, backend verify (`use-season-pass-rail.ts:162-217`). |
| Deposit in MiniPay | Insufficient funds | MiniPay only | External/deeplink | Renders only in MiniPay (`add-cash-cta.tsx:32-54`). |
| Claim Badge | UnlockOverlay / BadgeSheet | Yes | Yes | Fetch signed payload, write `claimBadgeSigned`, confirm receipt (`exercises-screen.tsx:1853-1935`). |
| Save proof / on-chain score | MissionPanel contextual action | Yes | Yes | Optional proof path; details outside Challenge (`exercises-screen.tsx:3248-3258`, `3319-3433`). |
| Use Shield | Failure rescue | Yes for server spend | No chain tx | Calls `/api/shields/spend`; may use Peones fallback branch (`exercises-screen.tsx:1740-1833`). |
| Claim Welcome Package | Welcome modal/rescue | Yes | Signature/API, not chain tx | `personal_sign`-style claim flow via hook and API; modal has signing/error states (`welcome-package-modal.tsx:83-137`). |
| Get Peones / PRO | Shop/account surfaces | Yes | Yes | Stablecoin rail or legacy shop depending surface; PRO excluded from Lite account rows (`account-sheet.tsx:224-261`). |

## 5. What Happens In Each State

No wallet:

- Daily Focus, Focus Passport and training progress work locally.
- Season Pass status hook returns inactive/loading false without fetch (`use-season-pass-status.ts:29-32`).
- Connect action can silently do nothing if there is no injected provider.
- Payment sheet cannot proceed.

Connected wallet:

- Season Pass/PRO status is fetched by wallet.
- Backend rewards and entitlements key by lowercased wallet.
- Badge and proof actions can request wallet signatures/transactions.

Wrong chain:

- Season Pass rail is unavailable unless chain ID is 42220 (`use-season-pass-rail.ts:77-79`).
- Some exercise actions can show switch network via contextual action (`exercises-screen.tsx:3391-3393`, `3431-3432`).

MiniPay:

- Auto-connect is attempted once (`wallet-provider.tsx:39-56`).
- Add Cash deep link appears for insufficient funds (`add-cash-cta.tsx:40-54`).
- Account sheet hides disconnect/copy because wallet is not interchangeable (`account-sheet.tsx:85-90`, `382-392`).

PRO:

- `resolveEffectiveTrainingPass` returns `source=pro` over `season_pass` (`effective-training-pass.ts:38-40`).
- Direct Season Pass verification rejects active PRO wallet with `included_with_pro` (`verify-payment/route.ts:158-164`).

## 6. Silent Failures

- `useConnectWallet` returns silently when no injected connector exists (`use-connect-wallet.ts:24-31`).
- LocalStorage failures for guest ID fall back to ephemeral identity without user notice (`guest-id.ts:37-47`).
- Daily progress storage failure keeps in-memory completion only for the current session (`daily/progress.ts:87-95`).
- Season Pass status fetch failure demotes to inactive false/loading false (`use-season-pass-status.ts:38-57`), which can hide an entitlement during transient failures.
- Payment tx hash is React state only (`use-season-pass-rail.ts:69-72`); reload loses verification context.
- Shield network failure resets board with limited explanatory UI (`exercises-screen.tsx:1823-1830`).
- PRO status preserves last-known on client, but first-load failure remains null (`use-pro-status.ts:16-29`, `48-70`).

## 7. Abandonment Points

1. Web user taps Connect with no provider and nothing visible happens.
2. Guest taps Join Challenge and sees "Connect your wallet on Celo to purchase" but no embedded next step.
3. User lacks funds outside MiniPay; no Add Cash equivalent appears.
4. User cancels signature; CTA remains but copy does not clearly say no charge happened.
5. User broadcasts tx then reloads/closes before verification; no pending intent resumes.
6. User changes device; paid entitlement restores by wallet, but Passport/progress do not.
7. Active PRO user wants +3 Shields; direct Season Pass is rejected because PRO includes access.

## 8. Technical Risks

- Identity duplication: same human on two devices has two local progress histories unless wallet-bound backend progress is implemented.
- Entitlement/progress mismatch: wallet restores Season Pass but not Focus Passport, creating inconsistent "active Challenge, zero focus days" states.
- Transaction recovery gap: no intent state keyed by tx hash, SKU, wallet, chain.
- Account ambiguity: editable display name is local, while public identity derives from wallet.
- Connect abstraction is too thin for web without wallet.
- Season Pass status endpoint requires Supabase fallback for direct pass when Redis TTL key is missing; errors may return inactive-like responses.

## 9. Pending Transaction Intent Proposal

Implement a client-side pending intent store before starting any transactional action:

```ts
type PendingTxIntent = {
  id: string;
  kind: "season_pass" | "pro" | "get_peones" | "badge_claim" | "score_proof" | "welcome_pack";
  wallet: `0x${string}`;
  chainId: number;
  sku?: string;
  token?: `0x${string}`;
  txHash?: `0x${string}`;
  createdAt: string;
  phase: "prepared" | "awaiting_signature" | "broadcast" | "verifying" | "failed" | "complete";
  resumeUrl: string;
};
```

Minimum P0 behavior:

- Create intent at CTA click with `prepared`.
- Update to `awaiting_signature` before wallet prompt.
- If `writeContractAsync` returns tx hash, persist `broadcast`.
- On app boot and sheet open, scan pending intents for current wallet and call the matching verify route.
- Mark complete only after backend/receipt success.
- Show recovery UI: "We found a pending purchase. Continue verifying."

For Season Pass specifically, store `sku=lite_season_pass_21`, token, chain ID, wallet and tx hash once known. Verification can reuse `/api/verify-payment`.

## 10. Social Login Recommendation

Do not block first play with social login. Add social login only if the product commits to server-backed Learn progress. Its job should be identity/progress continuity, not payment. Wallet remains the requirement for on-chain value.

Recommended model:

- Guest first.
- Optional "Save my progress" after first meaningful achievement.
- Social account can bind local progress to backend.
- Wallet can be linked later for payments/proofs.
- Explicit merge rules when social account and wallet both have progress.

## 11. Progressive Login Recommendation

Use progressive prompts at value moments:

- After first Focus Day: offer "Save progress" but do not block Welcome Gift.
- Before Join Challenge payment: require wallet, explain why.
- Before badge/proof: require wallet, explain on-chain value.
- On web without provider: show "Open in MiniPay" and "Use browser wallet" paths.

## 12. Open In MiniPay Recommendation

Add a web-only recovery CTA for transactional sheets:

- Detect `!isMiniPay && !hasProvider`.
- Show "Open in MiniPay" with a deep link if available, plus plain fallback copy.
- Keep the current MiniPay Add Cash CTA for insufficient funds in MiniPay.
- Avoid showing MiniPay-only deeplinks on desktop if they cannot resolve.

## 13. Recommendations

P0:

- Add pending transaction intent for Season Pass.
- Replace connect no-op with visible "No wallet found" recovery.
- Add web-without-wallet branch to SeasonPassSheet.
- Clarify direct pass vs PRO in payment copy and error mapping.

P1:

- Add account layer only for progress continuity, not as payment prerequisite.
- Add wallet association/merge model before server-backed Passport.
- Add transaction funnel events: intent_created, wallet_prompt_opened, user_rejected, tx_broadcast, verify_started, verify_succeeded, verify_failed, intent_resumed.

P2:

- Evaluate embedded wallet/social login after MiniPay funnel is reliable.
- Add cross-device Learn progress sync if Challenge habit becomes core paid value.
- Add explicit expired/completed Challenge state tied to wallet entitlement.

## 14. No Implementation Until Approval

This audit intentionally does not modify product code. Any changes to wallet recovery, pending intents, social login or MiniPay deep links should be implemented only after product approval because they alter monetization and identity behavior.

## 15. Files Inspected

- `apps/web/src/components/wallet-provider.tsx`
- `apps/web/src/lib/minipay.ts`
- `apps/web/src/lib/minipay/provider.ts`
- `apps/web/src/hooks/use-minipay.ts`
- `apps/web/src/hooks/use-splash-loader.ts`
- `apps/web/src/lib/wallet/use-connect-wallet.ts`
- `apps/web/src/lib/identity/guest-id.ts`
- `apps/web/src/lib/identity/identity-lite.ts`
- `apps/web/src/lib/identity/use-guest-identity.ts`
- `apps/web/src/components/account/account-sheet.tsx`
- `apps/web/src/components/profile/profile-sheet.tsx`
- `apps/web/src/lib/lite-progress-storage.ts`
- `apps/web/src/lib/daily/progress.ts`
- `apps/web/src/lib/season-pass/use-season-pass-status.ts`
- `apps/web/src/lib/season-pass/use-season-pass-rail.ts`
- `apps/web/src/components/payments/season-pass-sheet.tsx`
- `apps/web/src/app/api/season-pass/status/route.ts`
- `apps/web/src/app/api/verify-payment/route.ts`
- `apps/web/src/lib/entitlements/effective-training-pass.ts`
- `apps/web/src/lib/pro/is-active.ts`
- `apps/web/src/lib/pro/use-pro-status.ts`
- `apps/web/src/app/api/pro/status/route.ts`
- `apps/web/src/components/exercises/exercises-screen.tsx`
- `apps/web/src/components/minipay/add-cash-cta.tsx`

## 16. Evidence Index

- MiniPay detection: `apps/web/src/lib/minipay.ts:28-35`; `apps/web/src/hooks/use-minipay.ts:13-31`.
- Auto-connect: `apps/web/src/components/wallet-provider.tsx:39-56`.
- Thin connect/no-op: `apps/web/src/lib/wallet/use-connect-wallet.ts:21-32`.
- Guest identity: `apps/web/src/lib/identity/guest-id.ts:37-47`; `apps/web/src/lib/identity/use-guest-identity.ts:22-32`.
- Wallet-derived identity: `apps/web/src/lib/identity/identity-lite.ts:112-153`; `apps/web/src/components/account/account-sheet.tsx:91-98`.
- MiniPay account behavior: `apps/web/src/components/account/account-sheet.tsx:85-90`, `174-201`, `382-392`.
- Local progress keys: `apps/web/src/lib/lite-progress-storage.ts:18-39`.
- Daily local persistence: `apps/web/src/lib/daily/progress.ts:58-97`.
- Season Pass status no-wallet behavior: `apps/web/src/lib/season-pass/use-season-pass-status.ts:29-32`.
- Season Pass payment state: `apps/web/src/lib/season-pass/use-season-pass-rail.ts:69-79`, `162-217`.
- Season Pass sheet unavailable/insufficient/pay states: `apps/web/src/components/payments/season-pass-sheet.tsx:181-293`.
- Backend payment verification: `apps/web/src/app/api/verify-payment/route.ts:135-225`, `227-317`.
- PRO inclusion: `apps/web/src/lib/entitlements/effective-training-pass.ts:18-43`; `apps/web/src/app/api/season-pass/status/route.ts:35-52`.
- Add Cash MiniPay-only CTA: `apps/web/src/components/minipay/add-cash-cta.tsx:32-54`.
- Badge claim tx: `apps/web/src/components/exercises/exercises-screen.tsx:1853-1935`.
- Transactional contextual slots: `apps/web/src/components/exercises/exercises-screen.tsx:3319-3433`.
