# Handoff — Landing onboarding: art refresh + slide 4 rework

**Date:** 2026-07-08
**Branch:** `feat/landing-slides-art-refresh` (8 commits, **NOT pushed** — founder pushes himself)
**Base:** `main` @ `1a181d20`
**Scope:** `apps/landing` only. No contracts, no `apps/web`, no DB.

---

## Where we are

Slide 4 of the onboarding carousel was rebuilt three times in this session, ending
in a structure that is **not** what it started as. Slides 1, 2 and 3 got new art and
a Rowdies display face, but their **composition was not touched** — that is the next
piece of work.

### Commits (oldest → newest)

| SHA | What |
|---|---|
| `6edb9fa2` | New art for slides 1, 2, 4 via the png+webp+avif triplet pipeline |
| `f7fc3cae` | Slide 4 rebuilt as two entry-point mode cards (Learn / Play) |
| `db273136` | Learn card tinted green; Rowdies on the display titles |
| `c4fb9493` | Play CTA chrome restored, blue deepened |
| `bda787ea` | Play CTA demoted to a light secondary button |
| `6f7f91b3` | Play CTA unhooked from the navy bevel token |
| `fa4438ff` | **Slide 4 rebuilt again: one CTA + escape link. Prices removed.** |
| `4c40f88c` | Slide 4 CTA moved to the shell's `ctaSlot`, matching START/NEXT |

Commits `f7fc3cae` → `6f7f91b3` design a two-card layout that `fa4438ff` then deletes.
That is intentional, not churn: the two-card version is what taught us the layout was
wrong. Read the `fa4438ff` message for the reasoning.

---

## The decision that matters

**Slide 4 no longer asks the visitor to choose.** It recommends.

Two symmetrical cards asked people to compare two products and two prices at the moment
they know least. Worse, the prices **inverted** the preference the layout was built to
express: Learn showed `$0.99`, Play said `"free"`. No tint or elevation beats that
reading. The in-app switch already makes the choice reversible and cheap, so the screen
now states one recommendation and keeps a quiet way out.

Final structure:

- Header (Rowdies): *"Learn the pieces first"* / *"Play chess when you're ready."*
- Divider, then the hero art (`avatar-learn-path` — wolf presenting the board).
- Promise line: *"Build your daily chess habit."*
- Escape link **inside the frame**: *"Already know chess? Jump to Play"* → `/api/enter?mode=play`
- Primary CTA **outside the frame**, in `SlideShell`'s `ctaSlot`: *LEARN PIECES* → `/api/enter?mode=learn`

**Prices left the slide entirely.** Season Pass and PRO belong in context, after the
visitor knows what they are buying.

The word *"free"* was also dropped, at the founder's call: Learn's first exercise is not
a zero-friction claim we want to make this early.

### Why the CTA is outside the frame and the link is inside

Slides 1-3 put START/NEXT in `ctaSlot`, at ~694px on a 390×844 viewport. Slide 4's
button initially rendered inside the frame at ~533px. Three slides teach the thumb one
position; the fourth moved it 160px on the tap that matters most.

Moving the button out left the link below it, on the grass — brown on green, unreadable,
and a perfect trap for a thumb that overshoots the CTA. Pulling the link back inside the
frame solved three things at once: it reads on parchment, it fills the space the button
left, and now **the only thing below LEARN PIECES is empty meadow**.

---

## Guardrails now encoded

- `onboarding-carousel.test.tsx` pins the slide-4 link count at **5** (Learn, Jump to
  Play, Privacy, Terms, Support). If someone gives Play a rival button, the test fails.
- `.slide4-jump-link`'s hit area is the width of its own text, `min-height: 44px`.
- `AvatarWithFade` no longer has a default width. See the memory note — a default there
  cannot be overridden from `className`.

---

## Assets

New triplets in `apps/landing/public/art/landing-slides/`:

| Asset | Source | Used by |
|---|---|---|
| `avatar-chesscito-welcome` | `design/slide-new/welcome-slide1.png` | Slide 1 + `welcome-back.tsx` |
| `avatar-21-day-challenge` | `design/slide-new/21-day-slide2.png` | Slide 2 |
| `avatar-learn-path` | `design/slide-new/slide4-learn-option.png` | Slide 4 hero |

Deleted: `avatar-choice.*` (the thinking wolf — orphaned when slide 4 lost its corner
avatar). Also removed the dead `ICONS.enterArenaPiece` entry.

Generated with `scripts/gen-triplet.sh <source> <out-dir>` (cwebp q85, avifenc q42).
Copy the source to a scratch file named after the target basename first — the script
derives the output name from the source filename.

---

## Verification

Every commit was checked with a real dev server (`pnpm -C apps/landing dev --port 3111`)
and Playwright screenshots at 390×844 @2x, not just tests.

- `pnpm -C apps/landing exec tsc --noEmit` — clean
- `pnpm -C apps/landing test` — **29/29 passing**
- Slides 1, 2, 3 visually unchanged in composition across the whole branch.

**Not run:** `pnpm test:e2e:visual`. The landing app has no VR baselines that cover
these slides, but confirm before merging.

---

## Next session: slides 1, 2, 3

The founder wants the same exercise repeated on the other three slides, **starting from
Sally** (`bmad-agent-ux-designer`), at exactly this point.

The method that worked, in order:

1. Founder states **what the screen must achieve** — what the user should think or do on
   leaving it. Not what it should look like.
2. Sally critiques the goal and the current screen, names the forces in play.
3. Generate a **static image mock** from a written prompt before any code. Evaluate
   structure only — a generated image flatters composition, kerning and lighting in ways
   CSS will not.
4. Then build, screenshot the real thing, compare.

Founder has not yet said what he wants from slides 1, 2 and 3. **Ask first.**

### Known issues carried forward

- **Rowdies loads weights 300/400/700 only** (`layout.tsx`), but `.fantasy-title`
  elements use `font-extrabold` (800). Browsers round to 700. Harmless and pre-existing
  (`.primary-play-cta` has always done this), but if a true 800 is ever wanted, the
  weight array needs it.
- Slide 4's frame has empty parchment below the escape link. Tolerable; growing the hero
  art would fill it.
- Slide 2's title lockup (`-mt-14`) covers the bottom rank of the board in the new art —
  the pawn → knight → rook → queen progression is hidden.
- Slide 1's "Welcome to" sits close to the board's lower edge in the new art.

### Open questions

- Is the escape link's rate worth measuring? If more than ~20% of visitors tap "Jump to
  Play", the premise that this audience does not know chess is wrong, and slide 4 is
  costing users rather than winning them.
- `/api/enter?mode=play` sets `preferredMode=play` for a year. A visitor who taps the
  escape link once lands in Play on every return. Intended?
