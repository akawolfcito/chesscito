# Red Team — Visual Audit 2026-04-21

**Scope:** Every user-facing surface captured at iPhone 13 viewport (390×844 @3x) against production (https://chesscito.vercel.app).
**Focus flagged by user:** *"zonas oscuras que pierden la parte de candy que se esperaba"* — screens where flat dark backgrounds break the candy-game aesthetic established on the hub and arena.
**Captures:** `/tmp/red-team-visual/01..14.png` (14 screens).

---

## Executive summary

The candy aesthetic is **present and strong on the hub and arena** (grass forest bg, amber/teal frames, chunky shadows). It is **absent or half-applied on every other surface**. We have three distinct "visual regions" in production today:

| Region | Screens | Look |
|---|---|---|
| **Candy (✓)** | hub, mission-detail, arena, badge-sheet (top) | Forest grass, amber frames, candy peek cards |
| **Mixed fade** | shop-sheet, leaderboard-sheet | Candy header → dark slate fade (patchy) |
| **Flat dark** | piece-picker, exercise-drawer, trophies, about, support, privacy, terms, victory share card | Slate-950 w/ no candy cues |

The **flat dark region is the root of the user's concern**. It affects 8 of 14 captured surfaces — more than half of the app when users leave the hub.

**Top 3 fixes** (highest candy-aesthetic uplift, lowest risk):

1. **Apply a unified candy scrim to the 4 legal-family routes + Trophy Case** (currently 100% flat dark).
2. **Reinstate per-sheet candy tints** on piece-picker + exercise-drawer + shop + leaderboard (the `sheet-bg-*` classes exist but aren't reading correctly in prod).
3. **Frame the Victory share card** with `.candy-frame` instead of raw dark slab.

---

## Findings by severity

### P0 — Dark zones violating candy aesthetic (user-flagged)

#### P0-1. Trophy Case (`/trophies`) is 100% flat dark
- **Capture:** `09-trophies.png`
- **Problem:** The entire viewport after the header is `bg-slate-950`. All 7 achievement cards are dark-on-dark with near-zero contrast. This is supposed to be a **celebration surface** — instead it reads as a settings page.
- **Expected:** Trophy Case should feel like a hall of fame — warm amber accents, frosted candy cards with gold borders on unlocked states.
- **Repro:** navigate to `/trophies` (from dock or hub).
- **Fix:** apply `.secondary-page-scrim` **plus** a candy amber top-glow (`radial-gradient` at ~20% vertical, amber @ 0.08 opacity). Achievement cards should adopt `.candy-frame` skeleton (locked = muted, unlocked = full amber glow).

#### P0-2. Legal routes (`/about`, `/support`, `/privacy`, `/terms`) are 100% flat dark
- **Captures:** `10-about.png`, `11-support.png`, `12-privacy.png`, `13-terms.png`
- **Problem:** These 4 screens share a `LegalPageShell` but render as pure dark with only cyan headings. No candy cue, no forest tie-back. Stepping out of the hub feels like entering a different app.
- **Expected:** A subtle candy undertone that says "you're still in Chesscito" — forest palette at low opacity, or a single ambient grass sprite at bottom-right.
- **Fix:** strengthen `.secondary-page-scrim` to include a low-opacity green radial (sample the hub forest color) at the bottom corners. Adopt `.candy-frame` on list items / contact chips.

#### P0-3. Victory share card (`/victory/[id]`) is a black slab on candy grass
- **Capture:** `14-victory-1.png`
- **Problem:** The grass background is candy (✓), but the centered share card is **pure `bg-slate-900`** with no frame, no amber accent. On a candy grass bg this reads as a hole, not a trophy.
- **Expected:** The card is the hero — should use `.candy-frame` + amber glow, trophy icon on a warm spotlight.
- **Secondary:** "Accept Challenge" CTA is cyan — clashes with the amber "Can you beat this?" prompt directly above. Pick one warm-path color (recommended amber to match the trophy).
- **Fix:** wrap card in `.candy-frame` with amber border; switch CTA to amber gradient; add subtle spotlight behind trophy icon.

---

### P1 — Half-applied candy on destination sheets

#### P1-1. Piece picker (bottom sheet) — flat dark
- **Capture:** `02-hub-piece-picker.png`
- **Problem:** Sheet background is flat `bg-slate-900`. The hub above it is candy grass. The transition is jarring.
- **Secondary:** Queen/King "SOON" micro-copy is amber on dark with very low contrast (< 3:1). Unreadable at a glance.
- **Fix:** apply the same green-tinted candy scrim used in the badge-sheet top band (`sheet-bg-hub` or equivalent). Bump SOON text to amber-300 + 0.75 opacity min.

#### P1-2. Exercise drawer — flat dark
- **Capture:** `03-hub-exercise-drawer.png`
- **Problem:** Same as P1-1. Flat dark sheet over candy grass. Cards inside are flat rects with no candy frame.
- **Fix:** same candy scrim; exercise rows should adopt a subtle `.candy-frame` skeleton with amber/teal edge on the active (unlocked) row.

#### P1-3. Shop sheet — patchy dark-emerald fade
- **Capture:** `06-hub-shop-sheet.png`
- **Problem:** Top "Arcane Store" title is green-on-green (hard to read), "Featured" pill feels orphaned, and below the single product card the sheet fades to slate-800 for 60% of the height. Title is also almost clipped against top edge.
- **Fix:** Give the shop its own strong candy identity (emerald is fine but should be saturated + chunky frame, not a pale fade). Ensure `pt-[env(safe-area-inset-top)]` on the sheet header so title never clips. Add a "more items soon" amber tile so the empty 60% isn't wasted.

#### P1-4. Leaderboard sheet — dark fade with single row
- **Capture:** `07-hub-leaderboard-sheet.png`
- **Problem:** Header works (green), but below the single "0xcc41…c2dd · 3000" row the rest of the sheet is dark-green fade w/ nothing. Feels empty and unfinished.
- **Secondary:** Cyan "Get verified" underline link is the only warm element and it's buried in small copy.
- **Fix:** Add an empty-state candy card ("Be the next one on the board"), promote Get Verified CTA to a proper candy button with icon.

#### P1-5. Badge sheet — closest to right, but still half-committed
- **Capture:** `05-hub-badge-sheet.png`
- **Problem:** Top band = candy grass (✓). Bottom 60% = dark-to-slate fade with 6 locked badges on flat dark rows. The "View your Victories" CTA has a nice amber frame (✓).
- **Fix:** extend the candy scrim to full sheet height; each badge row should carry a subtle `.candy-frame`.

---

### P2 — Polish on candy surfaces

#### P2-1. Arena pill "EASY · TAP TO CHANGE"
- **Capture:** `08-arena-auto-launch.png`
- **Problem:** The pill floats in empty grass with no chip/frame background. Text is cream over green — readable but low punch.
- **Fix:** Add a thin translucent amber chip background (`rounded-full bg-amber-400/15 ring-1 ring-amber-300/40 px-3 py-1`). It becomes a discoverable pill, not floating text.

#### P2-2. Arena VS card (top)
- **Capture:** `08-arena-auto-launch.png`
- **Problem:** The avatar pair + "VS" looks cool, but the left avatar sits on a wood-barrel sprite and the right avatar on a violet-stone sprite — asymmetric, the right one reads as "enemy" while left reads "good guy". Intentional? If so, the left should get a stronger gold glow to signal "you are here".
- **Fix:** Add amber glow ring behind the player avatar to clearly signal "you".

#### P2-3. Hub HUD chips at top corners
- **Capture:** `01-hub.png`
- Left chip "ROOK ▼" and right chip "★ 0/15" — both use dark-slate pill on candy grass. Works, but they're the **only dark elements on the hub**. Consider a warmer tint (amber stars count, teal piece selector) for stronger cohesion with the candy frame around the board.

#### P2-4. Persistent dock frame
- **Captures:** all hub screens
- The 5-item dock reads as stone panels — good candy feel. Two nits:
  - "ARENA" label under the sword is cream; "LEADERS" is gold. Inconsistent typography color.
  - Active indicator (lift + label) works well, but invite icon (rightmost) has a slightly different icon weight than the rest. Verify SVG stroke consistency.

---

## Verified OK

- **Hub (`/`)** — candy grass, clear HUD, readable piece selector. ✓
- **Mission detail** — forest + candy board, "Move to: h1" banner reads well. ✓
- **Arena (post-launch)** — full candy, piece tint by color, readable ranks. ✓
- **Onboarding auto-skip** — no blocker when `chesscito:onboarded` set. ✓

---

## Summary

- Flows audited: **14**
- P0 candy-violations: **3** (Trophy Case, 4 legal routes, Victory share card)
- P1 half-applied candy: **5** (piece-picker, exercise-drawer, shop, leaderboard, badge sheet)
- P2 polish: **4**
- Verified OK: **4**

**Pattern:** candy aesthetic is gated on the hub/arena. Every other surface defaults to flat dark slate. A single `sheet-bg-candy` + `.secondary-page-scrim-candy` class pair, applied consistently, would close ~80% of these findings in one pass.

---

## Proposed fix pass (single PR, ordered by impact)

1. **`globals.css`** — strengthen `.secondary-page-scrim` with green+amber radials so legal routes + trophies inherit candy feel without per-page work.
2. **`trophy-case/page.tsx`** — wrap cards in `.candy-frame`, add amber top-glow.
3. **`victory/[id]/page.tsx`** — frame hero card with `.candy-frame`, align CTA to amber, add trophy spotlight.
4. **Sheet components** (`piece-picker`, `exercise-drawer`, `shop`, `leaderboard`, `badge`) — add `sheet-bg-candy` utility (green scrim w/ per-sheet accent: amber/emerald/cyan/violet).
5. **Arena pill** — wrap in amber chip.

Estimated scope: ~6–8 files, no new components, all additive CSS.
