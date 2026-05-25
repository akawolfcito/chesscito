# Handoff — Account Chip + UX Polish Session

**Date:** 2026-05-25
**Owner:** Wolfcito
**Branch:** `main`
**Commit range:** `1dd5f121..HEAD` (16+ commits)

## What shipped

### Cluster A — Account chip + PRO color variant
- Renamed `/exercises` PRO chip → "Account" / "Cuenta"; chip persists across all 3 wallet states (disconnected = `Connect` pill matching `/hub`, connected = `Account` cream pill, PRO = `Account` purple pill via `.hub-hud-pill--pro`)
- AccountSheet iconSlot updated to match the chip (account-icon)
- `padding-left` of `.hub-hud-pill` bumped 0.85rem → 1.05rem for icon-text breathing room

### Cluster B — Phase 2 connect-prompt
- `useConnectPrompt(milestone)` hook + `ConnectPromptToast` component
- Wired at 3 milestones: ★★★ (`/exercises`), arena victory, BadgeSheet open
- `useCallback` on `show` / `dismiss` after the /arena PLAY regression (see fragility note below)

### Cluster C — PRO ornament frames
- `marco-blue-pro.png` / `marco-red-pro.png` layered around player + bot avatars in /arena when PRO is active
- `<PlayerAvatar pro={isProActive} />` API
- Marco at 152% of parent, avatar scaled to 0.88 inside the cutout

### Cluster D — UX feedback fixes (5 items)
- **#4** dock center button now closes Account/Pro sheets before route-switching (`"overlay"` sentinel in dock-sheet-store)
- **#2** `/arena` "Want a warm-up first?" → modal `SoftGateSheet` (was inline banner)
- **#5** piece-complete dismiss + Save&Close now advance to next piece (was: stuck on last exercise)
- **#3** Hub MATE tile hidden until rook mastery (was: visible-but-disabled dead tap)
- **#1** WelcomeOverlay carousel REMOVED entirely; audit at `docs/reviews/ux/2026-05-25-welcome-carousel-audit.md`

### Cluster E — Image asset triplet retro-compliance
- Generated `.avif` + `.webp` for all 3 session assets (account-icon, marco-blue-pro, marco-red-pro)
- Consumers updated to use `<picture>` with avif/webp/png source ordering
- New hard rule in MEMORY.md: every new image in `apps/web/public/art/**` must ship the triplet

## Tests
- Unit: 1945/1945 passing (baseline 1599 at session start → 1969 after Phase 2 → 1943 after WelcomeOverlay removal → 1945 final)
- VR: 13/13 minipay baselines passing, no drift
- Typecheck: clean

## Open / parked items

### Parked specs (future, not scheduled)
- **Soft onboarding for web / non-MiniPay** — `docs/specs/future/2026-05-25-soft-onboarding-web-non-minipay.md`. The real gap the WelcomeOverlay was band-aiding; 4 provider options scoped, Privy leaning. Not implemented.

### Implementation deferrals (during this session)
- **ExerciseDrawer** not covered by the dock close-on-overlay fix — it's a piece-picker dropdown, smaller scope than Account/Pro sheets. Add later if reports come in.
- **Legacy `<ArenaEntryPanel>`** keeps the inline soft-gate; only reachable via `?arena=legacy`. Migrate if telemetry shows the legacy URL is hit.
- **PRO ornament frames** are NOT in current VR coverage. Add a VR fixture if we want regression protection on the marco visuals.

### Known fragility (don't blunder into)
- **/arena PLAY timer** — `setIsPreparing(true)` → 400ms `setTimeout` → `game.startGame()`. Re-arms every render via `[isPreparing, game]` deps. Any neighboring `useEffect` with unstable deps WILL collapse the render gap and break PLAY. Documented in memory: `project_arena_play_timer_fragility.md` + `feedback_hook_ref_stability.md`. Audit new hooks added to `apps/web/src/app/[locale]/arena/page.tsx` for stable refs.

### Stale localStorage (harmless, no migration)
- `chesscito:welcome-dismissed` — orphan flag from removed WelcomeOverlay
- `chesscito:onboarding-signal:*` — orphan cache entries
- No cleanup migration; entries sit and do nothing.

## Memory updated (5 new entries)

| File | Type | What |
|---|---|---|
| `feedback_hook_ref_stability.md` | feedback | Custom hooks MUST memoize returned functions via useCallback (root cause of /arena PLAY regression) |
| `feedback_no_carousels.md` | feedback | Never propose multi-slide carousels; user preference for single-screen affordances |
| `feedback_image_three_formats.md` | feedback | Every new image asset ships `.png` + `.webp` + `.avif` triplet |
| `project_arena_play_timer_fragility.md` | project | The 400ms PLAY timer + how it breaks under render density |
| `project_dock_overlay_sentinel.md` | project | `"overlay"` slug in DockSheetSlug for non-dock sheets |

## What's left from the feedback queue (next sessions)

Wolfcito mentioned ongoing testing. Things to expect from upcoming feedback rounds:

1. **Account onboarding web flow** — when the soft-onboarding spec gets prioritized, the `ConnectPromptToast` + AccountSheet are the natural integration points
2. **Hub UX audit follow-ups** — Daily / Coach tile gating (already consistent now after MATE fix, but may surface more)
3. **PRO ornament frames** — visual iteration possible; geometry currently empirical (scale 0.88 + translate -42% — eyeballed)
4. **VR coverage gaps** — Account chip in 3 states, arena matchup row with PRO frames, soft-gate modal not currently in VR

## What I need from Wolfcito to keep moving

- Continue real-device testing and feedback collection (already doing this)
- When a feedback item is a known limitation (e.g., "marco frame visual is slightly off on small screens"), prefer concrete reproduction (viewport / state) over general impression — keeps fixes targeted

---

Session metrics: 16 commits, –902 lines (mostly from welcome-overlay deletion), +6 new image assets, +5 memory entries, 4 specs/docs created, 13/13 VR + 1945 unit tests green.
