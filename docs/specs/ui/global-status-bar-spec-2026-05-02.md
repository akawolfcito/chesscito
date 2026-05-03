# `<GlobalStatusBar />` — Spec (2026-05-02)

> **Phase**: Phase 2 — second zone primitive (Z1).
> **Owner**: Wolfcito. UX advisor: Sally (BMad).
> **Status**: **v1 — Amendments 2026-05-02 + 2026-05-03 applied; canary live.** Red-team review (`docs/reviews/global-status-bar-spec-red-team-2026-05-02.md`) and follow-up re-review (`docs/reviews/global-status-bar-spec-red-team-followup-2026-05-02.md`) both passed; all 6 P0 closed strictly, P1-1..P1-6 closed, P1-7 deferred to §17 Accessibility carry-forward. Amendment 2026-05-03 retunes the §8 P1-2 inactive lock after the 2026-05-02 PRO smoke confirmed the original treatment was invisible against candy-green.
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
| **Type-B destination sheets** (Shop, Badges, Trophies, Leaderboard) | **Z1 is NOT rendered inside Type-B sheets in v1.** Type-B sheets are `h-[100dvh]` per `DESIGN_SYSTEM.md` §8 and cover the entire viewport including Z1. Identity persistence inside Type-B sheets is **NOT a v1 goal** (see §3 non-goals). Identity is reached by closing the sheet — the persistent dock provides return-to-context. A future spec may introduce a separate `<SheetHeader />` primitive that re-renders abridged identity (handle pill only, no PRO state) at the sheet top; that is out of scope for this v1. The §6 duplicate-instance dev warning fires if a Type-B sheet imports `<GlobalStatusBar />` directly. |
| **Type-A overlays** (full-page routes that hide the dock — `/arena` mid-match, `/victory/[id]`) | Z1 visibility decided per route in that route's migration commit. v1 canary does not mount Z1 here. |
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
- **No level / progress bar / star count.** Not because they're forbidden in Z1 conceptually, but because **the data system doesn't exist yet**. Chesscito tracks `totalStars` per piece, not a unified "player level". Inventing a level system inside a layout primitive is a product decision, not a layout one. v2+ may add a `level` slot **as a typed prop on `ConnectedProps`** (per the §5 growth rule — variants are for layout, not data), after a product spec defines the level math.
- **No wins streak.** Same reason as level — the only `currentStreak` in editorial is the Coach Daily Tactic streak, **scoped to the Coach daily-puzzle loop, not a global player state**. Surfacing it in Z1 would mislead users into reading it as a combat streak. Defer until a real global-streak data system is specified.
- **No currency / gems / resources.** No global currency exists.
- **No notifications inbox, no settings gear, no network indicator.** Each is its own surface; none belongs on the most-trusted strip.
- **No `className` escape hatch.** Surface tweaks go through typed props only. Same rule as `<ContextualHeader />` v1.
- **No mid-screen mount/unmount.** Z1 reserves its full height for the lifetime of every screen render. Loading state uses skeletons, never collapse.
- **No nested status bars.** A screen has at most one Z1. Type-B destination sheets do **not** render Z1 inside themselves (per §2 visibility row). Identity persistence inside sheets is explicitly out of scope for v1; a future `<SheetHeader />` primitive may address it.
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

**Contracts the type system enforces (for inline-literal callers):**

- `proStatus`, `isProLoading`, and `onProTap` cannot be passed alongside `variant: "anonymous"` in an **inline object literal** — TypeScript's excess-property check rejects them.
- `identity` cannot be passed alongside `variant: "anonymous"` in an inline literal.
- `ariaLabel` is optional on both members; the component derives a default when omitted.
- The discriminated union prevents the impossible state "connected without identity" — `walletShort` is required on the connected branch.
- No `className` prop. Surface tweaks must propose a typed prop in a future amendment.

**Important: TypeScript does NOT block discriminated-union escapes via spread props.** Excess-property checks fire on inline literals only. A caller that builds the object first and spreads it bypasses the check:

```ts
// COMPILES (defect class — see runtime guard in §6):
const leak = { proStatus: ..., isProLoading: false, onProTap: () => {} };
return <GlobalStatusBar variant="anonymous" {...leak} />;
```

The spec does **not** claim the type system is sufficient. Runtime guards in §6 are the safety net.

