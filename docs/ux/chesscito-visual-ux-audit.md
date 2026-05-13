# Chesscito Visual UX Audit and Refactor Plan

Date: 2026-05-12  
Scope: visual UX, surface hierarchy, navigation patterns, monetization presentation, and screen-by-screen refactor sequencing.  
Non-scope: payment logic, contracts, backend, Coach analysis, Arena engine, Practice logic, telemetry behavior, and implementation changes.

## 1. Executive Summary

Chesscito already has strong premium-game ingredients: scene-rooted assets, Adventure and Scholarly atmospheres, board-first gameplay, a persistent mobile dock, and newer primitives such as `KingdomAnchor`, `PrimaryPlayCta`, `HudResourceChip`, `PrincipalButton`, `TreasureTile`, and `CandyGlassShell`.

The current inconsistency is not caused by one bad screen. It comes from mixed surface decisions and mixed control languages:

- The newest Hub and Arena surfaces feel closer to a native mobile game.
- Some destination sheets still read as web modals wearing a game skin.
- Navigation mixes asset back buttons, plain text arrows, X close buttons, circular buttons, and CSS-only controls.
- CTAs alternate between 3D image-led buttons, CSS `Button` variants, raw buttons, and principal scene-rooted buttons.
- PRO and Coach are visible, but a few surfaces still sell through text blocks instead of demonstrating training value through play moments.

The right move is not a broad redesign. Refactor one screen or one narrow system rule per PR. Preserve current behavior. Keep the 390px MiniPay viewport as the acceptance target. Treat desktop as non-goal unless a change breaks mobile.

Product north star: **premium mobile training game**. Every screen should have one dominant purpose, one dominant action, visual-first hierarchy, minimal copy, stable navigation, and PRO positioned as training value rather than advertising.

## 2. Screen-by-Screen Audit

