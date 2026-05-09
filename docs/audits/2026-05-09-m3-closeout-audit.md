# M3 Closeout Audit — 2026-05-09

**Decision**: M3 (CandyCard migration) closes with **welcome-overlay as its sole migrated surface**. The original M3 backlog (4 additional candidates) is rejected by structural audit and lifted into a new initiative — **M3.5 Scene-Rooted UI Vocabulary** — under separate spec.

## Original M3 plan (from 2026-05-09 handoff, pre-audit)

The M3 first-migration handoff (`docs/handoffs/2026-05-09-m3-shipped-handoff.md`) listed 4 follow-up candidates:

| Candidato | Tag-based ranking | Atmosphere |
|---|---|---|
| `mini-arena-bridge-slot.tsx` | low risk (baselines exist) | amber |
| `coach-welcome.tsx` | medium (flag-gated) | gold |
| `daily-tactic-card.tsx` | medium (daily rotation) | amber |
| `coach-paywall.tsx` | high (revenue critical) | mixed |

The next-session plan was to pick `mini-arena-bridge-slot.tsx` as the second M3 migration.

## Findings of structural audit (this session)

Inspecting each candidate against the CandyCard contract (DESIGN_SYSTEM §15 — *"residential content surface… cards are presentational, not pressable"*) revealed all 4 are mismatches:

| Surface | Real form | Mismatch |
|---|---|---|
| `mini-arena-bridge-slot.tsx` (compact, only live path) | Round 48×48 `<button>` icon-only pill | `<button>` vs `<section>`; pressable vs presentational |
| `mini-arena-bridge-slot.tsx` (non-compact) | Horizontal `<button>` action banner | Dead code — no live consumer |
| `daily-tactic-card.tsx` (compact, only live path) | Round 48×48 `<button>` icon-only pill | Same as bridge slot |
| `daily-tactic-card.tsx` (non-compact) | Horizontal `<button>` action banner | Dead code — no live consumer |
| `coach-welcome.tsx` | Outer `<div>` (unframed) + inner `candy-frame-gold` pricing block (horizontal) | Split-frame pattern; whole-surface migration would add unwanted frame to outer |
| `coach-paywall.tsx` | 2-col grid of `<button>` packs | All pressable; tile shape, not card |
| `action-pin.tsx tone="claim"` | Round/full `<button>` with press animation | All pressable; press feedback REQUIRED, not neutralized |

Additionally, `NEXT_PUBLIC_ENABLE_COACH=true` in production (corrected during session by user) — so `coach-welcome` is NOT flag-protected; "low risk" assumption was wrong.

## Root cause: backlog tagging vs. structural fit

The original M3 backlog was constructed by **atmosphere tag** (`amber`/`gold`) and **test coverage** ("baselines exist"). Neither metric audits *form*. CandyCard requires content-block (vertical, slotted) + presentational (no press) shape. Of the 5 listed candidates, only `welcome-overlay` met both criteria. The rest are CTAs that need `<button>` semantics + visible press feedback — properties CandyCard explicitly neutralizes.

This is consistent with the M2 design: CandyCard is the **residential** companion to CandyGlassShell (modal). Neither was designed for pressable CTAs. The visible `candy-frame-amber|gold` token system is shared (tokens are atomic), but the *primitive contract* differs.

## Decision

1. **M3 closes** with `welcome-overlay.tsx` as its sole migration. Commits `48b339b..1bcc006` (refactor + assert), already pushed to `origin/main`.
2. **All 4 backlog candidates rejected** for M3. Lifted into M3.5 Scene-Rooted UI Vocabulary.
3. **M3.5 supersedes** the originally-imagined `<CandyButton>` direction. Instead of a single sibling primitive that mirrors CandyCard's slot architecture, M3.5 introduces a **5-primitive diegetic family** rooted in the scene's existing visual asset library (stones, wood banners, treasure chests, principal button, gem pills). See spec for details.

## Pivot to M3.5 — Scene-Rooted UI Vocabulary

**Strategic input** (Sally UX consultation, this session): the project has a complete environmental asset library (`design/new-assets-chesscito/` — 10 stones, plants, trees, mushroom, frog, portal, wood banners, treasure chests, gem pill, principalbutton.png) that the codebase does not consume. The chrome reads "clean but generic" rather than "Chesscito's bosque you can touch." Royal Match-style reference imagery (provided by user) shows the destination: **every CTA is a physical object in the scene**, not abstract chrome.

The 4 rejected M3 candidates align with this vision:
- Round buttons → stones (`<StonePedestal>`)
- Paywall packs → treasure chests (`<TreasureTile>`)
- Primary CTAs → principalbutton.png (`<PrincipalButton>`)
- State banners → wood banners (`<WoodBanner>`)
- Counters → gem pills (`<GemBadge>`/`<GemButton>`)

## Artifacts produced this session

| Artifact | Path |
|---|---|
| Spec v1.0 | `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-design.md` |
| Red-team review | `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-redteam.md` |
| This audit | `docs/audits/2026-05-09-m3-closeout-audit.md` |
| Session handoff | `docs/handoffs/2026-05-09-scene-rooted-vocabulary-handoff.md` |

## Asset readiness (2026-05-09)

User generated all P0 assets requested during session:

| Asset | Path | Generated |
|---|---|---|
| Wood banner blank (3 sizes) | `design/new-assets-chesscito/wood-banner-blank-{short,medium,large}.png` | ✅ This session |
| Treasure chest small/large | `design/new-assets-chesscito/treasure-chest-{small,large}.png` | ✅ This session |
| Gem pill base | `design/new-assets-chesscito/gem-pill-base.png` | ✅ This session (P1 bonus) |
| 10 stones | `design/new-assets-chesscito/piedra{1-10}.png` | ✅ Pre-existing |
| Principal button | `design/new-assets-chesscito/principalbutton.png` | ✅ Pre-existing |

Per Asset Versioning Policy in spec: assets are **current iteration, swappable** without primitive contract change. All assets are 1× PNG; finals (WebP, resolution variants, color tonings) deferred.

## Lessons captured

1. **Backlog by tag is not backlog by structure.** Atmosphere tokens and test coverage are necessary but insufficient signals for primitive migration fitness. Future migration sprints should include a *structural audit* gate before queuing candidates.
2. **Asset libraries that the codebase doesn't consume yield generic surfaces.** Visual references should land *in the spec*, not after migration. This session's pivot only happened because the user proactively shared the asset directory and reference imagery during planning.
3. **Press feedback is a primitive-defining property.** A token system (`candy-frame-amber`) can be shared across pressable and presentational primitives; the *primitive itself* must commit to one or the other. Conflating them produces mismatches like the M3 backlog.

## Next session

Per spec red-team verdict (READY): `/tdd` implementation of the 5-primitive scene-rooted vocabulary, in this order:

1. `<StonePedestal>` (highest reuse — 2 of 4 backlog surfaces)
2. `<TreasureTile>` (paywall blocker)
3. `<PrincipalButton>` (action-pin composition target)
4. `<WoodBanner>` (no v1 migration target; spec-doc only or build minimal)
5. `<GemBadge>` + `<GemButton>` (no v1 migration target; spec-doc only or build minimal)

Halt before migration; await user approval to begin canary migration of `daily-tactic-card.tsx` (compact path).
