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
- Controlled `open` / `onOpenChange` props passed from the parent. Auto-close pickers when a dock destination sheet opens (effect on `isDockSheetOpen` — see `components/exercises/mission-panel-candy.tsx`).
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

### 9.1 Visual regression baselines

Two suites separated by intent:

| Script | File | Purpose |
|---|---|---|
| `pnpm test:e2e:visual` | `apps/web/e2e/visual-regression.spec.ts` | **CI-gated.** `expect(page).toHaveScreenshot()` against committed baselines under the spec's `-snapshots/` directory. Fails the test on diff above the per-test threshold. Pinned to `--project=minipay` (390×844) — Chesscito is mobile-first per CLAUDE.md; desktop is not a regression target. |
| `pnpm test:e2e:visual-capture` | `apps/web/e2e/visual-capture.spec.ts` | **Artifact only.** Writes raw PNGs to `e2e-results/snapshots/` for manual PR review. Always passes; never gates CI. |

**Baseline update discipline (hard rule):**

- Baselines change only via `pnpm test:e2e:visual --update-snapshots` AND the PR body MUST include a "visual change rationale" sentence explaining what changed and why.
- PRs that bump baselines without a rationale are **rejected at review.**
- CI never re-baselines automatically. Silent re-baselining is regression-laundering.
- The capture-only suite is for inspecting screenshots manually; its output is never the source of truth for visuals.

Step 1 coverage (this commit): 3 deterministic states — `hub-clean`, `hub-daily-tactic-open` (clock-frozen so the puzzle of the day is stable), `hub-shop-sheet-open`. Expansion to per-screen migration coverage tracked in [`docs/reviews/visual-regression-plan-2026-05-02.md`](docs/reviews/visual-regression-plan-2026-05-02.md).

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
| **Z1** | Global Status Bar | 32–40px content (excl. safe-area-top) | Target invariant — every primary screen; v1 canary on `/exercises` only | Player identity (handle, wallet, PRO state as passive ring). Read-only. See §10.7. |
| **Z2** | Contextual Header | 52–64px content | Per-screen | Screen title + ONE contextual control. Mode tabs (max 4) live here. |
| **Z3** | Content / Board | flex-1 | Per-screen | The gameplay surface. Dominant. Nothing competes. |
| **Z4** | Contextual Action Rail | 56px | Per-screen | ONE primary CTA + optional ONE secondary. Collapses to 0 when empty. |
| **Z5** | Dock | 72px content (excl. safe-area-bottom, z-60) | INVARIANT | 5 destinations, fixed forever. Defended by §8. |
| Overlays | Type A/B/C/D | varies | Orthogonal | A=full page, B=destination sheet, C=quick picker, D=system modal. See §8. |

**Combined Z1 + Z2 content-height invariant**: **Z1 ≤ 40px content + Z2 ≤ 64px content; combined ≤ 104px content.** Layout cost (content + `env(safe-area-inset-top)` + `env(safe-area-inset-bottom)`) is device-specific and not part of the invariant. The invariant is enforced by E2E assertion in `apps/web/e2e/global-status-bar.spec.ts` (`clientHeight − paddingTop − paddingBottom` per strip). Per `docs/specs/ui/global-status-bar-spec-2026-05-02.md` §11 #11 + §13.

### 10.2 The 12 invariants

Every PR that adds or modifies UI must pass these. Code review enforces. No exceptions outside an explicit revision of §10.

1. **One primary CTA per screen.** If a screen has two primaries, one is wrong. Demote, route, or delete.
2. **No floating action without ownership.** Every interactive element belongs to a named zone (Z1–Z5) or a defined overlay type (A/B/C/D). If you can't name the zone, the element doesn't ship.
3. **No duplicated destinations.** A persistent destination has exactly one entry point in persistent navigation. Contextual shortcuts (per-screen links) are fine because they're not persistent.
4. **Monetization never lives in Z1 or Z3.** Z1 is identity. Z3 is gameplay. Monetization lives in Z4 (contextual offer), inside a destination sheet (Shop, PRO sub-section), or as a passive state indicator on an existing element.
5. **Every feature category needs a reserved slot before launch.** New feature → which zone owns it? If the answer is "we'll figure it out," it's not ready to ship.
6. **The dock is sacred.** 5 items, z-60, no exceptions outside the documented exception list (`/arena` match, `/victory`, splash, system modals — see §8).
7. **Surfaces follow the A/B/C/D taxonomy literally.** Any new surface is exactly one of Type A (full page), B (destination sheet), C (quick picker), or D (system modal). The PR checklist in §8 is enforced.
8. **First-visit / onboarding overlays defer to open sheets.** Briefing modals (Type D) check `anySheetOpen` before mounting. The exercises guard at `exercises-screen.tsx` is the canonical pattern: `showBriefing && activeDockTab === null && !proSheetOpen`.
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
> Each was preserved by reading the wiring in `exercises-screen.tsx` before touching code. The Playwright spec at `apps/web/e2e/floating-actions-vs-dock.spec.ts` codifies this lesson — any future PR that conflates these elements with their visual look-alikes (dock Trophies, hint button, decorative star) will fail CI.
>
> When in doubt: `git grep` the testid, read the click handler, then decide.

