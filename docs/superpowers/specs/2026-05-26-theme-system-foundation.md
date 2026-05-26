# Theme System Foundation — Audit & Adoption Playbook

**Owner:** Wolfcito · **Co-pilot:** Claude
**Date:** 2026-05-26
**Status:** v1 shipped (registry + hooks + KingdomAnchor migrated)
**Cluster:** A4 (Visual polish foundation — replaces the original "PRO recognition" framing per the 2026-05-26 strategic pivot)

---

## §1 — Why a theme system, not "PRO recognition"

The original A4 framing was "Sally audits 3 surfaces, ship PRO-variant assets per surface". That model produces **2 apps under one repo** (free vs PRO codepaths everywhere), with:
- Asset duplication overhead.
- Per-surface branching scattered across components.
- Zero leverage when we want a seasonal pack (Halloween, Christmas).

The corrected framing: **one app, N themes**. Each theme is a self-contained bundle of asset basenames keyed by stable semantic slot ids (`hub.portal`, `board.background`, …). Switching themes is a registry update, not a refactor.

Benefits:
- **PRO recognition** becomes one theme (`pro-gold-leaf`) among several. A subscriber sees the gold-leaf theme; the codepath is identical to a Halloween-pack buyer seeing the spooky theme.
- **Seasonal monetization**: Halloween / Christmas / Lunar New Year packs become Shop itemIds — bought once, owned forever, swap at will from the AccountSheet picker.
- **No rework on polish**: components keep hardcoded paths until the surface is marked "ready-to-theme". When a screen reaches polish-final, migrate it with a single `useThemeAsset(key)` swap. Polish and themeing don't compete for the same lines.

The user vision quote: *"la idea no es tener 2 apps pero si tener listo como packs que ayuden a cambiar visualmente toda el app o darle un tema, ejemplo ahora es tema candy con bosque pero si mañana es halloween podemos readaptarla con solo cambiar assets"*.

---

## §2 — Architecture

### §2.1 Registry — single source of truth

`apps/web/src/lib/themes/theme-registry.ts` exports:
- `ThemeAssetKey` — the union of all themable slot ids. New slots get added here as surfaces migrate.
- `ThemeAssetVariant = "default" | "pro"` — variant within a theme (NOT a separate theme).
- `ThemeAssetEntry = { default: string; pro?: string }` — basenames without extension.
- `ThemeDefinition = { id, name, assets: Record<ThemeAssetKey, ThemeAssetEntry> }`.
- `THEMES: Record<string, ThemeDefinition>` — every registered theme.
- `DEFAULT_THEME_ID = "candy-forest"` — the look we ship today.

### §2.2 Hooks — consumer API

`apps/web/src/lib/themes/use-active-theme.ts`
- `useActiveTheme(): string` — returns the active theme id. v1: hardcoded to `DEFAULT_THEME_ID`. v2+: localStorage + ownership + AccountSheet picker.

`apps/web/src/lib/themes/use-theme-asset.ts`
- `useThemeAsset(key, variant?): string` — returns the basename. Falls back to `default` when a requested `pro` variant doesn't exist on the active theme. **Never returns undefined** — every callsite gets a valid string.

`apps/web/src/lib/themes/use-owned-themes.ts`
- `useOwnedThemes(): readonly string[]` — returns the list of theme ids the current wallet owns. v1: just `[DEFAULT_THEME_ID]`. v2+: reads Shop ownership + PRO status.

### §2.3 Variant semantics

`pro` is **optional** per theme. A theme that targets PRO subscribers (`pro-gold-leaf`) probably ships `default` only — PRO users see the same gold-leaf assets without an extra tier. A theme like `candy-forest` ships both variants because the current model has a PRO portal swap. **Themes never break** — missing variants degrade gracefully to `default`.

---

## §3 — Monetization model

Each theme is a Shop SKU candidate:
- `setItem(N, priceUsd6, true)` on Celo Mainnet registers the theme as purchasable.
- Buying credits the wallet's `themes:owned:<wallet>` Redis key (or on-chain ledger when scale demands).
- The AccountSheet ships a theme picker that lists owned themes; picking persists the choice via `useActiveTheme` storage.

PRO sub gets `pro-gold-leaf` automatically (granted on verify-pro success, expires with the sub) — parallel to how PRO unlocks Coach unlimited today.

Seasonal packs:
- `halloween-2026`, `christmas-2026`, `lunar-new-year-2026` — each a one-time purchase.
- Limited drop windows + permanent ownership = collector dynamic.
- Stacks with PRO: a PRO user with Halloween pack picks Halloween for October, switches to gold-leaf in November.

### §3.1 Pricing reference (proposal)

| Theme | Price (USD6) | Notes |
|---|---|---|
| candy-forest (default) | free | owned by every wallet |
| pro-gold-leaf | bundled with PRO sub | $1.99/mo unlocks the theme |
| halloween-2026 | 50_000 ($0.05) | seasonal drop |
| christmas-2026 | 50_000 ($0.05) | seasonal drop |

---

