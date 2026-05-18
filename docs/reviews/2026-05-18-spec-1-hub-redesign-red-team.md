# Red Team Review — SPEC 1 Hub Redesign

**Date:** 2026-05-18
**Spec reviewed:** `docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md`
**Spec commit:** `4b6cbf4`
**Code commit checked:** `4b6cbf4ae3b4994368db9886d3ec7ca481842771`

---

## Summary

- Spec is **strategically sound** and well-scoped (good non-goals discipline), but is **not yet shippable** as written — multiple assumptions about existing code/data are wrong, and at least three Hero/Profile features have no signal source in the codebase.
- Three P0 blockers center on: (1) `getContextAction` reuse is a domain conflation that will silently break the in-exercise CTA flow; (2) `mate-streak` Hero state has no data source in `mini-arena-progress.ts`; (3) display-name persistence in Supabase requires write auth that does not exist (no Supabase Auth wired) and would need a new signed endpoint — not in the file list.
- The "Trophies redirect" decision (D8) silently kills a real surface (header, back-button, scrim) — should be a presentation port, not a 1-line redirect.
- D13 (anchor cleanup) misdiagnoses the bug: the JSX `<picture>` is invisible (`opacity:0`) — only the CSS `background:` actually renders. Fix sequence in D13 will produce a blank anchor mid-deploy unless ordered carefully.
- V1+V2 dual maintenance is undersold: V2 (`hub-scaffold-v2-client.tsx`) is a *different* DOM tree with different testids; the spec lists "mirror changes" as one line but it's effectively a second implementation.

---

## P0 — Blockers (must resolve before implementation)

### P0-1. `getContextAction` extension conflates two unrelated domains
- **Evidence:** `apps/web/src/lib/game/context-action.ts:1-40` — current `ContextAction` union is `"submitScore" | "useShield" | "claimBadge" | "retry" | "connectWallet" | "switchNetwork" | null`. It is consumed in `apps/web/src/components/exercises/exercises-screen.tsx:730` to drive the *in-exercise* contextual slot (after winning/losing a puzzle).
- **Spec says:** "extend `getContextAction(state)`" with hero states `new-player | daily-pending | mate-streak | default` (Architecture table line 219).
- **Impact:** Extending the same function/union means the exercises CTA slot can now return Hero states it doesn't know how to render, or the Hero can return `useShield`/`submitScore` and crash the formatter. Tests at `lib/game/__tests__/context-action.test.ts:6-40` will need rewriting under a discriminated state shape — silent breakage risk is high.
- **Suggestion:** Create a NEW pure helper `getHeroContextAction(state) → HeroCTA` in `lib/hub/hero-cta.ts`. Do not touch `context-action.ts`. Make the discriminated union explicit. Update Architecture row 219 + Files Affected list.

### P0-2. `mate-streak` Hero state has no data source
- **Evidence:** `apps/web/src/lib/game/mini-arena-progress.ts:9-54` — storage shape is `{ "kr-vs-k": 12 }` (per-setup best **move count**, not streak). No "active streak" concept exists. No `lastCompletedDate`, no consecutive-day counter, no "3/5 solved" denominator.
- **Spec says:** Hero CTA "mate-streak" trigger = "Mini-arena active streak", sub-copy = "K+R · 3/5 solved" (D4 table).
- **Impact:** State is unimplementable as specified. Either (a) implement a streak counter (extra scope), or (b) reframe to "Mate progress" using existing best-move data.
- **Suggestion:** Spec must either define the new storage shape (new keys, migration of existing `chesscito:mini-arena-best`, persistence rules — analogous to `daily/progress.ts`) OR pick a different trigger derivable from current data (e.g. "mate-incomplete: K+R best=14 → tap to improve"). Add to D10 priorities list.

