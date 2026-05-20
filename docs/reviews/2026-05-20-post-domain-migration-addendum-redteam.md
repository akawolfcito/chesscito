---
target: _bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md
reviewer: cynical-adversarial
date: 2026-05-20
verdict: ship-with-revisions
severity_distribution:
  critical: 4
  high: 8
  medium: 12
  low: 6
total_findings: 30
---

# Adversarial Review — Post Domain-Migration UX Addendum

The addendum is internally coherent and the decisions ladder cleanly, but it carries a familiar Sally pattern: warm prose around several **unverified assertions** and **implementation gaps** that look harmless on paper and bite at PR time. Findings ordered by severity. Each entry calls out the specific section/line of the addendum, what the spec asserts, and why the assertion is suspect.

---

## CRITICAL — block before any commit

### C-1. Race between fire-and-forget game-persistence and immediate analyze tap
**Section:** §2.4.1 + §2.4.5 (case α).
**Claim:** "Persistence POST is fire-and-forget (no await on the user-visible path)" and "If user requests analysis from Victory screen immediately, the existing flow re-POSTs to `/api/games` (defensive — idempotent on `gameId`)".
**Why suspect:** The two statements together describe a guaranteed race. The original `/api/games` POST fires un-awaited. The user taps `Get Coach Analysis` in 1–2 seconds. The Analyze route requires the game record to exist server-side (it reads it from Redis/Supabase). If the persistence POST hasn't resolved yet, Analyze 404s. The "defensive re-POST" mitigates BUT introduces a second concurrent write race against the in-flight first POST — both targeting the same `gameId`. Idempotency on upsert handles outcome correctness but does not eliminate latency-induced 404 on the read path inside `/api/coach/analyze:32–55`. **Spec must either (a) keep the first POST awaited at game-end, or (b) make Analyze tolerate a missing game record by re-posting itself first.** Today it does neither cleanly.

### C-2. Onboarding signal cannot resolve in <800ms on cold MiniPay-Vercel cold start
**Section:** §2.1.1, latency budget table + fallback rule 2.
**Claim:** "PRO active ~150ms p95" + "Has any badge ~200ms p95" + 800ms total budget. Failure mode "treat as fresh".
**Why suspect:** Both numbers are asserted without source. MiniPay WebView in LATAM hitting a US-East serverless function with a Redis read on cold start regularly exceeds 800ms wall-clock; field telemetry from the sibling addendum's `coach_panel_ready` already shows p95 ~1100ms for similar shape. **Consequence:** the *most common* MiniPay-LATAM session for a returning user will fall through to `fresh` and re-show the carousel they already dismissed. The spec calls this "acceptable degradation" — it isn't, because §1 of this very document opens with "Wolfcito saw the new-domain fresh state and got annoyed". Re-creating that exact annoyance via a 800ms timeout will produce the same complaint two weeks from now.

### C-3. Founder Badge inclusion in `balanceOf(Badges)` is an unverified assertion
**Section:** §2.1.4 case η + §2.1.1 signal logic.
**Claim:** "Wallet has Founder Badge purchase but no piece badge — `balanceOf` includes Founder Badge — still treated as returning."
**Why suspect:** The Founder Badge is purchased via `ShopUpgradeable.buyItem(itemId=1n)` per memory. Whether `ShopUpgradeable` mints into the `Badges` ERC-721 contract or into a separate item registry is not stated in the spec, not verified by grep against `apps/contracts/contracts/`, and not exercised by an existing unit test. **If Founder Badge does NOT increment `Badges.balanceOf()`, then a wallet that has spent money on Founder Badge but no piece badges and no PRO and no shields will be classified as fresh** — re-skinned carousel and all. Verify before committing to the signal.

