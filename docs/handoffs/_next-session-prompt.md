# Next session prompt — Coach Viewer Cluster C follow-up

Paste this in the next session to bootstrap context.

---

Cluster C (Coach Viewer redesign) shipped 2026-05-29 — 28 commits `28ffbfc8..2e79557b` pushed to main → preview deploy live.

**Read first:**
- `docs/handoffs/2026-05-29-coach-viewer-cluster-c-handoff.md` — full session log (4 phases, 27 commits, decisions).
- Memory: `coach-viewer-cluster-c` index entry in `MEMORY.md` + detail at `project_coach_viewer_cluster_c.md`.

**Production status:**
- Production stays on `f54f6fc` (preview-only push pattern from 2026-05-29).
- Production promote gated on VR baselines refresh + MiniPay Android smoke (5 states).

**Choose your path:**

1. **MiniPay smoke + production promote** (~30 min)
   - Open `preview.chesscito.com/coach/{anyGameId}?wallet=0x...` on MiniPay device.
   - Walk 5 states from the state-machine matrix (handoff §State machine table).
   - Specific watchouts: 46vh board cap on iPhone SE 375×667; chapter-break adorno-icon visibility on lighter grass tones.
   - If pass → promote to chesscito.com via Vercel UI.

2. **VR baselines refresh** (post-reboot session, ~1h)
   - Pre-flight per `memory/project_disk_telemetry.md`: `df -h /` + `bash scripts/disk-telemetry.sh save baseline_pre`. Need `<30GB free + swap >2GB` clear.
   - Run `cd apps/web && pnpm test:e2e:visual` — covers Cluster C (5 visor states) + the 14-baseline backlog from `_bmad-output/implementation-artifacts/deferred-work.md`.
   - Bundle into one PR with diff-explanation per file.

3. **Triage the 39 pre-existing vitest env failures** (~30-60 min)
   - All match `TypeError: window.localStorage.clear is not a function`.
   - Affects coach-panel, use-coach-analysis, use-coach-credits, arena-persistence, others.
   - Pre-existing on main (verified via stash 2026-05-29). Likely vitest.setup.ts misalignment.
   - Doesn't block shipping but degrades CI signal.

4. **Open questions from handoff §Open questions** — none are blockers; pick if curious.

**What NOT to touch yet:**
- Visor structure is locked. Don't propose more Sally passes without a clear paint-point from the user.
- The cream-amber-only-on-MOVES rule is intentional: data tables get frames, floating affordances don't. Future surfaces should respect that.

**If user says "ship it":** option 1 + post-promote smoke check.
**If user says "polish more":** ask for screenshot + paint-points; don't speculate.
