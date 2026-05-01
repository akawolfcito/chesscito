# UI Systems Audit — Chesscito (2026-05-01)

> Author: Sally (UX Designer persona, BMad)
> Brief: restore UI consistency before continuing product validation (PRO).
> Scope: layout, hierarchy, information architecture — not visual polish.
> References used: `DESIGN_SYSTEM.md` (surface taxonomy A/B/C/D), `docs/reviews/ux-review-2026-04-18-redesign.md`, `docs/reviews/visual-qa-2026-04-30-realignment.md`, `MEMORY.md`, current dock + mission-panel-candy + contextual-action implementations.

---

## 1. Overall diagnosis

**Chesscito has a strong visual language but no UI operating system.**

The candy-frame palette, fantasy typography, and surface taxonomy (A/B/C/D in `DESIGN_SYSTEM.md`) already give us premium-game DNA. What's missing is **zone ownership**: every screen invents its own header treatment, its own contextual actions, and its own monetization placement. Features have grown by accretion — each new capability earns a floating button instead of a reserved slot.

The core problem is not aesthetic. It's **structural ambiguity**:

- The top of every screen is overloaded (badge + objective + PRO + mode tabs in one band).
- The board area has orphan "actions" floating around it (whistle / blue-star / trophy) without a contract for where actions live.
- The bottom dock works (5 items, z-60 invariant), but its rules aren't replicated upward — there's no equivalent invariant for the **top** of the screen or for **contextual actions adjacent to gameplay**.
- Monetization (PRO chip) competes for the player's anchor zone instead of living in a reserved promotional slot.
- Trophies appear in two places (dock + floating button), which is the canonical signal that the IA is broken.

**The fix is not "redesign screens."** It's "define zones, write ownership rules, then route every existing element into one of those zones." Once the rules exist, the screens fall into place because each element has exactly one home.

---

## 2. Top issues by severity

### HIGH

1. **No top-zone invariant.** Status (PRO/streak/level), navigation context (current piece, current mode), and goal text (objective) all share the top 96px without a contract. Result: every screen looks like a different app.
2. **Floating actions without ownership.** Whistle / star / trophy buttons live in undefined airspace around the board. They feel like ornaments, not affordances.
3. **Duplicated destinations.** Trophies in dock + trophies as floating button. Anytime the same destination appears twice, the player can't build a mental map.
4. **Monetization in the anchor zone.** PRO chip sits in the top band where the player's attention lands first. It competes with gameplay context (objective + piece). This actively reduces conversion (visual noise = blindness).
5. **Mission-briefing modal overlaps every sheet on first load** (from visual-qa-2026-04-30, Issue 1). This is structural, not cosmetic — it's a stacking-rules failure.

### MEDIUM