### C-4. Accessibility is entirely absent from the addendum
**Section:** ENTIRE DOCUMENT.
**Claim:** None — accessibility is never named.
**Why suspect:** Four new surfaces ship with this addendum (WelcomeCarousel, TxProgressSteps pills/toast, SAVE state machine, history Analyze chip + Victory Coach CTA). None have screen-reader labels, focus management, `aria-live` regions for tx progress transitions, motion-reduce preference handling, or keyboard nav specs. The parent spec at §canon mentions "anti-elitism" but a11y is not a canon enforcer; it has to live per-component. Shipping four new components with zero a11y intent is a regression against the existing surfaces (CandyGlassShell, PrincipalButton) which DO have ARIA. The smoke test for an accessibility-affected user reduces to "they can't use the new flows" — that is a critical, not low-priority gap.

---

## HIGH — block before merge

### H-1. `Saved` passive state cannot render "time ago" after cache clear
**Section:** §2.2.1 (Saved state) + §2.2.4 edge case γ.
**Claim:** Saved sub-line shows "{N} stars on chain · {time} ago". Reconcile-on-mount handles cache wipe.
**Why suspect:** `lastSavedAt` lives in localStorage. Cache clear removes it. Reconcile sets `lastSavedScore = onChainScore` but the spec is silent about `lastSavedAt`. Either it's set to "now" (lies — looks like a save just happened) or to `null` (sub-line breaks). **Spec must define the timestamp behavior under cache miss.**

### H-2. SAVE button flicker on receipt success while ★ already earned
**Section:** §2.2.5 + §2.2.1 (case α).
**Claim:** "Earning a new star while in Saved transitions to Save immediately."
**Why suspect:** During in-flight tx (`Saving`), the user earns another ★ → localScore advances. On receipt success the state transition is Saving → Saved → Save in one render cycle. Sub-line copy flickers: "Saving 5 stars…" → "Saved · 5 on chain · just now" → "1 new star to save". This is mathematically correct and visually janky. Spec must either freeze the sub-line at "Saved" for an animation-debounce window (≥250ms) or refuse to advance localScore during in-flight (rejected — penalizes the player).

### H-3. Trim-on-mount vs surface-controlled trim in TxProgressSteps is ambiguous
**Section:** §2.3.1 (compound-step rule) + §2.3.4 (API contract).
**Claim:** "Primitive trims pre-completed phases on mount" (§2.3.1) but the API contract (§2.3.4) declares primitive as stateless and steps come from surface.
**Why suspect:** Direct contradiction. A stateless primitive cannot decide to trim — that's surface logic. The compound-step trim for Shop (skip approve when allowance satisfied) MUST be a surface-level pre-filter on `steps[]` before passing to the primitive. Spec needs one sentence ratifying which side owns it; today implementer guesses.

### H-4. `prepare` step "only mounts if active >500ms" has no implementation pathway
**Section:** §2.3.1 + §2.3.7 telemetry rationale.
**Claim:** Optional step renders only when slow.
**Why suspect:** The primitive sees only `current` prop. It does not know future durations. The 500ms threshold can only be enforced by the surface delaying the `setCurrent("prepare")` call by 500ms — i.e., a `setTimeout(500)` race against the `/api/sign-*` promise. The spec describes the outcome ("hidden when fast") but not the mechanism. Implementer will either (a) always render prepare (wasted), (b) never render prepare (misses degraded mode), or (c) build the race themselves and get it subtly wrong.

### H-5. TxProgressSteps `toast` variant z-index conflicts with mounted sheets
**Section:** §2.3.3.
**Claim:** "Mounts above the inline CTA, pushing nothing — uses fixed positioning at the chrome ledge level."
**Why suspect:** A fixed-position element with no declared z-index will collide with the Radix Dialog scrim (`z-50`+) of any sheet that might be open. Worst case scenario: PRO sheet open, user taps Save in background somehow, toast renders behind the scrim and is invisible while consuming the user's tx state. The spec does not declare `--z-tx-toast` or specify stacking context. Implementer will pick z-index by feel.