| Surface | Current purpose | Visual quality | Current problems | Recommended direction | Surface type | Primary CTA | Secondary CTA | Navigation pattern | Monetization relevance | Risk | PR priority |
|---|---|---:|---|---|---|---|---|---|---|---:|---:|
| Hub/Home | Main game home: enter Arena, inspect rewards, open PRO/Coach/shop/badges. | Strong | Richest screen, but still busy: top HUD has trophies, PRO, Coach, wallet, secondary chips, Coach card, mastery column, premium slot, mission ribbon, practice CTA, play CTA. Multiple commercial/training signals compete. | Keep as the premium anchor. Make Arena the dominant center CTA. Convert PRO/Coach from visible sales blocks into compact training state/value slots. Keep reward tiles as progress, not navigation clutter. | Full screen | `ENTER ARENA` | `Practice Pieces` if needed | No back. Dock/destination sheets for secondary areas. | High. PRO value can appear here, but never as an ad banner. Active PRO should show sessions/history/value, not "Go PRO". | Medium | P1 |
| Chesscito PRO sheet | Explain and transact PRO; active users can manage/access value. | Acceptable | Bottom sheet has improved active state, but still text-heavy: price, active perks, roadmap, mission note, active actions, error states. Free and active states share too much structure. | Split visual hierarchy by state. Free: one hero value, price, one CTA, 2-3 icon perks max. Active: "Training Pass active" with journal/action value first; renewal secondary and quiet. Roadmap should be demoted or removed from the main purchase path. | Destination sheet when opened from Hub/Shop; quick sheet only if triggered contextually during play. | Free: `Unlock PRO`; Active: `Open Training Journal` or `Play in Arena` by source | Free: none or `Not now`; Active: `Extend` only when near expiry | X close for dismissible sheet. No route back arrow. | Highest. Must demonstrate training value; active users must not be resold as if inactive. | High | P1 |
| Training Journal | Review Coach analysis history and training progress. | Weak to acceptable | Full page uses plain arrow, generic layout, text-first list. It feels more like an account page than a game-native journal. Selected analysis uses `CandyGlassShell`, but entry list lacks strong visual hierarchy. | Make it a proper Training Journal destination: compact session cards with result/difficulty/move count as visual chips, strongest takeaway as one line, progress summary as a top trophy/training strip. Avoid long prose on list screen. | Full screen if routed from active PRO; possible Destination sheet from Hub later. | `Review latest game` when entries exist; `Enter Arena` when empty | `Manage history` or delete panel as low-emphasis utility | Back arrow to Hub using canonical asset back button, not plain `←`. | High for active PRO value. No upsell when active; for free/no wallet show locked value briefly and route to PRO. | Medium | P2 |
| Arena setup | Choose color/difficulty and start match. | Strong | Uses newer Adventure layout and `PrimaryPlayCta`. Still has several decision blocks: back, prize pool, color toggle, difficulty list, soft gate, Coach signal, mission ribbon. | Preserve full-screen setup. Reduce to one decision flow: title/back, optional prize pill, color toggle, difficulty cards, one start CTA. Coach should be a compact post-game value hint, not a pre-match sales panel. | Full screen | `Start Match` | Warm-up/learn path only if soft gate active | Back asset button to Hub. No X. | Medium. Coach/PRO can be hinted as "Review unlocks after match"; no banner. | Medium | P2 |
| Arena gameplay | Play chess match against bot. | Strong | Board and pieces are strong. HUD/action controls use game assets, but back/resign confirmation expands into CSS pills while other controls are image-led. Optional Coach hint text can add noise mid-match. | Keep immersive gameplay. Standardize HUD controls: timer and matchup stay top; resign/undo stay bottom action rail; no monetization in board zone. Coach value should appear after outcome, not during move focus except as a tiny noninteractive hint if proven useful. | Full screen, immersive; dock hidden exception is valid. | Board move itself; no global primary CTA | `Undo`, `Resign` as action controls | Back requires confirmation during active match; use same visual treatment as resign confirm. | Low during play. Do not sell here. | High because gameplay focus can regress | P3 |
| Arena endgame/result modal | Celebrate win/loss, claim victory, share, ask Coach, replay. | Strong but crowded | Victory states have strong reward visuals, but CTAs can stack: claim, play again, Coach, share, back. Loss state also stacks coach preview, play again, Coach. Multiple buttons compete after the emotional moment. | Keep as System Modal/reward ceremony. One primary based on result and claim phase. Coach should be a demonstrated post-game insight preview, not a parallel CTA pile. Share/back become secondary/tertiary text or icon actions. | System modal | Win before claim: `Save Victory`; win after claim/loss: `Play Again` or `Ask Coach` depending product decision | `Ask Coach`, `Share`, `Back to Hub` demoted | X/close maps to Back to Hub; no route back arrow. | High. Best Coach moment. Demonstrate value with one tactical insight snippet. | High | P2 |
| Practice Pieces / Exercises | Teach individual piece movement and star progression. | Strong | Board-first layout is good. Top tray has piece, mission details, exercise drawer, optional labyrinth tabs, shields. Multiple quick sheets exist, but they mostly fit Type C. Some inline text and tab labels still feel dense. | Keep as training game screen. Tighten top tray into one canonical Z2 pattern: piece selector, target/mode, progress. Keep board visually dominant. Make contextual action row the single home for submit/hint/retry-like actions. | Full screen with Type C quick pickers | Current contextual action (`Submit`, `Hint`, etc.) | One secondary max | Back via Z1/Z2 if route-deep; dock for destinations. | Medium. Shields can be utility state; PRO should not interrupt training. | Medium | P3 |
| Labyrinths | Advanced movement puzzles inside Practice layer. | Acceptable | Available as a mode toggle and completion overlay. Completion is visual-first, but copy includes hardcoded lines and mixed button styles. Mode toggle can compete with exercise controls. | Treat as a sub-mode of Practice until content grows. Use segmented control in the canonical header zone. Completion stays System Modal with stars/moves first, retry as primary. | Inline mode plus System Modal on completion | `Retry` on completion; gameplay action during puzzle | `Back to Exercises` | No X for completion if it means return; use close/back consistently as "Back to Exercises". | Low. No PRO selling; future PRO labyrinths should be value-marked, not bannered. | Low | P4 |
| Badges | Show badge progress and claim on-chain badges. | Acceptable | Destination sheet is structurally correct. Cards have progress and claim states, but sheet still uses list/card web density. `View Trophies` global CTA may compete with per-card claim actions. | Make it feel like a collection screen: stronger badge art, clearer locked/claimable/owned states, less explanatory text. Keep claim per-card. Move "View Trophies" to secondary text/icon if badges are primary. | Destination sheet | Per-card `Claim` when claimable | `View Trophy Case` | X close; dock remains visible. | Medium. Badges support prestige and retention. Not a PRO surface. | Low | P4 |
| Shop | Buy shields/founder items/other catalog items. | Acceptable | Correct full-height destination sheet, but catalog still feels like commerce cards. Featured badge, availability rows, CELO secondary route, more-soon banner, and success tx hash add text density. | Make shop visual-first: item art, price chip, one buy button. Keep tx/success state concise. Avoid roadmap "more soon" occupying prime space unless catalog is empty. | Destination sheet | Per-item `Buy` | Alternate token route as small payment chip only when necessary | X close; dock remains visible. | High for direct revenue. Must not mix PRO banners into item grid until a PRO subsection exists. | High because payment UI | P3 |
| Trophy Case | Personal victories, achievements, Hall of Fame. | Acceptable | Shared body works, but route/sheet split can feel inconsistent. Sections are useful but can be dense, especially roadmap footer. Empty states use generic cards and CSS buttons. | Position as prestige collection. If opened from dock, destination sheet is enough. If routed, full page should use same header/nav and collection hierarchy. Reduce roadmap visibility; make trophy/victory art lead. | Destination sheet from dock; full page only for deep link/share. | Empty: `Enter Arena`; Existing: per-trophy `View/Share` if available | Connect wallet or Hall of Fame browse | Sheet uses X; route uses canonical back asset. | Medium. Reinforces prestige and mint value. Not a sales surface. | Medium | P4 |
| Leaderboard | Show ranked/global scores. | Acceptable | Full-height sheet is correct. Passport banner and external link sit above ranking and feel like a web notice. Medal emoji rows clash with 3D icon language. | Make ranking the hero. Use game medal/crown assets instead of emoji. Move Passport verification to a compact status/help row below top 3 or in info sheet. | Destination sheet | None for browsing; `Play to Rank` if empty | `Verify`/Passport as compact utility | X close; dock remains visible. | Low to medium. Can support competition and future ranked monetization, but no sales in current sheet. | Low | P4 |
| Bottom nav | Persistent game destinations. | Strong | Good invariant and center Arena button. Labels are visible. Some dock triggers use image menu assets while others use CandyIcon, causing slight style mismatch. | Keep 5 destinations. Standardize all icons to either 3D asset family or `CandyIcon` wrappers with matching frame. Center Arena remains dominant. No sixth item. | Persistent Z5 | Center Arena | None | Dock never shows back/X. Active destination state only. | Medium. Shop is revenue destination; do not add PRO as sixth tab. | Medium | P2 |
| Top chips/HUD | Shows resources/status/context across Hub, Practice, Arena. | Acceptable | Hub HUD is rich but heavy; Practice and Arena have different top systems; `GlobalStatusBar` exists but is not universal. PRO as tappable Z1 is transitional debt. | Gradually converge: Z1 = identity/passive status; Z2 = screen context; no sales CTAs in top HUD. Resource chips should be compact, visual, and stable. | Z1/Z2 in full screens; not inside Type B sheets | None in Z1; Z2 may have one contextual control | None | Back only when screen is route-deep. | High. PRO active state can show passively; purchase CTA belongs elsewhere. | High | P1 |
| Close/back navigation patterns | Let player dismiss sheets, return from routes, or leave active flows. | Weak | Mixed X, plain arrows, asset back, circular CSS, close icons, generated/lucide-like arrows. Some screens use `←`, some image back, some `CandyGlassShell` close. | Define one rule: back for route/deep navigation, X/close for dismissible overlays, confirm for destructive active match exits. Use asset `btn-back` for back and `close` icon for dismiss. | Global rule | N/A | N/A | See policy below. | Indirect but important: navigation inconsistency lowers premium feel. | Medium | P1 |

