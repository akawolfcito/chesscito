# Red-team — Exercise catalog refactor plan (King-first)

**Date:** 2026-06-05
**Status:** REVIEW (plan not yet implemented)
**Scope:** Two-commit plan to add a seedable `selectFromPool` selector + scale `KING_EXERCISES` 5 → 12 with metadata-enriched entries. King chosen as the first pilot per user directive.

## Plan under review

- **C1:** Add `difficulty?` + `tags?` to `Exercise`. Ship `selectFromPool<T>` (Fisher-Yates + mulberry32 seeded). Wrap with `selectExercises(piece, opts)`. Enrich the existing 5 King entries with metadata. No integration yet.
- **C2:** Add 7 new King exercises → pool of 12. Wire `useExerciseProgress(piece, seed?)` through `useMemo`. Caller passes `walletAddress ?? "guest"`. localStorage shape unchanged (`stars[5]` per piece).

---

## P0 — Blockers

### F1 — Star/exercise correlation regression under rotation

**The plan claims** "misma wallet siempre ve mismos 5 (selección determinística) → `stars[5]` sigue mapeando slot-by-slot."

**Reality:** that holds only if the seed is permanently identical for that wallet across sessions. The moment we ever change:
- seed strategy (e.g., "now we also salt by month"),
- pool ordering (insert an exercise at index 0),
- mulberry32 implementation,

…every returning user finds their `stars[slot=3] = 3★` now applies to a DIFFERENT exercise. Silent regression: the star count survives but no longer reflects which exercise was mastered.

It also breaks the existing fleet TODAY. Pedrito's `stars[0] = 3★` on `king-1` becomes `stars[0] = 3★` on whatever Fisher-Yates lands first under his wallet seed. There is no migration step in C2.

**Fix:** localStorage migrates to `stars: Record<exerciseId, 0|1|2|3>` (ID-based). On load, detect the old slot-array shape, infer the original IDs (the first 5 King entries today), persist the ID-keyed map, and from then on derive `stars[slot]` via `selected[slot].id → starsById[id]`. Adds ~40 LOC to the hook + 1 migration test. Without this, C2 is a silent data corruption.

### F2 — Guest collision dilutes the variance promise

All unconnected users share the same seed `"guest"` → same 5 King exercises. The user's stated goal was "Pedrito doesn't see the same as Juanito." In MiniPay zero-click flow most sessions DO land connected, but `/exercises` is reachable pre-connect (and routinely is on first paint).

**Fix options:**
- Salt guest seed with `crypto.randomUUID()` once per session in `sessionStorage` — every guest session gets a unique seed but stays stable within the tab.
- Or accept guest collision and document it as "guests get the canonical onboarding set."

Either decision is defensible; the plan must pick one and own it.

### F3 — King has poor combinatoric depth for catalog scaling

King moves are 8 one-square deltas. No sliding, no jumps. Without `attackedSquares` modeling (deferred per v0.1 spec §7), every "avoid danger" exercise reduces to "walk from A to B in N steps." Authoring 7 new King exercises that are pedagogically distinct from `king-1..5` (already covering one-step, diagonal, multi-step, capture, shelter) is hard.

The realistic result: 7 new entries that read as variations on "walk king somewhere new" without teaching anything novel. The user's variance goal becomes superficial — Pedrito vs Juanito see different START squares, not different lessons.

Pieces with richer combinatorics (Knight L-jumps, Rook lanes, Bishop diagonals) would yield more variance per added exercise.

**User chose King explicitly.** Worth surfacing this honestly so they can re-evaluate: King-first ships the refactor but with a thin payoff on variance; a piece-first like Knight ships the refactor AND a meaningful variance demo.

---

## P1 — Important (address in plan, not optional)

### F4 — Seed timing under wagmi async

The plan reads `walletAddress ?? "guest"` and memoizes the selection. But wagmi `useAccount().address` resolves async: first render `undefined` → seed `"guest"` → `useMemo` locks in guest selection. Wallet connects later → memo doesn't refresh because seed didn't change inside the memo's deps unless we add it.

If we add `seed` to the memo deps, the selection FLIPS on connect. User who started exercise 1 as guest now sees a different exercise 1 mid-session.

**Fix:** select once on first non-empty seed and lock. Re-select only on `piece` change. Document the "guest snapshot survives connect mid-session" behavior. Adds another small piece of stateful logic to the hook.

