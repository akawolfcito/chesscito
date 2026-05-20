---
date: 2026-05-20
session_type: cluster-arc
arc: post-domain-migration UX addendum
parent_spec: _bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md
red_team_review: docs/reviews/2026-05-20-post-domain-migration-addendum-redteam.md
commits_shipped: 7
commits_pushed: 7
clusters_closed: A, B1, B2, C, D
clusters_outstanding: E, F
test_suite_baseline_at_start: 1599/45
test_suite_baseline_at_end: 1688/45
net_tests_added: 89
---

# Session Handoff — Post Domain-Migration UX Addendum

## TL;DR

In one session, sized the post-domain-migration field feedback into a 7-section UX addendum (1204 lines), red-teamed it (30 findings → 4 criticals resolved in §0 prerequisite section), then executed Clusters A, B1, B2, C, and D end-to-end. **7 commits shipped to `origin/main`**, **+89 tests** added, **0 baseline regressions**. Clusters E and F remain.

The original trigger was Wolfcito's first MiniPay session after the prod URL switched from `chesscito.vercel.app` → `chesscito.com`. Symptoms surfaced 8 distinct UX items + 4 critical unverified assertions in the planning doc itself; all 12 are now either shipped or explicitly deferred with traceable defer entries.

---

## What shipped (7 commits, `68c4a054..f056a829`)

| Commit | Cluster | Surface | Tests added | AC closed |
|---|---|---|---|---|
| `593b8da9` | A.G1 | `editorial.ts` rename `viewOnCeloscan` → `receiptOnCeloscan`; result-overlay binding | 0 | AC-4.2, AC-4.3 |
| `83bc8e5e` | A.G2 | Purge `miniPayWarning` copy + `<p>` render on `purchase-confirm-sheet` | 0 | AC-4.1 |
| `3f6bb516` | A.G3 | Drop `.action-row-pedestal-*` stone background + scale Daily Tactic icon `h-12` → `h-14` | 0 | AC-3.1, AC-3.2, AC-3.3 |
| `fc5ab87b` | B1 | `<TxProgressSteps>` primitive — pills + toast variants, stateless API, ARIA contract, defensive guards | 15 | AC-2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.3.5, 2.3.7 |
| `9659b3b0` | B2 | TxProgressSteps telemetry wiring — 4 events with `flow`/`step`/`outcome` dims, locked-flow ref, dev-warn on prop drift | 9 | AC-2.3.6 + resolves M-5 |
| `7c2207c4` | C | SAVE button local-first — `useSaveScoreState` hook + `<SavedChip>` + toast adoption + gate fix (`canSaveScore` separated from `canSendOnChain`) | 12 | AC-2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.7 |
| `f056a829` | D | Wallet-progress-aware onboarding — `/api/founder-status` route + `useOnboardingSignal` 4-OR + `WelcomeOverlay` refactor (atmosphere `amber` → `gold`, English copy, persistent Skip, ARIA carousel) | 26 | AC-2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5, 2.1.6, 2.1.7 |

**Suite state:** 1688 passing / 45 baseline failing — +89 net tests since session start, 0 new failures.

Each cluster ran the full QD cycle (spec → plan → implement → 3-agent review → patches → commit → push). Specs live under `_bmad-output/implementation-artifacts/spec-cluster-*.md` with their Spec Change Logs intact for traceability.

---

## What's deferred (defer registry)

`_bmad-output/implementation-artifacts/deferred-work.md` carries the full ledger. Highlights by cluster:

**Cluster A residue (Low priority):**
- Doc cleanup — `docs/superpowers/specs/2026-04-26-*` + `docs/reviews/ux-review-2026-04-23-*` still reference removed `miniPayWarning` key by name.
- Asset cleanup — `public/art/action-row/piedra-daily.png` + `piedra-arena.png` no longer rendered after G3.
- Tokenize candy-gold edge color (`rgba(245, 200, 100, 0.45)` + `rgba(63, 34, 8, 0.25)` hardcoded in G3 CSS).

