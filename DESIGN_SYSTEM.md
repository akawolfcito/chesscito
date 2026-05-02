# Chesscito Design System Reference

Quick-reference for anyone (human or AI) building UI in this project.
Violating these patterns will be caught in periodic UX audits.

---

## 1. Color Tokens

### Rule: No hardcoded Tailwind color classes for semantic purposes

Use CSS variables from `globals.css` when available. When not, use the **approved Tailwind palettes** below consistently.

| Semantic Purpose | Approved Pattern | Anti-pattern |
|---|---|---|
| Error / destructive | `rose-*` (`text-rose-400`, `bg-rose-500/20`) | `red-*` (different hue) |
| Success / positive | `emerald-*` | `green-*` |
| Warning / gold accent | `amber-*` | `yellow-*`, `orange-*` |
| Brand accent / CTA | `cyan-*`, `teal-*` | random blues |
| Neutral text (dark UI) | `slate-*`, `white/*` | `gray-*`, `neutral-*` |

### Frosted Panel Token (dark UI)

Used across Arena, Victory, Difficulty Selector, Trophies:

```
bg-[#0a1424]/92 backdrop-blur-2xl border border-white/[0.08]
```

> TODO: Extract to CSS variable `--surface-frosted` to avoid 9+ repetitions.

### Overlay Scrim

Standardize on: `bg-black/70` for fullscreen overlays.

---

## 2. Typography

| Level | Pattern |
|---|---|
| Hero title | `fantasy-title text-3xl font-bold` |
| Page title | `fantasy-title text-xl font-bold` |
| Section header | `text-xs font-semibold uppercase tracking-widest` |
| Body | `text-sm` |
| Caption / label | `text-xs` |
| Micro label | `text-nano font-bold uppercase` |

**Rule:** No arbitrary `text-[Xpx]` values. Use the scale above. If a new size is genuinely needed, add it as a named token in `tailwind.config.js` first.

---

## 3. Components

### Buttons

A `<Button>` component exists at `components/ui/button.tsx` with CVA variants.
**Use it** for all new buttons. Raw `<button>` is only acceptable for:
- Board cells (`playhub-board-cell`, `arena-board-cell`)
- Custom game UI where CVA variants don't fit

### Border Radius

| Element | Radius |
|---|---|
| Full-panel cards / sheets | `rounded-3xl` |
| Inner cards / containers | `rounded-2xl` |
| Buttons (primary CTA) | `rounded-2xl` |
| Buttons (secondary) | `rounded-xl` |
| Small elements / chips | `rounded-full` or `rounded-lg` |

### Disabled State

Standardize on: `disabled:opacity-50`

---

## 4. Touch Targets

**Minimum 44px** on all interactive elements (buttons, links, icons).
Use `min-h-[44px]` when the natural size is smaller.

---

## 5. Layout

- **App max-width**: `max-w-[var(--app-max-width)]` (390px) on all page containers
- **Full-height**: `min-h-[100dvh]` (never `min-h-screen`)
- **Safe area**: Account for `env(safe-area-inset-bottom)` on screens without AppShell

---

## 6. Copy / Text

- **All user-facing strings** go in `lib/content/editorial.ts`
- Never inline English strings in components — import from editorial constants
- UI language: **English**
- Error messages must be user-friendly, never technical (`chainId`, contract addresses, etc.)

### Key editorial modules:
- `ARENA_COPY` — arena screen
- `VICTORY_PAGE_COPY` — shared victory page
- `VICTORY_CLAIM_COPY` — mint flow
- `DIFFICULTY_LABELS` — difficulty number-to-label mapping
- `CHAIN_NAMES` — chainId-to-name mapping
- `PURCHASE_FIELD_LABELS` — purchase confirm field labels

---

## 7. Navigation

Secondary screens should use a consistent back-navigation pattern.
Current standard: `<AppShell>` wrapper with `cta` prop for back button.

---

## 8. Surface Hierarchy — Game UX Pattern

