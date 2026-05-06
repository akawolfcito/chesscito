# Bundle PRO v1 — Etapa 1 + 3 Shipped, Etapa 2 Spec Hardened (2026-05-06)

> Author: Wolfcito + agent.
> Status: **Closed.** All 5 commits pushed to `origin/main`. Bundle PRO v1 follow-ups #1, #2, #3 from the prior observability handoff are CLOSED. Etapa 2 (Coach session memory) has a hardened design spec ready for `superpowers:writing-plans`. Implementation deferred to next session for context-window hygiene.

---

## 1. Session arc

Opened on the §6 follow-up backlog from the previous handoff (`docs/handoffs/2026-05-03-observability-abi-automation-ux-handoff.md`). User confirmed the product-decision blocks could be lifted, so the session resolved bundle PRO v1 in two flight phases plus a deep design pass.

**Phase 1 — Etapa 1 of bundle (perks copy, ship today):** rewrote `PRO_COPY.perksActive` to surface "AI Coach: instant analysis, no daily limit" (exact reframe of existing Phase-0 server behavior, no new code) and tightened `perksRoadmap` 5 → 4 with "Personalized coaching plan from match history" added at position 0 as the next-milestone signal.

**Phase 2 — Etapa 3 of bundle (Coach signposting in-match):** added a quiet HUD signpost beneath the matchup row in `<ArenaHud>`, gated by `NEXT_PUBLIC_ENABLE_COACH`, hidden on end-state. Explicitly NOT PRO-conditional (Coach is a free-tier feature with credits; the hint is pure discovery for everyone). Dedicated unit tests added.

**Phase 3 — Etapa 2 design (Coach session memory; the heavy lift):** ran the `superpowers:brainstorming` skill end-to-end — 8 multiple-choice clarifying questions, sectioned-and-approved design, 866-line spec written, self-reviewed inline, then sent through an adversarial red-team review (23 findings: 8 P0 / 10 P1 / 5 P2) and patched. After the red-team patch, user provided 7 additional implementer-driven adjustments (no move list in v1, Supabase upsert syntax fix, client-side nonce, hard-guard prompt branch, `CoachGameResult` centralized union, 5-PR rollout split, free-path snapshot test as hard-locked regression guard). Final spec is 908 lines.

Phase 2 (Coach session memory implementation) is intentionally NOT in this session. The spec is the deliverable; implementation begins next session via `superpowers:writing-plans` → 5 PRs.

---

## 2. Commits shipped (5, in chronological order)

| SHA | Subject | Purpose |
|---|---|---|
| `bfe0e88` | `feat(pro): bundle v1 — surface Coach instant analysis + tighten roadmap` | Closes follow-up #1 (bundle decision) + #2 (perks clarity). `perksActive[0]` reframe + `perksRoadmap` 5 → 4 with B at the head. ProSheet tests use array-index access so no test edits needed. 829/829 unit tests pass; tsc clean. |
| `6491614` | `feat(arena): in-match Coach signpost in ArenaHud` | Closes follow-up #3 (Coach signposting). New `ARENA_COPY.coachHudHint` constant; `<ArenaHud>` gains optional `showCoachHint` prop; `arena/page.tsx` passes `ENABLE_COACH`. New `arena-hud.test.tsx` with 4 assertions (live → hides on end-state → hides when prop false → default hidden). 833/833 unit tests pass; tsc clean. |
| `845270a` | `docs(spec): coach session memory design (Etapa 2 PRO bundle v1)` | Initial 509-line design spec from the brainstorming skill. 8 resolved decisions in §3. Self-reviewed inline (`historyMeta.gamesPlayed` rename, `REDIS_KEYS.backfillClaim` helper). |
| `8f0f708` | `docs(review): adversarial red-team on coach session memory spec` | 195-line red-team report at `docs/reviews/coach-session-memory-redteam-2026-05-06.md`. 23 findings (8 P0 / 10 P1 / 5 P2). Subagent verified findings against actual repo files (full claims table at the bottom of the report). |
| `45f9d54` | `docs(spec): patch coach session memory spec — apply 23 red-team findings` | All 23 findings resolved inline. Spec grew 509 → 866 lines. New §15 cross-reference table maps every finding ID to its resolution location. |
| `f3f2372` | `docs(spec): apply 7 implementer-driven adjustments to coach memory spec` | 7 stakeholder-requested hardening passes: privacy copy alignment (no move list), Supabase API fix (`upsert` not `.onConflict()`), client-side nonce, no-evidence prompt hard-guard, `CoachGameResult` centralized, 5-PR rollout split, free-path snapshot test as hard-locked guard. Spec at final 908 lines. |

---

## 3. Tests + suite state

