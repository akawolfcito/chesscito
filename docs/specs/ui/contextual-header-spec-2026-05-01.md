# `<ContextualHeader />` — Spec (2026-05-01)

> **Phase**: Phase 2 — first zone primitive.
> **Owner**: Wolfcito. UX advisor: Sally (BMad).
> **Status**: Draft. Awaiting red-team review before implementation.
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
  title="Move to h1"
  subtitle="Rook"
  trailingControl={<PiecePickerTrigger />}
  back={null}
  modeTabs={null}
  ariaLabel="Mission header"
/>
```

The component is **framework-agnostic styling-wise** (Tailwind + design tokens, no third-party UI lib) and **headless behaviorally** — it renders structure and applies the canonical Z2 height/padding/border, but does not own state. State (open/close pickers, change mode) lives in callers.

---

## 4. Props

```ts
type ContextualHeaderVariant =
  | "title"           // (1) screen title only
  | "title-control"   // (2) title + 1 trailing control (chip or button)
  | "piece-objective" // (3) piece chip + objective subtitle (play-hub canary)
  | "mode-tabs"       // (4) segmented mode tabs (max 4)
  | "back-control";   // (5) back button + 1 trailing control

interface ContextualHeaderProps {
  /** Required. Selects layout variant. */
  variant: ContextualHeaderVariant;

  /** Visible heading. Required for "title", "title-control", "back-control". */
  title?: string;

  /** Optional descender below the title, single line, truncated.
   *  Used in "piece-objective" as the objective ("Move to h1"). */
  subtitle?: string;

  /** ONE optional trailing control. Cap is enforced by type — single ReactNode,
   *  not array. Allowed children: chip, icon-button, label-pill. */
  trailingControl?: ReactNode;

  /** Optional back button. When provided, renders left-aligned, 44×44 hit area.
   *  Mutually exclusive with "piece-objective" and "mode-tabs" variants. */
  back?: { onClick: () => void; label: string } | null;

  /** Mode tabs row, used by "mode-tabs" variant. Max 4 entries (typed cap). */
  modeTabs?: {
    activeKey: string;
    options: ReadonlyArray<{ key: string; label: string }>; // length ≤ 4
    onChange: (key: string) => void;
  };

  /** Required for a11y. Announces the header purpose to assistive tech. */
  ariaLabel: string;

  /** Optional. Pin to the top (sticky) or scroll away. Defaults to "sticky". */
  sticky?: "sticky" | "scroll";

  /** Optional className override for surface tweaks. Internal padding/height
   *  cannot be overridden. */
  className?: string;
}
```

**Rules enforced by the type system:**

- `trailingControl` is a single `ReactNode`, never an array. Three controls in Z2 is a code smell; the type forbids it.
- `modeTabs.options.length` is constrained to ≤4 in runtime (assertion in dev) and documented in the type comment.
- `back + modeTabs` together is illegal. Caller must pick one.

---

## 5. Allowed slots

| Slot | Variants where allowed | Allowed children | Forbidden children |
|---|---|---|---|
| `title` (text) | title, title-control, back-control | string only | JSX, icons, links |
| `subtitle` | title-control, piece-objective | string only | JSX |
| `trailingControl` | title-control, piece-objective, back-control | `<Chip>`, `<IconButton>`, `<LabelPill>` (max 1) | full buttons with text labels, anchors, raw `<button>` |
| `back` | back-control | structured object `{onClick, label}` | raw JSX |
| `modeTabs` | mode-tabs | structured object | raw JSX |

**A component is "allowed" in `trailingControl` if and only if** it is ≤44px wide, has a clear single intent, and opens a Type-C quick-picker (per `DESIGN_SYSTEM.md` §8). Anything that opens a Type-B destination sheet belongs in the dock, not Z2.

---

## 6. Forbidden cases

- **No primary CTAs in Z2.** Submit, mint, claim, retry — these are Z4. Z2 hosts pickers and tabs only.
- **No floating overlays anchored to Z2.** Pickers open as Type-C sheets (full-width bottom sheet) or Type-B destination sheets, not as popovers attached to the header.
- **No monetization in Z2.** PRO promo, shop teasers, achievement nags — none. Z2 is local context only.
- **No nested headers.** A screen has at most one Z2 strip. If a sub-section needs its own header (e.g. inside a Type-B sheet), that sheet renders its own header — but it is not a `<ContextualHeader />` instance; it's a sheet header (separate primitive, future spec).
- **No icon-only labels.** `aria-label` is required and surfaced visibly when the variant uses a chip; no decorative-only icons in Z2.
- **No timers, no streaks, no live counters.** Those live in Z1 (passive identity) or in dedicated content cards (Z3). Z2 is static for the duration of the screen.
- **No more than one trailing control.** Hard-typed; not enforced by convention.

---

## 7. Variants

### 7.1 `title` — screen title only

Used on screens with no controls in Z2 (e.g. `/about`, `/privacy`, `/terms`, `/support`). Single line, centered or left-aligned per `DESIGN_SYSTEM.md` typography rules.

```tsx
<ContextualHeader variant="title" title="About" ariaLabel="About header" />
```

### 7.2 `title-control` — title + 1 trailing control

Generic case. Title left, optional subtitle below, optional ONE trailing control right-aligned.

```tsx
<ContextualHeader
  variant="title-control"
  title="Trophies"
  trailingControl={<FilterChip />}
  ariaLabel="Trophies header"