Chesscito is a **mobile game**, not a web app. Surface decisions must follow the game pattern (Clash Royale / Brawl Stars / Pokémon Unite / Candy Crush), NOT the SaaS/web-app pattern. This section is **prescriptive, not suggestive** — follow the rules mechanically.

### Hard Rule: the persistent dock is always visible

The `.chesscito-dock` sits at `z-index: 60`, above every Radix Sheet scrim (`z-50`). Any new surface MUST NOT cover it unless it matches the **System Modal** exception below.

Explicit exceptions (dock may disappear):
- `/arena` during an active match (immersion)
- `/victory/[id]` celebration screen (focus ceremony)
- Splash + Mission Briefing on first visit (onboarding)
- System Modals (see taxonomy)

If you're adding a new surface and you're NOT in this list, the dock stays.

### Surface taxonomy — pick ONE of 4

Every new UI surface falls into exactly one of these. No in-between.

| Type | Triggered by | Height | Dock visible? | Scrim | Examples |
|---|---|---|---|---|---|
| **A. Full page** | Route change (`<Link>`) | 100dvh | Depends on route | None | `/arena`, `/trophies`, `/about` |
| **B. Destination sheet** | Dock tap | `h-[100dvh]` bottom-anchored | **Yes** (z-60 floats on top) | Radix scrim z-50 | Badge, Shop, Leaderboard, Coach Paywall |
| **C. Quick picker** | Inline action | `auto` bottom-anchored | **Yes** | Radix scrim z-50 | Piece picker, Mission detail, Exercise drawer, Purchase confirm |
| **D. System modal** | Blocks user until resolved | 100dvh or centered | **No** | Opaque scrim | Promotion overlay, Coach welcome, Victory claim flow |

Implementation requirements per type (no "creer" — follow these literally):

**B. Destination sheet** (`h-[100dvh]` + `rounded-none`):
```tsx
<SheetContent side="bottom" className="flex h-[100dvh] flex-col rounded-none pb-[5rem]">
  <div className="... rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
    {/* header */}
  </div>
  {/* body */}
</SheetContent>
```
- `h-[100dvh]` — full-viewport destination, Clash-Royale style. Every tap on a dock item lands on a dedicated screen, not a sliver modal.
- `rounded-none` — square corners because there's nothing above the sheet to round against.
- `pb-[5rem]` on the wrapper so body content clears the persistent dock's ~72px overlap at the bottom (dock floats on top at z-60).
- Header uses `pt-[calc(env(safe-area-inset-top)+1.25rem)]` so titles clear the notch on iOS.

**C. Quick picker** (auto height, bottom-anchored):
```tsx
<SheetContent side="bottom" className="rounded-t-3xl pb-[5rem]">
  {/* short content — auto height */}
</SheetContent>
```
- No explicit height; short content means the sheet naturally ends above the dock area.
- `pb-[5rem]` IS needed so the bottom row of content clears the persistent dock (z-60 sits on top of the sheet at the viewport bottom). Without it, the bottom ~72px of picker content disappear under the dock.
- Controlled `open` / `onOpenChange` props passed from the parent. Auto-close pickers when a dock destination sheet opens (effect on `isDockSheetOpen` — see `components/play-hub/mission-panel-candy.tsx`).
- Always include a `<SheetDescription>` — Radix Dialog in v1.0+ logs a console warning without one. Use `className="sr-only"` if the description would be visually redundant with the title.

**When to re-evaluate Type C → Type B** (promote to Destination)

Keep the surface as Quick picker (C) unless ALL of the following are true — then promote to Destination (B):

- Content grows past ~6 items or needs subcategories/filters
- User typically spends >3s on the surface (reading, comparing, tracking progress)
- Losing board context would improve focus rather than hurt it

Examples where we'd promote if requirements changed:
- `ExerciseDrawer` (5 items today) → if it gains per-exercise history, star-delta analytics, or subcategory tabs, promote to B.
- `MissionDetail` (single mission today) → if it adds a mission log, difficulty breakdown, or timed leaderboard per mission, promote to B.
- `PiecePicker` (6 pieces today) → if each piece gets a comparison card (stats, unlocked exercises, best-time-per-piece), promote to B.

