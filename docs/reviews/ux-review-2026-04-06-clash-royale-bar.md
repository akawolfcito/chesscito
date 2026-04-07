# UX Review — Clash Royale Quality Bar Audit (2026-04-06)

4 parallel agents audited all screens, overlays, design system, and flows.
Benchmark: Clash Royale polish level on a 390px MiniPay viewport.

---

## Critical (10)

### Arena
| # | File | Finding |
|---|------|---------|
| C1 | `arena-board.tsx` | **Pieces teleport** — key is `color-type-square` so React unmounts/remounts on every move. CSS transition exists but is dead. One-line key fix unlocks animation. |
| C2 | `arena-end-state.tsx` | **Checkmate ends silently** — no pause, no king flash, no sound. Board freezes and card slides up. |
| C3 | `globals.css:460` | **Confetti burst keyframe defined but never wired** — victory is flat, sparkles at 18% opacity only. |
| C4 | `use-chess-game.ts:131` | **AI engine catch doesn't set error** — if engine fails, board unlocks silently in broken state. |
| C5 | `victory-claiming.tsx` | **claimStep always "signing"** — parent never updates prop. Progress dots are decorative during 30s mint tx. |

### Play Hub
| # | File | Finding |
|---|------|---------|
| C6 | `purchase-confirm-sheet.tsx:74` | **No spinner during blockchain approve+buy** — button text changes but no animated indicator during 10-30s wait. |
| C7 | `badge-sheet.tsx:117` | **No spinner on claim badge button** — `isClaimBusy` text swap with no visual loading indicator. |
| C8 | `leaderboard-sheet.tsx:148` | **Plain text "Loading..."** — no skeleton rows or shimmer. Below mobile game standard. |

### Secondary
| # | File | Finding |
|---|------|---------|
| C9 | `trophy-card.tsx:8` | **Difficulty labels bypass editorial.ts** — hardcoded "Easy"/"Medium"/"Hard" inline, duplicate source of truth. |
| C10 | `trophies/page.tsx:191` | **"Connect Wallet" label hardcoded** — adjacent copy uses editorial.ts but this one doesn't. |

---

## Major (30)

### Animation & Feedback Gaps
| # | File | Finding |
|---|------|---------|
| M1 | `arena-hud.tsx:100` | AI thinking is a tiny 20x32px amber text — no board-level lockout visual |
| M2 | `arena-end-state.tsx:134` | Lose title has no entrance animation (win has `victory-text-slam`) |
| M3 | `arena/page.tsx:500` | Preparing state is bare spinner — no difficulty label, no excitement build |
| M4 | `arena/page.tsx:497` | Difficulty selector → game board is a jarring DOM swap, no exit animation |
| M5 | `use-chess-game.ts` | No haptic feedback on moves/captures/checkmate (WebView supports `vibrate`) |
| M6 | `globals.css:944` | Check state only highlights cell — no pulsing, no HUD "Check!" banner |
| M7 | `page.tsx:1024` | Toast has no exit animation — vanishes instantly on unmount |
| M8 | `exercise-drawer.tsx:87` | Exercise rows appear instantly — no staggered entrance animation |

### Design System Violations
| # | File | Finding |
|---|------|---------|
| M9 | `victory-celebration.tsx:87` | Claim CTA is raw `<button>`, not `Button` component — breaks design system |
| M10 | `exercise-drawer.tsx:69` | Raw `rgba()` in trigger button style, not CSS vars |
| M11 | `globals.css:939` | Hardcoded hex for `is-last-move` and `is-check` — not design tokens |
| M12 | `difficulty-selector.tsx:24` | Selector uses `--surface-b-plus` while victory uses `panel-showcase` — visual mismatch |
| M13 | `button.tsx` | **10+ distinct button styles**, 5 rogue inline styles bypass component. Need consolidation. |
| M14 | — | **No semantic type scale tokens** — sizes scatter from `text-[7px]` to `text-3xl` as raw classes |
| M15 | — | **9+ ad-hoc animation durations** — no `--duration-snap/enter/ceremony` tokens |

### Content & Copy
| # | File | Finding |
|---|------|---------|
| M16 | `page.tsx:963` | "Piece Unlocked!" copy assembled inline, not in editorial.ts |
| M17 | `page.tsx:965` | `TUTORIAL_COPY` used as unlock celebration body — wrong register |
| M18 | `page.tsx:54` | Shop item label/subtitle hardcoded, not in editorial.ts |
| M19 | `support/page.tsx:14` | 3 section headings hardcoded, not in editorial.ts |
| M20 | `invite-link.tsx:34` | "Copied!" hardcoded + no confirmation animation |
| M21 | `status-strip.tsx` | "Chain: 42220" and "Status: Wallet not connected" — debug copy, not game language |

### Progression & Trophies
| # | File | Finding |
|---|------|---------|
| M22 | `trophy-card.tsx` | Cards feel like data rows — no difficulty-based visual weight, no glow for wins |
| M23 | `trophies/page.tsx:216` | HoF and My Victories use same icon/heading — no visual hierarchy |
| M24 | `trophies/page.tsx:205` | Empty-state CTA is a text link, not a button |
| M25 | `trophy-card.tsx:79` | Rank 1/2/3 have no gold/silver/bronze color distinction |
| M26 | `trophies/page.tsx:235` | Roadmap banner shown to disconnected users — premature upsell |

