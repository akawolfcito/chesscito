# Session Handoff — 2026-05-21

## Status snapshot

- **Branch**: `main` (clean, in sync with `origin/main`)
- **Build**: 1727 passing / 0 baseline failing · `tsc` clean
- **Production**: `chesscito.com` GREEN — both commits below deployed
- **Last commit**: `f1500642` (VR Step 2 baselines)

## Shipped today (2 commits)

1. **`0a1ba2e5` — chore(editorial): drop dead PRO/Coach/Arena copy + stale meta-tests**
   - Removed 3 unrendered constants whose call sites were already deleted in prod:
     - `ARENA_COPY.coachHudHint`
     - `COACH_COPY.featureBanner` + `chesscito:coach-history-callout-seen` flag
     - `PRO_COPY.perksRoadmap`
   - Also removed the meta-test asserting against `perksRoadmap` (baseline 1728 → 1727, intentional)
   - Net: 3 files, +2 / −58

2. **`f1500642` — test(vr): add Step 2 baselines for /support + /about static pages**
   - 2 new tests in `apps/web/e2e/visual-regression.spec.ts` ("Step 2 baselines")
   - 4 PNG baselines: `{support,about}-page-{minipay,desktop}-darwin.png`
   - Closes the editorial-drift gap on the only 2 surfaces that don't need fixtures
   - Net: 5 files, +31 lines spec, ~2.3MB assets

## In flight — needs YOUR validation

**Coach LLM provider switch: OpenRouter → DeepSeek direct.** No code change required (the route at `apps/web/src/app/api/coach/analyze/route.ts:21-29` is provider-agnostic via 3 env vars). User changed the 3 Vercel env vars + triggered redeploy at end of session:

```
COACH_LLM_API_KEY      = sk-...           (DeepSeek key)
COACH_LLM_BASE_URL     = https://api.deepseek.com/v1
COACH_LLM_MODEL        = deepseek-chat
```

### What to verify next session (in order)

1. **Redeploy completed?** Check Vercel → Project → Deployments → last deploy status.
2. **Smoke test**: trigger 2-3 Coach analyses end-to-end from `chesscito.com` (different game shapes: short win, longer loss, draw if possible).
3. **Parser check**: Vercel → Logs → filter `/api/coach/analyze` for last 24h, look for `level=error` or `coach_response_parse_error` events.
4. **If clean** → switch is good, document in MEMORY.md, close this item.
5. **If parser errors** → DeepSeek output shape differs from gpt-4o-mini. Options:
   - Adjust `normalizeCoachResponse` in `lib/coach/normalize.ts` to be more lenient
   - Fall back to Groq (`llama-3.3-70b-versatile` via `https://api.groq.com/openai/v1`)
   - Revert to OpenAI direct (gpt-4o-mini) — more expensive but reliable

### Cost context (current scale: 2-5 users)

- Per-analysis cost on DeepSeek: ~$0.0012 typical (range $0.00088–$0.00156)
- $1.90 current balance ≈ **~1,500 análisis** at typical cost
- With 5 active users → balance lasts **7-8 months**
- Set alert at $0.50 in DeepSeek dashboard

## Backlog (prioritized)

Source of truth: `_bmad-output/implementation-artifacts/deferred-work.md` (gitignored, local-only convention).

### High payoff, low effort

- **PR #107 (`phase-1-ui-zone-map`) triage** — open since 2026-05-02. Decide: rebase+merge, close superseded, or close won't-do. ~15 min. (link: https://github.com/akawolfcito/chesscito/pull/107)

### High payoff, half-day effort

- **VR fixture harness session** — captures VR-5 (mint pills) + VR-7 (Arena persistence toast × 4 variants) + VR-8 (`/coach/history` Analyze chip) in ONE batch. All 3 need:
  - Reusable wallet mock helper (`page.addInitScript` faking wagmi storage)
  - `/dev/persist-overlay?state=...` route for VR-7 mount-in-isolation
  - `/dev/mint-states?phase=...` route for VR-5 mount-in-isolation
  - `page.route()` mocks for VR-8 games-by-wallet endpoint
  - Harness reusable for future VR additions — high-leverage investment
- **Traceability hygiene policy** — adopt as standing process:
  - Close GH issues/milestones after each shipped cluster
  - Keep top-level `README.md` synced with live status (currently drifted; missing Victory NFT, Arena, Coach mentions)
  - Codify the close-out checklist in `CLAUDE.md` or `docs/process/traceability.md`

### Cluster E hardening (10 items, none blocking)

Tracked in `_bmad-output/implementation-artifacts/deferred-work.md`. Highlights:
- Concurrency atomicity on `/api/games` POST
- Redis pipeline in `enforceGameCap`
- LRANGE null guard
- UUID guard tightening
- `/api/games` POST error logging (`Blind hunter #12`)
- `handleAnalyzeFromHistory` ↔ `handleAskCoach` flow unification (`Acceptance auditor #12`)

Each is small (1-3h) but they share infrastructure — better batched in 1-2 sessions than picked one-by-one.

## Decisions made this session

1. **VR scope corrected**: VR-5/7/8 were originally estimated "Media" → actual is "Alta" (need fixture harness). Treat them as ONE session, not 5 sequential captures.
2. **LLM provider**: DeepSeek direct chosen over Groq/Together because: cheapest, OpenAI-compatible (zero code change), own infra (not a router → more reliable than OpenRouter which is the cause of the current intermittent failures).
3. **Editorial cleanup approach**: meta-tests asserting against dead constants must die with the constants. The "cleanup tracked separately" pattern with surviving assertions is dead weight.

## Next session — recommended order

1. **Validate DeepSeek** (if not done yet) — ~10 min if clean, longer if parser errors.
2. **PR #107 triage** — close the loose end. ~15 min.
3. **Pick ONE of**: VR fixture harness, traceability audit, or first Cluster E hardening batch. Depends on what feels most valuable when you arrive.

Don't try to do all of these in one session. The 30-task per-session rule from global CLAUDE.md is real — quality degrades past it.

---

**Wolfcito 🐾 @akawolfcito**
