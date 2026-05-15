# Step 4D — Coach Invalid Game + Normalization Guardrails

## Files changed (3 files, ~15 lines)

| File | Change |
|---|---|
| `apps/web/src/lib/content/editorial.ts` | Added `ARENA_COPY.coachPreview.emptyTitle` / `emptyBody` |
| `apps/web/src/app/arena/page.tsx` | Early returns in `startCoachAnalysis` + `handleAskCoach`; conditional `coachPreview` render for 0-move state |
| `apps/web/src/lib/coach/normalize.ts` | `better` field: preprocess trim → slice(0,48) → validate `.max(48)` |

## Bug A — Empty move list guard

**Problem**: Resigning with 0 moves calls `/api/coach/analyze` which returns HTTP 400 `Invalid game: Empty move list`. Client treated this as retryable (quick review fallback).

**Fix** (3 defensive layers):
1. **`page.tsx:347`** — `startCoachAnalysis` returns immediately if `game.moveHistory.length === 0`
2. **`page.tsx:460`** — `handleAskCoach` returns immediately if `game.moveHistory.length === 0`
3. **`page.tsx:537`** — `coachPreview` renders a static non-clickable section with "No moves to review" / "Make at least one move before asking Coach." instead of `CoachPreviewCard`

**Result**: `/api/coach/analyze` is never called. No Retry Review, no "Review needs another try". Play Again and Back to Hub remain. The static section reuses `coach-preview-card` CSS classes so it snaps seamlessly into the `arena-result-coach-wrap` container.

## Bug B — Normalization guardrails

**Problem**: `mistakes[].better` was `z.string().max(20)`. LLM/OpenRouter sometimes emits suggestions longer than 20 chars (e.g., "Develop your knight to f3"), causing Zod to reject the entire analysis response → HTTP 502.

**Fix** (`normalize.ts:7-10`):
```
before: better: z.string().max(20),
after:  better: z.preprocess(
          (val) => (typeof val === "string" ? val.trim().slice(0, 48) : val),
          z.string().max(48),
        ),
```
- Preprocess trims whitespace and slices to 48 chars before Zod validation
- Max relaxed from 20 → 48 (short suggestion range)
- Non-string values pass through → Zod rejects them naturally (correct behavior)
- `played` stays at max 20 (strict move notation)

**Result**: Long `better` strings are safely truncated, not rejected. Whole analysis no longer fails.

## Smoke checklist

- [x] `pnpm type-check` — passes
- [x] `pnpm lint` — no warnings/errors
- [x] 0-move resign: `/api/coach/analyze` is NOT called
- [x] 0-move resign: shows "No moves to review" + "Make at least one move before asking Coach."
- [x] 0-move resign: no Retry Review, no "Review needs another try"
- [x] 0-move resign: Play Again + Back to Hub present
- [x] Normal moves (>0): `CoachPreviewCard` renders as before (no regression)
- [x] `better` string >20 chars: preprocessed to max 48, analysis succeeds
- [x] `better` string >48 chars: truncated to 48, analysis succeeds
- [x] `played` stays strict max 20 (move notation unchanged)
- [x] Non-string `better`: Zod rejects (correct, not silently swallowed)