### H-6. Cluster B and Cluster C cannot ship before SAVE button gets fee-currency parity
**Section:** §6.1 commits #8–#9 + parent context.
**Claim:** SAVE button adopts TxProgressSteps toast variant in commit #9.
**Why suspect:** The SAVE tx today calls `submitScoreSigned` via `writeWithOptionalFeeCurrency`. The current implementation may or may not work correctly when the `feeCurrency` prop is passed to wagmi's `writeContract` (wagmi has no native Celo `feeCurrency` support — it's extended via prop and the wallet may ignore it). If feeCurrency fails through silently, the toast renders "Sending…" forever. **The spec assumes the existing wagmi-level fee-currency plumbing works**; in fact this exact bug surfaced in §1.1 (the unrelated origin issue masked it). Verify SAVE tx end-to-end works in MiniPay BEFORE wiring toast variant on top, or the new UI looks broken for a reason that has nothing to do with the new UI.

### H-7. Coach analyze rate limit will be hit faster after re-entry surfaces ship
**Section:** §2.4.4 + §5.7 E2E coverage.
**Claim:** "Same paywall, same credits ledger. No discount for re-entry."
**Why suspect:** `/api/coach/analyze` enforces `enforceRateLimit` (5/min/IP, 3/min/address). Today Coach is only reachable post-checkmate — at most 1 analyze per match. Post-shipment, a user can tap Analyze on multiple history entries in succession. The 3/min/address limit hits at the 4th tap. Existing rate-limit error copy may surface as "Slow down" but the spec doesn't update it to reflect the new entry behavior. **Should the rate limit be relaxed for the history surface, or should the UI explicitly disable subsequent Analyze taps within the rate-limit window?** Neither is specified.

### H-8. Game persistence schema and FK assumptions are not verified
**Section:** §2.4.7 cap rule + §2.4.3 query for unanalyzed games.
**Claim:** "A game record cannot be evicted if it has an associated analysis row (the analysis row's `game_id` FK would dangle)."
**Why suspect:** This asserts a foreign-key constraint exists between the analysis table and the games table. Memory `project_supabase_cache` mentions a `verified_games` table; the addendum invents a separate `games` table referenced by `/api/games`. Whether (a) the table exists, (b) the FK exists, (c) the analysis table is the same `coach_analyses` referenced in `persistence.ts` is all unverified. A schema migration may be required before any of §2.4 ships. **Spec needs a §0 prerequisite check on actual Supabase schema before §6 commits land.**

---

## MEDIUM — must address before §7 done checklist

### M-1. Lazy delegation to "Wolfcito's call" without explicit user confirmation
**Section:** §4.1.
**Claim:** "Tradeoff accepted — Wolfcito's call."
**Why suspect:** The chat transcript shows Wolfcito said he can contact MiniPay; he did NOT explicitly accept "ship before MiniPay's fix lands". Spec interpolated consent. Either re-confirm with Wolfcito or rewrite the spec to gate the copy purge on MiniPay's fix shipping first.

