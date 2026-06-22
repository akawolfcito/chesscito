# Session Handoff — 2026-06-22 (Lite B1.2 — Metrics / Grant Readiness)

## Completed esta sesión

### B1.2 — 8 commits atómicos, 4307/4307 tests, tsc clean

| Commit | Descripción |
|---|---|
| `17c9be9c` | claim gift telemetry module — 5 eventos, isLite:true, razones sanitizadas |
| `673af205` | wire claim gift emitters → useLiteWelcomeGiftClaim + hook tests |
| `eef7cbc2` | daily telemetry isLite dim + emitPassportSlotsUpdated |
| `1d7bf3ad` | hub-daily-tile — pass isLite + emitPassportSlotsUpdated on completion |
| `61d7db94` | lite_session_started — one-per-tab sessionStorage-deduped |
| `6899bcb8` | exercise_complete + exercise_fail gain isLite dim |
| `1482d96a` | labyrinth_complete event alongside modal_open, isLite dim |
| `a71ad18a` | /api/admin/lite-stats — ADMIN_TOKEN-gated, isLite filter, date range |

Eventos nuevos: `claim_gift_tap/signing/success/rejected/failed`, `lite_session_started`, `passport_slots_updated`, `labyrinth_complete`.
Dimensión `isLite` añadida a: `daily_tactic_started/completed`, `daily_streak_updated`, `exercise_complete`, `exercise_fail`.
Endpoint interno: `GET /api/admin/lite-stats?from=YYYY-MM-DD&to=YYYY-MM-DD` (ADMIN_TOKEN gated, filtra `props.isLite===true`).

## Prev — B1.1

- `f0406117` feat(lite-b1.1): On-chain Moments — Claim Gift reward reveal overlay + STREAK→COMBO rename (4267/4267)
  - New hook `useLiteWelcomeGiftClaim` (personal_sign via wagmi, idle→signing→success|error)
  - `WelcomePackageModal` rewritten with `phase: ClaimPhase` prop (4 states)
  - `WelcomePackageStamp` orchestrates signing from Trophies path
  - COMBO replaces STREAK in exercises/labyrinths pill
  - No prohibited copy (no on-chain/NFT/mint/proof/ledger/smart contract)

- `6fcee363` + `a5b33acb` fix(lite): B1.1 smoke fix — claim stuck loading
  - Root cause: `hub-daily-tile` + `daily-tactic-slot` used old modal API (boolean `claimed`, 1200ms auto-close, no phase). Now wired to `useLiteWelcomeGiftClaim`.
  - CTA copy: "Keep it" → "Claim", FirstFocusDayOverlay "Continue" → "Claim", successCta stays "Continue"
  - `onDismiss` guards: blocked during signing; success-dismiss acts as continue
  - `useSignMessage` mock added to hub-tile-availability + hub-scaffold-client tests

## Current State

- **Branch**: main (`a5b33acb`)
- **Build**: 4267/4267 passing, tsc clean
- **Uncommitted work**: none
- **Deployed**: last prod deploy = `eb0d2c79` (Lite v1, 2026-06-21); `a5b33acb` is 3 commits ahead on main, not yet deployed

## Next Tasks

1. **Deploy B1.1 to production** — push main → Vercel deploy, smoke `www.chesscito.com`:
   - FirstFocusDayOverlay CTA: "Claim" (not "Continue")
   - WelcomePackageModal idle CTA: "Claim" (not "Keep it")
   - MiniPay shows personal_sign prompt on tap
   - Success overlay "Welcome Gift Claimed" appears after confirm
   - Exercises/labyrinths pill: "COMBO" not "STREAK"
   - Reset tool: `/lite-debug/reset`

2. **Welcome Package spec TDD** — `docs/specs/welcome-package-lite.md` ready; start red tests

3. **Exercises Save Flow spec TDD** — `docs/specs/exercises-save-flow-simplification.md` ready; start red tests

4. **VR baseline refresh** — B1.1 changed WelcomePackageModal visuals; run `pnpm test:e2e:visual --update-snapshots` against clean server (`rm -rf .next` first)

## Blockers

- None. B1.1 feature-complete and test-green. Deploy is the next gate.

## Notes

- `hub-daily-tile` and `daily-tactic-slot` each get their own `useLiteWelcomeGiftClaim` instance — correct, both mount independently
- `claimed` boolean prop on `WelcomePackageModal` kept for legacy compat (renders claimedConfirmation text in idle); low-priority cleanup
- Smoke path: `preview.chesscito.com` (tracks main) or local `CHESSCITO_LITE_MODE=true pnpm dev`
- QA reset: `/lite-debug/reset` clears localStorage welcome-package + daily progress state
