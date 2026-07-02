# Real-chain verification + Shop consolidation step 2 — handoff (2026-07-02)

Status: **shipped to `main`, pushed to origin**. Continuation of the same
day's earlier Coach + Shield Peones consolidation
(`docs/handoffs/2026-07-02-coach-shield-peones-consolidation-handoff.md`).
This session closed the "real-chain verification" item that handoff left
open, then found and fixed three real bugs during that manual pass, then
executed Shop consolidation step 2 from
`docs/product/chesscito-treasury-unification-plan-2026-07-01.md`.

## What shipped (commits, in order)

1. **`d000690b`** chore(supabase): committed local CLI scaffolding
   (`apps/web/supabase/config.toml` + `.gitignore`) that had been sitting
   untracked from a prior session. No secrets, boilerplate only.
2. **Real-chain verification — PRO rail confirmed live.** Operator
   completed a real MiniPay purchase: `chesscito_pro_30` ($1.99 USDT) to
   `ChesscitoTreasury` (`0xcD3837DD017dFA5E31A2e3Cf390721E16Ac8Fbf0`).
   PRO activated immediately, confirmed persisting across reload and
   across `/hub`, `/exercises`, `/profile`. No env var or contract
   deploy needed — the rail fully reuses Season Pass's existing config.
   Evidence + step-by-step runbook:
   `docs/ops/2026-07-02-real-chain-verification-runbook.md`.
3. **`e67f691f`** fix(exercises): Shield Peones-fallback was unreachable
   through the real UI. `FailRescueModal`'s variant D (0 shields, welcome
   pack claimed) had its primary CTA wired to `onGetShields`, which
   deep-linked to the Shop — but Shield's Shop-TX SKU had already been
   retired by the same-day Coach+Shield cluster, so the button opened an
   empty Shop. Fixed: variant D now calls `onUseShield` (same handler as
   A/B), copy changed "Get Shields" → "Use Peones" + new "2 Peones" pill.
   Confirmed live in real MiniPay: charged exactly 2 Peones.
4. **`6dc25e3a`** fix(exercises): Welcome Pack claim/rescue-modal desync
   — an unwinnable loop that forced a real streak loss. Root cause:
   `useFailRescue()` called its own independent `useWelcomePackClaim()`
   instance, separate from the one `exercises-screen.tsx` already owns
   for the Shop's claim button. Claiming via the Shop never reached the
   other instance until a full page remount, so the rescue modal kept
   re-showing "Claim 3 Shields" forever after the real claim already
   succeeded. Fixed by passing `welcomePackClaimed` into `useFailRescue`
   as a prop from the single existing instance. New generalizable lesson
   saved to memory: [[feedback_duplicate_stateful_hook_desync]].
5. **`34634063`** docs(exercises): fixed a stale comment in
   `use-streak.ts` that claimed replays bump the streak — the actual
   code has excluded replays since 2026-05-31 (anti-grind-loophole).
   Comment-only, found while explaining the streak/`totalStars` naming
   collision to the operator ("STAR PROTECTED" refers to the streak, not
   permanent per-exercise score).
6. **`cafb80d3`** fix(ui): `ProSheet` now renders above the persistent
   dock instead of below it. The dock (`z-60`) intentionally sits above
   generic Radix Sheet overlays (`z-50`) for destination panels
   (badge/shop/trophies/leaderboard) — correct there, wrong for a
   purchase-decision sheet, where the dock was winning the stacking
   fight and degrading the purchase flow's usability. Added an optional
   `overlayClassName` prop to the shared `SheetContent` (previously the
   internal `SheetOverlay` took no className at all) so `ProSheet` alone
   can opt into `z-[70]`, matching the precedent `FailRescueModal`
   already set for the same reason. Every other Sheet consumer is
   unaffected.
7. **`f9ef88c8`** refactor(shop): retired PRO's approve+buyItem path —
   Shop consolidation step 2. PRO's tile stays visible in the Shop
   catalog at the same spot; tapping it now opens the same rail-based
   `<ProSheet>` already mounted on every route instead of the legacy
   confirm-sheet flow. Founder Badge is untouched, the only remaining
   live consumer of `purchase-confirm-sheet.tsx` (now documented as the
   generic reusable template for any future approve+buyItem item — see
   [[reference_purchase_confirm_sheet_template]]). `arena/page.tsx`
   needed `shopSheet`'s declaration (+ its two callbacks) reordered to
   after `proSheet`'s, since it referenced `proSheet` in the new
   `onSelectProItem` callback but was declared first in that file.
8. **`b9685cb3`** fix(pro): regression found immediately after step 7 —
   the operator noticed they could no longer top up PRO while already
   active. Root cause: the retired Shop tile had no gate at all (could
   always re-buy); `ProSheet`'s own extend/renew link was gated to
   `daysLeft ≤ 7` (M1 funnel design, 2026-06-02). A user with ~30 fresh
   days (e.g. right after buying) had no path left to top up. Fixed by
   removing the days gate entirely — `PRO_COPY.expiringMicroCopy`
   ("Renew anytime to keep training") was already calm/non-urgent copy
   by design (Canon §11: no FOMO framing), so showing it regardless of
   days remaining matches the copy's own intent. Removed the now-dead
   `EXPIRING_THRESHOLD_DAYS` constant.

All eight steps: full suite 4565/4565 passing (was 4557 at the start of
today), tsc + eslint clean throughout.

## Process note

Every one of items 3, 4, and 8 was found by a **real human manually
using the product on a real device**, not by any automated test or
review — matching the pattern already flagged in the prior handoff
([[feedback_final_review_catches_composition_bugs]]): whole-system,
real-usage passes catch a distinct class of bug that per-component
review and unit tests structurally cannot, because the bug lives in the
composition/interaction between pieces that are each individually
correct and individually tested.

## Not yet done — flagged, not blocking

- **VR baseline `hub-shop-sheet-open`** still stale (sandbox-blocked
  twice in the prior session, needs a real dev machine or CI run).
- **`handleUseShield`** still has zero automated test coverage — same
  gap flagged in the prior handoff, unchanged.
- **Pricing coherence** (2 Peones Shield vs 1 Peón Coach) still
  unresolved — needs a real economic-model pass, operator has flagged
  wanting guidance here.
- **Two new backlog ideas from the operator, not scoped**: gift-able
  PRO (buy + send to another wallet) and an exercise-solving acquisition
  campaign that lets players claim PRO via a minimal tx. Saved to
  [[project_pro_growth_ideas_backlog]]. Neither is designed; both need
  their own spec before implementation.
- **Shop consolidation step 3** (Victory NFT `mintSignedWithPermit`) is
  next per the confirmed sequencing, but is a real contract upgrade —
  needs full spec + red-team review before touching the deployed proxy,
  per [[feedback_security_review_gate]]. Not started.

## Key docs to re-read when resuming

- `docs/ops/2026-07-02-real-chain-verification-runbook.md` — PRO rail +
  Shield fallback real-MiniPay evidence.
- `docs/product/chesscito-treasury-unification-plan-2026-07-01.md` —
  step 2 (done this session) and step 3 (next) of Shop consolidation.
- `docs/handoffs/2026-07-02-coach-shield-peones-consolidation-handoff.md`
  — the same-day earlier handoff this session continued from.
