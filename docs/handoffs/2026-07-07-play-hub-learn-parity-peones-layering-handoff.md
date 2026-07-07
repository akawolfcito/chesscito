# Handoff — PLAY hub LEARN parity + Peones modal layering (2026-07-07)

Merged: **PR #177** → `main` (`3496fff1`). Branch deleted. Full unit suite **4681 passing**.

## What shipped

### 1. PLAY hub adopts the LEARN/LITE distribution
`apps/web/src/components/hub/play-hub-scaffold.tsx` + `apps/web/src/app/globals.css`.
- Removed the centered `.play-hub-body` wrapper. Mascot · Kingdom panel · CTA ·
  CHESS TOOLS are now **direct siblings of `<main>`** (flat stack), same DOM shape
  as `hub-lite-scaffold.tsx`.
- `.play-hub-scaffold`: `justify-content:flex-start` + `gap:6px` + 14px horizontal
  gutter (was `space-between` + a `flex:1` centered body). Header `hub-scaffold-hud-top`
  horizontal padding zeroed so it aligns to the gutter. `.play-hub-cta-row` gets
  `margin:24px 0 16px` (mirrors `.hub-lite-start-focus-wrap`). `.play-hub-tools`
  gets `margin-top:auto` → pinned to the floor like the Training Path.
- **Base `.hub-scaffold` / `.hub-scaffold-hud-top` untouched** — shared with the
  legacy FULL hub (`hub-scaffold.tsx`).

### 2. Tactics/Coach/Shop tiles → LEARN gold piece-tiles
- `.play-hub-tools-grid`: `repeat(3, 48px)`; tiles now the gold `.reward-tile.is-compact`
  look (48px, gold gradient `#ffe26d→#ffb555`, piece 28×30, label 0.55rem). Overrides
  HubActionTile's `.reward-tile.is-locked` gray back to active gold.
- **Retires the founder cream look (2026-07-07 note)** — replaced by LEARN parity per
  founder request this session.

### 3. PLAY CHESS CTA → blue clone of Start Focus
- New `.play-chess-cta` **duplicates** `.hub-lite-start-focus` geometry 1:1 (60px min-height,
  `0 46px` padding, radius 20px, 1.35rem label, stacked gold-style bevel) in canonical
  blue, keeping the crossed-swords icon (`/art/hub/enter-arena`) + haptic tap. Replaced
  `PrimaryPlayCta` with a plain `<button>`.
- **Duplicated, NOT a shared base class** — if the Start Focus geometry changes, sync
  `.play-chess-cta` by hand (noted in the CSS comment).

### 4. Fix — Get Peones modal layering in /arena Account sheet
`apps/web/src/components/arena/victory-popup-shell.tsx` + `.../payments/get-peones-sheet.tsx`.
- **Root cause**: the Radix `<Sheet side="bottom">` slide-in applies a `transform` to
  its content; a `transform` (even identity) makes an element the containing block for
  `position:fixed` descendants, so the modal's `fixed inset-0` was scoped to the sheet
  ("interior screen") and its `z-[70]` was trapped inside the sheet's z-50 stacking
  context → dock (z-60, root sibling) rendered on top.
- **Fix**: `VictoryPopupShell` gained opt-in `portal?: boolean` + `scrimZClassName?: string`
  (defaults preserve arena/exercises: no portal, `z-[70]`). `GetPeonesSheet` passes
  `portal` + `scrimZClassName="z-[55]"` → portals the scrim into `<body>` (escapes the
  transform), covers the Account sheet (z-50), stays UNDER the dock (z-60).

### 5. Test repair (pre-existing red)
- 3 arena ArenaPage tests were red since PR #173 wired AccountSheet into /arena
  (AccountSheet calls wagmi `useDisconnect`, absent from their `wagmi` mock). Added
  `useDisconnect: () => ({ disconnect: vi.fn() })` to each. **Not caused by this work**
  (verified by re-running on base via stash).

## Verification
- `tsc --noEmit` clean.
- Full unit suite: **4681 passing** (was 5 failing, all pre-existing arena mock gaps, now fixed).
- **NOT visually verified on-device**: the `transform`-trap only reproduces in
  Chromium/MiniPay, not jsdom. Founder to confirm the /arena → Account → Top up flow shows
  the modal covering the sheet with the dock still on top.

## Next session — START HERE
**save-score-onchain gas-only validation** (thread 2/3 of the MiniPay listing feedback
cluster, **NOT STARTED**). Needs a spec first (SDD). Goal: confirm the save-score-onchain
flow is gas-only (no stablecoin/token transfer) so it satisfies MiniPay listing review.
This is the LAST open thread to close the listing-feedback cluster.

## Other open (non-blocking)
- **Perf `/api/founder-status`** ~55s on the tunnel — triggered by the AccountSheet Founder
  row. Consider lazy/deferring the founder read. See `founder-status-mitigated-2026-06-03`.
- **VR coverage gap**: no fixture for `/hub` play mode or the arena account sheet; tiles +
  CTA changed this session with no baseline. Manual QA only.

## Notes / gotchas learned
- `transform` on an ancestor traps descendant `position:fixed` → portal to `<body>` to
  escape. See memory `feedback_transform_traps_fixed_portal_escape`.
- Local drive: `/hub` = FULL hub unless `NEXT_PUBLIC_CHESSCITO_MODE=play`; LEARN needs
  `=learn` + `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`.
- Piping test/build output through `| tail` truncates it (lost the failure list once this
  session) — run unpiped to a file. See `feedback_next_build_pipe_tail_truncation`.