## 3. Global UI Rules

### 3.1 Modal vs Full Screen Policy

Use the existing Type A/B/C/D taxonomy mechanically.

| Type | Use | Required treatment |
|---|---|---|
| Full screen / route | Primary activities: Hub, Arena setup, Arena gameplay, Practice, Training Journal when routed, deep Trophy links. | `max-width: 390px`, normal flow, canonical back only when route-deep. |
| Destination sheet | Dock destinations and browsable app areas: Badges, Shop, Trophy Case, Leaderboard, future PRO destination. | `h-[100dvh]`, `rounded-none`, dock visible above sheet, X close. |
| Quick picker | Short inline decisions: piece picker, mission detail, exercise drawer, purchase confirm when launched from an item. | Auto-height bottom sheet, `rounded-t-3xl`, X/dismiss by sheet behavior. |
| System modal | Blocking or ceremonial moments: victory/claim flow, promotion picker, labyrinth completion, destructive confirmations when needed. | Opaque scrim, dock hidden/inert, one dominant decision. |

Do not promote a quick picker to destination sheet unless it has more than roughly six items, needs filtering/categories, and benefits from losing board context.

### 3.2 Back vs X Close Policy

- Use **Back** when the player is moving up the navigation stack or leaving a full-screen route.
- Use **X / close** when dismissing a sheet or modal and returning to the same underlying screen.
- Use **confirm-to-exit** for active Arena gameplay exits and resign. The second tap confirms; the visual treatment should match across back/resign.
- Use the Adventure `btn-back` asset for back buttons on game surfaces.
- Use the `close` icon asset for dismiss controls in sheets/modals.
- Do not use plain `←` in production game screens.
- Do not mix close and back in the same header unless one is a true route back and the other is a local dismiss, which should be avoided.

