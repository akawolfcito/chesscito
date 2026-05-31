# Next session prompt — post 2026-05-30 em-dash sweep cluster

Paste this in the next session to bootstrap context. Or just say "continuemos" — the agent should detect this file and follow its instructions.

---

**State at start of next session:** main = `974afd07`. Three handoffs from 2026-05-30 are committed; the em-dash sweep is the most recent.

**Read first:**
- `docs/handoffs/2026-05-30-em-dash-sweep-handoff.md` — full session log, what's swept, what's left, why.
- Earlier same-day handoffs (in chronological order):
  - `docs/handoffs/2026-05-30-coach-bugs-shop-vitrine-account-inventory-handoff.md`
  - `docs/handoffs/2026-05-30-playercolor-callouts-vr-refresh-handoff.md`
  - `docs/handoffs/2026-05-30-shop-cleanup-vr-settle-pro-days-handoff.md`
- Memory updates this thread: `feedback_anti_ai_prose` (rule was already there; now backed by a regression test that prevents drift).

**Choose your path:**

1. **Pre-flight + VR baseline refresh** (post-reboot, ~1h-1.5h)
   This is the unblocker for everything else. Per `memory/project_disk_telemetry.md`:
   - `df -h /` + `bash scripts/disk-telemetry.sh save baseline_pre`. Need <30GB free + swap >2GB cleared.
   - `cd apps/web && pnpm test:e2e:visual` — targets: hub-shop-sheet-open settle fix (`1fec59c8`), Cluster C visor states, shop+vitrine deltas, the 14-baseline backlog from `_bmad-output/implementation-artifacts/deferred-work.md`.
   - If any baseline drifted from the morning's chunks, refresh in a dedicated `test(vr): refresh baselines` commit with rationale per file.

2. **Em-dash sweep chunks 8+** (~1-2h after VR is green)
   42 em-dashes remain in editorial.ts + i18n. Each next chunk should be one VR baseline's worth of strings, so the baseline refresh stays atomic with the sweep. Order of attack (by baseline-scope, smallest first):
   - **vr9-arena-end-state-** (7 baselines) — `"Checkmate — You Win!"`, `"Checkmate — AI Wins"`, `"Stalemate — Draw"`. 3 EN + 2 ES.
   - **hub-clean** — `proInactiveAriaLabel`, `activeLabel`, `inFlightLabel`, `"Unlock PRO — full experience"`. ~6 EN + 4 ES.
   - **landing tagline + share-card meta** — `"Train your mind with pre-chess challenges — a Celo MiniPay game"` + the FIDE Master ES line (HARD RULE: don't weaken to imply medical benefit).
   - **Misc visible hints** — `prizePoolSoonHint`, `analysisPendingHint`, `shieldsStatusEmpty`, `firstStepHint`, etc. ~10 strings; likely no VR coverage but verify each.
   Each chunk: lower per-file ceilings in `anti-ai-prose.test.ts` to match the post-sweep count.

3. **MiniPay smoke + production promote** (~30-45 min)
   Verify the full chain on device after Path 1 completes:
   - Save Victory from visor end-to-end (not return 400).
   - sessionStorage scoping: SAVE in game A → lock/unlock → game B → Save tile present.
   - Shop cards: per-tone pastel + visible icon overhang past left edge.
   - AccountSheet: Shields + Founder + Manage PRO rows render with correct status + tap targets.
   If pass → promote to chesscito.com via Vercel UI.

4. **Phase 2 of shop oscuridad — in-context callouts** (~3-4h, gated on user signal)
   Don't ship reflexively. Confirm users still report oscuridad after Phase 1 lands in production.

5. **Persist `playerColor` in GameRecord** (~1-2h)
   Removes the parity-based fallback in the visor. Touches `/api/games` POST + GameRecord type + arena POST body.

6. **Triage the ~39 pre-existing vitest env failures** (~30-60 min)
   All match `TypeError: window.localStorage.clear is not a function`. Doesn't block shipping but degrades CI signal.

**What NOT to touch yet:**
- Visor structure is locked from Cluster C.
- The cream-amber-only-on-MOVES rule still holds: data tables get frames, floating affordances don't.
- Do NOT add a "you'll lose mint chance" warning in resign flow.
- Do NOT propose a context provider refactor for `TrophiesBody` + `TrophiesHeroBand` unless profiling confirms the duplicate `/api/my-victories` is hurting.
- Do NOT add em-dashes to user-facing copy. The ceiling test will fail the build.

**If user says "ship it":** option 1 + 3 + post-promote smoke.
**If user says "continuemos":** read this file + the em-dash handoff, then ask which path. Default to option 1 (VR pre-flight) unless the user redirects.
**If user says "what's pending":** read deferred ledgers in the four 2026-05-30 handoffs.
