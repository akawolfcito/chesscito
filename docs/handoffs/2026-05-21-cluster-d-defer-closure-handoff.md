# Cluster D Defer Closure — 2026-05-21 (no-code session)

Closed the 4 remaining low-priority defers from Cluster D Blind hunter review as **accepted-as-is** after explicit ROI analysis. Zero code changes, zero new tests, zero commits to product code. Ledger hygiene + decision codification only. Handoff doc is the sole tracked artifact this session produces.

## What was closed in `_bmad-output/implementation-artifacts/deferred-work.md` (gitignored)

Items **#1, #2, #3, #5** under "Cluster D onboarding edge cases (review-time defers)". Section header promoted from `Deferred` → `Closed 2026-05-21`. All 6 sub-items now carry inline closure markers (#4 + #6 were closed earlier today with code; #1, #2, #3, #5 closed today as accepted-as-is).

### Verdicts at a glance

| # | Item | Verdict |
|---|---|---|
| 1 | Negative-result cache TTL on `/api/founder-status` (24h on `false`) | Not fixing. 4-OR signal hook masks bug via piece-badge co-signal (rook is sequentially gated, claiming any badge implies rook); Founder-only buyers + reload <24h = unicorn case; Skip button mitigates UX. Shorter TTL risks Forno stampede on every non-founder visit; webhook = new infra surface. ROI negative at v1 traffic. |
| 2 | AbortController on losing fetches in `useOnboardingSignal` | Not fixing. `committed` guard already neutralizes functional impact; "waste" is 2-3 HTTPS + 1 RPC per visit at ~5-user beta scale = imperceptible. Touching carousel-gate hook for cosmetic polish is net-negative risk. Badge promise uses viem `readContract` which has no native `AbortSignal` anyway — fix would be partial. |
| 3 | Timeout commits fresh while slow promise may resolve positive | Not fixing — accepted per addendum §0.2: "safer to over-show carousel than strand fresh user". Trigger condition (all 3 reads >2s) implies degraded-network territory where carousel is the least of the UX issues. |
| 5 | Cross-tab cache write race on `chesscito:onboarding-signal:{wallet}` | Not fixing. Both writers produce identical `status: "returning"`; only `signal` source attribution drifts by ≤1 entry per race. Cross-tab locking (BroadcastChannel / Web Locks) is substantial code for sub-perceptible telemetry drift. |

## Why this batch over the alternatives

Owner asked the honest question: **"what happens if we don't do this batch?"** Item-by-item:

- **#1**: ~0 users impacted/week (multi-hop edge); cosmetic.
- **#2**: 2-3 wasted HTTPS per returning-user visit at current scale = imperceptible bandwidth.
- **#3**: already-decided at spec level; re-litigating = neutral-to-negative work.
- **#5**: telemetry attribution drift ≤1/race; user-facing impact zero.

None of the 4 items move the needle on user experience, data integrity, or platform cost at v1 traffic. Closing them with explicit verdicts (vs leaving as perpetually "deferred") prevents future sessions or new contributors from picking them up as "easy wins" that turn into rabbit holes. The ledger entries now carry the do-nothing cost reasoning inline, so the next adversarial reviewer sees the trade-off context immediately.

## What was deliberately NOT triggered

- **Cluster Closure Protocol** — Cluster D itself closed when `f056a829` merged on 2026-05-20. Today was defer drain on residual cleanup, not cluster closure. Calling the protocol here would be revisionist ceremony.
- **README sync** — already verified current 2026-05-21 per the traceability hygiene ledger entry. No drift to address.
- **MEMORY.md edits** — no structural project change; the closure pattern (ROI-negative verdicts) is captured in this handoff, not promoted to durable memory yet.
- **VR fixture harness** — deferred to post-candy-stabilization. Owner is about to redesign multiple screens to candy aesthetic; capturing VR baselines during active redesign would generate continuous regen friction. The ledger entry for "VR baseline batch tail (VR-5 + VR-7 + VR-8) — needs fixture harness" stays as-is. When candy work settles, ~1-2h captures all baselines in one batch on a stable surface.

## Current state

- **Branch**: `main` (clean, in sync with `origin/main`).
- **Build**: 1799 passing / 0 baseline failing (unchanged from prior session — zero code touched today).
- **Open code work**: none.
- **Open PRs**: none.
- **Cluster D status**: all 6 review-time defers now resolved (4 closed with code, 2 closed today as accepted-as-is).
- **Defer ledger Cluster D section**: header promoted to `Closed — 2026-05-21`.

## Decisions captured this session

1. **Verdict pattern for ROI-negative defers** — instead of leaving items as perpetually "deferred" with vague future-tense suggestions, close with explicit "accepted-as-is" + do-nothing cost analysis inline. Cleans ledger noise and prevents re-litigation in future sessions.
2. **VR baselines during active redesign = anti-pattern** — confirmed via memory + ledger that active UI iteration taxes VR loops (regen 8 baselines per refactor PR, manual diff review each). Harness infra + baselines stay deferred until candy work settles. Optional middle ground available: build only the `/dev/*` route scaffolding + wallet mock helper (the reusable infra layer, ~60% of the harness work) without capturing any baselines yet, giving the owner a Storybook-lite sandbox for candy iteration. Not picked up this session per owner direction.
3. **No Cluster Closure Protocol on defer drains** — protocol is reserved for actual cluster/feature/spec merges to main. Post-merge residual cleanup is a different shape and should not trigger the full housekeeping checklist.

## Next session candidates (VR deferred)

From `SESSION.md`, ordered by real ROI:

1. **Cluster E hardening Tier 2** (~1-3h batch) — concurrent POST atomicity on `/api/games` (Lua wrap of lpush + enforceGameCap), LRANGE null-element guard, `pendingGameIdRef` collision-on-identical-stats key tightening. **Actual data-integrity work**, not polish. Better as one focused Lua-touch session.
2. **Smoke verification on `chesscito.com`** (~5 min) — confirm latest Vercel deploy (from prior session's `e5549b12` push) landed clean. Welcome telemetry events should appear in observability after fresh-device session.
3. **Candy redesign sessions** (per owner's note) — owner is about to refactor several non-candy screens to candy aesthetic. This is the active surface to invest in; VR harness waits until this settles.
4. **VR fixture harness** — postponed; revisit after candy stabilization to avoid baseline regeneration churn.

## Open follow-ups (non-blocking, not coded this session)

- **DeepSeek Coach owner-only housekeeping** (from prior session) — set $0.50 balance alert in DeepSeek dashboard + spot-check `/api/coach/analyze` logs for `coach_response_parse_error` over the next ~1 week. Tracked in prior handoff; no action this session.

---

**Wolfcito 🐾 @akawolfcito**