### 3.3 Primary CTA Style Policy

- One primary CTA per screen or modal.
- Game-action primaries use `PrimaryPlayCta` or `PrincipalButton` depending on surface.
- Transaction primaries use `PrincipalButton` with item/claim art when possible.
- Utility primaries inside Scholarly/account-like surfaces may use `Button variant="game-primary"`, but should be migrated to scene-rooted primitives when the surface becomes game-native.
- Primary CTAs should be visual-first: icon/art + short label, not explanatory copy.

### 3.4 Secondary CTA Style Policy

- Maximum one secondary CTA near the primary action.
- Secondary CTAs use ghost/text/icon treatment, never another large gold/game-primary button.
- Tertiary actions such as `Back to Hub`, `About`, `Manage`, `Share` should be text links or small icon buttons unless they are the screen's main purpose.
- Avoid stacked CTA columns with three or more equal-weight buttons.

### 3.5 PRO/Coach Surface Policy

- Free users can see PRO value, but the surface must show training value, not an ad.
- Active PRO users must be served value first: journal, remaining sessions, review history, better post-game insight.
- Do not sell PRO again to active users except quiet renewal/extend states near expiry.
- PRO should live in context: Hub training slot, Shop/PRO destination, post-game Coach moment, Training Journal.
- PRO should not live as a banner in board/gameplay zone.
- Coach value should be demonstrated through gameplay moments: a move insight, review preview, journal entry, or post-game lesson. Avoid long lists of perks in gameplay-adjacent screens.
- Coach credit purchase UI is payment-adjacent and high-risk; visual refactors must not alter purchase behavior.

### 3.6 Icon and Art Usage Policy

- Prefer existing Adventure 3D assets for game controls: back, battle, claim, undo, resign, trophy, shop, shield, coach.
- Use `CandyIcon` only when it wraps the same asset family or where no 3D banner/button asset exists.
- Do not mix emoji medals with 3D game icons in premium screens.
- Do not introduce lucide/raw SVG arrows for game navigation.
- New Adventure assets must be registered under `apps/web/public/art/redesign/` in `.avif`, `.webp`, and `.png`.

### 3.7 Text Density Policy

- Primary game screens should be visual-first and scannable in under three seconds.
- One title, one short support line, one primary action.
- Lists should use chips, icons, stats, and progress bars before paragraphs.
- Long explanations belong in info sheets, `/about`, or Training Journal details, not Hub/Arena/Practice primary view.
- Labels should be 1-3 words where possible: `Play`, `Claim`, `Review`, `Retry`, `Share`.
- User-facing strings still belong in `apps/web/src/lib/content/editorial.ts` when implementation begins.