/>
```

### 7.3 `piece-objective` — piece chip + objective subtitle (play-hub canary)

The current play-hub `mission-panel-candy.tsx:276` block becomes this variant. Piece chip is the trailing control; objective is the subtitle.

```tsx
<ContextualHeader
  variant="piece-objective"
  title="Rook"
  subtitle="Move to h1"
  trailingControl={<PiecePickerTrigger />}
  ariaLabel="Mission header"
/>
```

### 7.4 `mode-tabs` — segmented mode tabs (max 4)

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

### 7.5 `back-control` — back button + 1 trailing control

Used on Type-A overlays and deep nav (e.g. arena post-game review). Back is left, optional trailing control is right.

```tsx
<ContextualHeader
  variant="back-control"
  title="Game Review"
  back={{ onClick: () => router.back(), label: "Back" }}
  trailingControl={<ShareIconButton />}
  ariaLabel="Game review header"
/>
```

---

## 8. First use in `/play-hub`

The canary integration lives in `apps/web/src/components/play-hub/mission-panel-candy.tsx`. The current inline block (the `<div className="shrink-0 mx-2 mt-2 flex items-center gap-2">` around line 276) gets replaced by:

```tsx
<ContextualHeader
  variant="piece-objective"
  title={PIECE_LABELS[selectedPiece]}
  subtitle={objectiveLabel}
  trailingControl={
    <PiecePickerSheet
      open={piecePickerOpen}
      onOpenChange={setPiecePickerOpen}
      selectedPiece={selectedPiece}
      pieces={pieces}
      onSelectPiece={onSelectPiece}
      trigger={pieceChip}
    />
  }
  ariaLabel="Mission header"