### P0-3. Display-name Supabase persistence is not architecturally feasible as described
- **Evidence:** `apps/web/src/lib/supabase/schema.sql:1-88` — no `profiles` table, no `display_name` column, no Supabase Auth users table referenced. `getSupabaseServer()` is service-role only (`server.ts` is server-only by contract per CLAUDE.md). Grep for `display_name|displayName|profile.*name` across `apps/web/src` returns 0 application matches.
- **Spec says:** "Custom name persisted in Supabase keyed by wallet address" (D9 §1) — single line, no auth/endpoint design.
- **Impact:** Without Supabase Auth (we don't have it; we have wagmi wallet auth only), a write endpoint keyed by wallet address requires either (a) SIWE message verification per write or (b) trust-the-client (anyone can rename anyone's wallet — vandalism / impersonation vector — "vitalik.eth", profanity, doxxing of real names linked to wallets). Plus: no profile table exists; new migration required; new `/api/profile/name` route + Zod validation + rate-limit + length cap + content filter; client cache invalidation.
- **Suggestion:** Either (a) **descope to localStorage-only** in v1 (single line change, no auth, no migration — losing cross-device but matching every other UX state in this codebase) OR (b) write a SPEC 1.5 sub-spec for signed-write profile persistence with full security review. Do not leave the line in D9 as written.

### P0-4. D13 anchor "fix" misdiagnoses the bug; literal step order will blank the anchor
- **Evidence:** `apps/web/src/app/globals.css:2906-2940`:
  ```css
  .kingdom-anchor--playhub { background: url("/art/scene-rooted/portal-centered.png"); ... }
  .kingdom-anchor--playhub .kingdom-anchor-picture { opacity: 0; }  /* line 2938-2940 */
  ```
  The `<picture>` is *intentionally invisible* — only the CSS background renders. The "two images stacked" framing is wrong; only one renders today.
- **Spec D13 fix order:** (1) change `HERO_ASSET_BASE` to portal-centered, (2) generate .avif/.webp, (3) **remove CSS `background` rule**, (4) update tests.
- **Impact:** If step 3 runs before the CSS rule that hides `.kingdom-anchor-picture` is removed in the same commit, the anchor goes BLANK (background gone, picture still `opacity:0`). Listed file changes don't mention removing the `opacity: 0` rule on line 2938-2940.
- **Suggestion:** Rewrite D13 to explicitly: (a) remove the `opacity: 0` rule on `.kingdom-anchor--playhub .kingdom-anchor-picture` in same step as removing `background:`, (b) ship the .avif/.webp first as a separate commit with verification, (c) only then flip `HERO_ASSET_BASE`. Add `globals.css:2938-2940` to deletion list.

### P0-5. Hero CTA `daily-pending` countdown "Nh left" has no implementation path
- **Evidence:** `apps/web/src/lib/daily/progress.ts:1-113` — UTC-day boundaries (`todayUtc()`), tracks completion-by-date but exposes no remaining-hours derivation. Computing "N hours left" requires real-time tick logic (re-renders every minute) and timezone handling for "today's UTC reset".
- **Spec says:** sub-copy = `"Nh left" countdown` (D4 table row 2).
- **Impact:** Sub-copy is presented as static data but is a live ticker. Without explicit `useEffect` interval + memoization, the Hero CTA will say e.g. "8h left" stale until next mount. With it, you re-render the hub every minute (telemetry burst on `hero_cta_viewed` if added; layout thrash).
- **Suggestion:** Either (a) drop the countdown for v1 ("Today's tactic awaits") and add it back in a polish pass, or (b) add an explicit `useDailyCountdown()` hook to Hooks table with documented re-render cadence and unit tests. Don't leave it as ambient.

### P0-6. PRO chip "active" path opens "PRO sheet" but spec also says PRO moves to Shop in SPEC 2 — chip-target during the migration is undefined
- **Evidence:** `apps/web/src/components/hub/hub-scaffold-client.tsx:298-304` — `onProTap` opens `proSheet.openSheet()` today. ProSheet is the active surface.
- **Spec says:** D6 row PRO active → "Opens PRO sheet (`/hub?sheet=pro`) → days remaining + manage". D9 §4 says "later: deep-link into Shop". Non-goals: "Move PRO subscription into Shop → SPEC 2".
- **Impact:** SPEC 1 ships a Pending Claims pattern + Profile + Trophies redirect, but the PRO chip behavior is left ambiguous. When SPEC 2 ships, both surfaces (PRO sheet AND Shop with PRO item) will exist — what happens to deep-link `?sheet=pro`? Does it redirect? Stay forever? This is an undefined transition.
- **Suggestion:** Add explicit D6.1: "PRO chip behavior during SPEC 1→2 window. `?sheet=pro` continues to open ProSheet. SPEC 2 introduces a redirect from `?sheet=pro` → `?sheet=shop&item=pro`." Without this the chip will be re-broken at SPEC 2 ship time.

