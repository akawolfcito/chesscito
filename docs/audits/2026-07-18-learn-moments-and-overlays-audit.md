# LEARN Moments And Overlays Audit

Date: 2026-07-18  
Primary source: `docs/audits/2026-07-18-21-day-challenge-entitlements-audit.md`  
Scope: LEARN journey, moments, overlays, sheets, banners, toasts, CTAs and conversion opportunities. No implementation changes were made.

## 1. Chronological Journey

1. Visitor opens LEARN.
2. MiniPay wallet may auto-connect; web visitor may stay guest.
3. First-visit splash/briefing can appear on exercises.
4. Hub loads Daily Gift, Challenge card, Start Focus and Training Path.
5. Hub Tour can run once: Daily step, then Challenge step.
6. User opens Daily Gift / Daily Tactic.
7. User solves Daily Tactic and sees celebration overlay.
8. First Focus Day overlay may appear.
9. Welcome Package modal may follow.
10. User taps Start Focus and enters exercises.
11. User completes exercise, earns stars, may trigger milestone queue.
12. User fails exercise, may see Shield rescue.
13. User reaches badge eligibility / mastery / special training milestone.
14. User opens Challenge, taps Join Challenge, hits wallet/payment states.
15. User completes or fails payment and returns to hub/exercises.
16. Later day: Daily Focus either pending or done; streak may continue or reset.
17. Quota limit may show DailyLimitBanner after recognition queue drains.
18. Day 21 has no distinct implemented overlay.

## 2. Moment Table