6. **Mode tabs without home.** Tabs (e.g., "exercises / labyrinths") drift between top header, contextual area, and inline content depending on screen. Tabs should be a recognizable affordance, not a chameleon.
7. **Contextual-action slot under-defined.** `contextual-action-slot.tsx` reserves vertical space (52px) even when empty, but doesn't define **what** can live there — it's a slot without a contract.
8. **Surface taxonomy (A/B/C/D) is documented but not enforced uniformly.** Some sheets are at full-height (B), some are quick-pickers (C), but secondary pages (about, support, legal) don't fit the taxonomy cleanly and rely on `<AppShell>` ad-hoc.
9. **PRO is treated as "another feature" not as a system layer.** PRO benefits should appear as **state changes inside existing zones**, not as a separate chip. (e.g., a gold border around the player's badge when PRO is active, not a chip in the header.)
10. **Sheet underlay leak** when modals stack (visual-qa Issue 5) — the previous sheet bleeds through at ~40% opacity. Reads as "two screens at once."

### LOW

11. **Arena soft-gate stacks 6 decision blocks** (visual-qa Issue 3). IA problem disguised as a content problem — too many distinct concerns in one surface.
12. **Top HUD mixes 3 visual styles in one row** (badge pill + objective pill + PRO chip; visual-qa Issue 4). Cosmetic symptom of issue #1.
13. **Z-index sprawl** without a single documented ladder (`ux-review-2026-04-18` P2). Risks regressing the dock invariant.
14. **No reserved "promotional/discovery" slot** for new features. Each new launch fights for the same anchor zone.

---

## 3. Zone map proposal — Chesscito Mobile (390px)

The screen is divided into **6 zones, top to bottom**. Every UI element on every screen belongs to exactly one zone.

```
┌──────────────────────────────────────────┐
│ ZONE 1 — STATUS BAR (32–40px)            │  ← always visible
│   Player identity, currency, streak       │
├──────────────────────────────────────────┤
│ ZONE 2 — CONTEXTUAL HEADER (52–64px)     │  ← per-screen
│   Screen title + 1 contextual control    │
├──────────────────────────────────────────┤
│                                          │
│ ZONE 3 — CONTENT / BOARD (flex-1)        │  ← the only zone
│   The board, the lesson, the result.     │     that should
│   Dominant. Nothing competes.            │     "earn" the eye
│                                          │
├──────────────────────────────────────────┤
│ ZONE 4 — CONTEXTUAL ACTION RAIL (56px)   │  ← per-screen, ≤2 actions
│   Primary CTA + optional secondary       │
├──────────────────────────────────────────┤
│ ZONE 5 — DOCK (72px, z-60, invariant)    │  ← always visible
│   5 destinations, never more, never less │
├──────────────────────────────────────────┤
│ Safe area bottom inset                    │
└──────────────────────────────────────────┘

Overlays (not zones — orthogonal):
  • Quick Picker (Type C) — auto height, anchored to dock, scrim z-50
  • Destination Sheet (Type B) — h-100dvh, dock floats on top at z-60
  • System Modal (Type D) — opaque, blocks dock, single decision
  • Toast / coachmark — z-70, transient, never blocks input
```

### Zone descriptions

**Zone 1 — Global Status Bar (32–40px, z-50)**
The player's persistent identity. Same on every screen. Right-aligned cluster: streak count + level chip + (if PRO) gold ring on level chip. Left-aligned: avatar/handle. Single source of truth for "who am I in this game."

**Zone 2 — Contextual Header (52–64px)**
Per-screen title + at most ONE contextual control (back button, info icon, or filter). This is where mode tabs live IF a screen has them — but only one row of tabs, never nested. If a screen has no header (e.g., immersive Arena match), Zone 2 collapses to 0.

**Zone 3 — Content / Board (flex-1)**
The reason the player opened the app. Nothing else. No floating actions, no chips, no badges. Anything that wants to live here must be **part of the gameplay surface itself** (e.g., move highlights, capture animations, last-move dot).

**Zone 4 — Contextual Action Rail (56px)**
A single horizontal row directly above the dock. Maximum 2 buttons: ONE primary CTA (large, gradient, centered) + ONE optional secondary (ghost, side-aligned). This replaces every floating button currently around the board. If a screen has no primary action right now (e.g., browsing leaderboard), Zone 4 collapses to 0.

**Zone 5 — Dock (72px, z-60, INVARIANT)**
Already correct. 5 destinations: Badges, Shop, Free Play, Leaderboard, Invite. **Never add a 6th.** Never replace a slot to add a new feature unless an existing slot truly retires.

**Overlays — surface taxonomy (already defined in DESIGN_SYSTEM.md §8)**
Type A (full page), B (destination sheet), C (quick picker), D (system modal). The audit confirms taxonomy is correct; what's missing is **enforcement** and **mapping every existing surface to exactly one type** (see §6).

---

## 4. Ownership rules per zone

### Zone 1 — Status Bar
**Allowed**: player identity (avatar/handle), level chip, streak counter, currency (if any), PRO state as a passive indicator (gold ring on existing element).
**Forbidden**: CTAs, navigation, monetization chips, gameplay-related state ("current piece", "current objective"), notifications.
**Why**: this zone is read-only identity. Putting actions here makes it look like a notification center; putting gameplay here couples global state to per-screen content.

### Zone 2 — Contextual Header
**Allowed**: screen title, back button (left), ONE contextual control (right, e.g., info, filter, edit), mode tabs (single row, max 4 options).
**Forbidden**: monetization, secondary CTAs, status indicators, global navigation.
**Why**: this is per-screen orientation. Crowding it forces the player to parse the header instead of the content.

### Zone 3 — Content / Board
**Allowed**: the gameplay surface itself, board pieces, move dots, capture flashes, in-board overlays (promotion picker, check pulse), last-move highlight, tutorial banner (only when actively teaching).
**Forbidden**: floating buttons, chips, FAB, monetization, navigation, anything launched from outside the board's logic.
**Why**: this is the focus zone. It must "earn" the eye uncontested. Every floating element added here is a -10% on perceived calm.

### Zone 4 — Contextual Action Rail
**Allowed**: ONE primary CTA (e.g., "Hint", "Confirm move", "Resign", "Mint Victory"), ONE secondary (e.g., "Skip", "Reset"). If neither exists, the rail collapses to 0px.
**Forbidden**: more than 2 buttons, navigation (that's the dock's job), persistent chips, ambient indicators.
**Why**: every screen has at most one "what do I do next?" — that's the primary CTA. Two actions is the maximum a player can hold in working memory at the action-decision point. Three or more = paralysis.

### Zone 5 — Dock
**Allowed**: exactly 5 destinations (Badges, Shop, Free Play, Leaderboard, Invite). Active-route signal (glow + scale).
**Forbidden**: contextual actions (that's Zone 4), notifications (badges as small dots are fine), modal triggers.
**Why**: the dock is the player's home base. Its stability is what makes the rest of the UI feel safe to explore. Already correct — defend it.

### Overlays
**Allowed**: see DESIGN_SYSTEM.md §8 — the A/B/C/D taxonomy is the contract. Use the decision tree literally.
**Forbidden**: any new fixed-position element with `z-index > 60` (would leapfrog the dock invariant).

---

## 5. Specific recommendations for current controls

| Element | Current state | Verdict | Action |
|---|---|---|---|
| **Whistle button (bottom-left of board)** | Floating, no zone | Remove from current spot | Move to Zone 4 as the **secondary** action: "Hint" (ghost button, left-aligned). Only renders when `hintsAvailable > 0`. |
| **Blue-star button (bottom-center of board)** | Floating, ambiguous purpose | Remove or promote | If it's "current objective shortcut": delete (objective already lives in Zone 2). If it's "rate this exercise": move to a Type-C quick-picker triggered from Zone 4. |
| **Trophy floating button** | Duplicates dock destination | **Delete.** | Trophies live in the dock (Badges) and in `/trophies`. Floating button is dead navigation. |
| **GET PRO chip** | Anchor zone (Zone 1/2 boundary) | Demote | Remove from header. Replace with: (a) a one-time **promo card** that lives in the contextual-action rail of `/play-hub` for first 7 days, then disappears; (b) a passive **gold ring on the level chip** in Zone 1 once converted; (c) a dedicated PRO destination accessible from the Shop dock item (sub-section). |
| **Piece selector** | Currently a chip in the top band | Keep, move | Demote to Zone 2 as a single chip with chevron-down affordance, opens a Type-C quick-picker. The chip is the only Zone-2 control on `/play-hub`. |
| **Goal pill ("Move to h1")** | Currently a separate pill | Merge | Fold into the Zone-2 row next to the piece chip, or render it as a **subtitle** below the piece chip. Single visual treatment. Stop competing with the piece chip. |
| **Mode tabs** | Variable placement | Codify | Always Zone 2, single row, max 4 tabs, segmented-control treatment. If a screen has more than 4 modes, the modes are wrong — split into sub-screens. |
| **Bottom navigation (dock)** | 5 items, working | Keep, defend | Already correct. Hard rule: never grow to 6, never shrink to 4. |

---

## 6. Reorganization proposal by screen

### `/play-hub` (the most overloaded screen)

```
Zone 1: [avatar handle] [streak: 7] [Lv 4 chip]
Zone 2: [♖ Rook ▾]  Move to h1
Zone 3:        [BOARD]
Zone 4: ────────────────  (collapsed when no contextual action)
Zone 5: [Badges][Shop][Free Play][Leaderboard][Invite]
```

- Remove: PRO chip, whistle, blue-star, trophy floating button.
- Merge: piece selector + objective into a single Zone-2 row.
- Reserve: Zone 4 stays empty until a tutorial step or hint is available.
- First-visit briefing: render BEFORE Zone 5 mounts (Type D system modal), never on top of an open sheet (fixes visual-qa Issue 1).

### `/missions`

```
Zone 1: [identity row]
Zone 2: Missions    [filter ▾]
Zone 3: scrollable list of missions
Zone 4: [Continue current mission]   (only if one in progress)
Zone 5: dock
```

- One header, one filter, list, one CTA. That's it.
- Mission detail opens as Type-C quick-picker. Mission run opens as Type-A full page (route to `/play-hub` with mission context).

### `/badges` (currently a sheet)

```
Type-B destination sheet (h-100dvh, dock floats at z-60).
Zone 2 (inside sheet): Badges    [info icon → opens "How badges work" Type-C]
Zone 3 (inside sheet): grid of badges, soulbound state visible
Zone 4 (inside sheet): collapsed (claiming happens inline per-card)
```

- Per-badge claim button is **inside the card** (not a global Zone-4 action).
- "How badges work" is a Type-C quick-picker, not a route.

### `/arena`

Currently violates Zone-3 with 6 decision blocks (visual-qa Issue 3).

```
Zone 1: identity
Zone 2: Arena    [back to hub]
Zone 3 (during match): immersive board only (dock auto-hides — already correct per DESIGN_SYSTEM.md exception list)
Zone 3 (pre-match): difficulty selector — 3 cards, Easy pre-selected
Zone 4 (pre-match): [Enter Arena]   primary CTA
Zone 4 (mid-match): [Resign]   secondary, no primary (move is the primary, lives in Zone 3)
Zone 4 (post-match): [Mint Victory]   primary, [Play Again]   secondary
```

- Move warm-up gate to a single inline link below difficulty cards.
- Move prize pool to a thin pill in Zone 2 (right side, beside title), not a full row.
- Color toggle (white/black): leave inline above difficulty cards — it's a setting, not a decision block.

---

## 7. UI system rules for future scalability

These are the **invariants**. Every PR that adds UI must pass these. Add to `DESIGN_SYSTEM.md` after this audit is approved.

1. **One primary CTA per screen.** If a screen has two primaries, one of them is wrong. Demote, route, or delete.
2. **No floating action without ownership.** Every interactive element must belong to a named zone (1–5) or a defined overlay type (A/B/C/D). If you can't name the zone, the element doesn't ship.
3. **No duplicated destinations.** A single destination has exactly one entry point in persistent navigation. Contextual shortcuts (e.g., "View all badges" link inside a victory screen) are fine because they're per-screen, not persistent.
4. **Monetization never lives in Zone 1 or Zone 3.** It lives in Zone 4 (contextual offer), inside a destination sheet (Shop, PRO sub-section), or as a passive state indicator (gold ring on existing element).
5. **Every feature category needs a reserved slot before launch.** New feature → which zone owns it? If the answer is "we'll figure it out," it's not ready to ship.
6. **The dock is sacred.** 5 items, z-60, no exceptions outside the documented list (`/arena` match, `/victory`, splash, system modal).
7. **Surfaces follow the taxonomy literally.** Any new surface is exactly one of A/B/C/D. The PR checklist in DESIGN_SYSTEM.md §8 is enforced.
8. **First-visit / onboarding overlays defer to existing sheets.** Briefing modals (Type D) check `anySheetOpen` before mounting. No more first-load stacking.
9. **PRO benefits show up as state inside existing zones**, not as separate chips. Gold ring, gold tint, "no ads" by absence — never a banner that fights for attention.
10. **Z-index ladder is documented at the top of `globals.css`.** New rules audit-checked. Never `z > 60` outside system modals.
11. **Contextual-action slot collapses to 0 when empty** (currently reserves 52px — visual debt; fix per ux-review-2026-04-18 P1).
12. **Editorial.ts is the only place copy lives.** Already a rule; failing in 3+ files (mission-briefing, coach-history, arena-board per ux-review). Reinforce.

---

## 8. Quick wins vs structural changes

### Quick wins (≤1 day, atomic commits)

- [ ] **Delete trophy floating button.** Single component removal. Closes IA duplication.
- [ ] **Remove PRO chip from header.** Move to a single promo card in Zone 4 of `/play-hub`, gated to first-7-days.
- [ ] **Guard mission briefing against open sheets** (already in visual-qa-2026-04-30 quick-wins).
- [ ] **Pre-select Easy in arena soft-gate** (already in visual-qa-2026-04-30 quick-wins).
- [ ] **Collapse contextual-action-slot to `null` when empty** (ux-review-2026-04-18 P1).
- [ ] **Document z-index ladder at top of `globals.css`.**
- [ ] **Decide whistle = Hint (Zone 4 secondary) or delete it.** Then ship.
- [ ] **Decide blue-star button purpose.** Move or delete in same commit.

### Structural changes (require a plan + spec)

- [ ] **Define Zone-1 status bar component** (`<GlobalStatusBar />`). Replaces ad-hoc top treatments across all screens.
- [ ] **Define Zone-2 contextual-header component** (`<ContextualHeader title slot />`). Standardizes piece-chip + objective + back-button layout.
- [ ] **Define Zone-4 contextual-action-rail component** (`<ContextualActionRail primary secondary />`). Replaces every floating button.
- [ ] **Refactor `/play-hub`, `/arena`, `/missions`, `/badges` (sheet)** to use the three new zone components.
- [ ] **PRO architecture overhaul**: kill the chip, add `<PROIndicator />` (passive gold ring), wire Shop → PRO sub-section as a Type-B destination sheet.
- [ ] **Surface-taxonomy enforcement**: add a Storybook (or simple `/dev/surfaces` route) that renders every existing sheet/modal classified A/B/C/D, plus a CI lint that flags any new `<Sheet>` without a documented type comment.

---

## 9. Suggested next implementation order

### Phase 0 — Decisions before code (1 session, no commits)

1. Approve this zone map (1–5) as the canonical layout.
2. Decide the fate of the 3 floating buttons (whistle / star / trophy). Recommended: whistle → Zone 4 secondary "Hint"; star → delete or convert to in-board affordance; trophy → delete (dock duplicate).
3. Decide PRO placement: passive gold ring in Zone 1 + promo card in Zone 4 (first 7 days) + Shop sub-section. Kill the chip.

### Phase 1 — Quick wins (1–2 days, granular commits)

4. Remove trophy floating button.
5. Remove PRO chip from header. Add temporary placeholder text in Zone 4 (full migration in Phase 3).
6. Guard mission briefing modal against open sheets.
7. Pre-select Easy difficulty.
8. Collapse contextual-action-slot when empty.
9. Document z-index ladder in globals.css comment block.

### Phase 2 — Spec the zone primitives (1 day, no production code)

10. Write spec for `<GlobalStatusBar />`, `<ContextualHeader />`, `<ContextualActionRail />`. Each component: props, allowed children, forbidden cases.
11. Red-team the spec (use `superpowers:requesting-code-review` against it before implementation).
12. Add the 12 system rules from §7 to `DESIGN_SYSTEM.md` and reference this audit doc.

### Phase 3 — Build zone primitives + refactor `/play-hub` (3–4 days, TDD)

13. Implement the three zone components with tests.
14. Refactor `/play-hub` to use them. This is the canary screen — if it works here, it works everywhere.
15. Run visual QA on `/play-hub` against the new zone map.
16. Open PR, review, merge.

### Phase 4 — Migrate remaining screens (1 week)

17. `/arena` — apply zone map, fix soft-gate IA (collapse to ≤3 decision blocks).
18. `/missions` — apply zone map.
19. Sheets (badges, shop, leaderboard) — confirm each is properly Type B; add `<ContextualHeader />` inside each.
20. Secondary pages (about, support, legal) — confirm `<AppShell>` is Type A and uses the same `<ContextualHeader />`.

### Phase 5 — PRO architecture (3–5 days)

21. Implement `<PROIndicator />` (passive state).
22. Build PRO sub-section inside Shop (Type B destination sheet).
23. Replace temporary placeholder from Phase 1 Step 5 with the proper conversion surface.
24. Measurement freeze: 7 days before declaring PRO conversion baseline.

### Phase 6 — Defense (ongoing)

25. Storybook or `/dev/surfaces` route classifying every existing surface A/B/C/D.
26. Lint rule: any new `<Sheet>` without a `// surface-type: B` comment fails CI.
27. Quarterly UI audit ritual (already partially established via `ux-review` skill; reinforce cadence).

---

## Closing notes

The hard truth: the visual layer of Chesscito is in good shape. The candy palette, the dock, the surface taxonomy in DESIGN_SYSTEM.md — all of that is solid. **The product feels patchy not because individual screens are ugly, but because there's no contract telling each screen "where things go."**

Once we ship the 6-zone map and the three zone primitives, every future feature becomes a placement question — not a redesign question. That's when Chesscito stops feeling like accumulated screens and starts feeling like a system.

The core IA decision is in §3 (zone map). Everything else is execution. If you only approve one section, approve that one — it's the lever.

— Sally