**Cluster B1 residue (Medium + Low):**
- **Medium** — Shop 6-step duplicate-code resolution. `key={step.code}` in `<PillNode>` collides for Shop's `sign/send/wait/sign/send/wait` compound sequence. Three options documented (per-leg primitive instances, index-keyed activation, disambiguated codes). Address during Shop/PRO integration in a future cycle.
- Test type hygiene — flow literals widen via spread instead of `TxFlowName` import.
- A11y live-region split — toggling `aria-live="polite"↔"assertive"` on a single node is undefined per ARIA. Future hardening: separate polite + assertive regions.

**Cluster B2 residue (Low):**
- 5 telemetry edge cases — StrictMode double-invoke, `doneFiredRef` across flows, mount-at-terminal coverage gap, `isInvalid` flips mid-flow, throttle bucket overflow on rapid oscillation.
- **Visual baselines VR-5 + VR-6 deferred to natural adopter capture** — no `/_dev/` route exists; Playwright is page-level, not component-level. VR-6 (toast) captured during Cluster C's `/exercises` flow; VR-5 (pills) captured when Cluster E mounts the primitive on the Victory mint screen.

**Cluster C residue (Low):**
- Revert/`isError` branch — toast has no `failed` mount path on chain revert (existing error overlay handles user dismissal).
- 1500ms done-hold hardcoded — could tokenize.
- Toast overflow at 390px — single-line content "Step N of M · {label}" could push past container with longer fallbacks.
- Rapid resubmit race — second tap overwrites `pendingSubmitRef` + `submitTxHash`; first tx's confirmation never persists.
- Unmount-mid-tx cosmetic — React 18 strict-mode swallowed warning on `setTxDoneAt(null)` after unmount.

**Cluster C deferred AC (Medium):**
- **AC-2.2.6 chain-wins reconcile** — Scoreboard contract has NO `getScore()` view. Cross-device reconciliation needs Supabase cache integration. Future cycle.
- **AC-2.2.8 surface telemetry** — `score_button_view`, `score_save_tap`, `score_save_success/failed`, `score_saved_state_tap` events. Small follow-up.

**Cluster D residue (Low):**
- Negative-result 24h cache — `ownsFounder: false` cached for 24h means a user who buys Founder Badge stays "non-founder" until expiry. Future: webhook invalidation or split TTL.
- AbortController on losing race promises.
- Timeout commits fresh while slow positive may resolve next frame.
- Skip-button funnel analytics — no event distinguishes "skipped" vs "completed" vs "auto-skipped via signal".
- Cross-tab cache write race — last-writer wins on `chesscito:onboarding-signal:{wallet}`. Acceptable per current analysis.
- **`SHOP_DEPLOY_BLOCK_CELO` ops follow-up** — production warn-log is in place. Add to `.env.template` for deployer awareness. Block ≈ 37,800,000 per `apps/contracts/deployments/celo.json` `shopDeployedAt: 2026-03-12`.

---

## What's outstanding (Clusters E + F)

### Cluster E — Coach Analysis re-entry + unconditional `GameRecord` persistence

**Scope** (from addendum §2.4 + §0.1):
1. Move `/api/games` POST from inside the Coach-flow conditional to fire on every game-end (decouple game persistence from Coach intent). Foreground `await` per §0.1 fix (resolves red-team C-1 race condition).
2. Add `Analyze ▶` candy primary chip on `/coach/history` entries that lack an `analysis` row.
3. Add secondary `Get Coach Analysis` CTA on Victory mint end-state (and primary CTA on loss/draw/resigned variants where no Mint CTA peer exists).
4. 200-row FIFO cap on game persistence — analyzed games protected from eviction.
5. Telemetry `game_persisted`, `coach_analyze_request{source}`, `coach_history_analyze_tap`, etc.

**Dependencies:**
- B1 pills variant adoption for Victory mint flow → captures **VR-5 baseline** naturally.
- Existing `/api/coach/analyze` route + `persistAnalysis` ledger unchanged — purely additive on game persistence + UI re-entry.

**Estimated effort:** ~1.5 days focused work. Largest cluster of the addendum. Spec ready as a guided start — invoke QD with arg pointing to addendum §2.4 + §0.1.

### Cluster F — Release handoff doc

Per addendum §6.1 commit #22: a release-style handoff under `docs/release/2026-05-2X-post-domain-migration-addendum-handoff.md` (different from THIS session handoff under `docs/handoffs/`). Lands as the closing commit of the addendum arc once Cluster E is in `main`.

---

## Known issues / open questions

