# Vocabulary Unification Sprint — UX Spec

**Author**: Sally (UX Design)
**Date**: 2026-05-09
**Status**: READY FOR IMPLEMENTATION
**Predecessors**:
- `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-design.md` (M3.5 design)
- `docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-redteam.md` (M3.5 red-team)
- `docs/audits/2026-05-09-app-vocabulary-audit.md` (master inventory)
- 4 cluster reports under `docs/audits/2026-05-09-vocab-audit-*.md`

## 1. Why this spec exists

M3.5 shipped the 5 diegetic primitives + a 4-surface canary. The promise to the player was "a coherent kingdom of stone, wood, treasure, gold, and gems." The reality post-M3.5 is a 4-spot demo: every other ceremonial CTA, every collectible card, every status pill still wears the legacy candy-frame uniform. The audit identified **~26 surfaces** that need migration to honor the M3.5 promise.

This sprint spec answers: **how do we ship those migrations safely, in what order, and with what acceptance criteria?**

## 2. UX framing — what unification actually means

The candy-frame language was a generic "game UI" dialect. The M3.5 diegetic vocabulary is a **kingdom dialect** — every primitive is rooted in an in-world object (stone podium, wood plaque, treasure chest, gold-carved CTA, gem). Unifying the app means the player sees the same hand throughout: the kingdom never breaks character.

Three UX heuristics drive the migration calls:

1. **Ceremonial vs utility**. Ceremonial actions (claim, start, mint, buy) deserve the diegetic carved-wood treatment because the player should feel each tap as a small ritual. Utility actions (retry, connect wallet, switch network) are recovery paths — we keep them legible and minimal, not ceremonial. The kingdom doesn't need to make filing your tax return feel epic.
2. **Hierarchy through size, not variant**. PrincipalButton has `medium` and `large`; that's the hierarchy axis. Adding a "secondary" variant would dilute the metaphor (gold is gold). Use `large` for top-ceremonial, `medium` for second-rank primary. Both stay carved wood — the size telegraphs rank.
3. **Status indicators tell stories**. GemBadge is the kingdom's gem in your pouch. ACTIVE / EXPIRING / OWNED / LOCKED are different gem states the player intuits at a glance. We add a `tone` prop, not new components.

## 3. Sprint plan — reorganized by cluster blast radius

The audit's master doc proposed 3 sprints organized by priority across the whole app. My UX read: **mixing 4 clusters in one sprint scatters the eyeball**. If a regression appears, triage is hard. Better: organize sprints by cluster so each delivery is internally consistent.

I propose **5 sub-sprints** within a single delivery arc:

