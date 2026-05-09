# Hub Redesign — Phase 1 Design Lock Red-Team

**Reviewer**: Winston (System Architect) — adversarial pass via `bmad-review-adversarial-general`
**Date**: 2026-05-09
**Subject**: `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md`
**Status**: 🔴 RED-TEAM COMPLETE — 6 P0 + 13 P1 + 17 P2 findings; spec MUST address P0/P1 before Phase 3

---

## 0. Methodology

Three adversarial lenses applied in parallel, then deduped + triaged:

1. **Architecture lens** — flag mechanics, port plan, atmosphere state machine, server/client boundary
2. **Edge-case lens** — orphan states, MiniPay quirks, motion math, a11y compliance
3. **Acceptance audit** — does the Phase 1 spec actually deliver what discovery §12 locked?

**Triage rubric**:
- **P0**: contradicts the spec internally, breaks a locked decision, or violates a hard standard (WCAG, type contract). Fix BEFORE Phase 3.
- **P1**: under-specified contract that will surface as bug during implementation. Fix DURING Phase 3-7.
- **P2**: known risk worth tracking; not a blocker.

**Tone**: skeptical, professional, blunt. The spec is largely solid — these findings are the seams under load.

---

## 1. Executive summary

| Severity | Count | Disposition |
|---|---|---|
| P0 — blocks Phase 3 | **6** | Patch spec before Phase 2 sign-off |
| P1 — fix during impl | **13** | Capture in Phase 3 work tickets |
| P2 — carry as risk | **17** | Add to §11 risks register |
| False positives | 1 | Documented for completeness |

**Overall verdict**: 🟡 **Spec is conditionally approved.** The locked decisions are honored, layouts are concrete, and the TDD plan is credible. But there are 6 P0 issues — including one **material gap** (a non-existent primitive size invoked) and one **WCAG-blocker** (splash auto-dismiss) — that must be patched. Estimated patch effort: ~2 hours of spec edits, no design rework.

---

## 2. P0 findings — block Phase 3

### P0-1 — `<TreasureTile size="medium">` does not exist 🚨 MATERIAL GAP

**Where**: §1.3 mastery dashboard tile composition.

**Issue**: Spec prescribes `<TreasureTile size="medium">` for each of the 6 mastery tiles. But `DESIGN_SYSTEM.md §16.1` defines `<TreasureTile>` with sizes `small | large` only. There is no `medium` variant in the primitive contract.

**Impact**: Code referencing `size="medium"` will fail TypeScript compilation. Implementation cannot start.

**Options**:
- (a) Add `medium` to `<TreasureTile>` size matrix — out-of-scope for this redesign per locked Phase 1 boundary
- (b) Use `size="small"` (88×100 per §16) — tiles become smaller; layout math redoes
- (c) Use `size="large"` (120×136) — exceeds the 110×130 spec; may overflow 390px viewport
- (d) Pick a different primitive — `<StonePedestal>` has `small | medium | large` per §16.1

**Recommended fix**: Option (b). Use `<TreasureTile size="small">` and recalculate grid math: 88×3 + 12×2 + 32 padding = 320px ≤ 390px ✅ with 70px buffer. Update §1.3 dimensions accordingly.

### P0-2 — Splash asset contradicts itself

**Where**: §1.1 says "Knight piece (`b-knight.webp` at 50% opacity)" — reused. §3.2 lists `splash-knight-hero.webp` ≤ 6 KB as **new asset**.

**Issue**: Hard contradiction. Either we reuse `b-knight.webp` (zero new bytes) or we ship a new 6 KB asset.

**Impact**: 6 KB of budget either spent or not. Asset manifest is the contract for Phase 3 — this MUST be unambiguous.

**Recommended fix**: Pick one. If reusing `b-knight.webp` (35 KB raw — the full piece sprite is sized for board cells, not splash hero), perf will suffer. **Strong recommendation: keep `splash-knight-hero.webp` as a new 6 KB hero-cropped asset, remove the §1.1 mention of `b-knight.webp`.** Update §3.1 to remove the contradiction.

