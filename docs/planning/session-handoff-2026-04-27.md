# Session handoff — 2026-04-27

## State at close

- Branch: `main`, all admin/CELO commits pushed (`c85b1b9..aabf08b`).
- Production: deployed (`aabf08b`). Smoke verified — leaderboard 200,
  sign-victory 200, coach/credits 200, telemetry 204.
- On-chain state confirmed for the CELO Founder Badge route:
  - itemId=5 → `priceUsd6=1000000 ($1.00), enabled=true`
  - acceptedTokens(CELO) → `decimals=18`
- Working tree: pitch-video work in progress (uncommitted, owned by
  user, not touched in this session).

## What landed today

Frontend / monetization:
- `322d12d` native CELO payment route for the Founder Badge — UI gates
  the "Buy with 1 CELO" button on `!isMiniPay && itemId 5 configured +
  enabled + CELO whitelisted`.

Admin tooling — new `apps/admin` package:
- `925b457` bootstrap CLI + read-only `shop get-item`.
- `f0ec438` pin every dependency exact across the workspace (no `^`
  or `~`) for supply-chain hardening.
- `d8c8914` first cut of shop write commands using cast subprocess.
- `d0acf8a` self-contained signing — drop foundry dep entirely, sign
  with viem in-process, encrypt key locally with scrypt + AES-256-GCM
  at `apps/admin/.private/admin-key.enc` (gitignored).
- `aabf08b` fix `setAcceptedToken` signature — contract takes
  `(address, uint8 decimals)`, not `(address, bool)`. Added
  `remove-accepted-token` for the blacklist case.

Admin txs sent today (mainnet, owner `0x917497...`):
- Tx 1 — `setItem(5, 1000000, true)` →
  `0x29f1b43035f7ae93f60f8761b3008093645797dc46c6f39421c4fc1a00ffe863`
- Tx 2 — `setAcceptedToken(CELO, 18)` →
  `0xb9afdf18c575318f3e09d6f89cd44f1d0f16295e550c7ceeee0eb8f87bf6c536`

Both via the admin CLI we built today, end-to-end (simulate → confirm
→ sign with viem → wait receipt → audit log).

## Pending operational items (user-side)

- Browser smoke of the CELO route end-to-end:
  open chesscito.vercel.app in a non-MiniPay browser with ≥1 CELO in
  wallet → Shop sheet → Founder Badge card → "Buy with 1 CELO"
  button must render. Tap → approve → buyItem → success overlay.
- Pitch video sprint (in progress, owned by user):
  - `apps/video/src/Root.tsx` modified (registers two new compositions)
  - new `ChesscitoPitch.tsx` + `ChesscitoPitchCaregiver.tsx`
  - `docs/superpowers/specs/2026-04-27-pitch-video-script.md`
  - `docs/reviews/pitch-redteam-2026-04-27.md`
  - `apps/web/src/lib/content/editorial.ts` founders block updated to
    real names + new pedagogical metric (referenced from the spec
    above)
  Suggested commit split when ready: docs(pitch) → feat(video) →
  style(landing). Land independently of this session's work.

## Deferred (explicitly not opened this session)

- D.2 verified_games Supabase table (forensic trail for Mint Victory).
- `useMiniPayTransaction` shared hook + `TransactionStatus` component.
- victory + scoreboard write commands in the admin CLI (only shop
  ships in v1).
- Shared `packages/contracts-config` extraction (TODO once
  `apps/admin/src/config.ts` and `apps/web/src/lib/contracts/chains.ts`
  duplication starts to bite).
- Awaiting-signature visual chip for F2/F3/F4/F5 (next batch of
  MiniPay UX Fluidity sprint).

## Conventions added this session (memory)

- `feedback_exact_version_pins.md` — every package.json dep pins
  exact version, no `^` or `~`. Already enforced across the
  workspace; future bumps are deliberate review-and-merge.
- `feedback_execution_initiative.md` — for idempotent commands I
  have what I need to run, propose to execute or just execute, then
  report. Reserve "user-side only" for sensitive / out-of-reach
  steps.

## Next session

Default re-entry assumes the user comes back with browser-test
feedback on the CELO route + pitch video iterations. If neither is
the focus, two sprints remain on deck:

1. MiniPay Transaction UX Fluidity — next batch from
   `docs/superpowers/specs/2026-04-26-minipay-transaction-ux-fluidity.md`
   (awaiting-signature visual is the next high-impact item).
2. Admin CLI commit 5+ — victory + scoreboard write commands when an
   admin op for those surfaces becomes necessary.
