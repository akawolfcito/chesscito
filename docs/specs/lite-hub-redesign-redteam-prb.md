# Red-team — lite-hub-redesign (PR B / presenter)

**Date**: 2026-06-26
**Scope**: Adversarial pass on `lite-hub-redesign.md` focused on the **Lite
presenter (PR B)** — layout, asset, MiniPay, and i18n risks the first red-team
(`lite-hub-redesign-redteam.md`, delivery-ordering P0-1/2/3) did not cover.
Findings grounded against current code, not the spec text.

## P1 — resolve BEFORE starting TDD

### P1-A · Vertical fold budget unspecified (this is the original bug)
This whole thread started because **Join Challenge / the season pass fell below
the fold**. The target stacks, top→bottom at 390px wide: HUD row + mascot oval +
a **tall** challenge card (title + 9–21 dot row + 3 stat tiles + Join CTA) +
Start Focus + horizontal Training Path. In a MiniPay WebView (~600–700px usable
height) this very likely overflows. The spec never budgets vertical space or
states a scroll policy, so the implementer can re-create the exact bug.
**Resolve**: define a vertical budget; decide scroll-vs-fit; state what MUST be
above the fold (at minimum Start Focus + Join Challenge). Shrink the mascot/oval
height to buy room. Add an acceptance check.

### P1-B · `HubDailyTile` cannot be the "corner gift icon" unchanged
Spec: "Daily gift (`HubDailyTile`) → Top-right corner icon … delegated to
HubDailyTile, **unchanged**." Reality: `HubDailyTile` is a 308-line stateful
component that renders a full `HubActionTile` + status chip and owns the daily
tactic sheet, welcome-package modal, first-focus overlay, solve handlers and
telemetry. It will **not** render as a small corner icon. Reuse-unchanged
contradicts the corner-icon zone. **Resolve**: either add a compact/icon trigger
variant (new work — call it out, it breaks "no new asset / unchanged"), or split
a lightweight gift-icon button that opens the same sheet. Decide before Stage 2.

### P1-C · Start Focus label is English-only → breaks i18n parity AC + hard rule
Spec drives the Start Focus label from `contentLoopAction`. But
`ContentLoopAction` exposes **`ctaEN` / `subEN`** (English literals — see
`next-step-card.tsx:22`). The spec's own AC requires "editorial.ts +
messages/{en,es} parity, no inline strings", and `[[feedback_i18n_key_parity]]`
is a hard rule. Sourcing the label from `ctaEN` ships an untranslated Start
Focus button. **Resolve**: i18n the content-loop labels (new keys in
editorial.ts + en + es) or map the Start Focus label from a new i18n'd
variant→key table; do not read `ctaEN` directly. Add ES coverage to the tests.

## P2 — resolve during implementation

### P2-D · Mascot oval/frame integration path undefined
`avatar-lite-hub.png` is a **1014×1138 transparent portrait** — not the framed
composition. The gold oval + CHESSCITO banner + flowers come from `KingdomAnchor`
(playhub variant), which sources its mascot via `useThemeAsset(...)`, **not a
prop**. Spec says "only new asset is the avatar; everything else we have" but
never says HOW the new portrait enters the frame: new theme-asset wiring? a new
framed composite? CSS oval mask + separate banner? Pick one before Stage 1/4 or
the avatar can't be shown in the reference framing. (Per `[[chesscito-visual-first]]`
+ theme rule `[[project_theme_system_foundation]]` — don't reskin mid-polish.)

### P2-E · Join Challenge glow = MiniPay repaint/jank risk
Spec mandates a pulsing glow on Join Challenge. Project history
(`[[reference_tailwind_animate_override_specificity]]`) deliberately killed
animations to stop MiniPay slide jank. A looping **box-shadow/filter** animation
repaints every frame on low-end Android WebView. Spec says "gentle pulse" but
not the technique. **Resolve**: constrain to GPU-safe `transform`/`opacity`
(a scaling pseudo-element halo) or a static glow; forbid animating
box-shadow/filter. Add to acceptance + VR.

### P2-F · Streak dot windowing algorithm undefined at 390px
Spec allows "a compact window if 21 pips don't fit" but never defines the rule:
when `streak=15` and only ~9 pips fit, which show, and how is lit-count
represented? Reference shows ~9–10 pips. Arbitrary windowing can misrepresent
progress and makes VR non-deterministic. **Resolve**: pick one — 21 compressed,
a sliding window of K with "+N" overflow, or two rows — and assert it.

## P3 — note / low

### P3-G · Reference images contradict the chosen CTA colors (VR/QA trap)
Image #1 shows Start Focus **green** / Join **purple**; the locked decision is
Start Focus **dorado** / Join **verde+glow**. Anyone diffing the build against
the reference will file a false regression. Annotate the reference + Lite VR
baseline: "color follows spec rev2, not the mock".

### P3-H · Guest trophy count inconsistency
Reference Image #1 shows trophies "1" next to the Connect (guest) chip, but
trophies derive from on-chain badges that need a connected wallet (guest → 0).
Spec is silent on guest trophy behavior. Confirm guest shows **0** (reference is
illustrative) so tests/VR don't encode a wrong guest state.

### P3-I · Removing Lite branches from HubScaffold could silently regress Full
PR B deletes ~30 inline `CHESSCITO_LITE_MODE` conditionals from `HubScaffold`.
Any branch doing double duty (shared default + Lite tweak) risks a silent Full
change. **Guard**: verify each branch is Lite-only before deleting; rely on the
Full VR baseline + an assertion that `HubScaffold` source contains no
`CHESSCITO_LITE_MODE`.

## Verdict
Spec is structurally sound (container/presenter split, delivery ordering, state
enumeration). **3 P1 contradictions block a clean TDD start** (fold budget,
HubDailyTile-as-icon, EN-only Start Focus label). Fold these into the spec +
PR B plan, then proceed. P2/P3 can be resolved inline during their stages.
