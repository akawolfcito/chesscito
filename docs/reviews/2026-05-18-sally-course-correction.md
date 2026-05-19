# Sally — Hub Course Correction (post-merge regression triage)

**Date**: 2026-05-18
**Trigger**: user feedback on the merged `/hub` (PR #112 + #113 + Sally fix bundles).
**Outcome**: 4-fix correction (R1–R4) shipped to `main`.

---

## What we thought we built

The SPEC 1 design (`docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md`) described the hub as a **destinations-first** surface:

- 5-slot dock (Home / Pieces / Shop / Board / Settings).
- **Contextual Hero CTA** that switches between `new-player`, `daily-pending`, and `default` variants — copy + color change to signal what to do next.
- LEARN / UNLOCK rails replacing the legacy "Practice Pieces · Train & Master" mastery title.
- Profile + Settings sheets, anchor cleanup (D13).

The spec said the Hero CTA was the new primary, implying the legacy `PrimaryPlayCta` (the gold TRAIN PIECES button) was being retired in favor of it.

## What the spec missed

The action stack in the hub is **diegetic**, not just functional:

| Position | Element | Story it tells |
|---|---|---|
| Left rail | Pieces column (rook unlocked, rest locked) | Where the player IS in the journey |
| Center | Wizard portal + small `pawn → shield → king` pill | Where the player is GOING (peón → rey) |
| Below pill | **TRAIN PIECES** (gold candy-card) | The stable training door |
| Below TRAIN | **ENTER ARENA** (cream pill) | The play door |

The two CTAs (TRAIN PIECES + ENTER ARENA) **are not duplicates**. They are train/play paired with a progression metaphor pinned between them. The pieces column on the left tells the same story from another angle. The whole stack reinforces one narrative: *start small, train, then play, then become king.*

The Hero CTA — `TRAIN ROOK / TODAY'S TACTIC / TRAIN PIECES` — tried to live in the action-stack slot but ended up:

- **Duplicating destinations**: every Hero variant pointed at `/exercises` just like TRAIN PIECES.
- **Competing visually**: two equally-loud CTAs stacked, neither one clearly dominant.
- **Breaking the narrative**: the gold candy-card asset (the kingdom's stable training door) got replaced by a CSS-painted blue button that didn't read as part of the world.

## What I did wrong (Sally's deviation)

During the first remediation pass (`docs/reviews/2026-05-18-sally-hub-inspection.md`), I read the symptom (two large CTAs racing for the same beat) and prescribed:

- **P0.1** — remove `secondaryAction` (the gold TRAIN PIECES button), keep heroCta as the only primary.

That was the wrong cut. The right cut was the opposite direction: keep TRAIN PIECES as the diegetic primary, **move the Hero CTA out of the action stack** to its true purpose (announce a daily challenge nearby, not in the center).

The user's screenshot of the intended mockup clarified the design intent that the SPEC text had under-specified.

## What we corrected (R1 → R4)

| Code | Commit | What changed |
|---|---|---|
| R1 | `d36fd8c` | Restored `secondaryAction` → TRAIN PIECES gold returns as the single primary. Stopped passing `heroCta` and `onPlayPress` from the hub-scaffold-client. Gated the scaffold's fallback PrimaryPlayCta on `onPlayPress` (opt-in) so the legacy ENTER ARENA stops auto-rendering. |
| R2 | `ce994b9` | New `<DailyBadge>` — small blue pill placed between the HUD chips and the body. Renders only when `hero.variant === "daily-pending"`. Reuses the existing hero state machine from `lib/hub/hero-cta.ts`. |
| R3 | `c0f1d36` | New `<MateDrillsTile>` placeholder mounted below the RewardColumn in the LEARN rail. Visual sibling of a locked piece tile with a "Soon" pill. Reserves the slot diegetically for the mate-drills content surface. |
| R4 | (this doc) | Lesson recorded so SPEC 2 doesn't repeat the under-specification. |

## What we keep from previous fixes

Not everything Sally proposed was wrong. The non-reverted polish stays:

- **F1** (`be7f478`) — kingdom anchor double-frame removed. Confirmed by user as the only fix that worked.
- **F5** (`1814618`) — LEARN/UNLOCK rail headers promoted to carved-green stamps.
- **F4** (`280686d`) — UNLOCK rail header hidden when the rail body is empty.
- **P0.3** (`05b9c37`) — Enter Arena promoted from ghost link to confident cream pill. User confirmed it works.

## Lesson for SPEC 2 (and future specs)

**Underline the diegesis explicitly.** When a hub surface is doing more than functional routing — when it's also carrying a narrative (peón → rey, train → play) — the spec must call that out as a non-negotiable. Otherwise a reasonable reader will see "two CTAs to /exercises" and prescribe deduplication.

Concrete checklist to embed in the SPEC 2 template:

- [ ] Does the surface tell a player story beyond its routes?
- [ ] If yes: which visual elements carry the story? (assets, columns, pills)
- [ ] Are any of those elements vulnerable to being read as "duplicate" without context?
- [ ] What's the diegetic intent of each CTA in stacks of 2+?
- [ ] When the contextual variant of a CTA renders, where does the stable variant go?

The hub's action stack was tribal knowledge inside the user's head and the mockup PNG. The SPEC text never made it explicit. The next SPEC must.

## What this means going forward

- The hub is now closer to the original mockup than it was at any point during the SPEC 1 + Phase 9 + Sally bundle cycles.
- The daily-tactic surface is preserved (badge), the mate-drills surface is signposted (placeholder tile), and the action stack is back to its intended single-primary shape.
- Future contextual nudges (new-player, default-caught-up) currently have no UI home — the daily badge only fires for `daily-pending`. If those variants need surfaces, design them with the same constraint: **never put them in the action stack**.