Don't promote speculatively. The sheet stays C until the three conditions above are met.

**D. System modal** (explicit full-screen with dock hidden):
- Uses fixed-position portal, NOT `<Sheet>`.
- Explicitly opaque scrim (`bg-[var(--overlay-scrim)]`) to signal "everything else is paused".
- If it overlaps the dock visually, that's by design — it's telling the user the dock is inert until resolved.

### Decision tree for a new surface

Answer these three questions in order. First "yes" wins.

1. **Does the user need to resolve this before ANY other interaction (including nav)?**
   → System Modal (D)
   Examples: picking a promotion piece, confirming a signature, loading a multi-step claim.

2. **Is this a destination the user navigates TO from the dock?**
   → Destination Sheet (B)
   Examples: browsing badges, shopping, viewing leaderboard.

3. **Is this a short inline input or detail view that doesn't change what the user is doing?**
   → Quick Picker (C)
   Examples: choosing a piece for the next exercise, seeing an exercise description.

Otherwise → Full Page (A) and add a back-navigation pattern.

### Anti-patterns — always wrong

| Anti-pattern | Why it's wrong | Correct move |
|---|---|---|
| Destination sheet without persistent dock on top | Web-app pattern. Player loses dock context, feels like a different app. | `h-[100dvh]` is fine AS LONG AS the dock keeps z-60 + pointer-events-auto so it floats on top |
| Quick picker at `h-[100dvh]` | Turns a 2-tap action into a modal "visit". | `auto` height (Type C) |
| Full-screen modal with dock visible | Implies user can nav away, but the flow blocks them. Confusing. | Either allow real nav (make it B) or explicitly hide the dock (D) |
| Radix overlay raised above `z-60` | Covers the dock, breaks the persistent-dock rule. | Leave scrim at `z-50`, that's the invariant |
| New CSS `position: fixed + z-index > 60` | Same as above — will leapfrog the dock. | Nothing should beat the dock except explicit system modals |

### PR checklist for any surface change

Before merging, answer yes to all five:

- [ ] Can I name the surface type (A/B/C/D) in one word?
- [ ] Does the z-index fit the ladder at top of `globals.css` (0, 1, 10, 11, 12, 30, 40, 50, 60)?
- [ ] Is the dock still visible (or explicitly hidden via System Modal pattern)?
- [ ] Does it pass `pnpm test:e2e` (especially `home-loads` and `secondary-pages`)?
- [ ] Does it match the Destination Sheet / Quick Picker template literally (if that type)?

If any answer is "no" or "I'm not sure" → the surface is wrong; don't ship.

---

## 9. When to Run UX Audit

Run `ux-review` skill:
- After completing a feature that adds or modifies screens
- Before a release milestone
- Every ~2 weeks during active development

The audit report goes to `docs/reviews/ux-review-{date}.md`.

---

## 10. Chesscito UI Operating System

This section is **prescriptive, not suggestive**. New features, refactors, and PRs MUST fit the system below. If the system doesn't fit the work, the work is wrong, not the system. Update §10 only with explicit revision approval.

Adopted: 2026-05-01. Source artifacts:

- Systems audit: [`docs/reviews/ui-systems-audit-2026-05-01.md`](docs/reviews/ui-systems-audit-2026-05-01.md) — full diagnosis, severity list, zone map proposal.
- Functional audit: [`docs/reviews/ui-floating-actions-functional-audit-2026-05-01.md`](docs/reviews/ui-floating-actions-functional-audit-2026-05-01.md) — every floating button traced to its component + handler.
- Zone-map decision record: [`docs/reviews/ui-zone-map-decision-record-2026-05-01.md`](docs/reviews/ui-zone-map-decision-record-2026-05-01.md) — what gets moved, what gets reclassified, commit order.
- Z-index ladder: comment block at the top of `apps/web/src/app/globals.css`.

### 10.1 Zone map (canonical layout, 390px mobile)

Every UI element on every screen lives in exactly one of these zones, or in a defined overlay type.

