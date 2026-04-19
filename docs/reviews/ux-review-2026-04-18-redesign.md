# UX Review — 2026-04-18 (Post-CandyIcon Migration + Direction A Play-Hub Redesign)

Adversarial UI/UX consistency audit covering the entire app after the recent sprite refresh, CandyIcon system rollout, Direction A play-hub layout, and dock cleanup.

**Audited surfaces**: arena (board, hud, action bar, end states, claim flow), play-hub (mission panel, piece picker sheet, mission detail sheet, exercise drawer, dock, contextual action), badge / shop / leaderboard sheets, mission briefing, result overlay, coach panels (welcome, panel, fallback, paywall, loading, history, ask button), trophies (page, card, list), about, support, legal pages, victory page, global styles + tokens.

**Severity**:
- **P0** — broken / unusable / blocks the user
- **P1** — visible inconsistency, bad first impression, accessibility floor breached
- **P2** — polish, dead code, token debt

---

## P0 — Critical (must fix)

### Layout / breaking states
- [ ] **shop-sheet.tsx:56** — `grid-cols-1 sm:grid-cols-3` with `gap-3` reaches ~376px min content width at sm breakpoint, dangerously close to 390px viewport. **Fix**: lock to `grid-cols-1` on mobile or guard the sm breakpoint behind a 480px+ media query.
- [ ] **globals.css:1232** (`.chesscito-dock`) — `background-size: 100% 100%` on `menu-wall.png` distorts on non-square containers. **Fix**: switch to `background-size: cover` + `background-position: bottom center` for letterbox-safe rendering.
- [ ] **globals.css:1289-1290** (`.chesscito-dock-center.is-active`) — only color (0.55→0.9) + `scale(1.04)` for active state. After removing the wrapper bg/border, the route-aware signal is borderline invisible. **Fix**: add a glow/dot/underline pseudo-element to clarify "you are on /arena".

### Hardcoded copy (editorial.ts contract)
- [ ] **mission-briefing.tsx:28** — Hardcoded `Move your ${pieceName} to ${targetLabel}`. **Fix**: add `MISSION_BRIEFING_COPY.targetSentence(piece, target)` to editorial.ts.
- [ ] **coach-history.tsx:46** — Hardcoded English `"Loading..."` in JSX. **Fix**: add `COACH_COPY.loading` and reference it.
- [ ] **arena-board.tsx:89** — Hardcoded `"Board error — please restart the game"`. **Fix**: add `ARENA_COPY.boardError`.

### Tap targets below 44px
- [ ] **trophies/trophy-list.tsx:48** — Retry button is `text-xs` underline (~28px). **Fix**: wrap in `min-h-[44px] flex items-center justify-center`.
- [ ] **coach-paywall.tsx:34,47** — Credit pack tiles `p-4` resolve to ~40px height. **Fix**: add `min-h-[56px]` to each pack button.

### Lucide leftovers blocking design unity
- [ ] **components/ui/sheet.tsx:4,67** — Radix Sheet primitive close button still uses Lucide `X`. Every sheet inherits this default. **Fix**: replace with `<CandyIcon name="close" className="h-4 w-4" />` so all sheets get the candy close for free.

---

## P1 — Major (should fix)

### Icon size / alignment inconsistency
- [ ] **arena-action-bar.tsx:55** — `btn-resign.png` rendered at `h-7 w-7` inside `.arena-action-pill-icon` (3rem container with `btn-stone-bg.png`). Visually offset / asymmetrically padded. **Fix**: bump inner img to `h-9 w-9` or restyle the pill so the stone bg has consistent inner padding for the sprite.
- [ ] **victory-claim-error.tsx** — `Try Again` uses refresh `h-4 w-4`; `Play Again` uses refresh `h-3.5 w-3.5`. Same icon, two sizes in adjacent buttons. **Fix**: pick one (recommend `h-4 w-4`).
- [ ] **trophy-card.tsx:108-114** — `move` and `time` CandyIcons at `h-3.5 w-3.5` look dim next to the surrounding text. **Fix**: bump to `h-4 w-4` for visual hierarchy.
- [ ] **mission-briefing.tsx:50** — Close container is `h-11 w-11` but inner `<CandyIcon name="close" h-5 w-5>` looks oversized vs the radix sheet close (`h-4 w-4`). **Fix**: standardize close icon at `h-4 w-4` everywhere.
- [ ] **coach-welcome.tsx:16** — Coach CandyIcon at `h-16 w-16` with `h-24 w-24` pulse halo dominates the modal at 340px width. **Fix**: reduce to `h-12 w-12` and shrink halo to `h-20 w-20`.