---

## P1 — Important (resolve in spec before plan)

### P1-1. D8 Trophies "redirect" silently kills a real page
- **Evidence:** `apps/web/src/app/trophies/page.tsx:1-58` — full page with `<header>`, back-button (`<CandyBanner name="btn-back">`), scrim background, `TROPHY_VITRINE_COPY.pageTitle`, page-level scroll container. Not a "1-line redirect target".
- **Spec says:** "Replace JSX with `redirect("/hub?sheet=trophies")` (preserves external links)."
- **Impact:** External bookmarks will land on the hub with a sheet open. Sheet has a swipe-down dismissal that returns to the hub — the user came from outside but now "back" lands in the hub. Loss of the explicit "Back to hub" affordance. Hub renders the full kingdom anchor in the background even though the user wanted only trophies — visual noise + extra resource load on a cold visit.
- **Suggestion:** Keep `/trophies` as a standalone page rendering `<TrophiesBody>` with its own back button (current shape). Add an internal route from HUD trophy chip to open the sheet instead (`?sheet=trophies`). Two surfaces is *intentional* — page for external links, sheet for in-hub navigation. Same data layer, no duplication.

### P1-2. Claim Queue "Claim all (N) ~ $X total" copy is logically impossible for the queue defined
- **Evidence:** Spec D10 says victory-NFT costs $0.005-$0.02, while badge + score are "gas only". D10 also says "'Claim all' appears only if all rows are free (badges + scores). Mixed lists show individual rows only."
- **Spec D9 §2 says:** `"Claim all (N) · ~$X total" batched action when all rows are free` — but if they're all free, why is the dollar total shown?
- **Impact:** Copy contradicts itself. User confusion: "I clicked Claim All and it cost me nothing — was the $X estimate gas? Tip? Mystery fee?"
- **Suggestion:** Reframe to "Claim all (N) · gas only" when free OR "Claim all (N) — $X" only if mixed-and-bundled is added later. Update editorial.ts copy block in spec.

### P1-3. "Claim all" batching has no on-chain primitive in v1 contracts
- **Evidence:** `apps/web/src/lib/contracts/badges.ts:1-37` — `claimBadgeSigned` is single-badge. `apps/web/src/lib/contracts/scoreboard.ts:1-29` — `submitScoreSigned` is single-score. No `multicall`, `claimAll`, or batched variant. `claim_attempted` telemetry is `(kind, count)` — count > 1 implies multiple txs.
- **Spec says:** `"Claim all (N)"` batched action.
- **Impact:** "Claim all" means N sequential MiniPay confirmations (3 badges = 3 prompts). User sees one button labeled "Claim all" and gets a confirm-fatigue chain — almost certainly drops mid-flow. Failure recovery: if confirm 2/3 fails, what's the state? Spec says "row stays, error toast" — but the queue logic for partial completion of `claim-all` is undefined.
- **Suggestion:** Either (a) descope batching for v1 — render individual claims only, OR (b) write a P1-explicit partial-failure section to D10: "If claim-all encounters failure mid-sequence, completed rows disappear, remaining rows stay, single rolled-up error toast lists which ones failed, telemetry `claim_all_partial { succeeded: [...], failed: [...] }`."

