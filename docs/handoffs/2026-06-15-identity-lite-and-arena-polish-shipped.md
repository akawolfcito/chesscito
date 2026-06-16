# Handoff — Identity Lite + Arena polish SHIPPED TO PRODUCTION

**Date**: 2026-06-15 (session close)
**State**: `production` = `main` = `origin/main` = **`88c89762`** (clean FF from
`8c5f2bb4`). Suite **3774/3774** · `tsc` clean. Production deploy verified live
(new-asset probe + route smoke all 200).

## What shipped this session (21 commits promoted)

### Identity Lite PR1 — avatar + nickname instead of raw wallet (read-only, no DB)
- Core `lib/identity/identity-lite.ts`: `hashSeed` (FNV-1a), salted
  `deriveAvatarVariant`, `deriveRowId`, bilingual `formatNickname`/Guest/Compact,
  `validateNickname`. Guest id (`guest-id.ts`) + `useGuestIdentity` (client-gated).
- `resolveDisplayName` + `generatedNickname`; global `useDisplayName` swap
  (name = generated nickname, not wallet; returns `variant`).
- `IDENTITY_COPY` EN/ES + `useNicknameTokens` / `nicknameTokensFromTranslator`
  (isomorphic). `PlayerAvatar` + `PlayerIdentityPill`.
- Surfaces now show avatar + nickname (NO raw wallet as primary identity):
  **leaderboard** (server-side `variant`/`rowId`, wallet never leaves server),
  **profile** banner (+ guest fallback), **stats** (server-side, wallet dropped
  from the /stats payload — closed a pre-existing gap), **trophies** cards.
- LEADERS sheet de-cluttered (removed section labels + mt-6).
- Spec + red-team: `docs/specs/identity-lite-pr1*.md` (3 P0 folded).

### Arena CHOOSE YOUR RIVAL polish
- Custom rival avatars (Pipo/Mara/Kairo) as triplets `/art/rivals/<slug>-avatar.*`.
- Per-difficulty frames: blue=easy, silver=medium, gold=hard
  (`/art/rivals/frame-<color>.*`); `Rival.frame` field.
- Selection state: selected rival's avatar in **color**, unselected in **B&W**.
- Avatar **face zoom** (scale 1.85, origin 50% 30%) so the head reads big.
- "CHOOSE YOUR RIVAL" un-bolded; EASY/MEDIUM/HARD badge subtler + bottom-right.

### Arena AI "thinking" delay
- Rival no longer moves near-instantly: randomized think delay before the AI
  plays — easy 0.5–1.3s · medium 0.7–1.7s · hard 0.9–2.1s
  (`aiThinkTimeMs` in `rivals.ts`; wired into `use-chess-game.ts`, replacing the
  fixed 50ms yield). `isThinking` stays true for the window.

## Verification
- Production new-asset probe `/art/rivals/pipo-avatar.webp` → 200 (~130s after push).
- Smoke: `/`, `/arena`, `/arena?fresh=1`, `/stats`, `/en/arena`, new frame/avatar
  assets — all 200.
- Visual checks at 390px: rival select (frames + color/B&W + zoomed faces),
  identity pills. AI delay felt live.

## Remaining / next (optional)
- **PR2 (Identity Lite DB)**: `player_profiles` table + `GET/PATCH
  /api/player-profile` + cross-device nickname persistence + edit modal. PR1 was
  deliberately DB-free (edits use the existing localStorage custom name).
- **Header sr-only**: pass nickname as `handle` in the GlobalStatusBar caller
  (a11y nicety; not a visible offender — walletShort is sr-only only).
- **VR baselines**: the changed surfaces (leaderboard/profile/stats/trophies/arena
  select) have NO `toHaveScreenshot` baselines, so no VR refresh was needed.
- Tunables: `AI_THINK_TIME_MS` + `STYLE_DISC_COLOR` + avatar zoom `scale` are
  one-line founder adjustments.
- OQ1 (ES style gender "Dorado" vs feminine pieces) accepted for MVP.

## Process notes
- Permission prompts this session came from compound commands (`git add && git
  commit <<EOF`, redirects, `lsof | xargs kill`), NOT missing tools — every tool
  is allowed via wildcards. Fix is workflow (split commands, use Write for temp
  scripts). Added `pngquant:*` + `df:*` (the only genuine single-tool gaps).
- New rule saved: review permissions each session.
