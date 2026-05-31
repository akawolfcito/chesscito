# Em-dash sweep cluster — CLOSED + founder attribution fix

**Date:** 2026-05-30 (fourth session of the day) · **Branch:** main · **Range:** `482eacef..547a376f` (6 commits)
**Status:** All commits pushed to `origin/main`. No production promote.

Sibling handoffs (same day):
- `2026-05-30-playercolor-callouts-vr-refresh-handoff.md` — Cluster C visor + VR baseline refresh.
- `2026-05-30-shop-cleanup-vr-settle-pro-days-handoff.md` — shop tile cleanup + PRO days-remaining sub-line.
- `2026-05-30-em-dash-sweep-handoff.md` — chunks 1-7 (the morning sweep that closed at 42 remaining).

This handoff covers the afternoon/evening session that closed the cluster (chunks 8-12) plus a tactical founder-attribution fix surfaced mid-sweep.

## What shipped

6 atomic commits across two threads:

### Thread 1 — Em-dash sweep chunks 8-12 (5 commits)

The `anti-ai-prose` rule (2026-05-26) banned em + en-dash in user-facing copy. The morning ceiling test (chunk 1-7) locked the count at 42 remaining. This session walked it to **0**.

| Chunk | Commit | What | VR refresh? |
|---|---|---|---|
| 8 | `482eacef` | Arena end-state titles (loss + stalemate) + performance lines (EN + ES). Convention: full sentences → period; compact stats → middot. | `vr9-arena-end-state-*` refreshed (×7), regenerated identical PNGs — the swept strings live on the loss/stalemate path which the existing baselines don't render (all 6 win variants + resigned use unchanged strings). |
| 9 | `db9529b8` | Hub HUD / PRO chip strings: `activeLabel`, `inFlightLabel`, `proDiscoveryAriaLabel` + ES mirrors. Test fixture in `hub-scaffold-client.test.tsx` updated in lockstep. | `hub-clean` refreshed, regenerated identical PNG — `hub-clean` renders the anonymous /hub which shows the PRO chip in **inactive** state (different string); `activeLabel` only renders when PRO is active. |
| 10 | `f68470ad` | Misc visible hints + tagline + shop toast + legal disclosure. 7 EN + 6 ES strings including the `"Certain actions — … — interact"` parenthetical pair (wrapped in parens). | VR-safe by absence: tagline/landing not VR'd per chunk 7; legal not VR'd per chunk 3; toast transient. |
| 11 | `767eaa31` | Shields hint + purchase result subtitle + arena locked aria + ES wallet hint + ES Kingdom alt + ES Training Pass aria. Also fixed an inline em-dash aria-label in `mini-arena-bridge-slot.tsx` (note: that file bypasses editorial — flagged as a code-smell for a future refactor). | None — no surfaces under active baseline coverage. |
| 12 | `817061ef` | Founder FIDE Master line (EN + ES) — required user approval per the CLAUDE.md HARD RULE around "never weaken these strings to imply medical benefit." Period split, no claims or numbers altered. | Not VR'd. |

**Final ceilings:**

| File | em-dash | en-dash |
|---|---|---|
| editorial.ts | 0 | 1 |
| messages/en.ts | 0 | 0 |
| messages/es.ts | 0 | 1 |

The 2 surviving en-dashes are in dev-tool references that survived comment stripping; en-dash is rare in product copy and not part of the AI-prose tell.

### Thread 2 — Founder attribution fix (1 commit)

`547a376f` `fix(editorial): founder attribution — real name + "Founder" for Wolfcito`

Surfaced mid-cluster when the user noticed `"Wolfcito · Co-fundador"` in the ABOUT methodology chip didn't match the parallel chip `"César Litvinov Alarcón · Maestro FIDE"` (real name + role).

