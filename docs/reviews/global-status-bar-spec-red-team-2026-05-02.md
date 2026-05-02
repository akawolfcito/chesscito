# `<GlobalStatusBar />` — Red-Team Review (2026-05-02)

> **Reviewer**: Adversary (cynical-mode persona; no investment in author's prior decisions).
> **Subject**: `docs/specs/ui/global-status-bar-spec-2026-05-02.md` (commit `56bd6bf`).
> **Method**: Adversarial pass per `bmad-review-adversarial-general`. Premise: assume defects exist; the author wants the work attacked.
> **Scope**: Spec only — no code yet. Compared to ContextualHeader spec + red-team review (2026-05-01) as format and rigor baseline.
> **Reading window**: spec in full, prior Z2 spec + red-team, DESIGN_SYSTEM.md §1/§8/§10, the four code touch-points (`pro-chip.tsx`, `use-pro-status.ts`, `play-hub-root.tsx:1120`, `mission-panel-candy.tsx:266`), `globals.css` z-ladder + gold tokens, and the Z2 canary E2E spec.

---

## 1. Verdict

**Approve with fixes.**

The spec is the most thorough first-draft of a Chesscito UI primitive to date — discriminated union from day one, dev-mode guards, transitional debt explicitly tracked with a deadline, visual QA matrix, four-commit plan with halt-and-review checkpoint. The author internalized every P0 from the Z2 red-team and front-loaded the corresponding fixes here. That is real progress.

But the spec ships several concrete defects that the implementer will hit on contact: (a) the discriminated union has at least one TS-trickery escape that lets PRO data flow into the anonymous variant; (b) acceptance #11 contradicts itself with risk row #1 on the variant-explosion rule; (c) the `--redesign-wood-gold` reuse instruction creates a real semantic-coupling bomb that nobody owns to defuse; (d) the `mr-[140px]` drop will break the existing ContextualHeader E2E spec at `apps/web/e2e/contextual-header.spec.ts` because the canary commit dropped the visual reservation but the E2E checks geometry that depended on it; (e) the 60-day `onProTap` deadline has no named owner or escalation channel; and (f) Type-B destination sheet behavior under Z1 is silent — `h-[100dvh]` Type-B sheets per DESIGN_SYSTEM.md §8 will cover Z1, but the spec never addresses it.

Six P0 items below must close before commit #1. The remaining P1/P2 should be amended in the same v1 pass to avoid trickle re-reviews. Estimated spec-amendment time: ~45 minutes.

---

## 2. P0 findings — must close before commit #1

### P0-1. Discriminated union allows PRO data to leak into `anonymous` variant via TS narrowing trick

**Location**: §5 `AnonymousProps` / `ConnectedProps`.

**Defect**: The spec states the contract:

> "`proStatus`, `isProLoading`, and `onProTap` exist **only** on `ConnectedProps`. On `variant: "anonymous"`, passing them is a TS error."

This is **true for explicit object literals** but **false for any caller that builds the props as a partial object first**. Concrete:

```ts
const base = {
  proStatus: { active: false, expiresAt: null },
  isProLoading: false,
  onProTap: () => {},
};
return <GlobalStatusBar variant="anonymous" {...base} />; // compiles
```

TypeScript does not narrow spread props against a discriminated union when the source object's declared type is wider than the literal. This is the same class of escape the Z2 red-team caught with `ReactNode` — except here it's about excess-property checks, which only fire on **inline literals**.

The downstream effect is worse than the Z2 case: the runtime component must now decide what to do when `variant: "anonymous"` arrives carrying `onProTap` — render the PRO indicator? Crash? Silently drop? The spec does not say.

**Fix (smallest)**: Add a TS-side guard that the component itself enforces. In §5, after the type definitions, add:

> Each member of the union is also runtime-narrowed at the component entry: `if (props.variant === "anonymous") { /* destructure only AnonymousProps fields, ignore the rest */ }`. The discriminated union is the contract; the runtime guard is the safety net for spread-prop callers. Document this as a P0 closure note in §6 (runtime guards) and add a dev-mode `console.warn` when an anonymous variant arrives with any `proStatus | isProLoading | onProTap` keys present.

This closes the leak without rewriting the API.

---

### P0-2. Variant-explosion guardrail and acceptance #11 are mutually contradictory

**Location**: §3 last bullet vs §11 #2 vs §12 risks row #1.

**Defect**: Three statements in the same spec say three different things about how new data slots are added.

§3: "v2+ may add a `level` slot through a new variant, after a product spec defines the level math."

§11 #2: "Both 2 variants (`anonymous`, `connected`) render at 390×844..." (locks v1 at exactly 2 variants).

§12 risks row #1 mitigation: "If 3+ screens want a slot, that slot lives in the existing `connected` variant via a typed prop, not a new variant. **Variants are reserved for structural layout differences** (e.g., `anonymous` vs `connected`), not data-source differences."

These cannot all be true. If level/streak/currency must arrive via "a typed prop on `connected`," then §3's "new variants" path is wrong. If they must arrive via "new variants," then §12 risks #1 is wrong. The implementer reading this will pick whichever rule fits the next demand and the spec won't have a defense.

This is more than a polish issue: the rule for how Z1 grows is the **single most important rule** in the spec, because every future PR that touches Z1 will lean on it.

**Fix (smallest)**: Pick one rule. Recommended:

> "Variants are reserved for structural layout differences (anonymous vs connected). Data slots (level, streak, currency) added in v2+ land as **typed props on `connected`** (e.g. `level?: { value: number; tier?: string }`), not as new variants. A new variant requires a written justification in a spec PR + design-system owner sign-off."

Then update §3 to remove "new variants" framing and replace with "new typed props on the connected branch." This kills the contradiction in one edit.

---

### P0-3. `--redesign-wood-gold` reuse creates an unowned semantic-coupling bomb

**Location**: §11 acceptance #3 + §15 commit #1 + §16 reviewer Q12.

**Defect**: The spec instructs:

> "The PRO active gold ring, **search for an existing gold token first** — `globals.css` already exposes `--redesign-wood-gold: #FDD257` (candy wood gold), `--color-label-gold` (muted label gold), and `--text-shadow-hero-amber`. **Reuse `--redesign-wood-gold` if visual QA confirms it matches the target hue/contrast for a passive identity ring.**"

Three concrete problems:

1. **Semantic-name violation.** `--redesign-wood-gold` is named after candy-game wood chrome. Reusing it for an identity ring means a future palette shift on candy wood (e.g., visual redesign moves candy wood from `#FDD257` to `#E6B947` to harmonize with a new rune set) **silently retints every PRO ring across every screen**. The spec acknowledges this risk in §16 Q12 but does not require it be resolved before commit #1 — it only asks the reviewer to "verify."
2. **Verification asymmetry.** Visual QA confirms the *current* hue is acceptable. It cannot confirm the *future* coupling is acceptable, because the future palette doesn't exist yet. The instruction asks the implementer to prove a negative.
3. **Mid-implementation token-naming branch.** "Only add a new typed `--pro-ring-gold` if reuse is rejected during implementation review" creates a decision branch *inside* commit #1 — the implementer has to either (a) ship reuse, then visually QA, then maybe revert and add a new token, or (b) pre-emptively add the token and bypass the reuse path. Neither produces an atomic commit.

DESIGN_SYSTEM.md §1 already lists `amber-*` as the approved Tailwind palette for "Warning / gold accent." The spec ignores this.

**Fix (smallest)**: Cut the decision branch. Either:

- **(a) Pre-commit a new `--pro-ring-gold` token** in commit #1, sourced from `#FDD257` initially. Document in `DESIGN_SYSTEM.md` §1 as semantic identity-ring gold. Future palette shifts on `--redesign-wood-gold` are then orthogonal. **Recommended.**
- **(b) Rename the existing token** to `--gold-base` (semantic, not contextual) and reference it from both `--candy-wood-gold` and `--pro-ring-gold` aliases.

Option (a) is one extra line in `globals.css` and zero implementation-time decision branches. The spec should pick (a) and drop §11 #3's "search first / reuse / fall back" language entirely.

Also: §11 #3 omits any mention of `amber-*` Tailwind palette, which is the canonical "warning / gold accent" per DESIGN_SYSTEM.md §1. If the answer is "we don't use Tailwind tokens, only CSS vars," say that explicitly so future contributors don't import `bg-amber-400` and ship inconsistency.

---

### P0-4. Dropping `mr-[140px]` will break the existing ContextualHeader E2E spec geometry assertions

**Location**: §15 commit #2 + §10 contract change #3.

**Defect**: Commit #2 deletes `mr-[140px]` at `mission-panel-candy.tsx:266`. The existing `apps/web/e2e/contextual-header.spec.ts` asserts (line 32-35):

```ts
const box = await header.boundingBox();
expect(box!.height).toBeGreaterThanOrEqual(51);
expect(box!.height).toBeLessThanOrEqual(65);
```

…and (line 99-122) asserts the board hit-grid sits below the Z2 header by checking `boardBox.y >= headerBox.y + headerBox.height - 1`.

Dropping `mr-[140px]` changes the Z2 wrapper's content width from `(390 - 8 - 140) = 242px` to `(390 - 8) = 382px`. The header's `title-control` content can now spread further right; depending on title length and trailing-control behavior, this may bump or shrink the header height (e.g. wrapped subtitle no longer wraps), which may push it above 65px or below 51px on the canary day if the layout reflows.

The spec mentions this risk implicitly in §16 Q11 ("Does the `<ContextualHeader />` E2E spec assume the absence of Z1?") but **does not answer it**. It just asks the reviewer to "flag what needs updating." That is delegation, not specification.

§13 also says the existing `contextual-header` spec must "continue to pass" — it cannot both pass unchanged AND have its underlying layout change.

**Fix (smallest)**: Add to §15 commit #2 explicit subtasks:

- "Update `apps/web/e2e/contextual-header.spec.ts` assertions to reflect new Z2 wrapper width (382px instead of 242px). Re-baseline header geometry bounds if and only if the values stay inside the 52–64px envelope."
- "If header geometry leaves envelope, the canary is wrong; halt and refactor the wrapper before re-running."

And in §13, change "must continue to pass" to "must continue to pass after the canary-commit-scoped updates documented in §15 commit #2." The Z2 spec considers the wrapper width a load-bearing layout constraint; the Z1 spec must too.

---

### P0-5. Type-B destination sheets cover Z1 — spec is silent on whether they re-render their own Z1

**Location**: §2 visibility row + DESIGN_SYSTEM.md §8.

**Defect**: §2 lists Z1 visibility exceptions: "System Modals (Type D), splash screens, and any flow where dock visibility itself is suspended (e.g., `/arena` mid-match)." It does **not** address Type-B destination sheets.

But DESIGN_SYSTEM.md §8 specifies Type-B sheets render at `h-[100dvh]` with `pb-[5rem]`, opening from the dock. They cover the entire viewport including the Z1 strip. Today, that is fine — Z1 doesn't exist outside the play-hub canary. After this spec lands and Z1 begins migrating to other screens, Type-B sheets opened from those screens **will obscure Z1**.

Three sub-questions the spec must answer:

1. When the user opens Shop (Type-B) from `/play-hub`, does Z1 disappear from the screen because the sheet covers it? If yes, identity persistence (the spec's stated goal in §1: "where the player checks 'am I logged in, am I PRO, am I myself' between exercises") is broken at exactly the moment the player evaluates a purchase.
2. Should Type-B sheets render their own Z1 strip? If yes, that is a `<GlobalStatusBar />` instance inside a sheet — but §3 says "no nested status bars" and §6 dev-warning fires on duplicate mounts.
3. If Z1 does NOT live inside Type-B sheets, the §1 problem statement is not solved for the most common conversion surface (Shop).

§16 Q3 vaguely raises this ("Are there any screens (Type-B sheets, Type-D modals) that should also mount Z1 in v1...?"), but defers it to the reviewer.

**Fix (smallest)**: Add to §2 a row for Type-B sheets:

> "Type-B destination sheets (Shop, Badges, Trophies) **do not** render Z1 in v1 — the dock owns return-to-context, and Z1 identity persistence is reached by closing the sheet. A future spec may add a `<SheetHeader />` primitive that re-renders abridged identity (handle pill only, no PRO state) at the sheet top; out of scope for this v1."

This explicitly resolves the silence and prevents an implementer from "helpfully" mounting Z1 inside a sheet.

Add to §3 non-goals: "Identity persistence inside Type-B sheets is NOT a v1 goal."

---

### P0-6. `onProTap` 60-day deadline has no named owner, no escalation channel, no enforcement

**Location**: §6.1 transitional debt tracker.

**Defect**: The deadline reads:

> "**60 days from the canary deploy date OR Shop PRO sub-section ships, whichever comes first.** If 60 days elapse without resolution, escalate to Wolfcito for explicit re-approval; do not let the debt drift silently."

Three holes:

1. **No named owner.** Sally drafts the spec, Wolfcito approves, but who watches the 60-day clock? "Reviewers are expected to flag this section in any future PR that touches Z1" — that is a passive trigger that fires only if a future PR touches Z1. If no PR touches Z1 for 60+ days (which is exactly what would happen if the canary is stable and no migration has started), the deadline silently expires.
2. **"Escalate to Wolfcito" has no channel.** Slack? GH issue? Spec amendment? The Z2 ContextualHeader spec landed an "Amendment log" pattern; the Z1 spec uses the same pattern but doesn't say where Wolfcito's re-approval gets recorded.
3. **Same trap as Z2.** ContextualHeader's `MissionDetailSheet` debt (§8 + acceptance #11) deferred destination to "Phase 2 follow-on PR" with the same soft language. Per `DESIGN_SYSTEM.md` §10.6 Phase 2 carry-forward, that debt is still open at this date (2026-05-02) — the migration to "piece-picker sub-tab" is **listed as deferred**. So the precedent is: "soft deadline + escalation language" produces persistent debt, not closure.

**Fix (smallest)**:

1. **Name the owner**: add to §6.1 row 1: "**Owner: Wolfcito.** Sally drafts a calendar reminder in the project tracker on canary deploy day."
2. **Define the channel**: add: "Escalation = a new section in the spec's Amendment log titled '60-day debt re-approval' with explicit rationale. No re-approval = the debt is hard-closed by removing `onProTap` and the inactive PRO pill on day 61, with a follow-up canary if Shop PRO has not shipped."
3. **Bind to a calendar artifact**: add an acceptance criterion: "Commit #2 (canary) message includes the literal string `pro-tap-debt-due-by: <YYYY-MM-DD>` (canary deploy + 60 days). A grep for that string at any future Phase-2 review surfaces the deadline."

Without these, the 60-day deadline is decorative — same trap that left the Z2 `MissionDetailSheet` debt unresolved.

---

## 3. P1 findings — close before merging the canary

### P1-1. `useProStatus` cannot be enforced as the single source of truth across screens

**Location**: §12 risks row #3 + §10 contract #4.

**Defect**: Mitigation: "All screens that mount Z1 must derive `proStatus` from the same hook (`useProStatus(address)`). Documented in §10 and §10.7 of DESIGN_SYSTEM.md. Reviewer checks that no screen invents its own PRO fetch path."

This is a process-only guardrail. There is no:

- Lint rule against `fetch('/api/pro/status', ...)` in `app/**/page.tsx`.
- TypeScript barrier (the hook is a public export from `lib/pro/use-pro-status.ts`; nothing prevents a parallel implementation).
- Cache-layer invariant (the hook does no caching per its own comment "v1 has no caching layer, so two parallel fetches are acceptable for the canary day").

If `/arena` adopts Z1 in a follow-on commit and someone calls `fetch('/api/pro/status?wallet=...')` directly from a server component to avoid the client hydration cost, Z1 on `/arena` and Z1 on `/play-hub` will show **legitimately different state** (server-cached vs client-fresh). The spec's risk mitigation prevents zero of this.

**Fix**: Either:

- **Promote to a CI grep check** alongside the §15 commit #4 docs: `scripts/check-pro-fetch.sh` that fails CI on any `app/**/*.tsx` containing `pro/status` outside `lib/pro/use-pro-status.ts`. One-line Bash, no lint plugin.
- **OR explicitly accept the risk** and add to §12 risks #3 a "Status: process-only mitigation; promote to CI when the second screen migrates."

Right now the mitigation reads stronger than it actually is.

### P1-2. PRO inactive "muted/outline" treatment is two implementers shipping two different looks

**Location**: §8 inactive row + §9 right cluster prose.

**Defect**: §8 inactive row says:

> "Treatment options: low-contrast text + thin outline (`text-white/40 ring-1 ring-white/15`), tuned during visual QA so it reads as *passive status* rather than *call to action*."

"Tuned during visual QA" is not a contract. Two implementers given the same prose will ship:

- Impl A: `text-white/40 ring-1 ring-white/15` literally.
- Impl B: `text-white/30 ring-1 ring-white/10` "because the original looked too prominent."

Then a third PR re-tunes back. Each tuning is "subjective and acceptable per the spec."

§9 hedges further: "Active state is gold and prominent (28×28 to ~110×28). **Inactive state is intentionally muted** — outline-only, low-contrast text, no gradient, no promotional copy."

**Fix**: Lock the treatment with explicit values. Add to §9:

> Inactive PRO indicator: exact treatment is `inline-flex items-center px-2 h-6 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/40 ring-1 ring-inset ring-white/15 bg-transparent`. The label text is `"PRO"` (from `GLOBAL_STATUS_BAR_COPY.proInactiveLabel` — currently missing, see P1-3). Visual QA confirms the resting hue against the canary background but does not re-tune the values. Any change requires a spec amendment.

Mention in acceptance §11 #3 that visual QA confirms (not chooses) the inactive treatment.

### P1-3. `GLOBAL_STATUS_BAR_COPY` keyset is incomplete

**Location**: §15 commit #1 keyset + §6.2 / §8 implicit references.

**Defect**: The proposed keyset is `{ guestLabel, ariaLabelConnected, ariaLabelAnonymous, proManageLabel, proViewLabel }`. The spec actually uses these strings without committing them to editorial:

| String referenced | Where | In keyset? |
|---|---|---|
| Wallet truncation pattern `0x1234…abcd` | §5 + §9 ASCII | No (helper in `lib/wallet/format`, not editorial) |
| Days suffix "PRO • Nd" / "PRO • 28d" | §8 + §9 | No (currently in `pro-chip.tsx` as `${days}d` + `PRO_COPY.statusActiveSuffix`) |
| "Expires today" / "Expires tomorrow" | implicit via `statusActiveSuffix(1)` reuse | Inherited from `PRO_COPY`, not duplicated — fine |
| Inactive PRO pill label `"PRO"` (when transitional debt exists) | §9 + §11 #3 | No |
| Skeleton `aria-busy` text | §6.2 + §7 | No |
| Wallet disconnect transition copy | §8 row 6 ("variant flips, no animation v1") | None visible — fine |
| Stale PRO dev warning message | §6 row 3 | Dev-only, not editorial — fine |

Real gaps:

1. **`proInactiveLabel: "PRO"`** — required for the inactive pill while transitional debt exists. Currently spec says "PRO" pill renders but does not put the string in editorial.
2. **`daysSuffix: (days: number) => string`** — Z1 will format days exactly like `pro-chip.tsx` does today, but the spec doesn't import `PRO_COPY.statusActiveSuffix`. Either reuse `PRO_COPY.statusActiveSuffix` (recommended; document the reuse) or add a new key.
3. **Skeleton accessible name** — §7 says "PRO indicator (when tappable per §6.1) is a `<button>`" but does not specify the `aria-label` on the **loading** state button. `pro-chip.tsx` today uses `aria-label={PRO_COPY.label}` with `aria-busy="true"`. Z1 should match; spec should document.

**Fix**: Add to §15 commit #1 keyset:

```ts
GLOBAL_STATUS_BAR_COPY = {
  guestLabel: "Guest",
  ariaLabelConnected: "Player status",
  ariaLabelAnonymous: "Anonymous status",
  proManageLabel: "Manage Chesscito PRO",  // mirrors PRO_COPY.label
  proViewLabel: "View Chesscito PRO",
  proInactiveLabel: "PRO",               // NEW
  proLoadingAriaLabel: "Loading PRO status",  // NEW — replaces aria-busy-only
} as const;
// daysSuffix: reuse PRO_COPY.statusActiveSuffix (documented).
```

And cite DESIGN_SYSTEM.md §10.2 invariant 12: "editorial.ts is the only place copy lives."

### P1-4. Layout-budget math at 360×640 is wrong by at least 8px

**Location**: §12 risks row #4.

**Defect**: The spec computes:

> "Z1 ≤ 40px + Z2 ≤ 64px + dock 72px = 176px overhead; minus Z4 (max 56px when present, 0 when empty) = 232px max → leaves 408px for Z3 on 640px tall device."

Three issues:

1. **Safe-area insets ignored.** §9 specifies `pt-[calc(env(safe-area-inset-top)+0.25rem)]` for Z1. On iOS Safari the system status bar insets ~44px. On Android Chrome (Pixel 4) the inset is ~24px. So Z1's effective contribution is ~64px on iOS and ~64px on Android, not 40px. The spec measures "content height" but the layout cost is "content + inset."
2. **Bottom safe-area inset for the dock is ignored.** Dock is 72px content + `env(safe-area-inset-bottom)` (~34px on iOS notch devices). So the dock's effective contribution is up to 106px on iOS.
3. **Splash overlay (z-80) and welcome overlay** slide in over Z1+Z2 in §10's canary code (the `<WelcomeOverlay>` and `{showSplash && <Splash />}` siblings). These overlays don't subtract from the budget but they DO create stacking conditions that the math doesn't account for: when both are visible during onboarding, Z1+Z2 are present in the DOM but covered, so layout shift on dismissal can momentarily push Z3 around.

Real worst case on iOS Pixel-4-equivalent (Safari, 360×640):

- Z1 (36 + 44 inset) = 80px
- Z2 (64 max) = 64px
- Dock (72 + 34 inset) = 106px
- Z4 (56 max) = 56px
- Total overhead = 306px
- Remaining for Z3 = 334px

That is below the spec's claimed 408px and below the §14 visual-QA expectation that "board still ≥ 380px."

**Fix**: Add a corrected math row to §12 risks #4:

> "On iOS notch devices at 360×640: Z1 (36 content + ~44 safe-area-top) + Z2 (64) + dock (72 content + ~34 safe-area-bottom) + Z4 max (56) = ~306px overhead → ~334px for Z3, below the §14 'board ≥ 380px' target. Pixel-4-class Android without notches keeps the 408px figure. Visual QA must run BOTH Pixel-4 and iOS simulator; the 380px figure in §14 should drop to 330px on iOS or be qualified."

Also fix §14 row "`/hub` at 360×640 (Pixel 4): board still ≥ 380px" to "≥ 330px on iOS notch devices, ≥ 380px on Android."

### P1-5. Wallet-disconnect mid-fetch race condition not addressed by §6 dev-warning

**Location**: §8 row 6 + §6 dev-warning table.

**Defect**: §8 says: "Wallet disconnect mid-session — Parent flips to `variant="anonymous"`. Z1 re-renders with Guest. No animation v1."

The race: `useProStatus` is mid-fetch when the wallet disconnects. The hook's `useEffect` cleanup returns `controller.abort()` — good. But **the hook only aborts on `wallet` or `version` change**, not on the *parent component flipping variant*. A wallet disconnect that happens while the hook is in-flight will:

1. Parent flips `variant="connected"` → `variant="anonymous"`.
2. Z1 re-renders without `proStatus`/`isProLoading`/`onProTap` props (correct per anonymous discriminated union).
3. The previous `useProStatus` call's promise resolves, calls `setStatus({...})` and `setIsLoading(false)` on the parent, which is harmless (parent ignores those for anonymous render).
4. But: if the parent uses the resolved `proStatus` value to decide whether to show the PRO sheet (`<ProSheet open={proSheetOpen} ...>`), and the sheet is currently open, the user sees `<ProSheet>` UI lingering with stale data.

The spec's §6 dev-warnings catch height drift and stale `expiresAt`, but **not** the variant-anonymous-with-leftover-PRO-state case described above.

**Fix**: Add to §6 dev-warning table:

> "When `variant: "anonymous"` is rendered AND the parent's `proStatus` from `useProStatus` is still non-null AND the parent has `<ProSheet>` open: warn 'GlobalStatusBar: anonymous variant rendered with open PRO sheet — close the sheet on wallet disconnect.'"

This is not a Z1 internal issue — it's a parent-hygiene issue — but Z1 is the primitive that knows the user just went anonymous, so it's the natural point of detection.

Also add to §8 row 6: "Parent must close any open `<ProSheet>` synchronously on wallet disconnect (use the existing `address ?? null` watcher in `play-hub-root.tsx` as the trigger)."

### P1-6. Acceptance criterion #11 ("Z1 + Z2 combined ≤ 104px") is not testable as written

**Location**: §11 #11.

**Defect**: Reads:

> "The Z1 + Z2 combined budget invariant is codified in `DESIGN_SYSTEM.md` §10.1 in the same commit: 'Z1 ≤ 40px, Z2 ≤ 64px, combined ≤ 104px.'"

This is documentation, not an acceptance test. §13 E2E **does** assert it ("Z1 + Z2 combined height ≤ 104px") — that test is testable, but the acceptance criterion as written is "the docs say so."

Also: 40 + 64 = 104, but on iOS the combined effective height is 40 + 44 inset + 64 = 148px, far above 104. The invariant only works if "height" means content height, not layout height. The spec doesn't define which.

**Fix**:

- Reword §11 #11: "The Z1 + Z2 combined **content-height** budget invariant is codified in `DESIGN_SYSTEM.md` §10.1 in the same commit and asserted in the new E2E spec at §13 ('Z1 + Z2 combined ≤ 104px'). Note: 'content height' excludes `env(safe-area-inset-top)`."
- Update the §13 E2E to clarify it measures content height (use `header.evaluate(el => el.clientHeight - parseFloat(getComputedStyle(el).paddingTop))` or similar) so the invariant matches what the test actually checks.

### P1-7. Test coverage gaps — keyboard/RTL/focus-visible all absent

**Location**: §13 unit + integration sections.

**Defect**: §13 covers click and a11y label assertions. Missing:

- **Keyboard navigation** to the PRO indicator. Tab order: avatar (decorative, skip) → handle pill (text, skip) → PRO button. Spec doesn't assert the focus order or that the PRO button is reachable via `Tab`.
- **Focus-visible state**. The PRO button must have a visible focus ring for keyboard users. §9 visual layout shows no focus styling. §7 a11y is silent on focus.
- **Screen reader pronunciation of the wallet handle**. §7 says "wallet truncation reads naturally to screen readers because the `…` is between two `0x` segments — no special `aria-label` needed." This is **untested**. JAWS/NVDA may pronounce `0x1234…abcd` as "zero ex twelve thirty-four ellipsis ay bee see dee" or worse; verify or scope down to "no `aria-label` override; rely on default text reading."
- **RTL support**. §16 Q4 mentions RTL but §13 has no RTL assertion. Per Q4 the answer is "Chesscito does not currently support RTL"; if so, the spec should explicitly note that and add a `dir="ltr"` on the wrapper to be safe.

**Fix**: Add to §13 unit tests:

- "Keyboard test: Tab navigates from page content into Z1; the PRO button receives focus; `Enter` fires `onProTap`."
- "Focus-visible test: PRO button has a visible focus ring on `:focus-visible` (assert via `getByRole('button', { name: /PRO/i }).focus()` then check class or `outline` style)."

Add to §16 Q4 a definitive answer: "Chesscito does not support RTL in v1. Z1 sets `dir="ltr"` on its wrapper to prevent caller-driven RTL inversion. RTL becomes a follow-on spec when the i18n project demands it."

---

## 4. P2 findings — fix during implementation, not blockers

### P2-1. Discriminated-union spread escape in §13 fixtures

**Location**: §13 commented-out fixtures.

The fixtures (`proStatus={...}` on `variant="anonymous"`, etc.) test the **inline-literal** path. They do not document the spread-prop escape (P0-1). Add one fixture:

```ts
// PASSES the type check (defect — see P0-1):
// const x = { proStatus: ..., isProLoading: false, onProTap: () => {} };
// <GlobalStatusBar variant="anonymous" {...x} />
// Caught at runtime by the new dev warning per §6.
```

### P2-2. Avatar slot is `aria-hidden` but contains no `<img>` — silhouette is inferred

**Location**: §7 + §9.

§7: "Avatar (silhouette) is `aria-hidden=\"true\"` (decorative)."
§9: "avatar (28×28, candy silhouette)."

But the spec doesn't say what the silhouette is — a `<div>` with `bg-image`? An `<img>`? An SVG? `pro-chip.tsx` doesn't render an avatar today, so there's no precedent. The implementer will pick.

Fix: Specify exact element. Suggested: `<div className="bg-[url(...)] bg-cover" aria-hidden="true" />`. Reference an existing asset path (likely `apps/web/public/art/pieces/...`).

### P2-3. `data-component="global-status-bar"` is the only E2E selector — variant attribute missing

**Location**: §7 + §13.

The Z2 spec ships `data-variant="title-control"` (see contextual-header E2E line 29). Z1 doesn't. Without `data-variant`, E2E cannot distinguish anonymous vs connected state from selectors alone — must rely on text content (`"Guest"` vs `"0x..."`).

Fix: Add `data-variant="anonymous" | "connected"` to the wrapper. Update §13 E2E selectors accordingly.

### P2-4. §6.1 row 3 ("avatar uploader / selector") is misplaced

**Location**: §6.1 transitional debt tracker.

The row reads:

> "No real avatar — every connected user sees the candy silhouette."

This is not a debt; it's a **non-goal** (per §3 last bullet). Listing it in the debt tracker implies a deadline that doesn't exist ("No hard deadline.") and dilutes the table.

Fix: Remove the row from §6.1. Keep the non-goal in §3 and add to §10 contract change list as "future feature, not tracked."

### P2-5. ASCII layout in §9 conflates anonymous vs connected widths

**Location**: §9.

The first ASCII diagram shows "Guest" as the only content (anonymous). The second shows `0x1234…abcd` + "PRO • 28d" (connected active). Cluster widths differ (180px left max vs ~290px combined on connected). The spec doesn't say whether the strip's wrapper is `justify-between` (so anonymous's "Guest" sits left and right cluster is empty) or `flex-row gap-2` (so anonymous looks left-aligned with empty trailing space).

Fix: Add to §9: "Wrapper layout is `flex flex-row items-center justify-between px-2`. Anonymous variant renders the left cluster and an empty right cluster; the strip is balanced."

### P2-6. `walletShort` truncation helper imported from `@/lib/wallet/format` does not exist yet

**Location**: §5 runtime guard reference.

> "A truncation helper from `@/lib/wallet/format` will produce the canonical shape; manual misuse warns in dev."

Verified: `apps/web/src/lib/wallet/` does not exist as a directory in the repo (`pro-chip.tsx` doesn't import any wallet formatter; the `shortAddress(address)` call in §10 canary code is also undefined in the spec). The helper is fictional.

Fix: Either (a) point to an existing helper (e.g. `wagmi`'s `shortenAddress` or whatever `play-hub-root.tsx` uses today), or (b) add a §15 commit #1 subtask: "create `lib/wallet/format.ts` exporting `formatWalletShort(address: string): string`; unit test."

### P2-7. Migration plan reversibility — commit #2 cannot be cleanly reverted after commit #3

**Location**: §15 commits #2 and #3.

§16 Q14 raises this: "Is the rollback path in §15 clean? Specifically: can commit #2 be reverted independently of commit #3 if commit #3 has already merged?"

Answer per the spec's own ordering: **No.** Commit #3 deletes the `<ProChip>` source file. Reverting commit #2 (which removes the import + wrapper) without reverting commit #3 leaves `play-hub-root.tsx` with a re-imported `<ProChip>` symbol that no longer resolves → build break.

The spec frames commit #3 as risk-free ("Z1 fully owns the surface by canary commit"), which is true for the **forward** direction but ignores the **reverse** direction.

Fix: Add to §15 rollback triggers:

> "If rollback is required AFTER commit #3 has merged: must revert commit #3 first (restore `pro-chip.tsx`), then commit #2. Reverting commit #2 alone after commit #3 merges produces a build break. Commit messages should note this dependency."

Also: keep commit #3 unmerged for at least one canary cycle (e.g., 7 days post-canary) before merging, so the revert window stays clean.

### P2-8. Missing acceptance criterion: `<ProSheet>` open with anonymous variant

**Location**: §11.

If the user has `<ProSheet>` open and disconnects the wallet, what happens? §8 row 6 says "Parent flips to anonymous." Spec is silent on whether `<ProSheet>` should auto-close. (Related to P1-5.)

Fix: Add §11 acceptance #12: "On wallet disconnect, parent (`play-hub-root.tsx`) closes `<ProSheet>` synchronously; assert via E2E."

### P2-9. §16 Q15 is unanswered and the answer matters

**Location**: §16 Q15.

> "Does §8's 'wallet disconnect mid-session' handling actually need to flip variants, or could v1 simply unmount-remount Z1 to handle the transition?"

This is a real design call. Unmount-remount has the advantage of dropping any stale `proStatus`/`onProTap` references; flip-variant has the advantage of preserving identity strip layout (no flicker). Spec defers entirely to reviewer.

Fix: Pick one. Recommended: flip-variant (no flicker), with the parent close-`<ProSheet>` rule from P1-5. Document the choice in §8 row 6.

### P2-10. `ProSheet` is referenced but undefined at the spec level

**Location**: §3 last bullet + §6.1 row 1 + §10 canary code.

`<ProSheet>` is mentioned five times. Its current implementation in the codebase is at `apps/web/src/components/pro/pro-sheet.tsx` (inferred from `play-hub-root.tsx:1124`'s `setProSheetOpen`), but the spec does not link to it. A reader hitting the spec mid-stream cannot tell whether `<ProSheet>` is a Type-B destination or a Type-C quick-picker.

Fix: Add to §1 problem statement: "PRO management today opens `<ProSheet>` (Type-C quick-picker; see `apps/web/src/components/pro/pro-sheet.tsx`). The Z1 transitional `onProTap` preserves the existing tap-to-open path."

---

## 5. Optional opportunistic improvements

- **5-O-1.** §11 acceptance #6 mentions Playwright `--update-snapshots` and "PR diff reviewed against §14 matrix." Tighten: require a screenshot-of-the-diff in the PR body (PNG) so reviewers don't have to fetch artifacts. Same convention used by `bmad-checkpoint-preview` skill.

- **5-O-2.** §15 commit #4 ships docs as a trailing commit. The Z2 spec's red-team review (P2-9) flagged this exact pattern as wrong; the Z2 v1 amendment moved DESIGN_SYSTEM.md §10 docs into commit #1. The Z1 spec **does** ship §10.7 + §10.1 docs in commit #1 already (acceptance #10 + #11). But commit #4 is a **second** docs commit that just adds the "Phase 2 follow-ons" subsection. Could fold into commit #1 or commit #2.

- **5-O-3.** Spec doesn't define what happens when `address` is present but `useProStatus` returns `status: null` *forever* (e.g., persistent network failure). The hook coerces network errors to inactive, so this case shouldn't occur — but if it does, the skeleton renders forever. Add a 5-second timeout that flips the skeleton to "inactive" with a dev warning. Defensive depth, not a P0.

- **5-O-4.** §12 risks row #6 ("`useProStatus` is invoked twice"): "Low / Low" is generous given that `pro-chip.tsx` and the new Z1 both call the hook with the same wallet for the duration of canary commit #2. Two parallel `fetch('/api/pro/status?wallet=...')` per render cycle is benign but visible in network tab — note it explicitly so a user inspecting the build doesn't open an issue.

- **5-O-5.** §13 E2E covers `/hub` only. After other screens migrate, `/hub` is no longer the canary — add to §13 a note: "Per-screen migrations extend this E2E with `${screen}-global-status-bar` describe blocks; the assertions are reused via a shared `expectGlobalStatusBarAt(screen)` helper. Out of scope for v1 PR."

- **5-O-6.** §3 non-goals is excellent ("No avatar uploader," "No mid-screen mount/unmount," etc.). Add one more: "**No telemetry events fired by Z1 itself.** Today `pro-chip.tsx` fires `pro_card_viewed` and `pro_cta_clicked`. Z1 inherits no telemetry — the parent fires `pro_cta_clicked` from its `onProTap` handler if it wants the event. This keeps Z1 a pure layout primitive." Without this, the implementer will absorb `pro-chip.tsx`'s telemetry into Z1 by reflex.

---

## 6. Out-of-scope flags — items deferred but needing a hard owner

| Item | Spec section | Current handling | Recommended hard owner |
|---|---|---|---|
| 60-day `onProTap` deadline | §6.1 row 1 | Soft escalation, no calendar artifact | **Wolfcito**, with the calendar reminder + commit message hash mentioned in P0-6 |
| `--redesign-wood-gold` semantic coupling | §11 #3 | "Verify during visual QA" | **Sally**, in the v1 amendment that closes P0-3 — pre-commit `--pro-ring-gold` |
| Per-screen Z1 migration (`/arena`, `/trophies`, `/leaderboard`, secondary) | §6.1 row 2 + §10 contract #5 | "Each commit has its own visual QA" — no deadline | **Wolfcito**, list in `DESIGN_SYSTEM.md` §10.7 with a quarterly review cadence |
| Avatar provider (ENS / Talent / Farcaster) | §6.1 row 3 (misplaced — see P2-4) | "Future spec" — no deadline | Leave deferred; remove from debt tracker |
| `<ContextualActionRail />` (Z4 primitive) | §1 related primitives | Not started | **Wolfcito** to schedule after Z1 migration is at 3+ screens; do not start in parallel |
| Coach-streak / global-streak data system | §3 non-goals | "Defer until a real global-streak data system is specified" | Product spec lead (TBD); no UI work until then |
| Type-B sheet identity persistence (P0-5) | §2 (silent) | Not addressed | **Sally**, future spec for `<SheetHeader />` after this primitive lands |

---

## 7. Final note

Closure looks like:

1. **Spec amendment** that closes the 6 P0 items in §2 above, lands as a single commit on `main` (same pattern as the Z2 v1 amendment). Estimated time: ~45 minutes of doc work.
2. **15-minute re-review pass** (skill: `bmad-review-adversarial-general` or this same persona) to verify the amendments actually close each P0 — same pattern as `contextual-header-spec-red-team-followup-2026-05-01.md`.
3. **Then commit #1** of the implementation plan, with the §11 acceptance criteria tightened per P1-6 and the test plan extended per P1-7.

P1 items should land in the same v1 amendment to avoid trickle re-reviews. P2 items can defer to the amendment log if the author wants to preserve the v0 → v1 separation strictly.

**Recurring pattern to watch**: this is the second Z-primitive spec from Sally and the second one to ship with a transitional debt that points at "Phase 2 follow-on" with no calendar enforcement. The Z2 `MissionDetailSheet` debt is **still open at 2026-05-02** per `DESIGN_SYSTEM.md` §10.6. If the Z1 `onProTap` debt follows the same trajectory, Wolfcito will own a "transition" `onProTap` for 6+ months. P0-6 must close hard, not soft.

The spec is strong. Close the 6 P0 items, tighten the 7 P1 items, ship.

— Adversary
