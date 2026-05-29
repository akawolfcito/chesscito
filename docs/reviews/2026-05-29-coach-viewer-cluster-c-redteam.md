# Red-team — Cluster C Implementation Plan

**Date:** 2026-05-29 · **Author:** Sally (UX) wearing the red hat
**Target:** 5-commit implementation plan for `/coach/[gameId]` Cluster C polish.
**Spec under review:** `_bmad-output/planning-artifacts/coach-viewer-cluster-c-spec-2026-05-29.md`.

Findings ranked P0 (must fix before commit 1) / P1 (fix during cluster) / P2 (nice-to-have / post-ship).

---

## P0 — must fix before starting

### P0-1. The "no wallet" state never reaches the new actions bar

Current `coach-game-client.tsx:139-152` early-returns the connect-prompt toast **before** rendering `<GameViewer>` or `<GameActionsBar>`. The spec §3.1 entry `win + !claimed + no wallet → "Connect wallet to save"` is **unreachable** with today's branching.

**Risk if ignored:** commit 3 ships state-handling code that never runs. Cluster shippable but spec-incoherent.

**Resolution before commit 1:** decide one of two paths and write it into the spec:
- (a) Keep the bail — drop the "no wallet" entry from §3.1; the toast is the entire surface.
- (b) Render the visor read-only with the toast on top — change the branching to render `<GameViewer>` always, gate only `<GameActionsBar>` primary.

Recommendation: (a). The toast already handles the connect flow; layering the full visor under it dilutes both. Spec §5.3 should be rewritten accordingly.

### P0-2. `BoardThumbnail size={358}` overflows on <390px viewports

`BoardThumbnail` has `flex-shrink: 0` + fixed pixel width/height. On a 375px iPhone SE viewport (still a real MiniPay device), `358 + 32px container padding = 390px` → horizontal overflow + scroll. The spec hand-waves "viewport_width − 32".

**Risk if ignored:** broken layout on small-MiniPay devices. We have no telemetry on viewport distribution.

**Resolution:** either (a) make `BoardThumbnail` accept `size="100%"` and an aspect-ratio container parent, (b) compute size in JS via `useEffect`/`useState` from `window.innerWidth`, or (c) drop `BoardThumbnail` here and adapt the arena-board pattern (already responsive).

Recommendation: (a) — extend `BoardThumbnail` to accept `size: number | string`, parent owns the square aspect-ratio. One extra ~15 LOC change to BoardThumbnail. Commit 1 territory.

### P0-3. `object-fit: fill` distortion compounds at hero scale

`BoardThumbnail` uses `objectFit: "fill"` (line 81) — intentional for thumbnail scale because `cellCenter()` percentages are calibrated against the filled box. At 56px the distortion is invisible. At 358px the board image will be visibly stretched (the source is 1024×1024 but the cell calibration drifts).

**Risk if ignored:** pieces drift visually off-square at hero scale; the board looks "off" without anyone being able to articulate why.

**Resolution:** measure first. Render at 358px in `/dev/` route, eyeball against arena-board on the same viewport. If drift is visible, switch hero-scale rendering to the arena-board geometry directly (which has the same `cellCenter` insets but a different image-fit strategy). This is a 30-min spike, not a blocker, but it determines whether commit 1 is "1 day" or "1.5 days".

### P0-4. Commit 3 violates the granular-commits hard rule

"State-driven CTA hierarchy" with 8 states + sprite primary + trophy ribbon + tertiary links in **one commit** is a bulk change. The MEMORY rule is one logical change per commit.

**Resolution:** split commit 3 into 3 commits:
- **3a.** `feat(coach-viewer): rewrite GameActionsBar as state-driven stack` — structure + non-mint states.
- **3b.** `feat(coach-viewer): primary CTA sprite + price for Save Victory`.
- **3c.** `feat(coach-viewer): trophy ribbon + tertiary Celoscan/Hub links`.

Plan moves from 5 → 7 commits. Same time budget, granular history.

---

## P1 — fix during cluster

### P1-1. Coach analysis CTAs duplicate the new actions bar

`CoachPanel` and `CoachFallback` already render their own `onPlayAgain` + `onBackToHub` buttons (called from `coach-game-client.tsx:191-208`). Spec §5.5 says analysis appears "below the move list" — but it brings its own CTAs that will sit ~200px below the new actions bar showing the same options.

