# Session Handoff — 2026-05-07

> **Long session** — ~40 commits across multiple workstreams. Primary thread: Coach session memory smoke → diagnosed + fixed multiple production blockers → started hub redesign full migration. Continuation in next session.

---

## What changed in this session

### Coach session memory (production stabilization)
Smoke on 2026-05-06 surfaced the Coach was completely broken for paying PRO users — the bundle had shipped but multiple integration issues kept anyone from actually using the feature. Fixed in cascade:

| Bug | Symptom | Fix | Commit |
|---|---|---|---|
| `.js` extension imports | Vercel build failed with `Module not found: Can't resolve './persistence.js'` | Stripped `.js` from production-source relative imports | `83d102e` |
| Orphan `supabase/` folder | `supabase migration list` saw 3 stale files, hid the 4 newer migrations | Deleted root `/supabase/`; canonical SOT is `apps/web/supabase/` | `0d1a22b` |
| Coach migration not applied | `coach_analyses` table missing in production | `supabase db push --linked --workdir apps/web` | (manual) |
| PRO Coach gate B1 | PRO users hit credit-purchase paywall despite paid subscription | Client now reads `useProStatus()` cached + falls back to `/api/pro/status`; helper `shouldShowPaywall({ proActive, credits })` is single source of truth | `154f806` → `ad084ea` |
| Claim cancel hostility | "You declined the wallet prompt" in red felt accusatory | Soften copy to "Saved for later" + amber tone (warning, not error) | `cd9eb1a` |
| Build cache freshness | "Did the deploy land?" was unanswerable from the user side | `<BuildVersion>` chip bottom-right shows `v.<short-sha>`; Vercel `VERCEL_GIT_COMMIT_SHA` flowed through `next.config.js` env injection + `turbo.json` build cache hash | `196dad5` → `4beebb5` → `927579a` |
| `LOG_SALT` undefined | `hashWallet()` threw on every Coach log line, route 500'd before reaching the LLM | Renamed env var in Vercel + `hashWallet()` returns `"unsalted"` literal placeholder when missing | `01d7213` |
| LLM upstream 503 | OpenAI-flavored provider returned 503 with no body for hours | Switched to OpenRouter (`openai/gpt-oss-120b:free`); diagnostic banner in `<CoachFallback>` now surfaces internal error message | `1cfd136` → (env rotation) |
| PRO sees "Meet Your Coach" welcome | Free-tier upsell shown to paying users on first tap | `handleAskCoach` checks `proActiveCached` BEFORE the welcome-storage gate | `9bf2c7a` |
| Ask Coach CTA invisible on win | Only Save Victory was visible; Ask Coach was hidden behind mint flow | Wired `<AskCoachButton>` into `<VictoryCelebration>`, restyled to high-contrast emerald gradient | `02f5717` |
| /arena legacy entry panel | Direct visit showed "Community prize pool · Loading pool…" placeholder | Arena scaffold is now the default; opt-out via `?arena=legacy` | `af160bb` |

End state: PRO Coach analyzes correctly via OpenRouter, returns full structured response, history footer renders, banner appears once.

### Hub redesign full migration (started, ~50% done)
After the user's smoke described the new hub as "feo y roto", an audit (`docs/audits/2026-05-07-hub-audit.md`) traced the root cause: `<HubScaffoldClient>` is pure presentation — every CTA round-trips to `/hub?legacy=1&action=X` to mount `<PlayHubRoot>`, then bounces back. Strategy A (port sheets into scaffold) was approved. Shipped this session:

| Fix | Commit |
|---|---|
| Play CTA → `/arena?fresh=1` (selector, not auto-launched board) | `749a15c` + `45e4767` |
| Coach chip on HUD top → `/coach/history` (D1) | `a06cde2` |
| `<ProActiveCTA>` skips `onClose()` on `/arena` nav (B2 race fix) | `551b5d8` |
| Trophies ported to `/trophies` standalone route | `f07fe2b` |
| Back-to-hub button on `/trophies` + `/coach/history` (was trapped) | `d637d5f` |
| `/coach/history` entries clickable → `<CoachPanel>` modal | `d8a6002` |
| `/coach/history` rate-limit crash fix (`enforceReadRateLimit` + Array.isArray guard) | `bc9e3c3` |

### Tooling additions
| Item | Commit |
|---|---|
| `pnpm grant-pro 0xWALLET [days]` CLI for QA wallets | `ead8fb8` |
| `tsx@4.21.0` pinned dev-dep (was using non-existent global) | `00b68ac` |
| Playwright e2e specs scaffolds (privacy + claim cancel) | `24b9d57` |

### Documentation
| Doc | Path |
|---|---|
| Flow audit (expected vs actual per surface) | `docs/audits/2026-05-07-flow-audit.md` |
| Discoverability roadmap | `docs/audits/2026-05-07-discoverability-roadmap.md` |
| Hub CTA audit | `docs/audits/2026-05-07-hub-audit.md` |
| This handoff | `docs/handoffs/2026-05-07-session-handoff.md` |
| Triage plan | `docs/superpowers/plans/2026-05-07-feedback-triage-plan.md` |

---

## Open issues for next session

