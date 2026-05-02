# `<ContextualHeader />` — Spec (2026-05-01)

> **Phase**: Phase 2 — first zone primitive.
> **Owner**: Wolfcito. UX advisor: Sally (BMad).
> **Status**: **v1 — amendment applied 2026-05-01** after red-team review (`docs/reviews/contextual-header-spec-red-team-2026-05-01.md`). All 8 P0 closed. Awaiting 15-minute re-review pass before commit #1 of the implementation plan. See "Amendment log" at the bottom.
> **Source brief**: `docs/reviews/ui-zone-map-decision-record-2026-05-01.md` §5.2 + §1 (Z2 ownership).
> **Related primitives** (not in this spec): `<GlobalStatusBar />` (Z1), `<ContextualActionRail />` (Z4).

---

## 1. Problem this solves

The play-hub today renders its top-of-board treatment as inline JSX inside `mission-panel-candy.tsx` (~line 276): a `flex` row that hosts the piece chip (`<PiecePickerSheet trigger={pieceChip} />`) plus a mission chip (`<MissionDetailSheet trigger={...} />`). Other screens (arena, missions list, badges sheet) each ship their own ad-hoc top treatments — different paddings, different sticky behavior, different border styles, different content rules.

This duplication causes:

- **No enforced placement**: piece selector + objective + mode tabs land wherever the screen author chooses, sometimes inside the board zone (Z3) instead of Z2.
- **No enforced cap**: nothing prevents a screen from rendering 3+ controls in the top band.
- **No unified sticky semantics**: some screens scroll the header away, others pin it, none documents which.
- **Editorial drift**: each screen re-implements title typography, leading to subtle font/size differences flagged in the 2026-04-18 ux audit.

Z2 is the second-most-watched horizontal band of every Chesscito screen, after the dock. It must be a primitive, not a pattern.

---

## 2. Zone ownership: Z2

Per `ui-zone-map-decision-record-2026-05-01.md` §1:

| Property | Value |
|---|---|
| Zone | **Z2** (Contextual Header) |
| Height | 52–64px |
| Always visible | Per-screen (some screens may legitimately omit Z2; e.g. fullscreen modal flows) |
| Stack position | Below Z1 (`<GlobalStatusBar />`), above Z3 (content/board) |
| z-index | 10 (per `globals.css` ladder; well below dock at 60 and overlays at 70) |

**Z2 is the screen's local context strip.** It answers: "what screen am I on, what's the immediate objective, and what is the *one* contextual control I might tap?" Identity (Z1) and primary action (Z4) are owned elsewhere.

---

## 3. Proposed component API

```tsx
import { ContextualHeader } from "@/components/ui/contextual-header";

<ContextualHeader
  variant="title-control"
  title="Rook"
  subtitle="Move to h1"
  trailingControl={<PiecePickerTrigger onClick={() => setPickerOpen(true)} />}
  ariaLabel="Mission header"
/>
```

The component is **framework-agnostic styling-wise** (Tailwind + design tokens, no third-party UI lib) and **headless behaviorally** — it renders structure and applies the canonical Z2 height/padding/border, but does not own state. State (open/close pickers, change mode) lives in callers.

> **Amendment 2026-05-01 (post red-team)**: The flat `interface` of v0 has been
> replaced with a **discriminated union** so impossible prop combinations
> (e.g. `back + modeTabs`, `trailingControl` outside `title-control` /
> `back-control`) fail to compile. v0 also accepted `ReactNode` as
> `trailingControl`, which silently allowed arrays / fragments — v1 narrows
> to `ReactElement` (single element only).

---

## 4. Props