### 10.5 Z2 primitive — `<ContextualHeader />`

Adopted: 2026-05-01. Canary consumer: `apps/web/src/components/exercises/mission-panel-candy.tsx` (Phase 2 commit #2). Source code: `apps/web/src/components/ui/contextual-header.tsx`.

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
| ~~**Z1 + Z2 combined budget**~~ — ✅ **CLOSED 2026-05-02** with `<GlobalStatusBar />` spec; codified at §10.1 (Z1 ≤ 40px content + Z2 ≤ 64px content, combined ≤ 104px content). |
| **`MissionDetailSheet` migration** — fold into the piece-picker sheet as a sub-tab so the canary's transitional sibling row disappears. | Spec §8 + canary commit `24ac2ef` TODO | Follow-on PR. Resolves the duplicate "objective text" visible during the canary. |
| **PRO chip migration** — move the absolute z-30 "Get PRO" chip into `<GlobalStatusBar />` (Z1) so the Z2 wrapper's `mr-[140px]` reservation in `mission-panel-candy.tsx` can drop. | Canary commit `24ac2ef` inline TODO | Ships with `<GlobalStatusBar />` (Phase 2 follow-on). |
| **`<ContextualActionRail />` (Z4 primitive)** + **`<GlobalStatusBar />` (Z1 primitive)** — the other two zone primitives the spec refers to. | UI zone-map decision record §5 | Each one needs its own spec → red-team → TDD cycle. Out of scope for the Z2 PR series. |
| **Migration of remaining screens** to `<ContextualHeader>` — `/arena`, `/missions`, `/badges` sheet, secondary pages. | Spec §10 acceptance | One PR per screen after the canary lands. Never as a bulk drop-in.

### 10.7 Z1 primitive — `<GlobalStatusBar />`

Adopted: 2026-05-02. Source code: `apps/web/src/components/ui/global-status-bar.tsx`. Canary consumer: queued for Phase 2 commit #2 (`/exercises`); v1 ships the primitive only.

**`<GlobalStatusBar />` is the canonical Z1 component. Any new screen that needs a persistent identity strip uses this primitive — no inline `<header>` patterns or absolute-positioned chips are accepted in code review.**

#### Variants (2, capped per the §5 growth rule)

| Variant | Use case | Required slots | Optional slots |
|---|---|---|---|
| `anonymous` | No wallet connected. | — | `ariaLabel` |
| `connected` | Wallet present. | `identity.walletShort`, `proStatus`, `isProLoading`, `onProTap` | `identity.handle`, `identity.avatarUrl`, `ariaLabel` |

**A 3rd variant requires a written justification + design-system owner sign-off.** Per the spec's growth rule, future data slots (level, streak, currency, achievements) land as **typed props on `ConnectedProps`**, not as new variants. Variants are reserved for structural layout differences, not data-source differences.

#### Type-safety contracts (compile-time enforced for inline-literal callers)

- Props are a **discriminated union** per variant. `proStatus` / `isProLoading` / `onProTap` / `identity` on `variant: "anonymous"` are TS errors when supplied as inline-object literals.
- Missing `identity.walletShort` on `variant: "connected"` is a TS error.
- No `className` escape hatch — surface tweaks must propose a typed prop in a future amendment.

**TypeScript does NOT block discriminated-union escapes via spread props.** A caller that builds the object first and spreads it bypasses excess-property checks. The spec does not claim type-system sufficiency; the runtime guard below catches the escape.

#### Runtime guards (dev-mode only, no production cost)

All wrapped in `process.env.NODE_ENV !== "production"`:

- **Spread-prop escape** — `variant: "anonymous"` arriving with `identity` / `proStatus` / `isProLoading` / `onProTap` keys → warn + drop the keys.
- `identity.handle.length > 14` → warn + ellipsis past cap.
- `identity.walletShort` does not match `/^0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}$/` → warn (use `formatWalletShort`).
- `proStatus.active && proStatus.expiresAt < Date.now()` → warn (stale status).
- `dir="ltr"` is forced on the wrapper (RTL deferred per §17 of the spec).

#### What `<GlobalStatusBar />` does NOT do

- No PRO fetch (caller passes `proStatus` from `useProStatus`).
- No router calls / nav.
- No animations on variant flip (anonymous ↔ connected).
- No mid-screen mount/unmount.
- No nested status bars; Type-B destination sheets do **NOT** render Z1 inside themselves (per spec §2). Identity persistence inside sheets is out of scope for v1.
- No primary CTAs, no monetization promos, no live timers, no streak counters in Z1. Per §10.2 invariant 4.

#### Mandatory contract for callers

- Mount as the first child of `<main>` (or equivalent screen root). Render in normal flow — no `absolute` positioning.
- Pass `proStatus` / `isProLoading` from a single shared `useProStatus(address)` invocation. Process-only mitigation in v1; CI grep promotion (`scripts/check-pro-fetch.sh`) when the second screen migrates (per spec §12 risk row #3).
- On wallet disconnect mid-session, the parent must **synchronously close any open `<ProSheet>`** before/while flipping `variant` from `connected` to `anonymous` (per spec §8 row 6 + dev warning in §6).
- Use the `data-component="global-status-bar"` selector in E2E tests; `data-variant` distinguishes states; `data-pro-state="active|inactive"` marks the PRO indicator.

#### Transitional debt (with hard 4-layer enforcement)

`onProTap` exists in `ConnectedProps` only because Shop has no PRO sub-section yet. Per the spec's §6.1 row 1:

- **Owner**: Wolfcito.
- **Due date**: 60 days from canary deploy date OR Shop PRO sub-section ships, whichever first.
- **Greppable trailer**: canary commit message includes `pro-tap-debt-due-by: <YYYY-MM-DD>`.
- **Calendar reminder**: created on canary-deploy day in the project tracker.
- **Day-61 hard-close**: `onProTap` is removed automatically + inactive PRO pill is removed; Z1 becomes strictly passive. Re-approval requires an Amendment-log entry signed by Wolfcito — not Slack escalation.

This is **not** a soft deadline.

#### Cross-references

- Full spec: [`docs/specs/ui/global-status-bar-spec-2026-05-02.md`](docs/specs/ui/global-status-bar-spec-2026-05-02.md).
- Red-team review: [`docs/reviews/global-status-bar-spec-red-team-2026-05-02.md`](docs/reviews/global-status-bar-spec-red-team-2026-05-02.md).
- Re-review verifying P0 closure: [`docs/reviews/global-status-bar-spec-red-team-followup-2026-05-02.md`](docs/reviews/global-status-bar-spec-red-team-followup-2026-05-02.md).
- Premium-state gold token (`--pro-ring-gold: #FDD257`): top of `globals.css` redesign palette block.
- Wallet truncation helper: `apps/web/src/lib/wallet/format.ts` (`formatWalletShort`, `isWalletShortShape`).
- Editorial copy: `GLOBAL_STATUS_BAR_COPY` in `apps/web/src/lib/content/editorial.ts`.
- Unit tests: `apps/web/src/components/ui/__tests__/global-status-bar.test.tsx` + `apps/web/src/lib/wallet/__tests__/format.test.ts`.

### 10.8 Phase 2 carry-forward (Z1)

| Item | Source | Trigger to ship |
|---|---|---|
| **Canary integration on `/exercises`** — mount Z1, drop `mr-[140px]` from Z2 wrapper, remove the absolute `<ProChip>` wrapper. | Spec §10 + §15 commit #2 | Phase 2 commit #2 of the Z1 series. |
| **Per-screen migration** — `/arena`, `/trophies`, `/leaderboard`, secondary pages. | Spec §6.1 row 2 | One commit per screen after the canary lands. |
| **`onProTap` removal + strict-passive Z1** | Spec §6.1 row 1 (4-layer enforcement) | Shop PRO sub-section ships OR canary-deploy + 60 days, whichever first. |
| **`<ProChip>` legacy file deletion** | Spec §6.1 row 3 + §15 commit #3 | 7 days post-canary minimum to preserve revert window. |
| **A11y carry-forward** — keyboard nav, focus-visible, screen-reader wallet pronunciation, RTL support, beyond-PRO-tap interactions. | Spec §17 | Triggers per §17 table (first interactive typed prop, first a11y QA pass, RTL i18n project). |
| **`useProStatus` single-source CI promotion** — `scripts/check-pro-fetch.sh` blocking PRs that bypass the hook. | Spec §12 risk row #3 | When the second screen (after `/exercises`) migrates. |
| **Future typed props on `ConnectedProps`** — level, streak, currency, achievements (each behind its own product spec). | Spec §3 + §5 growth rule | Per typed prop: product spec defines the data system → spec amendment adds the prop. |

---

## 11. Game Home Redesign Tokens (2026-05-04, Story 1.1)

Foundation tokens for the Game Home redesign. Live in `globals.css`. Spec: `docs/product/visual-language-minimum-2026-05-03.md` §3.3.b. UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md` Step 8.

### 11.1 Adventure atmosphere palette

Derived from `art/redesign/` assets (Wolfcito-cat-wizard + kingdom hero). Distinct from the `--redesign-*` candy-game palette (different visual register).

| Token | Value | Use |
|---|---|---|
| `--adv-deep-blue` | `#1f2c4a` | Adventure primary background |
| `--adv-blue-highlight` | `#3a5a9c` | Adventure surface highlights |
| `--adv-forest-emerald` | `#2d6b3f` | Adventure secondary surfaces |
| `--adv-gold-warm` | `#e6b34d` | Shared gold accent (compatible with `--gold-leaf-base`) |
| `--adv-purple-accent` | `#7c4dad` | Adventure piece tint (Arena black piece) |
| `--adv-stone` | `#5a677d` | Adventure stone-wall texture (from `menu-wall.png`) |

### 11.2 Frame-craft layer

Borders, glows, and elevation for the Adventure atmosphere primitives. Used by `<KingdomAnchor>`, `<HudResourceChip>`, `<MissionRibbon>`, and others.

| Token | Value | Use |
|---|---|---|
| `--gold-leaf-base` | `#c9962b` | Border principal frame-craft |
| `--gold-leaf-highlight` | `#e8c160` | Highlight superior gold-leaf |
| `--gold-leaf-shadow` | `#8a6818` | Inner shadow gold-leaf |
| `--kingdom-warm-glow` | `rgba(232, 193, 96, 0.18)` | Halo bajo `<KingdomAnchor>` |
| `--kingdom-deep-shadow` | `rgba(63, 34, 8, 0.42)` | Drop shadow del world render |
| `--hud-chip-elevation` | `rgba(255, 245, 215, 0.78)` | Backplate `<HudResourceChip>` |
| `--mission-ribbon-warm` | `rgba(232, 193, 96, 0.32)` | Background `<MissionRibbon>` |

### 11.3 Motion extension

Adds piece-slide, mission-ribbon-reveal, and Wolfcito-greeting durations on top of the existing `--duration-snap / --duration-enter / --duration-ceremony / --ease-spring` vocabulary.

| Token | Value | Use |
|---|---|---|
| `--duration-piece-slide` | `320ms` | Board piece movement |
| `--duration-mission-ribbon-reveal` | `400ms` | `<MissionRibbon>` entrance |
| `--duration-coach-greeting` | `600ms` | Wolfcito greeting fade-in |
| `--ease-piece-overshoot` | `var(--ease-spring)` | Alias of `--ease-spring` for piece-slide semantic clarity |

### 11.4 Rules of use

- Adventure tokens belong to **Adventure-atmosphere surfaces** (Hub, Arena, Landing hero, Victory celebration). The PRO sheet uses the Hybrid mix — Adventure shell + Scholarly mission ribbon — and is the only canonized hybrid surface.
- Scholarly surfaces (`/about`, methodology, legal, settings) continue to use existing warm-paper tokens (`--paper-text-*`, `paper-tray`, etc.).
- Mixing palettes within a single surface (other than the canonized PRO sheet) violates `visual-language-minimum-2026-05-03.md` §7 anti-patterns 11–12.
- Motion extensions complement, never replace, the original 4-token vocabulary.

### 11.5 Cross-references

- Tokens live: `apps/web/src/app/globals.css` lines 199–203 (motion extension) + lines 218–233 (Adventure palette + frame-craft).
- Spec: `docs/product/visual-language-minimum-2026-05-03.md` §3.3.b.
- UX foundation: `_bmad-output/planning-artifacts/ux-design-specification.md` Step 8 §"Color System" + §"Motion & Sensory Foundation".
- Story: `_bmad-output/planning-artifacts/epics.md` Epic 1 Story 1.1.

## 12. Atmosphere Prop Pattern

Game Home redesign primitives expose an `atmosphere` prop so a single primitive can be rendered inside either the Adventure or Scholarly visual register. The Adventure register is **always the default** — opting into Scholarly is an explicit choice for `/about`, legal, settings, and the PRO sheet's mission ribbon.

### 12.1 Primitives with the prop

| Primitive | Default | Spec |
|---|---|---|
| `<KingdomAnchor>` | `"adventure"` | UX spec Step 11 §1, Story 1.3 |
| `<HudResourceChip>` | `"adventure"` | UX spec Step 11 §2, Story 1.4 |
| `<MissionRibbon>` | `"adventure"` | UX spec Step 11 §6, Story 1.8 |
| `<PrimaryPlayCta>` | `"adventure"` | UX spec Step 11 §7, Story 1.9 |
| `<FrameCraftCard>` | n/a — Scholarly-only by design | Story 3.1 (post-Phase 0.5) |

### 12.2 Type contract

```ts
export type Atmosphere = "adventure" | "scholarly";

type Props = {
  atmosphere?: Atmosphere; // default: "adventure"
  // ...other props
};
```

The component emits a single CSS modifier class on the root: `is-atmosphere-adventure` or `is-atmosphere-scholarly`. Adventure styling lives on the base `.{primitive-class}` rule; Scholarly is layered on top via `.{primitive-class}.is-atmosphere-scholarly` using the existing `--paper-bg / --paper-divider / --paper-text` tokens.

### 12.3 Per-surface defaults

| Surface | Atmosphere |
|---|---|
| `/exercises` | adventure |
| `/arena` (selecting + playing) | adventure |
| Landing hero / plans / capabilities | adventure |
| Victory celebration overlay | adventure |
| `/about` (incl. methodology) | scholarly |
| Cognitive disclaimer | scholarly |
| Settings | scholarly |
| Legal pages (privacy, terms) | scholarly |
| PRO sheet | adventure shell + scholarly mission ribbon (only canonized hybrid) |

### 12.4 Rules of use

- Always pass `atmosphere` explicitly when the surface is Scholarly. Relying on the default keeps Adventure surfaces clean.
- The PRO sheet is the **only** mixed-atmosphere surface. Mixing Adventure + Scholarly anywhere else is anti-pattern §7-#11/12 of `visual-language-minimum-2026-05-03.md`.
- `<MissionRibbon atmosphere="scholarly">` is the canonical bridge inside the PRO sheet's hybrid layout.
- The prop **does not control behavior** — only visual treatment. Same DOM, same a11y, same callbacks.

### 12.5 Cross-references

- Implementation: `apps/web/src/components/{kingdom,hud,pro-mission}/*.tsx`.
- CSS overrides: `apps/web/src/app/globals.css` "Atmosphere prop pattern — Scholarly overrides" block.
- UX foundation: `_bmad-output/planning-artifacts/ux-design-specification.md` Step 11 §11 ("Atmosphere selection per surface").
- Story: `_bmad-output/planning-artifacts/epics.md` Epic 1 Story 1.10.

## 13. Primitive Error Boundary

`<PrimitiveBoundary>` contains a primitive crash so the parent surface keeps rendering. It is the canonical wrapper for any new Game Home redesign primitive when composed in a surface — the migration story (Story 1.12) wraps each primitive instance.

### 13.1 Type contract

```ts
import { PrimitiveBoundary } from "@/components/error/primitive-boundary";

<PrimitiveBoundary
  primitiveName="KingdomAnchor"
  surface="play-hub"
  atmosphere="adventure"
  onError={(ctx) => {/* wire to Sentry/Vercel here */}}
>
  <KingdomAnchor variant="playhub" />
</PrimitiveBoundary>
```

### 13.2 Behavior

- No-error path: children pass through with **zero DOM wrapping**, so primitives that return `null` (e.g. `<HudResourceChip value={null} />`) keep collapsing cleanly.
- Error path: renders a paper-tray fallback with `role="alert" aria-live="polite"` and a quiet "couldn't load this piece" message. Reads as a small note, never as an alarm.
- `onError` is invoked with a structured context: `{ primitiveName, surface, atmosphere, error, stack }`. The boundary intentionally exposes only those keys so PII can't ride the error channel via arbitrary child props.

### 13.3 Rules of use

- **Surfaces wrap, primitives don't auto-wrap.** This keeps the no-error DOM identical to a bare primitive and prevents double-wrap when boundaries are nested.
- One boundary per primitive instance. Sibling boundaries isolate from each other (a single crash doesn't blank the whole surface).
- The fallback copy stays neutral and non-alarming. Error reporting is the surface's responsibility, not the user's distraction.

### 13.4 Cross-references

- Implementation: `apps/web/src/components/error/primitive-boundary.tsx`.
- Tests: `apps/web/src/components/error/__tests__/primitive-boundary.test.tsx` (5 tests covering no-error, error, structured onError, PII guard, sibling isolation).
- CSS: `apps/web/src/app/globals.css` "Primitive Boundary fallback" block.
- Story: `_bmad-output/planning-artifacts/epics.md` Epic 1 Story 1.11.

## 14. Primitive Variants

Catalog of variant axes already shipped on Game Home redesign primitives. New variants land here in the same PR that introduces them.

### 14.1 KingdomAnchor variants

| Variant | Aspect ratio | Asset source | Surfaces | Story |
|---|---|---|---|---|
| `playhub` (default) | `1 / 1` | `redesign/bg/splash-loading.{avif,webp,png}` | `/exercises` Hub | 1.3 |
| `arena-preview` | `1.3 / 1` | `redesign/board/board-ch.{avif,webp,png}` + 32-piece overlay from `redesign/pieces/` | `/arena` selecting state | 2.1 |
| `landing-hero` | `1.5 / 1` | `redesign/bg/splash-loading.{avif,webp,png}` | Landing hero | 3.x (pending) |

Notes:

- The `arena-preview` variant centers a square chess board inside the wider 1.3:1 frame (letterboxed via `object-fit: contain`) and overlays a static starting position on a uniform 8×8 grid (`12.5%` per cell). The overlay is decorative — `aria-hidden="true"` — and does not affect the wrapper's `role="img"` + `aria-label` (single announcement).
- All variants share the gold-leaf border + warm halo + ambient idle pulse from §11.2; the variant only swaps inner content.
- Atmosphere prop (§12) is independent of variant — Adventure is the default everywhere; Scholarly is unused on KingdomAnchor today.

### 14.1.x Migration scaffold — `<HubScaffold>` (Story 1.12, in progress)

The Game Home redesign Hub composition lives in `apps/web/src/components/hub/hub-scaffold.tsx`. It composes the 11 redesign primitives in the canonical 3-zone layout (HUD top + Kingdom Anchor body with reward/premium sides + mission ribbon + primary CTA). Each primitive instance is wrapped in `<PrimitiveBoundary primitiveName="…" surface="play-hub" atmosphere="adventure" />` per §13.

**Activation:** opt-in via `?hub=new` on `/hub`. The legacy `<ExercisesScreen>` remains the default. The flag flip to make the scaffold the canonical Hub lands once data wiring (trophies, PRO state, reward states, navigation) is complete in a follow-up commit (Story 1.12.1).

**What's wired today:** layout, primitives composition, prop-driven copy + tap callbacks, error containment. **Not yet wired:** real on-chain trophy count, real PRO status, real reward tile states, real navigation on PLAY tap. Static placeholder values live in `app/hub/page.tsx` so the scaffold is visually verifiable.

### 14.2 PrimaryPlayCta surface variants

| Surface | Icon | Sizing | Surfaces | Story |
|---|---|---|---|---|
| `playhub` | `btn-battle` | dominant (`min-height: 64px`, font 1.5rem) | `/exercises` Hub | 1.9 |
| `arena` | `btn-play` | dominant | `/arena` (in-game CTAs, future) | 1.9 |
| `arena-entry` | `btn-play` | **compact** (`min-height: 52px`, font 1.2rem, smaller icon) | `/arena` selecting state | 2.2 |
| `landing-hero` | `btn-play` | dominant | Landing hero CTA | 1.9 |
| `landing-final-cta` | `btn-play` | dominant | Landing bottom CTA | 1.9 |

Notes:

- All surfaces share the stone backplate (`btn-stone-bg`), gold-leaf treatment, ambient pulse (4s loop, motion-safe), pressed-translateY, and disabled/loading state.
- `arena-entry` is intentionally compact because it co-renders with the `<DifficultySelector>` and `<KingdomAnchor variant="arena-preview">` in a vertically dense surface — a dominant-size CTA there would crowd the kingdom anchor.
- Label is **prop-driven** (Path A canonized in Story 1.9). Editorial wiring (e.g. `CTA_LABELS.startArena = "START"`) lives on the consuming surface, not the primitive.


## 15. CandyCard — Residential Content-Block Primitive (M2)

`<CandyCard>` is the canonical residential content surface. It complements `<CandyGlassShell>` (modal, transient) by providing a chassis for content blocks that live *inside* pages and scrolls — mission tiles, achievement panels, daily highlights, summary stats, briefing blocks, coach cards.

**Spec**: `docs/superpowers/specs/2026-05-08-m2-candy-card-design-v1.2.md`
**Location**: `apps/web/src/components/redesign/candy-card.tsx`

### 15.1 Type contract

```ts
type CandyCardSize = "compact" | "regular" | "feature";
type CandyCardAtmosphere = "hub" | "amber" | "gold";

type CandyCardProps = {
  size?: CandyCardSize;             // default "regular"
  atmosphere?: CandyCardAtmosphere; // default "hub"
  titleAs?: "h2" | "h3" | "h4";     // default "h3"
  eyebrow?: ReactNode;
  title?: ReactNode;
  media?: ReactNode;                // top slot
  children: ReactNode;              // body
  footer?: ReactNode;
  corner?: ReactNode;               // absolute-positioned (top-right)
  className?: string;
  "aria-label"?: string;
};
```

### 15.2 Size matrix

| Size | Padding (y / x) | Gap | Title | Use case |
|---|---|---|---|---|
| `compact` | 0.75rem / 0.875rem | 0.5rem | 1rem | list items, mini-stats |
| `regular` (default) | 1.25rem / 1.25rem | 0.75rem | 1.125rem | mission tiles, summaries |
| `feature` | 1.75rem / 1.5rem | 1rem | 1.375rem | hero highlights, daily, victory recap |

### 15.3 Atmosphere matrix

| Atmosphere | CSS classes applied | Painting | Use case |
|---|---|---|---|
| `hub` (default) | `sheet-bg-hub` | forest bg-ch + cream wash + resting border/shadow | residential cousin of modals (mission, summary, briefing) |
| `amber` | `candy-frame candy-frame-amber` | warm wooden-scroll | peek-cards, daily highlights |
| `gold` | `candy-frame candy-frame-gold` | brighter saturated wooden-scroll | claim-CTA cards, victory ceremony |

`atmosphere=amber|gold` composes `.candy-frame` — the wooden-scroll `:active` press animation is **neutralized** for `<CandyCard>` containers (cards are presentational, not pressable).

### 15.4 Rules of use

- **Presentational only** — no `onPress`. To make a card tappable, wrap children in `<CandyButton>`, `<button>`, or `<Link>` inside the body or footer slot.
- **Heading hierarchy** — pass `titleAs="h2"` when the card is the first heading on a screen; pass `titleAs="h4"` when nested inside a section that already uses `<h3>`.
- **A11y is automatic** — when `title` is set, `aria-labelledby` wires the section to the title id. When no title, pass `aria-label` for an accessible name.
- **Never overlay** — for modals use `<CandyGlassShell>` (has scrim + close button + portal). `<CandyCard>` does not portal, scrim, or close.

### 15.5 Naming policy (post-M2)

`apps/web/src/components/redesign/` residential primitives:

| Primitive | Role |
|---|---|
| `<CandyBanner>` | Sprite asset renderer (decorative `<picture>`) |
| `<CandyButton>` | CSS-styled button atom |
| **`<CandyCard>`** | Vertical content-block primitive (residential) — this section |
| `<CandyChip>` | Inline status/tag pill |
| `<CandyGlassShell>` | Modal shell (transient — scrim + close button) |
| `<CandyIcon>` | Icon atom |
| `<JourneyRail>` | Paper-tray list-row component |
| `<PageSection>` | Vertical-block wrapper with optional `<h2>` |
| **`<PlayerAvatar>`** | Sprite avatar `<picture>` (renamed from `<PlayerCard>` in M2). Renders historical CSS classes `.player-card`, `.player-card-img`, `.player-card-you`, `.player-card-bot` — class rename deferred to a follow-up ticket. Do **not** introduce new consumers of those class names. |
| `<WoodenBanner>` | Decorative wooden banner asset |

**`<CandyCard>` does NOT overlap with `apps/web/src/components/ui/card.tsx`** (shadcn `Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter`). The shadcn primitives are for tooling-bootstrapped surfaces only. **For product cards always use `<CandyCard>` from `@/components/redesign/candy-card`.**

## 16. Scene-Rooted UI Vocabulary (M3.5)

Five sibling primitives where each control is a **physical object in the scene** (stone, treasure, primary-action button, wood, gem). Complements `<CandyCard>` — CandyCard standardizes residential content blocks; the scene-rooted vocabulary covers pressable CTAs that live inside the bosque.

**Spec**: `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-design.md`
**Red-team**: `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-redteam.md`
**Location**: `apps/web/src/components/scene-rooted/`

### 16.1 Primitive matrix

| Primitive | Role | Element | Asset |
|---|---|---|---|
| `<StonePedestal>` | Round tap target on a piedra (1–10 stones × 3 sizes) | `<button>` | `--stone-pedestal-bg-{1..10}` |
| `<TreasureTile>` | Chest with iconStack + value chip + ribbon enum | `<button>` | `--treasure-chest-bg-{small,large}` |
| `<PrincipalButton>` | Primary CTA backed by `principalbutton.webp` | `<button>` | `--principal-button-bg` |
| `<WoodBanner>` | Presentational title/state ribbon, 3 sizes | `<div role="presentation">` or `<h2>` (when `asTitle`) | `--wood-banner-bg-{short,medium,large}` |
| `<GemBadge>` | Presentational metric pill | `<span>` | `--gem-pill-bg` |
| `<GemButton>` | Pressable metric pill (sibling of GemBadge) | `<button>` | `--gem-pill-bg` |

### 16.2 Asset Versioning Policy

Assets in `apps/web/public/art/scene-rooted/` are **working drafts**. Each primitive references its asset via a CSS variable (naming: `--{primitive-kebab}-bg-{variant}`). Swapping the asset = updating the CSS var; no primitive contract change required.

Tests assert on `data-component`, `data-size`, `data-stone`, `data-state`, `data-ribbon` and slot composition — never on filenames. This unblocks shipping with non-final art.

When the var resolves to empty/none/missing, the primitive applies `is-placeholder` to its root and renders a CSS gradient fallback (no flash-of-broken-image).

### 16.3 Asset performance budget

Verified on the working-draft set (commit `35c46cb`):

| Primitive | Budget | Worst-case actual |
|---|---|---|
| `<StonePedestal>` | ≤ 12 KB | 4.8 KB (piedra1.webp) |
| `<TreasureTile>` | ≤ 24 KB | 18.9 KB (treasure-chest-large.webp) |
| `<PrincipalButton>` | ≤ 16 KB | 10.1 KB |
| `<WoodBanner>` | ≤ 16 KB | 16.3 KB (medium) |
| `<GemBadge>` / `<GemButton>` | ≤ 8 KB | 2.2 KB |

Total payload for the full vocabulary set: **148 KB**.

### 16.4 Behavior contract (shared across pressable primitives)

1. **Press feedback** — `:active:not(:disabled)` applies `transform: scale(0.96)` + a brief `box-shadow` lift. The animation is intentionally NOT neutralized (these primitives ARE pressable, unlike `<CandyCard>`).
2. **`prefers-reduced-motion`** — when the OS-level setting is reduced, scale is removed but a `border-color` flash (200ms) replaces it. Visual feedback NEVER fully disappears.
3. **Disabled** — renders `<button disabled>` with 50% opacity + `cursor: not-allowed`. The DOM element stays a `<button>` (NOT polymorphic to `<div>`); a11y requirement so screen readers announce a disabled control.
4. **Loading** — when `loading=true`, primitive shows a centered spinner; underlying icon/label dims to 30% opacity; click is suppressed. When BOTH `loading` AND `disabled`, `loading` takes visual precedence (spinner shown). `<GemButton>` and `<GemBadge>` intentionally lack a loading state per spec — metric pills update fast.
5. **a11y** — `<StonePedestal>`, `<TreasureTile>`, `<GemButton>` require `aria-label` at the TypeScript type level. `<PrincipalButton>` may infer label from textual children; `<WoodBanner asTitle>` becomes `<h2>`.
6. **Iconography decoupling** — primitives accept any `ReactNode` for icon slots. They do NOT type-check `icon.type` or constrain to a specific icon component.

### 16.5 Migration mapping (pending — guarded by user approval)

| Surface | Primitive | Notes |
|---|---|---|
| `daily-tactic-card.tsx` (compact) | `<StonePedestal size="medium" stone={2}>` with coach icon + streak `badge` | Canary, lowest blast radius |
| `mini-arena-bridge-slot.tsx` (compact) | `<StonePedestal size="medium" stone={4}>` with trophy icon | Gated by 12-stars-rook |
| `mini-arena-bridge-slot.tsx` (non-compact) | DELETE — confirmed dead code | — |
| `daily-tactic-card.tsx` (non-compact) | DELETE — confirmed dead code | — |
| `action-pin.tsx` (`tone="claim"`) | Composition — action-pin internally renders `<PrincipalButton>` when `tone="claim"` | Preserves all call sites |
| `coach-paywall.tsx` 5-pack | `<TreasureTile size="small">` + `iconStack=5 coins` + `valueChip="$0.05"` | Paywall blocker |
| `coach-paywall.tsx` 20-pack | `<TreasureTile size="large">` + `iconStack=20 coins` + `ribbon="BEST"` + `valueChip="$0.10"` | Last; revenue-critical |

### 16.6 Future work (out-of-scope this milestone)

- "Mint your Moment" — daily-tactic share/mint flow extending VictoryNFT pattern. Will reuse `<PrincipalButton>` for the "Save my Moment" CTA when shipped.
- `<StonePedestal variant="trophy">` — completed daily-tactic state ("logrado-orgullo, no muerto"). Tracked in spec Open Questions; not blocking v1.
- Manual screenshot baselines per primitive in `apps/web/e2e/screenshots/scene-rooted/`.
- Surface audit for non-diegetic chrome (other `<button>` instances) — recommended follow-up per red-team P1.

---

## 17. Destructive Action Pattern — Tap-to-Confirm

Reference: `components/arena/arena-action-bar.tsx` (Resign button).

The vocabulary audit (2026-05-09) flagged the Resign confirmation as the
**canonical exemplar** for destructive actions in Chesscito. Use this
pattern for any action that ends a session, discards progress, or
otherwise cannot be undone.

### 17.1 The pattern

A single button toggles between two states on the same hit target. No
modal, no overlay, no confirmation dialog.

| Tap | State | Visual | Behavior |
|---|---|---|---|
| 1st | armed | icon swaps (action → check), countdown ring, `is-confirming` class | wait up to 3s |
| 2nd within 3s | confirmed | — | execute the destructive action |
| auto after 3s | cancelled | revert to default | no-op |

State machine implementation (simplified):

```tsx
const [confirming, setConfirming] = useState(false);
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => () => {
  if (timerRef.current) clearTimeout(timerRef.current);
}, []);

function handleClick() {
  if (confirming) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onAction();
  } else {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
  }
}
```

### 17.2 Why we prefer this over a modal

- **Zero context loss** — board / game state stays visible during confirmation, so the user keeps full awareness of what they are about to lose.
- **One-handed reachable** — the second tap lands in the same touch target the user just hit; no thumb migration to a modal CTA.
- **Self-cancelling** — the 3s timeout means an accidental tap costs nothing; users learn the pattern is forgiving.
- **No focus trap** — keyboard users do not need to escape a dialog or hunt for a primary button. Same focus, two presses.

### 17.3 Required behavior

A correct implementation must:

1. **Visually distinguish the armed state.** Icon swap to `check` (CandyIcon) is the canonical signal. A 3s linear `confirm-countdown` keyframe animation on a ring/border communicates the time budget.
2. **Auto-cancel after 3s.** Hard cap. Users should never be left with a permanently-armed destructive button.
3. **Clear the timer on unmount.** Prevent stale state if the surface unmounts mid-arming.
4. **Announce the state change to assistive tech.** Dynamic `aria-label` (`"Resign"` → `"Tap again to confirm resign"`) plus `aria-pressed={confirming}`. Editorial copy lives next to its sibling labels (e.g., `ARENA_COPY.resignConfirm`).
5. **Not stack with other surfaces.** If the action ends the game and routes to an end-state modal, the modal renders **after** the second tap; the confirmation never happens inside another sheet.

### 17.4 When NOT to use this pattern

- **Multi-step destructive flows** (e.g., "delete account, type your email") — those need a real modal because the friction is intentional.
- **Cross-cutting actions in chrome** (logout, switch network) — these live in dock/menu surfaces and use the rose-toned `<Button variant="destructive">` per §1.
- **Actions that need extra inputs** (a reason, a confirmation token) — modal territory.

### 17.5 Accessibility checklist

When adopting the pattern, verify:

- [ ] Dynamic `aria-label` swaps with the armed state.
- [ ] `aria-pressed={armed}` for screen-reader state semantics.
- [ ] Visible focus ring respected (do not override `:focus-visible`).
- [ ] Touch target ≥ 44×44 (per §4).
- [ ] Countdown animation respects `prefers-reduced-motion` (countdown ring may snap-collapse instead of animating).

