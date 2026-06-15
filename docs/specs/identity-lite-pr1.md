# Spec — identity-lite-pr1

**Date**: 2026-06-15
**Status**: ready (P0×3 folded from red-team 2026-06-15)
**Scope**: PR1 (read-only). DB + edit-via-API is PR2 (out of scope here).

## Problem

Chesscito surfaces players as a raw truncated wallet (`0x8f3…91ab`) in the
header, leaderboard, stats page and profile. That reads as cold/technical and
gives the game no personality. A visible **Avatar + Nickname** layer makes every
player legible and on-brand, and stops exposing wallet strings as the primary
identity.

A partial identity layer already exists and MUST be reused, not duplicated:
- `truncateWallet(address)` — `lib/profile/display-name.ts:3`
- `resolveDisplayName({address, customName, talentProtocolName})` — precedence
  custom name → Talent → truncateWallet → visitor — `display-name.ts:24`
- `useDisplayName(address)` — localStorage custom name (`chesscito:display-name:<addr>`),
  editable, already wired into `ProfileSheet`'s edit dialog — `hooks/use-display-name.ts`
- Header primitive `GlobalStatusBar` already has optional `handle` (≤14 chars)
  and `avatarUrl` slots — `components/ui/global-status-bar.tsx:30`

## Goal

Every player renders as a deterministic, on-brand **avatar + nickname** instead
of a raw wallet, with zero new database, derived purely from their wallet (or a
local guest id), and the existing custom-name override still winning.

## Non-goals (PR1)

- No Supabase table, migration, or `GET/PATCH /api/player-profile` (that is PR2).
- No cross-device nickname persistence (edits stay in localStorage as today).
- No avatar chooser / reroll / "3 variants" picker (PR2 edit surface).
- No new art assets (reuse `public/art/pieces/*`).
- No globally-unique nickname enforcement; collisions are allowed.
- No change to Talent Protocol resolution.
- Guests never enter the global leaderboard (already true — they have no wallet).

## Contracts (SDD)

### New module — `lib/identity/identity-lite.ts` (pure, isomorphic)

Same code runs on server (leaderboard/stats derivation) and client (header,
own-row, guest). Derivation MUST be byte-for-byte identical on both.

```ts
export type PieceKey = "pawn" | "knight" | "rook" | "bishop" | "queen" | "king";
export type StyleKey = "golden" | "green" | "blue" | "coral" | "tropical" | "bright";

export const PIECES: readonly PieceKey[] =
  ["pawn", "knight", "rook", "bishop", "queen", "king"] as const;
export const STYLES: readonly StyleKey[] =
  ["golden", "green", "blue", "coral", "tropical", "bright"] as const;

/** Deterministic, locale-agnostic visual + naming descriptor.
 *  Irreversible: 6 × 6 × 10_000 ≈ 360k space; does NOT leak the wallet. */
export type AvatarVariant = {
  piece: PieceKey;
  style: StyleKey;
  /** 0..9999, rendered as zero-free "#<number>". */
  number: number;
};

/**
 * Stable 32-bit FNV-1a hash of the lowercased seed. Specified explicitly so
 * server and client produce identical variants.
 *   hash = 2166136261; for each byte: hash = (hash ^ byte) * 16777619 >>> 0
 */
export function hashSeed(seed: string): number;

/** Derive the variant. Each axis hashes a SALTED seed so piece/style/number
 *  are independent (red-team P1: avoid correlated slices of one hash):
 *   piece  = PIECES[hashSeed(seed + ":p") % 6]
 *   style  = STYLES[hashSeed(seed + ":s") % 6]
 *   number = hashSeed(seed + ":n") % 10000
 *  Never throws — any string is a valid seed. */
export function deriveAvatarVariant(seed: string): AvatarVariant;

/** Opaque, irreversible row key for the leaderboard (server-only input is the
 *  full wallet). Used to dedupe the caller's own row against the top-10 list
 *  WITHOUT shipping any wallet. `"id_" + hashSeed(addr.toLowerCase()).toString(36)`. */
export function deriveRowId(walletLower: string): string;

/** Localized tokens injected by the caller from the next-intl bundle. */
export type NicknameTokens = {
  pieces: Record<PieceKey, string>;   // localized piece nouns
  styles: Record<StyleKey, string>;   // localized style adjectives
  guestPrefix: string;                // "Guest" / "Invitado"
  /** Order template. EN: "{style} {piece} #{number}".
   *  ES: "{piece} {style} #{number}". Tokens: {piece} {style} {number}. */
  template: string;
};

/** Format the visible nickname from a variant + localized tokens.
 *  EN → "Golden Knight #4821"  |  ES → "Caballo Dorado #4821". */
export function formatNickname(v: AvatarVariant, tokens: NicknameTokens): string;

/** Guest variant: same derivation over the guest seed; prefixes the nickname
 *  with tokens.guestPrefix → "Guest Knight #3842" / "Invitado Caballo #3842". */
export function formatGuestNickname(v: AvatarVariant, tokens: NicknameTokens): string;

/** Compact form for the ≤14-char header slot: drops the style adjective.
 *  "Golden Knight #4821" → "Knight #4821". */
export function formatNicknameCompact(v: AvatarVariant, tokens: NicknameTokens): string;

export type NicknameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "too_short" | "too_long" | "bad_chars" | "blocked" };

/** Length 3–18; allow letters, numbers, space, _ , - ; reject a small
 *  blocklist. Pure; reused by the existing edit dialog (low-risk upgrade). */
export function validateNickname(input: string): NicknameValidation;
```

