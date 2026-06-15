# Handoff — Identity Lite PR1 (avatar + nickname)

**Date**: 2026-06-15 (updated — session 3)
**Branch**: `feat/identity-lite-pr1` (9 commits ahead of `main`, NOT pushed)
**Suite**: 3770/3770 passing · `tsc --noEmit` clean (apps/web)
**Status**: visible DoD MET — leaderboard + profile + stats no longer show raw
wallet. Remaining: guest wiring (optional), VR refresh, header sr-only (optional).
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
| 7 | `30e753d1` | **Stats (server-side)**: `public-aggregator` now ships identity-only `topMinters` + `leaderboardTop10` (variant/rowId, **no wallet** — closes a pre-existing payload gap); `stats/page.tsx` builds tokens via `getTranslations`; `stats-page` renders `PlayerIdentityPill`. New shared `nickname-tokens.ts` (`nicknameTokensFromTranslator`, isomorphic). |

**Leaderboard + Profile + Stats are fully shipped + green. Visible DoD MET.**

## REMAINING (finishing touches — DoD visible part is done)

Resolved this session: **Profile** ✅, **global `useDisplayName` swap** ✅,
**Stats** ✅ (server-side, wallet dropped from the /stats payload).

### Header — NOT a visible offender (re-scoped, optional)
`global-status-bar.tsx` `ConnectedBar` renders `walletShort` ONLY in an
`sr-only` span — the visible chip is the PRO cluster, no wallet on screen. NOT a
DoD blocker. **Optional a11y nicety**: have the caller (`exercises-screen.tsx` /
`mission-panel-candy.tsx`, which now can read `useDisplayName(address).name`)
pass `handle` = nickname so the sr-only text reads the nickname. Zero visible/VR
change.

### 1. Guest identity wiring (optional — DoD criterion #3)
`getOrCreateGuestId` + `deriveAvatarVariant` exist but no surface consumes them
for the no-wallet case (profile shows the emoji, header shows "Visitor"). If
desired, derive a guest variant from `guestSeed(getOrCreateGuestId())` and feed
the profile/header avatar when `!address`. **Client-gate** to avoid SSR hydration
mismatch (spec edge case + AC). Low priority — guests have few surfaces.

### 2. VR baselines — deferred (do before opening the PR)
Three surfaces changed visually: leaderboard sheet (avatars added), profile
banner (emoji → PlayerAvatar), and `/stats` (avatar+nickname rows). So
`vr*-leaderboard*` / `vr*-profile*` / `vr*-stats*` baselines will drift. Refresh
with the project recipe: clean `.next` + `PORT=3947 pnpm dev` + `BASE_URL` +
`--update-snapshots` (`feedback_vr_baseline_discipline`). Heavy + disk-sensitive
(`disk-telemetry` notes) — run deliberately, reboot after. Unit suite is green;
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

The three visible surfaces (leaderboard, profile, stats) are DONE. What's left
is finishing/polish, in order of value:

1. **VR refresh** (do before the PR) — heavy + disk-sensitive; run deliberately.
2. **Guest wiring** (optional, DoD #3) — show a guest avatar/nickname for the
   no-wallet case; client-gate for hydration.
3. **Header sr-only** (optional a11y) — pass nickname as `handle`.
4. Then push branch + open the PR (PR2 = DB persistence + PATCH API).