| Zone | Name | Height | Always visible? | Purpose |
|---|---|---|---|---|
| **Z1** | Global Status Bar | 32–40px | Yes | Player identity (handle, level, streak, PRO state as passive ring). Read-only. |
| **Z2** | Contextual Header | 52–64px | Per-screen | Screen title + ONE contextual control. Mode tabs (max 4) live here. |
| **Z3** | Content / Board | flex-1 | Per-screen | The gameplay surface. Dominant. Nothing competes. |
| **Z4** | Contextual Action Rail | 56px | Per-screen | ONE primary CTA + optional ONE secondary. Collapses to 0 when empty. |
| **Z5** | Dock | 72px (z-60) | INVARIANT | 5 destinations, fixed forever. Defended by §8. |
| Overlays | Type A/B/C/D | varies | Orthogonal | A=full page, B=destination sheet, C=quick picker, D=system modal. See §8. |

### 10.2 The 12 invariants

Every PR that adds or modifies UI must pass these. Code review enforces. No exceptions outside an explicit revision of §10.

1. **One primary CTA per screen.** If a screen has two primaries, one is wrong. Demote, route, or delete.
2. **No floating action without ownership.** Every interactive element belongs to a named zone (Z1–Z5) or a defined overlay type (A/B/C/D). If you can't name the zone, the element doesn't ship.
3. **No duplicated destinations.** A persistent destination has exactly one entry point in persistent navigation. Contextual shortcuts (per-screen links) are fine because they're not persistent.
4. **Monetization never lives in Z1 or Z3.** Z1 is identity. Z3 is gameplay. Monetization lives in Z4 (contextual offer), inside a destination sheet (Shop, PRO sub-section), or as a passive state indicator on an existing element.
5. **Every feature category needs a reserved slot before launch.** New feature → which zone owns it? If the answer is "we'll figure it out," it's not ready to ship.
6. **The dock is sacred.** 5 items, z-60, no exceptions outside the documented exception list (`/arena` match, `/victory`, splash, system modals — see §8).
7. **Surfaces follow the A/B/C/D taxonomy literally.** Any new surface is exactly one of Type A (full page), B (destination sheet), C (quick picker), or D (system modal). The PR checklist in §8 is enforced.
8. **First-visit / onboarding overlays defer to open sheets.** Briefing modals (Type D) check `anySheetOpen` before mounting. The play-hub guard at `play-hub-root.tsx` is the canonical pattern: `showBriefing && activeDockTab === null && !proSheetOpen`.
9. **PRO benefits show up as state inside existing zones**, not as separate chips. Gold ring on existing element, gold tint, "no ads" by absence — never a banner that fights for attention.
10. **Z-index ladder is documented at the top of `globals.css`.** New rules must fit the ladder. Never use `z-index > 60` outside system modals. Never `z-index: 999` "just in case."
11. **Contextual-action slot collapses to 0px when empty.** No reserved vertical air for a CTA that isn't there. The component returns `null` rather than a placeholder div.
12. **`editorial.ts` is the only place copy lives.** Including aria-labels, button labels, microcopy, error messages. No inline English strings in components — import from editorial constants. Compact / long variants live as separate fields on the same constant (e.g., `FOOTER_CTA_COPY[action].label` vs `.compactLabel`).

### 10.3 Cross-references

- Surface taxonomy + dock invariant: §8 above.
- Z-index ladder + anti-patterns: top of `apps/web/src/app/globals.css`.
- 6-zone analysis with ownership rules per zone: `ui-systems-audit-2026-05-01.md` §3 and §4.
- Element-by-element classification (with code paths and handlers): `ui-floating-actions-functional-audit-2026-05-01.md`.
- Decision history + commit log: `ui-zone-map-decision-record-2026-05-01.md`.
- Regression spec locking the trophy-floating ≠ dock-trophies contract: `apps/web/e2e/floating-actions-vs-dock.spec.ts`.

### 10.4 Lesson captured for the future