### P1-4. Notif-dot logic creates false positives during stale data windows
- **Evidence:** `apps/web/src/components/hub/hub-scaffold-client.tsx:182-194` — badges `useReadContracts` has `staleTime: 2 * 60_000` (2 min). `apps/web/src/components/hub/hub-scaffold-client.tsx:211-225` — shields polled on mount + via `subscribeToShieldChanges` event bus.
- **Spec says:** D6 "Red dot if any unsaved score" / D10 "Notification dot is the persistent signal" / D9 banner shows "total pending claims count".
- **Impact:** Race: user claims badge, tx confirms on-chain, wagmi cache stale 2min, notif-dot still red. Or: localStorage exercise progress just persisted, scoreboard sync queued for next render, notif-dot red until user reloads. Bad: user re-taps Profile, sees "claim badge" row that throws `AlreadyClaimed` revert.
- **Suggestion:** D10 must list dedup invariants:
  - On claim success, **optimistically remove** the row before next on-chain refetch.
  - Provide a "Refresh" affordance + auto-refresh on Profile open.
  - Specify what happens when on-chain says "claimed" but localStorage exercise progress wasn't synced (claim was via another device): row stays out, no false positive.

### P1-5. `useProfileStats` "RSC fetch via Supabase cache" violates the client-only structure of the hub
- **Evidence:** `apps/web/src/components/hub/hub-scaffold-client.tsx:1` — `"use client"`. The hub is a client tree. RSC fetch hooks (`use cache`, `cache`) don't compose inside `"use client"` boundaries.
- **Spec says:** Hooks table row 1: `useProfileStats — RSC fetch via Supabase cache (~5ms)`.
- **Impact:** Implementer will discover at code time that they can't call server-only Supabase code from inside `useProfileStats()` running on the client. They'll fall back to a `/api/profile/stats` route that costs a round trip per Profile open (not ~5ms; ~150ms WebView round trip + Supabase). Plus: stats depend on wallet address (per-user), so they can't be cached at the route level without a per-address cache key strategy.
- **Suggestion:** Spec must specify: (a) new API endpoint `/api/profile/stats?address=0x...` with auth model (signed request? best-effort by address?), (b) cache strategy (no caching by default because per-user), (c) Suspense boundary at ProfileSheet level. Update Hooks table to be explicit about the data flow.

### P1-6. Wallet disconnect mid-"Claim All" is not specified
- **Evidence:** wagmi `useAccount` reactivity: address goes undefined → all subsequent reads return undefined → `useReadContracts` query is disabled (`enabled: Boolean(address && badgesAddress)` line 191).
- **Spec D10 says:** "Web-graceful. No wallet → CTA becomes 'Connect wallet to claim'."
- **Impact:** Mid-flow: confirm 1/3 done, user accidentally hits "disconnect" in MiniPay (or wagmi loses connection — common on iOS Safari background tab return). Queue claims race: address gone → re-render shows "Connect wallet" — but pending tx is in flight. On success it lands in a wallet we no longer recognize. Telemetry says `claim_succeeded` but UI says "connect to claim" → user re-claims, tx reverts.
- **Suggestion:** Add explicit D10 row: "Mid-flight disconnect handling. Active tx hashes are tracked per claim. On disconnect, pending rows display 'In flight — reconnect to verify' and freeze until either (a) reconnect resolves to same address (resume), (b) reconnect to different address (drop pending state), or (c) timeout (10 min: assume failed, return to claimable)."

### P1-7. Hero CTA priority resolves to default while data still loading → flicker
- **Evidence:** `apps/web/src/components/hub/hub-scaffold-client.tsx:182-205` — `badgesData` is undefined during first paint; `badgesClaimed` map starts empty; `useReadContracts` resolves async. `proStatus` resolves async too.
- **Spec says:** Priority `new-player > daily-pending > mate-streak > default`. No loading state in D4.
- **Impact:** First paint: 0 badges, 0 daily, 0 mate → renders `new-player` "START WITH PIECES". 200ms later: badges resolve, dailyProgress hydrates from localStorage → re-renders `daily-pending` "PLAY TODAY'S TACTIC". User saw the wrong CTA for a frame; could have already tapped. Worse on slow networks.
- **Suggestion:** Add D4.1 "Hero CTA loading state". Choices: (a) render disabled/skeleton until all 4 signals resolve, (b) render `default` until resolved (least confusing — Arena link below is always there), (c) render last-known from sessionStorage. Pick one. Don't allow the literal sequence above.

