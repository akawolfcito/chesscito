# Handoff — Identity Lite PR1 (avatar + nickname)

**Date**: 2026-06-15
**Branch**: `feat/identity-lite-pr1` (6 commits ahead of `main`, NOT pushed)
**Suite**: 3765/3765 passing · `tsc --noEmit` clean (apps/web)
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

**Privacy-critical leaderboard is fully shipped + green.**

## REMAINING for PR1 Definition of Done (next block)

The DoD ("no main screen shows raw wallet as primary identity") is **not yet
met** — three surfaces still render `truncateWallet`:

1. **Header** — `components/ui/global-status-bar.tsx` connected chip uses
   `identity.walletShort`. It already has optional `handle` (≤14 chars) + a
   future `avatarUrl` slot. Plan: extend `ConnectedIdentity` with optional
   `variant?: AvatarVariant`; render `PlayerAvatar` + pass nickname as `handle`
   (use `formatNicknameCompact` when full > 14 chars). Note the §5 growth-rule
   comment — this is a data-slot addition (allowed), not a new variant.
   Find the caller that builds `ConnectedIdentity` (hub scaffold) and feed it.

2. **Profile** — `components/profile/profile-banner.tsx` renders
   `truncatedWallet` (prop from `profile-sheet.tsx`). Add `PlayerAvatar` + show
   the resolved name; keep wallet as a small secondary line (own surface, OK).

3. **Stats** — `components/stats/stats-page.tsx` (top minters L~623 + top-10
   L~687) uses a local `truncateWallet`. Its data is `PublicStats`
   (hall-of-fame `player` strings + `leaderboardTop10`). **Confirm OQ3**:
   `PublicStats` must be built server-side so it can carry `variant` (derive in
   the stats server builder, same as leaderboard). If any part is client-derived
   from `player` strings, derive `variant` there instead.

4. **Guest identity wiring** — `getOrCreateGuestId` + `deriveAvatarVariant` are
   built but not yet consumed by any surface for the no-wallet case. Header /
   profile should show the guest avatar+nickname when `!address`. Client-gate to
   avoid SSR hydration mismatch (spec edge case + AC).

5. **Optional clean integration**: instead of per-surface, consider extending
   `useDisplayName` to compute `generatedNickname` (from address+tokens) and
   return `variant` — then header/profile/arena names all swap at once. **High
   VR blast radius** (every name display changes) — do it deliberately with a
   full VR refresh, not at session end.

6. **VR baselines** — the leaderboard sheet markup changed (avatars added), so
   `vr*-leaderboard*` baselines will drift. Refresh with the project recipe:
   clean `.next` + `PORT=3947 pnpm dev` + `BASE_URL` + `--update-snapshots`
   (`feedback_vr_baseline_discipline`). Not yet done — **deferred**.

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