### Lucide leftovers (candy equivalent exists)
- [ ] **shop-sheet.tsx:52** — `<ShoppingBag size={20}>` in SheetTitle. **Fix**: use `<CandyIcon name="trophy">` (closest semantic) or generate a `bag-ch.png` and add to CandyIcon names.
- [ ] **shop-sheet.tsx:1,87** — `CircleDashed` for pending state. **Fix**: queue a `pending-ch.png` sprite or fallback to `<CandyIcon name="time">`.
- [ ] **about/page.tsx:4,14** — `Shield` is Lucide but a candy `shield` exists. Mixed with LifeBuoy/FileText (no candy yet) creates an awkward 2-of-3 inconsistency. **Fix**: either swap all 3 (generate `help-ch.png`, `doc-ch.png`) or keep all Lucide. **Decision flag**: pick one and document.
- [ ] **invite-link.tsx:4,34** — `Share2` Lucide for share action. **Fix**: queue a `share-ch.png` sprite (already exists as `invite-share-menu.png` in dock; could promote to `/icons/share.png`).

### Hardcoded copy
- [ ] **shop-sheet.tsx:66** — `"Featured"` hardcoded badge text. **Fix**: add `SHOP_SHEET_COPY.featured`.
- [ ] **about/invite-link.tsx:17-19** — Hardcoded title `"Chesscito"` + share blurb. **Fix**: move to `ABOUT_COPY.shareTitle` / `ABOUT_COPY.shareBody`.
- [ ] **trophy-card.tsx, coach-fallback.tsx** — confirm all stat labels and CTAs route through editorial.ts (spot-check pending).