### Flow Issues
| # | File | Finding |
|---|------|---------|
| M27 | `arena/page.tsx:663` | Coach paywall `onBuy` is a TODO — dead-end user flow |
| M28 | `arena-end-state.tsx:116` | Lose panel shows no stats (moves/time/difficulty) — asymmetric vs win |
| M29 | `victory/[id]/page.tsx` | Victory share page fully static — no animation, no `loading.tsx` |
| M30 | `badge-sheet.tsx:54` | All 6 claim buttons disabled when claiming 1 — no per-badge loading |

### Missing Systems
| # | Area | Finding |
|---|------|---------|
| M31 | Sound | **Zero sound effects anywhere** — no AudioContext, no Howler, nothing |
| M32 | Routes | **No page transitions** — route changes are instant DOM swaps |
| M33 | Board | **No invalid-move feedback** — tapping wrong cell = nothing happens, zero shake/pulse |

---

## Minor (19)

| # | File | Finding |
|---|------|---------|
| m1 | `result-overlay.tsx:240` | `autoFocus` fires before button is visible (opacity:0 animation delay) |
| m2 | `result-overlay.tsx:82` | Unearned stars use filled ★ dimmed, not outline ☆ |
| m3 | `badge-sheet.tsx:151` | Progress bar flashes from 0% on sheet open |
| m4 | `purchase-confirm-sheet.tsx:49` | Confirm sheet is prose paragraphs, not visual receipt |
| m5 | `exercise-drawer.tsx:155` | Badge threshold marker 1px/50% opacity — barely visible |
| m6 | `shop-sheet.tsx:62` | `text-[8px]` "Featured" label below legible threshold |
| m7 | `shop-sheet.tsx:60` | Shop items have no art/images — text-only blocks |
| m8 | `promotion-overlay.tsx:49` | Piece images use `<img>` not `<picture>` — no AVIF/WebP |
| m9 | `stat-card.tsx:7` | Emoji icons (⚔♟⏱) render inconsistently across Android |
| m10 | `victory/[id]/page.tsx:10` | `formatTime` duplicated from `arena-utils.ts` |
| m11 | `trophy-card.tsx:86` | Raw `0.65rem`/`0.6rem` values below token scale |
| m12 | `trophy-card.tsx:49` | Unknown difficulty silently falls back to Easy |
| m13 | `trophy-list.tsx:6` | Fixed 3 skeleton cards regardless of expected list size |
| m14 | `legal-page-shell.tsx:33` | h1 font-weight/size differs from trophies header |
| m15 | `trophies/page.tsx:177` | `opacity-35` non-standard + inline raw color |
| m16 | `editorial.ts` | Version string not bound to env/package.json |
| m17 | `support/page.tsx` | mailto: broken when env var missing |
| m18 | `trophy-list.tsx:50` | "Tap to retry" hardcoded, not in editorial.ts |
| m19 | `badge-sheet.tsx:184` | Trigger button has no explicit size, may clip ping dot |

---

## Systemic Gaps vs Clash Royale

### 1. Sound & Haptics — ZERO
No audio, no vibration. CR plays sound on EVERY tap. Minimum viable:
- Board tap (click), valid move (whoosh), invalid move (buzz), success (chime), failure (descend), badge claim (fanfare)
- `navigator.vibrate()` for Android: `[8]` on tap, `[4,30,4]` on invalid, `[15,50,80]` on success

### 2. Motion Vocabulary — Ad-hoc
9+ durations, 4+ easings, no tokens. Need 3 tiers:
- `--duration-snap: 120ms` (button press)
- `--duration-enter: 300ms` (panels, overlays)
- `--duration-ceremony: 500ms` (rewards, celebrations)
- `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`

### 3. Route Transitions — None
Instant DOM swaps between pages. Even a 200ms fade would be +100% quality.

### 4. Invalid Move Feedback — None
Most common interaction in the game has zero feedback. Need ~180ms horizontal shake on piece.

### 5. Button Consolidation — 10+ Styles
5 rogue inline button styles bypass `button.tsx`. Need hard rule: `game-cta-depth` + CTA tokens only.

### 6. Reward Copy — Flat
"Score Recorded!" / "Great work!" is kindergarten praise. Need skill-celebrating language: "Sealed on Celo — no one can take this from you."

---

## Summary

| Category | Count |
|----------|-------|
| **Critical** | 10 |
| **Major** | 33 |
| **Minor** | 19 |
| **Total** | 62 |

### Quick Wins (highest impact, lowest effort)
1. **C1 piece key fix** — one-line change, unlocks existing CSS transitions
2. **M33 invalid move shake** — new `@keyframes`, 5 lines CSS + 2 lines JS
3. **C5 claimStep wiring** — wire approve→"confirming", receipt→"done" in handleClaimVictory
4. **M28 lose panel stats** — add same 3 StatCards to lose branch
5. **C3 confetti burst** — keyframe exists, just wire CSS class to victory overlay
6. **M25 rank colors** — 3 lines CSS for gold/silver/bronze on rank number