### P1-8. Onboarding card timing not specified relative to hub render
- **Evidence:** Existing `apps/web/src/components/hub/hub-splash.tsx` is dynamic+ssr:false specifically to avoid first-paint hydration issues with localStorage reads.
- **Spec D14 says:** Storage `chesscito:hub-onboarded:v1` — but doesn't say when card renders relative to the hub. Above the fold? Modal blocking? Inline at top of body? Dismiss only or auto-dismiss?
- **Impact:** Implementer will guess. If blocking modal: first-paint hydration mismatch (server renders no modal, client mounts modal). If inline: pushes Hero down, layout jumps when dismissed. If above-the-fold: collides visually with HUD.
- **Suggestion:** Specify (a) render position (mounted at the top of `<main>`, between HUD and Body), (b) dynamic+ssr:false same as `<HubV2Splash>`, (c) dismiss interaction (close button + tap outside? or sticky until dismissed?), (d) what happens on re-open if user reload mid-read.

### P1-9. V1+V2 dual-maintenance — V2 has different DOM, testids, and Mastery dashboard
- **Evidence:** `apps/web/src/components/hub/hub-scaffold-v2-client.tsx:181-296` is structurally distinct from V1: `[data-hub-v2]`, MasteryDashboard 2x3 grid, splash overlay, Training Pass band, sticky dock with shield ribbon. V2 has no reward column, no PremiumSlot — entirely different composition.
- **Spec says:** "`hub-scaffold-v2-client.tsx` (mirror changes) — V2 canary kept in parity until promotion or removal."
- **Impact:** "Mirror changes" is one bullet but it's a second full implementation. V2's MasteryDashboard tile model (`locked-buildable | coming-soon` per `PLACEHOLDER_TILES`) doesn't map to V1's `RewardTile` (`unlocked | locked | claimed`). New Profile sheet, Pending Claims, Hero CTA, Secondary CTA, Onboarding, Trophies sheet all need a V2 equivalent (or skip V2 — but then promote-to-default at flag-flip ships a regression).
- **Suggestion:** Spec must declare V1+V2 scope. Either: (a) freeze V2 and accept that the flag flip will be delayed, OR (b) ship to V2 only and retire V1 in this spec, OR (c) ship to V1 only and unship V2 (`HUB_V2_DEFAULT` is already `false`). Pretending it's "mirror" hides 50% of the implementation work.

### P1-10. Settings sheet listed in dock but has zero implementation scope
- **Evidence:** `Grep` for `SETTINGS|settings.*sheet|theme.*toggle|hapt.*toggle` in `apps/web/src/components` returns 0 matches. There is no settings UI today.
- **Spec D7 says:** "Settings → `/hub?sheet=settings` (new sheet — same pattern as shop/pro/badges). Theme, haptics, language, version chip."
- **Impact:** Spec implies "ship Settings sheet with theme + haptics + language toggle" as a sub-implementation, but no design, no current language switching infra (i18n is hardcoded English per CLAUDE.md), no theme system (no dark mode — grep for `darkMode|dark:` returns Tailwind config matches only, no app code).
- **Suggestion:** Either (a) descope Settings to a stub sheet showing version + a few visible-but-disabled toggles, OR (b) write a sub-spec for the Settings sheet content/contract (i18n is a *big* lift), OR (c) drop Settings from D7 and replace with a stub "Coming soon" route or remove the slot. Don't ship 4 features under one bullet.

### P1-11. PRO chip "inactive" → "upsell with current monthly drop" — but `PRO_DROP_COPY.current` is hardcoded
- **Evidence:** Spec D12 — copy lives in `editorial.ts` and "updates monthly with each content drop". No CMS, no admin panel.
- **Impact:** Every content drop is a code deploy. If someone forgets to update the constant after the drop ships on the contract, the upsell promotes the wrong puzzle (or a puzzle that no longer exists). Cross-coupling: SPEC 2 content drop process must include "update `PRO_DROP_COPY.current`" — invisible operational risk.
- **Suggestion:** Add operational note to D12: "Monthly drops require a synchronized commit updating `PRO_DROP_COPY.current`. SPEC 2 will introduce a server-side current-drop endpoint to remove this risk." Or: read the current PRO item name from the on-chain shop catalog (single source of truth).