### Critical (paying-user pain) — start here
1. **ProSheet mobile dock overlap** — on mobile the bottom dock covers the "Play in Arena" CTA inside `<ProSheet>`, no scroll. Two fixes overlap: (a) port `<ProSheet>` to scaffold so no legacy round-trip + own bottom safe-area, (b) increase sheet `pb-[5rem]` or hide dock when sheet open.
2. **ShopSheet no scroll** — same root cause as above. User reports content cut off below.

### High (visible UX gap)
3. **Mastery tiles → distinct pages (B7)** — currently all 6 reward tiles route to the same legacy `<BadgeSheet>` (Queen/King have no exercises so the piece query is dropped → identical surface). Either port `<BadgeSheet>` to scaffold with per-piece state OR create `/badges/[piece]` route.
4. **`principalbutton.png` integration (B6)** — asset exists in `design/new-assets-chesscito/`; replace the current generic Play CTA art on hub.

### Medium (architecture cleanup)
5. **Port ProSheet to scaffold** — heavy work (~3h): full PRO subscription flow (approve, buyItem(6), `/api/verify-pro`, retry on verify-failed). Need to extract logic from `<PlayHubRoot>` into a `usePROSheetState()` hook so both surfaces consume it.
6. **Port ShopSheet to scaffold** — heavy work (~2h): Founder Badge + Retry Shield purchases.
7. **Port BadgeSheet to scaffold** — medium (~1.5h): claim badge mutation, blocks B7.
8. **Delete `?legacy=1` branch + `<PlayHubRoot>`** — once 5/6/7 land, the 1612-line legacy component becomes dead code. Cleanup pass.

### Low (post-migration polish)
9. ProSheet active state — sub-line copy variants (already shipped via `<ProActiveCTA>` but worth a re-read after the bounce-loop fix lands).
10. Coach Analysis screen polish — board snapshots at key moments + better lessons formatting (C1 from discoverability roadmap).
11. Past Sessions promotion — already linked from hub, but list could surface "your last analysis" preview.

### Tech debt
- AI SDK migration (validation hook keeps suggesting it; OpenAI client → `@ai-sdk/openai` for unified streaming/tools).
- Vercel Workflow for Coach analyze polling logic (durable execution).
- Observability instrumentation on routes (logging+errors).

---

## State of important systems

| System | Status | Notes |
|---|---|---|
| Build | Green | `pnpm --filter web test` 991/991, `tsc --noEmit` clean |
| Vercel deploy | Auto | Latest commit `bc9e3c3` (next session start) |
| Supabase migrations | Synced | 7/7 Local ↔ Remote per `supabase migration list --linked` |
| Coach LLM | OpenRouter | `openai/gpt-oss-120b:free`; rotates if removed from free roster |
| `LOG_SALT` env | Set | If missing again, route stays up (placeholder) but logs say "unsalted" — fix env immediately |
| Build SHA chip | Live | `v.<sha>` bottom-right; `v.dev` locally |

---

## Decisions taken (record for continuity)

1. **Stay on-demand, no formal sprint cadence** — user picked this for now since backlog is captured in the roadmap doc.
2. **Hub fixes before gameplay features** — "está feo y roto" is the user's #1 priority over Treasure Hunt / Knight Puzzles (#104, #105).
3. **Strategy A (port sheets) over Strategy B (dedicated routes)** — sheets already exist and are tested; faster to migrate handlers in-place.
4. **`/play-hub` legacy stays as alias** during migration — kill once all sheets ported.
5. **`gpt-oss-120b:free` for dev period** — switch to paid (`gpt-4o-mini`) when opening to public users.

---

## How to resume

```bash
# Pull latest
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito pull origin main

# Sanity check
cd apps/web
pnpm test       # expect 991/991
pnpm exec tsc --noEmit   # expect 0 errors

# Read the hub audit before touching code
cat ../../docs/audits/2026-05-07-hub-audit.md

# Recommended first task: port ProSheet to scaffold
# Files to read:
#   apps/web/src/components/play-hub/play-hub-root.tsx  (lines 200-1450 — ProSheet wiring)
#   apps/web/src/components/pro/pro-sheet.tsx
#   apps/web/src/components/hub/hub-scaffold-client.tsx
```

---

## Smoke checklist for next session

When the next session starts (assuming `bc9e3c3` is the live deploy):

1. `/hub` chip dice `v.<sha-de-bc9e3c3-o-mas-reciente>` → cache fresca
2. Tap **Play** → `/arena?fresh=1` → ve selector, NO tablero
3. Tap **Coach chip** (icono whistle, top row) → `/coach/history`
4. `/coach/history` entry tap → modal `<CoachPanel>` con análisis
5. `/coach/history` back arrow → vuelve a `/hub`
6. Tap **Trophy chip** → `/trophies` con back arrow
7. Tap **PRO chip** → ProSheet (legacy bounce sigue, dock overlap pendiente)
8. Tap **Pass Training "Play in Arena"** → `/arena` directo (B2 fix)
9. Finish a match → Ask the Coach → análisis real (no Quick Review fallback)

---

## Final commit count

~42 commits in this session. Per the project's "30 tasks/session" rule, this is over budget — the cascade of dependent bug discoveries (build → DB → LLM → UX → architecture) drove the count. Next session should respect the limit more strictly; one big port (ProSheet) is enough.
