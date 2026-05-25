# Hub + Arena Polish — Handoff (2026-05-25)

Single long session focused on tightening every visible chip / button /
panel in `/hub` and `/arena`, plus adding the first PRO-aware visual
recognition cue (portal swap). 22 local commits, **not pushed yet** —
deliberate because the user wanted to validate each tweak in local
dev before letting it hit production.

## State of the tree

- **Branch:** `main`, 22 commits ahead of `origin/main`.
- **Range:** `fa5be88a..3bab1d83`.
- **Tests:** 1951/1951 passing.
- **TSC:** clean.
- **VR:** not refreshed during this session. The /hub vr8 baseline was
  refreshed earlier (Coach session), but the Hub HUD layout + arena
  form polish in this session will produce diffs on `hub-clean` /
  `hub-shop-sheet-open` / any arena fixture. Plan: refresh in a
  single batch before push.

## What shipped (in commit order)

| SHA | Subject |
|---|---|
| `fa5be88a` | compact ProSheet — paddings, title, perks list |
| `9a41d7c9` | shrink floating ProSheet header banner — 78% → 62% |
| `9475eca4` | ProSheet "Unlock PRO" CTA — large → medium height |
| `cac5a0c7` | feat(hub): PRO-aware kingdom portal — `useIsProActive` + asset swap + tagline |
| `3bcde5ea` | generate avif + webp for the new hub portals (1.9 MB png → 58 KB avif) |
| `cb324408` | kingdom tagline — lift off frame edge + clear weight contrast |
| `8383c2b9` | kingdom tagline — drop into the scroll band (bottom 9% → 3%) |
| `899c1ffb` | kingdom tagline — widen the column (14% → 8% side insets) |
| `e32181f1` | kingdom tagline — re-center inside the scroll band |
| `5e8c0ac8` | fix(font): load Fredoka regular (400) alongside bold (700) |
| `34d808b3` | kingdom tagline — shrink type so text fits both portal variants |
| `6cf4d6e7` | fix(hub): reduce center-column flash on first paint |
| `5d1d56d4` | fix(a11y): block native selection / save-image on the game shell |
| `deaf7027` | fix(hub): restore .candy-tray-pill border on HUD chips |
| `009c8789` | refactor(arena): reuse HUD chip family for the match timer |
| `2dfc0511` | refactor(arena): reuse HUD chip family on the difficulty selector |
| `cb6febe4` | style(arena): tuck difficulty chip under the VS banner, drop trailing ✓ |
| `ab21d31e` | style(arena): icon-only resign + undo buttons, drop circular bg plates |
| `5d189c6b` | style(arena): trim button shadows + color-toggle as switch + tight footer |
| `1be45380` | style(arena): light "Play as" weight + contiguous ELO ranges |
| `2a569360` | style(arena): drop <strong> from color toggle — uniform light weight |
| `3bab1d83` | fix(arena): restore `?fresh=1` on every entry point that lost it |

## Architecture additions

### `useIsProActive()` hook
`apps/web/src/lib/pro/use-is-pro-active.ts` — single-import boolean
for any UI surface that needs to gate on PRO status. Wraps
`useProStatus(address)` with:
- live expiry recheck (defends against API caching past-expiry rows
  as still-active),
- localStorage write-through (`chesscito:pro-active:<wallet>`) so
  returning PRO users get the right variant on first render, no
  inactive→active flicker,
- lowercase wallet normalization on the cache key.

This is the foundation for any future PRO-recognition swap (board,
pieces, buttons, badge variants, etc.). 8 unit tests cover the hook.

### PRO portal swap
`KingdomAnchor` (in `/hub`) now selects between
`chesscito-normal-portal` and `chesscito-pro-portal` based on
`useIsProActive()`. Both assets share `669:1040` aspect ratio so the
swap doesn't shift surrounding layout. Tagline overlay
("Train your pieces. Master the board. **Then play and win!**")
renders inside the scroll-band of either variant — lead in
`font-weight: 400`, highlight in `700`. Fredoka font config updated
to load both cuts (`weight: ['400', '700']`).

### Hub HUD chip family
The Hub top row was a HudResourceChip-based gold-pill family.
Refactored to `.candy-tray-pill + .hub-hud-pill +
.hub-hud-pill--anchored-left` — cream-amber pill, warm-brown 1px
outline, oversized icon floating off the leading edge with the
chip body squared on the left side so it reads as "the chip
emerges from the icon". Trophy + connect + PRO badge sit in the
right-aligned cluster (`.hub-scaffold-hud-right`). Same chip
family now reused in `/arena` (timer + difficulty selector).

### Selection / save-image global block
`globals.css` body-level: `-webkit-user-select: none`,
`-webkit-touch-callout: none`, `-webkit-tap-highlight-color:
transparent`. All `<img>` get `-webkit-user-drag: none`. Opt-back-in
via `[data-allow-select="true"]` escape hatch and the standard
input / textarea / contenteditable selectors. Clicks unaffected.