/>
```

The `MissionDetailSheet` button currently rendered alongside the piece chip is **NOT brought into Z2**. It is reclassified per the zone-map decision record §2: mission detail is a **dock-adjacent destination sheet** (Type B), not a Z2 trailing control. Phase 2 follow-up commit moves it to a different surface (TBD: dock submenu or Z4 secondary). This spec does not solve it.

---

## 9. What this primitive does NOT do

- **Does not own state.** Pickers, tabs, and back-button targets are controlled by callers.
- **Does not handle scroll behavior beyond `sticky` vs `scroll`.** No collapse-on-scroll, no parallax, no header-shrink animation. If a screen needs that, it's a different primitive.
- **Does not migrate other screens.** Spec covers the play-hub canary only. Arena, missions, badges, secondary pages are follow-up commits, each with their own visual QA pass.
- **Does not replace the dock.** Z5 is sacred per `DESIGN_SYSTEM.md` §8. Nothing in this primitive talks to the dock.
- **Does not introduce new copy.** All strings come from `editorial.ts` (`PIECE_LABELS`, `CTA_LABELS`, etc.). No new keys added by this primitive itself.
- **Does not solve the Daily Tactic + Mini Arena bridge unification.** That is the "Z2 challenges row" — a separate sub-row treatment, deferred to a later Phase 2 commit (after this primitive lands).
- **Does not solve the PRO chip split.** That depends on `<GlobalStatusBar />` (Z1) for the active-state ring and on `<ContextualActionRail />` (Z4) for the inactive-state promo card. Out of scope here.

---

## 10. Acceptance criteria

The primitive is "done" when **all** of the following hold:

1. `apps/web/src/components/ui/contextual-header.tsx` exists, exports `<ContextualHeader />` and the prop types.
2. All 5 variants render at 390×844 (minipay viewport) with correct height (52–64px) and padding.
3. The primitive consumes existing design tokens (`--surface-*`, `--text-*`, `--space-*`); no new tokens introduced.
4. The play-hub canary uses the primitive; the inline `<div>` block in `mission-panel-candy.tsx` is removed.
5. The piece picker still opens correctly from the chip (no regression in `<PiecePickerSheet>` open/close flow).
6. Visual QA: `pnpm test:e2e:visual --project=minipay` shows the play-hub snapshot updated (delta is bounded — only the Z2 strip changes; everything below is identical pixel-for-pixel).
7. Unit tests for the primitive cover all 5 variants, the `back + modeTabs` mutual exclusion (compile-time error case is acceptable), and the `modeTabs.options.length ≤ 4` runtime guard.
8. No new TS errors introduced (`tsc --noEmit` count unchanged from baseline at branch tip).
9. Existing E2E suite (`pnpm test:e2e --project=minipay`) is green: `floating-actions-vs-dock`, `home-loads`, `dock-anchor` all pass.
10. The primitive is documented in `DESIGN_SYSTEM.md` §10 as the canonical Z2 component, with a "first consumer: play-hub" note.

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Variant explosion** — future screens demand a 6th variant, then a 7th | Medium | High | Hard rule: any new variant requires a written justification in the spec PR, signed off by Wolfcito. If 3+ screens want "almost variant X but slightly different," that's a missing primitive elsewhere (e.g. `<SheetHeader />`), not a new Z2 variant. |
| **Caller bypasses the primitive** for "just this one screen" | Medium | Medium | Add ESLint rule (or grep CI check) that flags raw `<header>` and `<div className="...mission-shell-header...">` patterns inside `apps/web/src/app/**/page.tsx`. Discourage drift via review checklist. |
| **Sticky behavior fights iOS rubber-band scroll** in MiniPay WebView | Low | Medium | Default `sticky="sticky"` uses `position: sticky; top: env(safe-area-inset-top)`, not `position: fixed`. Tested on Pixel 5 viewport during Phase 1; minipay-specific QA pass before merging the canary. |
| **Z2 strip + Z1 strip together exceed 100dvh - dock - board** on small viewports (Pixel 4 = 854px) | Low | Medium | Both strips have hard height caps (40px Z1, 64px Z2 max). Combined ceiling is 104px; minus 72px dock = 932px / 200px header overhead leaves >600px for board even on 800px-tall devices. Visual QA at 360×640 confirms. |
| **`trailingControl` slot accepts unintended children** (e.g. someone passes a `<Button>` with text + icon) | Medium | Low | Type narrows to a documented set in JSDoc. Runtime warning in dev when child width >44px or child is `<button>` with `>16ch` text. |
| **Reducing Z2 to a primitive ossifies the layout** before we know all the cases | Low | Medium | Spec is intentionally narrow — 5 variants, no animations, no scroll behaviors. Any pressure to expand goes through the variant-explosion mitigation above. |
| **Migration churn** — moving every screen to the primitive is a 5+ commit PR | High | Low (mechanical) | Spec scopes implementation to play-hub canary only. Other screens migrate one-per-commit in follow-up PRs, never as a bulk drop-in replacement. |

---

## 12. Implementation plan — by commit

Each commit is one logical change. Run full unit + e2e suite before each. Commits are reversible independently. Conventional Commits + `Wolfcito 🐾 @akawolfcito` footer.

1. **`feat(ui): add ContextualHeader primitive (title + title-control variants)`**
   - New file `apps/web/src/components/ui/contextual-header.tsx`.
   - Exports component + types, with only the simplest 2 variants implemented.
   - Unit tests for both variants.
   - No callers wired yet.

2. **`feat(ui): add ContextualHeader piece-objective variant`**
   - Adds the variant used by play-hub.
   - Unit test for the variant.
   - Still no callers wired.

3. **`refactor(play-hub): adopt ContextualHeader for piece chip + objective`**
   - Replaces the inline `<div>` in `mission-panel-candy.tsx`.
   - Updates the existing piece-picker integration.
   - Visual QA snapshot: regenerate `play-hub` snapshot with `--update-snapshots`; review the diff.
   - This is the canary commit.

4. **`feat(ui): add ContextualHeader mode-tabs and back-control variants`**
   - Adds the 2 remaining variants.
   - Unit tests for both.
   - Runtime guard for `modeTabs.options.length ≤ 4`.

5. **`docs(design-system): document ContextualHeader as canonical Z2`**
   - Append to `DESIGN_SYSTEM.md` §10.
   - Cross-link this spec.
   - Add the first-consumer note.

**Stop here. Do NOT migrate other screens in this PR.** Arena, missions, badges, secondary pages each get their own dedicated PR after this one merges, so visual QA on each migration is isolated and reviewable.

---

## 13. Tests expected

### Unit (vitest + RTL)

- **File**: `apps/web/src/components/ui/__tests__/contextual-header.test.tsx`.
- One test block per variant (5 blocks).
- Each block asserts: variant renders, expected slots present, height/padding tokens applied.
- **`piece-objective` block** asserts the trailing control opens correctly when clicked (RTL `userEvent.click` on the chip → `onOpenChange` callback fires).
- **`mode-tabs` block** asserts: 4 options render; clicking a tab fires `onChange` with the right key; a 5th option triggers a dev-mode `console.warn` (or compile error if we go the readonly-tuple route — TBD during impl).
- **`back-control` block** asserts: back button is present, has 44×44 hit area, fires `onClick`.
- **A11y test** per variant: `ariaLabel` is on the right element; back button has `aria-label`; chips have visible labels.

### Integration / E2E (Playwright)

- **Existing**: `apps/web/e2e/home-loads.spec.ts` and `apps/web/e2e/floating-actions-vs-dock.spec.ts` must continue to pass (regression bound).
- **New**: `apps/web/e2e/contextual-header.spec.ts` (1 spec) — opens `/hub`, asserts the Z2 strip is visible, asserts piece chip is clickable and opens the picker, asserts no element from forbidden cases (no live timer in Z2, no monetization chip in Z2) is rendered.

### Type-check

- `pnpm tsc --noEmit` count unchanged from baseline.

---

## 14. Visual QA expected

Run on `--project=minipay` (390×844). All comparisons are pixel-diff via Playwright visual snapshots.

| Surface | Expected delta | Notes |
|---|---|---|
| `/hub` first load | Z2 strip pixel-for-pixel matches the previous inline implementation | The piece chip + objective should look identical post-refactor. If the snapshot diff exceeds ~3% on the Z2 strip, stop and align tokens before regenerating. |
| `/hub` with piece picker open | Identical | Picker open/close path unchanged. |
| `/hub` other zones (Z1, Z3, Z4, Z5) | Zero pixel delta | The primitive only owns Z2; everything else is byte-identical. |
| `/arena` | Zero pixel delta | Arena does not adopt the primitive in this PR. |
| Other screens (`/trophies`, `/about`, etc.) | Zero pixel delta | Not migrated in this PR. |

If the play-hub snapshot has any delta outside the Z2 strip, the refactor is wrong — investigate before regenerating.

---

## Status & next step

Spec drafted. **Awaiting red-team review** (Wolfcito invokes the appropriate review skill or routes to a reviewer). Implementation starts only after review notes are addressed.

— Sally