### Guest identity — `lib/identity/guest-id.ts` (client-only)

```ts
export const GUEST_STORAGE_KEY = "chesscito_guest_id";

/** Read existing guest id or create + persist one (crypto.randomUUID()).
 *  On localStorage failure returns an ephemeral in-memory id for the session
 *  (never throws, never blocks render). Guest seed = `guest:<id>`. */
export function getOrCreateGuestId(): string;
```

### Extend `resolveDisplayName` (backward compatible)

```ts
export type ResolveDisplayNameArgs = {
  address: `0x${string}` | undefined;
  customName?: string;
  talentProtocolName?: string;
  /** NEW. When present, replaces truncateWallet as the wallet-backed default.
   *  Omitted → current behavior (tests stay green). */
  generatedNickname?: string;
};
// New precedence: customName → talent → generatedNickname → truncateWallet → visitor
```

### Leaderboard API — server-computed identity (`lib/server/leaderboard.ts`)

```ts
export type LeaderboardRow = {
  rank: number;
  rowId: string;           // NEW: opaque dedupe key (deriveRowId) — NOT a wallet
  variant: AvatarVariant;  // NEW: derived server-side from the FULL wallet
  score: number;
  isVerified?: boolean;
  hasOnchain?: boolean;
  /** ONLY on the caller's own row (`?player=` path): their truncated address,
   *  which they already know. Foreign rows NEVER carry it (red-team P0-1). */
  walletShort?: string;
};
// toApiRow derives variant + rowId from dbRow.player.toLowerCase() BEFORE
// truncating, then DISCARDS the wallet. No `0x…` is emitted for foreign rows.
// Client formats the nickname per-locale + paints the avatar from `variant`.
// Own-row dedupe: the `?player=` row and any matching top-10 row share `rowId`;
// the client renders ONE canonical row and applies the custom-name override
// to it (red-team P0-2: no double identity).
```

The same `variant` enrichment applies to the Stats data path (`PublicStats`
hall-of-fame + top-10 builders) so `/stats` renders identity, not wallets.

### UI components — `components/identity/`

```ts
// player-avatar.tsx
type PlayerAvatarProps = {
  variant: AvatarVariant;
  size?: "sm" | "md" | "lg";  // 20 / 28 / 44 px
  className?: string;
};
// Renders: colored disc (style → bg + soft glow) + white piece sprite
// (next/image, /art/pieces/w-<piece>.<fmt>) centered. No remote images.

// player-identity-pill.tsx
type PlayerIdentityPillProps = {
  variant: AvatarVariant;
  name: string;               // already-resolved (custom > generated)
  size?: "sm" | "md" | "lg";
  className?: string;
};
```

Style → disc color palette (constants in the module + CSS custom props), 6
entries: golden / green / blue / coral / tropical / bright.

## Behavior

1. Given a connected wallet, when any identity surface renders, then it shows a
   deterministic nickname + avatar derived from `deriveAvatarVariant(addr.toLowerCase())`.
2. Given the same wallet, every surface and every session shows the SAME variant.
3. Given two different wallets, they (with high probability) show different
   variants; identical variants are allowed and never error.
4. Given a wallet with a custom name set (`useDisplayName`), the custom name wins
   over the generated nickname everywhere it is available client-side.
5. Given no wallet, when the app loads, then a guest id is created/loaded and the
   user sees a guest nickname + avatar ("Guest <Piece> #NNNN" / locale).