### F5 — `EXERCISES` is imported from outside the hook

The hook isn't the only consumer. Any module that does `import { EXERCISES } from "@/lib/game/exercises"` and reads `.king[0..4]` bypasses selection. Before C2, full grep:

```
EXERCISES\.|EXERCISES\[|from "@/lib/game/exercises"
```

…across `apps/web/src/**` AND test files. Migration must reach every caller or selection is half-applied. Plan does not include this inventory step.

### F6 — Optimal-moves verification for new exercises

7 new King exercises must each have `optimalMoves` correctly computed. Today this is human-authored. Without a BFS verifier, an off-by-one in optimal-moves silently penalizes users (the "perfect" path scores 2★ instead of 3★).

**Fix:** add a `verifyOptimalMoves(exercise)` test helper that runs BFS over `getValidTargets` and asserts `optimalMoves === bfs(start, target, blockers).length`. Mandatory for every new entry. Adds ~30 LOC of test infra.

### F7 — VR baselines for `/exercises` route

The plan asserts "piece-picker doesn't render exercise tiles → no VR shift." True for `hub-clean.png`. But if any VR fixture mounts the exercise board with `EXERCISES.king[0]`, the board snapshot bakes in king-1's `startPos = e1`. After C2, different seeds may place different starting positions in slot 0, shifting the snapshot.

Need to grep VR fixtures for `/exercises` mount points before C2 ships.

### F8 — `difficulty` + `tags` shipped without a consumer

C1 ships metadata fields nobody reads. Risk: `difficulty: undefined` semantics ambiguous; tags grow inconsistent across authors. Either:
- Add `selectExercises(piece, { difficulty?, tags? })` filter parameters in C1 even if no caller uses them yet — gives authoring meaning.
- Defer the metadata fields entirely until C3 needs them.

Don't ship dead fields.

### F9 — Authoring throughput

7 well-designed exercises ≈ 5-7 hours of design + verification work, even with a BFS verifier. C2 as scoped will overflow a single session. Realistic scope: 5 new King entries in C2 (pool of 10), with optional stretch to 12 if the pedagogy permits.

---

## P2 — Notes (track but proceed)

- **F10 — PRNG choice:** mulberry32 is fine. Don't oversell ("not cryptographic").
- **F11 — Hash function:** djb2 or cyrb53 for string→uint32. Trivial.
- **F12 — Salt scoping:** if a future labyrinth selector reuses the same `selectFromPool`, `seed + piece` collides between "King exercise" and "King labyrinth" universes. Salt API needs an explicit `domain: "exercise" | "labyrinth"` parameter, or salt is `seed + piece + domain`.
- **F13 — Hook API: param vs internal wagmi:** plan picks param (testable). Document the trade-off so we don't drift to internal wagmi reads in a follow-up.
- **F14 — Spec doc:** `2026-06-02-training-content-v0.1.md` must get a §15 update noting catalog growth + selector semantics. Without it the spec lies.
- **F15 — Telemetry:** any `exercise.completed { exerciseId }` events now span a larger ID universe. Probably benign. Worth a one-liner check.

---

## Recommendation

**Hold the plan.** Three corrective changes before any code edit:

1. **F1 (star/ID migration)** is non-negotiable. Either ship the localStorage migration to ID-keyed stars in C2, OR pin the existing 5 King IDs to fixed slot positions and only seed-shuffle the NEW additions (slots remain stable for legacy entries). The second is uglier but smaller blast radius.
2. **F3 (King depth)** — surface honestly. User picked King, but the variance ROI on King is the thinnest of any piece. Offer the option to pivot to Knight as pilot, OR proceed knowing the variance is mostly cosmetic for King.
3. **F8 (dead metadata)** — either consume `difficulty` in C1's selector signature, or drop both fields from C1.

**Revised commit sequence after fixes:**
- C1: selector + tests + metadata fields **with consumer-side filter** (F8 fix).
- C2: 5 new King exercises (not 7; F9), BFS-verified (F6), VR-checked (F7), full `EXERCISES` caller inventory done (F5), localStorage migration in same commit (F1).
- C3 (defer or bundle): guest seed decision (F2), spec doc update (F14).

## Decision needed

- Pivot to Knight pilot? (cleanest variance demo)
- Keep King + accept thin variance? (preserves user directive)
- Pin existing IDs to slots 0-4 vs full migration? (smaller blast vs cleaner long-term)
