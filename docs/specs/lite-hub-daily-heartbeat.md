# Mini-spec (UX) — Lite hub "daily heartbeat"

**Author**: Sally (UX) · **Date**: 2026-06-27
**Context**: Pre Stage 3b. The compact Lite hub is clean but lost the emotional
habit hooks (streak urgency, reward anticipation, completion reward, "when do I
come back"). This adds them back as ONE small, visual, icon-first system — not
scattered text. Replaces the dropped Content Loop text labels.

## Daily ritual loop (P0-A resolution — founder 2026-06-27)
The hub's daily mission is ONE ritual, not two loose loops:

> **A "focus day" = Daily Focus done + ≥ N exercises done today.**
> N defaults to **1** and is **configurable** (config/env, not hardcoded).

**Start Focus = a guided 2-step CTA** (the only label that changes — intentional,
NOT the 10-variant content-loop noise we removed):

| Ritual step | Start Focus label | Routes to |
|---|---|---|
| Daily Focus not done | **Start Focus** | the Daily Focus (daily tactic) |
| Focus done, `< N` exercises | **Practice More** | `/exercises` |
| Ritual complete (focus + ≥N) | **Practice More** (still works; replay) | `/exercises` |

- The streak advances when the **ritual completes**, in whatever order the user
  does the two parts (focus-first or exercise-first), exactly once per UTC day.
- "Practice More" keeps them learning ("come, relax, learn") — the habit + the
  pass's value — instead of one puzzle and out.

### Data sources (verified)
- Daily Focus done → `isCompletedToday()` (`chesscito:daily-progress`).
- Exercises done today → `getUsedCount(getDailySession())`
  (`consumedContentIds.length`, `session-quota.ts`), resets at UTC midnight.
- N → new config (e.g. `RITUAL_EXERCISES_REQUIRED`, default 1).

### Implementation realities & fresh risks (must handle)
- **R1 — the streak-write moves**: today `recordDailyCompletion` fires on the
  Daily Focus solve alone. It must move to fire on **ritual completion**
  (focus + ≥N), from whichever action completes it. Single writer, idempotent/day.
- **R2 — don't break the streak silently**: doing the focus but no exercise = no
  focus day. The hub must make step 2 obvious ("Practice More" + the heartbeat)
  and show a clear "1 of 2 done" cue so a break feels fair, not surprising.
- **R3 — confirm the counter**: verify `consumedContentIds` counts a *completed
  exercise*, and that the Daily Focus is NOT itself counted toward the N.
- **R4 — scope**: this is a **core gameplay-loop change**, bigger than PR B's
  visual redesign. It warrants its **own spec + TDD pass** (touches daily-progress
  write logic, Start Focus routing, session-quota read) — sequence it
  deliberately, do not bundle into PR B's cleanup.

The 4-moment heartbeat below now maps onto this ritual (the nudge = "complete
today's ritual"; completion = ritual done, not just the Daily Focus).

## Design principles (anti-clutter)
- **Icon-first, ≤2 words.** Every signal is a glyph + at most a number/word.
- **Calm by default.** A signal appears only in its state; absence = "all good".
- **Ephemeral where it should be.** Celebration is a one-shot, not persistent.
- **Reuse, don't invent.** Existing data + assets + helpers (see Data sources).
- **GPU-safe + reduced-motion.** transform/opacity only; honor
  `prefers-reduced-motion` (MiniPay jank history).

## The hero daily state machine
Drives the ChallengeCard progress zone + Start Focus + the gift icon. States are
derived; the gift pulse runs in parallel (it's about a reward, not the daily).

| # | State | Trigger | Visual (icon + ≤2 words) | Lives on |
|---|---|---|---|---|
| 0 | loading | `focusPassport.isLoading` | nothing (skeleton calm) | — |
| 1 | **pending today** | `!todayDone` | gentle **heartbeat glow** on the progress flame + a soft pulse ring on Start Focus | progress bar + Start Focus |
| 2 | **just completed** | `todayDone` AND completed this session | one-shot **fill sweep** + ✓ spark on the bar (~1.4s), then → state 3 | progress bar |
| 3 | **cooldown** | `todayDone` (settled) OR session at hard-max | small chip: `⏱ {Next Xh}` / `🌙 Tomorrow` | **end of the progress row** (decided 2026-06-27 — time lives with the streak) |
| ✦ | **gift ready** (parallel) | daily gift claimable | **pulse** + red dot on the corner gift icon | HUD gift icon |

Notes:
- State 1 is the **don't-break-the-streak** nudge — the single most important
  habit lever. It's a *feeling* (a heartbeat), not a sentence.
- State 3: Start Focus still works (routes to `/exercises` for replay/practice);
  the chip just sets the honest expectation "you're done for today, back in Xh".
- The cooldown clock = time to the **UTC midnight reset** (both the daily focus
  and the session quota reset there), so one timer covers "next session".

## Placement (where the eye goes) — LOCKED 2026-06-27
The cooldown chip lives at the **end of the progress row** (time lives with the
streak — one coherent zone). Start Focus only carries the state-1 pulse ring.
```
[icon] 21-Day Mind Challenge
       FOCUS PASSPORT
       🔥 6/21 focus days  ▓▓▓▓▓▓░░░░  ⏱ 5h   ← row: flame heartbeat (s1) /
                                                fill-sweep+✓ (s2) / chip (s3)
       21 days · +3 shields · $1.99   [ Join Challenge ]
            [ ⟡ Start Focus ⟡ ]                ← state 1: pulse ring only
```
Gift pulse is top-right (existing corner icon), independent.

## Data sources (all already exist)
- `todayDone`, `streak`, `isLoading` → `HubFocusPassport` (already a prop).
- Cooldown label → `dailyAvailability(completedToday)` + `cooldownLabel()`
  (`"Next Xh"` / `"Tomorrow"`), `hoursUntilNextUtcDay()` in
  `lib/hub/tile-availability.ts`. **Reuse verbatim.**
- "just completed this session" → the `chesscito:daily-progress-changed`
  CustomEvent already drives the bar; a one-shot flag on that transition fires
  the celebration (no new data).
- Session hard-max → `isAtHardMax(getDailySession())` (already in `useHubData`).
- Gift claimable → `useWelcomePackage()` / daily-tile claimable state (existing).
- Flame glyphs → `public/art/focus-passport/flame-color.*` (already used).

## Edge cases
- **Guest** (not connected): daily progress is localStorage → streak + heartbeat
  + cooldown still work. Gift pulse shows the locally-claimable state.
- **Active pass**: heartbeat/cooldown still apply (daily focus is pass-independent);
  the progress bar already shows day progress in the active layout.
- **prefers-reduced-motion**: drop the heartbeat pulse + fill-sweep; keep the
  static cues (the cooldown chip, the gift dot) so nothing is *only* motion.
- **First-ever open** (streak 0, never played): state 1 (pending) — the heartbeat
  invites the first tap; copy stays promise-first ("Start Focus").

## Scope / removals
- Implement states 1–3 + the gift pulse. (State 2 celebration is in scope.)
- **Remove** the dead Content Loop text plumbing: `primaryFocus.contentLoop`,
  the `nextStepCard` prop, and (Stage 3b) the matching Full-scaffold branches.
- Claim-queue notif dot (separate, pre-existing deferred): if kept, anchor it to
  the trophy chip or the gift icon — out of scope here, just noted.

## Acceptance (for the TDD pass later)
- [ ] `!todayDone` → progress flame + Start Focus show the heartbeat (one element,
      no extra text); reactive to the daily event without navigation.
- [ ] On completing today (event fires) → one-shot fill-sweep + ✓, then settles.
- [ ] `todayDone` (or hard-max) → cooldown chip shows `cooldownLabel` (`Next Xh` /
      `Tomorrow`); never a per-second ticking timer (static, recomputed on mount).
- [ ] Daily gift claimable → corner icon pulses + dot; clears when claimed.
- [ ] `prefers-reduced-motion` disables pulses; chip + dot remain.
- [ ] No Content Loop text label is rendered; Start Focus label stays "Start Focus".
- [ ] i18n parity (any new short string in editorial.ts + en + es).
