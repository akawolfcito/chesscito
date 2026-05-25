# Welcome Carousel — UX Audit + Decision (2026-05-25)

**Status:** awaiting product decision
**Owner:** Wolfcito
**Source feedback:** Phase #1 of post-marco UX review

## What it is today

- Component: `apps/web/src/components/welcome/welcome-overlay.tsx`
- Mounts at: `/exercises` (NOT `/hub` — see "open question A" below)
- 3-card carousel inside a `<CandyCard atmosphere="gold">`, scrim modal at `z-[70]`
- Cards: trophy / coach / crown — copy in `WELCOME_COPY` (editorial.ts)
- Per-slide CTA: `Continue` → next slide; last slide: `Play` → dismiss
- Persistent `Skip` link on every slide
- One-shot per browser: `chesscito:welcome-dismissed` localStorage flag
- Smart return-detection: `useOnboardingSignal(address)` checks PRO + badge + shield + founder on-chain; positive signal auto-dismisses without showing the carousel
- Telemetry: `welcome_view` per slide, `welcome_skip`, `welcome_complete`, `welcome_auto_dismissed`
- A11y: WAI-ARIA APG carousel pattern (`role="dialog"`, `aria-roledescription="carousel"`, slide counters, sr-only labels)

## Strengths (working as designed)

1. **Already on-brand.** Uses `CandyCard`, `CandyIcon`, candy-modal-scrim — same vocabulary as the rest of the app. NOT a foreign element.
2. **Smart auto-dismiss.** Returning wallets never see it — the on-chain signal beats the first paint and dismisses silently. No carousel friction for users with prior progress.
3. **Robust escape hatch.** `[Skip]` on every slide; not buried behind the last slide.
4. **One-shot.** Once dismissed, never resurfaces. localStorage flag survives reloads.
5. **Instrumented.** Funnel metrics in place — we can measure skip rate per slide, complete rate, auto-dismiss rate.

## Weaknesses + open questions

- **A. Lives on `/exercises`, not `/hub`.** Memory says `/` → `/play-hub`. If the user's first stop is `/hub` (not `/exercises`), the carousel never fires on their actual entry point. Could be intentional (only show when they enter the exercises surface for the first time) OR a mismatch with the user's mental model of "carrusel de inicio". **Worth confirming with the user.**
- **B. 3 slides may be too many.** Industry data on onboarding carousels: completion rates drop sharply past slide 2. Without our actual telemetry I can't prove it, but the conventional wisdom (and the brevity of our copy per slide) suggests we could collapse to 1-2 cards.
- **C. Modal interrupts.** A first-run user lands on a chess UI, then a modal blocks the board. Some game UX schools prefer in-context affordance (tooltip on first interaction, ambient banner) over interruption. Tradeoff: contextual = less reliable retention; modal = friction.
- **D. The `Skip` link is muted (opacity-70, small).** Acceptable per accessibility (visible, focusable, persistent), but a player who wants to skip has to look for it. Common pattern: bigger skip on the FIRST slide, smaller on subsequent ones.

## Three options

### Option 1 — Keep + tighten (LOW EFFORT, LOW RISK)

Status quo with two surgical tweaks:
- Collapse 3 cards → 2 (merge slide 2 + 3 into one "Practice and earn" message).
- Bump `Skip` size on slide 1 (so first-glance users have a fast exit).

**Pros:** No new components, preserved telemetry/a11y/one-shot logic, smaller cognitive load.
**Cons:** Doesn't address open question A (still on /exercises only).
**Effort:** ~1 commit. ~30 min.

### Option 2 — Replace with a single Welcome Card (MED EFFORT, MED RISK)

Drop the carousel mechanism entirely. Replace with one `CandyCard` showing:
- Title: "Welcome to Chesscito"
- 3 bullet points (one per former slide)
- Primary CTA: "Play"
- Secondary: small "Skip" text link

**Pros:** Faster to dismiss (one tap), simpler component, easier to mount on /hub too if we want broader coverage.
**Cons:** Loses the "discoverable progression" feel; condenses copy possibly too aggressively.
**Effort:** ~2 commits (component + tests). ~1 hour.

### Option 3 — Remove entirely (LOW EFFORT, MED-HIGH RISK)

Delete the WelcomeOverlay. Rely on:
- Contextual onboarding (tutorial banner on board appears for first-run users via existing `tutorialBanner` mechanism).
- The first piece-picker render naturally shows "Rook" selected — visual progression IS the onboarding.
- Mission-briefing card (`MissionBriefing`) already plays a similar role on first-run.

**Pros:** Zero friction. The product already has multiple contextual first-run primers — the carousel arguably duplicates them.
**Cons:** Loses any standardized "you are here" entry moment; harder to convey value props (badges / coach / PRO) without explicit telling.
**Effort:** ~1 commit (delete component + remove imports + delete copy + tests). ~30 min.

## My recommendation

**Option 1 — Keep + tighten**, with a follow-up to answer open question A separately.

**Why:**
- The carousel is the cheapest place to communicate value props to a brand-new player on a 390px screen with no prior context. Removing it (Option 3) trusts contextual onboarding too much for first-run wallet users.
- Option 2's "single card" is tempting but loses the per-slide progression that lets telemetry tell us which message lands. If we keep telemetry, we get data to make a smarter decision later.
- The actual fix that probably matters most is the SLIDE COUNT (3 → 2), which is the minimum-effort change with the most bang.

**Follow-up (separate task):** look at `welcome_view{slide_index}` and `welcome_skip{at_slide}` telemetry in production. If slide 1 sees 100% views but slide 2-3 see <40%, that's evidence-driven Option 2 territory.

## Decision matrix

| Question | Answer needed |
|---|---|
| Mount location: keep on /exercises or also on /hub? | User call |
| 3 slides → 2 slides if Option 1? | Approve copy merge proposal? |
| Skip link size bump? | Yes / no |
| If Option 2: which 3 bullets to keep? | User call |
| If Option 3: any specific value prop we'd LOSE? | User to flag |

## What I need from you

Pick an option (1, 2, or 3) — or tell me to deep-dive on one of the open questions first. After your call I'll cut a focused PR.