### M-2. Cluster D incorrectly sequenced after Cluster B/C
**Section:** §6.3 rationale.
**Claim:** "Cluster D is independent — sequenced after to validate primitives."
**Why suspect:** Onboarding doesn't use TxProgressSteps. The sequencing has no technical basis; if anything, Cluster D should ship first because it gates Wolfcito's first-impression complaint (item #1). The spec acknowledges D is independent but then artificially holds it back. Re-order, or justify with a non-fabricated reason.

### M-3. Effort estimate is optimistic
**Section:** §6.2.
**Claim:** "Total: ~4.5 days of focused work."
**Why suspect:** 22 commits in 4.5 days = ~5 commits/day with full unit test passing each. Historical Chesscito velocity per memory `project_spec1_hub_redesign` (PR #112: 30 plan tasks across multiple weeks) suggests 2–3 commits/day realistic, especially with red-team gates between clusters. Estimate is 2–3× optimistic. **Either acknowledge the range (4.5–10 days) or split the addendum into two release windows.**

### M-4. No rollback plan
**Section:** ENTIRE DOCUMENT.
**Claim:** None — rollback never discussed.
**Why suspect:** Cluster D (commits #11–#13) modifies first-paint logic. If `useOnboardingSignal` mis-classifies returning users as fresh (e.g., RPC outage), every existing user gets an unwanted carousel. Cluster E (commits #15–#19) writes new tables. Rollback requires either a feature flag or a DB rollback path. Neither is mentioned. Add a §6.5 rollback section.

### M-5. Telemetry contract drift between §2.3 and §5.9
**Section:** §2.3.7 + §5.9.
**Claim:** §2.3.7 declares `tx_progress_step_duration{flow,step,duration_ms}`. §5.9 omits it from the consolidated table.
**Why suspect:** Cross-section inconsistency. Reconcile — either add to §5.9 or remove from §2.3.7.

### M-6. Optimistic UI during SAVE in-flight not specified
**Section:** §2.2.
**Claim:** Saved chip shows on-chain stars; in-flight `Saving` state shows spinner.
**Why suspect:** What does the rest of the chrome show while in-flight? The total-stars chip in `mission-panel-candy`? The local 5★ or the un-saved on-chain 4★? Spec doesn't say. Without spec, implementer will pick localScore and create a discrepancy when the user looks at the leaderboard immediately after (which shows on-chain value).

### M-7. The "fresh state should detect progress" canon is fabricated
**Section:** §2.1.4 case η + multiple §2 closings.
**Claim:** "Honors the canon 'fresh state should detect progress and skip itself'."
**Why suspect:** This phrasing appears nowhere in the parent spec. It is invented in this addendum and then cited as if it were a parent-spec lock. Either quote the actual parent passage or stop attributing.

### M-8. `viewOnCeloscan` sweep does not enumerate non-app surfaces
**Section:** §4.2 + §5.6.
**Claim:** "Sweep `grep -rn viewOnCeloscan apps/web/src/`."
**Why suspect:** The grep scope is limited to `apps/web/src/`. The string may appear in `docs/`, in snapshot fixtures, in CHANGELOG-style files, in E2E tests, in Remotion video copy. Spec says "all call sites" but defines call sites narrowly. Sweep should be project-wide with a documented exclusion list, not src-only.

### M-9. The 200-row FIFO cap interacts poorly with cross-device users
**Section:** §2.4.7.
**Claim:** "Eviction triggers on each game-persist POST, fail-soft."
**Why suspect:** A user who plays on phone and desktop (Wolfcito explicitly does this — mainnet env vars setup allows local mainnet tests) will rotate through games on both devices. The 200-cap evicts oldest, but each device's "oldest" may not match — concurrent writes race. Outcome: a game played 6 months ago that the user really wants to re-analyze gets evicted silently because they played 200 fast games yesterday. No warning, no audit trail. At minimum, telemetry `game_evicted{age_days}` should exist to monitor for abuse / surprise.

### M-10. Visual snapshots VR-1..VR-8 do not budget diff sensitivity
**Section:** §5.8.
**Claim:** 8 snapshots produced.
**Why suspect:** Visual regression baselines in Chesscito's existing Playwright suite have historically been brittle (per `project_test_infra` memory and the persistent "baseline screenshots deferred per single-user dev period agreement" pattern). The spec adds 8 more baselines without setting a tolerance (per-pixel, per-percent, per-region). Without tolerance budget, every minor CSS change will fail the suite.

### M-11. Single-OS smoke test in §7 Done Definition
**Section:** §7 bullet 5.
**Claim:** "Smoke pass on real MiniPay device (Wolfcito's iPhone)."
**Why suspect:** MiniPay ships on Android too. The WebView implementation differs (iOS WKWebView vs Android Chrome-based WebView). The §1.1 origin bug initially surfaced on iOS only because that's the only device tested. Same risk repeats here. Add Android smoke as a separate bullet, or explicitly accept iOS-only as a known coverage gap.

### M-12. No bundle-size budget per cluster
**Section:** §6 + §7.
**Claim:** None.
**Why suspect:** Memory mentions a 178 KB asset cap from parent spec. New components: WelcomeCarousel (≥3 slides with candy assets), TxProgressSteps (two variants + state machine), reconcile hook, history Analyze CTA wiring. None get a budget. Parent spec's 178 KB cap could be busted silently. Add per-cluster JS bundle delta target.

---

## LOW — nice-to-have polish

### L-1. The "no FOMO" canon is mentioned but never operationalized
**Section:** §1.5 + §3.
**Claim:** "No FOMO, no urgency, no medical claims."
**Why suspect:** None of the new copy keys are scanned against this canon by any test. The constraint is decorative.

### L-2. "Slide transitions use `--duration-enter` (300ms) ease-spring" without baseline
**Section:** §2.1.3.
**Claim:** Specific motion token used.
**Why suspect:** `--duration-enter` is 300ms per memory; ease-spring is a separate token. Confirm both tokens exist today (per memory yes) and the carousel actually consumes them via CSS variables, not hardcoded values.

### L-3. Emojis sneak into draft section labels
**Section:** §1.2 + various.
**Claim:** None — emojis appear in tables (e.g., "🏆 Match", "⏳ Step 2").
**Why suspect:** Per CLAUDE.md "Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked." The wireframe sketches use them illustratively, which may be acceptable as ASCII art, but a stricter read says strip them or replace with `<CandyIcon>` references.

### L-4. The "step counter `Step N of M`" interpolation is template-literal style
**Section:** §2.3.6 copy keys.
**Claim:** `stepCounter: (current: number, total: number) => \`Step ${current} of ${total}\``.
**Why suspect:** `editorial.ts` precedent (per `viewOnCeloscan` etc.) is mostly static strings, not function literals. Function literals in editorial don't translate well if i18n ever lands. Prefer i18n-template form `"Step {current} of {total}"` with a helper.

### L-5. The handoff doc filename pattern uses `2026-05-2X`
**Section:** §7 last bullet.
**Claim:** "`docs/release/2026-05-2X-post-domain-migration-addendum-handoff.md`".
**Why suspect:** Placeholder character `X` left in pathname. Sloppy.

### L-6. Memory entry already exists; commit #22's checklist asks for it again
**Section:** §7 + actual MEMORY.md state.
**Claim:** "Memory updated: project_post_domain_migration_addendum.md created."
**Why suspect:** The MEMORY.md was updated DURING the design session (not a separate file). Spec checklist will read as incomplete forever unless reworded to "memory entry confirmed in MEMORY.md".

---

## Cross-cutting themes (meta-findings)

1. **The addendum confuses unverified assertions with verified facts.** Founder Badge in `balanceOf`, the FK between game and analysis tables, the 800ms latency budget — all are stated as if checked, none actually were during the design session. Verification belongs in §0 prerequisites before §1 problem framing.
2. **Sally writes well but skips defensive enumeration.** Race conditions are described conversationally (case α, case β) but not modeled with sequence diagrams or state machines. The single-frame flicker in H-2 and the persistence race in C-1 are both findable in 30 seconds of careful sequencing — they slipped because prose hides timing.
3. **The "Wolfcito's call" delegation reappears in 3 places.** Each time, it papers over a UX decision the spec should make explicit. Refactor each occurrence into either a documented confirmation in chat or a binding decision.
4. **Two clusters touch first-paint without a feature flag.** Cluster D (Onboarding) and Cluster E (game persistence) both change behavior on every wallet's session. The addendum has no flag strategy. Add at least `NEXT_PUBLIC_ENABLE_ONBOARDING_HYBRID` and `NEXT_PUBLIC_ENABLE_COACH_REENTRY` as kill-switches.

---

**Bottom line:** the spec is shippable but not ready. Resolve the 4 critical findings (race condition, latency budget, Founder Badge verification, accessibility) before any commit. Resolve the 8 high findings before merge. Mediums are PR-review fodder, lows are polish.

The strong work in §2 decision-laddering and §5 acceptance criteria deserves the rigor of one more pass.
