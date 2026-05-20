# Header Consistency Audit — 2026-05-20

**Scope**: every visible top strip in the app — page headers, sheet headers, and modal shells. Goal: find inconsistencies in height, padding, back/close button placement, icon placement, divider, and title hierarchy; propose a unified intermediate header.

---

## 1 — Catalogue of header patterns found

The app currently runs **six distinct header patterns**, none fully consistent with the others.

### Pattern A — Page shells (tall, ~80–90px)

| Surface | File | Height feel | Back | Title icon | Subtitle | Divider |
|---|---|---|---|---|---|---|
| Legal / About / Privacy / Terms / Why | `components/legal-page-shell.tsx:20-41` | `px-5 py-5` (≈ 80px) | LEFT, `CandyBanner btn-back h-8 w-8` | none | optional | bottom `border-b` |
| `/trophies` | `app/trophies/page.tsx:24-47` | `mb-4 pb-4 px-4` (≈ 80px, no top pad) | LEFT, `CandyBanner btn-back h-9 w-9` | LEFT, `CandyIcon h-5 w-5` inline | yes (`mt-1 text-sm`) | bottom `border-b` |
| `/coach/history` Training Journal | `app/coach/history/page.tsx:33-52` | `.tj-page-header` custom CSS (~90px) | LEFT, `CandyBanner btn-back h-9 w-9` | LEFT, `CandyIcon h-5 w-5` | yes (`tj-page-header-subtitle`) | custom CSS |

### Pattern B — Sheet headers ("XL" candy frame, ~100px+)

Used by every dock destination and most modal sheets. All share the same wrapper recipe:
`shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]`

| Sheet | File | Title icon (LEFT) | SheetDescription | Notes |
|---|---|---|---|---|
| ShopSheet | `components/exercises/shop-sheet.tsx:204-219` | `shop` h-5 w-5 | visible | — |
| BadgeSheet | `components/exercises/badge-sheet.tsx:240-269` | `trophy` h-5 w-5 | visible + chip + progress bar (extra height) | tallest of the family |
| LeaderboardSheet | `components/exercises/leaderboard-sheet.tsx:131-147` | `crown` h-5 w-5 | visible | — |
| TrophiesSheet | `components/exercises/trophies-sheet.tsx:52-68` | `trophy` h-5 w-5 | visible | — |
| MissionDetailSheet | `components/exercises/mission-detail-sheet.tsx:67-82` | **none** | sr-only | rounded `rounded-t-3xl` (different radius from siblings) |
| PiecePickerSheet | `components/exercises/piece-picker-sheet.tsx:49-64` | **none** | sr-only | `border-color 0.35` (slightly darker) + `rounded-t-3xl` |
| PurchaseConfirmSheet | `components/exercises/purchase-confirm-sheet.tsx:42-58` | **none** | visible | `rounded-t-3xl` |
| MissionHeaderCandy (shared) | `components/exercises/mission-header-candy.tsx:13-47` | `coach` (or override) h-5 w-5 | conditional | `border-color 0.20` (lighter) + optional inline `objective` card |
| MiniArenaSheet | composes MissionHeaderCandy | `trophy` h-5 w-5 | yes | — |
| DailyTacticSheet | composes MissionHeaderCandy | `coach` h-5 w-5 | yes | — |

### Pattern C — Sheets without a header strip

| Sheet | File | Behaviour |
|---|---|---|
| ProSheet | `components/pro/pro-sheet.tsx:194-211` | No `-mx-6` wrapper, no divider, kicker + title + description sit inside body padding. Floating absolute X close (sheet.tsx) overlaps the kicker. |
| ProfileSheet | `components/profile/profile-sheet.tsx:212-215` | `SheetHeader` is `sr-only`. The visible "header" is `<ProfileBanner>` — banner-style, not a strip. No back button, no close inline. |
| AchievementDetailSheet | `components/trophies/achievement-detail-sheet.tsx:42-59` | No bottom border, no wrapper. Title only, no icon. |

