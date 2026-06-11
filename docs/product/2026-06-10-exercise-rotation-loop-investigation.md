# Investigation — exercise rotation "loop" + 1,2,3,6,7,8 numbering

> 2026-06-10. Investigation + proposal (NO code change yet). Triggered by:
> "doing >3 exercises looped back; exercises numbered 1,2,3, 6,7,8".

## Root cause (confirmed)

The **Rotation Engine is ON** in both Production and Preview
(`NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` is set in Vercel for both envs;
the flag defaults OFF in code, so it was explicitly turned on ~2 days ago).

What it does (`lib/game/rotation.ts` → `getVisibleExercisesForToday`):
1. Takes the piece's full pool (10-15 exercises).
2. Filters to **unlocked tiers** (easy always; medium @ 5★ mastery;
   hard @ 9★).
3. Sorts by **least-mastered first**, then a per-day hash seed.
4. Slices the top **5** (`DAILY_VISIBLE_LIMIT`).

The UI numbers each exercise by its **pool index**. Because the 5 visible
are the *least-mastered* unlocked ones (not pool positions 1-5), the
numbers are non-contiguous → **"1, 2, 3, 6, 7, 8"**. As you raise stars on
the visible ones, they drop in the sort and the **next** least-mastered
surface → the set "rotates", which reads as a **loop**.

**This is expected behavior of a half-calibrated rotation, not an isolated
bug.** The engine shipped selectors + the flag but left 4 founder
decisions open (rotation epic 2026-06-08): 10/15 vs 15/15 pool, PRO tier
lead, guest model, 10★-across-pool mastery. Until those land, the
visible-window ↔ badge(15★ = master 5) ↔ pool(10-15) relationship is
undefined, which is exactly what surfaces as confusing.

## Tensions it surfaces

1. **Numbering** by pool index jumps (cosmetic but disorienting).
2. **"Done" is unclear**: badge/piece-complete = 15★ (master 5 exercises),
   but the pool is 10-15 and you only see 5/day → unclear when/why the set
   changes and when the piece is "finished".
3. **Interaction with the new economy (Slice C2)**: training now earns +1
   per *fresh* completion. Rotation surfaces more distinct exercises over
   days → more +1 earns, but the daily cap (6) bounds it, so no runaway.
   Worth confirming intentional when calibrating.

## Options

1. **Turn rotation OFF now** (set `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION`
   false / remove it in Vercel for preview+prod). UI falls back to the
   legacy linear list — contiguous 1..N, no jump, no loop. Fastest:
   unblocks a clean smoke AND stabilizes the pre-launch prod snapshot.
   Reversible (flag default is OFF; flipping back is one env change + no
   code). **Recommended for now.**
2. **Calibrate properly** — resolve the 4 founder decisions + finish the
   rotation spec (numbering scheme, pool size, badge relationship, guest
   model). Proper fix; own cluster. Do when ready to invest in the
   rotation feature.
3. **Cosmetic-only** — keep rotation ON but show a stable per-exercise
   label instead of the pool index. Removes the "jump" but the rotating
   set (loop feel) + the undefined calibration remain. Half-measure.

## Recommendation

**Option 1 now** (flag OFF → linear, clean smoke + stable prod), then
schedule **Option 2** as its own spec when the rotation feature is a
priority. The flag is the single lever; no code change needed to disable.

Note: flipping the Vercel env affects **production** (pre-launch snapshot,
no real users per project memory), so it's safe to do now, but it IS a
prod-facing config change — confirm before flipping.