### P0-3 — Splash auto-dismiss violates WCAG 2.2.1 (Timing Adjustable)

**Where**: §1.1 splash overlay.

**Issue**: Splash auto-dismisses at 3.5s with no user control to pause, extend, or disable the timing. WCAG 2.2.1 requires that for any time-limited content, the user can: (a) turn off the time limit, (b) extend it to ≥10× the default, OR (c) be warned with ≥20s to extend. None of these mechanisms exist.

The exception "Essential" doesn't apply — a welcome splash is not essential to the activity. The exception "Real-time" doesn't apply either.

**Impact**: A11y compliance failure. Will fail any audit (red-team `ux-review`, automated axe scan, screen-reader testing).

**Recommended fix**: Two acceptable patterns:
1. Remove auto-dismiss entirely; require tap to dismiss (with the entrance animation completing automatically). Keeps the cinematic moment, removes the timer.
2. Keep auto-dismiss BUT respect `prefers-reduced-motion` AND offer a "Don't show again" tap target alongside the dismiss tap.

Option 1 is simpler and aligns with discovery's "Splash A — first-ever-visit" intent (the localStorage flag already prevents re-show, so removing auto-dismiss costs nothing).

### P0-4 — Atmosphere palette WCAG contrast not certified

**Where**: §1.5 Training Pass active state and §7.2 `[data-hub-v2][data-pro-active]` palette swap.

**Issue**: Spec swaps `--hub-bg: var(--stone-900)` → `var(--wood-900)` and `--hub-accent: var(--stone-500)` → `var(--wood-500)` on PRO active. The contrast ratio of `--wood-900` BG against text + `--wood-500` accent against BG is unspecified. WCAG AA requires 4.5:1 for normal text, 3:1 for large text + UI components.

**Impact**: A PRO subscriber gets a worse-contrast hub than a free user. PRO is a paid feature — degrading accessibility for paying users is the inverse of the desired signal.

**Recommended fix**: Before Phase 7, run contrast measurement on every text/icon pair in the warm-wood palette. Document the ratios in §1.5 as a verified table. If any pair fails AA, propose the recolor (likely darken the BG or lighten the accent until compliant).

### P0-5 — Sheet receipt callback contract undefined

**Where**: §6.1 ports table — "receipt close → atmosphere shift fires if purchase".

**Issue**: The mechanism by which a successful PRO purchase signals the hub to atmosphere-shift is unspecified. Is there an `onPurchaseSuccess` callback prop on `<ProSheet>`? Does the hub subscribe to wagmi receipt events directly? Does the sheet emit a custom DOM event?

The current V1 `<ProSheet>` uses `onClose()` only — receipt success is not externally observable from the sheet.

**Impact**: Phase 3 commit #1 (`pro-sheet-port.test.tsx`) asserts "close after purchase fires `hub_atmosphere_shift` event with `trigger: 'purchase'`" but the test cannot be written without a defined contract. Implementation will guess and likely diverge.

**Recommended fix**: Add §6.4 "Sheet → Hub callback contract":
```ts
type ProSheetProps = {
  // existing props...
  onPurchaseSuccess?: (receipt: { txHash: string; daysGranted: number }) => void;
};
```
Hub uses this callback to trigger atmosphere shift + telemetry. Same pattern for `<ShopSheet onPurchaseSuccess>` (shields refresh).

### P0-6 — `URLSearchParams` type mismatch in `resolveHubVariant`

**Where**: §7.1 code sample.

**Issue**: Sample signature `resolveHubVariant(searchParams: URLSearchParams)`. But Next.js 14 App Router server components receive `searchParams` as `{ [key: string]: string | string[] | undefined }`, not a `URLSearchParams` instance.

**Impact**: Compile error at the page level. Phase 7 cannot ship as written.

**Recommended fix**: Update §7.1 to:
```ts
type SearchParamsLike = { [key: string]: string | string[] | undefined };
export function resolveHubVariant(searchParams: SearchParamsLike): "v1" | "v2" {
  const explicit = searchParams.hub;
  const value = Array.isArray(explicit) ? explicit[0] : explicit;
  if (value === "v2") return "v2";
  if (value === "v1") return "v1";
  return HUB_V2_DEFAULT ? "v2" : "v1";
}
```