6. Given a guest, they appear only in local/own UI, never in the global leaderboard.
7. Given the header connected chip, it shows the nickname in `handle`; when the
   full nickname exceeds 14 chars it uses `formatNicknameCompact`.
8. Given the leaderboard, each row renders avatar + nickname from `row.variant`,
   keyed by `row.rowId`; no `0x…` wallet is present for foreign rows.
9. Given the user's OWN row (matched by `rowId`), the `?player=` row and any
   top-10 duplicate collapse to ONE canonical row; when a custom name is set the
   client overrides that single row's name with it (server nickname for everyone
   else). No double-identity rows.
10. Given `/es`, nicknames render in Spanish word order; `/en` in English order;
    both derived from the same variant.
11. Given the existing edit dialog, when the user submits a nickname, it is run
    through `validateNickname`; invalid input is rejected inline (no persistence).

## Edge cases

- **localStorage unavailable** (private mode / SSR): guest id falls back to an
  ephemeral in-memory id; never throws. Identity components that depend on
  localStorage render client-side only (or a stable placeholder server-side) to
  avoid hydration mismatch.
- **SSR/hydration**: wallet-derived variants are pure → safe to render on server.
  Guest variants depend on localStorage → must be client-gated.
- **Server ↔ client drift**: any change to `hashSeed`/`deriveAvatarVariant` must
  ship to both; a shared module + a parity test prevents divergence.
- **Malformed `player` string** from DB: derivation accepts any string, never throws.
- **Long nickname overflow** at 390px: pill/header truncate with ellipsis +
  max-width; header prefers compact form.
- **Collisions**: allowed by design; document, do not dedupe.
- **Empty leaderboard / missing rows**: no row breaks; variant always derivable.
- **Hash bias**: FNV-1a over distinct slices gives acceptable spread for 360k space.

## Acceptance criteria

- [ ] `deriveAvatarVariant` is deterministic (same seed → same variant) and
      total (never throws) — unit test incl. empty string + non-hex input.
- [ ] Server and client produce identical variants for the same wallet — parity test.
- [ ] `formatNickname` renders EN order and ES order from one variant — unit test.
- [ ] `validateNickname` enforces 3–18, allowed charset, blocklist — unit test.
- [ ] `getOrCreateGuestId` persists + is stable across reads; survives a
      localStorage throw with an ephemeral id — unit test.
- [ ] `resolveDisplayName` precedence: custom > talent > generatedNickname >
      truncateWallet > visitor; omitting `generatedNickname` keeps legacy output.
- [ ] `/api/leaderboard` returns `variant` + `rowId` per row; foreign rows carry
      NO `0x` substring at all (not just no 40-hex) — route test asserts it; own
      row (`?player=`) may carry `walletShort`.
- [ ] Own row dedupes by `rowId`: never rendered twice — leaderboard unit test.
- [ ] No React hydration warning on hub + profile with (a) guest and (b)
      wallet+custom name — identity components client-gated with a stable
      first-paint placeholder.
- [ ] `PlayerIdentityPill` exposes `aria-label={name}`; inner sprite is
      decorative (`alt=""`) — a11y test.
- [ ] `deriveAvatarVariant` spreads acceptably across pieces/styles over N
      synthetic wallets (salted-seed distribution sanity test).
- [ ] `PlayerAvatar` renders disc + piece for every (piece, style) without a wallet.
- [ ] `PlayerIdentityPill` shows nickname, not a raw `0x…`.
- [ ] Leaderboard, stats, header, profile-banner render avatar + nickname; no raw
      wallet shown as the PRIMARY identity on any of them.
- [ ] Own leaderboard row reflects the user's custom name when set.
- [ ] Full suite green (baseline 3730) + new tests; VR baselines refreshed for the
      four touched surfaces with validated diffs.

## Out of scope / future (PR2)

- `player_profiles` table + migration + `GET/PATCH /api/player-profile`.
- Cross-device nickname persistence + server-side custom names on leaderboard.
- Avatar chooser / reroll (≤3 variants) in an edit sheet.
- Server-side moderation / global uniqueness.

## Open questions

- OQ1: Style→color hex values — propose a palette derived from existing CTA/theme
  tokens; founder confirms or overrides during implementation (design-call).
- OQ2: White piece set (`w-<piece>`) vs black (`b-<piece>`) on the colored disc —
  pick by contrast during visual QA; default `w-` (light silhouette).
- OQ3: Stats page data path — confirm `PublicStats` is built server-side so it can
  carry `variant`; if any part is client-derived from `player` strings, derive there.