## §4 — Adoption playbook

When a surface reaches polish-final (layout, content, structure stable) AND has at least one themable asset, migrate it:

1. **Inventory** — list the surface's asset paths. Identify which are theme-bound (board, pieces, backgrounds, character art) vs theme-agnostic (CandyIcon registry, brand logo, system glyphs).
2. **Register slot ids** — add `ThemeAssetKey` entries in `theme-registry.ts`. Use dotted semantic names: `board.background`, `board.pieces`, `screens.hub.bg`, `screens.arena.bg`.
3. **Populate manifest** — wire the current paths into the `candy-forest` theme's `assets` entry under each new key.
4. **Swap in component** — replace the hardcoded path with `useThemeAsset(key)`. The picture / image / image-set callsite stays the same; only the basename source changes.
5. **Run tests + VR** — registry tests assert no key is missing; component tests should be unaffected (same path served).

### §4.1 — Surface checklist (state as of 2026-05-26)

| Surface | Theme slot id(s) | Status |
|---|---|---|
| `kingdom-anchor.tsx` (hub portal) | `hub.portal` (default + pro) | ✅ **themed** (canonical example) |
| Arena board background | `board.background` | ⏳ polish-pending |
| Arena pieces | `board.pieces` (directory base) | ⏳ polish-pending |
| Exercise board background | `board.background` (same slot) | ⏳ polish-pending |
| Hub screen background | `screens.hub.bg` | ⏳ polish-pending |
| Arena screen background | `screens.arena.bg` | ⏳ polish-pending |
| Shop tile backgrounds | `shop.tile.{slug}` | ⏳ polish-pending |
| Persistent dock icons | n/a (theme-agnostic) | — |
| CandyIcon registry | n/a (theme-agnostic) | — |

**Polish-pending** = the user is still iterating on layout/content. Theme adoption waits until the surface stabilizes — adopting now risks rework when polish lands.

### §4.2 — Anti-pattern: do NOT adopt mid-polish

Adopting `useThemeAsset` while a screen is being redesigned means changing the same lines twice. The audit's golden rule:

> When a screen is in active polish, leave its asset paths hardcoded. Mark it `polish-pending` here. Migrate after polish is done.

This keeps the theme system from being a tax on polish work.

---

## §5 — Asset manifest schema

A theme's `assets` map is a flat `Record<ThemeAssetKey, ThemeAssetEntry>`. No nesting, no conditional logic — themes are pure data. Future surface slots get added by extending the `ThemeAssetKey` union; the TypeScript compiler then forces every registered theme to provide an entry for the new key.

### §5.1 Asset basename convention

`/art/themes/<theme-id>/<slot>` is the **recommended** path for future themes (single directory per theme, easy to ship as a `.zip` artifact). Existing assets live in scattered legacy paths (`/art/new-assets-chesscito/...`, `/art/redesign/...`) — those stay where they are for `candy-forest`. New themes adopt the canonical convention.

Every asset path MUST resolve to a `.png` + `.webp` + `.avif` triplet per the `image-three-formats` HARD RULE.

### §5.2 Theme pack delivery

A future "theme pack release" workflow:
1. Artist ships `<theme-id>/` directory with all required triplets.
2. PR adds the new `ThemeDefinition` to `theme-registry.ts`.
3. CI optionally runs an asset-presence linter to catch missing files.
4. Shop admin calls `setItem(itemId, price, true)` to enable purchase.
5. AccountSheet picker auto-detects the new theme via `THEMES` registry — no UI change required.

---

## §6 — Open follow-ups (deferred from v1)

1. **localStorage persistence** for `useActiveTheme` — currently hardcoded; needs `chesscito:theme:active` key.
2. **Shop wiring** — itemId → theme id mapping + verify-purchase route for theme grants.
3. **AccountSheet picker UI** — segment / list of owned themes with preview thumbnails.
4. **PRO sub → theme grant** — verify-pro adds `pro-gold-leaf` to owned themes for the sub duration.
5. **Asset-presence linter** — script that walks `THEMES` + checks every `.png/.webp/.avif` triplet exists.
6. **Theme metadata copy** — `THEME_COPY` namespace in editorial.ts for picker UI (ES/EN names + descriptions).

These all unblock when (a) the first non-default theme is ready to ship + (b) user-facing theme switching becomes a goal. Until then, the foundation is **dormant but correct** — no surface depends on these for the default look.

---

## §7 — Cross-references

- **Memory:** `project_theme_system_foundation.md` (to be created)
- **Related memory:** `project_pro_recognition_pattern.md` (now superseded — PRO recognition becomes one theme)
- **Reference impl:** `apps/web/src/components/kingdom/kingdom-anchor.tsx`
- **Strategic context:** `_bmad-output/planning-artifacts/coach-demo-redesign-discovery-2026-05-26.md` (where the V1 sequencing originally framed A4 as PRO recognition)
- **Value-prop memory:** `project_pro_value_prop_v1.md` (4 frentes — "Identidad" frente now expressed as theme ownership instead of per-surface PRO variants)