### 3.8 Bottom Nav Behavior

- Keep exactly five destinations.
- Center Arena remains visually dominant.
- Dock remains visible above Type B and Type C sheets.
- Dock hides only for documented exceptions: active Arena match, victory/deep ceremony, splash/onboarding, and System Modals.
- Do not add PRO as a sixth tab. If PRO needs a destination, it belongs under Shop or a Hub training slot until a formal IA change is approved.
- Active state should indicate destination, not temporary quick-picker state.

### 3.9 Top HUD/Chip Behavior

- Z1 is identity/passive status. No primary CTAs.
- Z2 is screen context and one contextual control.
- PRO state in Z1 must be passive or transitional only; purchase intent belongs in a destination sheet or contextual value slot.
- Resource chips should not wrap or reflow at 390px.
- Arena match HUD is an immersive exception and should stay minimal: back/confirm, timer, matchup, no sales.

### 3.10 390px MiniPay Viewport Rules

- Design and QA at 390px width first.
- Do not adjust desktop unless mobile breaks.
- No element should require horizontal scroll.
- Touch targets stay at least 44px.
- Safe areas must be respected at top and bottom.
- Fixed-format elements need stable dimensions: board, dock, CTA, chips, cards, and modal buttons should not shift when text changes.
- Avoid dense card stacks that push the primary gameplay or CTA below the fold.

## 4. Recommended Refactor Sequence

1. **Navigation pattern rule**  
   Standardize back vs X close and replace plain arrows in game surfaces. This improves premium feel without touching gameplay or payment behavior.

2. **PRO sheet state split**  
   Refactor only the visual composition of `ProSheet`: free vs active states, less copy, stronger active training value. Do not touch purchase logic.

3. **Hub monetization/value cleanup**  
   Keep Hub layout, but reduce competing PRO/Coach signals. Make active PRO show training value and free PRO show one compact value slot.

4. **Arena setup simplification**  
   Reduce pre-match decision blocks. Keep color/difficulty/start. Demote Coach/PRO to a quiet post-game value hint.

5. **Arena result CTA hierarchy**  
   One dominant result action per phase. Demote share/back/Coach where needed while preserving all current callbacks.

6. **Bottom dock icon family pass**  
   Standardize visual family across the five items. No IA changes.

7. **Training Journal game-native pass**  
   Make the journal feel like a premium training log and active PRO value center.

8. **Practice top tray normalization**  
   Align piece/mission/exercise/labyrinth controls with Z1/Z2/Z4 rules. Do not alter puzzle logic.

9. **Shop visual card pass**  
   Make item cards more visual and less commerce-dense. Do not alter item ids, token routes, prices, approval, purchase, or verification.

10. **Badges/Trophy Case collection pass**  
   Make progress/owned/claimable states more collectible and less list-like.

11. **Leaderboard prestige pass**  
   Replace emoji/notice-heavy ranking with game medals and compact verification utility.

12. **Labyrinth completion polish**  
   Tighten completion modal and mode-toggle placement after Practice is stable.

## 5. First 5 Implementation Prompts

### Prompt 1: Navigation Pattern Rule

Refactor only Chesscito navigation visuals. Do not change routes, callbacks, telemetry, payment logic, game logic, Coach analysis, Arena engine, Practice logic, or backend behavior.

Goal: standardize back vs close across mobile game surfaces.

Scope:
- Replace plain `←` back controls in game-facing screens with the existing Adventure `btn-back` asset treatment.
- Keep X/close only for dismissing sheets/modals.
- Keep confirm-to-exit behavior for active Arena match exits.
- Do not touch the persistent dock.
- Verify at 390px mobile.

Acceptance:
- Full-screen routes use back.
- Sheets/modals use close.
- No plain text arrow remains in game-native screens.
- No behavior changes.

### Prompt 2: PRO Sheet Visual State Split

Refactor only the visual layout and copy density of `apps/web/src/components/pro/pro-sheet.tsx`. Do not change purchase, verify, retry, chain switching, wallet connect, telemetry, or routing behavior.

Goal: free users see training value; active PRO users get value first and are not resold.