**Resolution:** add an `embedded?: boolean` prop to `CoachPanel`/`CoachFallback`. When `embedded`, hide internal CTAs (parent already provides them). Wire from `coach-game-client.tsx`.

**Cost:** ~20 LOC touching 3 files. Lives in a sub-step of commit 1 or its own commit 1b.

### P1-2. Ply counter "4/8" is ambiguous when replay errored mid-game

`useGameReplay` exposes `currentIndex`, `lastValidIndex`, and `error.atIndex`. When the engine couldn't replay move N, `lastValidIndex < moves.length`. What does "8" mean in the counter — total submitted moves or last replayable? The spec doesn't say.

**Resolution:** counter shows `{currentIndex} / {lastValidIndex}` and only shows total submitted in the error banner below ("Replay stopped at move N…"). The user sees the truth in two places, no mixed semantics.

**Cost:** trivial. Bake into commit 2.

### P1-3. Trophy `#tokenId` ribbon width

`#1234` fits. `#9999999` (after a year of mints) doesn't fit in the small corner ribbon. The ribbon is anchored absolute over the board top-right corner — overflow will spill into the board frame.

**Resolution:** ribbon `max-width: 30%` of board, `text-overflow: ellipsis`, or use a different anchor strategy (e.g., a chip below the header band instead of overlaying the board). For v1 the ribbon is fine — chesscito won't hit 7-digit token IDs in the next 18 months. Capture as P2 instead and revisit at 100k mints.

### P1-4. Price formatting + locale

`VICTORY_PRICES[1] = 5_000n` (USD6 decimals). The spec says display `"$0.005"`. Hard-coding "$" + manual decimal slicing works but breaks ES locale conventions (`"$0,005"`). The app has `next-intl` — we should use `formatNumber` with a currency formatter, OR add a tiny helper `formatVictoryPrice(difficulty, locale)` to `lib/format/`.

**Resolution:** small helper in `lib/format/price.ts`, accepts difficulty + locale, returns formatted string. One unit test (3 difficulties × 2 locales = 6 cases). Bake into commit 3b.

### P1-5. VR baselines vs disk pressure blocker

Commit 5 generates VR baselines. Per `deferred-work.md` `2026-05-29 — VR baseline refresh`, the full VR suite is blocked by disk pressure (`<30GB free + swap >2GB`). This cluster will likely add **more** baselines while the existing 14 are still unrefreshed.

**Resolution:** explicit decision in the plan. Either:
- (a) Cluster C ships commits 1–4 + telemetry without VR baselines; the entire VR refresh becomes one separate post-reboot session covering Cluster C's 4 baselines + the 14 already deferred.
- (b) Cluster C waits on the disk reboot before commit 5.

Recommendation: (a). Decoupling unblocks shipping and bundles all VR work efficiently. Spec §11 should be updated; deferred ledger gets a `+4 baselines from Cluster C` line.

### P1-6. `coach_viewer_viewed` event fires before first interaction

Spec §8 defines `coach_viewer_viewed` on "route mount (after first paint)". If the player taps back before paint settles (sub-100ms), the event still fires. This is mostly fine, but: it should fire **after** `gameRecord` exists and `walletAddress` is connected, otherwise the "view" event count diverges from the "actually saw the visor" count.

**Resolution:** fire `coach_viewer_viewed` from a `useEffect` gated on `gameRecord && walletAddress`. One line of care. Bake into commit 5.

### P1-7. Move-list expand animation budget

A `max-height: 0 → 240px` CSS transition is the canonical reveal but it triggers reflow + paint of the entire actions stack below. On low-end MiniPay Android (a real target), this stutters.

**Resolution:** `prefers-reduced-motion` short-circuits the transition to instant. Open/close uses `transform: scaleY` over `max-height` where possible, or accepts the trade-off if the move-list expansion is the only animated reveal on the page (low contention).

**Cost:** ~5 lines of CSS. Bake into commit 2.

---

## P2 — post-ship / next-iteration

### P2-1. Hero board doesn't reflect player perspective

Spec §10 already defers this (`perspective="w"` for v1). Real risk surfaces when a player who plays as black reviews their match — pieces on rank 1/2 look like the opponent's pieces. The mental model breaks for ~50% of games at large scale (today probably <10% because most players default white). Tracked.

### P2-2. Move list 2-column grid + tap-to-jump on mobile thumb reach

