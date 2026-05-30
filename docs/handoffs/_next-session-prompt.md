# Next session prompt — post 2026-05-30 cluster

Paste this in the next session to bootstrap context.

---

Session 2026-05-30 shipped 12 commits `1690a806..792e9a89` across 4 clusters: Coach Viewer bugs (Ask Coach silent, sign-victory 400, mint state leak), shop+vitrine sheets (icon clip, hero extracts, vitrine migration), Shop oscuridad Phase 1 (account inventory rows), Moment NFT future doc. Production stays on `f54f6fc` pending smoke + VR.

**Read first:**
- `docs/handoffs/2026-05-30-coach-bugs-shop-vitrine-account-inventory-handoff.md` — full session log with deferred ledger.
- Memory updates: `project_mint_hook_gameid_scoping` (new), `project_account_inventory_rows` (new), `project_vitrine_hero_band` (updated — shop now joined the family + extract-vs-bleed gotcha).
- For Moment NFT decisions: `docs/product/moment-nft-future-feature-2026-05-30.md` + memory `project_moment_nft_roadmap`.

**Choose your path:**

1. **MiniPay smoke + production promote** (~30-45 min)
   Verify the full chain on device:
   - Coach Viewer: Ask Coach spinner + in-place rehydration + smooth-scroll.
   - Save Victory from visor: should succeed end-to-end (not return 400).
   - sessionStorage scoping: SAVE in game A → lock/unlock → game B → Save tile present.
   - Shop cards: per-tone pastel + visible icon overhang past left edge.
   - Trophies/Leaderboard: hero anchor visibly overhangs, hero stays persistent on scroll.
   - AccountSheet: Shields + Founder rows render with correct status + tap targets.
   - Coach Mi Coach row: shows explicit credit count when free user has credits.
   If pass → promote to chesscito.com via Vercel UI.

2. **Phase 2 of shop oscuridad — in-context callouts** (~3-4h)
   Inventory is now visible in AccountSheet; next iteration surfaces the same signal AT THE POINT OF USE:
   - Arena HUD: `🛡 {N}` chip when shields > 0.
   - Coach Ask CTA: "(uses 1 credit · {N} left)" hint.
   - Founder perks surface (gated on defining what Founder unlocks beyond recognition — coordinate with PRO theme work in `project_theme_system_foundation`).
   Do NOT ship Phase 2 reflexively — confirm users still report oscuridad after Phase 1 lands in production.

3. **Persist `playerColor` in GameRecord** (~1-2h)
   Today the visor derives playerColor from `moves.length` parity (commit `dbaf5b1f`). Reliable while win = checkmate, but adding the field to the games persistence write path removes the implicit assumption. Single-cluster task. Touches: `/api/games` POST + GameRecord type + arena POST body.

4. **VR baselines refresh** (post-reboot, ~1h)
   Pre-flight per `memory/project_disk_telemetry.md`: `df -h /` + `bash scripts/disk-telemetry.sh save baseline_pre`. Need `<30GB free + swap >2GB` clear.
   Run `cd apps/web && pnpm test:e2e:visual` — covers Cluster C visor states (5) + Cluster 2 shop+vitrine deltas + the 14-baseline backlog from `_bmad-output/implementation-artifacts/deferred-work.md`.

5. **Triage the ~39 pre-existing vitest env failures** (~30-60 min)
   All match `TypeError: window.localStorage.clear is not a function`. Pre-existing on main. Likely `vitest.setup.ts` misalignment. Doesn't block shipping but degrades CI signal.

6. **Shop catalog cleanup — remove dead `bg` PNG references** (~30 min)
   Shop tiles no longer render `SHOP_TILE_ASSETS[].bg`. The field + the `/art/shop/bg-*.png|webp|avif` triplets (8 references) can be pruned.

7. **Standalone /trophies page route hero extract** (~30 min)
   Sheet was extracted in commit `507bcb8b` but the standalone `app/[locale]/trophies/page.tsx` still has the hero inside its own scroll. Same clip risk; sheet is primary so this was deferred.

**What NOT to touch yet:**
- Visor structure is locked from Cluster C. Don't propose more Sally passes without a clear paint-point from the user.
- The cream-amber-only-on-MOVES rule still holds: data tables get frames, floating affordances don't. Future surfaces should respect that.
- Do NOT add a "you'll lose mint chance" warning in resign flow — would clash with future Moment NFT framing.
- Do NOT propose a context provider refactor for `TrophiesBody` + `TrophiesHeroBand` unless profiling shows the duplicate `/api/my-victories` fetch is hurting.

**If user says "ship it":** option 1 + post-promote smoke check.
**If user says "polish more":** ask for screenshot + paint-points; don't speculate.
**If user says "what's pending":** read the deferred-work ledger in the handoff doc §Outstanding work, not from memory.
