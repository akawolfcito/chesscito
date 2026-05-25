# Account Chip + Local-First Progress Plan

**Date**: 2026-05-25
**Owner**: Wolfcito
**Scope**: /exercises chip (PRO → Account) + persistent across wallet states + local-first progress prompt
**Status**: pending approval

## Problem (from field feedback)

1. The chip top-right of /exercises says "PRO" but its `onClick` opens `AccountSheet` (wallet + network + PRO + locale + disconnect). It's mislabeled — "PRO" is one *section inside* the sheet, not the function of the button.
2. When the wallet is disconnected, the chip is **gated to a spacer** (`exercises-screen.tsx:1661 → address && !proLoading`). The on-ramp into the connect flow vanishes precisely where new users land.
3. With no wallet, on-chain features (save score, badges, victory NFTs, PRO purchase) don't apply, but the user can still play. Today we don't prompt them to connect at meaningful moments, so a returning player without wallet has no obvious path to "promote" their local progress on-chain.

## Current ground truth (verified)

- Chip definition: `apps/web/src/components/exercises/exercises-screen.tsx:1660-1678`
  - Component: `<HudResourceChip tone="pro" value="PRO" imageIconSrc="/art/screen-mission/corona-pro.png" />`
  - Click handler: `onClick={() => setAccountSheetOpen(true)}` — opens `AccountSheet`, not `ProSheet`.
  - Gate: `address && !proLoading` else invisible spacer.
- `AccountSheet` (inline component at `exercises-screen.tsx:155-310` approx) renders: wallet short + copy, network pill, PRO status pill, "Manage/View PRO" CTA (this is what opens `ProSheet`), locale switcher, disconnect.
- Local progress already lives in localStorage:
  - `chesscito:progress:{piece}` (stars per piece)
  - `chesscito:save:{piece}` (pending on-chain save state machine)
  - `chesscito:onboarded`, `chesscito:welcome-dismissed`, `chesscito:daily-progress`
  - `chesscito:badge-earned:{id}`, `chesscito:score-pending:{key}`, `chesscito:victory-pending:{txHash}` (pending claim sources)
- Connect entry point: `openConnectModal?.()` already wired in scope (line 1834 in `ProSheet` props).

## Design — Phase 1: Account chip (always visible, label by state)

Keep the same chip slot/size in all three states (no layout shift). Swap label + icon + action:

| State | Visible label | Icon overlay | onClick | aria-label key |
|---|---|---|---|---|
| Disconnected | `Connect` | wallet/plug icon (no corona) | `openConnectModal?.()` | `accountConnectAriaLabel` |
| Connected, no PRO | `Account` (or wallet short `0x12…ab`) | wallet icon | `setAccountSheetOpen(true)` | `accountManageAriaLabel` |
| Connected + PRO | `Account` + small crown accent | wallet + corona-pro overlay | `setAccountSheetOpen(true)` | `accountManageProAriaLabel` |

**Why "Account", not "Wallet"**: AccountSheet contains more than wallet (locale, PRO, network). "Account" is the broadest term that still fits all three states. Spanish: `Cuenta`.

**Why keep the corona accent in PRO state**: PRO recognition memory (`project_hud_chip_family.md` / `project_pro_recognition_pattern.md`) emphasizes consistent visual recognition. The corona becomes an *accent* (badge overlay) rather than the chip's identity — PRO users still recognize their status at a glance, non-PRO users see a less loaded chip.

### Implementation steps (Phase 1)

Atomic commits, one per logical change. Run `pnpm test` before each commit; pin test count in the commit body.

1. **`feat(editorial): add ACCOUNT_CHIP_COPY keys`** — `apps/web/src/lib/content/editorial.ts` + i18n EN/ES message files. Keys: `connectLabel`, `accountLabel`, `connectAriaLabel`, `manageAriaLabel`, `manageProAriaLabel`. No UI change yet, just contract.
2. **`feat(exercises): persistent account chip with state swap`** — `exercises-screen.tsx:1660-1678` replace the `address && !proLoading` ternary with a 3-state render. Wire `openConnectModal` to the disconnected case. Add unit tests covering all 3 states + click handlers fire correctly.
3. **`style(exercises): account chip visual states`** — `globals.css` — if needed, add a `--state="connect"` variant (lighter, less ornate) and adjust the `tone="pro"` corona to overlay-position when in account state. Snapshot VR on `/exercises` (minipay viewport).
4. **`refactor(exercises): rename HudResourceChip props to match new identity`** — Optional cleanup: if `tone="pro"` is now misleading, add `tone="account"` variant; keep `tone="pro"` working until callsites migrate. Skip if `tone` is just visual sugar and doesn't constrain behavior.
5. **`test(exercises): VR baseline refresh for chip states`** — VR Session #3 (per memory's "VR baseline discipline" hard rule). Capture chip in 3 states on minipay viewport. Document in `deferred-work.md` if desktop baseline deferred.