Scope:
- Create distinct free and active visual hierarchy within the existing sheet.
- Free state: one hero value, price, 2-3 icon perks, one primary CTA.
- Active state: active badge, Training Journal CTA, remaining time/session value, quiet renewal only near expiry.
- Demote roadmap and mission note so they do not compete with the primary action.

Acceptance:
- Active PRO primary action is value-serving, not purchase-first.
- Free PRO primary action remains purchase/connect/switch as today.
- No payment or verification logic changes.

### Prompt 3: Hub PRO/Coach Value Slot

Refactor only the Hub visual composition around PRO/Coach value. Do not modify navigation handlers, sheets, payment logic, Coach analysis, telemetry, reward tile logic, or Arena/Practice behavior.

Goal: reduce Hub clutter and make PRO feel like training value, not a banner.

Scope:
- Keep `ENTER ARENA` as the dominant CTA.
- Keep Practice as secondary.
- Replace competing PRO/Coach promotional blocks with one compact training value slot.
- Active PRO state should point to Training Journal/session value.
- Free state can show one compact unlock value.

Acceptance:
- Hub has one dominant purpose: enter/play.
- PRO/Coach no longer competes visually with the main play CTA.
- Active PRO users are not shown a sales banner.

### Prompt 4: Arena Setup Decision Simplification

Refactor only `ArenaSelectScaffold` visual hierarchy. Do not change Arena engine, difficulty behavior, color selection behavior, start behavior, soft-gate logic, Coach analysis, payments, contracts, backend, or telemetry.

Goal: make pre-match setup feel like one game-native selection screen.

Scope:
- Keep title/back, color selector, difficulty selector, and start CTA.
- Demote prize pool to compact pill treatment.
- Convert Coach signal into compact value hint or footer support, not a panel competing with start.
- Reduce explanatory text.

Acceptance:
- One primary CTA: `Start Match`.
- Difficulty/color choices remain unchanged.
- No gameplay or side-effect changes.

### Prompt 5: Arena Result CTA Hierarchy

Refactor only visual CTA hierarchy in Arena result components (`ArenaEndState`, `VictoryCelebration`, `VictoryClaimSuccess`, and related claim-error visual shells if needed). Do not change claim logic, share logic, Coach callbacks, payment/contract/backend behavior, Arena engine, or telemetry events.

Goal: one dominant post-game action per result phase.

Scope:
- Win before claim: `Save Victory` is primary.
- Claim success: `Play Again` or `Ask Coach` becomes the single primary based on existing product decision; other actions are secondary.
- Loss: `Play Again` remains primary; Coach appears as insight/value secondary.
- Share and Back to Hub are demoted.

Acceptance:
- No modal has three equal-weight CTAs.
- Coach value is visible through a compact insight/preview, not a sales block.
- All existing actions remain reachable.

## 6. Risks and What Not to Touch

### Main Risks

- Broad visual edits can accidentally change game/payment behavior because several screens combine UI, state, contract calls, telemetry, and local persistence in the same component.
- PRO and Coach refactors can easily regress active-user treatment if free/active state is not explicitly separated.
- Arena result refactors are high risk because claim, share, Coach, and replay flows converge there.
- Shop visual changes are high risk because item ids, token route selection, approval, purchase, and success/error states are business-critical.
- Practice visual changes can break learning flow if board space or hit targets are reduced.

### Do Not Touch

- Contracts, ABIs, addresses, item ids, token constants, prices, approval logic, purchase logic, verify logic, or claim logic.
- Backend/API routes, Supabase server code, cron routes, Coach analysis endpoints, signing endpoints, or telemetry behavior.
- Arena engine, chess move generation, bot behavior, persistence, result detection, claim phases, or board logic.
- Practice exercise generation, scoring, progression, star logic, labyrinth logic, shield consumption, or board hit-grid.
- Environment files, private keys, service role keys, seeds, wallet credentials, or anything under `private/`.

### PR Discipline

- One PR equals one screen or one small transversal rule.
- Each PR states the surface type: Full screen, Destination sheet, Quick picker, or System modal.
- Each PR states the dominant purpose and primary CTA.
- Each PR verifies at 390px mobile.
- Each PR includes before/after screenshots for the touched surface only.
- No opportunistic refactors.
- No desktop-driven fixes unless mobile is broken.
