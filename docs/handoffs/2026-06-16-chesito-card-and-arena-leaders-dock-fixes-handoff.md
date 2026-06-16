# Handoff — Chesito Card + Arena/Leaders/Dock fixes (2026-06-16)

Session shipped 1 visual feature (Chesito Card) and 4 polish/bug fixes, all on
`main` (local, **not pushed**, **not promoted to production**). Suite green:
**3779/3779** (was 3774 baseline; +5 new tests). `tsc --noEmit` clean.

## Commits (chronological)

| Commit | Item | Summary |
|--------|------|---------|
| `35c9cc2f` | Arena #1+#2 | Leave terminates match (clearArenaGame on back) + selected rival avatar (Pipo/Mara/Kairo) in gameplay HUD |
| `9a403ef6` | Leaders #3 | Player avatars use the board's piece sprites (THEME_CONFIG.piecesBase) instead of the legacy classical set |
| `00ab9ca5` | Leaders #4 | Drop the circle around rank numbers; plain digits for legibility |
| `bab54cae` | Dock #5 | Every dock item shows its label by default; activate only zooms the icon |
| `e6564aa5` | Card #6 | Chesito Card — rechargeable Peones wallet surface |
| `d99d1e84` | Card polish | /dev/chesito-card VR fixture + warm peón tint |

## What changed, by item

### #1 Arena — Leave kills the match
`handleBack()` in `arena/page.tsx` now calls `clearArenaGame()` before
`router.push("/hub")`. Re-entering `/arena` lands on the rival selector instead
of resuming at the exact second the user walked away (now matches resign).
`clearArenaGame()` only touches localStorage, so no selector flash. Regression
guard added in `arena-handle-back-no-flash.test.tsx`.

### #2 Arena — rival avatar in gameplay
`PlayerAvatar` (redesign) gained a `customSrc` prop (renders a `<picture>` with
avif/webp/png siblings). `ArenaHud` forwards `rivalAvatarSrc`; `page.tsx` passes
`/art/rivals/${rival.avatar}-avatar.png`. The generic red `avatar-red` is gone
from live matches.

### #3 Leaders — board pieces
`identity/player-avatar.tsx` base path switched from hardcoded `/art/pieces/w-*`
to `${THEME_CONFIG.piecesBase}/w-*` (candy → `/art/redesign/pieces`). Affects
leaderboard + profile avatars everywhere this component renders.

### #4 Leaders — rank numbers
`.leaderboard-rank-pill` lost `background` + `border-radius` (the circle);
`min-width` kept for column alignment; size/weight tuned. top2/top3 keep their
color, lose the pill background.

### #5 Dock — labels always on
`.chesscito-dock-item-label` and `.chesscito-dock-center .game-label` set to
`opacity: 1` by default (were 0, faded in on active). Labels are absolutely
positioned, so dock height stays a fixed 68px. Activate still does the
`scale(1.18)` lift + halo on the icon (may overflow the top edge; dock has no
overflow clip). The redundant active-state opacity rules were removed.

### #6 Chesito Card
New self-contained `src/components/peones/chesito-card.tsx`:
- reads `usePeonesBalance` (states mirror the chip: number / "…" / "--"),
- renders cream+gold card: crown + title, sparkle divider, big green balance +
  "Peones", caption, green **Top up** CTA, peón sprite hero (warm-tinted),
- Top up opens the existing `GetPeonesSheet` rail (no new payment logic).

Mount points:
1. **Account sheet hero** — top of `AccountSheet` body in `exercises-screen.tsx`.
2. **HUD chip** — `peones-balance-chip.tsx` now opens the card in a lightweight
   centered modal (floats on `candy-modal-scrim`; Escape / backdrop / X close)
   instead of jumping straight to the packs sheet.

Copy lives in `editorial.ts` → `CHESITO_CARD_COPY` (English source of truth,
imported directly — **EN only**, no ES catalog mirror; see Open questions).

CSS: `.chesito-card*` family in `globals.css` (cross-surface → globals).
Decisions taken with the founder: placement = Account hero + chip opens it;
scope = minimal (mockup 1); Recargar → GetPeonesSheet; art = existing
`peon-piece-v1` sprite.

## Verification
- `pnpm exec tsc --noEmit` — clean.
- Full unit suite — **3779/3779**, 300 files.
- Visual check — `/dev/chesito-card` screenshotted at 390px (both contexts).
  Card matches mockup 1; balance reads "--" in the fixture (no wallet) — in-app
  it shows the real number.

## Pending before push / promote

1. **VR baseline refresh (REQUIRED, not yet run).** These surfaces will drift:
   dock (labels always on), leaderboard (pieces + rank numbers), arena HUD
   (rival avatar), + new card fixture. Run on a clean server with a
   reboot-friendly window:
   `rm -rf .next && PORT=3947 pnpm dev` then
   `BASE_URL=http://localhost:3947 pnpm test:e2e:visual -g "<surface>" --update-snapshots`.
   Filter by surface to keep blast radius small (disk-pressure memory).
2. **Push + (later) promote.** All commits are local on `main`; nothing pushed.
3. **MiniPay / 390px smoke** of: arena leave→selector, rival avatar in match,
   leaders pieces+numbers, dock labels, Account card + chip modal + Top up.

## Open questions
- **Card ES copy.** `CHESITO_CARD_COPY` is EN-only (imported from editorial,
  not via `useTranslations`). If the ES locale switch must localize the card,
  add a `CHESITO_CARD_COPY` mirror to `messages/es.ts` and switch the component
  to `useTranslations`. Deferred as visual-only per scope.
- **Premium peón art.** Founder chose the existing flat sprite for v1. If they
  later export the 3D gold render (480×480 triplet), drop it in and remove the
  warm-tint filter in `.chesito-card-art`.
- **Chip → card friction.** Recharge is now chip → card → Top up (1 extra tap
  vs old chip → packs). Intentional (card is the wallet hub); revisit if the
  founder wants a faster path.