---

## 3. P1 findings — fix during implementation

### P1-1 — `[data-hub-v2]` SSR/hydration flicker
§7.2 sets the body attribute "on mount (cleared on unmount)" — implying client-side. During SSR-to-hydration window, the warm-wood palette doesn't apply. Result: white-flash → warm-wood transition on every cold page load. **Fix**: emit `[data-hub-v2]` from the server component wrapper at SSR time; client just preserves it.

### P1-2 — Receipt arrives during sheet close animation (race)
ProSheet close animation runs ~300ms. If the wagmi receipt resolves DURING that window, atmosphere shift fires while the sheet is still visually present. Visual jank. **Fix**: defer atmosphere shift to `onAnimationEnd` of the sheet exit transition, OR queue it via `requestAnimationFrame` after sheet unmount.

### P1-3 — Receipt-after-cancel: receipt fires but hub has dismissed sheet
If the user closes ProSheet before tx confirmation but the tx still confirms (Celo finality is fast but not instant), the hub doesn't know to atmosphere-shift. **Fix**: hub-level wagmi subscription to PRO contract events, independent of the sheet's lifecycle. Document in §6.4.

### P1-4 — Promote criterion #1 normalization undefined
§7.4 compares `hub_v2_play_dock_tap` rate ≥ `hub_play_tap` rate. "Rate" is undefined: per session? Per unique wallet? Per render? **Fix**: pin to per-unique-wallet-per-day. Also: V1 and V2 user populations are disjoint during the flag window (a user sees one or the other), so the comparison is between cohorts, not within. State this explicitly.

### P1-5 — MiniPay localStorage fallback (Lock 3 violation risk)
Splash A is "first-ever-visit only". MiniPay WebView has documented localStorage reset behaviors. If the flag clears on session restart, splash re-shows — violating Lock 3. **Fix**: layer two persistence mechanisms: (a) localStorage as primary; (b) a server-side `splash_seen` boolean keyed by wallet address as fallback. On any positive signal, splash skips.

### P1-6 — Mastery tile width buffer
Reverts after P0-1 fix (88px tiles → 320px content + 32 padding = 70px buffer). After fix this becomes a non-issue. **Fix**: track that P0-1 resolves this.

### P1-7 — Sticky dock inside `flex-1` scroll container
§1.4 says dock is `position: sticky; bottom: 0` "within the scroll container". But §1.3 mastery dashboard is `flex-1 + overflow-y-auto` — sticky inside a scrolling parent sticks to the parent, not the viewport. **Fix**: anchor the dock at the `100dvh` outermost flex container's footer slot, NOT inside the mastery scroll container. Restate §1.4 layout hierarchy.

### P1-8 — Tone filter selector contract undefined
§3.1 lists CSS variables for state-tones (`--mastery-state-mastered`, etc.) but doesn't say HOW the variable resolves on the tile. Is it `[data-state="mastered"]` on the tile? A tile prop that maps to a class? **Fix**: §3.1 explicitly: tile uses `data-mastery-state="<state>"` attribute; CSS selector `[data-mastery-state="mastered"]` applies the filter.

### P1-9 — `<PrimitiveBoundary>` for V2 not specified
V1 wraps every primitive in `<PrimitiveBoundary>` (single-primitive crash isolation). V2 spec mentions zero error boundaries. **Fix**: §1 layouts explicitly: each of (HUD, mastery grid, training band, dock) wrapped in `<PrimitiveBoundary>`. Splash wrapped in its own boundary.

### P1-10 — Wallet disconnect in V2 not enumerated
V1's chip behavior changes on `useAccount().address` flip. V2 spec doesn't address this for any of: trophies chip, PRO chip, mastery tiles (which derive from on-chain badge state), shield ribbon. **Fix**: §1.2 + §1.3 + §1.4 explicit fallbacks for disconnected state — likely "show empty/zero values, render Connect chip prominently".

