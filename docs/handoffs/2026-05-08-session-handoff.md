# Session Handoff — 2026-05-08

## Completed
- `d46cafa` `feat(pro)`: extract `usePROSheetState` hook + 7 unit tests
- `2c82111` `feat(hub)`: port ProSheet directly into scaffold — kills `?legacy=1&action=pro` round-trip + B2 nav race at root
- `8aefe86` `fix(hub)`: bg image now fills mobile viewport (drop `attachment: fixed`)
- `1871d2a` `fix(shop)`: catalog grid scrolls inside the bottom sheet (`flex-1 min-h-0 overflow-y-auto`)
- `384ad7d` `feat(badges)`: extract `useBadgeSheetState` hook + 8 unit tests
- `8c64935` `feat(hub)`: port BadgeSheet directly into scaffold — closes audit **B7** (queen/king tiles no longer collapse)
- `54c6d28` `docs(handoff)`: 2026-05-08 session record under `docs/handoffs/`
- `5a84df8` `feat(hub)`: swap Play CTA backplate to candy-style `principalbutton` — closes audit **B6**

## Current State
- **Branch**: `main`
- **Build**: passing — `pnpm test` 1006/1006 · `tsc --noEmit` clean · `/hub` smoke 200 (no `?legacy=1` markers)
- **Uncommitted work**: none

## Next Tasks
1. **ShopSheet port to scaffold** — heavy (~3-4h). Extract `useShopSheetState()` covering catalog read, `<PurchaseConfirmSheet>`, approve+buyItem, pending shield credit, and `<ResultOverlay>` for shop variant. Last sheet still bouncing through `?legacy=1`.
2. **BadgeSheet ResultOverlay polish** — post-claim celebration + next-piece unlock event. Currently the sheet refetches on success but no visual confirmation lands; PlayHubRoot's ResultOverlay covers it on legacy. ~1h.
3. **Delete `?legacy=1` branch + `<PlayHubRoot>` (1612 LOC)** — only after #1 lands. Cleanup pass.

## Blockers
- None functional. Note: pre-existing visual baseline diff on `hub-shop-sheet-open` (legacy hub) — unrelated to this session's work; owner needs to either rebaseline or accept the diff.

## Notes
- **PR #107** still OPEN (`phase-1-ui-zone-map`) — out of scope for this session.
- All scaffold sheet ports follow the same pattern now: extract `useXSheetState()` hook (self-contained wagmi orchestration) → wire scaffold → mount `<XSheet {...sheet.sheetProps} />`. Replicate for Shop.
- `legacyHubFor()` in `hub-scaffold-client.tsx` is down to a single case (`shop`); will go to zero after task #1.
- BadgeSheet hook deferred ResultOverlay + unlock celebration intentionally — they require coupling to PlayHubRoot's exercise/board state and aren't load-bearing for the scaffold flow today. Track in task #2.
- Coach LLM (OpenRouter `openai/gpt-oss-120b:free`) and PRO subscription (Celo Mainnet itemId 6) untouched this session — both still live and stable.
- Suite count grew 991 → 1006 (+8 badge hook tests, +7 PRO hook tests). No spec deletions.