| Moment | Trigger técnico | Superficie actual | Copy actual / visible | CTA actual | Acción posterior | Persistencia | Repeats | Collision risk | Blocks? | Wallet? | Silent failure? | Conversion opportunity | Fatigue risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| Product discovery on hub | `/` in Lite renders `LearnHubClient` | Hub screen | "Chesscito", Daily gift, Challenge card | Start Focus, Join Challenge | Navigate/open sheet | Mixed local + wallet | Every visit | Low | No | No | No | Strong: visible Challenge above fold | Low | Maintain |
| First visit briefing | `useSplashLoader()` first local key false | `MissionBriefing` modal on exercises | Piece objective copy | Play | Dismisses onboarding | `chesscito:onboarded` | Once per device | Deferred around sheets/labs | Yes | No | Storage failure can repeat | Low | Medium | Maintain, avoid commercial copy |
| Hub mini-tour daily | `useHubTour` launchable and unseen | Spotlight modal | Daily gift / streak copy | Next | Next tour step | `chesscito:hub-tour:v1` | Once per device | Blocks if no aria-modal; launch gated | Yes | No | Storage fail can repeat | Medium | Medium | Maintain |
| Hub mini-tour Challenge | Second step, `target=challenge` | Spotlight around `data-tour-target="challenge"` | "Tap Join Challenge to commit", value row | Got it | Marks tour complete | `chesscito:hub-tour:v1` | Once per device | It points at panel/card wrapper, not Join button specifically | Yes | No | No | Strong, but CTA is not clickable from spotlight | Medium | Retain but evaluate target: CTA if conversion, panel if education |
| Daily Gift visible | `HubDailyTile variant="corner-icon"` | Icon button | Aria "Play today's Daily Tactic" | Tap icon | Opens DailyTacticSheet | Daily progress local | Daily | Low | No | No | No | Good ritual entry | Low | Maintain |
| Daily Tactic open | `setOpen(true)` in `HubDailyTile` | Bottom full-height Sheet | "Daily Tactic", objective | Close, board moves, share | Solve or close | None until solve | Daily | Can coexist avoided by sheet modal | Yes | No | No | Low, keep free | Low | Maintain |
| Daily wrong move | `movesCount >= optimalMoves` and not target | Inline hint after reset | "Hint" + puzzle hint | Continue solving | Board reset | None | Multiple | Low | No | No | No | None | Low | Maintain |
| Daily solved | Reach target in `DailyTacticSheet` | Solved panel + Lite celebration overlay | "WELL DONE", "FOCUS", streak pill | Auto-close; optional share | Records daily completion | `chesscito:daily-progress` | Once/day no-op after done | Share modal can interrupt auto-close intentionally | Briefly | No | localStorage failure means session-only | Habit reinforcement | Low | Convert into celebration is already done |
| First Focus Day | `prev.totalCompleted === 0` after Daily solve | `FirstFocusDayOverlay` modal | First focus achievement copy | Continue | May show Welcome Package | local daily progress | Once per local device | Sequenced after daily sheet close | Yes | No | Storage failure can repeat | Medium | Medium | Maintain, short copy |
| Daily/Welcome Gift auto-show | `welcomePackage.shouldAutoShow` | `WelcomePackageModal` | Gift / 3 Shields copy | Claim, dismiss | personal_sign claim or dismiss | Local + wallet/backend for claim | Max auto-show count 2 | Can follow FirstFocusDay | Yes | Yes for claim | Claim failure has error/retry; no wallet state depends on hook | Good post-reward conversion to wallet | Medium | Keep but cap remains important |
| Start Focus | Hub button click | Inline CTA | "Start Focus" | Start Focus | Routes to `startFocusDestination` | None | Every visit | None | No | No | No | Main engagement path | Low | Maintain |
| Exercise first action | Board move | Board state | Mission prompt | Move piece | Continue puzzle | None until completion | Many | None | No | No | No | None | Low | Maintain |
| Exercise complete / star earned | `handleMove` target reached | PhaseFlash / result in MissionPanel | "Well done" visual, star count | Tap-to-continue | Save/progress/milestones | `chesscito:progress:<piece>` etc. | Every solve/replay | Queue delays overlays | Briefly | No | Auto-save failure has retry state | Strong habit reward | Low | Maintain |
| Training progress consumed | Lite solve calls `recordExtraConsumed` | No direct overlay | None | None | Updates quota | `chesscito:daily-session` | Idempotent per content | N/A | No | No | Storage failure silent | Could explain session end only at limit | Low | Maintain as silent |
| Badge eligible | Milestone queue emits `piece-badge-eligible` | `UnlockOverlay` | Badge/claim copy from milestone system | Primary claim | Calls `handleClaimBadge` | Milestone storage + on-chain if claimed | Pending survives | Carefully gated | Yes | Yes | Wallet failure keeps eligibility pending, error overlay later | Good on-chain conversion | Medium | Maintain |
| Badge claim success | Confirmed chain tx | ResultOverlay badge + piece unlock | "Badge Earned" / owned copy | Dismiss | May unlock next piece | On-chain badge + local state | Once per piece | Gates result vs queue | Yes | Yes | Error handled | Strong | Medium | Maintain |
| Badge claim cancel/fail | `handleClaimBadge` cancelled/failed | Error ResultOverlay for failure, silent pending for cancel | Error copy | Retry / dismiss | Eligibility remains | Milestone pending | Repeat until claimed | Queue release logic complex | Yes | Yes | Cancel path can feel silent | Recovery opportunity | Medium | Add clearer cancellation recovery |
| Piece complete | `showPieceComplete` true after badge/finish | `PieceCompletePrompt` | Mastery/next step copy | Next piece / practice / choose | Navigate/switch | Local | Per piece | Lowest priority; deferred | Yes | No | No | Good continuation | Medium | Maintain |
| Mastery milestone | `resolveMilestones` with badge + labs | `UnlockOverlay` | Mastery copy | Open content / dismiss | Dismiss stamps celebrated | Milestone local | Once | Queue absorbs lower moments | Yes | No/yes if badge included | No | Good retention | Medium | Maintain |
| Labyrinth complete | Labyrinth target reached | `LabyrinthCompleteOverlay` | Stars/new best | Continue/retry/arena | Back to path | local labyrinth best + daily stars | Per lab | Suppressed by queue | Yes | No | No | Good | Medium | Maintain |
| Failure with rescue context | `phase === failure` and streak/shields/WP | `FailRescueModal` | "Almost", Shield/gift/Peones copy | Use Shield / Claim / Retry anyway | Spend shield/claim/reset | Server/local shields + streak | Every failure with context | Blocks board, no backdrop close | Yes | Maybe | Network failure preserves/reset board but little UI detail | Strong shield education | Medium | Maintain, improve failure messages later |
| Failure without rescue context | No streak, no shields, WP not claimed | Auto-reset after dwell | No modal | None | Retry | Attempt state local | Every fail | None | No | No | No | None | Low | Maintain |
| Daily limit reached | Quota at free/hard max and no celebration current | `DailyLimitBanner` | "Great focus today!" / "More tomorrow" | Back to Hub / close | Acknowledge or route | `chesscito:daily-limit-ack:<date>` | Once/day | Gated after celebrations | Yes | No | Storage fail can repeat | Could upsell, but current rules say avoid commercial interruption | Medium | Keep as recovery/stop state |
| Challenge card offer | Season status inactive | Card | "21-Day Mind Challenge", "Focus Passport", "21 days", "+3 Shields", "$0.99" | Join Challenge | Opens SeasonPassSheet | None | Every inactive visit | Tour may spotlight full card | No | No | No | Primary paid CTA | Low | Maintain with copy corrections |
| Join Challenge tap | `onJoinChallenge` | SeasonPassSheet | Offer title/habit/practice/shields/price | Get Pass | pay() or unavailable | None before tx | Every attempt | Modal blocks | Yes | Yes | No provider/wrong chain surfaces as generic unavailable | Highest | Convert unavailable into recovery state |
| No wallet / wrong chain | `rail.available=false` | Inline sheet message | "Connect your wallet on Celo to purchase" | None in sheet | User must use header Connect | None | Every attempt | Dead-end risk | Yes | Yes | Yes if connect no-ops elsewhere | High | Convert to recovery state with Connect/Open MiniPay |
| Insufficient funds | `selection.noPayableToken` | Inline sheet state | "Not enough funds" | Deposit in MiniPay only in MiniPay | Deep link add_cash | None | Until funded | Low | Yes | Yes | Web has no equivalent action | High | Keep MiniPay, add web guidance |
| Payment in progress | Rail phases | Disabled sheet / button label | Confirm in wallet / Sending / Verifying | Disabled | Wait | txHash in React state only | Per attempt | Backdrop close disabled | Yes | Yes | Reload loses state | Critical | Add pending intent |
| Payment cancelled | `user_rejected` | Error text in sheet | mapped cancellation copy | Get Pass again | Retry | None | Repeat | Low | Yes | Yes | No persisted intent | Medium | Keep, add explicit "No charge" |
| Payment verified | `rail.phase=success` | `SeasonPassCelebration` | "You are in", "21 days", "+N Shields" | Start Focus | Close/route exercises | Backend pass + shields | Once per payment | Sheet intentionally remains | Yes | Yes | No | Strong | Low | Maintain |
| Return another day | local daily date differs | Hub Daily pending, Focus Passport gray next slot | Daily/tour copy if tour unseen | Daily Gift / Start Focus | Daily solve | local | Daily | Low | No | No | Good habit | Low | Maintain |
| Missed day | previous daily not yesterday | No explicit recovery overlay | Streak resets on next solve only | None | Solve records streak=1 | local | Per miss | Silent | No | No | Yes, user may not know why | Medium | Add inline recovery copy, not modal |
| Shield use | Failure modal primary | Modal | "Use Shield" | Use Shield | `/api/shields/spend` | Redis credited + local consumed | Until shields depleted | Blocks | Yes | Yes if server spend | Partial: network branch resets silently | Conversion to Shield value | Medium | Add success/failure microcopy |
| Day 21 | `challengeDayFromExpiry` clamps display | Active card Day 21/21 | Day stat | None | Eventually expires | Backend TTL | One day | None | No | No | Completion silent | High | Add completion/renewal after product decision |