### P1-11 — Splash keyboard focus + tab order
§1.1 says "Focus trap NOT required because there are no interactive elements." But the splash IS interactive (tap-anywhere). Tab navigation should land on a dismiss target. **Fix**: render the dialog with `tabindex="-1"`, autofocus on a hidden "Dismiss" button that handles Enter/Space. Visually unchanged.

### P1-12 — `coming-soon` 30% opacity contrast failure (sighted-only users)
Q/K tiles render piece art at 30% opacity with diagonal "soon" stamp. ARIA label exists for screen readers. But sighted low-vision users without screen readers will see unreadable content. **Fix**: increase opacity to 60% AND show "Coming soon" sub-label at full text contrast. The piece sprite can stay dim; the LABEL must be readable.

### P1-13 — `hub_v2_view` thin payload
Single boolean (`proActive`) is insufficient for funnel analysis. Add: `streakDays`, `totalStarsEarned` (sum across pieces), `shieldsCount`, `splashSeen` (whether splash has been dismissed). All values are already client-side; cost is ~50 bytes per event. **Fix**: extend payload in §5.

---

## 4. P2 findings — known risks, track in §11

### P2-1 — Tap-dismiss minimum latency 1.8s on splash
Tap-anywhere "skips dwell, runs 0.6s exit" but entrance is 1.2s and not interruptible. Impatient onboarders see 1.8s tap-to-disappear. Mitigation: tap during entrance kills the entrance and runs exit immediately (total ~600ms).

### P2-2 — Streak collapse layout shift
When streak is 0, the streak label collapses to "" but spec doesn't define if the mastery grid shifts up. Lock the answer: yes, grid shifts (no fixed slot for empty streak).

### P2-3 — Mission stars vs mastery stars conflation
V1 had separate `<StarsChip>` for mission stars (`current/total`) and per-piece star counts. V2 collapses both into per-tile stars. They're different concepts. **Either** mission stars get a new home **OR** the spec acknowledges they're deprecated.

### P2-4 — ARIA template literal scope sketch typo
§2.2 `aria-label` template uses `current/total` outside the closure. Cosmetic; fix at impl time.

### P2-5 — Dock idle-pulse cognitive load (peripheral attention magnet)
Pulsing PLAY CTA pulls eyes constantly. Mitigation in §11 (battery) but not cognitive. Recommend: pulse only when user has been idle 4s+ on the page, OR pulse every Nth visit not always.

### P2-6 — Shield ribbon visual asymmetry
Right-aligned ribbon over centered links. Either justify links left/right too, or center the ribbon, or accept asymmetry as a deliberate "alert here" cue.

### P2-7 — Dock height growth undefined when shields ribbon present
Dock 96px hard cap; shield ribbon adds ~20px. Either dock is ≥116px when shields visible, or ribbon overlays without growing. Pick one.

### P2-8 — "Wax-seal HUD" perk weak as marketing
Inactive Training Pass list bullets gameplay perks (Coach + sessions) and one cosmetic (HUD). Cosmetic-as-perk is fine if framed as "membership signal", less fine if framed as functional value. Editorial review.

### P2-9 — Renews date format timezone undefined
`renewsFormat: (mmdd: string) => "Renews 6/3"` — timezone? US convention? ISO? Lock to user's local timezone, US display.

### P2-10 — Wood-banner-warm 22 KB cap unjustified vs current 16.3 KB
+5.7 KB for a tone variant is high. Could likely ship at 18 KB. Track as budget tightening opportunity.

### P2-11 — AVIF skipped for new assets
WebP-only for `wood-banner-medium-warm` and `splash-knight-hero`. AVIF gives ~30% reduction. Add AVIF to pipeline for these two.

### P2-12 — Motion "500ms × 2.4" math ambiguous
Is 1200ms a single longer pulse, or 2.4 cycles of 500ms? Lock the wording.

### P2-13 — Atmosphere shift CSS transition cascade
`background-color` + `color` transition on the parent doesn't auto-cascade to SVG `currentColor`. Verify visually during Phase 6.