> **Visual audits read screens; functional audits read source.**
>
> Before deleting any UI element, verify what it actually does. The original visual audit tagged three "floating buttons" for deletion based on screenshots; functional audit (source recon) revealed all three were first-class engagement features:
>
> - Trophy floating button → `MiniArenaBridgeSlot` (K+R vs K mastery challenge, gated unlock).
> - "Whistle" → `DailyTacticSlot` (daily puzzle + streak mechanic).
> - "Blue star" → `submitScore` action of `ContextualActionSlot` (critical on-chain CTA).
>
> Each was preserved by reading the wiring in `play-hub-root.tsx` before touching code. The Playwright spec at `apps/web/e2e/floating-actions-vs-dock.spec.ts` codifies this lesson — any future PR that conflates these elements with their visual look-alikes (dock Trophies, hint button, decorative star) will fail CI.
>
> When in doubt: `git grep` the testid, read the click handler, then decide.

### 10.5 Z2 primitive — `<ContextualHeader />`

Adopted: 2026-05-01. Canary consumer: `apps/web/src/components/play-hub/mission-panel-candy.tsx` (Phase 2 commit #2). Source code: `apps/web/src/components/ui/contextual-header.tsx`.

**`<ContextualHeader />` is the canonical Z2 component. Any new screen that needs a context strip uses this primitive — no inline `<header>` or ad-hoc `<div className="...header...">` patterns are accepted in code review.**

#### Variants (4, capped)

| Variant | Use case | Required slots | Optional slots |
|---|---|---|---|
| `title` | Static screen title (e.g. `/about`, `/privacy`). | `title` | `ariaLabel` |
| `title-control` | Most common. Title + optional subtitle + ONE trailing trigger button. | `title`, `trailingControl` | `subtitle`, `ariaLabel` |
| `mode-tabs` | Segmented filter, max 4 options. | `modeTabs` | `ariaLabel` |
| `back-control` | Type-A overlays / deep nav. Back button + title + optional trailing trigger. | `title`, `back` | `trailingControl`, `ariaLabel` |

**A 5th variant requires a written justification in the spec PR + sign-off from the design-system owner.** If 3+ screens want "almost variant X but slightly different," the missing primitive lives somewhere else (e.g. `<SheetHeader />`), not in Z2.

#### Type-safety contracts (enforced at compile time)

- Props are a **discriminated union** per variant. `back={...}` on `variant="title"` is a TS error. `modeTabs={...}` on `variant="title-control"` is a TS error. `back + modeTabs` together is impossible by construction.
- `trailingControl` is `ReactElement`, **not** `ReactNode`. Arrays, iterables, `null`, and `undefined` are TS errors. (Multi-child fragments compile but trigger a dev-mode runtime warning — see §10.5 below.)
- `modeTabs.options` is a tuple capped at 4: `readonly [TabOption, TabOption?, TabOption?, TabOption?]`. A 5th positional entry is a TS error.

#### Runtime guards (dev-mode only, no production cost)

All wrapped in `process.env.NODE_ENV !== "production"`:

- `title.length > 22` → `console.warn` (truncation engages).
- `subtitle.length > 32` → warn.
- `TabOption.label.length > 16` → warn.
- Duplicate `TabOption.key` → warn (last-wins).
- `back.label.length > 16` → warn.
- Trigger DOM width > 44px (measured via `getBoundingClientRect`) → warn.
- Multi-child fragment in `trailingControl` (`React.Children.count > 1`) → warn.

#### What `<ContextualHeader />` does NOT do

- No `className` escape hatch. Surface tweaks must go through typed props in a future spec.
- No `position: sticky`. v1 only supports `sticky="scroll"` (header scrolls with the page). Sticky support requires a shell refactor that is out of scope.
- No mid-screen mount/unmount. The primitive reserves its full height for the lifetime of the screen render. Loading state uses skeleton chips, not collapse.
- No nested headers. A screen has at most one Z2 strip. Sheet headers are a separate primitive (future spec).
- No primary CTAs, no monetization, no live timers, no streak counters in Z2. Those live in Z1 / Z3 / Z4 per §10.2.

#### Mandatory contract for callers

- Wrap the primitive in a `<div>` that gives it horizontal context (margins, optional reserve for absolutely-positioned siblings like the legacy "Get PRO" chip).
- Lift trigger open/close state to the parent. Render `Type-C` quick-pickers as **siblings** of `<ContextualHeader>`, not inside `trailingControl`. The trailing slot accepts only the trigger button.
- Use the `data-component="contextual-header"` selector in E2E tests (the component sets it on every variant).

#### Cross-references

- Spec (full contract, all 14 sections): [`docs/specs/ui/contextual-header-spec-2026-05-01.md`](docs/specs/ui/contextual-header-spec-2026-05-01.md).
- Red-team review of the spec: [`docs/reviews/contextual-header-spec-red-team-2026-05-01.md`](docs/reviews/contextual-header-spec-red-team-2026-05-01.md).
- Re-review verifying P0 closure: [`docs/reviews/contextual-header-spec-red-team-followup-2026-05-01.md`](docs/reviews/contextual-header-spec-red-team-followup-2026-05-01.md).
- Implementation review (commit `fda38a0`): [`docs/reviews/contextual-header-implementation-review-2026-05-01.md`](docs/reviews/contextual-header-implementation-review-2026-05-01.md).
- Canary E2E spec locking the contract: `apps/web/e2e/contextual-header.spec.ts`.
- Unit tests: `apps/web/src/components/ui/__tests__/contextual-header.test.tsx`.

### 10.6 Phase 2 carry-forward

These items are **explicitly deferred**, not forgotten. Each one ships in a future PR; this section makes them visible so they don't decay into "we'll get to it" debt.

| Item | Source | Trigger to ship |
|---|---|---|
| **`mode-tabs` keyboard navigation** — roving `tabIndex`, ←/→ arrow keys, Home/End. | Implementation review §3.2 P1-IMPL-1 | First real `mode-tabs` consumer (Trophies recents/all/locked filter is the leading candidate). Bundle into the same PR. |
| **`mode-tabs` semantic wrapper** — move `role="tablist"` from `<header>` to an inner `<div role="tablist">` so the wrapper keeps its implicit `banner` role. | Implementation review §3.2 P1-IMPL-2 | Same PR as above. |
| **Focus management for variant transitions** — restore focus when a screen swaps `<ContextualHeader>` variants mid-flow. | Re-review §5 P1-5 | When the first screen actually swaps variants mid-flow. No v1 consumer does this. |
| **CI lint anti-misuse** — ESLint rule (or grep CI check) that flags raw `<header>` or `<div className="...header...">` patterns inside `apps/web/src/app/**/page.tsx`. | Re-review §5 P2-6 / spec §11 risks | Bundle with the next system-level lint commit. Process discipline until then. |
| **Z1 + Z2 combined budget** — codify "Z1 ≤ 40px and Z2 ≤ 64px; combined ≤ 104px" as a hard constraint in §10.1. | Re-review §5 P2-10 | Ships with `<GlobalStatusBar />` spec (Phase 2 follow-on). |
| **`MissionDetailSheet` migration** — fold into the piece-picker sheet as a sub-tab so the canary's transitional sibling row disappears. | Spec §8 + canary commit `24ac2ef` TODO | Follow-on PR. Resolves the duplicate "objective text" visible during the canary. |
| **PRO chip migration** — move the absolute z-30 "Get PRO" chip into `<GlobalStatusBar />` (Z1) so the Z2 wrapper's `mr-[140px]` reservation in `mission-panel-candy.tsx` can drop. | Canary commit `24ac2ef` inline TODO | Ships with `<GlobalStatusBar />` (Phase 2 follow-on). |
| **`<ContextualActionRail />` (Z4 primitive)** + **`<GlobalStatusBar />` (Z1 primitive)** — the other two zone primitives the spec refers to. | UI zone-map decision record §5 | Each one needs its own spec → red-team → TDD cycle. Out of scope for the Z2 PR series. |
| **Migration of remaining screens** to `<ContextualHeader>` — `/arena`, `/missions`, `/badges` sheet, secondary pages. | Spec §10 acceptance | One PR per screen after the canary lands. Never as a bulk drop-in.