### Arena form polish
- **Difficulty cards:** depth shadow trimmed (4px solid drop + 8px
  ambient + inset rim → 2px ambient + inset highlight only). HARD
  pill gets +2px bottom padding so smaller phones don't clip it.
- **Color picker:** 2-column grid of 2 standalone pills → SINGLE
  cream-amber track with the active half as the "thumb"
  (segmented control). "Play as" text dropped to `font-weight:
  400` (matched the score row's lighter register; `<strong>`
  removed).
- **ELO ranges:** contiguous (0-800 / 801-1500 / 1501-2200),
  suffixed with " ELO" so players know what the number is.
- **Resign + Undo:** new carved-art assets
  (`resign-game.png` / `undo-move.png`, ~770/900 KB png → 19/21 KB
  avif). Circular metal plate dropped; icon + label only.
- **Footer:** `.arena-scaffold-footer` gap 12 → 4px, padding-top
  12 → 0. PLAY plank + mission ribbon now read as one tight unit.

### `/arena` entry-point regression
The Hub's ENTER ARENA button + 3 other entries (PRO sheet "Play in
Arena", exercises piece-complete, leaderboard empty-state) had lost
the `?fresh=1` query during the i18n migration. Without it, /arena
auto-resumes the previous match instead of opening the
difficulty + color selector. Restored on all 5 callsites. The
victory-mint recovery path stays bare (`/arena`) on purpose — it's
a mid-game resume target, not a selector entry point.

## Open questions / deferred

1. **VR baselines stale.** `hub-clean`, `hub-shop-sheet-open`,
   `vr8-coach-history-mixed`, and any arena fixture will diff. Plan:
   single `pnpm test:e2e:visual --update-snapshots` pass with manual
   review of each diff before push.

2. **PRO recognition cues — only step 1 of N shipped.** User
   approved Step 1 (portal swap) + Step 2 (was planned for board
   bg). Step 2 / 3 / 4 (board swap, piece variant, button variants)
   are unstarted; revisit when assets are ready.

3. **Reanalyze discovery panel copy.** Currently English only with
   ES override; if more locales come online the panel body string
   ("Coach analyses are best-effort. Generate a fresh one if this
   didn't quite hit, or to read it in your current language.")
   needs translation review.

4. **/arena bare entry point.** Decided to keep `?fresh=1` as the
   opt-into-selector token rather than flip the default. If the
   product later wants every arena visit to land on the selector
   (and the resume flow becomes a separate explicit "Resume"
   button), the bare `/arena` URL becomes the new selector and the
   query token can retire.

## Next steps (when you come back)

1. Run `pnpm test:e2e:visual` from `apps/web/`, accept the diffs
   that match the changes above, push the baseline updates as a
   single `test(vr)` commit alongside the feature push.

2. `git push origin main` — pushes all 22 commits.

3. MiniPay smoke checklist (~3 min):
   - `/hub`: trophy + PRO badge in top corners, portal art reads
     correctly, tagline overlay sits inside the scroll band,
     no long-press selection.
   - Tap ENTER ARENA → lands on the selector (not auto-resume).
   - Select Easy + White, play 2 moves, tap difficulty chip under
     VS → returns to selector.
   - Resign → flow works, no circular plate.
   - PRO: become PRO in a test wallet, /hub portal swaps to the
     premium variant on next mount (or earlier via cache).

## Files touched (high-density)

```
apps/web/src/app/[locale]/arena/page.tsx
apps/web/src/app/[locale]/coach/history/page.tsx        (earlier)
apps/web/src/app/globals.css                            (~10 commits)
apps/web/src/app/[locale]/layout.tsx                    (font weights)
apps/web/src/components/arena/arena-action-bar.tsx
apps/web/src/components/arena/arena-hud.tsx
apps/web/src/components/arena/arena-select-scaffold.tsx
apps/web/src/components/exercises/exercises-screen.tsx
apps/web/src/components/exercises/leaderboard-sheet.tsx
apps/web/src/components/hub/hub-scaffold-client.tsx
apps/web/src/components/hub/hub-scaffold.tsx
apps/web/src/components/hub/hub-pro-badge.tsx           (new)
apps/web/src/components/kingdom/kingdom-anchor.tsx
apps/web/src/components/pro/pro-active-cta.tsx
apps/web/src/components/pro/pro-sheet.tsx
apps/web/src/lib/content/editorial.ts
apps/web/src/lib/content/messages/es.ts
apps/web/src/lib/pro/use-is-pro-active.ts               (new)
apps/web/public/art/new-assets-chesscito/hub/*          (6 new files)
apps/web/public/art/new-assets-chesscito/arena/*        (6 new files)
+ ~10 test files updated for the URL / asset / aria changes
```

Range delta: ~700 net lines added (mostly CSS + new components +
tests), ~250 dead CSS / legacy paths retired.
