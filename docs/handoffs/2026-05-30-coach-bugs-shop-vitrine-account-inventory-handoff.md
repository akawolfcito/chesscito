# Coach Bugs + Shop Vitrine + Account Inventory — Handoff

**Date:** 2026-05-30 · **Branch:** main · **Range:** `1690a806..792e9a89` (12 commits)
**Status:** All commits on `main`, preview deploys triggered. Production stays on `f54f6fc` (per the preview/prod separation). Production promote gated on user smoke + VR refresh.

## What shipped

Twelve commits across three semi-overlapping clusters, all driven by the user's MiniPay smoke session:

1. **Coach Viewer bug cluster** (6 commits) — the Ask Coach tile gave no feedback during analysis, sign-victory returned 400 from the visor, and a stale mint state leaked between games.
2. **Shop + vitrine sheets visual cluster** (4 commits) — card icons were clipped instead of overhanging, the hero anchors in Trophies/Leaderboard were also clipped, and the shop cards used a one-off dark texture instead of the shared vitrine treatment.
3. **Shop oscuridad — Phase 1 inventory** (1 commit) — AccountSheet got 2 new inventory rows (Streak Shields + Founder Badge) and the Coach row now surfaces the explicit credit count.

Plus a documentation commit for the future Moment NFT feature so the resign-doesn't-mint decision isn't re-litigated later.

## Cluster 1 — Coach Viewer post-mint bugs

The smoke uncovered four related bugs in the `/coach/[gameId]` visor:

### Bug #2 — Ask Coach tile silent during analysis (4 commits)

The visor created `coach = useCoachAnalysis(...)` but only consumed `coach.askCoach` as a dispatcher. `phase`, `response`, `fallbackResponse` were never read by the render — so tapping Ask Coach silently fetched the analysis, persisted it to Redis, and left the visor visually identical. The user only discovered the completed analysis via the Journal banner after navigating away.

- **`dd439a6e`** `fix(coach-viewer): wire hook state into render path for in-place rehydration` — refactored the `inlineAnalysisNode` chain to prioritize live hook state: `loading → pending banner`, `result → CoachPanel`, `fallback → CoachFallback`, `default → cold-load gameRecord.analysis`. Cream-amber pending banner matches the cluster's other panels.
- **`a55d5566`** `feat(coach-viewer): pending spinner + label swap on Ask Coach tile` — `GameActionsBar` gains `askCoachPending` prop wired from `coach.phase === "loading"`. Tile renders spinner overlay + "Analyzing…" label + aria-busy + disabled.
- **`f5aa366a`** `feat(coach-viewer): smooth-scroll to analysis on loading → settled edge` — `useEffect` watching `coach.phase`; on the `loading → result/fallback` transition only, `requestAnimationFrame + scrollIntoView({behavior: "smooth", block: "start"})` brings the freshly rendered panel into view. Cold-load entries don't trigger.
- **`fa20b3ef`** `test(coach-viewer): cover Ask Coach pending state on actions bar` — 3 new RTL cases (pending=true label/aria-busy/disabled, pending=true blocks onAskCoach, pending=false normal). 21/21 actions-bar tests pass.

### Bug — Save Victory 400 from visor (1 commit)

- **`dbaf5b1f`** `fix(coach-viewer): pass moveHistory + playerColor to mint hook` — visor instantiated `useMintVictory` without `moveHistory` (defaulted to `[]`) and `playerColor` (defaulted to `"w"`). Route's first validation rejects empty arrays with HTTP 400. Fix: pass `gameRecord.moves` through, derive `playerColor` from move-list parity (odd length = white delivered mate, even = black). Reliable while `result === "win"` keeps meaning checkmate. Forward-compat TODO: persist `playerColor` in `GameRecord` for a future cluster so the derivation isn't needed.

### Bug — Save desaparece post-unlock (1 commit)

- **`96f709a5`** `fix(mint): scope sessionStorage claim restore to current gameId` — the mint hook persisted its success state in `sessionStorage["chesscito:claim"]` and rehydrated on every mount without checking which game the entry belonged to. After SAVE in game A → phone lock/unlock → game B → visor B mounted, read game A's saved success, hydrated `mint.data.tokenId` with stale value, state machine hid the Save tile thinking game B was already claimed. Fix on both sides of the contract: write includes `gameId`, restore rejects mismatches (and clears the stale entry).

  3 new test cases cover the contract (mismatch, legacy payload without gameId, match). 29/29 mint+visor+actions tests pass.

### Bug — Share Trophy "dead button" (false alarm)