### Layout / structure
- [ ] **mission-panel.tsx (legacy non-candy theme)** — Was NOT mirrored to the Direction A peek-card pattern. While `ASSET_THEME` defaults to candy, leaving the legacy theme on the old layout creates divergence debt. **Fix**: mirror the chip + peek-card refactor or delete `mission-panel.tsx` if the non-candy theme is dead code.
- [ ] **gameplay-panel.tsx** — Now only consumed by the legacy `mission-panel.tsx`. After the candy refactor it is effectively dead in the default path. **Fix**: delete if legacy theme is removed; otherwise keep but document.
- [ ] **contextual-action-slot.tsx:81** — Returns `<div className="min-h-[52px]" />` when `action=null`, eating 52px of vertical air on every play-hub render. **Fix**: return `null` (and let the parent's `mt-2` only apply when an action exists, which the candy refactor already does), OR use `visibility: hidden`.
- [ ] **persistent-dock** — Lacks `paddingBottom: env(safe-area-inset-bottom)`. The mission-panel-candy wrapper provides it for the dock slot, but on screens where the dock is rendered directly (e.g., arena route shouldn't, but legal/about pages may differ) this can be cropped. **Fix**: also apply safe-area padding inside `.chesscito-dock` so it survives any host wrapper.

### Token violations / dead CSS
- [ ] **globals.css ~lines 1442-1565** — `.hero-rail`, `.hero-rail-tab`, `.piece-hero`, `.piece-locked`, `.piece-inactive`, `.lock-indicator` are dead after the chip refactor. **Fix**: delete (~80+ lines).
- [ ] **globals.css** — Search for `.practice-*` and the practice-mode label classes (now removed from JSX). **Fix**: delete dead rules.
- [ ] **globals.css:1873** (`.arena-action-pill-icon`) — `color: rgba(63, 34, 8, 0.85)` raw value. **Fix**: introduce `--redesign-stone-text` token.
- [ ] **globals.css** — `.arena-action-pill-icon` lacks `aspect-ratio: 1 / 1`; if pill width drifts the stone bg distorts. **Fix**: add `aspect-ratio: 1`.
- [ ] **globals.css** — `.arena-bg::after` base layer is now `rgba(6, 14, 24, 0)` (fully transparent). **Fix**: either remove the rule entirely (gradients still serve atmosphere) or document that the alpha-0 base is intentional headroom.

### Layout safety
- [ ] **layout.tsx:55** — `max-w-[390px]` hardcoded. **Fix**: use `max-w-[var(--app-max-width)]`.
- [ ] **stat-card.tsx:12** — Emoji literals (`⚔ ♟ ⏱`) without fallback. On older Android WebView (MiniPay floor), some emoji glyphs may render as boxes. **Fix**: pair with a CandyIcon fallback or text aria-label.

### Accessibility
- [ ] **mission-detail-sheet.tsx (NEW)** — Trigger button (`MissionPeek`) has `aria-label="Open mission details"` ✓; verify the sheet's `SheetTitle` wins focus on open (Radix should handle).
- [ ] **piece-picker-sheet.tsx (NEW)** — Chip trigger has `aria-label`. Confirm focus returns to chip after sheet close (Radix default — verify).

---

## P2 — Polish (nice to fix)

### Microcopy / weight
- [ ] **arena-hud.tsx:62** — Confirming-back `<CandyIcon name="check" h-4 w-4>` next to `text-xs` label. Slight visual mismatch. **Fix**: use `h-3.5 w-3.5`.
- [ ] **promotion-overlay.tsx:48** — Promotion piece buttons rely on implicit padding to hit 44px. **Fix**: add explicit `min-h-[44px]`.
- [ ] **coach-loading.tsx** — Dot animation at 3s feels slow for a 60s timeout (user sees only 1-2 dots before completion). **Fix**: drop interval to 1.5s or move to indeterminate progress bar.
- [ ] **coach-paywall.tsx:29-57** — `grid-cols-2` with `p-4` at 390px → ~150px internal width per tile. Long pricing strings could wrap. **Fix**: render at 390px and verify; consider `text-xs` and tighter padding.

### Token consolidation
- [ ] **globals.css:1283,1290** — `.chesscito-dock-center` hardcoded `rgba(160, 225, 220, 0.55/0.9)`. **Fix**: extract `--redesign-cyan-dim` / `--redesign-cyan-bright` tokens.
- [ ] **globals.css:1883** — `is-confirming` uses `color: #fff` raw. **Fix**: token (`--cta-danger-text` exists for the rose direction; introduce `--cta-confirming-text`).
- [ ] **globals.css:246-250** — `.mission-shell` `color: #f3f6fb` and `.mission-soft` `color: #e4f6fb`. **Fix**: migrate to `--foreground` or new named tokens.
- [ ] **trophies/page.tsx:183,224** — Inline `textShadow: rgba(200,180,130,0.55)`. **Fix**: extract to `--text-shadow-label-gold`.

### Cleanup / orphaned styles
- [ ] **globals.css:1249-1257** — `.chesscito-dock-item>button` transition lists `background, border-color` even though those props no longer change. **Fix**: trim transition to `opacity, transform`.
- [ ] **globals.css** — z-index sprawl: pieces 10/11/12, briefing 40, playhub-intro 80, sheets via Radix. **Fix**: document the stacking ladder in a comment block in globals.css.

### Loading / empty states
- [ ] **mission-detail-sheet.tsx:66-82** — No skeleton for stats while score / timeMs are still 0. Sheet shows "0" + "0s" before first move. **Fix**: gate stats rendering on `score > 0 || timeMs > 0` with a "Make your first move" hint.
- [ ] **trophy-card empty state** — Confirmed graceful (centered text). Consider a CandyIcon trophy in muted opacity for visual anchor.
- [ ] **leaderboard / shop empty states** — Verified routed through editorial.ts (`LEADERBOARD_SHEET_COPY.empty`). ✓ pass.

### Misc
- [ ] **victory/[id]/page.tsx:137** — Back button `min-h-[44px]` but no horizontal padding. Text crowds margins on 390px. **Fix**: add `px-3`.
- [ ] **purchase-confirm-sheet.tsx:102** — Cancel button `py-2` resolves to ~36px effective height despite `min-h-[44px]`. **Fix**: change to `py-3`.
- [ ] **piece-picker-sheet.tsx:65** — Tiles use `min-h-[88px]` while exercise-drawer rows are `min-h-[44px]`. Intentional density choice for the 3x2 grid, but flag for consistency review.

---

## Passed (no findings worth flagging)

- ✓ All back buttons across legal/trophies/difficulty-selector use `btn-back.png` consistently.
- ✓ Arena claim CTA (`btn-claim.png`) renders with proper alt + sizing.
- ✓ CandyIcon component is type-safe and centralized — easy to extend.
- ✓ Dock items align well after wrapper bg/border removal; sprites stand on their own.
- ✓ Stable piece identity in arena-board.tsx — fix shipped, no shuffle artifact.
- ✓ Most editorial copy already routed through `lib/content/editorial.ts`.
- ✓ Empty leaderboard / shop / badge states use centralized copy.
- ✓ Type-check clean across `apps/web`.

---

## Summary

- **Screens / components audited**: 38
- **P0 (critical)**: 9
- **P1 (major)**: 22
- **P2 (polish)**: 16
- **Passed**: 8

### Suggested triage order
1. **P0 fixes first**: shop-sheet grid breakpoint, dock bg distortion, dock active state visibility, missing tap targets (paywall, retry), Lucide X in Radix sheet primitive, hardcoded mission/coach copy.
2. **Cleanup pass**: dead `.hero-rail*` CSS, GameplayPanel + legacy mission-panel.tsx decision (mirror or delete), `.arena-bg::after` empty layer.
3. **P1 candy migration polish**: stone pill alignment, icon size standardization (h-4 w-4 default for inline icons), missing sprite generation (share, bag, pending, doc, help).
4. **Token cleanup**: extract `--redesign-stone-text`, `--redesign-cyan-dim/bright`, `--text-shadow-label-gold`, etc.
5. **P2 microcopy + loading states**.

### Sprite requests for the next asset round
- `share-ch.png` — promote from `invite-share-menu.png`
- `bag-ch.png` — shop title icon
- `pending-ch.png` — shop pending state
- `help-ch.png` — about life-buoy
- `doc-ch.png` — about file-text
- `chevron-down-ch.png` — piece chip dropdown affordance
- `link-ch.png` — copy-link icon (victory share)
