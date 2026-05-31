# Em-dash sweep + regression guard — Handoff

**Date:** 2026-05-30 (third session of the day) · **Branch:** main · **Range:** `d8034243..974afd07` (10 commits)
**Status:** All commits pushed to `origin/main`. No production promote.

Sibling handoffs (same day):
- `2026-05-30-playercolor-callouts-vr-refresh-handoff.md` — Cluster C visor + VR baseline refresh.
- `2026-05-30-shop-cleanup-vr-settle-pro-days-handoff.md` — shop tile cleanup + PRO days-remaining sub-line.

## What shipped

10 atomic commits across two threads:

### Thread 1 — SHOP_TILE_ASSETS path-resolution test (1 commit)

`d8034243` `test(shop-catalog): assert SHOP_TILE_ASSETS icon triplets resolve on disk`

`SHOP_TILE_ASSETS` stores extensionless basenames (e.g. `/art/shop/pro`) so the consumer can build `image-set()` URL lists per format. `asset-integrity.test.ts` regexes paths matching `\.\w+$` and therefore skips these basenames; a typo would only surface during manual UI sweep. New guard: 5 entries × {avif, webp, png} = 15 `existsSync()` assertions + 1 ShopCopyKey enumeration check + 1 extensionless-basename check. 11 → 28 passing on `shop-catalog.test`.

### Thread 2 — Anti-AI-prose regression guard + 7 sweep chunks (9 commits)

The `anti-ai-prose` memory rule (2026-05-26) bans em-dash + en-dash in user-facing copy. The rule existed but nothing prevented new drift, and 222 dashes had accumulated across editorial.ts + messages/{en,es}.ts.

**Foundation commits:**

| Commit | What |
|---|---|
| `c59dbcb3` | First ceiling test on editorial.ts (em: 181 / en: 4). Counted all dashes including comments. |
| `6220ff4e` | Refactored to strip `/* */` + `//` so the count only reflects string-literal dashes. Editorial ceiling drops to 96/1 (true policy scope). |

**Sweep chunks (each commit lowers per-file ceilings to match the post-sweep count):**

| Chunk | Surface swept | em-dash delta | VR risk |
|---|---|---|---|
| 1 (`4bb4c230`) | REWARD_COPY aria + pawn lockedHint, mirrors in en/es | –62 | None (aria-only) |
| 2 (`9cf1dd89`) | Remaining aria-labels (openDetails, Training Pass, Enter Arena, PRO chip, daily tactic) + hub test fixtures | –22 | None (aria-only); 6 hub test strings updated in lockstep |
| 3 (`161e3e11`) | Page meta titles (`<head>`), mailto subjects, KingdomAnchor alt | –13 | None (renders outside any baseline) |
| 4 (`7763866c`) | SHARE_COPY (system share sheet) + HUB_V2_MASTERY ariaLabel closures | –22 | None (share sheet is OS UI; ariaLabel invisible) |
| 5 (`a268c1c5`) | TUTORIAL_COPY piece hints + CAPTURE_COPY banner + DIFFICULTY descriptions | –18 | None — tutorial banner suppressed by `hub-clean` "no overlays" setup; difficulty picker not VR'd |
| 6 (`76e58d90`) | Error toasts + failure messages (submitFailed, network, revert, signing, replay, etc.) | –25 | None — failure paths not in current baselines |
| 7 (`974afd07`) | LANDING_COPY + WHY_PAGE_COPY long-form prose | –18 | None — `/why` and landing root not VR'd |

**Convention applied across chunks:**

- Aria-labels and screen-reader strings → " — " becomes ":". SR pronounces both as a pause; no UX behavior change.
- Page meta titles → " — " becomes " · " (middot, matches the existing `"PRO · {puzzle}"` convention in HUB_HUD_COPY).
- Prose sentences → period + capitalization (two short clauses) or comma (continuation). Choose by sentence rhythm.
- Parenthetical em-dash pairs in WHY → wrapped in parens (was the cleanest split in the community-body sentence).

## Per-file ceiling state at handoff

| File | em-dash | en-dash | Original baseline | Delta |
|---|---|---|---|---|
| `editorial.ts` | **20** | 1 | 96 | –76 |
| `messages/en.ts` | **4** | 0 | 31 | –27 |
| `messages/es.ts` | **18** | 1 | 95 | –77 |
| **Total** | **42** | **2** | 222 | **–180 (–81%)** |