## 3. Current Coverage Assessment

Correctly covered:

- Daily Gift opening and solving has a clear sheet and celebration.
- First Focus Day and Welcome Package are sequenced after the daily solve.
- Milestone queue enforces a one-dialog rule and defers lower-priority prompts.
- Failure rescue is contextual and does not interrupt first-time users without rescue context.
- Season Pass payment has explicit progress phases and success celebration.

Duplicated / overlapping:

- Daily Tactic exists in both `DailyTacticSlot` and `HubDailyTile` with similar state machines (`daily-tactic-slot.tsx:64-299`; `hub-daily-tile.tsx:74-374`).
- Welcome Package can auto-show from Hub and also after First Focus Day (`hub-daily-tile.tsx:124-133`, `311-345`).
- Badge moments have legacy prompts plus milestone overlays, though gates prevent simultaneous display (`exercises-screen.tsx:3639-3652`, `3780-3790`).

Silent or underexplained:

- Web without injected wallet: Connect can no-op (`use-connect-wallet.ts:24-31`).
- Missed day: streak resets with no moment or explanation (`daily/progress.ts:70-78`).
- Season Pass expiry: inactive state returns without an expired explanation (`season-pass/status/route.ts:90-118`).
- Day 21 completion: no moment.
- Payment reload after broadcast: no recovery state.

## 4. Spotlight Finding

The Hub Tour challenge step targets `data-tour-target="challenge"` on `.hub-lite-challenge-anchor`, which wraps the full Challenge card (`hub-lite-scaffold.tsx:237-247`). The presenter measures that target and draws the spotlight around the target rectangle (`hub-tour.tsx:43-52`, `194-206`). It therefore points to the panel/card, not the Join Challenge button itself.