### P1-12. Telemetry payloads can leak PII (claim_succeeded includes tx_hash)
- **Evidence:** `apps/web/src/lib/telemetry.ts:55-80` — POSTs `{ session_id, event, props }` to `/api/telemetry`. Session id is local-only random hex (good). But spec adds `claim_succeeded(kind, tx_hash)` — tx_hash is a public on-chain identifier directly linkable to wallet address via Celoscan.
- **Spec says:** "Telemetry events: `claim_succeeded (kind, tx_hash)`".
- **Impact:** Telemetry session_id was deliberately uncoupled from wallet (CLAUDE.md security rules). Pushing tx_hash into telemetry events couples session_id ↔ wallet via Celoscan lookup — first telemetry row to include tx_hash deanonymizes the entire session's prior rows.
- **Suggestion:** Drop `tx_hash` from `claim_succeeded`. If correlation to chain is needed, log tx_hash to server logs only with no session_id. Or: hash the tx_hash with a server-side salt before storing.

---

## P2 — Nice-to-have (can resolve during implementation)

### P2-1. "Tier" computation lacks negative test cases
- D9 §1 mentions "Tier title (computed: Apprentice → Trainee → Knight → Wizard → Grandmaster)". Editorial.ts has no existing tier copy (grepped 0 matches). Testing strategy unit list (`computeTier: 5 tier thresholds, boundary cases`) doesn't cover "0 puzzles + 5 badges claimed" (tier from badges or puzzles?), "no wallet connected" (no tier? show "Visitor"?), or i18n-readiness of titles. Spec is silent on the input shape (`stats`) — is it puzzles solved? Badges? XP?

### P2-2. Avatar editable pen — picker deferred, but pen exists
- D9 §1 says wizard wolf default with "editable pen icon — picker deferred to SPEC 2". But a pen icon implies tappable. What happens when tapped if no picker exists? Spec implies it opens the name-edit dialog (since name-edit is described in the same sentence). The pen is now overloaded: pen = "edit name" AND "will eventually edit avatar". Should be different affordances or pen scoped to name-only with explicit note.

### P2-3. Leaderboard tab persistence in localStorage — no eviction story
- D11 stores tab in localStorage. No key naming convention shown. No eviction. Quota concern is small but adds to the growing `chesscito:*` key sprawl (counted in this review: `chesscito:arena-last-difficulty`, `chesscito:claim`, `chesscito:coach-welcomed`, `chesscito:optimistic-victory`, `chesscito:arena-game`, `chesscito:daily-progress`, `chesscito:mini-arena-best`, `chesscito:analytics-session`, `chesscito:hub-onboarded:v1`, `chesscito:victory-pending:*`, `chesscito:progress:*`, `chesscito:shields` — twelve+ keys). Worth a single `chesscito:hub-v1` namespace.

### P2-4. Pending Claims `"empty state: hidden"` — visually inconsistent with Stats grid
- D9 §2 says claims section hides when empty, but D9 §3 stats grid always renders even at 0 / 0. New user opens Profile and sees a sparse modal: avatar + "0 / 6 mastered / 0 / 0 / 0" stats. Better to show empty-state CTAs in either both or neither.

### P2-5. `<SecondaryCta>` always-visible but no logic for when wallet disconnected
- D5 says "always present, never promoted, no badge, no nag". Arena is gated on wallet for the Victory NFT mint — but free play is allowed. Spec doesn't say what `secondaryAction` button does on tap when wallet is disconnected. Likely: navigates to `/arena` and the arena gate handles it. Worth explicit one-liner.

### P2-6. "Manual QA on iPhone (MiniPay viewport 390px)" — no specific QA checklist
- Validation gates list this, but doesn't enumerate per-state acceptance criteria. Should call out: each Hero CTA state (4), each PRO state (active/inactive), claim queue (empty/single/all-free/mixed), disconnected wallet, mid-onboarding-card, settings sheet contents.