**Updated (2 chips + 1 landing card × EN/ES = 4 strings):**
- `ABOUT_METHODOLOGY_COPY.wolfcito` chip → `"Luis Fernando Ushiña · Software Developer Architect · Founder"` (EN) / `"…Fundador"` (ES).
- `LANDING_COPY.founders.cards[0].title` → `"Software Developer Architect · Founder Chesscito"` (EN + ES mirror).

**Intentionally NOT changed:**
- César's landing card title remains `"…Co-Founder Chesscito"` — he co-founded with Wolfcito + Den Labs; the Co- prefix preserves that. The Wolfcito-only "Founder" prefix marks product-founder hierarchy per user direction.
- Legal/operator strings (`"Operated by Wolfcito"`, `"built and operated by Wolfcito (@akawolfcito)"`, etc. — 5 occurrences across editorial + ES) — these are independence disclaimers and use "Wolfcito" as the operator persona for trademark/legal posture, not founder credentialing.

## State at handoff

- **Branch:** `origin/main` at `547a376f`. Local clean.
- **Production:** unchanged from `f54f6fc`.
- **Tests:** 41/41 about + content, 128/128 content + hub, 19/19 mini-arena (each suite verified per chunk; no full-suite run since no logic touched).
- **VR baselines:** `vr9-arena-end-state-*` (7) + `hub-clean` regenerated but bit-identical to prior baselines. No drift introduced.
- **Disk telemetry rule:** the persistent `<30GB free + swap >2GB` blocker memory updated this session — operating posture flipped to "proceed with VR by default, reboot after long sessions" given this machine's 13Gi post-reboot ceiling.

## Cluster Closure Protocol

1. **GitHub housekeeping** — no issue tickets opened for the sweep; nothing to close.
2. **README sync** — N/A. "What's live" surface unchanged.
3. **MEMORY.md sync** — done. `project_anti_ai_prose_ceiling` flipped from "81% swept / 42 remaining gated on VR reboot" → "CLOSED at 0/0/0, gate blocks new em-dash in CI". Detail file rewritten to reflect chunk 8-12 completion + the VR-safe-by-absence pattern.
4. **Branch hygiene** — only touched `main`; nothing to delete.
5. **Handoff doc** — this file.

## Outstanding work (deferred ledger)

- **VR fixture additions for newly-cleaned surfaces** — the 5 chunks (8-12) all regenerated identical baselines, meaning their swept strings live outside the current baseline catalog. Candidates for new fixtures: loss-state arena variants (separate from current 6 win + 1 resigned), `dev/pro-active-hub` for active PRO chip, `/legal` snapshot, landing tagline render. Not blocking — the strings render correctly in manual smoke and the ceiling test prevents drift.
- **`mini-arena-bridge-slot.tsx` editorial bypass** — the inline aria-label `${name}: locked` literal duplicates `HUB_ACTION_RAIL_COPY.arenaLockedAriaFormat`. Should route through editorial.
- **Legal/operator persona disambiguation** — user asked whether `"Operated by Wolfcito"` should surface the real name (`"Operated by Luis Fernando Ushiña (@akawolfcito)"`). Decision deferred; current trademark/persona framing is intentional.
- **Carried from the morning handoff:** VR settle fix verification (`1fec59c8`), hint-variant VR baselines, Founder perks UI, shared Trophies provider, production promote.

## Pointers

- Guard test: `apps/web/src/lib/content/__tests__/anti-ai-prose.test.ts` (3 files × 2 dashes = 6 assertions, all ceilings at 0/0/0/2 → effectively em-zero).
- Policy memory: `feedback_anti_ai_prose.md`.
- Ceiling memory: `project_anti_ai_prose_ceiling.md` (updated this session — final state).
- Disk-telemetry rule update: `project_disk_telemetry.md` (rule #4 amended this session).
- Originating cluster (chunks 1-7): `docs/handoffs/2026-05-30-em-dash-sweep-handoff.md`.

---

Wolfcito 🐾 @akawolfcito
