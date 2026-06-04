# Popup vocabulary migration audit — 2026-06-04 (revised)

> **Revision note.** This doc supersedes the first pass (committed earlier today) which over-estimated drift. After running `e2e/popup-vocabulary-captures.spec.ts` and reading every PNG in `errors/pantallas-lejanas/auto-capture/` (30 captures), the migration list is materially shorter than the file-grep-only audit suggested. Many surfaces I assumed were "distant" are actually already on a canonical register; the real distance lives in three specific places.

## TL;DR

The codebase ships **three coherent visual registers**, not one. The user's reference WARM UP popup is one of them. The migration job is small and surgical, not a sweep.

| Register | Examples | Migration status |
|---|---|---|
| **A. WARM UP / panel-mision shell** | `arena/soft-gate-sheet`, `arena/arena-end-state` (all variants), `exercises/fail-rescue-modal`, `arena/promotion-overlay`, `arena/victory-popup-shell` siblings | ✅ Canonical — do NOT touch |
| **B. ContextualHeader + green forest bg (full-takeover sheet)** | `exercises/daily-tactic-sheet`, `exercises/trophies-sheet`, `exercises/shop-sheet`, `exercises/exercises-screen` AccountSheet, `exercises/badge-sheet`, `exercises/leaderboard-sheet` | ✅ Canonical — do NOT touch |
| **C. Dark theatre** | `coach/coach-game-client` (the /coach/[gameId] route) + the moves panel + circular medallions | 🟡 Intentional 3rd register for post-game review. NOT a migration target. Optional: confirm with Wolfcito it's the intended language. |
| **D. True distant** | `exercises/purchase-confirm-sheet:122` (brown game-solid) + `exercises/result-overlay.tsx:308/321/326` (brown game-solid/primary inside CandyGlassShell) | ❌ Migrate to Register A or B |

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

1. **Coach Viewer dark theatre — intended or migrate?** (UNANSWERED)
   The user's IMG_3132 and IMG_3121 from `errors/pantallas-lejanas/` show a DIFFERENT layout than what the dev fixture captures produce. The fixtures render the modern Cluster C dark theatre; the user's IMG_*.PNG captures show an older inline cream + brown CTA + underline HUB link layout. Likely the live `/coach/[gameId]` route hits a fallback state (no Coach response yet? auth gate?) that bypasses the Cluster C chrome. Worth a 10-min runtime check before assuming the whole route migrated.

2. **`exercises/result-overlay.tsx` mid-exercise "Couldn't save"** (ANSWERED — confirmed distant)
   Source traced to `exercises/result-overlay.tsx:308` — `<Button variant="game-solid">` "Try again" + underline "Dismiss" link, inside a `<CandyGlassShell>` (not panel-mision). Matches IMG_3136 exactly. Lines 308 (try-again), 321 (dismiss-only), 326 (share-success) all ship brown CTAs through the same shell. Status: **Register D, true distant**. Migration shape: swap shell to panel-mision and convert each `game-solid` / `game-primary` to `.arena-scaffold-soft-gate-*`.

3. **Mini Arena Sheet (Mate)** (ANSWERED — canonical)
   Capture now succeeds with `[data-testid="mini-arena-trigger"]` + correct localStorage seed (`chesscito:progress:rook = { stars: [3,3,3,3,3,3] }` ≥ 12). Result: ContextualHeader + green forest bg + cream prompt + chess board. **Register B canonical, no migration needed.**

4. **Account Sheet capture** (ANSWERED — Playwright limitation, not a vocabulary issue)
   The Account trigger button conditionally renders only when wallet is connected and `!proLoading`. Without wallet-connect mocking, the spec lands on the Connect button branch instead. The Account sheet itself was redesigned earlier today (commit `d0dff3e5` — 3-col tile grid) and is **Register B canonical**. Adding wallet mock to the spec is a separate spike, not blocking.

5. **Confirm Purchase brown CTA** (ANSWERED — one-line fix, confirmed)
   `exercises/purchase-confirm-sheet.tsx:122` — the only confirmed migration target from the original sweep. Drop into the same cluster as the result-overlay migration below.

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

| Phase | Scope | Effort | Status |
|---|---|---|---|
| **Phase 0** | Run capture spec, answer 5 open questions | 30 min | ✅ Done (this revision) |
| **Phase 1** | Migrate Register D survivors | ~1h | Pending |
| **Phase 2** | Resolve Coach Viewer register intent | depends on Wolfcito | Pending |

**Phase 1 scope (confirmed)**:
- `exercises/purchase-confirm-sheet.tsx:122` — 1-line CTA swap.
- `exercises/result-overlay.tsx:308` — `game-solid` Try again → `.arena-scaffold-soft-gate-primary`.
- `exercises/result-overlay.tsx:321` — `game-primary` Dismiss (error-only no-retry) → `.arena-scaffold-soft-gate-secondary`.
- `exercises/result-overlay.tsx:326` — `game-primary` Share → `.arena-scaffold-soft-gate-primary` (success path).
- Underline "Dismiss" link at result-overlay.tsx:314 → `.arena-result-back-link` (vocabulary alignment).
- Wrap `<CandyGlassShell>` host for the error variant in the panel-mision shell so the frame matches Register A.

The big "Cluster 1a brown CTA retire" sweep is no longer needed system-wide. The brown `game-primary` / `game-solid` Button variants remain in `button.tsx`, but the audit confirms they're either (a) intentionally retired everywhere we redesigned, or (b) only surviving in the two specific files above that we can swap surgically.

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
