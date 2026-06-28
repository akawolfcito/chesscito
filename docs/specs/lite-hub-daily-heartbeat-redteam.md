# Red-team — Lite hub "daily heartbeat" mini-spec

**Reviewer**: Sally (critical hat) · **Date**: 2026-06-27
**Verdict**: One **P0** reshapes the spec before any code; 2 × P1 + 3 × P2 to fold
in. Grounded against the actual data writers, not assumptions.

## ✅ P0-A RESOLVED (founder, 2026-06-27) — unify into one daily ritual
Decision: **the daily mission = Daily Focus + ≥N exercises (N=1, configurable).**
Start Focus becomes a **guided 2-step CTA**: "Start Focus" → does the Daily Focus
first; once done it becomes **"Practice More"** → exercises. A **focus day**
(streak) lights only when the **full ritual** is complete (focus + ≥N). Rationale:
a single 0.5s exercise isn't a habit; the ritual ("come, relax, learn") is, and
it's what justifies the $1.99 pass (a place to return, not one puzzle). The 2
labels (Start Focus / Practice More) are a clean ritual guide, NOT the 10-variant
content-loop noise we removed. Full design + implications: see the
"Daily ritual loop" section of `lite-hub-daily-heartbeat.md`.

## P0-A — Two different loops are conflated (original finding, now resolved above)
**Verified in code**: the "focus days" streak (`chesscito:daily-progress`,
`focusPassport.streak/todayDone`) is written **only by the daily tactic** —
`hub-daily-tile.tsx`, `daily-tactic-slot.tsx`, `challenge/daily`. **`/exercises`
never touches it** (grep: no `daily-progress` writes under
`components/exercises/` or `exercise-progress.ts`).

So the hub has **two separate daily loops**:
- **Loop A — the 21-Day focus streak** ← the **daily tactic** = the small corner
  **gift icon** (`HubDailyTile`). This is what the ChallengeCard progress bar
  counts ("N/21 focus days").
- **Loop B — training** ← **"Start Focus" → `/exercises`** (per-piece stars,
  session quota). Does **not** advance the streak.

Consequences for the heartbeat spec:
1. The "do today's focus" nudge must point at the action that advances the
   streak = the **gift icon**, NOT Start Focus. The spec's state-1 pulse ring on
   Start Focus is **misleading** (tapping it won't light a focus day).
2. State 1 (pending heartbeat) and state ✦ (gift ready) are the **same
   condition** (`!todayDone`, because the gift *is* the daily tactic) → collapse
   into ONE signal: **pulse the gift when today's focus is pending**.
3. The cooldown chip in the progress row is coherent (streak → resets at UTC
   midnight); keep it there.
4. **Deeper IA smell**: the hub's hero CTA (Start Focus) serves Loop B, while the
   big "21-Day Mind Challenge" card celebrates Loop A — whose action is a tiny
   corner icon. The most important daily action is the least prominent thing.

**Resolve before implementing** (pick one):
- (a) **Minimal**: move the heartbeat to the gift, keep Start Focus as the
  "train more" loop, accept the two loops are distinct. Cheapest; the IA smell
  remains (gift small).
- (b) **Elevate the daily focus**: give the daily tactic a real presence in/under
  the card (e.g., Start Focus *is* today's focus, or a second clear "Do today's
  focus" affordance) so the card's streak and its primary action align.
- (c) **Relabel/merge loops** if product intends exercises to count as focus days
  (would need exercise completion to write the streak — bigger change).

This is a product call, not just UX polish — it decides where the heartbeat lives.

## P1-B — Celebration collides with existing first-day overlays
`HubDailyTile` already fires `FirstFocusDayOverlay` + `WelcomePackageModal` on the
first daily completion. The bar fill-sweep would fire **on top** of those → two
celebrations on day 1. Also "completed this session" needs a guard:
- Fire only on the **live `!done → done` transition** (the `daily-progress-changed`
  event while mounted), never on every mount where `todayDone` is already true
  (else it re-celebrates on every hub visit).
- **Suppress** the bar sweep while `FirstFocusDayOverlay` owns the moment (day 1).

## P1-C — Cooldown trigger mixes streak vs session quota
The spec triggers the chip on "`todayDone` OR session hard-max". Those are
different systems with different meanings. The **progress-row chip is about the
streak** → drive it from `todayDone` + `hoursUntilNextUtcDay` only. The session
quota ("Start Focus now only replays, no stars") is a **separate** concern that,
if surfaced at all, belongs near Start Focus — do not fold it into the streak
chip or the chip will lie about the streak. **Decide**: do we signal the session
limit on the hub at all, or leave it to `/exercises` (where it already lives)?

## P2 — fold in during implementation
- **P2-D Pulse fatigue / perf**: a gift pulse that runs every visit until done
  can read as nagging + repaints on MiniPay. Constrain to a short attract loop
  (e.g., 2–3 pulses on mount) then settle to a static dot; GPU-safe; reduced-motion
  off.
- **P2-E i18n**: `focusDaysFormat` exists; verify `cooldownLabel` strings
  (`Next Xh` / `Tomorrow`) are i18n'd with ES parity in their namespace; the ✓ is
  a glyph (no i18n). Any new word (e.g. "Done") → editorial + en + es.
- **P2-F Naming**: the corner icon is the "daily gift" but it drives "focus days".
  One action, two names (gift / focus). Align copy so the user maps the pulse to
  the streak.

## Recommendation
1. Get the **P0-A** product call (a/b/c). It's the gate.
2. With (a) as the likely minimal path: collapse states 1 + ✦ → **gift pulse**;
   keep the cooldown chip in the progress row (streak-only trigger, P1-C);
   coordinate the celebration with the day-1 overlay (P1-B).
3. Then implement (TDD), then Stage 3b cleanup.