The ceiling test (`apps/web/src/lib/content/__tests__/anti-ai-prose.test.ts`) locks each per-file count. CI will fail if anyone adds a dash in editorial.ts or the i18n catalogs.

## What's left (42 em-dashes, all in VR-touched surfaces)

Remaining is concentrated in surfaces with active VR baselines or that surface inside the `hub-clean` snapshot. Sweeping these requires baseline refresh in the same commit per `feedback_vr_baseline_discipline.md`, and VR can't run until reboot (disk + swap red zone, see `project_disk_telemetry`).

The next sweep chunk(s) should cover:

- **Arena end-state titles** — `"Checkmate — You Win!"`, `"Checkmate — AI Wins"`, `"Stalemate — Draw"`. 3 in editorial + 2 ES mirror. **Baselines:** `vr9-arena-end-state-*` (7 variants).
- **Performance lines** — `` `Solved in ${moves} moves — ${time}` `` and the checkmate sibling. 2 in editorial + 2 ES.
- **Hub HUD / PRO chip** — `proInactiveAriaLabel` was already done in chunk 2 but `"PRO · {puzzle} — solve the board"` activeLabel, `"In progress — reconnect to verify"`, and `"Unlock PRO — full experience."` remain. **Baselines:** `hub-clean`.
- **Tagline** — `"Train your mind with pre-chess challenges — a Celo MiniPay game"`. Renders on landing meta + footer. 1 EN + 1 ES.
- **Shop unlocked toast** — `${item} unlocked — thanks for supporting Chesscito`. Transient success state.
- **Misc visible hints** — `prizePoolSoonHint`, `analysisPendingHint`, `shieldRibbon`, `shieldsStatusEmpty`, `firstStepHint`, `subtitleKeepPracticing`, `masteryDashboardAriaLabel` (the "Includes — including badge claims..." legal disclosure with two em-dashes).
- **Founders FIDE Master line** — `"...Pedagogía a cargo del Maestro FIDE César Litvinov Alarcón — más de..."` (ES).

## State at handoff

- **Branch:** `origin/main` at `974afd07` (up to date with local).
- **Production:** unchanged from `f54f6fc`.
- **Tests:** 35/35 content tests, 93/93 hub tests, 79/79 content+arena tests (all touched paths verified per chunk).
- **Disk / swap:** still red from the prior two sessions today — reboot mandatory before any VR pass.
- **No new VR baseline drift introduced** by chunks 1-7 (each was deliberately VR-safe; final chunk verification stays in the ledger).

## Outstanding work — deferred ledger (post-this-session)

1. **Em-dash sweep chunks 8+ (42 remaining)** — gated on reboot + VR baseline refresh. The ceiling test forces monotonic decrease; any future commit touching these strings can lower the ceiling as a side effect, even if it's not a dedicated sweep chunk.
2. **Carried over from the morning handoff:** verify the `hub-shop-sheet-open` VR settle fix (`1fec59c8`), hint-variant VR baselines, Founder perks UI (gated on product), shared Trophies data provider (profile first), production promote.

## Open questions for next session

- The remaining 42 are scattered. Worth grouping by VR baseline (1 chunk per baseline so each baseline refreshes cleanly) or just sweeping editorial.ts + es.ts in one big commit and accepting that 7+ baselines refresh together?
- The Foundation paragraph (`"...Pedagogía a cargo del Maestro FIDE César Litvinov Alarcón — más de 100 estudiantes acompañados, con alumnos que han competido..."`) is a HARD RULE per CLAUDE.md ("never weaken these strings to imply medical benefit"). The em-dash isn't medical, but treat the edit carefully — surface to the user before pushing if the rewrite changes the rhythm.

## Pointers

- Guard test: `apps/web/src/lib/content/__tests__/anti-ai-prose.test.ts` (3 files × 2 dashes = 6 assertions).
- Policy memory: `feedback_anti_ai_prose.md` (originated 2026-05-26 from the Coach discovery session).
- VR baseline catalog: `apps/web/e2e/visual-regression.spec.ts` (read this before picking the next chunk).
- Cluster Closure Protocol — §1 no issues to close, §2 no contracts changed, §3 MEMORY.md gets one new line for the ceiling guard pattern, §4 no feature branches.

---

Wolfcito 🐾 @akawolfcito