**Growth rule (single source of truth — replaces v0's contradiction across §3/§11/§12):**

> **Variants are reserved for structural layout differences only** (today: `anonymous` vs `connected` — the wrapper renders different cluster geometry). **Data slots** (level, streak, currency, achievements, etc.) added in v2+ land as **typed props on `ConnectedProps`**, not as new variants. Adding a new variant requires a written justification in a spec PR + design-system owner sign-off; "we have a new piece of data to show" is **not** a justification.

This is the single rule. Every other section of the spec must be consistent with it.

**What v1 does NOT enforce at the type level (deferred to runtime guards / future typed props):**

- `walletShort` format (`0x[a-f0-9]{4}…[a-f0-9]{4}`) — runtime warning only. A truncation helper at `@/lib/wallet/format` (file does not exist yet — see §15 commit #1 subtask) produces the canonical shape; manual misuse warns in dev.
- `handle` length (≤ 14 visible characters) — runtime warning + ellipsis past cap.

---

## 6. Runtime guards (dev-mode `console.warn`)

All wrapped in `process.env.NODE_ENV !== "production"`:

| Trigger | Warning | Why |
|---|---|---|
| **Spread-prop escape** — `variant: "anonymous"` arrives at the component AND any of `identity \| proStatus \| isProLoading \| onProTap` is present in props (`Object.hasOwn(props, key)`) | "GlobalStatusBar: anonymous variant received connected-only keys via spread (`identity`/`proStatus`/`isProLoading`/`onProTap`). The runtime guard ignores them; fix the caller." | Closes the discriminated-union spread escape that TypeScript cannot block. The component runtime-narrows by destructuring **only** the fields valid for the matched variant; extra keys are dropped, not honored. |
| `identity.handle.length > 14` | "GlobalStatusBar: handle exceeds 14 chars; truncating with ellipsis." | Handle pill must remain ≤ ~140px wide; longer handles break the Z1+Z2 budget. |
| `identity.walletShort` does not match `/^0x[a-f0-9]{4}…[a-f0-9]{4}$/i` | "GlobalStatusBar: walletShort should be `0xABCD…1234` shape." | Catches manual `address.slice(0, 6)` patterns that produce inconsistent truncations. |
| `proStatus.expiresAt && proStatus.expiresAt < Date.now()` AND `proStatus.active === true` | "GlobalStatusBar: stale PRO status — expiresAt < Date.now() but active=true." | Catches downstream cache-invalidation bugs without crashing the UI. |
| Z1 wrapper rendered DOM height > 40px | "GlobalStatusBar: rendered height exceeds Z1 budget (40px)." | Caught via `getBoundingClientRect` after layout, throttled to once per mount. Prevents ad-hoc styling drift from blowing the Z1+Z2 ≤ 104px combined budget. |
| Same screen mounts more than one `<GlobalStatusBar />` | "GlobalStatusBar: duplicate instance detected at <selector>." | Catches accidental nesting (e.g., a Type-B sheet importing the primitive — see §2 invariant). Tracked via `data-component="global-status-bar"` + a development-only mount counter. |
| **Wallet disconnect with `<ProSheet>` open** — variant flips from `connected` to `anonymous` AND a `<ProSheet>` is currently open in the parent (detected by emitting an event the parent ignores in non-dev builds; see §8 row 6 for the parent-side rule) | "GlobalStatusBar: anonymous variant rendered while PRO sheet is open. Parent must close the sheet on disconnect." | Catches the race condition described in P1-5 of the red-team review. Actual close logic lives at the parent (`play-hub-root.tsx`) — Z1 only detects + warns. |

Production cost: 0. The development guards are dead-code-eliminated by the bundler.

### 6.1 Transitional debt tracker (visible, dated, with hard enforcement on the load-bearing item)

The items below are **explicit, dated debts**. Each must close on or before its trigger; reviewers are expected to flag this section in any future PR that touches Z1.

| Debt | Where | Resolution trigger | Hard deadline + enforcement |
|---|---|---|---|
| **`onProTap` exists in `ConnectedProps`.** Z1 is not strictly passive yet — the tap target preserves the existing renew flow only because Shop has no PRO sub-section yet. **`onProTap` is NOT a green light to add other taps to Z1.** | Type union (`ConnectedProps`) + `<ProSheet>` open call in `play-hub-root.tsx`. | Shop ships a "PRO" sub-section (Type-B destination) — at that moment: (a) drop `onProTap` from the type, (b) drop the tappable hit area on the PRO indicator, (c) flip Z1 to strictly passive, (d) update DESIGN_SYSTEM.md §10.7. | **Owner: Wolfcito.** **Due date: 60 days from the canary deploy date OR Shop PRO sub-section ships, whichever first.** **Enforcement (4 layers, all required, none optional):** (1) Commit #2 message includes the literal trailer `pro-tap-debt-due-by: <YYYY-MM-DD>` (canary-deploy-day + 60d) — greppable in any future log scan. (2) `DESIGN_SYSTEM.md` §10.7 carries the same date in the carry-forward table. (3) Sally creates a calendar reminder in the project tracker on canary-deploy day. (4) On day 61 without resolution: **automatic hard-close** — `onProTap` is removed from `ConnectedProps`, the inactive PRO pill is removed entirely, the hit area is dropped. If Shop PRO has not shipped, PRO management remains reachable through Shop's main destination only; renew regression is accepted as the cost of debt expiration. Re-approval to extend requires a new section in this spec's Amendment log titled "60-day debt re-approval", with explicit rationale signed by Wolfcito — soft escalation in Slack/issues is not sufficient. |
| Z1 mounted on `/play-hub` only in v1 (not on `/arena`, `/trophies`, `/leaderboard`, secondary). | Per-screen migration is **out of scope** for the canary commit. | Per-screen follow-on commits. Same pattern as `<ContextualHeader />` migration. Each commit has its own visual QA. | No hard deadline; tracked in `DESIGN_SYSTEM.md` §10.7 carry-forward table with a quarterly review cadence. Owner: Wolfcito. |
| The legacy `ProChip` component file (`apps/web/src/components/pro/pro-chip.tsx`) **survives in the codebase** for one commit after canary, then is deleted. | Source file only — **NOT rendered alongside Z1**. See §10 and §15 commit #2 / #3. | Canary verification confirms no regression. | Commit #3 of the implementation plan (§15). Keep at least 7 days between commit #2 and commit #3 to preserve a clean revert window. |

> **Avatar (no real avatar yet — every connected user sees the candy silhouette)** is **not a transitional debt** — it is a non-goal of v1 (see §3). Listed here in v0 by accident; removed from this table to keep the tracker focused on items with closure triggers.

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
| **Connected, PRO resolved inactive** | Identity pill, **no ring**. PRO slot is **intentionally quiet**: no gradient, no promotional copy, no "Get PRO" affordance. While the `onProTap` transitional debt exists (see §6.1), render a small outline-on-cream `PRO` affordance with the **exact treatment locked below** (Amendment 2026-05-03; no implementer-side tuning): `inline-flex items-center px-2 h-6 rounded-full text-[10px] font-bold uppercase tracking-wide text-[rgb(80,40,5)]/70 ring-1 ring-inset ring-[rgb(80,40,5)]/30 bg-white/85`. Label: `GLOBAL_STATUS_BAR_COPY.proInactiveLabel` (`"PRO"`). Visual QA **confirms** the resting hue against the canary background; it does not re-tune the values. Any future change requires a spec amendment. When strict-passive Z1 lands (debt closed), the inactive pill is removed entirely and the slot collapses to width 0. |
| **Connected, PRO API error** | Same as inactive. `useProStatus` already coerces errors to `{ active: false, expiresAt: null }`. No error chip in Z1. |
| **Wallet disconnect mid-session** | Parent flips to `variant="anonymous"`. Z1 re-renders with Guest. No animation v1. **Parent contract (mandatory)**: on wallet disconnect (`address` watcher in `play-hub-root.tsx` flips from set to `null`), the parent must **synchronously close any open `<ProSheet>`** before/while flipping the variant. Stale PRO state must NOT remain visible after disconnect. Z1's §6 dev-warning fires if the parent forgets. Commit #2 canary includes either an E2E test or a manual QA step asserting "open ProSheet → disconnect wallet → ProSheet is closed, Z1 shows Guest." |

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
3. The primitive consumes existing design tokens (`--surface-*`, `--text-*`) and **a single new token committed in commit #1**: `--pro-ring-gold: #FDD257`. **Reuse of `--redesign-wood-gold` is rejected** — that token is named after candy-game wood chrome, and reusing it for an identity ring would silently retint every PRO ring across every screen if the candy palette ever shifts. The PRO ring is a semantic premium-state indicator, not decoration; it gets its own semantic name. Documented in `DESIGN_SYSTEM.md` §1 as the canonical premium-state gold. No inline `#FDD257` literals in the component.
4. The play-hub canary uses the primitive; the absolute-z-30 PRO chip wrapper at `play-hub-root.tsx:1120` is removed, and `mission-panel-candy.tsx:266` `mr-[140px]` is dropped.
5. `<ProSheet>` still opens correctly when the PRO indicator is tapped — open/close state is owned by `play-hub-root.tsx`, not by the primitive (no regression in `<ProSheet>` flow).
6. **Visual QA** (`pnpm test:e2e:visual --project=minipay`): the Z1 strip snapshot is regenerated and re-baselined deliberately; **Z2, Z3, Z4, Z5 keep the same DOM order and functional footprint**; subpixel reflow (±2px) caused by Z1 inserting in normal flow is acceptable below Z1 *only if* `.playhub-board-hitgrid` keeps its bounding box within ±2px of baseline. Snapshot regeneration is explicit (`--update-snapshots`), reviewed in PR diff.
7. Unit tests cover both variants + all four PRO states (loading, active, inactive, anonymous-no-pro). Type-system contracts (e.g., `proStatus` outside `connected`, missing `walletShort` on `connected`) are validated by commented-out fixtures (project has no `tsd` library; same convention as `<ContextualHeader />`).
8. No new TS errors introduced (`pnpm tsc --noEmit` count unchanged from baseline at branch tip).
9. Existing E2E suite (`pnpm test:e2e --project=minipay`) is green: `floating-actions-vs-dock`, `home-loads`, `dock-anchor`, `contextual-header` all pass; new `global-status-bar.spec.ts` passes (see §13).
10. The primitive is documented in `DESIGN_SYSTEM.md` §10.7 as the canonical Z1 component, with a "first consumer: play-hub" note. Docs ship in the **same commit** as the primitive — never as a trailing commit.
11. The Z1 + Z2 combined **content-height** budget invariant is codified in `DESIGN_SYSTEM.md` §10.1 in the same commit: "Z1 ≤ 40px content height, Z2 ≤ 64px content height, combined ≤ 104px content height. Layout cost (content + safe-area insets) is device-specific and not part of the invariant — see §12 risk row #4 for device matrix." The §13 E2E spec asserts the invariant on the canary build by measuring `clientHeight - parseFloat(getComputedStyle(el).paddingTop) - parseFloat(getComputedStyle(el).paddingBottom)` for each strip; the assertion is what enforces #11, not the doc text alone.

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Variant explosion** — future screens demand a `connected-with-level`, `connected-with-streak`, `connected-with-currency` variant | Medium | High | **Single rule** (per §5 growth rule): variants are reserved for structural layout differences (e.g., `anonymous` vs `connected`). Data slots (level, streak, currency) added in v2+ land as **typed props on `ConnectedProps`**, not as new variants. A new variant requires a written justification in a spec PR + design-system owner sign-off; "we have a new piece of data to show" is **not** a justification. This rule is restated in §3 (non-goals) and §5 (type contract) so reviewers catch drift. |
| **`onProTap` becomes load-bearing** — passive-only goal slips indefinitely | High | Medium | Closed by §6.1 row 1 four-layer hard enforcement: greppable `pro-tap-debt-due-by:` commit trailer + DESIGN_SYSTEM.md §10.7 carry-forward + project-tracker calendar reminder + automatic day-61 hard-close (removes `onProTap` + inactive PRO pill, no soft escalation). Re-approval to extend requires an explicit Amendment-log entry signed by Wolfcito. |
| **PRO indicator drift across screens** — different screens fetch `useProStatus` with different staleness, Z1 shows mismatched state | Medium | Medium | **Mitigation is process-only in v1**, with a defined upgrade path: all screens that mount Z1 must derive `proStatus` from the same hook (`useProStatus(address)`); reviewer checks no screen invents its own PRO fetch path. **Promotion to CI when the second screen migrates**: at that point a one-line CI grep check (`scripts/check-pro-fetch.sh`) flags any `app/**/*.tsx` that calls `/api/pro/status` outside `lib/pro/use-pro-status.ts`. v1 does not ship the CI check (only one consumer); the §15 commit #4 docs note records the promotion trigger so it doesn't decay. Status: **process-only mitigation, promote to CI on second-consumer migration.** |
| **Z1 + Z2 + Z3 + Z4 + Z5 combined exceed 100dvh** on the smallest target viewport — board gets squeezed | Low | Medium | **Corrected math (v0 was optimistic — ignored safe-area insets):** the v0 calculation assumed Z1 = 40px and dock = 72px, both **content heights only**. Real layout cost includes `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. Worst case on iOS notch device at 360×640 (Safari): Z1 (36 content + ~44 inset-top) ≈ 80px; Z2 ≤ 64px; dock (72 content + ~34 inset-bottom) ≈ 106px; Z4 max present ≈ 56px. Total overhead ≈ 306px → ~334px remaining for Z3 on 640px-tall device. On Pixel-4-class Android (no notch), insets are ~24/0 → ~248px overhead → ~392px for Z3. **The acceptance bar in §14 ("board ≥ 380px") is ONLY achievable on Android-class devices; iOS notch devices target ≥ 330px for Z3.** Visual QA must run BOTH minipay (Android) and an iOS notch fixture; §14 row is updated to reflect device-specific budgets. The board must remain playable (8×8 cells with min-tap target ≥ 36px) — measured via Playwright after the inserts, not derived from optimistic math. |
| **Wallet disconnect mid-session causes layout shift** when variant flips from `connected` to `anonymous` | Low | Low | Both variants share the same wrapper height. Internal cluster widths differ, but the strip itself doesn't shift. E2E asserts. |
| **`useProStatus` is invoked twice** (once for `<ProChip>` legacy, once for Z1) during the transition window | Low | Low | The transition is short (canary commit removes legacy chip in the same change). If a window emerges, both calls hit the same memoized React Query / SWR cache once that's wired; v1 has no caching layer, so two parallel fetches are acceptable for the canary day. |
| **Reducing Z1 to a primitive ossifies the layout** before we know the level/streak/currency systems | Low | Medium | Spec is intentionally narrow — 2 variants, no level, no streak, no currency. Per the §5 growth rule, future data systems land as **typed props on `ConnectedProps`** (not new variants); the discriminated union is reserved for structural layout differences. v1 doesn't have to predict v2's product surface. |
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
  - Z1 + Z2 combined **content height** ≤ 104px (measure `clientHeight - paddingTop - paddingBottom` for each strip; sum). Excludes `env(safe-area-inset-top)`. Per §11 acceptance #11.
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
| `/hub` at 360×640 (Pixel-4-class Android — no notch) | Z1 + Z2 combined **content-height** ≤ 104px; board ≥ 380px. | Pixel-4 viewport snapshot added. |
| `/hub` on iOS notch fixture (e.g., iPhone 12 mini at 375×812 with safe-area-top 44 / bottom 34) | Z1 + Z2 combined **content-height** ≤ 104px; **board ≥ 330px** (lower bar acknowledges safe-area insets per §12 risk row #4). | iOS-notch fixture snapshot added. If board < 330px on the canary build, the canary is wrong — investigate Z2 wrapper or Z4 presence before re-baselining. |

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
   - **Gold ring token**: adds `--pro-ring-gold: #FDD257` to `globals.css` and documents it in `DESIGN_SYSTEM.md` §1 as the canonical premium-state gold (per acceptance §11 #3). No inline color literals; component reads only the variable. The decision to NOT reuse `--redesign-wood-gold` is intentional — the PRO ring is semantic state, decoupled from candy palette evolution.
   - Adds `GLOBAL_STATUS_BAR_COPY` to `editorial.ts` with the **complete v1 keyset**:
     ```ts
     export const GLOBAL_STATUS_BAR_COPY = {
       guestLabel: "Guest",
       ariaLabelConnected: "Player status",
       ariaLabelAnonymous: "Anonymous status",
       proManageLabel: "Manage Chesscito PRO", // active state, tappable
       proViewLabel: "View Chesscito PRO",      // inactive state while transitional debt exists
       proInactiveLabel: "PRO",                  // visible label of the muted inactive pill
       proLoadingAriaLabel: "Loading PRO status",
     } as const;
     ```
     **Days suffix copy** (`"PRO • Nd"`, `"Expires today"`) is reused from existing `PRO_COPY.statusActiveSuffix(daysLeft)` / `PRO_COPY.chip.activePrefix` — Z1 imports them directly; no duplicate keys. Documented in the JSDoc above the new constant per `DESIGN_SYSTEM.md` §10.2 invariant 12 ("editorial.ts is the only place copy lives").
   - **DESIGN_SYSTEM.md §10.7 added in the SAME commit** with the canonical Z1 entry, variant catalogue, and "first consumer: play-hub (commit #2)" note. The §10.7 entry must call out the **`onProTap` transitional debt with its 60-day-or-Shop-PRO deadline** so the debt is visible in the design-system reference, not buried in the spec.
   - **DESIGN_SYSTEM.md §10.1 amended in the SAME commit** with the Z1 + Z2 combined-budget invariant.
   - No production callers wired yet.

2. **`refactor(play-hub): adopt GlobalStatusBar (canary) + remove ProChip render path`**
   - In `play-hub-root.tsx`: delete the `pointer-events-none absolute right-2 top-... z-30` wrapper around `<ProChip>`; **remove the `<ProChip>` import**; mount `<GlobalStatusBar variant=...>` as the first child of `<main>`. Branches by `address` presence (`connected` if wallet, `anonymous` otherwise).
   - **No double-PRO state ever renders.** This commit is the single point at which the legacy chip stops being on-screen.
   - In `mission-panel-candy.tsx`: drop `mr-[140px]` from the Z2 wrapper at line 266; remove the inline TODO comment about PRO chip migration.
   - **Geometry subtasks (mandatory — dropping `mr-[140px]` is NOT neutral):**
     - Update `apps/web/e2e/contextual-header.spec.ts` assertions for the new Z2 wrapper width (382px content area, was 242px). The existing height-envelope assertion at lines 32–35 (`>= 51 && <= 65`) MUST continue to pass — re-baseline the assertion only if the rendered height **stays inside the 52–64px envelope**. The board-placement assertion at lines 99–122 (board y >= header y + header height − 1) MUST continue to pass.
     - **Halt condition**: if the canary build pushes Z2 height outside the 52–64px envelope OR if Z3/Z4/Z5 dimensions drift beyond ±2px from baseline, **the canary is wrong** — stop, refactor the wrapper (e.g., re-introduce a smaller right padding), do not blanket-update assertions to make red tests green.
     - Add to `apps/web/e2e/global-status-bar.spec.ts` a regression assertion: `headerBox.height` stays within 52–64px AFTER `mr-[140px]` removal. The Z2 spec considers wrapper width load-bearing; the Z1 spec respects that.
   - **`<ProChip>` component file (`apps/web/src/components/pro/pro-chip.tsx`) is NOT deleted yet** — kept as rollback safety only; not imported, not mounted from any module after this commit.
   - New E2E spec `apps/web/e2e/global-status-bar.spec.ts` per §13.
   - Visual QA snapshots regenerated for `/hub` only with `--update-snapshots`; PR diff reviewed against §14 matrix.
   - **Commit message MUST include the literal trailer `pro-tap-debt-due-by: <YYYY-MM-DD>`** where the date is canary-deploy-day + 60 days (per §6.1 P0-6 closure). A grep for that string at any future Phase-2 review surfaces the deadline.
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
2. ~~Is `onProTap` strictly necessary in v1, or can the canary ship without it~~ — **CLOSED by v1 amendment.** Decision: kept, because Shop has no PRO sub-section yet and removing `onProTap` cold-cut would regress the renew flow. The transitional debt is tracked in §6.1 row 1 with four-layer hard enforcement (greppable trailer, DS-doc, calendar reminder, automatic day-61 hard-close). Re-litigating this requires opening an explicit Amendment-log entry, not raising the question on a fresh review.
3. Are there any screens (Type-B sheets, Type-D modals) that should also mount Z1 in v1 to keep identity persistent across surfaces? §10 currently scopes to play-hub only.
4. Does the §9 visual layout assume left-to-right reading order in a way that breaks RTL? (Chesscito does not currently support RTL, but the spec should explicitly note this.)
5. Does the Z1 + Z2 ≤ 104px budget actually leave enough room for Z3 on the smallest target viewport (Pixel 4 = 360×640)? §12 does the math; verify it independently.
6. Does the §3 list of non-goals correctly capture every "future feature" the team has discussed? In particular: notifications, settings, network indicator, sync status. Cross-check with project memory.
7. Is the proposed `GLOBAL_STATUS_BAR_COPY` keyset stable, or are there obvious gaps (e.g., loading-state text, error-state text)? Per §6.2 / §8, no error text is exposed in v1 — confirm this is acceptable to product.
8. Is the migration to `<ProSheet>` invocation in §10 correct? Cross-reference `play-hub-root.tsx:1124` to confirm `setProSheetOpen(true)` is the existing pattern.
9. Does the spec correctly defer level / streak / currency? **Note:** §3 explicitly rejects the Coach Daily Tactic streak as a Z1 v1 candidate (it's a Coach-scoped loop, not global player state); reviewer should confirm there is no other latent global-streak signal hiding in the codebase that v1 should surface.
10. Are the runtime guards in §6 actually dev-mode-only (no production cost), or could the duplicate-mount detector leak into production?
11. Does the `<ContextualHeader />` E2E spec assume the absence of Z1? If yes, this canary will break it — flag what needs updating.
12. Acceptance §11 #3 commits a new `--pro-ring-gold` token (rejecting reuse of `--redesign-wood-gold`). Verify: (a) `#FDD257` is the right initial hue against the candy backdrop on the connected variant — open the canary build and eyeball; (b) the token is documented in `DESIGN_SYSTEM.md` §1 alongside `--redesign-wood-gold` so contributors don't accidentally collapse them in a future "tokens cleanup" PR. If the hue is wrong, propose a different value in the v1 amendment, not a token rename.
13. Does this spec leave `<ProSheet>` itself untouched? It should — open/close state lives at the parent.
14. Is the rollback path in §15 clean? Specifically: can commit #2 be reverted independently of commit #3 if commit #3 has already merged?
15. Does §8's "wallet disconnect mid-session" handling actually need to flip variants, or could v1 simply unmount-remount Z1 to handle the transition?

---

## 17. Accessibility carry-forward

These accessibility refinements are **explicitly deferred from v1** with a defined trigger to ship, not silently dropped. The reasoning: Z1 v1 has minimal interactive surface (a single transitional PRO tap target), Chesscito does not yet support RTL, and the canary's first consumer (`/play-hub`) is uniform LTR English. Closing each below-the-line item before v1 would block the canary on work that has no current user impact. The triggers ensure each item lands when it actually matters.

| Carry-forward item | Source | Trigger to ship |
|---|---|---|
| **Keyboard navigation** to the PRO indicator (Tab order, `Enter` activation, focus-visible ring). | Red-team P1-7 / §13 test gap. | First Z1 consumer beyond the transitional PRO tap (e.g., when level/streak typed props add tappable affordances), OR before removing `onProTap` (whichever first). |
| **Focus-visible refinements** — visible outline ring on the PRO button when `:focus-visible`, matching the project-wide focus token. | Red-team P1-7. | Same as keyboard navigation above, OR the first general accessibility QA pass on the project (whichever first). |
| **Screen-reader pronunciation of the truncated wallet** (e.g., `0x1234…abcd` reading as ellipsis-spelling on JAWS/NVDA). | Red-team P1-7. | First a11y QA pass with real screen-reader testing. v1 sets no `aria-label` override; tests are run when a real user reports friction or the project commissions accessibility QA. |
| **RTL layout support** — Z1 wrapper sets `dir="ltr"` to prevent caller-driven inversion in v1 (Chesscito does not currently support RTL). Full RTL support is its own spec scope. | Red-team P1-7 / §16 Q4. | When the i18n project demands RTL — at that point a separate spec defines mirroring rules for Z1 + Z2 + dock. v1 is explicitly LTR-only, codified as a wrapper attribute. |
| **Keyboard behavior beyond the PRO tap** — once Z1 grows interactive affordances (e.g., level pill drilldown, streak detail), define tab order, focus traps, ARIA roles. | Red-team P1-7 + future typed-prop additions. | Before merging the first PR that adds an interactive typed prop on `ConnectedProps`. |

**Hard rule**: any of the above items that becomes a real user complaint between v1 and its trigger gets promoted to a spec amendment immediately — the carry-forward list is not a permission to ignore live regressions. It is a permission to defer pre-emptive work.

This section MUST be cross-referenced from `DESIGN_SYSTEM.md` §10.7 carry-forward table (added in §15 commit #4) so the deferred items don't decay into "we'll get to it" debt.

---

## Status & next step

Spec drafted (v0 → v1 amendment applied 2026-05-02). **All 6 P0 closed. P1-1..P1-6 closed. P1-7 deferred as Accessibility carry-forward (§17).** Awaiting 15-minute re-review pass before commit #1 of the implementation plan — same cadence as `<ContextualHeader />` v1.

— Sally

---

## Amendment log

### Amendment 2026-05-03 — §8 P1-2 inactive treatment retuned

Source: 2026-05-02 PRO smoke + post-deploy `/hub` review (handoff `docs/handoffs/2026-05-02-stabilization-sprint-handoff.md` §6 #4). The original P1-2 lock (`text-white/40 ring-white/15 bg-transparent`) was confirmed invisible against the candy-green hub backdrop in production. Original lock was tuned for a darker neutral header that this codebase no longer uses post-candy redesign.

**Change**: §8 row "Connected, PRO resolved inactive" replaces

```
text-white/40 ring-1 ring-inset ring-white/15 bg-transparent
```

with

```
text-[rgb(80,40,5)]/70 ring-1 ring-inset ring-[rgb(80,40,5)]/30 bg-white/85
```

**Rationale**: light cream fill (`bg-white/85`) lifts the pill off any candy palette tile without requiring a backdrop-aware token. Defined brown border at 30% gives a clear edge. Brown text at 70% (vs the active state's 100%) preserves the "not a CTA" hierarchy — readable, but quieter than the gold-gradient active pill. Same height/padding/font as active so the slot doesn't shift between states.

**Constraints honoured**:
- No gradient (handoff §6 #4 explicit constraint).
- No "Get PRO" copy (DESIGN_SYSTEM.md §10.2 invariant 4 still in force).
- Same dimensions as active state (no layout reflow when PRO flips).

**Component + test**: classes locked in `apps/web/src/components/ui/global-status-bar.tsx` `PRO_PILL_INACTIVE` constant. Test `apps/web/src/components/ui/__tests__/global-status-bar.test.tsx` regex assertions updated in lockstep — implementer cannot tune without breaking the test, same enforcement model as P1-2 v1.

**Future-proofing**: when strict-passive Z1 lands (i.e. Shop ships its PRO sub-section and the §6.1 debt closes), the entire inactive pill is removed per row 1 of §6.1. This amendment does not change that exit condition.

### Amendment 2026-05-02 — post red-team

Source: `docs/reviews/global-status-bar-spec-red-team-2026-05-02.md` (verdict: approve with fixes; 6 P0, 7 P1, 10 P2). Status: **all 6 P0 closed + P1-1..P1-6 closed in this amendment. P1-7 deferred to §17 Accessibility carry-forward.**

| # | Finding | Closed by |
|---|---|---|
| **P0-1** | Discriminated union allows PRO data to leak into `anonymous` via spread props. | §5 explicitly disclaims TS coverage of spread escapes. §6 runtime-guard table adds a dev-mode warning for `variant: "anonymous"` arriving with `identity / proStatus / isProLoading / onProTap` keys. Component runtime-narrows by destructuring only valid fields per matched variant. |
| **P0-2** | §3 / §11 / §12 contradicted each other on growth rule (variants vs typed props). | §5 introduces a single growth rule: variants for structural layout differences only; data slots (level/streak/currency) land as typed props on `ConnectedProps`. §3 last bullet rewritten. §12 risk row #1 mitigation rewritten to cite the §5 single rule. |
| **P0-3** | `--redesign-wood-gold` reuse created an unowned semantic-coupling bomb. | §11 #3 rejects reuse and commits a new token `--pro-ring-gold: #FDD257` in commit #1. §15 commit #1 + §16 Q12 updated. Documented in `DESIGN_SYSTEM.md` §1 as the canonical premium-state gold (decoupled from candy palette evolution). |
| **P0-4** | Dropping `mr-[140px]` would silently break Z2 e2e geometry assertions. | §15 commit #2 adds explicit geometry subtasks: update `apps/web/e2e/contextual-header.spec.ts` for the new 382px wrapper width; halt if Z2 height leaves 52–64px envelope or Z3/Z4/Z5 drift > ±2px; new regression assertion in `global-status-bar.spec.ts`. |
| **P0-5** | Type-B destination sheets cover Z1, spec was silent. | §2 visibility table adds two new rows: Type-B sheets do NOT render Z1 in v1 (identity persistence in sheets is out of scope; future `<SheetHeader />` may address it); Type-A overlays decided per-route. §3 non-goals adds explicit "no nested status bars; Type-B sheets do not render Z1." |
| **P0-6** | `onProTap` 60-day deadline had no owner, no escalation channel, no calendar artifact. | §6.1 row 1 expanded to 4-layer enforcement: (1) commit #2 message includes greppable `pro-tap-debt-due-by: <YYYY-MM-DD>` trailer; (2) `DESIGN_SYSTEM.md` §10.7 carries the date; (3) Sally creates calendar reminder on canary-deploy day; (4) day-61 hard-close removes `onProTap` + inactive pill automatically. Re-approval requires explicit Amendment-log entry signed by Wolfcito. §15 commit #2 sub-tasks include the trailer. |
| **P1-1** | `useProStatus` single-source mitigation was process-only without upgrade path. | §12 risk row #3 rewritten: process-only in v1 (single consumer); CI grep promotion (`scripts/check-pro-fetch.sh`) when second screen migrates; recorded in §15 commit #4 docs. |
| **P1-2** | PRO inactive "muted/outline" treatment ambiguous. | §8 inactive row locks exact treatment values: `text-white/40 ring-1 ring-inset ring-white/15 bg-transparent`. Visual QA confirms (does not re-tune). Any change requires spec amendment. |
| **P1-3** | `GLOBAL_STATUS_BAR_COPY` keyset incomplete. | §15 commit #1 expanded to full keyset: `guestLabel`, `ariaLabelConnected`, `ariaLabelAnonymous`, `proManageLabel`, `proViewLabel`, `proInactiveLabel`, `proLoadingAriaLabel`. Days suffix reuses `PRO_COPY.statusActiveSuffix` (no duplicate). |
| **P1-4** | Layout-budget math at 360×640 ignored safe-area insets. | §12 risk row #4 rewritten with corrected math: ~306px overhead on iOS notch → ~334px for Z3 (was claimed 408px). §14 splits viewport row by device class: Pixel-4 Android board ≥ 380px, iOS notch board ≥ 330px. Visual QA must run both fixtures. |
| **P1-5** | Wallet-disconnect race condition with open `<ProSheet>`. | §8 row 6 expands the parent contract: synchronous close of `<ProSheet>` on disconnect; commit #2 canary includes E2E or manual QA. §6 dev-warning table adds the detection rule. |
| **P1-6** | Acceptance #11 ("Z1 + Z2 ≤ 104px") was not testable as written. | §11 #11 rewritten to specify content height (excludes safe-area insets) AND cite the §13 E2E assertion as the enforcement mechanism. §13 E2E assertion also clarified to measure `clientHeight - paddingTop - paddingBottom`. |

**Carry-forward (deferred from v1, tracked in §17):**

- P1-7 (keyboard navigation, focus-visible, screen-reader wallet pronunciation, RTL) — full deferral with named triggers per §17 table. Cross-referenced from `DESIGN_SYSTEM.md` §10.7 carry-forward at §15 commit #4.

**P2 items**: not addressed in this amendment to keep the v0 → v1 separation strict. They will be revisited during commit #1 implementation review or during the post-canary follow-on cycle. The 10 P2 findings are catalogued in the red-team review file (`docs/reviews/global-status-bar-spec-red-team-2026-05-02.md` §4) and remain visible to future reviewers.

**Re-review checkpoint**: this amendment is ready for a 15-minute re-review pass before commit #1 of the implementation plan. Reviewer should verify: (a) the §5 growth rule is consistent across §3/§5/§12; (b) the P0-6 4-layer enforcement is genuinely different from v0's soft language; (c) the §17 carry-forward triggers are concrete enough to actually fire.
