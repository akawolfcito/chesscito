# Session Handoff — 2026-07-08 · MiniPay Delivery Lote 2 + Lote 3

## Completed
- **Season Pass reprice** $1.99 → $0.99 (`0f105eda`, on main).
- **Peones Top-up sheet** z-index fix (renders above Chesito Card modal, not behind) (`1fdf58cb`, on main).
- **Lote 2** (PR #181, merge `82db169f`):
  - B1 — off-chain save ALWAYS FREE: migration `20260708120000_savescore_always_free.sql` (RPC `save_basic_score` no paid branch; `save_game` sink never charges; works at 0 balance). Migration applied manually by founder BEFORE deploy (safe order).
  - B2 — silent auto-save on completion + informative `✓ Score saved`; removed the free-saves-left pill.
  - F1 — removed the green off-chain `submitScore` CTA from ALL surfaces (mission sheet, ContextualActionSlot SAVE pin, PieceCompletePrompt, BadgeEarnedPrompt). Gold on-chain `Save proof` = only save CTA. Neutral `Retry save` fallback stays (mission sheet, only on auto-save failure).
- **Lote 3** (PR #182, merge `f7c8c237`): `MAX_SHIELDS` 30 → 3 — active/display/use cap covering all credit sources (Welcome Pack, Season Pass bonus, rescue Gift-3-free, credited-cache).
- Docs: Lote 2 spec, Lote 2.5 backlog, smoke-findings + LEARN/PLAY backlog, PR #181 review audit.

## Current State
- **Branch**: `main` (== origin/main; all PRs merged, branches deleted).
- **Build**: passing — full suite 4694 tests / 390 files; typecheck + lint clean.
- **Uncommitted work**: none (only pre-existing untracked `docs/handoffs/2026-07-08-permit-preview-activation-and-tx-smoke-map-handoff.md`, not from this session).

## Next Tasks
1. **P1 — LEARN "Save proof" gate regression** (`docs/backlog/2026-07-08-lote2-smoke-findings-learn-play-backlog.md` + memory `project_learn_save_proof_gate_regression`): B2 auto-save shares + closes the `scorePendingNew` gate, so the on-chain proof CTA is near-unreachable. Decouple gate (`isSavedAtParity || scorePendingNew`, or a `has_onchain_proof` flag) BEFORE relying on it in demo/slides. Do NOT reopen Lote 2.
2. **Pending founder smokes**: PLAY win-save permit; LEARN Claim Badge (gas-only) / Save Score on-chain / Get Peones / Shop-Shield.
3. **Lote 2.5** — Tactical Day Gift + Proof of Consistency (`docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`). Not scoped for implementation.
4. **LEARN/PLAY backlog items 1–11** (same smoke-findings doc): incl. PLAY dock 4-slot symmetry (follow-up, needs device + VR baseline), Claim-3-Shields investigation, Coach flow, Save Match celebration.

## Blockers
- None blocking. Deploy note: the Supabase migration is applied MANUALLY (`supabase db push` from `apps/web/`) — already done for Lote 2; future migrations must be applied BEFORE the code deploy.

## Notes
- **Shields hard-cap caveat (accepted)**: `MAX_SHIELDS=3` is an active/display/use cap (`available = min(MAX, credited - consumed)`). `credited` is monotonic + can buffer excess from multiple sources (Welcome + Season = +6 → display 3, excess buffered). Founder accepted; a true server-side hard cap is a separate backlog follow-up (memory Open backlog).
- Prod = founder-only personal/MiniPay snapshot (prelaunch); advance directly, no real-user monitoring framing.
- Backlog added this session: Shields hard-cap model + Social login (both non-priority).
- MEMORY.md compacted 20KB → ~17.2KB (moved P1 detail to topic file, trimmed prose, fixed stale Season Pass price).