User reported tapping Share Trophy did nothing. Initial diagnosis was `navigator.share` failing silently. Smoke after the gameId-scoping fix proved the share sheet opens correctly — the prior "no hace nada" was a downstream symptom of the state leak (tile firing with `shareLinkUrl = null` because the visor was hydrating from a previous game's payload). No fix needed.

## Cluster 2 — Shop + vitrine sheets visual

### Shop icon overhang clip (1 commit)

- **`0ed48e5d`** `fix(shop): unclip card icon overhang so it visibly floats left` — `.shop-item-tile-icon-figure` had `left: -18px` intended to overhang, but the scroll container used `overflow-y-auto` which per CSS spec promotes `overflow-x` from `visible` to `auto`, clipping every overhang at the scroll-box edge. Fix: scroll container bleeds horizontally with `-mx-6 px-6` (moves scroll-box edge to sheet padding-box edge while keeping cards visually aligned via inner padding), AND overhang bumped from `-18px → -24px` so the float reads at ~20% of the icon width.

### Trophies hero extract (1 commit)

- **`507bcb8b`** `fix(trophies-sheet): extract hero band outside scroll so anchor overhangs` — same clip issue at the trofeo-épico anchor (`left: -1.25rem`). Mirror the Badges pattern: hero band rendered as `shrink-0` sibling outside the scroll container; detail sections (My Victories, Achievements, Hall of Fame) stay in scroll.

  Implementation: extracted `TrophiesHeroBand` to a separate exported component in `trophies-body.tsx` with its own lightweight `useMyVictoriesQuick` fetch. Body keeps its own copy (needs the data for My Victories section + achievements grid). Both hit the same cached endpoint so the duplicate is cheap. Added `hideHero` prop to `TrophiesBody` so consumers skip the in-body block.

  Side effect (intentional): hero stays visible as persistent overview header while scrolling. Matches Badges UX.

  Standalone `/trophies` route was left unchanged — sheet is the primary surface; page route is secondary.

### Leaderboard hero extract (1 commit)

- **`257b1b0d`** `fix(leaderboard-sheet): hoist hero band outside scroll for visible overhang` — same root cause, same fix shape. Pure JSX reorder (no data refactor needed since the leaderboard sheet already owns its rows fetch + champion derivation): hero moves to a `shrink-0` sibling outside the scroll div. Verification banner stub, loading skeleton, error state, empty state, and competitors list stay inside scroll.

### Shop cards → vitrine treatment (1 commit)

- **`22489f89`** `style(shop): migrate cards to vitrine panel treatment with per-tone accents` — shop cards previously used dark texture PNGs (bg-pro / bg-founder / bg-shield) + a translucent scrim pseudo to lift white text. One-off treatment that didn't match Badges/Trophies/Leaderboard.

  Migrated to the vitrine recipe (cream-amber gradient + cream inset highlight + soft drop shadow) with per-card accent:

  | Item | Tone | Gradient (light → mid) |
  |---|---|---|
  | Chesscito PRO | `purple` | `#f0e2ff` → `#c8a9ed` |
  | Coach 20-pack | `purple` | (shared) |
  | Founder Badge | `orange` | `#ffe7c8` → `#f7b46a` |
  | Streak Shield | `blue` | `#dde9ff` → `#9fbcec` |
  | Coach 5-pack | `blue` | (shared) |

  Three CSS custom properties (`--shop-tile-accent-{base,mid,border}`) drive the gradient; `[data-tone="..."]` selectors override per tone. New tones are a 3-line patch. Dark `::before` scrim dropped — pastel gradients don't need it. Name + subtitle ink shifted to warm-brown with cream highlight text-shadow, matching the rest of the vitrine family. Featured ribbon + gold halo unchanged.

  `SHOP_TILE_ASSETS[].bg` field kept in the catalog (no longer consumed) — follow-up can remove the bg PNGs from `/art/shop/` and the catalog field once nothing else references them.

## Cluster 3 — Shop oscuridad Phase 1 (1 commit)

- **`792e9a89`** `feat(account): post-purchase inventory rows for shields + founder + coach count` — addresses the "I bought it, where do I see it, how do I use it?" problem. Each SKU now has a row in AccountSheet that shows the count, explains the trigger, and routes to the surface where it activates:

  | Row | When stocked | When not | Tap |
  |---|---|---|---|
  | PRO (existing) | `Active` | `Not active` | Manage PRO |
  | Mi Coach (upgraded) | `{N} credits` or `Active` | `Out of free` | `/coach/history` |
  | **Streak Shields (new)** | `{N} ready` | `None — get some` | `/exercises` |
  | **Founder Badge (new)** | `Owned` | `Not yet` | owned → close · not → Shop |

  New hooks:
  - `useShieldsCount()` — reads `readDisplayedShields()` + subscribes to the existing `chesscito:shields-changed` event bus.
  - `useFounderStatus()` — fetches `/api/founder-status?wallet=...` with a localStorage cache (24h TTL) mirroring `useIsProActive`. Founder ownership is permanent so the cache is aggressive.

## Cluster 4 — Documentation

- **`ceb7c76a`** `docs(product): forward note — Moment NFT expansion roadmap` — captures the intent to expand Victory NFT beyond "complete checkmate win" into a position-specific Moment NFT mintable from any game outcome, once coach motif detection matures. Doc at `docs/product/moment-nft-future-feature-2026-05-30.md`. Decision documented in two layers: doc + project memory `project_moment_nft_roadmap`.

  Key decision: do NOT add a "you'll lose mint chance" warning in the resign flow today — would commit us to a UX promise we'd break when Moment NFT ships.

## State at handoff

- **Tests:** typecheck clean across all commits. Sheet-level tests (shop-sheet 4/4, trophies-sheet 4/4, leaderboard-sheet 4/4, account-coach-row 5/5, game-actions-bar 21/21, use-mint-victory 12/12, coach-game-client 4/4) green. The ~39 pre-existing `window.localStorage.clear` env failures were not introduced by this session and were verified against `main` at session start.
- **Preview deploy:** Vercel fires automatically on each push to main. Latest at commit `792e9a89`.
- **Production:** unchanged from `f54f6fc`. Promote gated on user smoke + VR baselines refresh.

## Outstanding work — deferred ledger

1. **Phase 2 of shop oscuridad — in-context callouts.** Inventory is now visible in AccountSheet; next step is showing the same signal AT THE POINT OF USE:
   - Arena HUD: small `🛡 {N}` chip when shields > 0.
   - Coach Ask CTA: "(uses 1 credit · {N} left)" hint.
   - PRO active surfaces: clearer "PRO active" treatment in coach paywall fallbacks.
   - Founder perks surface — gated on defining what Founder unlocks beyond recognition.

2. **PRO days-remaining.** `useProStatus` doesn't expose `expiresAt` in a friendly format. Would surface in AccountSheet PRO row as "Active · {N} days left". Requires touching `/api/pro/status` payload or computing client-side.

3. **VR baselines bundle.** Cluster C visor states (5 baselines) + the 14-baseline backlog. Blocked by disk pressure per `project_disk_telemetry`. Needs reboot before running `pnpm test:e2e:visual`.

4. **39 pre-existing vitest env failures.** All match `window.localStorage.clear is not a function`. Pre-existing on `main`. Likely `vitest.setup.ts` misalignment. Doesn't block shipping but degrades CI signal.

5. **i18n hygiene pass — `og-cards/*` batch.** Tracked separately in `_bmad-output/implementation-artifacts/deferred-work.md` (entry 2026-05-23). Not in this session's scope.

6. **Persist `playerColor` in GameRecord.** Today the visor derives it from `moves.length` parity (commit `dbaf5b1f`). Reliable while win = checkmate, but adding the field to the persistence write path would remove the implicit assumption and let future non-checkmate wins (if any) mint correctly. Single-cluster task.

7. **Shared trophies data provider.** `TrophiesBody` + `TrophiesHeroBand` each fire `/api/my-victories` independently. Cached endpoint so cheap, but a context provider would dedupe cleanly if profiling shows it.

8. **Trophies standalone page route** (`app/[locale]/trophies/page.tsx`) still has the hero inside its own scroll — same clip risk. Sheet is the primary entry; page route is secondary. Separate small commit if user smoke flags it.

9. **Production promote.** Gated on (3) + a final MiniPay smoke pass over the now-stabilized visor + shop + account surfaces.

## Open questions for next session

- Should the standalone `/trophies` route get the same hero extract treatment so it visually matches the sheet? Today it's left in the deferred list because the sheet is the primary surface.
- The shop card vitrine migration kept `SHOP_TILE_ASSETS[].bg` (no longer consumed). Worth a cleanup commit removing the field + the PNG triplets in `/art/shop/bg-*.png` (24 files total: 3 base × avif/webp/png × 8 references). Or leave for a separate "art prune" pass.
- Does the user prefer the Trophies + Leaderboard hero to stay persistent (current after extract) or scroll with content (the bleed alternative shop got)? Both are valid; current pattern matches Badges. Reversible.

## Pointers for next session

- Memory updates this session: `project_moment_nft_roadmap` (new). Vitrine pattern memory already exists at `project_vitrine_hero_band` — shop is now a sibling member.
- Existing handoff for the previous session: `docs/handoffs/2026-05-29-coach-viewer-cluster-c-handoff.md`.
- Spec for the Moment NFT future feature: `docs/product/moment-nft-future-feature-2026-05-30.md`.
- The preview/prod separation note: `docs/handoffs/2026-05-29-preview-stabilization-and-polish-handoff.md`.

---

Wolfcito 🐾 @akawolfcito