Recommendation: keep panel target if the goal is comprehension of the Challenge object; switch to the CTA only if the goal is direct conversion. Current copy says "Tap Join Challenge to commit" while the ring points to the whole card, so this is a mild conversion mismatch.

## 5. Payment Moment Risks

- The checkout sheet explains price and token, but unavailable state has no CTA.
- Busy state disables backdrop close, which protects transaction state, but the tx hash is only component state.
- Error state is inline text; cancellation is recoverable but not clearly separated from failure.
- Success state is strong and uses verified `shieldsCredited`, so it avoids promising +3 when Shield credit is pending.

## 6. Recommendations

P0:

- Convert Season Pass unavailable state into a recovery state: Connect wallet, Open in MiniPay, or explain unsupported browser.
- Add pending transaction intent before `writeContractAsync` and resume verification after reload.
- Replace "Unlimited challenge practice" copy before it appears in the checkout.

P1:

- Add a small expired pass state on Challenge card/sheet.
- Add a non-modal missed-day explanation when the next Daily Focus resets streak.
- Add `season_pass_*` funnel events for sheet open, unavailable view, pay click, cancelled, verify success/failure.
- Decide whether Hub Tour challenge spotlight should target the Join CTA or full card.

P2:

- Consolidate duplicate Daily Tactic containers to reduce drift.
- Add Day 21 completion only after the entitlement model defines completion.
- Consider inline post-payment "what changed" summary in account/pass status.

## 7. Files Inspected

- `docs/audits/2026-07-18-21-day-challenge-entitlements-audit.md`
- `apps/web/src/components/hub/learn-hub-client.tsx`
- `apps/web/src/components/hub/hub-lite-scaffold.tsx`
- `apps/web/src/components/hub/challenge-card.tsx`
- `apps/web/src/components/hub/hub-tour.tsx`
- `apps/web/src/lib/hub/hub-tour.ts`
- `apps/web/src/components/daily/hub-daily-tile.tsx`
- `apps/web/src/components/daily/daily-tactic-slot.tsx`
- `apps/web/src/components/daily/daily-tactic-sheet.tsx`
- `apps/web/src/components/welcome-package/first-focus-day-overlay.tsx`
- `apps/web/src/components/welcome-package/welcome-package-modal.tsx`
- `apps/web/src/lib/welcome-package/use-welcome-package.ts`
- `apps/web/src/components/exercises/exercises-screen.tsx`
- `apps/web/src/components/exercises/fail-rescue-modal.tsx`
- `apps/web/src/components/daily/daily-limit-banner.tsx`
- `apps/web/src/components/payments/season-pass-sheet.tsx`
- `apps/web/src/components/payments/season-pass-celebration.tsx`
- `apps/web/src/lib/season-pass/use-season-pass-rail.ts`
- `apps/web/src/lib/daily/progress.ts`
- `apps/web/src/lib/daily/session-quota.ts`
- `apps/web/src/lib/content/editorial.ts`

## 8. Evidence Index

- Hub Challenge anchor and Start Focus: `hub-lite-scaffold.tsx:237-264`.
- Join Challenge handler: `learn-hub-client.tsx:428-434`.
- Hub Tour launch, targeting and copy: `learn-hub-client.tsx:372-403`; `hub-tour.ts:48-72`, `94-100`; `hub-tour.tsx:43-52`, `186-315`.
- Daily solve and overlays: `hub-daily-tile.tsx:150-248`, `311-371`; `daily-tactic-sheet.tsx:181-363`.
- Welcome Package modal states: `welcome-package-modal.tsx:37-190`.
- First Focus Day overlay: `first-focus-day-overlay.tsx:11-53`.
- Exercise completion and quota consumption: `exercises-screen.tsx:1535-1624`.
- Milestone queue: `exercises-screen.tsx:1445-1527`, `1941-2035`, `3743-3758`.
- Failure rescue: `exercises-screen.tsx:3262-3277`; `fail-rescue-modal.tsx:84-143`, `165-330`.
- Daily limit banner: `exercises-screen.tsx:3196-3205`; `daily-limit-banner.tsx:38-169`.
- Payment sheet states: `season-pass-sheet.tsx:135-293`.
- Payment phases and errors: `use-season-pass-rail.ts:29-49`, `162-217`.
- Copy source: `editorial.ts:3410-3450`, `3470-3503`.
