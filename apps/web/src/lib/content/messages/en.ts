/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  messages/en.ts — runtime EN bundle for next-intl                 ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  • DERIVED from editorial.ts via `import * as editorial`.         ║
 * ║    Edit copy in editorial.ts, not here.                           ║
 * ║  • The ONLY things you write directly in this file are ICU       ║
 * ║    mirrors for function helpers that stripFunctions removed:      ║
 * ║      // editorial.ts:  greet: (n: string) => `Hi, ${n}!`          ║
 * ║      // en.ts mirror:  m.FOO.greet = "Hi, {name}!"                ║
 * ║    Only add a mirror when a useTranslations caller needs it.      ║
 * ║  • Do NOT add manual EN copy here — it would diverge silently     ║
 * ║    from the authoring source.                                     ║
 * ║                                                                   ║
 * ║  See:                                                             ║
 * ║    apps/web/src/lib/content/README.md                             ║
 * ║    docs/content/chesscito-language-brief.md                       ║
 * ║                                                                   ║
 * ║  Original spec: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * EN message bundle for next-intl.
 *
 * Stage 2 of the i18n migration: bundles the existing editorial.ts
 * exports under a single default export so next-intl can resolve
 * messages by namespace (e.g. `t('COACH_COPY.yourSessions')` once
 * Stage 3 wires components onto `useTranslations`).
 *
 * editorial.ts remains the authoring source — every consumer still
 * imports named constants from there. This file is purely the
 * runtime bundle.
 *
 * Functions are stripped: NextIntlClientProvider is a Client
 * Component and the `messages` prop must be JSON-serializable.
 * editorial.ts exports a few computed-value helpers (e.g.
 * `submitFailed: (n) => ...`) — those stay accessible via their
 * named export from editorial.ts; they're not message-bundle
 * citizens. Stage 3 / Stage 4 will convert them to ICU
 * MessageFormat (`{count, plural, …}`) where they need to live
 * in the bundle.
 */
import * as editorial from "../editorial";