### Pattern D — Exercises (the "thin" one the user called out)

Two stacked strips, neither a real header:

1. `<GlobalStatusBar variant="connected" compact onBack={…}>` (`components/ui/global-status-bar.tsx:121-138`)
   - Height: `h-9` (36px) + safe-area-top → ~40px content. **This is the smallest header in the app.**
   - LEFT: optional back chip `CandyBanner btn-back h-8 w-8` (scaled to `0.82`).
   - RIGHT: PRO/account chip.
2. Quest tray chip row in `MissionPanelCandy` (`components/exercises/mission-panel-candy.tsx:272-298`)
   - 3 chips: piece picker · mission peek · exercise drawer.
   - No back/close.

### Pattern E — CandyGlassShell (modal-as-screen — Coach result/fallback)

`components/redesign/candy-glass-shell.tsx:66-88`
- Single row: title LEFT + close X RIGHT, no icon, `pb-3 -mx-2`.
- Close X is a real inline `<button>` (`candy-close-button mr-2`) — **this is the only header where the close lives inline next to the title.**
- Used by `/coach/history` detail view and `/arena` coach result/fallback.

### Pattern F — ContextualHeader (the design-system primitive that nobody adopted)

`components/ui/contextual-header.tsx`
- Canonical Z2 envelope: `min-h-[52px] max-h-[64px] gap-2 px-3` — **the only primitive with an intermediate height.**
- 4 variants: `title`, `title-control`, `mode-tabs`, `back-control`. Back-control puts `btn-back h-8 w-8` LEFT.
- Has a written spec (`docs/specs/ui/contextual-header-spec-2026-05-01.md`) but **no sheet or page actually uses it.**

---

## 2 — Findings

### Critical (must fix)

- **[All sheets] Close X is absolutely positioned and not part of the header.** `sheet.tsx:66-71` mounts `candy-close-button` at `right-4 top-[calc(env(safe-area-inset-top)+1rem)]`. Result: when a sheet header has both a title and a SheetDescription, the X floats next to the title; when a sheet has only a kicker (ProSheet) the X overlaps the kicker; on tall sheets (BadgeSheet with progress bar) the X sits next to the *icon*, not the close affordance the user expects.
- **[All sheets vs all pages] Sheets have NO back chip, pages have NO close X.** A user inside a sheet has only the Radix close X or swipe-down; a user inside a page has only `btn-back`. Two different mental models for the same "exit this screen" intent.
- **[Header heights span 40px → 100px+]** Z1 (36px) → ContextualHeader (52–64px) → page shells (~80px) → sheets (~100px+). No intermediate canonical height is used in production.

### Major (should fix)

- **[Title icon] Half the sheets have a LEFT-inline icon, half don't.** Shop / Badge / Leaderboard / Trophies / MissionHeaderCandy → icon. PiecePicker / MissionDetail / PurchaseConfirm / Pro / Profile / AchievementDetail → no icon. There is no rule documented.
- **[Pages: icon placement] /trophies + /coach/history put the icon INLINE with the title text.** legal-page-shell puts NO icon at all. Inconsistent across the three page-shell surfaces.
- **[Bottom divider]** Present in: every Pattern A page + every Pattern B sheet + MissionHeaderCandy. Absent in: ProSheet, ProfileSheet, AchievementDetailSheet, MiniArenaSheet status bar. The presence/absence is not driven by content.
- **[Border-bottom colour]** Sheets oscillate between `rgba(110,65,15,0.30)` (shop/badge/leaderboard/trophies/purchase-confirm/mission-detail), `0.35` (piece-picker), and `0.20` (mission-header-candy). Three values for the same line.
- **[Sheet corner radius]** Mixed: `rounded-none` (shop/badge/leaderboard/trophies/mini-arena/daily-tactic), `rounded-t-3xl` (mission-detail/piece-picker/purchase-confirm/achievement-detail/pro). The rule of "destination = full-screen, action = lifted" is not enforced in either direction.
- **[Back chip size]** `h-8 w-8` in legal-page-shell + ContextualHeader. `h-9 w-9` in /trophies + /coach/history. GlobalStatusBar (Z1) uses `h-8 w-8` *scaled to 0.82* (~26px). Three sizes for one button.
- **[Title typography]**
  - Sheets: `SheetTitle` default = `text-lg font-semibold` (`sheet.tsx:111`), overridden by `fantasy-title` class which only changes font-family — so the cascaded weight is still `font-semibold`, NOT `font-extrabold` like page titles claim to be.
  - Legal: `text-xl font-bold`.
  - /trophies: `text-lg` (inline).
  - /coach/history: `tj-page-header-title` (custom CSS, value not visible in this file).
  - MissionHeaderCandy: explicit `text-lg`.
  - Result: titles look subtly different on each surface even before considering the icon.