### P2-7. `kingdom-anchor.test.tsx` test updates (D13 step 4) understated
- 4 lines listed but there are 7 occurrences of "splash-loading" in the test file (lines 14, 19, 24, 64, 67). Plus `aspect-ratio` test at line 27-32 will need to verify new portal-centered aspect. Plus the test "does NOT render the splash-loading hero asset in the arena-preview variant" at line 63 becomes incoherent — splash-loading is no longer the hero anywhere.

### P2-8. MiniPay-specific: sheet vs page route — keyboard layout shifts
- D9 mentions one keyboard concern (name-edit dialog avoiding inline-editing). Other surfaces with text input: search/filter in Trophies sheet (already exists), any new Profile text input (display name dialog itself). MiniPay WebView is iOS Safari WKWebView — when keyboard appears, viewport shrinks, fixed `inset: 0` sheets can scroll incorrectly. Recommend testing in MiniPay simulator before promotion.

### P2-9. Hub render budget vs spec scope
- The hub at flag-flip will render: HUD (4 chips + secondary row), 6 ambient tiles (3 LEARN + 3 UNLOCK), KingdomAnchor (image), Hero CTA, Secondary CTA, Persistent dock (5 slots), Onboarding card (first-visit). Plus 4 sheets pre-mounted (Profile, Shop, PRO, Badges, Trophies, Settings = 6). All in 390px viewport at MiniPay. Mounting all sheets eagerly inflates JS bundle. Spec doesn't ask for `dynamic()` imports — should it?

---

## Verified assumptions (the spec got these right)

- `apps/web/src/components/hub/hub-scaffold-client.tsx` is the canonical V1 client — confirmed at file's top docstring + the page.tsx routing. Spec correctly identifies it as "primary target".
- `parseInitialSheet` in `apps/web/src/app/hub/page.tsx:40-44` does exist and is currently `"shop" | "pro" | "badges"`. The spec's extension to add `"trophies" | "profile" | "settings"` is the right surface.
- `<TrophiesBody>` at `apps/web/src/components/trophies/trophies-body.tsx` is genuinely shared between `/trophies` page and the dock sheet — confirmed at trophies/page.tsx line 7. D8's "no change" claim on TrophiesBody is correct.
- `apps/web/src/lib/daily/progress.ts` provides `getDailyProgress()` / `isCompletedToday()` — enough to derive `daily-pending` Hero state (modulo countdown — see P0-5).
- `apps/web/src/components/hub/hub-scaffold.tsx` is purely presentational (caller owns navigation/telemetry). Spec's "Pure presentational composition" framing is correct.
- The 3-layer Supabase write architecture (`/api/cache-victory`, `/api/cache-score`, queries.ts) is real and works as MEMORY.md describes.
- `app/trophies/page.tsx` redirect would preserve external links *in URL terms* — confirmed via `next/navigation redirect()` behavior. (UX concern is captured in P1-1, not P0.)

---

## Open questions for the author

1. **`getContextAction` extension vs new helper**: do you want to keep the in-exercise CTA logic and the hub Hero CTA logic in the same function, or split them? (P0-1)
2. **Display name persistence**: is cross-device persistence a v1 requirement, or is localStorage acceptable? If cross-device, who designs the signed-write endpoint? (P0-3)
3. **Mate-streak**: do we add a streak counter to mini-arena (changing storage shape) or reframe to a "mate progress" trigger? (P0-2)
4. **V1+V2 strategy**: do we ship to V1 only and accept V2 stays behind, or freeze V1 and ship to V2, or build both? (P1-9)
5. **Claim-all batching**: is N sequential MiniPay prompts acceptable UX or do we descope to per-row only in v1? (P1-3)
6. **Settings sheet scope**: stub vs full v1 implementation (theme/haptics/language)? (P1-10)
7. **Hero CTA loading state**: which of the three options in P1-7? (P1-7)
8. **Onboarding card**: blocking modal, inline pushdown, or above-the-fold banner? (P1-8)
9. **PRO chip migration to Shop**: are we shipping the redirect from `?sheet=pro` in SPEC 1 or in SPEC 2? (P0-6)
10. **Profile stats endpoint**: new `/api/profile/stats` or per-stat distributed reads (badges via wagmi, daily via localStorage, victories via Supabase)? Affects ProfileSheet first-paint perf. (P1-5)