### Sprint 1A — ActionPin composition extension (foundation)
- Surface: `apps/web/src/components/redesign/action-pin.tsx`
- Migrate `tone="default" size="full"` for actions `submitScore` and `useShield` to compose `<PrincipalButton size="large">` (mirrors the existing claim+full pattern).
- Keep `retry`, `connectWallet`, `switchNetwork` as candy-frame ActionPin atoms (utility, not ceremonial).
- Keep ALL `size="pin"` (44×44 round) treatments (geometry doesn't fit PrincipalButton).
- **Why first**: this is the foundation refactor. Every /exercises session sees this surface. Done well, this single change unifies the central CTA across many flows.
- **Estimated commits**: 1 (one focused refactor + tests).

### Sprint 1B — /exercises ceremonial CTAs
- MissionBriefing play CTA → `<PrincipalButton size="large">`
- BadgeSheet claim button → `<PrincipalButton size="medium">` with trophy icon
- ShopSheet buy primary → `<PrincipalButton size="large">` (decision: NOT TreasureTile here; TreasureTile is for the treasure-frame *catalog item* in coach-paywall pattern. Shop's per-row buy button is a CTA, not a tile)
- **Estimated commits**: 3 (one per surface; each granular).

### Sprint 1C — Arena + Victory cluster (end-to-end)
- arena-entry-panel Start Match CTA → `<PrincipalButton size="large">`
- victory-celebration Claim Victory CTA → `<PrincipalButton size="large">`
- victory-celebration Play Again → `<PrincipalButton size="medium">`
- victory-claim-success Play Again → `<PrincipalButton size="medium">`
- victory-claim-error Try Again → `<PrincipalButton size="medium">`
- arena-entry-panel soft-gate Learn CTA → `<PrincipalButton size="medium">`
- victory page accept-challenge CTA → `<PrincipalButton size="large">`
- **Why end-to-end**: the player walks the entire arena ritual (entry → match → victory → claim → play again). All of those CTAs in one consistent material.
- **Estimated commits**: 7.

### Sprint 1D — Landing cluster (end-to-end)
- Landing hero primary → `<PrincipalButton size="large">`
- Landing header nav primary → `<PrincipalButton size="medium">`
- Landing final CTA → `<PrincipalButton size="large">`
- Landing featured plan tier (P1, batch here for cluster cohesion) → `<PrincipalButton size="medium">`
- **Why end-to-end**: landing is the one-page conversion funnel. Three primary CTAs in the same dialect signal "we mean it."
- **Estimated commits**: 4.

### Sprint 1E — PRO funnel
- ProSheet main CTA → `<PrincipalButton size="large">`
- **Estimated commits**: 1.

**Sprint 1 total: ~16 commits.** Heavier than the master doc's 10, but each commit is a single surface migration — granular, revertible, atomic.

### Sprint 2 — dormant primitive activation (GemBadge + WoodBanner)
- **GemBadge wave**: BadgeSheet "Owned" pill → `<GemBadge tone="success">`; ProActiveBadge → `<GemBadge tone="success" | "warning">`; MissionDetailSheet stats × 2 → `<GemBadge tone="default">`
- **WoodBanner wave**: CoachPanel history banner → `<WoodBanner size="medium" asTitle>`; MissionDetailSheet journey rail frame → `<WoodBanner size="medium" asTitle>`
- **PrincipalButton secondary tier**: CoachFallback secondary CTA → `<PrincipalButton size="medium">`; BadgeSheet nav button → `<PrincipalButton size="large">`
- **Estimated commits**: 7.

### Sprint 3 — collectibles + remaining
- AchievementsGrid earned cards → `<TreasureTile>` with new `EARNED` ribbon variant
- ShopSheet secondary "Buy with CELO" → `<GemButton>`
- Arena difficulty pill — evaluate, decide stay/migrate
- **Estimated commits**: 3.

### P2 polish (deferred batch)
- 7 surfaces — locked pills, share buttons, claimed-badge cosmetic, info banners. Ship as a single polish PR after Sprints 1–3 land and the eyeball confirms unification.

## 4. API gaps — resolve BEFORE Sprint 2

### G1. `<PrincipalButton>` — size as hierarchy
**Decision**: NO API change. Use `size` as the hierarchy axis (`large` ceremonial, `medium` secondary primary). The "secondary variant" idea from the audit dilutes the metaphor.

### G2. `<GemBadge>` — add `tone` prop
**Need**: ACTIVE/EXPIRING/OWNED/LOCKED states.
**Decision**: add a `tone` prop:
```ts
export type GemBadgeTone = "default" | "success" | "warning" | "locked";
```
- `default` → cream/gold (current)
- `success` → emerald (ACTIVE, OWNED)
- `warning` → amber (EXPIRING)
- `locked` → dark brown (LOCKED)

Same prop applies to `<GemButton>` for consistency (even if no consumer needs all 4 today, future-proofing).

CSS implementation: gem assets stay the same; tones apply via `--gem-tone-bg` / `--gem-tone-text` / `--gem-tone-border` CSS variables on the `[data-tone]` selector. No new assets required.

**API signature change**:
```ts
export type GemBadgeProps = {
  icon: ReactNode;
  value: ReactNode;
  tone?: GemBadgeTone; // default "default"
  className?: string;
};
```

Tests: 4 new tests for the 4 tones (one per tone — render + assert classNames + computed colors via getComputedStyle).

### G3. `<TreasureTile>` — add `EARNED` ribbon variant
**Need**: AchievementsGrid earned cards need a clear "EARNED" stamp.
**Decision**: extend the ribbon enum:
```ts
export type TreasureTileRibbon = "BEST" | "NEW" | "SALE" | "EARNED";
```
- `EARNED` styles: emerald gradient (matches success tone family)
- No new asset; CSS gradient handles the visual.

**API signature change**: type-only.
Tests: 1 new test (renders EARNED ribbon variant + asserts class).

### G4. `<WoodBanner>` — no API change needed
Current API (size + accessory + asTitle) covers both new homes (coach panel header + mission journey frame).

### G5. `<StonePedestal>` — no API change needed
The arena difficulty pill (Sprint 3) may not fit; if so, leave it bespoke. No API extension required.

## 5. Test strategy — preserving testids + ARIA across migrations

### 5.1 The wrapper-span pattern (canonical)

For every surface that bears `data-testid` (E2E or unit tests query by it), wrap the primitive in a span carrying the testid + the surface's domain-state:

```tsx
<span data-testid="badge-claim" data-state={isClaimable ? "ready" : "pending"} className="inline-flex">
  <PrincipalButton
    size="medium"
    leadingIcon={<CandyIcon name="trophy" />}
    onClick={onClaim}
    disabled={!isClaimable}
    loading={isClaiming}
    aria-label={ariaLabel}
  >
    {label}
  </PrincipalButton>
</span>
```

Why this pattern:
- `data-testid` stays on a stable node regardless of how the primitive's internal DOM evolves.
- `data-state` carries domain semantics (the surface's role/state) without colliding with `data-state` on the primitive (which carries its own state — disabled/loading).
- `inline-flex` wrapper does not disrupt layout (zero visual cost).
- Primitive's `data-component="<name>"` and `data-state="default|loading|disabled"` remain untouched (machine-readable primitive identity).

### 5.2 ARIA contract preservation

Every migrated surface MUST:
- Pass the current `aria-label` directly to the primitive's `aria-label` prop (NOT to the wrapper).
- Preserve `aria-busy` semantics: PrincipalButton emits `aria-busy={loading || undefined}` automatically when `loading` is true. If the legacy treatment passed `aria-busy` manually, drop it (let the primitive own it).
- For status-indicator surfaces (GemBadge): screen readers pick up the visible `value` text. Do not add hidden `aria-label` unless the value is icon-only.

### 5.3 testid stability

A migration commit is **acceptable only if**:
1. `git grep -n "data-testid" apps/web/src/components/<migrated-file>` shows the same testid set before/after.
2. Any test file under `apps/web/e2e/` or `apps/web/src/**/__tests__/` that queries those testids passes without modification (or the test is migrated alongside in the same commit with a clear "test follows surface" comment).

### 5.4 Visual regression strategy (deferred)

Per project memory: "Manual screenshot baselines diferidos por single-user dev period." Sprint exit relies on **manual eyeball at 360×740** + suite green. When the team grows, we adopt screenshot baselines for these primitives in `apps/web/e2e/screenshots/scene-rooted/`.

## 6. Sprint exit criteria

Each sub-sprint ships when ALL of:

1. **Suite green**: `pnpm test` from `apps/web/` returns 0 failures. Test count may grow (new tests per migration) but never shrink without explicit comment in the commit.
2. **Type-check clean**: `pnpm type-check` from repo root passes.
3. **Manual eyeball at 360×740 + 390×844**: every migrated surface inspected in both viewports. Visual checklist:
   - Surface uses the diegetic primitive (no candy-frame remnants visible)
   - Hierarchy reads correctly (large = ceremonial, medium = secondary)
   - Press feedback works (scale 0.96 on tap, prefers-reduced-motion fallback)
   - Disabled / loading states preserved
   - Layout intact (no overflow, no clipping)
4. **Granular commits**: one logical surface per commit, conventional-commit message format, signed `Wolfcito 🐾 @akawolfcito`.

Sprint-level exit: above + a fresh screenshot capture committed to `e2e-results/snapshots/sprint-<id>/` (informal, not asserted) for handoff continuity.

## 7. Edge cases & decisions

### E1. ActionPin "useShield" — is this ceremonial?
**Decision**: yes, treat as ceremonial. Using a shield is a small reward moment ("I had this saved up, I'm spending it now"). Wood-carved CTA reinforces the value of the resource. Migrate to PrincipalButton compose path.

### E2. ActionPin "retry" — gold or muted?
**Decision**: muted (current). Retry is recovery, not progression. Keep candy-frame `cta-muted` treatment — the kingdom doesn't celebrate failure recovery.

### E3. ActionPin "connectWallet" / "switchNetwork" — diegetic?
**Decision**: NO. These are setup actions — the player is configuring their wallet, not progressing through the kingdom. Keep candy-frame, full visibility (this is the "system tray" of the game).

### E4. ShopSheet — TreasureTile per row OR PrincipalButton on each row?
**Decision**: PrincipalButton on each row. TreasureTile is for *catalog item* representation (chest visual, value chip, ribbon). The Shop's per-row layout already has the icon/name/price columns; the right-side button is a CTA, not a tile. PrincipalButton size="medium" (or large if space allows) keeps semantic clarity.

Rationale: coach-paywall's TreasureTile pattern works because the *whole tile* IS the buy interaction (icon + price + tap). Shop has a separate row layout where the button is one of several columns.

### E5. AchievementsGrid — TreasureTile per achievement?
**Decision**: yes. Each achievement card is a treasure (a collectible). TreasureTile + EARNED ribbon when claimed; no ribbon when locked or in-progress. Stack the achievement icon in `iconStack`, level/progress in `valueChip`.

### E6. Locked badge pill — GemBadge `tone="locked"` OR stay as-is?
**Decision**: stay as-is for now (P2). The "locked" state is a non-interactive deterrent. Migrating it is low-value polish; defer to the P2 batch.

### E7. ProActiveBadge — split or single GemBadge?
**Decision**: single GemBadge. `tone="success"` for ACTIVE, `tone="warning"` for EXPIRING (≤3 days threshold). Same component, different tone — the player intuits the urgency from the gem color.

The previous "ACTIVE • 29 days left" pill format is killed (already done in commit `619dbe8`). The active GemBadge shows just the icon + "PRO" label; the days-left details surface in the PRO sheet on tap.

### E8. CoachFallback secondary CTA copy review
The button currently says (paraphrased) "Get full coach analysis." When this becomes a `<PrincipalButton size="medium">`, the copy should drop "full" — wood-carved CTAs read as committed actions, "Get coach analysis" or "Unlock coach" reads cleaner.

(Editorial change: out of this spec's primary scope; tracked here for the implementation PR.)

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| testid drift across many migrations | Medium | High (E2E breakage) | Mandatory wrapper-span pattern (§5.1); CI fails if testid disappears |
| PrincipalButton `medium` widths break for long copy ("Try Again with shield") | Low | Medium (overflow) | Verify each copy fits at 280px; truncate or shorten copy in editorial.ts before the migration |
| GemBadge `tone` CSS variants regress placeholder behavior | Low | Low | `is-placeholder` probe runs on `tone` change in deps array |
| AchievementsGrid migration is N-card sweep | Medium | Medium (one component, many states) | Sprint 3 takes its own dedicated PR; visual eyeball both earned + locked states |
| Mass migration in Sprint 1 hits a hidden testid asserting on candy-frame class | Medium | Low (revert one commit) | Granular commits make revert trivial |

## 9. Out of scope for this sprint

- **Dock items**: per existing decision (DESIGN_SYSTEM §8), HUD overlay stays non-diegetic
- **Z1 status bar**: separate scope; already simplified in `619dbe8`
- **Asset finals**: WoodBanner + GemBadge ship with M3.5 working drafts; final assets swap in via CSS-var when delivered (no code change required)
- **Visual regression baselines**: deferred to post-tracción (per project memory)
- **PRO sheet redesign beyond the main CTA**: the rest of the sheet stays as-is for v1
- **CoachPanel beyond history banner**: rest of coach UI is its own design domain
- **Editorial copy review**: copy adjustments noted inline (E8); separate editorial pass

## 10. Implementation handoff notes

The agent picking this up should:

1. **Land Sprint 1A first** (action-pin composition extension). It's the highest-leverage refactor; one PR establishes the pattern for every other ceremonial CTA.
2. **Land G2 (`GemBadge tone`) BEFORE Sprint 2 starts** — it's a primitive API extension; gates the GemBadge wave. G3 (`TreasureTile EARNED` ribbon) gates Sprint 3.
3. **Eyeball cadence**: after each sub-sprint (1A, 1B, 1C, 1D, 1E), pause + manual eyeball at 360×740. Don't batch eyeballs across multiple sub-sprints.
4. **Commit cadence**: one commit per surface migration. Conventional-commit `style(<scope>): migrate <surface> to <Primitive>` is the canonical message.
5. **PR strategy**: Sprint 1A as its own PR (precedent-setter). Sprint 1B-1E can be one PR each OR a single arc-PR depending on Wolfcito's preference for review surface. My recommendation: separate PRs (smaller review chunks).

## 11. Success metric

Post-implementation, a player walking through the app should never experience a "this looks like a different game" moment between surfaces. Specifically:

- Every primary CTA across `/exercises`, `/arena`, `/landing`, `/pro`, and `/victory` is gold-carved wood (PrincipalButton).
- Every status indicator is either a gem (GemBadge) or a stone pedestal (StonePedestal).
- Every commerce surface is wood-framed (TreasureTile or PrincipalButton in a wood-tone container).
- Every section header is wood-banner-framed (WoodBanner).
- The 5 primitives appear at least 3× each across the app (no orphan primitives).

If the eyeball passes that test at sprint end, we shipped the kingdom.

---

## Appendix — Commit checklist (pre-push)

For every migration commit:

- [ ] Surface uses the target primitive (no candy-frame remnant)
- [ ] Wrapper-span carries `data-testid` + `data-state` (if surface had testid pre-migration)
- [ ] Existing `aria-label` passed to primitive's `aria-label` prop
- [ ] `onClick` semantics preserved 1:1
- [ ] `disabled` / `loading` props passed through
- [ ] Local `pnpm test` green for the migrated file's tests
- [ ] Local `pnpm type-check` clean
- [ ] Manual eyeball at 360×740 (or 390×844 if surface is desktop-only)
- [ ] Conventional-commit message + `Wolfcito 🐾 @akawolfcito` signature

For the sprint-closing commit:

- [ ] All sub-sprint surfaces migrated
- [ ] Suite green
- [ ] Type-check clean
- [ ] Eyeball pass on every migrated surface
- [ ] Handoff doc updated (`docs/handoffs/2026-05-XX-vocab-sprint-N-handoff.md`)
- [ ] Auto-memory entry updated if migration spans multiple sessions

## End of spec