### Minor (nice to fix)

- **[Padding] `-mx-6 -mt-6 px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]`** is copy-pasted across 7+ sheet files. Should be a single class or a primitive prop.
- **[ProSheet] kicker (`PRO • ACTIVE`)** is rendered *above* the title in the same block as the rest of the header — but visually it lives in the "header zone" while structurally it's body. Causes the floating X to land between the kicker and the title in some viewport heights.
- **[ProfileSheet]** Using ProfileBanner as the header makes the sheet look completely different from every other sheet — no shared visual anchor.
- **[MissionDetailSheet]** title is just `MISSION_DETAIL_COPY.title` without an icon, while the inline body shows the piece art prominently. Header feels under-dressed compared to siblings.
- **[GlobalStatusBar exercises mode]** the back chip is scaled to `0.82` (~26px) — below the 44px touch target rule documented in DESIGN_SYSTEM.md.

### Passed

- `ContextualHeader` already has a well-typed discriminated-union API for exactly this need (title / title-control / mode-tabs / back-control). The primitive is correct; only the adoption is missing.
- All headers use editorial copy constants (no hardcoded strings).
- All headers use CSS variables / rgba tokens for colours.
- All back chips use the same `CandyBanner name="btn-back"` art.

---

## 3 — Proposed unified intermediate header

A single primitive — extend `ContextualHeader` rather than introduce a new one — used by every sheet and page. The target sits **between** the 52–64 px Z2 envelope and the current 100 px sheet inflation.

### Envelope

| Token | Value |
|---|---|
| Min height | **56 px** |
| Max height | **64 px** (≤ 72 px with safe-area top) |
| Horizontal padding | `px-4` (16 px) — between Z2's `px-3` and sheets' `px-6` |
| Vertical padding | `py-2.5` (10 px) + `pt-[calc(env(safe-area-inset-top)+0.5rem)]` when fixed |
| Max width | `max-w-[var(--app-max-width)]` (390 px) — already the rule |
| Bottom divider | `border-b border-[rgba(110,65,15,0.30)]` — single canonical token |
| Corner radius | follows host (sheets: `rounded-none` for destinations, `rounded-t-3xl` for action sheets — but radius lives on `SheetContent`, NOT on the header) |

### Slot grid (left → center → right)

```
┌──────┬─────────────────────────┬──────┐
│ Z-L  │ Z-C: title + subtitle   │ Z-R  │
│ 44px │ flex-1, truncate        │ 44px │
└──────┴─────────────────────────┴──────┘
```

- **Z-L** (44 × 44 touch target): one of `<BackChip>` · `<CloseChip>` · icon avatar · empty.
- **Z-C**: `text-base font-extrabold` title + optional `text-xs font-medium opacity-65` subtitle, both `truncate`. **Title icon (h-5 w-5)** sits inline LEFT of the title text with `gap-2`.
- **Z-R** (≤ 44 px): one of `<CloseChip>` · trailing control · empty.

### Slot rules (single source of truth)