function stripFunctions(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function") return undefined;
  if (Array.isArray(value)) {
    return value
      .map(stripFunctions)
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripFunctions(entry);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

const messages = stripFunctions({ ...editorial }) as Record<string, unknown>;

// ICU MessageFormat overrides for helpers stripped by stripFunctions.
// These editorial.ts exports are still functions for legacy callers
// (e.g. `HUD_COPY.proRemainingFormat(5)`), but next-intl needs ICU
// template strings inside the bundle. As each consumer surface migrates
// to `useTranslations`, its helpers get an ICU mirror added here.
// See red-team M-3 (per-surface migration of helper-style copy).
// `any` is intentional: bundle keys are typed `unknown` after stripFunctions.
// `@typescript-eslint/no-explicit-any` is not configured in this project so
// the cast does not trigger a lint warning.
const m = messages as any;
m.HUD_COPY.proRemainingFormat = "{days}d";
m.TX_PROGRESS_COPY.stepCounter = "Step {current} of {total}";
m.SHARE_COPY.badge =
  "I earned the {piece} Ascendant badge on Chesscito! {stars}/15 stars. Saved on Celo forever.";
m.SHARE_COPY.score =
  "I just landed {stars}★ on the Chesscito leaderboard. Can you beat it?";
m.SHARE_COPY.shop = "I just got {item} on Chesscito!";
m.VICTORY_PAGE_COPY.metaCheckmate = "Checkmate in {moves} moves";
m.VICTORY_PAGE_COPY.metaComplete = "Complete in {moves} moves";
m.VICTORY_PAGE_COPY.metaChallenge =
  "Can you beat that? Victory #{id} saved as a Chesscito victory card.";
m.VICTORY_PAGE_COPY.metaFallbackTitle = "Victory #{id}";
m.ACHIEVEMENTS_COPY.sectionDescription = "{earned} of {total} unlocked";
m.ACHIEVEMENTS_COPY.progressLabel = "{current}/{goal}";
m.VICTORY_CLAIM_COPY.challengeText =
  "I solved this in {moves} moves. Can you beat me?\nPlay Chesscito on Celo 👉 {url}";
m.REWARD_COPY.rook.ariaLabel =
  "{state, select, claimable {Claim Rook mastery badge: ready} progress {Rook mastery: in progress} other {Rook mastery: locked}}";
m.REWARD_COPY.bishop.ariaLabel =
  "{state, select, claimable {Claim Bishop mastery badge: ready} progress {Bishop mastery: in progress} other {Bishop mastery: locked}}";
m.REWARD_COPY.queen.ariaLabel =
  "{state, select, claimable {Claim Queen mastery badge: ready} progress {Queen mastery: in progress} other {Queen mastery: locked}}";
m.REWARD_COPY.knight.ariaLabel =
  "{state, select, claimable {Claim Knight mastery badge: ready} progress {Knight mastery: in progress} other {Knight mastery: locked}}";
m.REWARD_COPY.king.ariaLabel =
  "{state, select, claimable {Claim King mastery badge: ready} progress {King mastery: in progress} other {King mastery: locked}}";
m.REWARD_COPY.pawn.ariaLabel =
  "{state, select, claimable {Claim Pawn mastery badge: ready} progress {Pawn mastery: in progress} other {Pawn mastery: locked}}";
m.REWARD_COPY.victory.ariaLabel =
  "{state, select, claimable {Save victory ready: tap to save} progress {Victory in progress} other {No victory ready: win an Arena match}}";
m.PRO_COPY.statusActiveSuffix =
  "{daysLeft, plural, =1 {Expires tomorrow} other {# days left}}";
m.PRO_COPY.daysLeftActiveLabel =
  "{daysLeft, plural, =1 {Your pass expires tomorrow.} other {Your pass expires in # days.}}";
m.PRO_COPY.hubCoachCard.active.title = "PRO Active · {remainingDays}d";
m.COACH_COPY.gamesAnalyzed = "Games analyzed: {count}";
m.COACH_COPY.highestDifficulty = "Highest difficulty: {difficulty}";
m.COACH_COPY.currentStreak = "Current streak: {wins} wins";
m.COACH_COPY.keyMomentsCount = "{count} key moments";
m.COACH_COPY.moveLabel = "Move {moveNumber} · You played {move}";
m.COACH_COPY.tryInstead = "→ Try {move}";
m.COACH_COPY.creditPackSubtitle = "{count} game analyses";
m.COACH_COPY.historyFooter.reviewing =
  "{count, plural, =1 {Reviewing # past game} other {Reviewing # past games}}";
m.COACH_COPY.relativeTime.minutes = "{count}m ago";
m.COACH_COPY.relativeTime.hours = "{count}h ago";
m.COACH_COPY.relativeTime.days = "{count}d ago";
m.COACH_COPY.relativeTime.months = "{count}mo ago";
m.COACH_COPY.latestReviewCard.ariaLabel =
  "Open {typeLabel} Coach Review, {result}, {difficulty}, {moves} moves";
m.COACH_CTA_COPY.askWithCounter = "Ask Luz for your analysis ({count} free left)";
m.COACH_ENTRY_COPY.historyAnalyzeAriaLabel =
  "Analyze match from {timestamp}, {difficulty}, {result}";
m.ARENA_COPY.coachPreview.insight =
  "You finished a {difficulty} match in {moves} moves. Coach found key moments behind {result, select, win {your win} draw {the draw} resigned {the resignation} other {the loss}}.";
m.VICTORY_CELEBRATION_COPY.performanceLine = "Solved in {moves} moves · {time}";
m.VICTORY_CELEBRATION_COPY.performanceLineCheckmate = "Checkmate in {moves} moves · {time}";
m.VICTORY_CLAIM_COPY.teaserCheckmate = "Checkmate in {moves} moves";
m.VICTORY_CLAIM_COPY.card.performanceLine = "{moves} MOVES • {time}";
m.VICTORY_CLAIM_COPY.card.byLine = "by {player}";
m.PIECE_RAIL_COPY.triggerAriaFormat = "Switch piece (current: {piece})";
m.SAVED_CHIP_COPY.label = "Saved · {stars}★";
m.SAVED_CHIP_COPY.ariaLabel =
  "Score saved: {stars} of {total} stars. Beat your score to save again.";
m.SAVED_CHIP_COPY.ariaLabelWithReceipt =
  "Score saved on chain: {stars} of {total} stars. Tap to view receipt on Celoscan.";
m.MISSION_DETAIL_COPY.closeLabelFormat = "Close {title}";
m.MISSION_BRIEFING_COPY.moveObjective = "Move your {piece} to {target}";
m.LABYRINTH_COPY.missionHint = "Reach the star · optimal {optimal} moves";
m.LABYRINTH_COPY.movesLabel = "{n, plural, =1 {# move} other {# moves}}";
m.LABYRINTH_COPY.completeStars = "{stars}/3 ★";
m.PURCHASE_CONFIRM_COPY.approving = "Approving {token}...";
m.EXERCISE_DRAWER_COPY.progressLabel = "{earned}/{max}";
m.EXERCISE_DRAWER_COPY.badgeThresholdHint = "Badge at {threshold} stars";
m.BADGE_SHEET_COPY.claimSuccess = "{piece} Badge claimed!";
m.SHOP_SHEET_COPY.successBannerFormat = "{item} secured!";
m.SHOP_SHEET_COPY.successBannerTxFormat = "tx {hash}";
m.SHOP_SHEET_COPY.buyButtonAriaFormat = "{action}: {item} for {price}";
m.MISSION_BRIEFING_COPY.visibleMissionTargetFormat = "Move to {target}";
m.MISSION_BRIEFING_COPY.openDetailsLabyrinthAriaFormat = "Open mission details: optimal path {moves} moves";
m.MISSION_BRIEFING_COPY.openDetailsTargetAriaFormat = "Open mission details: target {target}";
m.HUD_COPY.shieldsAriaLabel =
  "{count, plural, =1 {1 streak shield available} other {# streak shields available}}";
m.HUD_COPY.shieldsFormat = "Shield ×{count}";
// ICU mirror for the editorial.ts `shieldsLeft(n)` function helper.
// Consumed by FailRescueModal's "Use Shield" chip subtitle.
m.FOOTER_CTA_COPY.shieldsLeft = "{n} left";
m.RESULT_OVERLAY_COPY.badge.subtitle = "{piece} Ascendant is now yours to keep";
m.RESULT_OVERLAY_COPY.shop.subtitle = "{item} acquired. Thank you for supporting Chesscito";
m.BADGE_EARNED_COPY.title = "{piece} Ascendant Earned";
m.PIECE_COMPLETE_COPY.subtitleWithNext = "You've mastered this piece! The {next} awaits.";
m.PIECE_COMPLETE_COPY.nextPiece = "Start {piece}";
m.UNLOCK_COPY.title = "{piece} Unlocked!";
m.UNLOCK_COPY.cta = "Start {piece}";

// Hub V2 — Training Pass band format helpers.
m.HUB_V2_TRAINING_COPY.active.daysFormat = "{d}d";
m.HUB_V2_TRAINING_COPY.active.sessionsFormat = "Sessions: {used}/{total}";
m.HUB_V2_TRAINING_COPY.active.renewsFormat = "Renews {mmdd}";
m.HUB_V2_TRAINING_COPY.active.ariaLabel =
  "Training Pass active, {d} days remaining, {used} of {total} sessions used";

// Hub V2 — Mastery dashboard per-piece + streak.
const MASTERY_PIECES = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
const MASTERY_LABEL_EN: Record<(typeof MASTERY_PIECES)[number], string> = {
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
  queen: "Queen",
  king: "King",
};
for (const piece of MASTERY_PIECES) {
  const label = MASTERY_LABEL_EN[piece];
  m.HUB_V2_MASTERY_COPY[piece].subInProgress = "{current}/{total}";
  // ICU `select` keywords must be valid identifiers — hyphenated states
  // (`in-progress`, `locked-buildable`) are converted to camelCase
  // (`inProgress`, `lockedBuildable`) at the call site.
  m.HUB_V2_MASTERY_COPY[piece].ariaLabel =
    `{state, select, mastered {${label} mastered, three stars} inProgress {${label} in progress, {current} of {total} stars} lockedBuildable {${label}: start practicing to earn stars} other {${label}: coming soon}}`;
}
m.HUB_V2_MASTERY_COPY.streakLabel =
  "{days, plural, =0 {} =1 {1-day streak} other {#-day streak}}";

// HUB action rail + scaffold format helpers.
m.HUB_ACTION_RAIL_COPY.arenaUnlockedAriaFormat = "Special training: {name}";
m.HUB_ACTION_RAIL_COPY.arenaLockedAriaFormat = "{name}: locked";
m.HUB_ACTION_RAIL_COPY.dailyCompletedAriaFormat =
  "Daily Tactic completed. Fresh in {hours}h.";
m.HUB_ACTION_RAIL_COPY.dailyPlayAriaFormat = "Play today's Daily Tactic. {name}.";

// HUD ARIA + format helpers consumed by hub-scaffold.
m.HUD_COPY.trophiesAriaLabel = "Trophies: {count}";
m.HUD_COPY.proAriaLabel =
  "{days, plural, =1 {PRO active, 1 day remaining} other {PRO active, # days remaining}}";
m.HUD_COPY.starsFormat = "{current}/{total}";
m.HUD_COPY.starsAriaLabel = "Stars: {current} of {total}";
m.HUD_COPY.streakFormat = "{days, plural, =1 {1-day streak} other {#-day streak}}";
m.HUD_COPY.streakAriaLabel =
  "{days, plural, =1 {Streak: 1 day} other {Streak: # days}}";

// Hub scaffold premium slot active aria.
m.HUB_SCAFFOLD_COPY.premiumActiveAriaFormat =
  "Training Pass: {used} of {total} sessions used, {days} days remaining";
m.ACCOUNT_SHEET_COPY.languageSwitchAriaFormat = "Switch language to {name}";

export default messages;