```ts
import type { ReactElement } from "react";

export type ContextualHeaderProps =
  | TitleHeaderProps
  | TitleControlHeaderProps
  | ModeTabsHeaderProps
  | BackControlHeaderProps;

type Sticky = "scroll"; // v1: scroll only. "sticky" deferred — see §9.
type AriaLabel = string; // required at runtime; type made optional only because it can be derived from `title` for variants that have one.

export type TitleHeaderProps = {
  variant: "title";
  title: string;
  ariaLabel?: AriaLabel;
  sticky?: Sticky;
};

export type TitleControlHeaderProps = {
  variant: "title-control";
  title: string;
  subtitle?: string;
  /** Single element only. NOT ReactNode — arrays / fragments are rejected. */
  trailingControl: ReactElement;
  ariaLabel?: AriaLabel;
  sticky?: Sticky;
};

export type ModeTabsHeaderProps = {
  variant: "mode-tabs";
  modeTabs: ModeTabsProp;
  ariaLabel?: AriaLabel;
  sticky?: Sticky;
};

export type BackControlHeaderProps = {
  variant: "back-control";
  title: string;
  back: BackProp;
  /** Optional. Single element only — same rule as title-control. */
  trailingControl?: ReactElement;
  ariaLabel?: AriaLabel;
  sticky?: Sticky;
};

export type BackProp = {
  onClick: () => void;
  label: string;
};

export type TabOption = {
  key: string;
  label: string;
};

export type ModeTabsProp = {
  activeKey: string;
  /** Tuple-capped at 4. A 5th option is a compile-time error. */
  options: readonly [TabOption, TabOption?, TabOption?, TabOption?];
  onChange: (key: string) => void;
};
```

**Contracts that the type system actually enforces** (no longer prose-only):

- `trailingControl` is `ReactElement`, not `ReactNode` — arrays, fragments, iterables, `null`, and `undefined` no longer compile in `title-control`. (`null`/`undefined` still compile in the *optional* `back-control` variant by virtue of `?`, but never as a fragment.)
- `back` exists **only** on `BackControlHeaderProps`. Passing `back={...}` on a `title` variant is a type error.
- `modeTabs` exists **only** on `ModeTabsHeaderProps`. Same enforcement.
- `back + modeTabs` together is impossible by construction — they live on different members of the union.
- `modeTabs.options` is a tuple capped at 4. A 5th option is a type error, not a dev-mode warning.

**Runtime guards** (dev-mode `console.warn`, no runtime crash):

- `title.length > 22` → warn (truncation will engage; see §6 length caps).
- `subtitle.length > 32` → warn.
- Any `TabOption.label.length > 16` → warn.
- Duplicate `TabOption.key` values → warn (last-wins is the documented behavior).
- `trailingControl`'s rendered DOM width > 44px → warn.

---

## 5. Allowed slots

| Slot | Variants where allowed | Allowed children | Forbidden children |
|---|---|---|---|
| `title` (text) | title, title-control, back-control | string only, ≤22 visible chars (ellipsis past) | JSX, icons, links |
| `subtitle` | title-control | string only, ≤32 visible chars, single line | JSX |
| `trailingControl` | title-control (required), back-control (optional) | a single `ReactElement` rendering a trigger ≤44×44 | sheets, fragments, arrays, anchors, full text buttons |
| `back` | back-control | structured object `{onClick, label}` | raw JSX |
| `modeTabs` | mode-tabs | structured object, tuple-capped at 4 | raw JSX |

**A component is allowed in `trailingControl` if and only if** it is a *trigger* (button) ≤44×44, has a clear single intent, and opens a Type-C quick-picker via state lifted to the caller. The trigger renders inside Z2; the sheet renders elsewhere (sibling, portal). Anything that opens a Type-B destination sheet belongs in the dock, not Z2. Concrete primitives expected to be valid trailing controls: `<PiecePickerTrigger>`, `<FilterChip>`, `<ShareIconButton>`. Concrete primitives that are NOT valid: `<PiecePickerSheet>` (this is the sheet, not the trigger), `<MissionDetailSheet>`, `<ShopSheet>`.

---

## 6. Forbidden cases

- **No primary CTAs in Z2.** Submit, mint, claim, retry — these are Z4. Z2 hosts pickers and tabs only.
- **No floating overlays anchored to Z2.** Pickers open as Type-C sheets (full-width bottom sheet) or Type-B destination sheets, not as popovers attached to the header.
- **No monetization in Z2.** PRO promo, shop teasers, achievement nags — none. Z2 is local context only.
- **No nested headers.** A screen has at most one Z2 strip. If a sub-section needs its own header (e.g. inside a Type-B sheet), that sheet renders its own header — but it is not a `<ContextualHeader />` instance; it's a sheet header (separate primitive, future spec).
- **No icon-only labels.** `aria-label` is required and surfaced visibly when the variant uses a chip; no decorative-only icons in Z2.
- **No timers, no streaks, no live counters.** Those live in Z1 (passive identity) or in dedicated content cards (Z3). Z2 is static for the duration of the screen. Specifically: do not import `formatTime(elapsedMs)` from `arena-utils.ts` into a Z2 caller.
- **No more than one trailing control.** Enforced by `trailingControl: ReactElement` (single element type), not by convention.
- **No sheet rendered inside `trailingControl`.** Sheets render as siblings of `<ContextualHeader>`. Open/close state is owned by the caller. The trigger button is what lives in Z2.
- **No mount/unmount of `<ContextualHeader>` mid-screen.** The strip reserves its full height for the entire lifetime of the screen render. If `title` is loading, render a skeleton chip; do not unmount.

