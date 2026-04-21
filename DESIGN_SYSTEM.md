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