### P2-14 — Splash dismiss telemetry missing 3rd method
`method: "auto" | "tap"` doesn't cover route-navigation-away (Android back, deep link). Add `"navigation"` method.

### P2-15 — Promote criteria expansion (1 → 4) not flagged in §12
Discovery §12 + §11 expected 1 criterion (telemetry parity). Phase 1 spec defines 4. Stricter is fine but should be called out as a spec evolution, not a quiet expansion.

### P2-16 — Commit count delta (28-30 → 18) under-justified
Spec attributes the compression to "3 sheets vs 6+ surfaces" + scene-rooted reuse. Fair, but deserves a 2-line justification in the spec rather than a parenthetical.

### P2-17 — DESIGN_SYSTEM amendment scope creep risk
§8 amendment defines anchor flexibility "wherever it appears — canvas, dock, modal." Other surfaces using `<PrincipalButton>` may now claim dock-anchor as an option. Document the rule's bounds: dock-anchored is acceptable only when the canvas serves a "higher-frequency surface" — define what "higher-frequency" means (mastery dashboard counts; a static info page does not).

---

## 5. False positive (documented)

### FP-1 — "Splash localStorage namespace collision" (§11 risk #1)
The spec already mitigates this in §11. Re-flagging would be redundant. Risk #1 is correctly scoped. No further action.

---

## 6. Strengths worth naming

Adversarial review is mostly fault-finding, but a fair reviewer also names what holds:

- **Locked decisions are honored 8/8**. Every decision in discovery §12 maps to a concrete prescriptive section. No drift.
- **Asset budget arithmetic is honest**. 148 + 30 = 178 KB exact-fit, no fudging. Ceilings are explicit.
- **TDD plan is concrete**. 9 specs with stated assertions per file — implementable as written (after P0/P1 patches).
- **Rollback playbook exists** with explicit step count and failure modes.
- **§8 DESIGN_SYSTEM amendment is well-bounded**. Anti-pattern + canonical anchor matrix is the right shape for a system rule.
- **Reused-primitives strategy compresses scope**. The 18-vs-30 commit delta is real even if under-justified.

---

## 7. Recommended actions before Phase 2 sign-off

**Before any approval to start Phase 3**:

1. ✅ **Patch the 6 P0 findings** in the design-lock spec. Estimated: ~2 hours of edits, no design rework.
2. ✅ **Capture the 13 P1 findings** as work-ticket annotations in §10 phase exit criteria — each P1 becomes an explicit deliverable for its owning phase.
3. ✅ **Fold the 17 P2 findings** into the spec's §11 risks register (currently 7 items).
4. ✅ **Add §6.4 "Sheet → Hub callback contract"** with the `onPurchaseSuccess` typing.
5. ✅ **Run a contrast pass on the warm-wood palette** before Phase 7. Add a contrast-ratios table to §1.5.

After patches: spec moves from 🟡 conditionally approved → 🟢 ready for Phase 3 implementation.

**Estimated time-on-spec to clear all P0/P1**: 3-4 hours of focused editing.

---

## 8. Sign-off ledger update

| Step | Status | Date | Note |
|---|---|---|---|
| Discovery (Phase 0) | ✅ Complete | 2026-05-09 | — |
| Design lock (Phase 1) — initial | ✅ Complete | 2026-05-09 | — |
| Red-team (Phase 2) | ✅ Complete (this doc) | 2026-05-09 | 6 P0 + 13 P1 + 17 P2 findings |
| Phase 1 P0 patches | ✅ Landed | 2026-05-09 | Sally: P0-1/2/3 · Winston: P0-4/5/6 |
| Wolfcito sign-off on patched spec | ⏳ Pending | TBD | Reviews spec + this report |
| Implementation (Phases 3–9) | ⏳ Blocked on sign-off | TBD | — |

---

**End of red-team report.** All P0 findings are now patched in the design-lock spec (see its patch ledger). P1 findings carry into Phase 3 work tickets; P2 findings ride alongside as risks. Next action: Wolfcito sign-off → Phase 3 (heavy ports) begins.
