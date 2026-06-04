# Popup vocabulary migration audit — 2026-06-04 (revised)

> **Revision note.** This doc supersedes the first pass (committed earlier today) which over-estimated drift. After running `e2e/popup-vocabulary-captures.spec.ts` and reading every PNG in `errors/pantallas-lejanas/auto-capture/` (30 captures), the migration list is materially shorter than the file-grep-only audit suggested. Many surfaces I assumed were "distant" are actually already on a canonical register; the real distance lives in three specific places.

## TL;DR

The codebase ships **three coherent visual registers**, not one. The user's reference WARM UP popup is one of them. The migration job is small and surgical, not a sweep.

| Register | Examples | Migration status |
|---|---|---|
| **A. WARM UP / panel-mision shell** | `arena/soft-gate-sheet`, `arena/arena-end-state` (all variants), `exercises/fail-rescue-modal`, `arena/promotion-overlay`, `arena/victory-popup-shell` siblings | ✅ Canonical — do NOT touch |
| **B. ContextualHeader + green forest bg (full-takeover sheet)** | `exercises/daily-tactic-sheet`, `exercises/trophies-sheet`, `exercises/shop-sheet`, `exercises/exercises-screen` AccountSheet, `exercises/badge-sheet`, `exercises/leaderboard-sheet` | ✅ Canonical — do NOT touch |
| **C. Dark theatre** | `coach/coach-game-client` (the /coach/[gameId] route) + the moves panel + circular medallions | 🟡 Intentional 3rd register for post-game review. NOT a migration target. Optional: confirm with Wolfcito it's the intended language. |
| **D. True distant** | `exercises/purchase-confirm-sheet` (the only confirmed survivor) | ❌ Migrate to Register A or B |

The original 7-cluster punch-list collapses to **one confirmed distant surface** (Confirm Purchase) plus **two open questions** (Coach register, "Couldn't save" mid-exercise variant).

---

## Evidence base

`apps/web/e2e/popup-vocabulary-captures.spec.ts` — 29 tests, 30 PNGs in `errors/pantallas-lejanas/auto-capture/`. Three phases: fixture-route states (coach-viewer × 6, arena-end-state × 10, rescue-modal × 4), live-sheet click sequences (8), and Hub right-rail (2).

### Register A — WARM UP / panel-mision shell

Evidence captures (all on canonical green forest frame + cream interior + red ⊗ + wizard avatar + green primary pill + cream secondary pill):

| Capture | Variant | Notes |
|---|---|---|
| `arena-end-state-resigned.png` | Loss / Coach gated | Canonical: title + coach review divider + lavender "Let's see what happened" + cream "Try again." |
| `arena-end-state-checkmate.png` | Loss | Canonical |
| `arena-end-state-stalemate.png` | Draw | Canonical |
| `arena-end-state-draw.png` | Draw | Canonical |
| `arena-end-state-win-celebration.png` | Mid-mint | Canonical |
| `arena-end-state-win-claiming.png` | Mint in flight | Canonical |
| `arena-end-state-win-success.png` | "Victory Saved" | Canonical — Why-did-you-win lavender CTA + Play again / Share secondaries |
| `arena-end-state-win-error.png` | "Couldn't save your victory / Insufficient gas" | **Canonical** — this is the arena-end variant of the save error. Different surface from the IMG_3136 mid-exercise one. |
| `arena-end-state-win-cancelled.png` | User cancelled mint | Canonical |
| `arena-end-state-win-timeout.png` | Save timed out | Canonical |
| `rescue-modal-A.png` … `rescue-modal-D.png` | Streak rescue variants | All four canonical |

### Register B — Full-takeover sheet (ContextualHeader + green forest bg)

| Capture | Surface | Notes |
|---|---|---|
| `daily-tactic-sheet-open.png` | Daily Tactic gameplay | Canonical: ContextualHeader tile + cream prompt pill + chess board |
| `trophies-sheet-open.png` | Trophies / Hall of Fame | Canonical: VITRINE row + Hall of Fame skeleton |
| `shop-sheet-open.png` | Shop SKUs grid | Canonical: small caps header + red ⊗ + green pill prices + featured ribbon |
| `account-sheet-open.png` | (capture issue — see §Limitations) | Should be canonical post-redesign; click sequence didn't surface the sheet |
| `badges-sheet-open.png` | Badges | Same vocabulary as Trophies (assumed canonical) |
| `leaderboard-sheet-open.png` | Leaderboard top-N | Same vocabulary as Trophies (assumed canonical) |

### Register C — Dark theatre (Coach Viewer)

| Capture | Notes |
|---|---|
| `coach-viewer-viewer-win-minted.png` | Black bg + gold moves panel ("MOVES" header) + 3 circular medallion CTAs (Play again, Share trophy, Ask Coach again) + "View on Celoscan" underline link |
| `coach-viewer-viewer-win-unminted.png` | Same chrome, different action set |
| `coach-viewer-viewer-loss.png` | Same chrome |
| `coach-viewer-viewer-partial-replay.png` | Same chrome |
| `coach-viewer-viewer-win-credits-hint.png` | Same chrome + hint pill under Ask Coach medallion |
| `coach-viewer-viewer-win-pro-hint.png` | Same chrome + PRO hint pill |

