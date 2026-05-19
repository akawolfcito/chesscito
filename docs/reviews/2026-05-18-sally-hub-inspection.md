# Sally — Hub Visual Inspection (post-SPEC 1 + Phase 9 merge)

**Date**: 2026-05-18
**Surface**: `/hub` (HubScaffold v1, current `main` after `e44dba3`)
**Scope**: visual triage only. Architecture/restructure deferred per user direction.
**Method**: 1-pass code reading + screenshot diff. No edits applied yet.

---

## Story (what a returning user feels)

> "I open the kingdom and the wizard floats inside two frames — one carved into the artwork, another sketched on top by CSS. My eye bounces. I find a fat green stone 'PRACTICE PIECES' that shouts at me from the middle of the screen. Just below, a blue card with three lines of copy ('PLAY TODAY'S TACTIC · today's tactic awaits') competes for the same beat — both are loud. Below that, the path to Arena is so polite I scroll past it. To the right hangs an 'UNLOCK' pill that doesn't respond to my finger. To the left, where my brain expects the green stamp 'Practice Pieces · Train & Master', I now see a tiny 'LEARN' pellet — like a friendly mural got replaced with a sticker. I tap the dock to peek at the shop and the carpet pulls me back to the lobby — the section I was in is gone."

---

## Findings & remediation map

Each finding labeled **V** (visual fix now — small surgery, low risk) or **A** (architectural — defer to next sprint).

### F1 · Double-frame around the wizard portal — **P0 · V**

**Root cause**
- `.kingdom-anchor` (`globals.css:3153`) renders a CSS gold-leaf frame: `border: 2px solid var(--gold-leaf-base)` + 4-layer box-shadow (inset highlight, outer shadow, warm-glow ring, deep-shadow drop).
- The asset itself (`/art/scene-rooted/portal-centered.png`) **already has a baked wooden scroll frame** in the artwork.
- Result: two frames stacked → reads as a poster taped onto a wall instead of an in-world portal.

**Fix (≤10 CSS lines)**
- Strip the CSS frame on `.kingdom-anchor` when the variant is `playhub` (the asset carries the frame). Keep the warm-glow halo as a soft halo behind the asset (subtle, no rectangle).
- Diff sketch:
  ```css
  .kingdom-anchor--playhub {
    border: 0;
    box-shadow: 0 0 28px 4px var(--kingdom-warm-glow);
    background: transparent;
    border-radius: 0;
  }
  ```

### F2 · Hero CTA reads as a wall of text — **P0 · V**

**Root cause**
- `HubScaffold` renders the Hero CTA as **two stacked spans**: bold label (`PLAY TODAY'S TACTIC`, 1rem) + sub (`today's tactic awaits`, 0.65rem). The card's vertical rhythm forces two lines for what is essentially one job ("solve today's puzzle").
- Editorial supplies both fields for all 3 variants in `HERO_CTA_COPY`.
- Per the new house rule (`feedback_visual_over_text.md`) onboardings should lead with visuals. The Hero CTA is the worst offender on the surface today.

**Fix (visual, ≤6 lines TSX/CSS + 1 editorial edit)**
- Drop the `sub` span from rendering on the Hero CTA. Card collapses to a single, confident line.
- Keep the variants (amber/blue) — color already carries the contextual signal (new vs daily-pending).
- Optional: add a small leading icon glyph (♟︎ for new-player, ⚡ for daily-pending) — pure visual, no extra text.
- Editorial change in the same commit: leave the `sub` field but stop rendering it. Don't delete the field yet (it's a single-source-of-truth document; keep the option open for future variant copy).

### F3 · Secondary CTA "Enter Arena →" is invisible — **P0 · V**

**Root cause**
- Phase 9 D5 deliberately styled `.hub-secondary-cta` as a "calm text-link" — transparent background, warm-brown text, 13px, hairline gold underline.
- The intent was right (not compete with Hero) but the calibration overshoots into ghost territory: with the wizard above + busy hub background, the link reads as decorative text.

**Fix (≤8 CSS lines)**
- Raise the link weight without making it a button:
  - Bump font-size to `text-sm` (14px).
  - Thicker underline (2px → 2.5px) + slight tracking.
  - Add the arrow as a tiny gold chevron chip on the right (visual cue, no extra word).
  - Hover: chevron slides right by 2px (cheap delight).
- Stays a link, just a *confident* link.

### F4 · "UNLOCK" rail pill is decorative dead weight — **P0 · V** (with A escape hatch)

**Root cause**
- Right rail header div renders the static word `UNLOCK` (`hub-scaffold.tsx:294-296`) with no click handler.
- The rail body (PremiumSlot) only renders when `showPremiumSlot` is true — currently false by default, so the header floats above empty space.

