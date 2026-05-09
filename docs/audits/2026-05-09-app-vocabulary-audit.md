# App Vocabulary Audit (M3.5 → unified diegetic vocabulary)

**Date**: 2026-05-09
**Trigger**: User feedback after M3.5 closeout — "only 4 surfaces shipped diegetic; rest of app still legacy candy-frame. Need Sally to lead full unification."
**Method**: 4 parallel sub-agents audited disjoint surface clusters. Each report saved to `docs/audits/2026-05-09-vocab-audit-<cluster>.md`.

## TL;DR

- **54 surfaces audited** across 4 clusters (`/exercises`, `/arena+/victory`, `/coach+/pro+/trophies`, `/landing+chrome`).
- **~26 surfaces require migration** to diegetic primitives. **~28 stay as-is** (intentionally non-diegetic: dock items, error states, web-style nav, static content, mailto links).
- **All 5 M3.5 primitives find homes**: `<PrincipalButton>` is the heavy lifter (~16 homes); `<TreasureTile>` gains 2 new homes; `<GemBadge>` activates from 0 → 4 homes; `<WoodBanner>` activates from 0 → 2 homes; `<StonePedestal>` already in canon, gains ~1 candidate.
- **Rec: 3-sprint migration plan** — Sprint 1 (~10 commits, all P0 ceremonial CTAs) → Sprint 2 (~8 commits, P1 + activates dormant primitives) → Sprint 3 (~5 commits, collectibles + frames). P2 polish (~7 surfaces) deferred / batched later.

## Cluster reports

| Cluster | Audit doc | Surfaces audited | P0 | P1 | P2 | NO-CHANGE |
|---|---|---:|---:|---:|---:|---:|
| `/exercises` ecosystem | [`vocab-audit-exercises.md`](./2026-05-09-vocab-audit-exercises.md) | 14 | 6 | 4 | 2 | 2 |
| `/arena` + `/victory` | [`vocab-audit-arena-victory.md`](./2026-05-09-vocab-audit-arena-victory.md) | 12 | 2 | 5 | 3 | 2 |
| `/coach` + `/pro` + `/trophies` | [`vocab-audit-coach-pro-trophies.md`](./2026-05-09-vocab-audit-coach-pro-trophies.md) | 11 | 1 | 4 | 2 | 4 |
| `/landing` + chrome + secondary | [`vocab-audit-landing-chrome.md`](./2026-05-09-vocab-audit-landing-chrome.md) | 17 | 3 | 1 | 0 | 13 |
| **Totals** | — | **54** | **12** | **14** | **7** | **21** |

## P0 migration order (Sprint 1)

Highest visibility / every-session ceremonial CTAs. Estimated ~10 commits.

| # | Surface | File | → Primitive | Notes |
|--:|---|---|---|---|
| 1 | ActionPin non-claim variants (submitScore + useShield + claimBadge sizes pin/full) | `redesign/action-pin.tsx` | `<PrincipalButton size="large">` for full size; pin size keeps current geometry | Excludes retry/connect/switchNetwork (no diegetic fit; keep ActionPin atom). Largest blast — touches every exercise's submit surface |
| 2 | MissionBriefing play CTA | `exercises/mission-briefing.tsx:61-70` | `<PrincipalButton size="large">` | First-impression on every piece intro |
| 3 | BadgeSheet claim button | `exercises/badge-sheet.tsx:134-145` | `<PrincipalButton size="medium">` with trophy icon | Ceremonial badge claim moment |
| 4 | ShopSheet buy primary | `exercises/shop-sheet.tsx:203-216` | `<TreasureTile size="small">` OR `<PrincipalButton>` wrapper | Decision: tile for "treasure shop" framing vs button for clarity. Likely PrincipalButton |
| 5 | Arena Claim Victory CTA | `arena/victory-celebration.tsx:100-114` | `<PrincipalButton size="large">` | Mint-fee primary; most ceremonial action |
| 6 | Arena Start Match CTA | `arena/arena-entry-panel.tsx:293-302` | `<PrincipalButton size="large">` | Entry-gate to the arena ritual |
| 7 | Landing hero primary | `landing-page.tsx:93-97` | `<PrincipalButton size="large">` | Conversion driver, every visitor |
| 8 | Landing final CTA | `landing-page.tsx:817-820` | `<PrincipalButton size="large">` | Second conversion point on long-scroll |
| 9 | ProSheet main CTA | `pro/pro-sheet.tsx` | `<PrincipalButton size="large">` | Premium funnel CTA |
| 10 | Landing header nav primary | `landing-page.tsx:56-60` | `<PrincipalButton size="medium">` | First-screen secondary entry |

## P1 migration order (Sprint 2 — activates dormant primitives)

Estimated ~8 commits. Activates `<WoodBanner>` and `<GemBadge>` from 0 consumers.