1. **Cluster E §0.1 design tension:** the spec prescribes foreground `await` on game persistence (3-state load shimmer over end-state CTAs). User UX impact is +100-600ms perceived delay on warm path, +1-2s on cold. The TxProgressSteps toast (B1) is the planned narrative mask. Worth confirming with Wolfcito that the delay is acceptable before implementation.

2. **`SHOP_DEPLOY_BLOCK_CELO` env var is NOT set in production** as of this handoff. The warn-log fires at cold start but the route will 500 until set. Hook's 4-OR design degrades safely (PRO + badge + shield carry the load). Action: add to Vercel Production env at `~37,800,000`.

3. **Visual baselines VR-1..VR-8 not captured** in this session. Per the deferred-work plan, they land naturally during E (VR-5 + VR-7 + VR-8) and via a small visual-test follow-up for VR-3 (footer dock) and VR-4 (SAVE button states). Tracked but not on the critical ship path.

4. **30-task session limit per CLAUDE.md** was respected — 7 implementation cycles + 1 addendum + 1 red-team + 1 §0 patch + this handoff = 11 major artifacts produced. Below the 30 ceiling but at the high end; quality may degrade on a 8th cluster cycle in the same session.

5. **Single-user dev period** assumption still holds per memory `project_pro_freeze_lifted`. All 7 commits ship without behind-flag gating (no `NEXT_PUBLIC_ENABLE_*`). If a real funnel reopens, several recently-shipped behaviors (SAVE gate change, onboarding signal cache, toast/SavedChip swap) become observable to other users without rollback safety. Action: leave Cluster D's onboarding signal cache untouched in production for ~7 days before declaring "stable" so the cache TTL has a chance to expire on real wallets.

---

## Pointers

**Specs (all under `_bmad-output/implementation-artifacts/`):**
- `spec-cluster-a-g1-receipt-celoscan.md`
- `spec-cluster-a-g2-purge-minipay-warning.md`
- `spec-cluster-a-g3-footer-dock-revamp.md`
- `spec-cluster-b1-tx-progress-steps-primitive.md`
- `spec-cluster-b2-tx-progress-telemetry.md`
- `spec-cluster-c-save-button-local-first.md`
- `spec-cluster-d-onboarding-hybrid.md`
- `deferred-work.md` — full registry

**Planning:**
- `_bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md` (1204 lines, parent doc)
- `docs/reviews/2026-05-20-post-domain-migration-addendum-redteam.md` (30 findings, untracked locally — needs its own commit)

**Memory updates:**
- `MEMORY.md` extended with: production domain block (`chesscito.com` apex), addendum index + commit plan, red-team pass 1 + criticals-resolution summary.

**Architecture decisions ratified during the session (in §0 of the addendum):**
- §0.1 — `GameRecord` persistence becomes foreground `await` at game-end (resolves C-1 race).
- §0.2 — Onboarding signal budget 2000ms + localStorage cache + `[Skip]` escape (resolves C-2 latency reality).
- §0.3 — Founder Badge ownership read via `ItemPurchased` event scan, NOT `Badges.balanceOf` (resolves C-3 false assertion — verified in `ShopUpgradeable.sol:94-116`).
- §0.4 — Full ARIA contract per new component (resolves C-4 a11y omission).
- §0.5 — 5th unverified-assertion (Scoreboard.getScore doesn't exist) surfaced during Cluster C planning. Cross-device reconcile deferred to a future Supabase cache integration.

---

## Next session opener

The natural opener for the next session is **Cluster E**. The user explicitly chose this handoff over starting E directly because the day had already shipped 5 cluster cycles and the spec was the largest remaining.

A clean entry point:
```
Invoke bmad-quick-dev with arg:
"Cluster E from addendum §2.4 + §0.1: unconditional GameRecord persistence
on game-end (foreground await + TxProgressSteps toast mask) + /coach/history
Analyze re-entry chip + Victory mint Coach CTA + 200-row FIFO cap +
telemetry events. Closes addendum AC-2.4.1..10."
```

Expected outcome: 1-2 days of focused work, 1 new commit (or split into E-persistence + E-ui per the QD multi-goal check), VR-5 visual baseline captured naturally during integration, addendum 80% complete.

Then Cluster F (release handoff) closes the arc.