### 6.1 Length caps (visual)

| Slot | Soft cap | Hard cap | Behavior past cap |
|---|---|---|---|
| `title` | 22 chars | 22 chars | Single-line ellipsis. Dev-mode warning. |
| `subtitle` | 32 chars | 32 chars | Single-line ellipsis. Dev-mode warning. |
| `TabOption.label` | 12 chars | 16 chars | Single-line ellipsis. Dev-mode warning past 16. If you need >16, the tab does not belong in Z2 — split the screen. |
| `back.label` | 12 chars | 16 chars | Same rule as tabs. |

These caps are **visual targets** at the default Chesscito typography (390px viewport). Implementation uses `text-overflow: ellipsis` + `white-space: nowrap` + `overflow: hidden`. The dev-mode warnings catch drift early; production never crashes on a long string.

### 6.2 Empty / loading state

- Z2 **always reserves its full height** (52–64px) for the lifetime of the screen, including before data is ready.
- When `title` would be empty, render a **skeleton chip** (`bg-[var(--surface-skeleton)]` rounded block at the title's typography metrics) — do not collapse the strip.
- When `trailingControl` would be empty/loading, render a **skeleton circle** at 44×44 in the trigger's slot — do not omit the slot.
- The primitive **never unmounts itself** based on loading state. Callers control whether the screen renders Z2 at all (via conditional render at the screen root), but once mounted, Z2 stays mounted. This prevents CLS regressions on MiniPay's slow networks.

---

## 7. Variants

### 7.1 `title` — screen title only

Used on screens with no controls in Z2 (e.g. `/about`, `/privacy`, `/terms`, `/support`). Single line, centered or left-aligned per `DESIGN_SYSTEM.md` typography rules.

```tsx
<ContextualHeader variant="title" title="About" ariaLabel="About header" />
```

### 7.2 `title-control` — title + optional subtitle + 1 trailing control

Generic and primary case. Title left, optional subtitle below, **required** ONE trailing control right-aligned. This variant absorbs the play-hub canary use case: piece label as `title`, objective as `subtitle`, piece-picker trigger as `trailingControl`.

```tsx
// Trophies-style usage: title + filter chip
<ContextualHeader
  variant="title-control"
  title="Trophies"
  trailingControl={<FilterChip onClick={() => setFilterOpen(true)} />}
  ariaLabel="Trophies header"
/>

// Play-hub usage: title + objective + piece-picker trigger
<ContextualHeader
  variant="title-control"
  title="Rook"
  subtitle="Move to h1"
  trailingControl={<PiecePickerTrigger onClick={() => setPickerOpen(true)} />}
  ariaLabel="Mission header"
/>
```

> **Amendment 2026-05-01**: v0 had a dedicated `piece-objective` variant for
> the play-hub canary. Red-team flagged this as a variant-explosion smell
> (a variant for one screen). **Removed in v1.** `title-control` carries the
> play-hub case via `subtitle` — same DOM, same rendering, no per-screen
> variant.

### 7.3 `mode-tabs` — segmented mode tabs (max 4)

Used on screens with ≤4 sub-modes. E.g. trophies might show `Recent | All | Locked`. If a screen needs >4 tabs it must be split into sub-screens.

```tsx
<ContextualHeader
  variant="mode-tabs"
  modeTabs={{
    activeKey: "recent",
    options: [
      { key: "recent", label: "Recent" },
      { key: "all", label: "All" },
      { key: "locked", label: "Locked" },
    ],
    onChange: setMode,
  }}
  ariaLabel="Trophies modes"
/>
```

### 7.4 `back-control` — back button + 1 trailing control

Used on Type-A overlays and deep nav (e.g. arena post-game review). Back is left, optional trailing control is right.

```tsx
<ContextualHeader
  variant="back-control"
  title="Game Review"
  back={{ onClick: () => router.back(), label: "Back" }}
  trailingControl={<ShareIconButton onClick={openShare} />}
  ariaLabel="Game review header"
/>
```

> **v1 variant total: 4** (down from 5). `piece-objective` was dropped; its
> use case is fully covered by `title-control` with a `subtitle`.

---

## 8. First use in `/play-hub`

The canary integration lives in `apps/web/src/components/play-hub/mission-panel-candy.tsx`. The current inline block (the `<div className="shrink-0 mx-2 mt-2 flex items-center gap-2">` around line 276) gets replaced by **two sibling pieces**: the `<ContextualHeader>` strip (which contains *only the trigger button*) and the sheet itself rendered as a sibling, with `open` state lifted to the parent.

```tsx
// In mission-panel-candy.tsx
const [piecePickerOpen, setPiecePickerOpen] = useState(false);
const [missionDetailOpen, setMissionDetailOpen] = useState(false);

return (
  <>
    <ContextualHeader
      variant="title-control"
      title={PIECE_LABELS[selectedPiece]}
      subtitle={objectiveLabel}
      trailingControl={
        <PiecePickerTrigger
          selectedPiece={selectedPiece}
          onClick={() => setPiecePickerOpen(true)}
        />
      }
      ariaLabel="Mission header"
    />

    {/* Sheet renders as a sibling — NOT inside trailingControl. */}
    <PiecePickerSheet
      open={piecePickerOpen}
      onOpenChange={setPiecePickerOpen}
      selectedPiece={selectedPiece}
      pieces={pieces}
      onSelectPiece={onSelectPiece}
    />

    {/* TODO(zone-map-phase-2): fold MissionDetailSheet entry into the
        piece-picker sheet as a sub-tab, so the picker becomes the single
        Type-C destination for "what am I doing right now?" Tracked under
        the Phase 2 follow-on backlog. Until then, the existing
        MissionDetailSheet button stays rendered as a sibling so its
        functional surface is preserved across this canary commit. */}
    <MissionDetailSheet
      open={missionDetailOpen}
      onOpenChange={setMissionDetailOpen}
      selectedPiece={selectedPiece}
      targetLabel={targetLabel}
      // ...existing props
    />
  </>
);
```

**Key contract changes vs v0 of this spec:**

1. `trailingControl` receives **only a trigger button** (`<PiecePickerTrigger>`), not a sheet. The sheet is a sibling.
2. **Open/close state is owned by the parent** (`mission-panel-candy.tsx`), not by the primitive.
3. **`MissionDetailSheet` is preserved** during the canary, rendered as a sibling with an explicit Phase-2 TODO. **Destination decided**: it folds into the piece-picker sheet as a sub-tab in a follow-up commit. No regression in the canary.

> **Amendment 2026-05-01**: v0 embedded `<PiecePickerSheet>` inside
> `trailingControl`. Red-team flagged this as conflating trigger and sheet
> (the sheet portals out of the DOM tree when open). v1 lifts state to the
> parent and renders the sheet as a sibling. v0 also left
> `MissionDetailSheet` destination as TBD, which would have shipped a
> regression. v1 names the Phase-2 destination (piece-picker sub-tab) and
> keeps the existing surface mounted as a sibling for canary safety.

---

## 9. What this primitive does NOT do

- **Does not own state.** Pickers, tabs, and back-button targets are controlled by callers.
- **Does not pin to the top.** v1 only supports `sticky="scroll"` (Z2 scrolls with the page). `position: sticky` is **deferred** — the current `mission-shell-candy` shell is `flex h-[100dvh] flex-col overflow-hidden`, and `position: sticky` inside `overflow-hidden` is a known broken combination on iOS Safari. Adding sticky support requires a shell refactor that is out of scope for this primitive. The `Sticky` type is `"scroll"`-only in v1; if `"sticky"` is added later it goes through a separate spec.
- **Does not handle scroll behavior beyond static layout.** No collapse-on-scroll, no parallax, no header-shrink animation.
- **Does not migrate other screens.** Spec covers the play-hub canary only. Arena, missions, badges, secondary pages are follow-up commits, each with their own visual QA pass.
- **Does not replace the dock.** Z5 is sacred per `DESIGN_SYSTEM.md` §8. Nothing in this primitive talks to the dock.
- **Does not introduce new copy.** All strings come from `editorial.ts` (`PIECE_LABELS`, `CTA_LABELS`, etc.). No new keys added by this primitive itself.
- **Does not solve the Daily Tactic + Mini Arena bridge unification.** That is the "Z2 challenges row" — a separate sub-row treatment, deferred to a later Phase 2 commit (after this primitive lands).
- **Does not solve the PRO chip split.** That depends on `<GlobalStatusBar />` (Z1) for the active-state ring and on `<ContextualActionRail />` (Z4) for the inactive-state promo card. Out of scope here.
- **Does not accept a `className` escape hatch in v1.** The original spec proposed `className?: string` for "surface tweaks." Removed in v1: callers cannot override the primitive's surface, padding, or height. Future opt-ins (e.g. `theme="emerald" | "amber"`) go through a typed prop, not arbitrary classes.

---

## 10. Acceptance criteria

The primitive is "done" when **all** of the following hold:

1. `apps/web/src/components/ui/contextual-header.tsx` exists, exports `<ContextualHeader />` and the discriminated-union prop types from §4.
2. All **4 variants** (`title`, `title-control`, `mode-tabs`, `back-control`) render at 390×844 (minipay viewport) with correct height (52–64px) and padding.
3. The primitive consumes existing design tokens (`--surface-*`, `--text-*`, `--space-*`); no new tokens introduced.
4. The play-hub canary uses the primitive (`variant="title-control"` with subtitle); the inline `<div>` block in `mission-panel-candy.tsx` is removed.
5. The piece picker still opens correctly when the trigger is tapped — open/close state is owned by `mission-panel-candy.tsx`, not by the primitive (no regression in `<PiecePickerSheet>` open/close flow).
6. **Visual QA** (`pnpm test:e2e:visual --project=minipay`): the Z2 strip snapshot may change and is reviewed and re-baselined deliberately; **Z3, Z4, Z5 keep the same DOM order and functional footprint**, no new element overlaps Z3, no board pixels are blocked, and the dock is not displaced. Subpixel reflow (±2px) caused by Z2 height delta is acceptable below Z2 *only if* Z3's interactive area (`.playhub-board-hitgrid`) keeps its bounding box within ±2px of baseline. Snapshot regeneration is explicit (`--update-snapshots`), reviewed in the PR diff, never blind.
7. Unit tests cover all 4 variants. Type-system contracts (e.g., `back` outside `back-control`, fragments in `trailingControl`, 5th option in `modeTabs.options`) are validated by `tsd` or equivalent compile-time test, not just runtime asserts.
8. No new TS errors introduced (`tsc --noEmit` count unchanged from baseline at branch tip).
9. Existing E2E suite (`pnpm test:e2e --project=minipay`) is green: `floating-actions-vs-dock`, `home-loads`, `dock-anchor` all pass; new `contextual-header.spec.ts` E2E passes (see §13).
10. The primitive is documented in `DESIGN_SYSTEM.md` §10 as the canonical Z2 component, with a "first consumer: play-hub" note. Docs ship in commit #1 alongside the primitive, **not as a trailing commit**.
11. `MissionDetailSheet` remains accessible in `/play-hub` post-canary (rendered as a sibling of `<ContextualHeader>` per §8). Phase-2 follow-on issue tagged in commit message.

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Variant explosion** — future screens demand a 6th variant, then a 7th | Medium | High | Hard rule: any new variant requires a written justification in the spec PR, signed off by Wolfcito. If 3+ screens want "almost variant X but slightly different," that's a missing primitive elsewhere (e.g. `<SheetHeader />`), not a new Z2 variant. |
| **Caller bypasses the primitive** for "just this one screen" | Medium | Medium | Add ESLint rule (or grep CI check) that flags raw `<header>` and `<div className="...mission-shell-header...">` patterns inside `apps/web/src/app/**/page.tsx`. Discourage drift via review checklist. |
| ~~Sticky behavior fights iOS rubber-band scroll~~ | — | — | **No longer applicable in v1.** `sticky` deferred to a future spec; v1 only supports `"scroll"`. See §9. |
| **Z2 strip + Z1 strip together exceed 100dvh - dock - board** on small viewports (Pixel 4 = 854px) | Low | Medium | Both strips have hard height caps (40px Z1, 64px Z2 max). Combined ceiling is 104px; minus 72px dock = 932px / 200px header overhead leaves >600px for board even on 800px-tall devices. Visual QA at 360×640 confirms. |
| **`trailingControl` slot accepts unintended children** (e.g. someone passes a `<Button>` with text + icon) | Low (down from Medium) | Low | v1 narrows to `ReactElement` (single element only — no fragments, no arrays). Dev-mode warning when rendered child width >44px. |
| **Reducing Z2 to a primitive ossifies the layout** before we know all the cases | Low | Medium | Spec is intentionally narrow — 4 variants, no animations, no scroll behaviors. Any pressure to expand goes through the variant-explosion mitigation above. |
| **Migration churn** — moving every screen to the primitive is a 5+ commit PR | High | Low (mechanical) | Spec scopes implementation to play-hub canary only. Other screens migrate one-per-commit in follow-up PRs, never as a bulk drop-in replacement. |

---

## 12. Implementation plan — by commit

Each commit is one logical change. Run full unit + e2e suite before each. Commits are reversible independently. Conventional Commits + `Wolfcito 🐾 @akawolfcito` footer.

> **Amendment 2026-05-01**: v0 had 5 commits with `piece-objective` as its
> own variant and docs trailing at commit #5. v1 has **4 commits**: dead
> code is eliminated (only build what the canary needs immediately;
> remaining variants ship alongside their first real consumer in future
> PRs), and DESIGN_SYSTEM.md docs ship in commit #1 with the primitive.

1. **`feat(ui): add ContextualHeader primitive (title + title-control variants) + design-system entry`**
   - New file `apps/web/src/components/ui/contextual-header.tsx`.
   - Exports component + the discriminated-union types (all 4 variants typed; only `title` + `title-control` runtime branches implemented in this commit; `mode-tabs` and `back-control` branches throw `assertNever()` until commit #3).
   - Unit tests for `title` + `title-control` (vitest + RTL).
   - Compile-time tests file (`contextual-header.test-d.ts`) covers the discriminated-union contracts from §13.
   - **DESIGN_SYSTEM.md §10 updated in the SAME commit** with the canonical Z2 entry, the variant catalogue, and a "first consumer: play-hub (commit #2)" note.
   - No production callers wired yet.

2. **`refactor(play-hub): adopt ContextualHeader for piece chip + objective (canary)`**
   - Replaces the inline `<div>` in `mission-panel-candy.tsx`.
   - Lifts `piecePickerOpen` and `missionDetailOpen` state to the parent (per §8).
   - Renders `<PiecePickerSheet>` and `<MissionDetailSheet>` as siblings of `<ContextualHeader>`, with the Phase-2 TODO comment naming the piece-picker sub-tab destination.
   - New `<PiecePickerTrigger>` button component (small, ~44×44, owns no sheet logic) extracted from existing chip JSX.
   - New E2E spec `apps/web/e2e/contextual-header.spec.ts` per §13.
   - Visual QA snapshot regenerated for `/hub` only with `--update-snapshots`; PR diff reviewed against §14 matrix.
   - This is the canary commit. **Halt here for re-review** before commit #3.

3. **`feat(ui): add ContextualHeader mode-tabs and back-control runtime branches`**
   - Implements the runtime branches for the two remaining variants. (Types already shipped in commit #1.)
   - Unit tests for both variants.
   - Dev-mode warnings: duplicate tab keys, label length drift, trigger width drift.
   - Still no production callers wired (Trophies / Arena / etc. migrations are out of scope for this PR).

4. **`docs(design-system): cross-link ContextualHeader Phase-2 follow-ons`**
   - Appends a "Phase 2 follow-ons" subsection under DESIGN_SYSTEM.md §10:
     - `MissionDetailSheet` migration into piece-picker sub-tab.
     - First mode-tabs consumer (Trophies recents/all/locked filter).
     - First back-control consumer (Arena post-game review).
   - No code changes.

**Stop here. Do NOT migrate other screens in this PR.** Arena, missions, badges, secondary pages each get their own dedicated PR after this one merges, so visual QA on each migration is isolated and reviewable.

**Rollback triggers** (any one fires → revert the offending commit):

- Sentry / app-error rate on `/hub` rises >2× baseline within 24h of canary deploy.
- Visual QA shows Z3, Z4, or Z5 dimensions drifted beyond ±2px.
- `MissionDetailSheet` or `PiecePickerSheet` open/close cycle breaks.
- TS error count rises above baseline.

---

## 13. Tests expected

### Unit (vitest + RTL)

- **File**: `apps/web/src/components/ui/__tests__/contextual-header.test.tsx`.
- One test block per variant (4 blocks: `title`, `title-control`, `mode-tabs`, `back-control`).
- Each block asserts: variant renders, expected slots present, height/padding tokens applied, length-cap dev warning fires for over-cap strings.
- **`title-control` block** asserts: trailing control trigger fires `onClick` when tapped (RTL `userEvent.click`); subtitle renders below title; ellipsis engages past 22 / 32 chars; skeleton chip renders when `title === ""`.
- **`mode-tabs` block** asserts: 4 options render; clicking a tab fires `onChange` with the right key; duplicate `key` warns and uses last-wins; a label >16 chars warns. (Tuple-cap of 4 is enforced by the type system; verified by `tsd` — see compile-time tests below.)
- **`back-control` block** asserts: back button is present, has 44×44 hit area, fires `onClick`; optional `trailingControl` is right-aligned.
- **A11y test** per variant: `aria-label` on the wrapper element; back button has `aria-label`; chips have visible labels.

### Compile-time tests (`tsd`)

- **File**: `apps/web/src/components/ui/__tests__/contextual-header.test-d.ts`.
- Asserts that the following caller patterns are **type errors** (not runtime warnings):
  - `back={...}` on `variant="title"`.
  - `modeTabs={...}` on `variant="title-control"`.
  - `trailingControl={<></>}` (fragment) on `variant="title-control"`.
  - `trailingControl={[<X />, <Y />]}` (array) on `variant="title-control"`.
  - `modeTabs.options` with 5 entries.
  - Missing `title` on `variant="title"` / `"title-control"` / `"back-control"`.

### Integration / E2E (Playwright)

- **Existing**: `apps/web/e2e/home-loads.spec.ts` and `apps/web/e2e/floating-actions-vs-dock.spec.ts` must continue to pass (regression bound).
- **New**: `apps/web/e2e/contextual-header.spec.ts` — opens `/hub`, asserts:
  - Z2 strip is visible with correct height (52–64px).
  - Piece chip trigger is tappable; tap opens `<PiecePickerSheet>`; sheet's open/close cycle works.
  - **`MissionDetailSheet` access is preserved** — the existing entry button is still reachable from `/hub`.
  - No live timer rendered inside Z2 (assertion: no element matching `[data-component="contextual-header"] .timer`).
  - No monetization chip rendered inside Z2 (assertion: no `.pro-chip`, `.shop-promo` inside Z2).
  - Z3 board hit-grid bounding box is within ±2px of the pre-refactor baseline.

### Type-check

- `pnpm tsc --noEmit` count unchanged from baseline.

---

## 14. Visual QA expected

Run on `--project=minipay` (390×844) and `--project=desktop` for spot-check only. All comparisons are pixel-diff via Playwright visual snapshots.

| Surface | Expected delta | Notes |
|---|---|---|
| `/hub` first load | **Z2 strip is regenerated and re-baselined.** Subpixel reflow (±2px) below Z2 is acceptable *only if* `.playhub-board-hitgrid` bounding box stays within ±2px. | Snapshot regen is explicit (`--update-snapshots`), reviewed in the PR diff. Never re-baseline blind. |
| `/hub` with piece picker open | Picker open/close cycle unchanged; sheet portal renders at the same z-index as before; no overlap with Z2 trigger. | Functional E2E covers the click; visual snapshot covers the resting state. |
| `/hub` Z3 (board) | DOM order preserved; 64 cells render; piece float layer unchanged. | Asserted by `home-loads.spec.ts`. |
| `/hub` Z4 (action rail) | DOM order and dimensions unchanged. | No interaction with Z2 in this PR. |
| `/hub` Z5 (dock) | Pixel-identical. Dock is invariant per `DESIGN_SYSTEM.md` §8. | If the dock moves by even 1px, the refactor is wrong. |
| `/arena` | Snapshot unchanged. Arena does not adopt the primitive in this PR. | If `/arena` snapshot changes, investigate token leak. |
| Other screens (`/trophies`, `/about`, `/privacy`, `/terms`, `/support`) | Snapshot unchanged. Not migrated in this PR. | Same as `/arena`. |

If `/hub`'s Z3, Z4, or Z5 dimensions drift beyond ±2px, **stop and investigate before regenerating snapshots**. The refactor is supposed to touch Z2 only — drift elsewhere means a layout bug.

---

## Status & next step

Spec drafted. **Awaiting red-team review** (Wolfcito invokes the appropriate review skill or routes to a reviewer). Implementation starts only after review notes are addressed.

— Sally

---

## Amendment log

### Amendment 2026-05-01 — post red-team

Source: `docs/reviews/contextual-header-spec-red-team-2026-05-01.md` (verdict: approve with fixes; 8 P0). Status: **all 8 P0 closed in this amendment.**

| # | P0 finding | Closed by |
|---|---|---|
| 1 | `trailingControl?: ReactNode` did not enforce "max 1" | §4: prop type narrowed to `ReactElement`. Fragments and arrays are now type errors. |
| 2 | `back + modeTabs` mutual exclusion was prose, not type | §4: discriminated union per variant. Mutually exclusive props live on different members. |
| 3 | `back` and `modeTabs` were not gated by variant | §4: same discriminated union eliminates the leak. |
| 4 | `piece-objective` variant violated own variant-explosion mitigation | §7: variant removed. Play-hub canary uses `title-control` with `subtitle`. v1 ships 4 variants, not 5. |
| 5 | Canary embedded sheet inside `trailingControl` | §8: example rewritten to lift open-state to parent and render sheet as sibling. |
| 6 | `mode-tabs` cap of 4 was prose, not type | §4: `options` is `readonly [TabOption, TabOption?, TabOption?, TabOption?]` — tuple-capped. |
| 7 | Acceptance #6 demanded "zero pixel delta" outside Z2 — impossible | §10 #6 + §14: rewritten as DOM-order + functional-footprint preservation with ±2px tolerance on `.playhub-board-hitgrid`. |
| 8 | `MissionDetailSheet` destination was TBD — would have shipped a regression | §8: destination named (Phase-2 piece-picker sub-tab). Canary keeps the sheet rendered as a sibling with explicit TODO. §10 #11 makes preservation an acceptance criterion. |

**Optional / opportunistic fixes also applied:**

- `className?: string` escape hatch removed (§9). Surface tweaks must go through typed props in future versions.
- Dev-mode runtime warnings added (§4) for length caps and trigger width drift.
- Length caps documented in §6.1 (title ≤22, subtitle ≤32, tab label ≤16, back label ≤16).
- Empty / loading state rule added (§6.2): Z2 reserves full height; skeleton chips when content missing; never unmounts mid-screen.
- Sticky default narrowed to `"scroll"` (§4 + §9). `"sticky"` deferred until shell refactor.
- Compile-time tests added to §13 (`tsd` for type-system contracts).
- Acceptance #10 now requires DESIGN_SYSTEM.md docs to ship in **commit #1**, not as a trailing commit.
- Visual QA matrix (§14) replaced with realistic per-zone expectations.
- E2E spec (§13) extended to assert `MissionDetailSheet` reachability post-canary and forbidden-case absence.

**Carried-forward open items (not in this amendment):**

- Focus management for variant transitions (P1-5) — deferred. No screen in v1 swaps variants mid-flow; if one ever does, add a follow-on issue.
- HTML wrapper element + ARIA role (P2-3) — implementer chooses `<header aria-label={...}>` per HTML5 multiple-`<header>` pattern.
- ESLint rule for misuse detection (P2-6) — accepted as risk in §11; promote to commit-time in a follow-on PR.
- `data-component="contextual-header"` runtime marker (P2-7) — included as part of the §13 E2E selector contract; implementer adds the attribute to the wrapper.
- Z1 + Z2 combined budget (P2-10) — added implicitly: Z1 ≤ 40px and Z2 ≤ 64px; combined ceiling 104px noted in `<GlobalStatusBar />` future spec.

**Re-review checkpoint**: this amendment is ready for a 15-minute re-review pass before commit #1 of the implementation plan. Reviewer should verify the discriminated union compiles as claimed (paste the type into a TS playground), the canary example matches the lifted-state pattern, and the visual QA criteria are achievable with current tooling.
