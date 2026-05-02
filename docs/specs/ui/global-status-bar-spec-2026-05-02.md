# `<GlobalStatusBar />` — Spec (2026-05-02)

> **Phase**: Phase 2 — second zone primitive (Z1).
> **Owner**: Wolfcito. UX advisor: Sally (BMad).
> **Status**: **v0 — draft, awaiting red-team review.** No commits yet.
> **Source brief**: `docs/reviews/ui-zone-map-decision-record-2026-05-01.md` §1 + §2 (PRO chip row) + §5.1 (Z1 primitive carry-forward) + `DESIGN_SYSTEM.md` §10.1 + §10.6 (Z1 + Z2 combined budget).
> **Related primitives**: `<ContextualHeader />` (Z2, shipped `fda38a0` + canary `24ac2ef`), `<ContextualActionRail />` (Z4, future).

---

## 1. Problem this solves

Z1 today is **squatted, not owned**. Three concrete symptoms:

- The "GET PRO" chip lives at `apps/web/src/components/play-hub/play-hub-root.tsx:1120` as an `absolute z-30 top-right` `<div>` wrapping `<ProChip>`. It's pinned to `/play-hub` only. Other screens (`/arena`, `/trophies`, `/leaderboard`, secondary pages) have **no identity strip at all** — the user has no persistent "who am I" anchor.
- The Z2 canary (`mission-panel-candy.tsx:266`) carries `mr-[140px]` to clear that absolute chip. The reservation is documented as transitional debt — Phase 2 destination explicitly named: "move PRO chip into `<GlobalStatusBar />`."
- There is no shared rule for handle / wallet / role display. A future "show user is connected" requirement would land as another inline JSX block, repeating the ad-hoc pattern that Z2 just escaped.

Z1 is the **most-trusted horizontal band** of every Chesscito screen — it's where the player checks "am I logged in, am I PRO, am I myself" between exercises. It must be a primitive, not a screen-local pattern. Per `DESIGN_SYSTEM.md` §10.1 it owns: handle, level, streak, **PRO state as passive ring**. Per §10.2 invariant 4: monetization **never** lives in Z1.

---

## 2. Zone ownership: Z1

Per `ui-zone-map-decision-record-2026-05-01.md` §1 and `DESIGN_SYSTEM.md` §10.1:

