# Handoff — Identity Lite PR1 (avatar + nickname)

**Date**: 2026-06-15 (updated — session 2)
**Branch**: `feat/identity-lite-pr1` (8 commits ahead of `main`, NOT pushed)
**Suite**: 3769/3769 passing · `tsc --noEmit` clean (apps/web)
**Spec**: `docs/specs/identity-lite-pr1.md` (+ `-redteam.md`, verdict READY, 3 P0 folded)

## Goal

Show **Avatar + Nickname** instead of raw `0x8f3…91ab` everywhere. PR1 is
read-only (no DB; editing keeps using the existing localStorage custom name).
DB + cross-device persistence + PATCH API is **PR2** (out of scope).

## Founder decisions locked (2026-06-15)

1. Nicknames **bilingual via i18n** (EN adjective-first "Golden Knight #4821" /
   ES noun-first "Caballo Dorado #4821").
2. **PR1 read-only** this session (no DB/migration/PATCH).
3. Avatar = **recolored piece sprite** on a style disc, **zero new assets**.
4. Leaderboard identity **computed server-side**; the wallet never leaves the
   server. Foreign rows ship `rowId` + `variant` only — **no 0x at all**; only
   the caller's own row keeps `walletShort`.

## DONE this session (commits on the branch)

| # | Commit | What |
|---|--------|------|
| 1 | `d12bd581` | `lib/identity/identity-lite.ts` — hashSeed (FNV-1a), deriveAvatarVariant (salted :p/:s/:n), deriveRowId, formatNickname/Guest/Compact, validateNickname + 17 tests + spec/red-team |
| 2 | `993158da` | `lib/identity/guest-id.ts` — getOrCreateGuestId, ephemeral fallback + 4 tests |
| 3 | `08e6cdf8` | `resolveDisplayName` — optional `generatedNickname` precedence (custom > talent > generated > truncateWallet), backward compatible |
| 4 | `8f3cd8d3` | `IDENTITY_COPY` EN(editorial)/ES(es.ts) + `useNicknameTokens` + `PlayerAvatar` + `PlayerIdentityPill` + globals.css + tests |
| 5 | `d14a3d9c` | Leaderboard end-to-end: server `LeaderboardRow` → `rowId`+`variant` (no wallet), sheet renders pills + own-row dedup + custom-name override; `useDisplayName` exposes raw `customName`; `useNicknameTokens` uses `t.raw` for the brace template |
| 6 | `81a9d61e` | **Global hook swap + Profile**: `useDisplayName` now computes the generated nickname (replaces truncateWallet as default `name`) + returns avatar `variant`; only 2 consumers (profile-sheet visible, leaderboard-sheet customName-only). `profile-banner` renders `<PlayerAvatar>` from the variant (emoji = visitor fallback). |

**Leaderboard (privacy-critical) + Profile are fully shipped + green.**

## REMAINING for PR1 Definition of Done (next block)

Resolved this session: **Profile** ✅ (banner avatar + nickname), and the
**global `useDisplayName` swap** ✅ (low blast radius — only 2 consumers — done
deliberately, suite green, no VR red surfaced by unit tests).

### Header — NOT a visible offender (re-scoped)
`global-status-bar.tsx` `ConnectedBar` renders `walletShort` ONLY in an
`sr-only` span — the visible chip is the PRO cluster, no wallet on screen. So the
header is NOT a DoD blocker. **Optional a11y nicety**: have the caller
(`exercises-screen.tsx` / `mission-panel-candy.tsx`) pass `handle` = nickname so
the sr-only text reads the nickname instead of the wallet. Zero visible/VR change.

### 1. Stats — the remaining VISIBLE offender (server-side refactor)
`components/stats/stats-page.tsx` is a **SERVER component** (no "use client", no
hooks), rendered by async `app/[locale]/stats/page.tsx`, cached hourly. It shows
`truncateWallet(row.player)` for top-minters (L~623) + top-10 (L~687). Data is
`PublicStats` from `lib/stats/public-aggregator.ts`, which currently SHIPS FULL
WALLETS to the client (`hallOfFame: VictoryRow[]`, `leaderboardTop10:
LeaderboardRow[]` — both carry raw `player`). This is a **pre-existing** privacy
gap, not introduced by Identity Lite.

Recommended approach (boundary-correct, also closes the payload gap):
- **Aggregator** (`public-aggregator.ts`, locale-agnostic, cached): add new
  identity-enriched display arrays — e.g. `topMinters: { rowId, variant,
  mintCount, lastMintedAt }[]` (move `aggregateTopMinters` server-side) and
  `leaderboardTop10Identity: { rank, rowId, variant, total_score }[]`. Derive
  `variant`/`rowId` from the full wallet, then **drop the wallet** from these.
- **page.tsx** (async server, per-locale): `const tId = await
  getTranslations("IDENTITY_COPY")`; build `NicknameTokens`; format each
  nickname; pass `{ variant, name }[]` display arrays into `<StatsPage>`.
- **StatsPage** (server, pure render): render `<PlayerAvatar>` + name text (no
  hook needed). Drop the local `truncateWallet` (L217) + the two usages.
- Keep `VictoryRow`/`LeaderboardRow` shared types untouched (don't ripple into
  `trophies-body.tsx`); just stop forwarding `player` into the new arrays.

### 2. Guest identity wiring
`getOrCreateGuestId` + `deriveAvatarVariant` exist but no surface consumes them
for the no-wallet case (profile shows the emoji, header shows "Visitor"). If
desired, derive a guest variant from `guestSeed(getOrCreateGuestId())` and feed
the profile/header avatar when `!address`. **Client-gate** to avoid SSR hydration
mismatch (spec edge case + AC). Low priority — guests have few surfaces.

### 3. VR baselines — deferred
Leaderboard sheet (avatars added) + profile banner (emoji → PlayerAvatar) changed
visually, so `vr*-leaderboard*` / `vr*-profile*` baselines will drift. Refresh
with the project recipe: clean `.next` + `PORT=3947 pnpm dev` + `BASE_URL` +
`--update-snapshots` (`feedback_vr_baseline_discipline`). Unit suite is green;
VR not yet run — **deferred**.

## Open questions / notes

- **OQ1 (P1 i18n gender)**: ES styles include "Dorado", which doesn't agree
  with feminine pieces ("Reina Dorado"). Accepted as-is for MVP (stylized
  handle, not prose). Founder may retune a single word later.
- **OQ2**: avatar uses the white piece set (`w-<piece>`) on the disc. Validate
  contrast in visual QA; `b-<piece>` is the alternative.
- **STYLE_DISC_COLOR** palette (`components/identity/avatar-style.ts`) is a first
  pass — founder may retune hexes without touching derivation.

## How to resume

1. Read this handoff + `docs/specs/identity-lite-pr1.md`.
2. Pick up at "Header" (#1) — highest-visibility remaining surface.
3. TDD per surface; run full suite before each commit; refresh VR at the end.
4. When all four surfaces render identity → PR1 DoD met → push branch + open PR.
