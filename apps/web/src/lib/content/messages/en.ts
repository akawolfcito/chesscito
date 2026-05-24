/**
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
 *
 * See: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md §4.2
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
  "I earned the {piece} Ascendant badge on Chesscito! {stars}/15 stars — permanently on-chain.";
m.SHARE_COPY.score =
  "I just locked my Chesscito score on-chain! {stars}/15 stars — permanently recorded.";
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
  "{state, select, claimable {Claim Rook mastery badge — ready} progress {Rook mastery — in progress} other {Rook mastery — locked}}";
m.REWARD_COPY.bishop.ariaLabel =
  "{state, select, claimable {Claim Bishop mastery badge — ready} progress {Bishop mastery — in progress} other {Bishop mastery — locked}}";
m.REWARD_COPY.queen.ariaLabel =
  "{state, select, claimable {Claim Queen mastery badge — ready} progress {Queen mastery — in progress} other {Queen mastery — locked}}";
m.REWARD_COPY.knight.ariaLabel =
  "{state, select, claimable {Claim Knight mastery badge — ready} progress {Knight mastery — in progress} other {Knight mastery — locked}}";
m.REWARD_COPY.king.ariaLabel =
  "{state, select, claimable {Claim King mastery badge — ready} progress {King mastery — in progress} other {King mastery — locked}}";
m.REWARD_COPY.pawn.ariaLabel =
  "{state, select, claimable {Claim Pawn mastery badge — ready} progress {Pawn mastery — in progress} other {Pawn mastery — locked}}";
m.REWARD_COPY.victory.ariaLabel =
  "{state, select, claimable {Save victory ready — tap to save} progress {Victory in progress} other {No victory ready — win an Arena match}}";
m.PRO_COPY.statusActiveSuffix =
  "{daysLeft, plural, =1 {Expires tomorrow} other {# days left}}";
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
m.COACH_ENTRY_COPY.historyAnalyzeAriaLabel =
  "Analyze match from {timestamp}, {difficulty}, {result}";

export default messages;