**Fix (visual, ≤5 lines TSX)**
- **Option A (recommended now):** hide the header when the rail body is empty. One conditional — purest visual fix.
  ```tsx
  {showPremiumSlot ? (
    <>
      <div className="hub-scaffold-rail-header" data-rail="right">UNLOCK</div>
      <PremiumSlot ... />
    </>
  ) : null}
  ```
- **Option B (architectural — defer):** wire UNLOCK to open ProSheet directly (turns the rail into a real CTA). Requires deciding whether the rail is "label" or "destination" — that's a SPEC 2 conversation.

### F5 · "LEARN" pill feels like regression vs old green stamp — **P1 · V**

**Root cause**
- Phase 9 styled `.hub-scaffold-rail-header` as a small amber candy-frame pill (4×12px padding, 0.55rem text). Mechanically correct (candy palette) but visually anemic compared to the previous green "Practice Pieces · Train & Master" carved-stamp aesthetic.

**Fix (≤12 CSS lines)**
- Promote the rail header from pill → small carved badge:
  - Increase padding (`6px 14px`), font size (`0.7rem`), letter-spacing (`0.22em`).
  - Replace flat amber gradient with the candy-frame green palette used for the legacy stamp.
  - Add 2px wood-tone bottom border so it reads as "carved into the rail wood" — same trick the SecondaryCta uses with the underline.
- Keep the rail-marker behavior (still not interactive) — this is purely about *presence*.

### F6 · Dock taps return to `/hub`, lose section state — **P0 · A** (with V workaround)

**Root cause**
- `PersistentDock` taps `router.push(item.href)`. Shop → `/hub?sheet=shop`, Settings → `/hub?sheet=settings`. Whenever the user is on `/exercises` or `/arena` and taps those slots, **they get yanked back to `/hub`** because the sheet system only mounts on that route.
- The pre-SPEC-1 dock opened sheets in place (PersistentDock used to receive sheet trigger props per route).

**Fix options**
- **A (visual workaround — ship now, ≤15 lines TSX):** make Shop/Settings deep-link respect the *current* pathname. Instead of `/hub?sheet=shop`, push `${pathname}?sheet=shop` and have `/exercises` + `/arena` page components honor the same `?sheet=` param the hub does. The sheet mount points already exist on those routes (per SPEC 1 D7 commentary about orphan sheets); we just need to wire the param handler. **Risk: medium-low — touches 2 page components + 1 dock util.** Recommended for this pass if the appetite is there.
- **B (architectural — defer):** lift sheets to a global `<DockSheetsProvider>` portal so any route can render them without route-specific wiring. Cleaner, bigger surgery.

If we hold the "no restructure" line strictly, the dock fix is **deferred** and we ship F1-F5 now. Honest framing: F6 is the most user-impactful of the six and warrants picking **Option A** in this sprint even though it nudges architecture.

---

## Priority bundle for "fix-now" sprint

| # | Finding | Type | Effort | Risk |
|---|---|---|---|---|
| 1 | F1 — Drop double-frame on anchor | V | ~10 min | 🟢 low |
| 2 | F2 — Single-line Hero CTA | V | ~15 min | 🟢 low |
| 3 | F3 — Beef up Secondary CTA visibility | V | ~10 min | 🟢 low |
| 4 | F4 — Hide UNLOCK header when empty | V | ~5 min | 🟢 low |
| 5 | F5 — Promote rail header from pill to stamp | V | ~20 min | 🟡 medium (visual) |
| 6 | F6 — Dock keeps current section (Option A) | V/A border | ~30 min | 🟡 medium |

**Total**: ~90 minutes of careful surgery + visual smoke. All test baselines should hold (no logic changes outside the dock routing).

---

## What this brief does NOT touch (deferred)

- Rebuilding the hub's grid into a true 3-zone layout (rails as real cards, not rail-headers).
- Replacing the wizard scroll asset with a non-frame variant.
- Turning UNLOCK into a destination (needs SPEC 2 cosmetics conversation).
- Global sheet state provider (Option B for F6).
- Onboarding replacement (we deleted the text card; a future *visual* primer — animation/character beat — is a separate design exercise).

---

## Suggested next move

1. Confirm priority bundle (all 6 vs cherry-pick).
2. Apply as **6 granular commits**, one per finding, on `main` (no PR — visual fixes match the convention used in the candy-alignment audit cycle).
3. Re-screenshot after F1-F6 land. If the wizard portal still feels heavy, that's the signal to go to SPEC 2 with a clean head.
