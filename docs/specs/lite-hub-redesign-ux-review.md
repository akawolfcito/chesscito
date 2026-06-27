# UX Review — Lite HUB redesign (Sally)

**Date**: 2026-06-26
**Reviewer**: Sally (UX)
**Artifacts**: Image #11 (current `bebc23f`), Image #9 (new, pre-pass),
Image #10 (new, post-pass)

## Verdict

The redesign is a clear **win** over the current hub. Keep the direction.
The current screen has 4 competing focal points and leans on sentences; the
new one has a hierarchy, makes the offer legible for the first time, and gives
the thumb one obvious job. Ship the new layout; refine the details below.

## The core lesson (first-game guidance)

**One screen = one primary job.** This hub's job: *"do today's focus, and
(optionally) join the 21-day challenge."* Everything else is support.

**Games speak in state, not paragraphs.** Lit dots, an ACTIVE pill,
locked/unlocked pieces, Day X/21 — these communicate progress without text.
The current hub narrates ("Your path is growing", "Keep going", "Train your
pieces first / Then enter the arena"); the new one *shows* it. That's the
single biggest reason the redesign feels lighter.

## Current hub (Image #11) — what to DROP

- **The giant ornate portal frame.** It eats ~45% of the screen and says
  almost nothing. The new smaller logo + mascot oval does the same emotional
  job in a third of the space. Drop it.
- **The narration texts** ("Train your pieces first / Then enter the arena",
  "Your path is growing / Keep going"). Pure textual noise. The single
  **Start Focus** button replaces all of it.
- **The buried $1.99 pass band** (low-contrast, bottom, easy to miss). The
  money moment was invisible. This is the redesign's biggest fix.
- **The vertical Training Path rail** — don't revert to it. Horizontal is more
  compact and modern, and frees the prime vertical space for the CTA.

## New — pre-pass (Image #9) — KEEP / WATCH

**KEEP (strong wins):**
- **Stat tiles 21 days / +3 Shields / $1.99.** This is the clearest the offer
  has ever been — scannable in one second. Best change in the whole redesign.
- **Single Start Focus** as the green hero.
- **Smaller mascot oval** — emotion without hogging real estate.

**WATCH (refine):**
- **Two big stacked CTAs** (purple Join Challenge + green Start Focus) sit close
  and carry similar visual weight. A new user may freeze: "which do I tap?"
  Make the hierarchy explicit — **Start Focus = the default, free, do-it-now
  action; Join Challenge = the optional upgrade.** Give Start Focus a touch
  more dominance (size/glow) or tag Join Challenge as the "offer". Color alone
  (purple vs green) is a weak signal under a glance.
- **Empty 21 streak dots pre-join.** Risk they read as "you're already behind /
  failed". Frame as *potential* — first dot lit (flame), the rest as "to light
  up", never as deficit. The flame-at-start already helps; keep that tone.

## New — post-pass (Image #10) — KEEP / WATCH

**KEEP (this is the payoff, done right):**
- The card **transforms** offer → tracker: **ACTIVE** pill + **Day 1/21** +
  **Shields 3**. The same element earns its place in both states. Textbook.
- No purchase CTA after buying — correct, no dead/confusing button.

**WATCH:**
- **Dot semantics.** Pre-pass shows ~10 dots in the offer; post-pass shows ~10
  in "Focus Passport". The challenge is 21 days. Decide what the dots mean (a
  rolling 7–10 day window? the full 21?) and keep it **consistent + labeled**
  across both states, or users won't trust the count.
- "21-Day" prefix dropped to just "Mind Challenge" post-pass — fine, since
  "Day 1/21" carries the duration. Consistent enough.

## Monetization loop (your north star)

The before/after states ARE the loop made visible:
**offer (stat tiles) → buy → ACTIVE tracker → rewards.**
The challenge card carrying both states is the right content-loop anchor.
Strongly endorse making that card the hero — Join Challenge is the engine, not
a side extra. Just don't let it out-shout Start Focus for the *daily* return
user who hasn't paid yet.

## Recommendation summary

| Element | Action |
|---|---|
| Ornate portal frame | DROP → smaller logo + oval |
| Narration texts | DROP → Start Focus speaks for them |
| $1.99 pass band (current) | REPLACE → stat tiles in challenge card |
| Vertical training rail | DROP → horizontal path |
| Stat tiles / single CTA | KEEP |
| Two-CTA hierarchy | CHANGE → make Start Focus visibly dominant |
| Streak dots | CLARIFY semantics + frame as potential |
| Offer→ACTIVE card transform | KEEP (the payoff) |

## Decisions captured this session
- **Start Focus = option A** (at limit → practice/replay completed, no stars).
- **No bottom dock** on the hub for now (focus the loop; Sally concurs).