1. **Pages with browser back semantics** → Z-L = `<BackChip>` (`CandyBanner btn-back h-8 w-8` inside `candy-nav-button`). Z-R = empty or trailing control.
2. **Sheets opened from dock or page** → Z-L = icon avatar (the title's CandyIcon promoted to 32 × 32 with the same color token). Z-R = `<CloseChip>` (CandyIcon close h-5 w-5 in `candy-close-button`) — inline, **not absolute**. Removes the floating-X overlap problem.
3. **Sheets that are confirmation modals** (purchase confirm, achievement detail) → Z-L = empty. Z-R = `<CloseChip>` inline.
4. Never mix back + close in the same header. Pick one based on the navigation model (page = back, sheet/overlay = close).
5. Title icon is **mandatory** in sheets (Z2 sheets are contextual — the icon is the cue). Optional in pages with a back chip already on the left.

### Migration impact

| Surface | Today | After |
|---|---|---|
| legal-page-shell | Pattern A (~80 px) | unified (56–64 px) — keep back left, drop the top breathing space |
| /trophies page | Pattern A (~80 px) | unified — back + icon avatar collapse into single Z-L = back |
| /coach/history | Pattern A (~90 px) | unified |
| Shop / Badge / Leaderboard / Trophies sheet | Pattern B (~100 px) | unified, but the **stats row** (BadgeSheet progress bar, ShopSheet success banner) moves **below** the header into the body. The header strip itself becomes 56–64 px. |
| MissionDetailSheet / PiecePickerSheet | Pattern B | unified, gain a title icon (currently missing) |
| MissionHeaderCandy (shared) | Pattern B variant | unified — the `objective` card moves into the body, not the header |
| PurchaseConfirmSheet / AchievementDetailSheet | Pattern B / C | unified |
| ProSheet | Pattern C (no strip) | unified — the kicker becomes a chip in Z-R or moves into the body as a status pill |
| ProfileSheet | Pattern C (banner) | unified header strip ABOVE the banner |
| MiniArenaSheet / DailyTacticSheet | Pattern B (via MissionHeaderCandy) | unified |
| /arena selecting view | uses GlobalStatusBar Z1 alone | keep Z1 for identity; add unified Z2 below it with `title="Choose difficulty"` |
| /exercises | Z1 (~40 px) + chip tray | keep Z1; add the unified Z2 with `back-control` variant and the chip tray as `trailingControl` — solves the "back chip below 44 px" finding and unifies with sheets |
| CandyGlassShell | Pattern E (close inline) | inherits the unified header; the only Pattern E behaviour worth keeping (close inline) is already in the unified spec |

### Implementation note

Extend `ContextualHeader` rather than write a new primitive:
- Add a `close-control` variant (Z-L empty, Z-C title+subtitle+optional icon, Z-R = close button).
- Add an optional `icon` prop on the `title`, `title-control`, and `back-control` variants — the icon renders inline LEFT of the title at h-5 w-5.
- Replace the absolute close in `sheet.tsx:66-71` with a slot: `<ContextualHeader variant="close-control" …>` rendered inside each sheet, and remove the floating `<SheetPrimitive.Close>`.

---

## 4 — Summary

- Surfaces audited: 18 (3 page shells + 12 sheets + 1 modal shell + 1 exercises strip + 1 arena strip + ContextualHeader primitive).
- **Critical**: 3 — absolute floating close, back-vs-close asymmetry between pages and sheets, height span from 36 → 100+ px.
- **Major**: 7 — title icon presence/absence, page icon placement, divider presence, divider colour, corner radius, back-chip size, title typography.
- **Minor**: 5 — copy-pasted padding recipe, ProSheet kicker overlap, ProfileSheet banner-vs-strip, MissionDetail under-dressed title, GlobalStatusBar back chip below 44 px touch target.

Recommended next step: extend `ContextualHeader` with the `close-control` variant + the optional title icon, then migrate one sheet (suggest ShopSheet — high traffic, simple body) as the canary. The other 17 surfaces follow once the canary holds for a week.