| Surface | File | → Primitive | Activates |
|---|---|---|---|
| BadgeSheet "Owned" pill | `exercises/badge-sheet.tsx:129-132` | `<GemBadge>` | `<GemBadge>` ✨ |
| ProActiveBadge pill | `pro/pro-active-badge.tsx` | `<GemBadge>` (ACTIVE/EXPIRING tones) | consolidates |
| MissionDetailSheet stats row (score + time) | `exercises/mission-detail-sheet.tsx:130-164` | `<GemBadge>` × 2 | adds homes |
| CoachPanel history banner | `coach/coach-panel.tsx` | `<WoodBanner>` | `<WoodBanner>` ✨ |
| Arena Play Again / Retry / Learn CTAs | `victory-celebration.tsx`, `victory-claim-success.tsx`, `victory-claim-error.tsx`, `arena-entry-panel.tsx:169-177` | `<PrincipalButton size="medium">` | secondary tier |
| CoachFallback secondary CTA | `coach/coach-fallback.tsx` | `<PrincipalButton size="medium">` | upsell |
| BadgeSheet navigation button | `exercises/badge-sheet.tsx:322-335` | `<PrincipalButton size="large">` | post-claim continuation |
| Victory page accept-challenge CTA | `app/victory/[id]/page.tsx:168-174` | `<PrincipalButton size="large">` | full-page primary |

## P1 collectibles + frames (Sprint 3)

Estimated ~5 commits.

| Surface | File | → Primitive | Notes |
|---|---|---|---|
| AchievementsGrid earned cards | `trophies/achievements-grid.tsx` | `<TreasureTile variant="achievement">` | Add EARNED ribbon |
| MissionDetailSheet journey rail frame | `exercises/mission-detail-sheet.tsx:175-187` | `<WoodBanner>` | Adds 2nd home for WoodBanner |
| ShopSheet secondary "Buy with CELO" | `exercises/shop-sheet.tsx:218-227` | `<GemButton>` with numeric value chip | Adds GemButton consumer |
| Landing featured plan tier CTA | `landing-page.tsx:532-553` | `<PrincipalButton size="medium">` | Monetization surface |
| Arena difficulty pill (tactical) | `app/arena/page.tsx:1077-1089` | Evaluate `<StonePedestal size="small">` if geometry fits | May stay bespoke |

## P2 deferred (batch later)

7 surfaces — locked state pills, share buttons, claimed badge cosmetics, info banners. Low visibility, can ship as a "polish pass" after Sprints 1–3.

## Out of scope (intentional non-diegetic — 21 surfaces)

These surfaces correctly stay in their current treatment:

- **Dock items** (per DESIGN_SYSTEM §8) — HUD overlay, not in-game vocabulary
- **Error retry buttons** (rose tones override diegesis universally)
- **Resign confirmation pattern** (`arena-action-bar.tsx`) — already excellent; document as exemplar for destructive actions
- **Web-style navigation** on `/about`, `/support`, `/privacy`, `/terms` (SEO + public crawlability)
- **Mailto: links** (sponsor contact, support contact) — web idiom
- **Static informational content** (privacy/terms text) — not interactive
- **PiecePickerSheet selection grid** — selection control, not CTA
- **ContextualActionSlot orchestrator** — wrapper, atoms migrate inside
- **Back-to-Hub link variants** in modals — secondary text-link pattern
- **PRO Chip in status bar** — already harmonized post `619dbe8`
- **TrophyList error card** — error signal
- **PRO Active CTA confirmation container** — frosted glass acceptable for low-attention state
- **Hero illustration / explainer cards** on landing — informational, not interactive

## Primitive utilization map (post-migration)

| Primitive | Pre-audit consumers | Post-Sprint-3 consumers | New homes |
|---|---:|---:|---|
| `<StonePedestal>` | 2 (daily, mini-arena) | ~3 | difficulty pill (maybe) |
| `<TreasureTile>` | 2 (coach packs) | ~4 | shop items, achievements |
| `<PrincipalButton>` | 1 (action-pin claim+full) | **~16** | every ceremonial CTA across app |
| `<WoodBanner>` | **0** | **~2** ✨ | coach panel banner, mission journey frame |
| `<GemBadge>` | **0** | **~4** ✨ | owned pill, PRO badge, mission stats × 2 |
| `<GemButton>` | 0 | ~1 ✨ | shop secondary CTA |

All primitives find at least one home. The dormant trio (WoodBanner, GemBadge, GemButton) activates cleanly without forced placements.

## Recommendations for next step (Sally)

This audit is the inventory. Sally should pick it up and author the migration spec with:

1. **Sprint scoping**: confirm 3-sprint breakdown; calibrate effort per primitive (PrincipalButton may need a "secondary" variant to handle the wide range from "play again" to "claim mint").
2. **Primitive API gaps**:
   - `<TreasureTile>` may need `variant="achievement"` + `EARNED` ribbon for AchievementsGrid migration.
   - `<GemBadge>` may need a `tone` prop (ACTIVE/EXPIRING/OWNED states).
   - `<PrincipalButton>` may need a `secondary` size/variant for less-ceremonial CTAs.
3. **Test strategy**: each migration must preserve testids, ARIA labels, and onClick contracts. Mass migrations risk hidden testid drift — Sally should propose a contract-preserving wrapper pattern (similar to the M3.5 `<span data-testid>` wrapper used in daily-tactic).
4. **Per-sprint exit criteria**: visual regression baseline (when team grows beyond single dev) + suite green + manual eyeball at 360×740.
5. **Asset audit**: confirm WoodBanner + GemBadge assets are production-ready (handoff said they were "working drafts" — final assets may unlock more uses).

## Cross-references

- M3.5 spec: `docs/superpowers/specs/2026-05-08-scene-rooted-vocabulary-spec-r4.md`
- M3.5 closeout handoff: `docs/handoffs/2026-05-09-m3-5-migrations-shipped-handoff.md`
- DESIGN_SYSTEM.md §16 (5 primitives matrix + asset versioning)
- Top-zone density audit (overlaps with /exercises chrome): `docs/audits/2026-05-09-exercises-top-zone-audit.md`