| Surface | Result |
|---|---|
| Unit suite (after Etapa 3 commit) | **833/833** (83 files; +4 over the 829 baseline). |
| TypeScript check | 0 errors (`npx tsc --noEmit`). |
| Visual regression | Not re-run; Etapa 3 added a small text-nano italic line in `<ArenaHud>` — covered by unit tests (`arena-coach-hint` testid). Run `pnpm --filter web test:e2e:visual` if a baseline update is desired. |
| Full E2E | Not re-run. The 26 pre-existing failures from `docs/reviews/e2e-baseline-red-2026-05-02.md` remain the same baseline; this session introduced 0 new failures. |

---

## 4. Production state at handoff

| Subsystem | Status |
|---|---|
| Bundle PRO v1 perks copy | Live. `perksActive` reframe is on production (`bfe0e88`). `perksRoadmap[0]` publicly promises Coach session memory; that promise is binding once `superpowers:writing-plans` produces the implementation plan. |
| Arena Coach HUD signpost | Live (`6491614`). Renders during play; hidden on end-state; disappears when `NEXT_PUBLIC_ENABLE_COACH=false`. |
| `<CoachPanel>` post-match `<AskCoachButton>` | Live (already shipped in earlier sessions; not touched this session). |
| Etapa 2 design spec | **Final, hardened, awaiting plan.** `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` — 908 lines. Red-team report at `docs/reviews/coach-session-memory-redteam-2026-05-06.md`. |
| `pro-tap-debt-due-by` | Still `2026-07-01`. ~56 days. No motion this session. |

Free-tier behavior is bit-identical to the start of session — the Etapa 2 spec is explicit that this property must be preserved across all 5 future PRs.

---