## Design — Phase 2: Local-first progress prompt

Surface a non-blocking *"Connect to save your progress on-chain"* nudge at meaningful milestones, without blocking gameplay.

### Trigger milestones (one-shot per milestone, per browser)

- First time user reaches ★★★ on any piece without being connected.
- First arena victory without being connected.
- First time user opens the badge sheet (or claims tab) with claimables, without being connected.

### Mechanism

- New localStorage flag family: `chesscito:connect-prompt-shown:{milestone}` (values: `1`).
- Surface: non-blocking toast/banner with two CTAs:
  - **Primary**: `Connect to save` → fires `openConnectModal?.()`
  - **Secondary (dismiss)**: `Maybe later` → sets the localStorage flag, hides.
- On dismiss the flag is set so the same milestone never re-nags. Other milestones still fire.
- On successful connect AFTER a prompt was shown, optionally fire a one-time "Your local progress is now saved on-chain" success toast (only if there's actually local pending data per `chesscito:save:*` / `chesscito:score-pending:*`).

### Implementation steps (Phase 2)

1. **`feat(editorial): add CONNECT_PROMPT_COPY keys`** — primary CTA, dismiss CTA, milestone-specific subline copies.
2. **`feat(hooks): useConnectPrompt(milestone) hook`** — returns `{ shouldShow, dismiss, fire }`. Reads/writes the localStorage flag. Unit tests covering: not-shown initially, shows once, dismissed → no longer shows, connected → never shows.
3. **`feat(exercises): wire connect prompt at ★★★ milestone`** — Trigger when stars cross the threshold in `useExerciseProgress` while `!isConnected`.
4. **`feat(arena): wire connect prompt on victory`** — Trigger in `arena-end-state.tsx` on win + `!isConnected`.
5. **`feat(badges): wire connect prompt at badge sheet`** — On open of `BadgeSheet` while `!isConnected`.

## Non-goals (explicit)

- No new on-chain primitives. No migration of localStorage to a different shape. Existing `chesscito:*` keys keep their shapes.
- No change to `ProSheet` itself — only the surface that opens `AccountSheet`.
- No change to wallet-required flows (Shop, mint, PRO purchase). They keep their current "Connect first" guards.
- No change to /play-hub PRO badge (uses different component `HubProBadge`, different surface, different context). Out of scope.

## Risk + open questions

- **R1**: Renaming "PRO" → "Account" may confuse PRO subscribers who learned the corona icon = their status. Mitigation: keep corona as overlay in PRO state. Tradeoff: chip is slightly busier in PRO state.
- **R2**: VR baselines on `/exercises` will need a refresh (3 chip states × 2 viewports = 6 snapshots minimum). Per `feedback_vr_baseline_discipline.md` this MUST happen in the same PR with diff rationale.
- **R3**: The connect prompt could feel naggy if milestones cluster (e.g., user hits ★★★ + victory in one session). Mitigation: one-shot-per-milestone flag, and consider a global cooldown (e.g., max 1 prompt per session) as a follow-up.
- **Q1**: Should the disconnected chip show the wallet icon or a different "sign-in" icon (e.g., key)? UX call — recommend wallet for recognition with MiniPay context where wallet is always the answer.
- **Q2**: Should Phase 2 fire on the *first* milestone always, or only after the user has shown engagement (e.g., 2+ stars across pieces)? Recommend first-milestone-fires-once; engagement gating adds state we don't have today.

## Test impact estimate

- Unit: +6-10 tests (chip 3-state render + onClick + connect prompt hook + 3 milestone wiring tests).
- VR: 3 baseline refreshes minimum on `/exercises` minipay; +3 if desktop is in scope (likely defer).
- Baseline before: 1884/1884 passing (per memory HEAD `00da8b77`).
- Baseline target after Phase 1: 1890-1894 passing.
- Baseline target after Phase 2: 1900-1908 passing.

## Sequencing recommendation

Ship Phase 1 first (closes the immediate UX bug + on-ramp gap). Phase 2 is a follow-up — Phase 1 alone already lets a disconnected user *find* the connect entry. Phase 2 adds the *contextual nudge* on top.

## Approval checklist

- [ ] User confirms naming: "Account" (EN) / "Cuenta" (ES) — alternatives considered: Wallet / Profile / Identity
- [ ] User confirms 3-state chip shape stays uniform (no layout shift)
- [ ] User confirms Phase 1 ships before Phase 2 (vs. bundling)
- [ ] User confirms scope excludes /play-hub HubProBadge (separate work)