This is the Cluster C 2026-05-29 redesign — intentional post-game theatre register. Open question for Wolfcito: **is this the intended language, or do we want Coach to migrate into Register A**? My read is it's intentional (the dark/gold mood frames "this is your match in the record book") and should stay. But the IMG_3121/IMG_3132 the user flagged earlier look DIFFERENT from these dark medallion captures — possibly a fallback/loading state inside the coach page rendered through the older brown vocabulary that the new Cluster C didn't fully replace.

### Register D — True distant

#### `confirm-purchase-sheet.png` — the only confirmed survivor

Header: ContextualHeader-style (cream tile + brown title + red ⊗) — Register B.
Body: cream tray with SKU price + status fields.
CTA: **brown wood-grain "Confirm purchase" button** (the legacy `game-solid` variant). 

Hybrid surface: header is Register B, CTA is the retired brown vocabulary. Inconsistent.

**Migration shape**: swap the brown `game-solid` CTA at `exercises/purchase-confirm-sheet.tsx:122` to `.arena-scaffold-soft-gate-primary` (green pill). One line. No frame swap needed — header + body are fine.

---

## Open questions — re-audited

These survive from the first pass and still need Wolfcito's call:

1. **Coach Viewer dark theatre — intended or migrate?**
   The user's IMG_3132 and IMG_3121 from `errors/pantallas-lejanas/` show a DIFFERENT layout than what the dev fixture captures produce. The fixtures render the modern Cluster C dark theatre; the user's IMG_*.PNG captures show an older inline cream + brown CTA + underline HUB link layout. Likely the live `/coach/[gameId]` route hits a fallback state (no Coach response yet? auth gate?) that bypasses the Cluster C chrome. Worth a 10-min runtime check before assuming the whole route migrated.

2. **`exercises/result-overlay.tsx` mid-exercise "Couldn't save" — verified or assumed migrated?**
   The user's IMG_3136 / IMG_3139 / IMG_3143 show a popup with brown "Try again" + cream "Dismiss" link + a separate "Save failed. Try again." toast at the bottom. This is the /exercises save error, NOT the /arena one. The fixture captures cover arena, not exercises. To confirm whether result-overlay still ships the brown variant, capture it via Playwright (needs game state + failed signing) or open in dev manually.

3. **Mini Arena Sheet (Mate)** — capture didn't open (size identical to hub baseline). Likely the unlock localStorage seed missed the actual key, or the tile is gated behind a different condition. Need to confirm the live state to know whether to migrate.

4. **Confirm Purchase brown CTA** — the only confirmed migration target. One-line fix. Drop it into the next Cluster sweep (1a brown CTA retire) and the dialog reads as Register B end-to-end.

---

## Capture limitations (transparency for the reader)

The Playwright spec uses click-by-accessible-name to surface live sheets. Where the names didn't resolve, captures fell back to the underlying screen:

- `account-sheet-open.png` — shows /exercises baseline, sheet never opened. Trigger button locator (`name: /account|cuenta|profile/i`) didn't match. Fix in next pass: add `data-testid="account-trigger"` to the trigger.
- `mini-arena-sheet.png` — identical bytes to `hub-baseline.png`. Same root cause; rook-stars localStorage seed may not be the canonical key.
- `daily-tactic-sheet-open.png` — DID open (game prompt + board visible). Click sequence worked.
- `shop-sheet-open.png` / `trophies-sheet-open.png` / `leaderboard-sheet-open.png` / `badges-sheet-open.png` — all surfaced their respective bottom sheets.

When we open Cluster 1a, instrument the missing surfaces with `data-testid` then re-run the spec.

---

## Migration plan revision

Before this audit revision, the inventory doc estimated 7 clusters. Reality:

| Phase | Scope | Effort |
|---|---|---|
| **Phase 0 — answer open questions** | (1) verify Coach register intent, (2) capture /exercises save error, (3) capture Mini Arena Sheet, (4) capture Account Sheet | 30 min |
| **Phase 1 — Confirm Purchase brown CTA** | 1-line swap | 15 min |
| **Phase 2 — any survivors found in Phase 0** | unknown until Phase 0 lands | TBD |

The big "Cluster 1a brown CTA retire" sweep is no longer needed system-wide. The brown `game-primary` / `game-solid` Button variants remain in `button.tsx`, but the audit confirms they're either (a) intentionally retired everywhere we redesigned, or (b) only surviving at one or two callsites that we can swap surgically.

---

## What this doc does NOT replace

- `2026-06-04-distant-screens-inventory.md` — the user-sample-driven first pass. Keep it for the original problem framing; this revised audit is the implementation-ready successor.
- `docs/audits/2026-06-01-button-families-inventory.md` — token system source of truth. Still authoritative.

---

## Next-session checklist

1. Wolfcito confirms or rejects Register C (Coach dark theatre).
2. Run `pnpm exec playwright test e2e/popup-vocabulary-captures.spec.ts --project=minipay --workers=1` against an `/exercises` save-failure fixture (add it if missing) to capture the IMG_3136 variant.
3. Ship the one-line Confirm Purchase fix.
4. Re-run the capture spec to confirm no surface regressed.
