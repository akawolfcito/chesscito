# Red Team Review — lite-hub-redesign

**Date**: 2026-06-26
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- [extraction-scope] The spec says "extract a container" but the data lives in
  a 694-LOC client with wagmi hooks, 12+ `useEffect`s, refs, and event
  subscriptions. Extracting it AND building a new presenter in one pass is a
  high-blast-radius change that can regress Full. **Blocking**: split into two
  PRs — (A) pure refactor extracting `useHubData()` with Full rendering
  byte-identical (VR + tests green, no visual diff), then (B) the Lite
  presenter. The spec must commit to this ordering or risk a tangled diff.

- [feature-loss-audit] "Zero feature loss" is an acceptance criterion but there
  is no authoritative enumeration of *every* current Lite element to diff
  against. The mapping table omits: `MissionRibbon` (center), `HudSecondaryRow`
  (streak/stars/shields), the dev mock-unlock button, deep-link `?sheet=`
  handling, `useShieldSync`, claim-queue dot. **Blocking**: produce a complete
  inventory checklist from `hub-scaffold.tsx` + `hub-scaffold-client.tsx`
  before coding, or features silently drop (the exact QA-after-delivery cost
  CLAUDE.md warns about).

- [start-focus-deadtap] Behavior #6 hand-waves the at-limit case ("never a dead
  tap") without defining the actual destination/label. At the free limit the
  daily-limit card is one-shot per UTC day (just shipped) — after it's
  acknowledged, what does Start Focus DO? Replay? Open exercises in practice?
  Undefined → guaranteed dead-end bug. **Blocking**: enumerate Start Focus
  destination for each content-loop variant × quota state.

### P1 — Should address

- [training-path-data] Open question #1 is actually load-bearing: if
  `deriveRewardTiles` returns 4 (rook/bishop/knight/pawn) but the mockup shows
  6 (adds queen/king), the horizontal row needs a different model. Resolve
  BEFORE building the row component, not during.

- [vr-entanglement] Removing Lite branches from `HubScaffold` changes the Full
  render tree (dead-code deletion can shift layout if a wrapper is shared).
  Risk: Full VR baseline drifts. Mitigation: assert Full VR unchanged in PR A.

- [dock-introduction] Adding a bottom dock to the hub is a NEW surface element
  (today's Lite hub has none). The persistent dock publishes
  `setDockSheet("overlay")` and owns safe-area insets; mounting it on the hub
  may collide with the daily-limit card's `z-40` and the season-pass sheet.
  Define z-index ordering + which dock tab marks "home".

- [config-coupling] Challenge meta (21/+3/$1.99) "from config" assumes the
  season-pass config exposes all three. If price is formatted elsewhere
  (payments rail) the stat tile could show a stale literal. Verify single
  source; fail the build if missing rather than hardcoding.

### P2 — Nice to clarify

- [hero-vs-contentloop] Today Full uses `heroCta` (getHeroContextAction) and
  Lite uses `NextStepCard` (contentLoopAction). The spec's `primaryFocus`
  carries both `label` and `contentLoop` — clarify which wins so two sources of
  truth don't diverge.
- [naming] "21-Day Mind Challenge" vs existing `SEASON_PASS_CTA_LABEL` /
  editorial keys — reuse the existing i18n keys, don't mint parallel copy.
- [analytics] New layout = new tap targets. Preserve existing event names
  (`hub_view`, `lite_session_started`, season-pass funnel) and add events for
  Join Challenge / Start Focus with consistent namespacing.

## Categories audited

### Contract gaps
- `RewardTile` / `ContentLoopAction` are referenced but not redefined here —
  OK if imported from existing modules; confirm they expose `state`
  (`locked|active|unlocked`) the Training Path needs.
- No error type for `seasonPassStatus` fetch failure — card should degrade to
  `not-joined`, not crash. Add explicit fallback.

### Behavioral ambiguity
- "Start Focus reflects the at-limit variant" — trigger and result undefined
  (see P0).
- Streak clamp at `durationDays` stated, but flame anchor behavior at streak=0
  vs day-1 not pixel-defined (defer to VR, acceptable).

### Hidden assumptions
- Assumes `dailyProgress`, `sessionQuota`, `seasonPassStatus` all hydrate
  independently; the challenge card depends on 2-3 async sources — define the
  combined loading gate (any-null → loading) to avoid partial flicker.
- Assumes deep-link `?sheet=` is Full-only; in Lite most sheets are gated off
  today. Confirm Lite ignores `shop|pro|badges` deep-links post-refactor.

### Backward compatibility
- `/hub?legacy=1` redirects (page.tsx) must keep working — they run before the
  presenter switch, so unaffected, but assert with the existing page test.
- Stored localStorage keys (daily-progress, session-quota, daily-limit-ack)
  unchanged — good, no migration.

### Security & data
- No new PII. Wallet address only feeds existing hooks. Join Challenge =
  existing season-pass rail (fail-closed treasury rules still apply).
- No new network boundary; all reads are existing hooks/localStorage.

### Test coverage gaps
- Acceptance "no feature loss" is not directly testable without the inventory
  checklist (P0). Convert it into per-feature presence assertions.
- Switch behavior (Lite vs Full) is testable via env mock — add it.

### Operational readiness
- Rollback: the switch is one boundary; reverting the env var or the switch
  line restores Full. Low risk IF PR A keeps Full identical.
- Observability: ensure no analytics regression (P2).

## Verdict

**NEEDS REVISION** — directionally strong and architecturally sound, but three
P0s must land in the spec first:
1. Commit to the two-PR ordering (pure extraction → Lite presenter).
2. Add the complete current-Lite feature inventory checklist.
3. Fully define Start Focus destination across content-loop × quota states.

Resolve Open questions #1–#4 (training-path roster, dock/home tab, Start Focus
target, challenge-meta config source) — each is load-bearing for
implementation. After that, READY for `/tdd` on PR A.

---

## Resolution (2026-06-26) — now READY

All three P0s and all four open questions are addressed in the spec:

- **P0-1** → "Delivery ordering" section: PR A (pure `useHubData()` extraction,
  Full byte-identical) then PR B (Lite presenter).
- **P0-2** → "Feature inventory — regression guard" checklist added; reframed
  as design-only (no feature change), a drop-prevention net.
- **P0-3** → "Start Focus destination matrix": option A, always `/exercises`,
  at-limit = practice (no stars), label varies by content-loop, never disabled.
- **OQ#1** → 6-piece `REWARD_TILE_ORDER` reused as-is.
- **OQ#2** → no dock this iteration (founder + Sally).
- **OQ#3** → resolved by the matrix.
- **OQ#4** → `SEASON_PASSES.lite_season_pass_21` single source (21/+3/$1.99).

Remaining P1/P2 (CTA hierarchy, dot semantics, VR entanglement, analytics
parity) are now encoded as spec decisions + acceptance criteria — carry them
into PR B, not blockers for PR A.

**Verdict: READY for `/tdd` (start with PR A).**