## 5. §6 follow-up scoreboard (vs prior observability handoff)

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Free → PRO content tier (bundle v1) | **CLOSED** (`bfe0e88`) | Decided: Option C (Coach instant analysis, copy reframe only — no new server logic) + Option B (Coach session memory — promised in roadmap, deep-design'd this session for v2). |
| 2 | Perks clarity | **CLOSED** (`bfe0e88`) | `perksActive` rewritten; `perksRoadmap` tightened. |
| 3 | Coach signposting in-match | **CLOSED** (`6491614`) | HUD hint shipped. Post-game `<AskCoachButton>` was already live. |
| 4 | Inactive PRO pill visibility | Already CLOSED (`9d0021e`) | — |
| 5 | Server observability | Already CLOSED | — |
| 6 | verify-failed retry UX | Already CLOSED (`b8bea6b`) | — |
| 7 | ABI automation | Already CLOSED | — |
| 8 | Compensation pass for silently-failed Coach packs | NOT STARTED | Cheap (~30 min). Carried forward. |
| 9 | Tracker selection (Sentry / Axiom / Better Stack) | NOT STARTED | One-line sink swap once chosen. |
| 10 | E2E baseline cleanup | NOT STARTED | 26 pre-existing failures. |
| Phase 2 layout primitives (`<ContextualActionRail />` Z4 + per-screen Z1 migration + `<ProChip>` deletion) | HALTED | Was awaiting bundle decisions; now technically unblocked but lower priority than Etapa 2 implementation. |

---

## 6. Etapa 2 spec — ready-for-plan checklist

Everything below is required reading before invoking `superpowers:writing-plans` next session.

- [x] Spec final at `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md` (908 lines)
- [x] Red-team report at `docs/reviews/coach-session-memory-redteam-2026-05-06.md` (195 lines, 23 findings, all resolved per §15 of the spec)
- [x] All 8 brainstorm decisions captured in §3
- [x] All 23 red-team findings cross-referenced in §15
- [x] All 7 implementer adjustments folded in (move list, Supabase syntax, nonce gen, no-evidence guard, `CoachGameResult`, 5-PR split, free-path snapshot guard)
- [x] Free-path bit-identity contractually guaranteed across all 5 PRs
- [x] Module map verified against actual paths (no `legal-copy.ts`, no `/legal/privacy/`, no `<Dialog>` primitive)
- [x] Schema concrete: `coach_analyses` with `kind` column, check constraints, RLS, indexes
- [x] 6-label v1 weakness taxonomy fully defined (4 keyword + 2 positional)
- [x] Delete endpoint hardening: nonce SETNX + chain/domain message binding + recovered-vs-body strict equality + 5 explicit error codes
- [x] Cron purge: batched LIMIT 5000 + advisory lock + GH Actions concurrency group + error branch
- [x] Privacy: 1y rolling TTL + delete-by-self (signed, replay-resistant) + lost-key recourse
- [x] §11 testing strategy explicitly hard-locks the free-path snapshot test as a regression guard

Open implementation-plan questions (intentional, captured in §14):
- Banner micro-copy for `<CoachPanel>` first-run callout (`COACH_COPY.featureBanner`)
- `getSupabaseServer()` null branch handling at each call site (fail-soft skip vs. 503)
- Soft-cap row-cleanup query timing (synchronous vs. `waitUntil`)
- Smoke-test corpus for taxonomy validation (collect 20-30 real `mistake.explanation` strings)

---

## 7. Next-session entry point

**First action next session:** invoke `superpowers:writing-plans` skill with the spec path as context.

```text
Load spec: docs/superpowers/specs/2026-05-06-coach-session-memory-design.md
Generate 5 separate implementation plans matching the §13 PR sequence:
  PR 1 — DB + tags taxonomy (schema migration + lib/coach/weakness-tags.ts + types)
  PR 2 — persistence + prompt template (lib/coach/persistence.ts + history-digest.ts + prompt-template.ts changes)
  PR 3 — analyze route wiring + backfill (app/api/coach/analyze + lib/coach/backfill.ts + redis-keys + logger)
  PR 4 — Delete UI + DELETE endpoint (route DELETE method + new /coach/history page + components)
  PR 5 — Privacy + cron + copy unlock (privacy page + cron-purge + featureBanner + perksRoadmap → perksActive swap)
Each plan must enforce: free-path snapshot test stays green throughout.
```

Each PR ships independently per §13. Earlier PRs introduce dormant capability that later PRs activate. Free-tier behavior MUST stay bit-identical across the entire sequence — there is a regression guard test in `prompt-template.test.ts` that asserts this.

After plan generation, run TDD per global workflow rules (red → green → refactor) for each PR. Granular atomic commits inside each PR.

---

## 8. Carried forward (not addressed this session)

Listed in suggested execution order — independent of Etapa 2 work, can be picked up before, during, or after.

1. **Compensation pass for silently-failed Coach packs** (was §6 #8) — barrer txHashes pre-`4c8748f` y re-postear a `/api/coach/verify-purchase`. Idempotent vía Redis 90d dedupe. ~30 min.
2. **Tracker selection** (was §6 #9) — pick Axiom / Sentry / Better Stack. Logger sink swap is one line; main work is account setup + DSN env var. Recommendation in prior handoff was Axiom for log-first observability.
3. **E2E baseline cleanup** (was §6 #10) — 26 failures in `docs/reviews/e2e-baseline-red-2026-05-02.md`. ~1-2 days.
4. **Phase 2 layout primitives** — `<ContextualActionRail />` Z4 + per-screen Z1 migration + legacy `<ProChip>` deletion. Originally HALTED on bundle decisions; now technically unblocked but de-prioritized below Etapa 2.
5. **`onProTap` debt closure** — when Shop ships its PRO sub-section. Hard deadline `2026-07-01` (~56 days). Should fold into the same release that flips `perksRoadmap[0]` → `perksActive` in PR 5.

---

## 9. Open questions for the next session

- **PR cadence vs. session budget.** 5 PRs is a lot for one session. Recommendation: PR 1 (DB + tags + types) is fully parallel-safe and small (~200 LoC + migration). Ship it standalone as a warm-up to load context, then dispatch PR 2/PR 3 as separate parallel work-streams. PR 4 + PR 5 can land sequentially after.
- **Banner micro-copy.** The `<CoachPanel>` first-run callout (`COACH_COPY.featureBanner`) is the only UX surface where copy is intentionally undefined in the spec. Will likely need 30 minutes of writing during PR 5.
- **Smoke-test taxonomy validation.** Before PR 1 ships, dump 20-30 real `mistake.explanation` strings from current Redis history and confirm the 6-label keyword rules cover ≥75% of them. If not, expand the keyword regex sets (NOT the label set itself — labels are the v1 contract).
- **`PRIVACY_COACH_COPY` location.** Spec says it lives in `editorial.ts` per CLAUDE.md SSOT rule. Verify during PR 5 that no file-size limit pushback comes from the editor (`editorial.ts` is already large).

---

## 10. Bottom line

- **Bundle PRO v1 is delivered as far as the immediate-ship surface goes.** The promise ("Personalized coaching plan from match history") is publicly visible in `perksRoadmap`. The implementation that backs it is fully designed, hardened against an adversarial review, and stakeholder-adjusted.
- **Two surface-level wins also shipped:** PRO perks copy reframe + in-match Coach HUD signpost. Both improve discovery without new server logic.
- **Etapa 2 implementation is the next session's full agenda.** The spec is dense — 908 lines — but every section is traceable: 8 brainstorm decisions, 23 red-team findings, 7 implementer adjustments, all cross-referenced in §15.
- **Free path is contractually frozen** through all 5 future PRs by an explicit hard-locked snapshot test in `prompt-template.test.ts`.

Sprint closed. Spec hardened. Ready for plan generation.

— Wolfcito + agent