Two-column grid on 390px viewport means each column is ~165px wide. The right column lives in thumb-stretch territory (right-handed). For frequent move-jumping this is fine; for the rare power user it's friction. Capture; revisit if `coach_viewer_move_jump` event volume justifies a one-column-on-very-small-screens variant.

### P2-3. No "share board snapshot" without minting

A win + !claimed player who wants to brag has no share path today (the share CTA only appears post-mint). Capture; this is its own feature (share-without-NFT) and adds friction to the mint path if shipped poorly. Out of Cluster C scope.

### P2-4. Loss/draw "Ask Coach" disabled on too-short games is opaque

When `coachDisabled = hasPartialReplayError || isTooShort`, the button just looks dead. No microcopy explains why. Capture; add a tooltip or helper text in a follow-up polish pass (probably bundled with the VR refresh session).

### P2-5. No skeleton state during SSR → hydration window

The visor SSR-renders from Redis directly (post `09a02878`), so the gap is small. But `useCoachAnalysis` + `useMintVictory` hooks initialize client-side and there's a sub-100ms gap where the actions bar could flash a non-final CTA state. Hydration-stable, low risk, capture.

### P2-6. Coach analysis collapse/persist

Once the analysis surface lives below the move list, it's a long scroll for a player who already read it. A small "Collapse analysis" affordance at the top of `CoachPanel` is a future polish — relates to user agency on the screen.

---

## Revised cluster shape (after red-team)

Original: 5 commits. Revised: **7 commits + 1 spec patch + 1 spike**, same time budget, sharper history.

```
[spike, ~30min] Render BoardThumbnail at 358px in /dev/coach-viewer-hero/
                — eyeball drift vs arena-board. Output: GO (use thumbnail) or
                PIVOT (use arena-board geometry). Affects commit 1 scope.

[spec patch]    Rewrite §5.3 to reflect P0-1 decision (a) — toast is the
                only surface when !walletAddress. Drop the !walletAddress
                row from §3.1 state matrix.

[commit 1]   feat(coach-viewer): board hero + header band + CSS foundation
             — BoardThumbnail size→responsive (P0-2)
             — /* COACH VIEWER */ block in globals.css
             — header band with back + title + meta chip
             — CoachPanel/CoachFallback embedded prop (P1-1)

[commit 2]   feat(coach-viewer): replay controls + collapsible move list
             — slider/arrows in .hub-hud-pill shape
             — ply counter "{currentIndex} / {lastValidIndex}" (P1-2)
             — collapsed pill → 2-col grid scroll (P1-7 reduced motion)

[commit 3a]  feat(coach-viewer): rewrite GameActionsBar as state-driven stack
             — non-mint states (loss / draw / resigned / too-short / errored)

[commit 3b]  feat(coach-viewer): primary CTA sprite + Save Victory price
             — .cta-principal sprite
             — formatVictoryPrice helper + 6 unit tests (P1-4)

[commit 3c]  feat(coach-viewer): trophy ribbon + tertiary Celoscan/Hub links
             — ribbon over board corner
             — text-link tertiaries

[commit 4]   feat(coach-viewer): copy + i18n keys
             — extend COACH_VIEWER_COPY with 9 keys (EN + ES)
             — verify no em-dashes (anti-AI-prose)

[commit 5]   feat(coach-viewer): telemetry events
             — 7 new track() calls
             — coach_viewer_viewed gated on gameRecord && walletAddress (P1-6)

[separate session, post-reboot]
[commit 6]   test(vr): refresh coach-viewer + deferred backlog baselines
             — 4 Cluster C baselines
             — bundle 14 deferred from #119 + Cluster B
```

Estimated effort revised: **1 spike (~30min) + 7 commits (~1.5 days code) + 0 days VR (deferred to bundled session)**. Net: same shipping date for Cluster C, cleaner separation.

---

## Open question for next decision

The spike result (P0-3) determines whether commit 1 is straightforward or includes a board-rendering pivot. We should run the spike **before** declaring commit 1's effort. ~30 minutes.

**Recommendation:** run the spike inline in this session as the very first action, then either start commit 1 with the GO path, or huddle on the PIVOT path before touching code.

---

*End of red-team. Awaiting Wolfcito decision on: (1) accept revised 7-commit shape, (2) run spike now or skip-and-trust.*