| Property | Value |
|---|---|
| Zone | **Z1** (Global Status Bar) |
| Height | 32–40px (v1 fixes to **36px content + safe-area-inset-top**; total ≤ 40px below the system status bar) |
| Visibility (target invariant) | Every primary Chesscito screen should eventually render Z1. **v1 canary mounts it only on `/play-hub`**; other primary screens migrate one per commit after canary validation. Exceptions to the eventual invariant: System Modals (Type D), splash screens, and any flow where dock visibility itself is suspended (e.g., `/arena` mid-match — to be confirmed in that screen's migration commit). |
| Stack position | Top of `<main>`. Above Z2 (`<ContextualHeader />`). |
| z-index | **10** (per `globals.css` ladder; same band as Z2 — both scroll with the document, stacked by DOM order). |

**Z1 answers exactly two questions and nothing else:**
1. *Who is the player?* (identity)
2. *Is the player a PRO?* (premium state, passive)

Z1 does **not** answer "what screen am I on" (Z2), "what should I do next" (Z4), or "where can I go" (Z5).

---

## 3. Non-goals (what Z1 is NOT)

- **No CTAs.** No "Connect", no "Buy", no "Renew", no "Claim". Conversion lives in Shop (Type-B), Z4 (contextual offer), or System Modal (Type-D).
- **No PRO inactive promo.** Per `DESIGN_SYSTEM.md` §10.2 invariant 4. PRO inactive users see the strip with no gold ring — that's the entire visual difference. Conversion is reached from Shop / Z4 contextual card.
- **No live timers, no streaks, no game state.** Per Z2 spec §6 (forbidden cases) — the same rule applies harder in Z1. Game session state belongs in Z3/Z4.
- **No level / progress bar / star count.** Not because they're forbidden in Z1 conceptually, but because **the data system doesn't exist yet**. Chesscito tracks `totalStars` per piece, not a unified "player level". Inventing a level system inside a layout primitive is a product decision, not a layout one. v2+ may add a `level` slot through a new variant, after a product spec defines the level math.
- **No wins streak.** Same reason as level — the only `currentStreak` in editorial is the Coach Daily Tactic streak, **scoped to the Coach daily-puzzle loop, not a global player state**. Surfacing it in Z1 would mislead users into reading it as a combat streak. Defer until a real global-streak data system is specified.
- **No currency / gems / resources.** No global currency exists.
- **No notifications inbox, no settings gear, no network indicator.** Each is its own surface; none belongs on the most-trusted strip.
- **No `className` escape hatch.** Surface tweaks go through typed props only. Same rule as `<ContextualHeader />` v1.
- **No mid-screen mount/unmount.** Z1 reserves its full height for the lifetime of every screen render. Loading state uses skeletons, never collapse.
- **No nested status bars.** A screen has at most one Z1.
- **No avatar uploader / selector.** v1 uses a generic candy chess-piece silhouette for every connected user. Per-user avatars are a future feature.
- **No in-bar PRO management UI.** v1 keeps a single tap on the PRO indicator → opens `<ProSheet>` **purely to preserve the existing renew flow during transition** (see §6.1 debt tracker, §16 reviewer Q2). The tap **does not** mean Z1 is a conversion surface — it only means we won't ship a renew regression. Strict-passive Z1 is the post-debt target.

---

## 4. Proposed component API

```tsx
import { GlobalStatusBar } from "@/components/ui/global-status-bar";

// Anonymous — no wallet connected.
<GlobalStatusBar variant="anonymous" />

// Connected — wallet present, PRO status known.
<GlobalStatusBar
  variant="connected"
  identity={{ walletShort: "0x1234…abcd" }}
  proStatus={{ active: true, expiresAt: 1735689600000 }}
  isProLoading={false}
  onProTap={() => setProSheetOpen(true)}
/>

// Connected with handle (ENS / Talent Protocol resolves later)
<GlobalStatusBar
  variant="connected"
  identity={{ handle: "wolfcito.eth", walletShort: "0x1234…abcd" }}
  proStatus={{ active: false, expiresAt: null }}
  isProLoading={false}
  onProTap={() => setProSheetOpen(true)}
/>
```

Like `<ContextualHeader />`, this primitive is **headless behaviorally** — it renders the canonical Z1 layout, height, padding, and surfaces. It owns no fetch, no state, no router calls. Data flows in via structured props; tap intent flows out via `onProTap`. PRO data fetch stays where it is today (`useProStatus` hook called by the parent).

**Why structured props (not `ReactElement` slots)?** Z1 must be **uniform across every screen.** Allowing `<ReactElement>` injection would re-introduce the per-screen drift that motivated this primitive. The primitive owns layout; callers own data only.

---

## 5. Type contract (compile-time enforced)

```ts
import type { ProStatus } from "@/lib/pro/use-pro-status";

export type GlobalStatusBarProps = AnonymousProps | ConnectedProps;

export type AnonymousProps = {
  variant: "anonymous";
  ariaLabel?: string;
};

export type ConnectedProps = {
  variant: "connected";
  identity: ConnectedIdentity;
  /** null while loading. After resolution it is always a ProStatus
   *  object — `useProStatus` already coerces network errors to
   *  `{ active: false, expiresAt: null }`. */
  proStatus: ProStatus | null;
  isProLoading: boolean;
  /** Required in v1 (transitional). Becomes optional / removed when
   *  Shop ships its PRO sub-section and this tap target is retired.
   *  See §6, §16. */
  onProTap: () => void;
  ariaLabel?: string;
};

export type ConnectedIdentity = {
  /** Future: ENS / Talent Protocol / on-chain handle.
   *  v1 always omits — only walletShort renders. */
  handle?: string;
  /** Truncated `0x` address — required when connected.
   *  Format: `0x` + 4 hex + `…` + 4 hex. Total visible length ≤ 11. */
  walletShort: string;
  /** Future. v1 uses the default candy silhouette. */
  avatarUrl?: string;
};
```

**Contracts the type system enforces (no longer prose-only):**

- `proStatus`, `isProLoading`, and `onProTap` exist **only** on `ConnectedProps`. On `variant: "anonymous"`, passing them is a TS error.
- `identity` exists **only** on `ConnectedProps`. On `variant: "anonymous"`, identity is internal (default Guest silhouette + label).
- `ariaLabel` is optional on both members; the component derives a default when omitted.
- The discriminated union prevents the impossible state "connected without identity" — `walletShort` is required on the connected branch.
- No `className` prop. Surface tweaks must propose a typed prop in a future amendment.

**What v1 does NOT enforce at the type level (deferred to runtime guards / future variants):**

- `walletShort` format (`0x[a-f0-9]{4}…[a-f0-9]{4}`) — runtime warning only. A truncation helper from `@/lib/wallet/format` will produce the canonical shape; manual misuse warns in dev.
- `handle` length (≤ 14 visible characters) — runtime warning + ellipsis past cap.

---

## 6. Runtime guards (dev-mode `console.warn`)

All wrapped in `process.env.NODE_ENV !== "production"`:

| Trigger | Warning | Why |
|---|---|---|
| `identity.handle.length > 14` | "GlobalStatusBar: handle exceeds 14 chars; truncating with ellipsis." | Handle pill must remain ≤ ~140px wide; longer handles break the Z1+Z2 budget. |
| `identity.walletShort` does not match `/^0x[a-f0-9]{4}…[a-f0-9]{4}$/i` | "GlobalStatusBar: walletShort should be `0xABCD…1234` shape." | Catches manual `address.slice(0, 6)` patterns that produce inconsistent truncations. |
| `proStatus.expiresAt && proStatus.expiresAt < Date.now()` AND `proStatus.active === true` | "GlobalStatusBar: stale PRO status — expiresAt < Date.now() but active=true." | Catches downstream cache-invalidation bugs without crashing the UI. |
| Z1 wrapper rendered DOM height > 40px | "GlobalStatusBar: rendered height exceeds Z1 budget (40px)." | Caught via `getBoundingClientRect` after layout, throttled to once per mount. Prevents ad-hoc styling drift from blowing the Z1+Z2 ≤ 104px combined budget. |
| Same screen mounts more than one `<GlobalStatusBar />` | "GlobalStatusBar: duplicate instance detected at <selector>." | Catches accidental nesting (e.g., a Type-B sheet importing the primitive). Tracked via `data-component="global-status-bar"` + a development-only mount counter. |

Production cost: 0. The development guards are dead-code-eliminated by the bundler.

### 6.1 Transitional debt tracker (visible, dated)

The items below are **explicit, dated debts**. Each must close on or before its trigger; reviewers are expected to flag this section in any future PR that touches Z1.

| Debt | Where | Resolution trigger | Hard deadline |
|---|---|---|---|
| **`onProTap` exists in `ConnectedProps`.** Z1 is not strictly passive yet — the tap target preserves the existing renew flow only because Shop has no PRO sub-section yet. **`onProTap` is NOT a green light to add other taps to Z1.** | Type union (`ConnectedProps`) + `<ProSheet>` open call in `play-hub-root.tsx`. | Shop ships a "PRO" sub-section (Type-B destination) — at that moment: (a) drop `onProTap` from the type, (b) drop the tappable hit area on the PRO indicator, (c) flip Z1 to strictly passive, (d) update DESIGN_SYSTEM.md §10.7. | **60 days from the canary deploy date OR Shop PRO sub-section ships, whichever comes first.** If 60 days elapse without resolution, escalate to Wolfcito for explicit re-approval; do not let the debt drift silently. |
| Z1 mounted on `/play-hub` only in v1 (not on `/arena`, `/trophies`, `/leaderboard`, secondary). | Per-screen migration is **out of scope** for the canary commit. | Per-screen follow-on commits. Same pattern as `<ContextualHeader />` migration. Each commit has its own visual QA. | No hard deadline; track in `DESIGN_SYSTEM.md` §10.7 carry-forward table. |
| No real avatar — every connected user sees the candy silhouette. | Default in component. | Shipped as a future spec (avatar provider, ENS / Talent / Farcaster resolution, IPFS pinning). Not a Z1 primitive concern. | No hard deadline. |
| The legacy `ProChip` component file (`apps/web/src/components/pro/pro-chip.tsx`) **survives in the codebase** for one commit after canary, then is deleted. | Source file only — **NOT rendered alongside Z1**. See §10 and §15 commit #2 / #3. | Canary verification confirms no regression. | Commit #3 of the implementation plan (§15). |

### 6.2 Empty / loading state

- Z1 **always reserves its full height** (36px content + safe-area top) for the lifetime of the screen, including before wallet resolution.
- When variant is `connected` but `proStatus === null` (loading), render a skeleton circle in the PRO slot at the chip's resting size (28×28). Identity pill renders normally.
- When wallet is still resolving (wagmi `isConnecting`), parent must mount `<GlobalStatusBar variant="anonymous" />` to keep layout stable. Once the wallet resolves, parent flips to `variant="connected"` — Z1 itself does not transition variants mid-render.
- The primitive **never unmounts itself** based on loading state. Callers control whether the screen renders Z1 at all (via conditional render at the screen root); once mounted, Z1 stays mounted.

---

## 7. Accessibility

- The primitive's wrapper element is `<header role="banner" aria-label={ariaLabel ?? defaultLabel}>`.
- `defaultLabel` is `"Player status"` for `connected` and `"Anonymous status"` for `anonymous` (defined in `editorial.ts` as `GLOBAL_STATUS_BAR_COPY.ariaLabelConnected` / `.ariaLabelAnonymous`).
- The PRO indicator (when tappable per §6.1 transitional debt) is a `<button type="button">` with `aria-label="Manage Chesscito PRO"` (existing copy from `PRO_COPY.label`). When PRO is inactive, the button still renders so the hit region stays stable; its `aria-label` becomes `"View Chesscito PRO"`.
- The handle pill is text-only, not interactive. Wallet truncation reads naturally to screen readers because the `…` is between two `0x` segments — no special `aria-label` needed.
- Avatar (silhouette) is `aria-hidden="true"` (decorative).
- `data-component="global-status-bar"` on the wrapper for E2E selectors and the duplicate-instance dev guard.

---

## 8. Loading / empty / error states

| State | Render |
|---|---|
| **Anonymous (no wallet)** | Silhouette + handle pill text "Guest". No PRO indicator slot. |
| **Connected, PRO loading (`proStatus === null`)** | Identity pill normal. PRO slot = 28×28 skeleton circle (`animate-pulse bg-white/30`). |
| **Connected, PRO resolved active** | Identity pill with **gold ring** (token reused or, if missing, new `--pro-ring-gold` — see §11 acceptance #3). PRO slot = compact "PRO • Nd" pill, gold treatment, mirrors current active visual. |
| **Connected, PRO resolved inactive** | Identity pill, **no ring**. PRO slot is **intentionally quiet**: no ring, no gradient, no promotional copy, no "Get PRO" affordance. Render a small muted/outline `PRO` status affordance only while the `onProTap` transitional debt exists (see §6.1). Treatment options: low-contrast text + thin outline (`text-white/40 ring-1 ring-white/15`), tuned during visual QA so it reads as *passive status* rather than *call to action*. When strict-passive Z1 lands (debt closed), the inactive pill is removed entirely and the slot collapses. |
| **Connected, PRO API error** | Same as inactive. `useProStatus` already coerces errors to `{ active: false, expiresAt: null }`. No error chip in Z1. |
| **Wallet disconnect mid-session** | Parent flips to `variant="anonymous"`. Z1 re-renders with Guest. No animation v1. |

**Hard rule**: in every state above, the wrapper element keeps the same height. No state collapses Z1.

---

## 9. Visual layout (390×N viewport)

```
┌─ Z1 (36px content + safe-area-inset-top) ────────────────────────────┐
│ ┌──┐ Guest                                                           │  ← anonymous
│ └──┘                                                                 │
└──────────────────────────────────────────────────────────────────────┘

┌─ Z1 ─────────────────────────────────────────────────────────────────┐
│ ┌──┐ 0x1234…abcd                              ┌─ PRO • 28d ─┐        │  ← connected, active
│ └◉─┘ (gold ring on avatar)                    └─────────────┘        │
└──────────────────────────────────────────────────────────────────────┘

┌─ Z1 ─────────────────────────────────────────────────────────────────┐
│ ┌──┐ 0x1234…abcd                                       ·pro·         │  ← connected, inactive (quiet)
│ └──┘                                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

- **Left cluster**: avatar (28×28, candy silhouette) + handle pill (text, ≤ 14 chars). Total left cluster ≤ 180px wide.
- **Right cluster**: PRO indicator. **Active state** is gold and prominent (28×28 to ~110×28). **Inactive state is intentionally muted** — outline-only, low-contrast text, no gradient, no promotional copy. The ASCII above sketches the visual hierarchy: active = bold, inactive = whisper. The inactive treatment exists *only* while `onProTap` is transitional debt; once strict-passive Z1 lands the inactive cluster collapses entirely.
- **Center**: empty by design — Z1 has no center slot in v1. Keeps the strip airy and reduces visual competition for the eye.
- **Padding**: `px-2 py-1`. Safe-area handling on top via `pt-[calc(env(safe-area-inset-top)+0.25rem)]`.
- **Background**: transparent (Z1 sits on the same atmosphere as Z2/Z3). No background panel.

---

## 10. First use in `/play-hub` (canary plan)

The canary integration replaces the current absolute-positioned PRO chip wrapper at `play-hub-root.tsx:1120` with a normal-flow `<GlobalStatusBar />` rendered above `<MissionPanelCandy>`.

```tsx
// In play-hub-root.tsx (~line 1119)
return (
  <div className="relative w-full overflow-x-hidden">
    <WelcomeOverlay suppressed={activeDockTab !== null || proSheetOpen} />
    {showSplash && <Splash />}
    <main className="mission-shell relative mx-auto h-[100dvh] w-full max-w-[var(--app-max-width)] px-0 py-0 sm:px-0 flex flex-col">
      {/* Z1 — was: absolute z-30 wrapper around <ProChip>. Now: normal-flow header. */}
      {address ? (
        <GlobalStatusBar
          variant="connected"
          identity={{ walletShort: shortAddress(address) }}
          proStatus={proStatus}
          isProLoading={proLoading}
          onProTap={() => setProSheetOpen(true)}
        />
      ) : (
        <GlobalStatusBar variant="anonymous" />
      )}

      <MissionPanelCandy
        // ... same props as today
        // mission-panel-candy.tsx Z2 wrapper drops mr-[140px] in the same canary commit.
      />
    </main>
  </div>
);
```

**Key contract changes vs current state:**

1. **PRO chip moves out of `absolute z-30`** into normal flow inside Z1. The `pointer-events-none absolute right-2 top-...` wrapper at `play-hub-root.tsx:1120` is deleted in the canary commit.
2. **`<ProChip>` is NOT rendered alongside `<GlobalStatusBar />`.** No double-PRO state on screen. The legacy `<ProChip>` import is removed from `play-hub-root.tsx` in the same canary commit. The component **file** survives in the codebase for one commit (commit #3 in §15) only as a rollback safety net; it is not imported, not mounted, not referenced from any other module.
3. **`MissionPanelCandy`'s `mr-[140px]` reservation** at `mission-panel-candy.tsx:266` drops in the same canary commit. The TODO comment is removed.
4. **State stays at the parent.** `useProStatus(address)` continues to live in `play-hub-root.tsx`; Z1 receives `proStatus`, `isProLoading`, `onProTap` as props. No fetch logic moves into the primitive.
5. **`/arena`, `/trophies`, `/leaderboard`, secondary pages do NOT mount Z1 in this PR.** Each screen migrates in its own follow-on commit, with its own visual QA. The target invariant (Z1 on every primary screen) is documented in §2 and DESIGN_SYSTEM.md §10.7 carry-forward; v1 canary explicitly does not enforce it.

---

## 11. Acceptance criteria

The primitive is "done" when **all** of the following hold:

1. `apps/web/src/components/ui/global-status-bar.tsx` exists, exports `<GlobalStatusBar />` and the discriminated-union types from §5.
2. Both **2 variants** (`anonymous`, `connected`) render at 390×844 (minipay viewport) with correct height (36px content + safe-area top; total ≤ 40px).
3. The primitive consumes existing design tokens (`--surface-*`, `--text-*`). For the PRO active gold ring, **search for an existing gold token first** — `globals.css` already exposes `--redesign-wood-gold: #FDD257` (candy wood gold), `--color-label-gold` (muted label gold), and `--text-shadow-hero-amber`. **Reuse `--redesign-wood-gold` if visual QA confirms it matches the target hue/contrast for a passive identity ring.** If reuse is rejected during implementation review (e.g., the candy gold is too warm against a connected silhouette), only then add a new typed `--pro-ring-gold` and document it in `DESIGN_SYSTEM.md` §1. Either way, the chosen token is a single semantic name — no inline `#FDD257` literals in the component.
4. The play-hub canary uses the primitive; the absolute-z-30 PRO chip wrapper at `play-hub-root.tsx:1120` is removed, and `mission-panel-candy.tsx:266` `mr-[140px]` is dropped.
5. `<ProSheet>` still opens correctly when the PRO indicator is tapped — open/close state is owned by `play-hub-root.tsx`, not by the primitive (no regression in `<ProSheet>` flow).
6. **Visual QA** (`pnpm test:e2e:visual --project=minipay`): the Z1 strip snapshot is regenerated and re-baselined deliberately; **Z2, Z3, Z4, Z5 keep the same DOM order and functional footprint**; subpixel reflow (±2px) caused by Z1 inserting in normal flow is acceptable below Z1 *only if* `.playhub-board-hitgrid` keeps its bounding box within ±2px of baseline. Snapshot regeneration is explicit (`--update-snapshots`), reviewed in PR diff.
7. Unit tests cover both variants + all four PRO states (loading, active, inactive, anonymous-no-pro). Type-system contracts (e.g., `proStatus` outside `connected`, missing `walletShort` on `connected`) are validated by commented-out fixtures (project has no `tsd` library; same convention as `<ContextualHeader />`).
8. No new TS errors introduced (`pnpm tsc --noEmit` count unchanged from baseline at branch tip).
9. Existing E2E suite (`pnpm test:e2e --project=minipay`) is green: `floating-actions-vs-dock`, `home-loads`, `dock-anchor`, `contextual-header` all pass; new `global-status-bar.spec.ts` passes (see §13).
10. The primitive is documented in `DESIGN_SYSTEM.md` §10.7 as the canonical Z1 component, with a "first consumer: play-hub" note. Docs ship in the **same commit** as the primitive — never as a trailing commit.
11. The Z1 + Z2 combined budget invariant is codified in `DESIGN_SYSTEM.md` §10.1 in the same commit: "Z1 ≤ 40px, Z2 ≤ 64px, combined ≤ 104px."

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Variant explosion** — future screens demand a `connected-with-level`, `connected-with-streak`, `connected-with-currency` variant | Medium | High | Hard rule: any new variant requires a written justification in a spec PR + product spec for the underlying data system (level / streak / currency). If 3+ screens want a slot, that slot lives in the existing `connected` variant via a typed prop, not a new variant. Variants are reserved for **structural** layout differences (e.g., `anonymous` vs `connected`), not data-source differences. |
| **`onProTap` becomes load-bearing** — passive-only goal slips indefinitely | High | Medium | The transitional debt has an explicit resolution trigger (Shop PRO sub-section). Tracked in §6.1 + DESIGN_SYSTEM.md §10.7. Set a 60-day soft deadline at canary deploy; if Shop PRO sub-section hasn't shipped by then, escalate. |
| **PRO indicator drift across screens** — different screens fetch `useProStatus` with different staleness, Z1 shows mismatched state | Medium | Medium | All screens that mount Z1 must derive `proStatus` from the same hook (`useProStatus(address)`). Documented in §10 and §10.7 of DESIGN_SYSTEM.md. Reviewer checks that no screen invents its own PRO fetch path. |
| **Z1 + Z2 + Z3 + Z4 + Z5 combined exceed 100dvh** on 360×640 (Pixel 4) — board gets squeezed | Low | Medium | Z1 ≤ 40px + Z2 ≤ 64px + dock 72px = 176px overhead; minus Z4 (max 56px when present, 0 when empty) = 232px max → leaves 408px for Z3 on 640px tall device. Visual QA at 360×640 confirms. |
| **Wallet disconnect mid-session causes layout shift** when variant flips from `connected` to `anonymous` | Low | Low | Both variants share the same wrapper height. Internal cluster widths differ, but the strip itself doesn't shift. E2E asserts. |
| **`useProStatus` is invoked twice** (once for `<ProChip>` legacy, once for Z1) during the transition window | Low | Low | The transition is short (canary commit removes legacy chip in the same change). If a window emerges, both calls hit the same memoized React Query / SWR cache once that's wired; v1 has no caching layer, so two parallel fetches are acceptable for the canary day. |
| **Reducing Z1 to a primitive ossifies the layout** before we know the level/streak/currency systems | Low | Medium | Spec is intentionally narrow — 2 variants, no level, no streak, no currency. The discriminated union is open to extension via new variants when those systems ship. v1 doesn't have to predict v2's product surface. |
| **Migration churn** — moving every screen to mount Z1 is a 5+ commit PR | High | Low (mechanical) | Spec scopes implementation to play-hub canary only. Other screens migrate one-per-commit in follow-up PRs, never as a bulk drop-in replacement. |

---

## 13. Tests expected

### Unit (vitest + RTL)

- **File**: `apps/web/src/components/ui/__tests__/global-status-bar.test.tsx`.
- One test block per variant (2 blocks: `anonymous`, `connected`).
- **`anonymous` block** asserts: silhouette renders; handle text reads "Guest" (from `GLOBAL_STATUS_BAR_COPY.guestLabel`); no PRO indicator rendered; wrapper height is within budget.
- **`connected` block** asserts (4 sub-tests):
  - PRO loading (`proStatus === null`) → skeleton circle visible, no ring.
  - PRO active → gold ring on avatar, "PRO • Nd" pill renders, days suffix correct.
  - PRO inactive → no ring, "PRO" pill renders.
  - `onProTap` fires when the PRO indicator is tapped (`userEvent.click`).
- **A11y test** per variant: wrapper has `role="banner"` and `aria-label`; PRO button has `aria-label`; avatar is `aria-hidden`.
- **Length cap test**: `identity.handle = "this-handle-is-way-too-long"` → dev warning fires; ellipsis engages.

### Compile-time contracts (commented-out fixtures, same convention as `<ContextualHeader />`)

The discriminated union enforces these at type-check time. Documented in `__tests__/global-status-bar.test.tsx` as commented-out fixtures:

- **Compile errors** (TypeScript rejects):
  - `proStatus={...}` on `variant="anonymous"`.
  - `identity={...}` on `variant="anonymous"`.
  - `onProTap={...}` on `variant="anonymous"`.
  - Missing `identity` on `variant="connected"`.
  - Missing `walletShort` inside `identity` on `variant="connected"`.
  - `className="..."` on any variant — no escape hatch.
- **NOT compile errors** (verified runtime warnings instead):
  - `identity.handle.length > 14` — passes type check; runtime warning fires.
  - `identity.walletShort` malformed — passes type check; runtime warning fires.

### Integration / E2E (Playwright)

- **Existing**: `home-loads.spec.ts`, `dock-anchor.spec.ts`, `floating-actions-vs-dock.spec.ts`, `contextual-header.spec.ts` must continue to pass.
- **New**: `apps/web/e2e/global-status-bar.spec.ts` — opens `/hub`, asserts:
  - Z1 strip is visible at top of `<main>`, with `data-component="global-status-bar"` selector.
  - Z1 height ≤ 40px (wrapper `getBoundingClientRect().height`).
  - Z1 + Z2 combined height ≤ 104px.
  - Anonymous user (no wallet) sees "Guest" identity.
  - Connected user (test fixture wallet) sees truncated wallet address.
  - PRO indicator opens `<ProSheet>` on tap (transitional behavior preserved).
  - No live timer / monetization promo / level chip rendered inside Z1 (assertion: no `[data-testid*="timer"]`, no `[data-testid*="promo"]`, no `[data-testid*="level"]` inside the Z1 selector).
  - Z3 board hit-grid bounding box is within ±2px of the pre-canary baseline.
  - Z5 dock position is pixel-identical to the pre-canary baseline.

### Type-check

- `pnpm tsc --noEmit` count unchanged from baseline.

---

## 14. Visual QA expected

Run on `--project=minipay` (390×844) and `--project=desktop` for spot-check. All comparisons via Playwright visual snapshots.

| Surface | Expected delta | Notes |
|---|---|---|
| `/hub` first load (anonymous test fixture) | **Z1 strip is regenerated and re-baselined** — Guest variant. | Snapshot regen is explicit (`--update-snapshots`); reviewed in PR diff. |
| `/hub` first load (connected test fixture, PRO loading) | **Z1 with skeleton PRO indicator** — re-baselined. | Same as above. |
| `/hub` (connected, PRO active) | **Z1 with gold ring + "PRO • Nd" pill** — re-baselined. | Same as above. |
| `/hub` (connected, PRO inactive) | **Z1 with no ring + "PRO" pill** — re-baselined. | Same as above. |
| `/hub` Z2 (after canary) | Z2 strip pixel-identical except: `mr-[140px]` removed → Z2 trailing slot now spans further right. Visual diff expected and reviewed. | Asserted in PR review; not a regression. |
| `/hub` Z3 (board) | DOM order preserved; 64 cells render; piece float layer unchanged; bounding box within ±2px of pre-canary baseline. | Asserted by `home-loads.spec.ts` + new spec. |
| `/hub` Z4 (action rail) | DOM order and dimensions unchanged. | No interaction with Z1. |
| `/hub` Z5 (dock) | Pixel-identical. Dock is invariant per `DESIGN_SYSTEM.md` §8. | If the dock moves by even 1px, the refactor is wrong. |
| `/arena` (no Z1 in v1) | Snapshot unchanged. Arena does not mount Z1 in this PR. | If `/arena` snapshot changes, investigate token leak. |
| Other screens (`/trophies`, `/leaderboard`, `/about`, `/privacy`, `/terms`, `/support`) | Snapshot unchanged. Not migrated in this PR. | Same as `/arena`. |
| `/hub` at 360×640 (Pixel 4) | Z1 + Z2 combined ≤ 104px; board still ≥ 380px. | Pixel-4 viewport snapshot added. |

If `/hub`'s Z3, Z4, or Z5 dimensions drift beyond ±2px, **stop and investigate before regenerating snapshots**.

---

## 15. Implementation plan — by commit

Each commit is one logical change. Run full unit + e2e suite before each. Conventional Commits + `Wolfcito 🐾 @akawolfcito` footer.

> Same shape as the `<ContextualHeader />` plan (4 commits): primitive + canary + docs paired with their work, no docs trailing in a separate PR.

1. **`feat(ui): add GlobalStatusBar primitive (Z1) + design-system entry`**
   - New file `apps/web/src/components/ui/global-status-bar.tsx`.
   - Exports component + the discriminated-union types from §5.
   - Both variants (`anonymous`, `connected`) implemented.
   - Unit tests for all 4 PRO states and a11y per variant.
   - Compile-time contract fixtures as commented-out blocks (same convention as `<ContextualHeader />`).
   - **Gold ring token**: per acceptance §11 #3, attempt to reuse `--redesign-wood-gold` first. Only add a new `--pro-ring-gold` if visual review of the implementation rejects the reuse. Either path is a one-line token decision committed atomically; no inline color literals in the component.
   - Adds `GLOBAL_STATUS_BAR_COPY` to `editorial.ts` (`guestLabel`, `ariaLabelConnected`, `ariaLabelAnonymous`, `proManageLabel`, `proViewLabel`).
   - **DESIGN_SYSTEM.md §10.7 added in the SAME commit** with the canonical Z1 entry, variant catalogue, and "first consumer: play-hub (commit #2)" note. The §10.7 entry must call out the **`onProTap` transitional debt with its 60-day-or-Shop-PRO deadline** so the debt is visible in the design-system reference, not buried in the spec.
   - **DESIGN_SYSTEM.md §10.1 amended in the SAME commit** with the Z1 + Z2 combined-budget invariant.
   - No production callers wired yet.

2. **`refactor(play-hub): adopt GlobalStatusBar (canary) + remove ProChip render path`**
   - In `play-hub-root.tsx`: delete the `pointer-events-none absolute right-2 top-... z-30` wrapper around `<ProChip>`; **remove the `<ProChip>` import**; mount `<GlobalStatusBar variant=...>` as the first child of `<main>`. Branches by `address` presence (`connected` if wallet, `anonymous` otherwise).
   - **No double-PRO state ever renders.** This commit is the single point at which the legacy chip stops being on-screen.
   - In `mission-panel-candy.tsx`: drop `mr-[140px]` from the Z2 wrapper at line 266; remove the inline TODO comment about PRO chip migration.
   - **`<ProChip>` component file (`apps/web/src/components/pro/pro-chip.tsx`) is NOT deleted yet** — kept as rollback safety only; not imported, not mounted from any module after this commit.
   - New E2E spec `apps/web/e2e/global-status-bar.spec.ts` per §13.
   - Visual QA snapshots regenerated for `/hub` only with `--update-snapshots`; PR diff reviewed against §14 matrix.
   - This is the canary commit. **Halt here for re-review** before commit #3.

3. **`chore(pro): delete legacy ProChip component file`**
   - After canary verification: delete `apps/web/src/components/pro/pro-chip.tsx` + its test file.
   - `git grep ProChip` must return zero references in source after this commit.
   - Risk: very low — Z1 fully owns the surface by canary commit; this commit only removes a now-unreferenced file.

4. **`docs(design-system): cross-link GlobalStatusBar Phase 2 follow-ons`**
   - Appends to `DESIGN_SYSTEM.md` §10.7 a "Phase 2 follow-ons" subsection:
     - Per-screen migration (`/arena`, `/trophies`, `/leaderboard`, secondary pages).
     - `onProTap` removal trigger (Shop PRO sub-section).
     - Future variants for level / streak / currency.
   - No code changes.

**Stop here. Do NOT migrate other screens in this PR.** Per-screen migration is one PR per screen after this one merges, so visual QA on each is isolated and reviewable.

**Rollback triggers** (any one fires → revert the offending commit):

- Sentry / app-error rate on `/hub` rises >2× baseline within 24h of canary deploy.
- Visual QA shows Z3, Z4, or Z5 dimensions drifted beyond ±2px.
- `<ProSheet>` open/close cycle breaks.
- TS error count rises above baseline.
- Combined Z1 + Z2 measured height exceeds 104px on the canary build.

---

## 16. Red-team checklist (for the next reviewer)

Before approving this spec, verify each of the following. Anything answered **No** or **Unsure** is a P0 blocker.

1. Does the discriminated union actually compile as claimed in §5? (Paste into a TS playground — try the four "Compile errors" cases from §13 and confirm they fail.)
2. Is `onProTap` strictly necessary in v1, or can the canary ship without it (e.g., temporarily route PRO management via a dock destination)? If yes — the transitional debt in §6.1 evaporates.
3. Are there any screens (Type-B sheets, Type-D modals) that should also mount Z1 in v1 to keep identity persistent across surfaces? §10 currently scopes to play-hub only.
4. Does the §9 visual layout assume left-to-right reading order in a way that breaks RTL? (Chesscito does not currently support RTL, but the spec should explicitly note this.)
5. Does the Z1 + Z2 ≤ 104px budget actually leave enough room for Z3 on the smallest target viewport (Pixel 4 = 360×640)? §12 does the math; verify it independently.
6. Does the §3 list of non-goals correctly capture every "future feature" the team has discussed? In particular: notifications, settings, network indicator, sync status. Cross-check with project memory.
7. Is the proposed `GLOBAL_STATUS_BAR_COPY` keyset stable, or are there obvious gaps (e.g., loading-state text, error-state text)? Per §6.2 / §8, no error text is exposed in v1 — confirm this is acceptable to product.
8. Is the migration to `<ProSheet>` invocation in §10 correct? Cross-reference `play-hub-root.tsx:1124` to confirm `setProSheetOpen(true)` is the existing pattern.
9. Does the spec correctly defer level / streak / currency? **Note:** §3 explicitly rejects the Coach Daily Tactic streak as a Z1 v1 candidate (it's a Coach-scoped loop, not global player state); reviewer should confirm there is no other latent global-streak signal hiding in the codebase that v1 should surface.
10. Are the runtime guards in §6 actually dev-mode-only (no production cost), or could the duplicate-mount detector leak into production?
11. Does the `<ContextualHeader />` E2E spec assume the absence of Z1? If yes, this canary will break it — flag what needs updating.
12. Acceptance §11 #3 directs implementers to reuse `--redesign-wood-gold` (#FDD257) for the active PRO ring before adding a new `--pro-ring-gold`. Verify: (a) `--redesign-wood-gold` is the right semantic-hue match for a passive identity ring (vs the candy wood context where it lives today); (b) using the same token in two semantic contexts won't cause unintended visual coupling (i.e., a future palette shift for "wood" wouldn't accidentally retint the PRO ring). If either answer is "no," call out the need for a new token in the v1 amendment.
13. Does this spec leave `<ProSheet>` itself untouched? It should — open/close state lives at the parent.
14. Is the rollback path in §15 clean? Specifically: can commit #2 be reverted independently of commit #3 if commit #3 has already merged?
15. Does §8's "wallet disconnect mid-session" handling actually need to flip variants, or could v1 simply unmount-remount Z1 to handle the transition?

---

## Status & next step

Spec drafted. **Awaiting red-team review.** Implementation starts only after review notes are addressed via a v1 amendment (same pattern as `<ContextualHeader />` v1).

— Sally

---

## Amendment log

> Empty (v0). Amendments land here when the red-team review fires.
