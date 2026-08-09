/**
 * Chesscito Editorial Source — canonical EN copy.
 *
 * This file is the SINGLE SOURCE OF TRUTH for English copy. Contains
 * literal strings, ICU placeholder templates ("Hello {name}"), and
 * legacy function helpers (the bundler in messages/en.ts strips
 * functions; pair each consumed-via-useTranslations helper with an
 * ICU mirror in en.ts).
 *
 * Do NOT add Spanish copy here — ES overrides live in messages/es.ts.
 *
 * Editorial rules (voice, length, Web3-light, no medical claims):
 *   docs/content/chesscito-language-brief.md
 *
 * Architecture (editorial.ts ↔ messages/en.ts ↔ messages/es.ts):
 *   apps/web/src/lib/content/README.md
 *
 * Audit (orphans, missing translations, jargon, claims, mirrors):
 *   pnpm content:audit
 */
import { THEME_CONFIG } from "@/lib/theme";
import { buildDeleteMessage } from "@/lib/coach/delete-message";

export const GLOSSARY = {
  badge: "Badge",
  claimBadge: "CLAIM",
  submitScore: "SAVE",
  piecePath: "Piece Path",
  trial: "Trial",
  progress: "Progress",
  leaderboard: "LEADERS",
} as const;

export const CTA_LABELS = {
  startTrial: "Start Trial",
  continue: "CONTINUE",
  claimBadge: GLOSSARY.claimBadge,
  submitScore: GLOSSARY.submitScore,
  retry: "RETRY",
  viewLeaderboard: "LEADERS",
  backToPlay: "Back to Play",
} as const;

export const FOOTER_CTA_COPY = {
  submitScore: { label: "SAVE", compactLabel: "SAVE", loading: "Saving..." },
  useShield: { label: "Use Shield", compactLabel: "Shield", loading: "Using Shield..." },
  claimBadge: { label: "CLAIM", compactLabel: "CLAIM", loading: "Claiming..." },
  retry: { label: "RETRY", compactLabel: "RETRY", loading: null },
  connectWallet: { label: "Connect Wallet", compactLabel: "CONNECT", loading: null },
  switchNetwork: { label: "Switch Network", compactLabel: "Network", loading: null },
  shieldsLeft: (n: number) => `${n} left`,
  submitCanceled: "Save canceled",
  localSaved: "Saved",
  claimWelcomePack: "Claim gift",
} as const;

/** ICU placeholders mirrored in messages/en.ts for the function helpers
 *  above (shieldsLeft). */

export const PIECE_LABELS = {
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
  queen: "Queen",
  king: "King",
} as const;

export const PIECE_RAIL_COPY = {
  comingSoon: "Soon",
  title: "Piece info",
  /** Line under the piece name inside the info sheet — invites the
   *  player to keep playing the active piece rather than nudging
   *  them to switch (pedagogy-first). */
  infoSubtitle: "Keep practicing to claim its badge.",
  /** Section header for the gated switch grid (visible only after the
   *  player has claimed at least one badge). */
  switchSectionLabel: "Switch piece",
  /** ICU placeholder for the trigger button's screen-reader label. */
  triggerAriaFormat: "Switch piece (current: {piece})",
  /** Close affordance inside the sheet's contextual header. */
  closeLabel: "Close piece picker",
} as const;

/** `<JourneyRail />` copy. ICU formats interpolate piece names from
 *  `PIECE_LABELS` so ES translations can re-order ("Insignia de Torre"
 *  vs "Torre Badge") without code changes. */
export const JOURNEY_RAIL_COPY = {
  ariaLabel: "Your journey",
  pieceBadgeFormat: "{piece} Badge",
  unlockPieceFormat: "Unlock {piece}",
  noMorePieces: "No more pieces",
  allPiecesMastered: "All pieces mastered",
  claimed: "Earned",
  readyToClaim: "Ready to earn",
  ready: "Ready",
  claimBadgeFirst: "Earn badge first",
  starProgressFormat: "{current} / {total} ★",
  masteredCountFormat: "{count} / {total}",
} as const;

/** Training-path copy. The labyrinth keys feed the ExerciseDrawer's
 *  labyrinth leg and the contextual Enter Labyrinth pin. The exercise
 *  chip / milestone keys are orphans since the surface-redistribution
 *  spec (2026-06-11) deleted `<TrainingPathRail />`; preserved for a
 *  separate orphan-strings chore (M1 precedent). */
export const TRAINING_PATH_COPY = {
  title: "Training path",
  ariaLabel: "Training path for this piece",
  exercisesLabel: "Exercises",
  exerciseChipFormat: "Exercise {number}: {stars} of 3 stars",
  labyrinthLabelFormat: "Labyrinth {number}",
  /** Generic fallback label for a Special Training node with no authored title
   *  (B4.2.3). Named entries — Rook Rails, Pivot Challenge — use their own title
   *  instead; only untitled labs fall through to this. */
  specialTrainingLabelFormat: "Special Training {number}",
  trainingPassRequired: "Challenge Pass / PRO",
  unlockChallengesCta: "Unlock Challenges",
  labyrinthOpenAriaFormat: "Open Labyrinth {number}",
  /** The first labyrinth's unlock is a compound gate: stars AND an
   *  exercise floor (LABYRINTH_MIN_EXERCISES). A stars-only message lets
   *  a player with enough stars but too few solves read "unlocked" and
   *  stay locked with no explanation — this format names both halves. */
  labyrinthLockedStarsFormat: "Unlocks at {stars}★ and {exercises} exercises",
  labyrinthLockedChain: "Beat previous lab",
  ready: "Ready",
  starsFormat: "{stars}★",
  milestonesLabel: "Milestones",
  badgeLabel: "Badge",
  /* ⛔ `badgeLockedFormat: "Badge at {stars}★"` lived here with ZERO consumers
   * while stating a gate the game dropped — the badge is earned by COMPLETION,
   * not stars. Deleted 2026-08-08 rather than left "preserved": an orphan that
   * is also wrong is a landmine, not an asset. The live version of this
   * sentence is `EXERCISE_DRAWER_COPY.badgeThresholdHint`. */
  badgeReady: "Badge ready",
  badgeConnect: "Connect to claim",
  badgeClaimed: "Claimed",
  masteryLabel: "Mastery",
  masteryLocked: "Badge + labyrinths",
  masteryAlmost: "Labyrinths left",
  masteryComplete: "Mastered",
  /** Contextual pin shown when the path's next challenge is an
   *  unlocked, uncompleted labyrinth — the challenge comes to the
   *  player instead of hiding in the Mission sheet (Slice 3D). */
  nextChallengeCta: "Enter Labyrinth",
} as const;

export const MISSION_DETAIL_COPY = {
  title: "Mission",
  scoreLabel: "Score",
  timeLabel: "Time",
  preFirstMoveHint: "Make your first move to start tracking",
  journeyTitle: "Your journey",
  /** Surface redistribution D1 (spec 2026-06-11): the one live "what
   *  do I do now" line. Only labyrinth recommendations render it; when
   *  the path has nothing pending, the objective above IS the answer. */
  nowLabyrinthFormat: "Now: Special Training {number}",
  nowLabyrinthAriaFormat: "Start Special Training {number}",
  /** D5: save score affordance inside Mission, below the objective.
   *  The promise line leads with the reward (QA F5 promise-first) and
   *  must describe what the OFF-CHAIN save actually delivers — a
   *  leaderboard spot. "For life" wording is reserved for the future
   *  on-chain Leaderboard Proof action (QA G3 2026-06-11). */
  saveScorePromise: "Climb the leaderboard",
  saveScoreCta: "Save score",
  /** MiniPay delivery Lote 2 B2 (2026-07-08): the off-chain save auto-runs and
   *  is free, so it is no longer a CTA. `scoreSaved` is the informative state
   *  shown once persisted; `retrySaveCta` is the free manual fallback surfaced
   *  only if the silent auto-save failed. */
  scoreSaved: "Score saved",
  retrySaveCta: "Retry save",
  /** MiniPay delivery audit B6 (2026-07-07): the on-chain SAVE is the
   *  gas-only submitScoreSigned flow, reframed as an OPTIONAL voluntary
   *  training proof (not an over-promised "for life"). Copy leads with the
   *  action; the button stays concise. */
  saveOnChainPromise: "Save today’s training proof",
  saveOnChainCta: "Save proof",
  /** Busy label kept beside the spinner so the Save buttons never collapse
   *  to a bare spinner while saving (UX audit Minor 2026-06-14). */
  saving: "Saving…",
  /** Score breakdown line rendered near the Save Score button.
   *  `{stars}` = total exercise stars for the selected piece.
   *  Labyrinths are excluded from this count. */
  scoreBreakdown: "{stars}★ × 100 pts",
  /** Full breakdown when totalStars === maxPossibleStars. */
  scoreAtMax: "{stars}★ / {maxStars}★ · Max",
  /** Generic close-affordance ARIA label used by `<MissionHeaderCandy />`
   *  for every sheet that adopts it (mission detail, daily picker, mate
   *  picker, …). `{title}` is the surface's own sheet title. */
  closeLabelFormat: "Close {title}",
} as const;

/**
 * The attempt queue, said out loud (Slice 3, stage 4C-3).
 *
 * An attempt that failed to deliver used to be invisible: it sat in the outbox
 * waiting for the next completion to drain it, and the player had no way to
 * know or to ask. This is the surface for that — persistent, in place, never a
 * modal and never a toast that expires while the player is mid-move.
 *
 * It says PROGRESS, not "score": what is waiting is the record that the attempt
 * happened, and on carril 2 the score genuinely does not move.
 */
export const ATTEMPT_SAVE_COPY = {
  /** Discreet, while a delivery is in flight. */
  saving: "Saving progress…",
  /** Same state with more than one waiting. */
  savingCountFormat: "Saving progress… ({count})",
  /** Persistent, after a retryable failure. Not an error the player caused. */
  failed: "Your last attempt hasn’t been saved yet.",
  failedCountFormat: "{count} attempts haven’t been saved yet.",
  /** The manual retry. Re-sends the SAME attempt, which the server answers as a
   *  replay — it costs the player nothing and cannot double-count. */
  retryCta: "Retry",
  retryAriaLabel: "Retry saving your progress",
} as const;

const PIECE_BASE = THEME_CONFIG.piecesBase;

export const PIECE_IMAGES: Record<keyof typeof PIECE_LABELS, string> = {
  rook: `${PIECE_BASE}/w-rook`,
  bishop: `${PIECE_BASE}/w-bishop`,
  knight: `${PIECE_BASE}/w-knight`,
  pawn: `${PIECE_BASE}/w-pawn`,
  queen: `${PIECE_BASE}/w-queen`,
  king: `${PIECE_BASE}/w-king`,
} as const;

export const BADGE_TITLES = {
  rook: "Rook Ascendant",
  bishop: "Bishop Ascendant",
  knight: "Knight Ascendant",
  pawn: "Pawn Ascendant",
  queen: "Queen Ascendant",
  king: "King Ascendant",
} as const;

export const LEADERBOARD_COPY = {
  description: "The best scores publicly recorded.",
  empty: "No scores recorded yet.",
} as const;

export const SCORE_UNIT = "pts";

export const RESULT_OVERLAY_COPY = {
  badge: {
    title: "Badge Earned!",
    subtitle: (piece: string) => `${piece} Ascendant is now yours to keep`,
  },
  score: {
    title: "Score Saved!",
    subtitle: "Saved and live on the leaderboard. Ready to share.",
    /** Label beside the count pill when the save cost a Peón (past the
     *  free quota). Numeral rendered in JSX; trailing word only. */
    peonesSpentLabel: "Peón spent",
    /** Trailing label for the free-save quota pill on a free save, e.g.
     *  "2 free saves left". Numeral rendered in JSX. */
    freeSavesLeftLabel: "free saves left",
  },
  shop: {
    title: "Purchase Complete!",
    subtitle: (item: string) =>
      `${item} unlocked. Thanks for supporting Chesscito`,
  },
  error: {
    title: "Couldn't save",
    cancelled: "Save was cancelled",
    insufficientFunds: "Not enough funds to complete this transaction",
    /** Recovery CTA shown when insufficientFunds fires inside MiniPay.
     *  Surfaced by `<AddCashCta />` next to the error message. Wording
     *  intentionally avoids web3 jargon per MiniPay copy guidelines. */
    addCashCta: "Deposit in MiniPay",
    network: "Network error. Check your connection and try again.",
    timeout:
      "This is taking longer than expected. Check your wallet or try again.",
    revert:
      "Transaction failed. This action may not be available right now.",
    unknown: "Something went wrong. Please try again",
    /** Surfaced by classifyTxError when the on-chain revert reason
     *  matches BadgeAlreadyClaimed (badge contract guard). Distinct
     *  from `revert` so the user understands they ALREADY have the
     *  badge — not that the claim failed for some other reason. */
    badgeAlreadyClaimed: "You already own this badge!",
    /** Scoreboard's CooldownActive and VictoryNFT's MintCooldown, both decoded
     *  from the contract's revert data. The wait is short (60s on mainnet) and
     *  the tx never left the wallet, so the player loses nothing by retrying —
     *  which is the one thing the generic revert copy failed to tell them. */
    cooldownActive: "Too soon. Wait a moment and try again.",
    /** Scoreboard's DailyLimitReached. Unlike the cooldown, retrying today will
     *  not work, so the copy must not invite it. */
    dailyLimitReached: "You've hit today's save limit. Try again tomorrow.",
    /** Surfaced when the signing endpoint (/api/sign-*) is unreachable
     *  or returns 4xx/5xx (most often missing operator envs in local
     *  dev, but also catches prod signer outages + GCM auth-tag
     *  mismatches from rotated keys). Distinct from `network` so the
     *  user understands the issue is server-side, not their wallet
     *  connection. */
    signingUnavailable: "Signing service unavailable. Try again in a moment.",
    /** Surfaced when the EIP-712 signature returned by /api/sign-victory
     *  is older than the contract's deadline (clock-skew or app-resume).
     *  Distinct from the generic `revert` so the user understands a
     *  fresh signature will fix it. */
    signatureExpired: "Signature expired. Tap to get a fresh one.",
    /** SaveScore off-chain: the wallet used its free saves and has no
     *  Peones left for the paid save. No hardcoded count (the free quota
     *  is calibrated via FREE_SCORE_SAVE_LIMIT). The overlay surfaces a
     *  Get Peones CTA + a "Not now" secondary. */
    notEnoughPeones:
      "You're out of free saves. You need 1 Peón to save this score.",
    /** SaveScore off-chain (Slice 5): soft rate limit hit. The toast
     *  appends the wait in seconds, e.g. "You can save again in 12s" — a
     *  clear backoff, never an immediate Try again loop. */
    rateLimitedPrefix: "You can save again in",
    /** Per-kind copy for purchase end states (Buy Item Shop, Buy Coach
     *  Credits). Mirrors the cancelled/timeout/error split that
     *  VictoryClaimError.errorKindCopy already uses for Mint Victory,
     *  so a cancellation feels calm ("Nothing was charged") and a
     *  timeout nudges the wallet ("check there before retrying")
     *  instead of dropping users into the generic error string. */
    purchaseKindCopy: {
      error: {
        title: "Couldn't buy",
        subtitle: "Something went wrong while completing your purchase.",
        hint: "No charge was applied. Try again or close and reopen the shop.",
      },
      cancelled: {
        title: "Saved for later",
        subtitle: "No transaction was made. Nothing was charged.",
        hint: "Tap the item again any time you change your mind.",
      },
      timeout: {
        title: "Still Confirming…",
        subtitle:
          "The network is taking longer than usual. Your wallet may already have the transaction.",
        hint: "Check your wallet first. If it's still pending, give it a moment before retrying.",
      },
    },
  },
  cta: {
    continue: "CONTINUE",
    tryAgain: "Try again",
    dismiss: "Dismiss",
    receiptOnCeloscan: "View receipt",
    /** Recovery CTA when a save is blocked on Peones — opens Get Peones. */
    getPeones: "Get Peones",
    /** Secondary on the recovery overlay — calmer than "Dismiss". */
    notNow: "Not now",
  },
} as const;

export const PIECE_COMPLETE_COPY = {
  title: "All Exercises Complete!",
  subtitleWithNext: (next: string) =>
    `You've mastered this piece! The ${next} awaits.`,
  subtitleFinal:
    "You've conquered every piece. Now prove it in the Arena!",
  /** ⛔ STARS HAVE NEVER UNLOCKED THE BADGE. The gate is 80% COMPLETION
   *  (`badgeRequiredCount`); `BADGE_THRESHOLD` was removed when the founder
   *  decided the badge proves constancy, not skill. This line used to read
   *  "More stars unlock your badge!" and taught the player a rule the game
   *  does not have. Named without a number on purpose: the pool is dynamic
   *  (the Supabase overlay appends exercises) and the gate scales with it. */
  subtitleKeepPracticing:
    "Keep going. Completing more exercises earns your badge!",
  /** Earned but not claimed. Before 2026-08-08 this case fell into
   *  `subtitleKeepPracticing`, because the branch forked on CLAIMED rather
   *  than EARNED — so the prompt told a player to keep pushing seconds after
   *  the milestone modal had told them the badge was ready.
   *
   *  ⚠️ Keep it SHORT. Sally sits `absolute -right-2 bottom-12 h-24 w-24`
   *  inside this panel, so roughly the last 88px of any second line are
   *  covered by her. The first version of this string ("Your badge is ready.
   *  Claim it whenever you like.") wrapped and lost its last word behind her.
   *  Same wording as the milestone modal's own subtitle, on purpose. */
  subtitleBadgeWaiting: "Your badge is ready to claim.",
  tryArena: "ARENA",
  nextPiece: (piece: string) => `Start ${piece}`,
  practiceAgain: "Practice Again",
  /** Re-surface of the save-score transactional moment from
   *  BadgeEarnedPrompt. Sentence case (QA F1 2026-06-11) to match the
   *  sibling secondary pills (Start Bishop, Practice Again). */
  submitScore: "Save score",
  /** Tertiary discovery link for the Coach feature. Only rendered when
   *  the primary CTA is "Start <next piece>" — when the primary is
   *  already "Try Arena" we skip it to avoid a duplicate Arena hop. */
  coachHint: "Try Coach review in Arena",
  /** Primary CTA used when there is no next piece in the linear order
   *  AND the current piece has no labyrinth available (e.g. King in
   *  v0.1 — no labyrinths defined yet). Opens the PiecePickerSheet so
   *  the player can return to any piece they want to keep training. */
  choosePiece: "Choose another piece",
  /** Demoted text-link variant of tryArena. Used when the primary CTA
   *  is "Try Labyrinth" or "Choose another piece" but Arena is still a
   *  valid path the player may want to take. Sentence case (not the
   *  uppercase "ARENA") matches the surrounding tertiary-link styling. */
  tryArenaSecondary: "Try Arena",
} as const;

export const BADGE_EARNED_COPY = {
  title: (piece: string) => `${piece} Ascendant Earned`,
  claimBadge: "CLAIM",
  submitScore: "SAVE",
  later: "Later",
  /** MiniPay Lote 2 F1: single neutral CTA now that the off-chain save
   *  auto-runs (no manual SAVE in this prompt). */
  continue: "Continue",
  headerLabel: "Badge Earned",
} as const;

export const BADGE_SHEET_COPY = {
  title: "Your Badges",
  subtitle: "Collection progress",
  owned: "Owned",
  claimBadge: "Claim Badge",
  claiming: "Claiming...",
  locked: "Complete trials to unlock",
  notStarted: "Complete trials to unlock",
  viewTrophies: "See Trophies",
  /** Inline success banner rendered above the badge grid for ~2.5s after
   *  a successful claim on the scaffold surface. ExercisesScreen legacy uses
   *  the global ResultOverlay for the same purpose; the scaffold has no
   *  ResultOverlay yet, so this banner provides the celebration moment. */
  claimSuccess: (piece: string) =>
    `${piece.charAt(0).toUpperCase()}${piece.slice(1)} Badge claimed!`,
  ariaLabel: "Badges",
  closeAriaLabel: "Close badges",
  ascendantFormat: "{piece} Ascendant",
  claimable: "Claimable",
  lockedShort: "Locked",
  claim: "Claim",
  starsProgressFormat: "{collected} of {total} stars",
  /** Onboarding hint shown above the badge grid when the user has zero
   *  stars collected. Lead with the reward (collectible for life), not
   *  the action — the audience scans and skips jargon. */
  firstStepHint: "Master the Rook. Claim your first training badge.",
  /** HERO BAND piece counter label — short, fits beside the slash count. */
  heroPiecesLabel: "PIECES",
} as const;

export const TUTORIAL_COPY = {
  rook: "The Rook moves in straight lines, horizontal or vertical",
  bishop: "The Bishop moves diagonally, any distance",
  knight: "The Knight jumps in an L-shape, 2+1 squares",
  pawn: "The Pawn moves forward one square, captures diagonally",
  queen: "The Queen moves any direction, any distance",
  king: "The King moves one square in any direction",
} as const;

export const CAPTURE_COPY = {
  statsLabel: "CAPTURE",
  tutorialBanner: "Capture the target. Move your Rook to its square.",
} as const;

export const BOARD_HINT_COPY = {
  selectPieceFirst: "Tap your piece first",
} as const;

export const SHIELD_COPY = {
  label: "Streak Shield",
  subtitle: "Failed a trial? Use a shield to try again without penalty.",
  useShield: "Use Shield",
  shieldsLeft: (n: number) => `${n} left`,
  shieldUsed: "Shield used!",
  buyLabel: "Buy (3 uses)",
} as const;

export const INVITE_COPY = {
  button: "Invite",
  text: "Come learn chess with me on Chesscito!",
  url: "https://chesscito.com",
  copied: "Link copied!",
} as const;

export const SHARE_COPY = {
  button: "Share",
  /* ⛔ The denominator was the literal 15 until 2026-08-08. Star pools are per
   * piece and move with the catalog (`getMaxPossibleStars`), so a bishop at
   * 27/27 published "27/15 stars" — contradicted by the panel it was shared
   * from, which prints the real ceiling two lines above the button. */
  badge: (piece: string, stars: number, maxStars: number) =>
    `I earned the ${piece} Ascendant badge on Chesscito! ${stars}/${maxStars} stars. Saved on Celo forever.`,
  score: (stars: number) =>
    `I just landed ${stars}★ on the Chesscito leaderboard. Can you beat it?`,
  shop: (item: string) =>
    `I just got ${item} on Chesscito!`,
  fallbackCopied: "Copied to clipboard!",
  url: "https://chesscito.com",
  /** Footer CTA shared by every /share/[type] page. */
  playCta: "Play Chesscito",
} as const;

export const DAILY_SOLVE_COPY = {
  solved: "Solved!",
  firstStreak: "First streak!",
  extendedStreak: "+1 day",
  newStreak: "New streak!",
  streakLabel: (n: number) => `Streak: ${n}`,
  /* Sprint 3 commit E — Daily Tactic real reward copy. Replaces the
   * Sprint 2 preview wording now that /api/peones/earn credits the
   * ledger for real. The connected branch renders one of FOUR states:
   *   1. "Saving Peones…" while the POST is in flight.
   *   2. rewardEarnedFormat(n) when credited > 0 and cap not reached.
   *   3. rewardCapPartialFormat(n) when credited > 0 and cap reached
   *      on this attempt (a partial credit).
   *   4. rewardCapExhausted when credited === 0 because the cap was
   *      already exhausted before this attempt.
   * If the earn POST fails, rewardSaveFailed renders instead — the
   * Daily completion + streak stay intact, only the Peones write
   * is signalled as failed.
   * Guest path renders only rewardGuestCta — never a number. */
  rewardEarnedFormat: (n: number) => `+${n} Peones`,
  rewardCapPartialFormat: (n: number) => `+${n} Peones · daily cap reached`,
  rewardCapExhausted: "Daily cap reached. Come back tomorrow for more Peones.",
  rewardSaveFailed: "Daily solved. Peones could not be saved right now.",
  rewardSaving: "Saving Peones…",
  rewardGuestCta: "Connect your wallet to save Peones rewards.",
  /** Lite mode — replaces the Peones reward block entirely. */
  rewardFocusComplete: "Focus complete",
} as const;

export const DAILY_SHARE_COPY = {
  shareChallenge: "Share Challenge",
  shareResult: "Share Result",
  ctaChallenge: "Can you solve today\u2019s puzzle?",
  /** Legacy helper retained for non-i18n callers. New surfaces should
   *  pick `ctaSolvedNoStreak` / `ctaSolvedWithStreak` via `useTranslations`. */
  ctaSolved: (streak?: number) =>
    streak != null && streak > 0
      ? `I solved today\u2019s puzzle. Streak: ${streak}. Can you?`
      : "I solved today\u2019s puzzle. Can you?",
  ctaSolvedNoStreak: "I solved today\u2019s puzzle. Can you?",
  ctaSolvedWithStreak: "I solved today\u2019s puzzle. Streak: {streak}. Can you?",
  /** Page chrome for `/share/daily`. */
  metaTitleChallenge: "Daily Tactic · Chesscito",
  metaTitleSolved: "Daily Tactic solved · Chesscito",
  headlineChallenge: "Daily Tactic",
  headlineSolved: "Daily Tactic solved",
  defaultName: "Daily Tactic",
} as const;

export const ENDGAME_SHARE_COPY = {
  shareChallenge: "Share Challenge",
  shareResult: "Share Result",
  ctaChallenge: "Can you force checkmate from this position?",
  /** Legacy helper retained for non-i18n callers. New surfaces should
   *  pick `ctaSolvedNoMoves` / `ctaSolvedWithMoves` via `useTranslations`. */
  ctaSolved: (moves?: number, limit?: number) =>
    moves != null && limit != null
      ? `I solved this K+R vs K training in ${moves}/${limit} moves. Can you?`
      : "I solved this endgame. Can you?",
  ctaSolvedNoMoves: "I solved this endgame. Can you?",
  ctaSolvedWithMoves: "I solved this K+R vs K training in {moves}/{limit} moves. Can you?",
  /** Page chrome for `/share/endgame`. */
  metaTitleChallenge: "Endgame challenge · Chesscito",
  metaTitleSolved: "Endgame solved · Chesscito",
  headlineChallenge: "Endgame challenge",
  headlineSolved: "Endgame solved",
  defaultName: "K+R vs K",
  kicker: "Mini Arena",
} as const;

/** `/share/badge` page chrome. */
export const BADGE_SHARE_COPY = {
  kicker: "Badge unlocked",
  metaTitleFormat: "{piece} Ascendant Badge",
  headlineFormat: "{piece} Ascendant",
} as const;

/** `/share/score` page chrome. */
export const SCORE_SHARE_COPY = {
  metaTitleFormat: "{stars}/15 stars on Chesscito",
  // Slice A: a score save is a leaderboard entry, not piece mastery.
  kickerFormat: "Saved to the leaderboard",
  headlineFormat: "{stars} / 15 stars",
} as const;

/** `<ShareGrid />` state labels + service aria-label format. Brand
 *  names (WhatsApp, Telegram, Facebook, X) intentionally stay
 *  hardcoded as proper nouns. */
export const SHARE_GRID_COPY = {
  more: "More",
  copy: "Copy",
  save: "Save",
  saveSaved: "Saved",
  saveLinkCopied: "Link copied",
  saveFailed: "Try Share",
  shareOnLabel: "Share on {service}",
} as const;

/** `<ShareModal />` chrome (preview states + close affordance). */
export const SHARE_MODAL_COPY = {
  defaultTitle: "Share",
  closeLabel: "Close share",
  previewAlt: "Share preview",
  generatingCard: "Generating your card\u2026",
  previewUnavailable: "Card preview unavailable",
} as const;

/** Celebration overlay copy, shared by the exercises flash and the Daily one.
 *
 *  Title Case, not caps: the headline renders as authored (no CSS
 *  `text-transform`), so an all-caps string here would shout in every locale
 *  and the arch would lose the ascender/descender rhythm that makes it read
 *  as a sign. */
export const PHASE_FLASH_COPY = {
  success: "Well Done!",
  failure: "Try Again",
  /** The lesson line under the success banner — names what the player just
   *  learned (the active exercise's curated title). Only shown on success. */
  lesson: "You learned: {title}",
  /** The tap-to-continue prompt at the bottom of the flash. The overlay holds
   *  until the player taps, so the celebration/lesson is never missed. */
  tapToContinue: "Tap to Continue",
} as const;

export const SHOP_SHEET_COPY = {
  title: "Shop",
  description: "Tools to sharpen your training.",
  featured: "Featured",
  buyButton: "Buy",
  /** Companion CTA shown next to the USDC button on the Founder Badge
   *  card when running outside MiniPay. Routes to the helper itemId
   *  whose priceUsd6 is calibrated so the contract charges 1 CELO
   *  rather than the ~10 % CELO equivalent of $0.10. */
  buyWithCelo: "Buy with 1 CELO",
  /** Short ghost-style label rendered inside the secondary celo button
   *  alongside the primary stablecoin buy. */
  payWithCeloShort: "Pay with CELO",
  buyButtonComingSoon: "Coming soon",
  buyButtonUnavailable: "Unavailable",
  empty: "Shop items are not available right now.",
  moreSoonTitle: "More items coming",
  moreSoonHint: "Skins, boards and boosters in the works.",
  ariaLabel: "Shop",
  closeAriaLabel: "Close shop",
  successBannerFormat: "{item} unlocked!",
  successBannerTxFormat: "tx {hash}",
  buyButtonAriaFormat: "{action}: {item} for {price}",
  status: {
    available: "Available",
    unavailable: "Unavailable",
    notConfigured: "Coming soon",
  },
} as const;


export const LEADERBOARD_SHEET_COPY = {
  title: "Leaders",
  description: "Climb the board. Rule the board.",
  columnPlayer: "Player",
  columnScore: "Score",
  loading: "Loading board...",
  empty: "No champions yet.",
  emptyArenaLink: "ARENA",
  error: "Could not load rankings",
  retry: "RETRY",
  champion: "Champion",
  topCompetitors: "Top Competitors",
  closeAriaLabel: "Close leaders",
  /** HERO BAND labels — overview anchor at the top of the sheet. */
  heroEyebrow: "THE RANKING",
  heroChampionLabelFormat: "Champion: {player}",
  heroChampionStatsFormat: "{score} pts · {count} players",
  /** Same line WITHOUT the player count, for when the population is unknown:
   *  the legacy endpoint shape does not carry one, and a failed count must not
   *  be papered over with the size of the top-10 cut (which is what made the
   *  hero say "10 players" to a player ranked 13th). No count is honest; a
   *  wrong count is not. */
  heroChampionScoreFormat: "{score} pts",
  /** Declares that the list is a CUT, and of what. Without it the honest
   *  population reads as missing rows: 17 announced above 10 visible looks like
   *  seven names failed to load. Shown only when the board really is cut. */
  listCutFormat: "TOP {shown} OF {total}",
  heroEmptyHeadline: "No ranking yet",
  heroEmptyHint: "Be the first to climb the board.",
  /** QA round 2026-06-11: on-chain marker + always-visible own rank. */
  onchainMarkerAria: "Saved on Celo",
  yourRankLabel: "Your rank",
  /** Own-rank block doubles as the primary permanent-save CTA when a score
   *  is waiting — visual only (dot + button affordance), so this string is
   *  the invisible accessible name for the tappable row. Follows the
   *  language brief §5: the result ("forever"), never the mechanism
   *  ("on-chain"). */
  saveOnChainAria: "Save your score forever",
  /** Slice 2C — the weekly window. Behind NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED,
   *  so none of this is on screen until the flag is flipped. */
  tabsAriaLabel: "Ranking window",
  tabWeekly: "THIS WEEK",
  tabAllTime: "ALL TIME",
  /** A fresh Monday, or the very first week. Not an error and not a bug —
   *  an empty weekly board is an invitation. */
  weeklyEmptyHeadline: "THE WEEKLY BOARD IS JUST GETTING STARTED",
  weeklyEmptyHint: "Play an exercise to put the first name on it.",
  /** Replaces the own-rank footer when the player has not played this week.
   *  Same height as the rank footer so switching tabs does not jump. */
  weeklyCtaTitle: "PLAY TO JOIN THIS WEEK",
  weeklyCtaHint: "Complete an exercise to enter the weekly ranking.",
} as const;

export const PURCHASE_CONFIRM_COPY = {
  title: "Confirm purchase",
  description: "Review the details before you confirm.",
  confirmButton: "Confirm purchase",
  approving: (token: string) => `Approving ${token}...`,
  buying: "Buying...",
  cancel: "Cancel",
  closeAriaLabel: "Cancel purchase",
  unknownNetwork: "Unknown network",
  /** Reassurance line shown above the secure-payment footer.
   *  Reminds the user that the wallet sheet is the next step,
   *  so the modal isn't doing the charge silently. */
  minipayHint: "MiniPay will ask you to confirm the payment.",
  /** Secure-payment tagline at the very bottom of the modal,
   *  paired with a small shield icon. Static — no wallet/chain
   *  details, on purpose. */
  securePayment: "Secure payment · Your funds are safe",
  /** Surfaces below the Confirm button when it's disabled. One
   *  reason renders at a time; the precedence is wired in
   *  purchase-confirm-sheet.tsx. Copy avoids token names
   *  ("USDC"/"USDT"/"cUSD") in favor of the "USD stablecoin"
   *  umbrella established by VICTORY_RESULT_COPY.errorInsufficientBalance,
   *  so the same language travels from save to purchase. */
  disabledHintConnect: "Connect your wallet to continue.",
  disabledHintNetwork: "Switch to Celo to continue.",
  disabledHintBalance: "Add some USD stablecoin to continue.",
  disabledHintUnavailable: "This item is not available right now.",
} as const;

/** Copy for the "Saved" chip rendered on /exercises action row when
 *  the player's local progress matches the last-saved on-chain score
 *  for the active piece (Cluster C addendum §2.2.4). When a receipt
 *  URL is available the chip becomes a tappable link to Celoscan.
 *  The SAVE pin automatically reappears once the player earns more
 *  stars, so the chip communicates "synced — improve to save again". */
export const SAVED_CHIP_COPY = {
  /** Nano label under the pin (check/dot system 2026-06-11). */
  pinLabel: "Saved",
  /** Compact label, e.g. "✓ Saved · 12★". Stars-only (no denominator)
   *  to keep the chip short and avoid the misread "I scored 10/15 and
   *  lost 5". */
  label: (stars: number) => `Saved · ${stars}★`,
  /** Secondary hint shown below or as tooltip — clarifies that the
   *  save action is not gone forever, just gated on a better score. */
  hint: "Beat your score to save again",
  /** Affordance copy when the chip links to a receipt. */
  receiptHint: "Tap to view receipt",
  /** Screen-reader full label. */
  ariaLabel: (stars: number, total: number) =>
    `Score saved: ${stars} of ${total} stars. Beat your score to save again.`,
  /** Aria label when the chip is a link to the on-chain receipt. */
  ariaLabelWithReceipt: (stars: number, total: number) =>
    `Score saved: ${stars} of ${total} stars. Tap to view receipt.`,
} as const;

/** Copy keys for <TxProgressSteps> primitive. Pills variant uses
 *  text-nano uppercase labels (single word per node). Toast variant
 *  uses sentence-case sub-copy for the active step + a step counter
 *  function. Telemetry events live separately in B2 (post-launch
 *  observability sprint). */
export const TX_PROGRESS_COPY = {
  // Pills labels — uppercase, text-nano (8px)
  pillsPrepare: "PREPARE",
  pillsSign: "SIGN",
  pillsSend: "SEND",
  pillsWait: "WAIT",
  pillsVerify: "VERIFY",
  pillsDone: "DONE",
  pillsFailed: "FAILED",

  // Toast / sub-copy labels — sentence case, what the current step is doing
  toastPrepare: "Preparing…",
  toastSign: "Sign in your wallet…",
  toastSend: "Sending transaction…",
  toastWait: "Confirming…",
  toastVerify: "Verifying with server…",
  toastDoneSuccess: "Done",
  toastDoneFailed: "Failed",

  // Toast counter — current of total
  stepCounter: (current: number, total: number) => `Step ${current} of ${total}`,

  // Generic error sub-copy when the surface didn't supply errorMessage
  toastErrorFallback: "Transaction failed. See details.",
} as const;

export const STATUS_STRIP_COPY = {
  walletNotConnected: "Connect your wallet to play",
  networkReady: "Network ready",
  switchNetwork: "Switch to the supported network",
  piecePathComplete: "Piece Path complete",
  piecePathInProgress: "Piece Path in progress",
  badgeClaimed: "Claimed",
  badgeReady: "Ready to claim",
  submittingScore: "Saving score",
  scoreSubmitted: "Score saved",
  claimingBadge: "Claiming badge",
  badgeClaimed2: "Badge claimed",
  processingPurchase: "Processing purchase",
  purchaseComplete: "Purchase complete",
  waitingConfirmation: "Waiting for confirmation.",
  scoreOnchain: "Your score is publicly recorded.",
  badgeOnchain: "Your badge is now confirmed.",
  purchaseOnchain: "Your purchase is now confirmed.",
} as const;

export const ERROR_PAGE_COPY = {
  title: "Something went wrong",
  fallback: "An unexpected error occurred.",
  tryAgain: "Try again",
  boardCrashed: "Oops! Board crashed",
  gameFallback: "Something went wrong loading the game.",
  reloadGame: "Reload game",
} as const;

export const NOT_FOUND_PAGE_COPY = {
  title: "Page not found",
  message: "This path does not exist.",
  backToHub: "Back to Hub",
} as const;

export const CONNECT_BUTTON_COPY = {
  miniPayDetected: "MiniPay detected",
  openInMiniPay: "Open in MiniPay",
} as const;

export const PASSPORT_COPY = {
  verifiedLabel: "Verified",
  infoBanner: "Verify to mark your score",
  ctaLabel: "Verify",
  passportUrl: "https://passport.gitcoin.co",
} as const;

export const MISSION_BRIEFING_COPY = {
  label: "MISSION",
  play: "LET'S GO",
  targetPrefix: "Move to:",
  moveHint: {
    rook: "The Rook moves in straight lines",
    bishop: "The Bishop moves diagonally",
    knight: "The Knight jumps in an L-shape",
    pawn: "The Pawn moves forward, captures diagonally",
    queen: "The Queen moves in any direction",
    king: "The King moves one square at a time",
  },
  captureHint: "Capture the target piece",
  moveObjective: (piece: string, target: string) =>
    `Move your ${piece} to ${target}`,
  pieceHint: {
    rook: "♜ Straight lines",
    bishop: "♝ Diagonal moves",
    knight: "♞ L-shaped jumps",
    pawn: "♟ Forward + diagonal capture",
    queen: "♛ Any direction, any distance",
    king: "♚ One square, any direction",
  },
  captureHintCompact: "♜ Capture the target",
  /** Close affordance ARIA on the mission-briefing modal. */
  closeLabel: "Close",
  /** Mission-panel quick peek pill — short variant of the target prefix
   *  without trailing punctuation so it can interpolate cleanly. */
  visibleMissionTargetFormat: "Move to {target}",
  /** Short label rendered on the mission peek pill when the active
   *  exercise is a capture (vs a position move). */
  captureLabel: "Capture",
  /** Mission band tail for a Special Training level. The band used to read a
   *  bare "4" — the optimal-move count with nothing to say it was a count
   *  (founder, 2026-07-16). A number alone is not information. */
  missionMovesFormat: "{moves} moves",
  /** ARIA labels for the mission peek pill — three variants for the
   *  active mode (labyrinth / capture / standard move). */
  openDetailsLabyrinthAriaFormat: "Open mission details: optimal path {moves} moves",
  openDetailsCaptureAriaLabel: "Open mission details: capture target",
  openDetailsTargetAriaFormat: "Open mission details: target {target}",
} as const;

export const VICTORY_PAGE_COPY = {
  tagline: "Train your mind with short chess challenges. Designed with MiniPay in mind.",
  challengeLine: "Can you beat this?",
  acceptChallenge: "Accept Challenge",
  backToHub: "HUB",
  loading: "Loading victory...",
  errorTitle: "Could not load victory",
  errorFallback: "Something went wrong loading this victory.",
  tryAgain: "Try again",
  metaCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  metaComplete: (moves: number) => `Complete in ${moves} moves`,
  metaChallenge: (id: string) => `Can you beat that? Victory #${id} saved as a Chesscito victory card.`,
  metaFallback: "Can you beat this? Play Chesscito on Celo.",
  metaFallbackTitle: (id: string) => `Victory #${id}`,
} as const;

export const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo",
  44787: "Celo Alfajores",
  11142220: "Celo Sepolia",
} as const;

export const PURCHASE_FIELD_LABELS = {
  item: "Item",
  price: "Price",
  payingWith: "Paying with",
  status: "Status",
  network: "Network",
} as const;

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
} as const;

export const VICTORY_CLAIM_COPY = {
  progressTitle: "Saving...",
  claimButton: "SAVE VICTORY",
  claimHelper: "Save this victory forever and unlock your share card",
  claimValueHint: (price: string) => price,
  teaserLabel: "Unlock when you save",
  teaserCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  teaserShare: "SHARE",
  claimingInProgress: "Saving in progress...",
  claiming: "Saving your victory...",
  claimProgress1: "Recording your result",
  claimProgress2: "Preparing your victory card",
  successTitle: "Victory Saved",
  successSubtitle: "Your victory is saved. Your share card is ready.",
  errorTitle: "Couldn't save your victory",
  errorSubtitle: "Something went wrong while saving your result.",
  /** Insufficient-balance specific subtitle. Surfaced when the mint
   *  flow throws a "No token with sufficient balance" error (see
   *  use-mint-victory.ts). "USD stablecoin" umbrellas USDC / USDT /
   *  USDm without enumerating them and works for both MiniPay
   *  (no CELO surface) and web wallets. */
  errorInsufficientBalance: "Add some USD stablecoin to save your victory.",
  tryAgain: "Try again",
  shareCard: "Share Card",
  challengeFriend: "Challenge a Friend",
  challengeText: (moves: number, url: string) =>
    `I solved this in ${moves} moves. Can you beat me?\nPlay Chesscito on Celo 👉 ${url}`,
  copyLink: "Copy Link",
  copiedToast: "Copied!",
  sharedToast: "Shared!",
  viewTrophies: "TROPHIES",
  card: {
    headline: "CHECKMATE",
    challengeLine: "Can you beat this?",
    performanceLine: (moves: number, time: string) => `${moves} MOVES • ${time}`,
    byLine: (player: string) => `by ${player}`,
    brand: "Chesscito",
  },
  // --- Secondary Screen Cohesion (2026-03-28) ---
  progressSteps: ["Signing", "Confirming", "Done"] as const,
  progressTimeHint: "This usually takes a few seconds",
  claimedBadge: "Victory Saved",
  errorRecoveryHint: "Your progress is safe. Tap try again any time.",
  /** Per-kind copy for the recoverable end states the claim flow can
   *  land in. The default "error" branch matches the historical
   *  errorTitle/errorSubtitle/errorRecoveryHint values so existing
   *  surfaces stay visually identical. */
  errorKindCopy: {
    error: {
      title: "Couldn't save your victory",
      subtitle: "",
      hint: "Your progress is safe. Tap try again any time.",
    },
    timeout: {
      title: "Still confirming…",
      subtitle: "The network is taking longer than usual. Your wallet may already have the transaction.",
      hint: "Check your wallet first. If it's still pending, give it a moment before retrying.",
    },
  },
  /** Transient toast raised over the untouched victory screen when the player
   *  rejects the wallet prompt. The whole trace of a cancellation. */
  cancelledToast: "Not saved yet",
  /** Big headline rendered inside the victory-claim-error panel —
   *  branches on the `kind` prop. */
  statusHeadlineError: "Error",
  statusHeadlineTimeout: "Hang tight",
  /** Secondary action label on the victory-claim-success panel. */
  reviewMatchCta: "Review Match",
} as const;

export const VICTORY_CELEBRATION_COPY = {
  title: "Victory",
  /** Emotion headline shown big and first, BEFORE the stats line.
   *  Games are felt before they're counted — lead with the word the
   *  player came to hear. */
  headlineCheckmate: "Checkmate!",
  headlineWin: "Victory!",
  performanceLine: (moves: number, time: string) =>
    `Solved in ${moves} moves · ${time}`,
  performanceLineCheckmate: (moves: number, time: string) =>
    `Checkmate in ${moves} moves · ${time}`,
  shareTextBasic: (moves: number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nPlay Chesscito on Celo 👉 ${url}`,
  shareTextClaimed: (moves: number, tokenId: bigint | number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nI saved my Chesscito victory card #${tokenId} 👉 ${url}`,
  stats: { difficulty: "level", moves: "moves", time: "time" },
  primaryLabel: "Save Victory",
  coachPillFree: "See key moments",
  coachPillPro: "Open coach insight",
  /** M1 funnel (Commit 4) — Coach Review CTA label for the win popup
   *  (pre-mint celebration + post-mint claim success). Frames the
   *  invitation as curiosity about success, not "ask coach" boilerplate.
   *  Replaces coachPillFree / coachPillPro at the call site. Both legacy
   *  strings remain in editorial for now in case future surfaces still
   *  consume them. */
  winCoachReviewCta: "Why did you win?",
  playAgainShort: "Play again",
  shareShort: "Share",
  saveSectionKicker: "SAVE THIS WIN",
  saveSectionHeadline: "Yours forever.",
  saveSectionBody: "A digital trophy of this match, yours for life.",
} as const;

export const TROPHY_VITRINE_COPY = {
  pageTitle: "Trophies",
  pageDescription: "Your saved victories.",
  myVictories: "My Victories",
  hallOfFame: "Hall of Fame",
  movesLabel: "moves",
  shareLabel: "Share",
  loadingText: "Loading trophies...",
  copiedToast: "Link copied!",
  connectWallet: "Connect to view your trophies",
  connectWalletButton: "Connect Wallet",
  noVictories: "No victories yet",
  /** Narrative empty-state banner shown above the "no victories" frame
   *  when the user is connected but hasn't minted any victory yet. Sells
   *  the long-term value of the collectible without using jargon. */
  firstVictoryHeadline: "Every victory, yours forever.",
  firstVictorySub: "Win a match and earn a digital collectible. Yours for life.",
  /** HERO BAND labels — overview anchor at the top of the sheet. */
  heroEyebrow: "YOUR VITRINE",
  heroVictoriesLabel: "VICTORIES",
  heroAchievementsLabel: "ACHIEVEMENTS",
  heroBestLabelFormat: "Your best: {moves} moves · {time}",
  heroEmptyHint: "Your first victory awaits.",
  /** Lite-mode hero band overrides — training/focus vocabulary. */
  heroEyebrowLite: "YOUR PROGRESS",
  heroVictoriesLabelLite: "SESSIONS",
  heroEmptyHintLite: "Complete daily focus sessions to build your progress.",
  noGlobalVictories: "No victories recorded yet",
  loadError: "Could not load victories",
  tapToRetry: "Tap to retry",
  configError: "Trophies are offline",
  roadmap: "Coming later: Tournaments • VIP Passes • Seasonal Rewards",
  arenaLink: "ARENA",
  practiceLink: "PRACTICE PIECES",
  pageDescriptionLite: "Your training progress.",
  firstVictoryHeadlineLite: "Play and improve your pieces.",
  firstVictorySubLite: "Practice the chess pieces and track your training progress here.",
  hallOfFameLite: "Community",
  /** Save Later secondary affordance (2026-05-31) — appears beneath the
   *  Arena CTA in the empty trophies state ONLY when the user has at
   *  least one match in their Coach history. A brand-new user (0 matches)
   *  would dead-end if sent to history, so it's gated on
   *  useCoachHistoryCount > 0. Phrased as a soft alternative ("Or…")
   *  to not compete with the primary Arena push. */
  saveLaterFromHistoryLink: "Or save a past victory →",
  cardIdPrefix: "Victory",
  backLabel: "Back",
  verifiableVictoryHeadline: "Verifiable Victory",
  movesStatLabel: "Moves",
  timeStatLabel: "Time",
  playerStatLabel: "Player",
  historyHeading: "History",
  /** Close affordance for the trophies bottom-sheet variant. */
  closeSheetLabel: "Close trophies",
} as const;

/** Achievement surface copy (feature #23). Achievements are derived from
 *  existing on-chain Victory NFT data — no new contracts. Keep titles
 *  short (2–3 words) and descriptions under 60 chars. */
export const ACHIEVEMENTS_COPY = {
  sectionTitle: "Achievements",
  sectionDescription: (earned: number, total: number) => `${earned} of ${total} unlocked`,
  emptyHint: "Win in Arena to unlock achievements",
  /** Lite mode — replaces Arena reference with focus/exercise vocabulary. */
  emptyHintLite: "Complete focus challenges to unlock achievements.",
  lockedLabel: "Locked",
  earnedLabel: "Earned",
  progressLabel: (current: number, goal: number) => `${current}/${goal}`,
  /** Section header label for the earned-trophies group. The count is
   *  appended at the call site so editorial stays content-only. */
  sectionEarned: "Earned",
  /** Section header label for the locked group. */
  sectionLocked: "Locked",
  /** Detail-sheet copy — opened on tile tap from AchievementsGrid. */
  detailEarnedSubtitle: "Achievement unlocked",
  detailLockedSubtitle: "How to unlock",
  /** Goal callout under the progress bar in the detail sheet. */
  goalLabel: "Goal",
  detailCloseLabel: "Close",
  progressEyebrow: "PROGRESS",
  itemsLabel: "ITEMS",
  closeAchievementLabel: "Close achievement",
  items: {
    "first-victory": {
      title: "First Victory",
      description: "Win your first Arena match.",
    },
    "arena-champion-medium": {
      title: "Solid Player",
      description: "Beat the AI on Medium or Hard.",
    },
    "arena-champion-hard": {
      title: "Arena Champion",
      description: "Beat the AI on Hard.",
    },
    speedrunner: {
      title: "Speedrunner",
      description: "Win a match in 20 moves or fewer.",
    },
    "rapid-finish": {
      title: "Rapid Finish",
      description: "Win a match in under 30 seconds.",
    },
    "five-crowns": {
      title: "Five Crowns",
      description: "Win 5 Arena matches.",
    },
    dedication: {
      title: "Dedication",
      description: "Win 25 Arena matches.",
    },
    "first-focus-day": {
      title: "First Focus Day",
      description: "Complete your first Daily Focus.",
    },
    "first-great-session": {
      title: "First Great Session",
      description: "Earn 8 stars in one day, or finish your daily quota.",
    },
    "three-day-rhythm": {
      title: "3-Day Rhythm",
      description: "Keep your focus streak for 3 days.",
    },
    "seven-day-focus": {
      title: "7-Day Focus",
      description: "Complete a 7-day focus streak.",
    },
  },
} as const;

export const PLAY_BADGES_COPY = {
  pageTitle: "Arena Badges",
  pageDescription: "Achievements earned from your ranked victories.",
  closeSheetLabel: "Close badges",
} as const;

export const PLAY_LEADERS_COPY = {
  pageTitle: "Hall of Fame",
  pageDescription: "Top players by minted victories.",
  closeSheetLabel: "Close leaders",
  emptyMessage: "No victories minted yet. Be the first champion.",
  loadError: "Couldn't load the Hall of Fame. Try again.",
  retry: "Retry",
} as const;

/** Roadmap surface (feature #23). Non-speculative — explicitly "soon". */
export const ROADMAP_COPY = {
  sectionTitle: "Coming later",
  sectionDescription: "What's coming to Chesscito.",
  soonTag: "Soon",
  items: [
    {
      title: "Tournaments",
      description: "Scheduled brackets with community formats.",
    },
    {
      title: "Community Events",
      description: "Consistent players may qualify for community events and prizes.",
    },
    {
      title: "Seasonal Rewards",
      description: "Rotating challenges with unique verifiable collectibles.",
    },
  ],
} as const;

export const ARENA_COPY = {
  title: "Arena",
  subtitle: "Choose your level. Rule the board.",
  difficulty: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },
  /** Rival taglines (2026-06-15) — de-AI'd: the opponent is a named
   *  rival persona, never "the AI". See lib/game/rivals.ts. */
  difficultyDesc: {
    easy: "Friendly rival, learns with you",
    medium: "Calm rival, finds solid moves",
    hard: "Sharp rival, plays to win",
  },
  /** Selector section header (image #7) above the rival cards. */
  chooseRivalHeader: "Choose your rival",
  startMatch: "PLAY",
  backToHub: "HUB",
  backToHubAria: "Back to Hub",
  /** ARIA label for the in-match HUD back chip. NOT "Back to Hub" (2026-07-13):
   *  leaving a match lands on the rival selector (`/arena?fresh=1`), not the
   *  hub, so the chip is named for its ACTION. Same honesty rule as
   *  `closeResultAria` below. `backToHubAria` stays reserved for the surfaces
   *  that really do go to the hub (selector scaffold, entry panel, end-state
   *  overlay close). */
  leaveMatchAria: "Leave match",
  /** ARIA label for the end-state popup close (X). NOT "Back to Hub": the
   *  destination is state-dependent (evaluateXClose routes to the Arena
   *  selector, Coach viewer, or Training Journal, never /hub), so the label
   *  must describe the affordance honestly. UX audit Minor 2026-06-14. */
  closeResultAria: "Close",
  // Quit + resign confirmation modals (2026-06-15) — replace the inline
  // 3s-countdown affordances with clear VictoryPopupShell modals.
  quitModalTitle: "Leave the match?",
  quitModalBody: "Your progress in this match will be lost.",
  quitModalConfirm: "Leave",
  quitModalCancel: "Keep playing",
  resignModalTitle: "Resign this match?",
  resignModalBody: "This counts as a loss.",
  resignModalConfirm: "Resign",
  resignModalCancel: "Keep playing",
  confirmModalCloseAria: "Close",
  playAsWhite: "Play as White",
  playAsBlack: "Play as Black",
  resign: "Resign",
  resignConfirm: "Tap again to confirm",
  undo: "Undo",
  yourTurn: "Your Turn",
  newGame: "New Game",
  aiThinking: "AI is thinking…",
  preparingAi: "Preparing AI…",
  /** Matchup transition (PLAY → board). Anchored above the pawn divider
   *  baked into the background art. */
  getReady: "Get ready!",
  /** Primary label on the player's ribbon; the deterministic nickname
   *  renders underneath it. */
  you: "You",
  promotionTitle: "Promote pawn to:",
  endState: {
    checkmate: {
      win: "Checkmate. You Win!",
      lose: "Checkmate. AI Wins",
    },
    stalemate: "Stalemate. Draw",
    draw: "Draw",
    resigned: "You resigned",
  },
  playAgain: "PLAY",
  /** M1 funnel — endgame loss/resign popup (Commit 2, 2026-06-01).
   *  Reorders CTAs so Coach Review is primary and Play Again is secondary.
   *  These two strings replace the `playAgain` label + reintroduce a
   *  short emotional subtitle (Sally dropped the previous redundant
   *  subtitle in 2026-05-26 — this one frames learning, not retry). */
  lossPlayAgainCta: "Try again.",
  lossSubtitle: "Each match teaches something.",
  /** F8 phase (b) — Save (on-chain collectible) on loss/draw/resign popups.
   *  Neutral label per the founder branding split: win keeps "Save Victory"
   *  (VICTORY_CELEBRATION_COPY), every other outcome reads "Save match".
   *  Driven by `saveCtaLabelKey(result)` → the `saveMatch` key. */
  saveMatch: "Save match",
  saveMatchAriaLabel: "Save match for {price}",
  /** Inline save (mint) lifecycle on the loss/draw/resign popup — busy label
   *  reuses COACH_ENTRY_COPY.savingMatch; these cover the error row. Names the
   *  collectible so this failure reads distinctly from the off-chain
   *  "Match not saved" persist error (UX audit Minor 2026-06-14). */
  saveError: "Couldn't save your collectible",
  saveRetry: "Retry",
  /** T4 reassurance — the match record is kept regardless of the mint
   *  outcome, so a failed Save never loses the game. */
  saveErrorHint: "Your progress is safe.",
  /** Post-success confirmation label. Once a save lands, the Save tile becomes
   *  a disabled "Saved" state instead of re-arming — avoids the 30s contract
   *  mintCooldown that an immediate re-tap would revert on. */
  saved: "Saved",
  /** Soft-gate banner shown only on direct /arena entry when the player
   *  has no recorded piece-path progress. Intent: guide rookies into the
   *  tutorial without gatekeeping. Two decisive CTAs replace the old
   *  question + Skip pattern: games don't ask permission to exist. */
  softGateModalTitle: "Warm up",
  softGateTitle: "Want a warm-up first?",
  softGateBody: "Learn a piece in under 2 minutes, then challenge the AI.",
  softGateLearn: "PIECES",
  softGateEnter: "ARENA",
  aiError: "AI disconnected",
  aiTimeout: "AI timed out",
  engineError: "Engine error. Please restart the match.",
  restartMatch: "Restart",
  boardError: "Board error. Please restart the game.",
  coachSignal: {
    inactiveTitle: "REVIEW",
    inactiveBody: "Unlock full review after playing",
    inactiveCta: "COACH",
    activeTitle: "REVIEW",
    activeBody: "Review after checkmate",
  },
  coachPreview: {
    emptyTitle: "No moves to review",
    emptyBody: "Make at least one move before asking Coach.",
    inactiveTitle: "Coach Preview",
    insight: (difficulty: string, result: string, moves: number) => {
      const outcome = result === "win"
        ? "your win"
        : result === "draw"
          ? "the draw"
          : result === "resigned"
            ? "the resignation"
            : "the loss";
      return `You finished a ${difficulty} match in ${moves} moves. Coach found key moments behind ${outcome}.`;
    },
    lockedBenefits: ["Key moments", "Better moves", "Next training"] as const,
    inactiveCta: "PRO REVIEW",
    activeTitle: "REVIEW",
    activeBody: "Review your key moments and next training step.",
    activeCta: "REVIEW",
    /** Visible kicker above the title in <CoachPreviewCard />. Stays
     *  literal across locales — "Coach Review" is the product feature
     *  name, not body copy. Mirrored here so the editorial namespace
     *  owns every string the card paints. */
    cardKicker: "Coach Review",
    cardChipsAriaLabel: "Full review includes",
  },
  /** <CoachReviewSignal /> — small pill in the action bar that promotes
   *  the post-match Coach review. */
  coachSignalAriaLabel: "Coach Review",
  coachSignalTokenPro: "PRO",
  coachSignalTokenFree: "Coach",
  /** ARIA labels for the confirm-flow micro-interactions on the back
   *  chip (arena-hud) and the resign button (arena-action-bar). */
  confirmQuitAriaLabel: "Confirm quit",
  confirmQuitLabel: "QUIT?",
  confirmResignLabel: "Confirm?",
  /** ICU placeholder filled with the formatted mm:ss timer. */
  timerAriaLabel: "Elapsed time: {time}",
  /** <PromotionOverlay /> dismiss affordance. */
  promotionCancelAriaLabel: "Cancel promotion",
  /** Color picker on the entry panels — both ArenaEntryPanel + the
   *  scaffold variant share the same group label. */
  colorPickerAriaLabel: "Choose your color",
  /** <ArenaSelectScaffold /> additional region labels. */
  softGateRegionLabel: "Warm-up gate",
  /** Scaffold page-level aria — composed at the call site:
   *  `Chesscito {title}`. */
  scaffoldPageAriaFormat: "Chesscito {title}",
  /** Color toggle in the scaffold — composed inline as "Play as"
   *  + variant name. Two strings instead of one ICU so the bold/regular
   *  weight split survives the migration. */
  playAsPrefix: "Play as",
  playAsWhiteName: "White",
  playAsBlackName: "Black",
  /** Gameplay HUD matchup label for the local player (2026-06-15). */
  youLabel: "You",
  /** Non-win end-state overlay (loss/draw/resigned/stalemate) header. */
  matchEndedLabel: "Another round?",
  matchEndedHint: "Try again when ready.",
} as const;

export const EXERCISE_DRAWER_COPY = {
  title: "Exercises",
  progressLabel: (earned: number, max: number) => `${earned}/${max}`,
  badgeThresholdHint: (count: number) => `Badge at ${count} exercises`,
  claimBadgeCta: "Claim Badge",
  locked: "Locked",
  ariaLabel: "Exercises",
  closeAriaLabel: "Close exercises",
  exerciseFallbackFormat: "Exercise {n}",
  captureLabel: "Capture",
  movementLabel: "Movement",
  starsEarnedAriaFormat: "{total} of {max} stars earned",
} as const;

export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  "rook-1": "Horizontal move",
  "rook-2": "Vertical move",
  "rook-3": "Center to edge",
  "rook-4": "Corner capture",
  "rook-5": "Cross capture",
  "rook-6": "Around the wall",
  "rook-7": "Sidestep the file",
  "rook-8": "Boxed-in square",
  "rook-9": "Capture detour",
  "rook-10": "The long way up",
  "bishop-1": "The diagonal move",
  "bishop-2": "The other diagonal",
  "bishop-3": "Pick the diagonal",
  "bishop-4": "The bishop is not a rook",
  "bishop-5": "Choose the turn",
  "bishop-6": "Your own piece blocks the turn",
  "bishop-7": "Both turns blocked",
  "bishop-8": "Blocked on the long diagonal",
  "bishop-10": "The long way around",
  "knight-1": "L-jump center",
  "knight-2": "L-jump corner",
  "knight-3": "Horizontal L",
  "knight-4": "Two jumps",
  "knight-5": "Long journey",
  "knight-6": "Long L to the flank",
  "knight-7": "Edge to edge",
  "knight-8": "Hop the cluster",
  "knight-9": "L-route capture",
  "knight-10": "Five-jump journey",
  "pawn-1": "Forward step",
  "pawn-2": "Forward march",
  "pawn-3": "Diagonal capture",
  "pawn-4": "Capture decision",
  "pawn-5": "Mixed path",
  "pawn-6": "March to the last rank",
  "pawn-7": "Capture around the block",
  "pawn-8": "Capture zigzag",
  "pawn-9": "Step and capture",
  "pawn-10": "Reach the last rank",
  "queen-1": "Long diagonal",
  "queen-2": "Vertical file",
  "queen-3": "Short diagonal",
  "queen-4": "Horizontal rank",
  "queen-5": "Two-move path",
  "queen-6": "Combine to slip past",
  "queen-7": "Blocked rank loop",
  "queen-8": "Diagonal then straight",
  "queen-9": "Rank corridor detour",
  "queen-10": "Back-rank capture",
  "king-1": "One-square move",
  "king-2": "Diagonal step",
  "king-3": "Edge walk",
  "king-4": "Capture step",
  "king-5": "Corner shelter",
  "king-6": "Long diagonal march",
  "king-7": "Sidestep the obstacle",
  "king-8": "Read the blocked diagonal",
  "king-9": "Antidiagonal march",
  "king-10": "Wall of obstacles",
};

export const PRACTICE_COPY = {
  label: "Practice mode",
} as const;

/** L2 Labyrinth — second level of per-piece pedagogy ladder.
 *  Unlocked after L1 mastery (badge claimable). Player navigates
 *  obstacles to reach the star in minimum moves. */
/**
 * Diagonal Run copy (Special Training). Level titles/prompts keyed by id for
 * COPY only (never behaviour), plus the shared turn-state band strings the game
 * board renders. Mirrored in messages/es.ts. Design: docs/audits/2026-07-15-bishop-d1-*.
 */
export const DIAGONAL_RUN_COPY = {
  title: {
    "bishop-run-1": "First Pivot",
    "bishop-run-2": "Turn to the Star",
    "bishop-run-3": "The Long Run",
  },
  prompt: {
    "bishop-run-1": "Tap a pivot square; the bishop turns there toward the star.",
    "bishop-run-2": "Pick the pivot whose turn reaches the star.",
    "bishop-run-3": "Choose your pivots to run the bishop up to the star.",
  },
  /** Turn-state band strings, shared across levels. */
  band: {
    tapBishop: "Tap the bishop to begin.",
    tapBishopFirst: "Tap your bishop first.",
    choose: "Choose a pivot square.",
    sliding: "Sliding…",
    illegal: "The bishop cannot move there.",
    lost: "This path cannot reach the star. Try again.",
    won: "You found the way!",
  },
} as const;

export const KNIGHT_TOUR_COPY = {
  title: {
    "knight-tour-1": "The Short Tour",
    "knight-tour-2": "Wider Ground",
    "knight-tour-3": "The Long Tour",
  },
  prompt: {
    "knight-tour-1":
      "Every square you leave is closed behind you. Cover as much as you can.",
    "knight-tour-2": "More room, same rule. Do not strand yourself in a corner.",
    "knight-tour-3":
      "Save the hard squares for early. The edges run out of exits first.",
  },
  /** Turn-state band strings, shared across levels. The band also carries the
   *  live count, which the board appends — the spec asks for the 80% line to be
   *  visible while playing, not only once the run is over. */
  /** Mission chip. A tour has no destination square and is not measured in
   *  moves, so the chip states the bar instead of counting anything. */
  chip: {
    goal: "Cover 80%",
  },
  band: {
    tapKnight: "Tap the knight to begin.",
    tapKnightFirst: "Tap your knight first.",
    choose: "Jump to a square you have not used.",
    illegal: "The knight cannot jump there.",
    done: "No jumps left.",
  },
} as const;

export const QUEENS_COPY = {
  title: {
    "queens-1": "The Quiet Room",
    "queens-2": "Wider Court",
    "queens-3": "Nine on Eight",
  },
  prompt: {
    "queens-1": "No queen may see another. Fill the room.",
    "queens-2":
      "More room, same rule. Every queen you place closes lines for the next.",
    "queens-3":
      "A block cuts a queen's line. Two of them fit a ninth queen on a board that holds eight.",
  },
  /** Mission chip — a COUNTER, per spec §2. It carries the running total AND
   *  the ceiling, which is what frees the band strip to say the objective in
   *  words; when the count lived in the band, the sentence got truncated away
   *  and a stuck player had nothing to read (founder, 2026-07-16).
   *
   *  No "Move to" frame around it: this game has nowhere to move to. */
  chip: {
    count: "queen {placed}/{ceiling}",
  },
  band: {
    /** The mission, in the player's own words (founder, 2026-07-16). "Attack" is
     *  the chess idea being taught; "see her" was a metaphor sitting in front of
     *  it. Deliberately NOT "no two on a line" — a block CUTS a line, which is
     *  exactly what queens-3 turns on, and that phrasing would make the level
     *  that teaches it look like a bug. */
    choose: "Place queens so none attack each other.",
    /** The rejection has to TEACH — the board flashes what is watched while
     *  this reads. Never a penalty, per spec §2. */
    illegal: "That square is watched by a queen.",
    /** A block is scenery, not a chess rule — saying "a queen watches it" would
     *  be a lie, and the player would go hunting for the queen. */
    blocked: "That square is a wall.",
    done: "No safe squares left.",
  },
} as const;

/** Safe Path — the king's signature game (kind:"safe-path").
 *
 *  ⚠️ NOTHING here may name a watched square, list one, or hint at where the
 *  danger is. The watched squares are invisible BY DESIGN (plan D2): they are a
 *  deduction from the enemy pieces the player can see, and reading them is the
 *  skill. Copy that says "watch out for d4" hands over the answer the board
 *  deliberately withholds. Say the RULE, never the position. */
export const SAFE_PATH_COPY = {
  title: {
    "king-safe-1": "The Knight Sees",
    "king-safe-2": "Two Watchers",
    "king-safe-3": "The Long Eye",
  },
  prompt: {
    "king-safe-1": "The knight is not in your way. The squares it watches are.",
    "king-safe-2": "Two knights, two zones. Find the gap between them.",
    "king-safe-3": "The bishop watches a whole diagonal, not a square.",
  },
  /** Mission chip — a move COUNTER against the optimal, like the labyrinth's.
   *  Arrival-graded: LOWER IS BETTER, the opposite of the coverage games. */
  chip: {
    count: "move {moves}/{optimal}",
  },
  band: {
    /** The mission. States the king's rule, not the board's secret. */
    walk: "Reach the refuge without stepping where the enemy watches.",
    /** He walked in and was seen. The board is already naming the killer in
     *  orange; this says what happened, not where to have gone. */
    caught: "Caught. That square was watched.",
    done: "Safe.",
  },
} as const;

export const PROMOTION_RUN_COPY = {
  title: {
    "pawn-promotion-1": "No Way Around",
    "pawn-promotion-2": "Pay for Every File",
    "pawn-promotion-3": "Not Every Meal Is Free",
  },
  prompt: {
    "pawn-promotion-1":
      "The wall blocks your file. The rook is not in your way: it is the way.",
    "pawn-promotion-2":
      "Two walls, two rooks. You will change file twice, and each one has a price.",
    "pawn-promotion-3":
      "Two rooks to eat, and only one of them is dinner. The knight is watching.",
  },
  /** Mission chip — a live PROGRESS counter, not a grade. `optimal` is always
   *  `7 - startRank`, so "2/6" means "two moves into a six-move run", and the
   *  6 is not a target to beat: it cannot be beaten or missed. The stars come
   *  from `promotionRunStars` (failures), never from this. */
  chip: {
    count: "move {moves}/{optimal}",
  },
  band: {
    /** The mission states the pawn's rule, because the rule IS the puzzle: a
     *  pawn cannot change file without capturing, so the enemies on the
     *  diagonals are not in the way — they are the steps. */
    walk: "Reach the last rank. The only way to change file is to capture.",
    /** Same wording as Safe Path's on purpose: it is the same lesson, and the
     *  king taught it first. */
    caught: "Caught. That square was watched.",
    done: "Promoted!",
  },
  /** The promotion picker (P3/P5 — auto-queen is dead so this choice exists).
   *
   *  ⚠️ Reframes P4, which said promotion teaches the VALUE CHAIN (queen 9,
   *  rook 5, …). Founder, 2026-07-16: the player does not know how to play a
   *  knight yet, so "crown a knight and you mate" teaches nothing — it teaches
   *  obedience. What promotion teaches at THIS stage is that it SUMMONS a piece
   *  of your choosing. The numbers come back when there is a level that earns
   *  them. */
  picker: {
    title: "Your pawn reached the edge",
    /** The mission, stated plainly. The founder's condition for failing a wrong
     *  pick at all: "siempre y cuando en el modal se le muestre de manera clara
     *  cuál es la misión". A choice you were never told is a gotcha. */
    mission: "Summon a {piece} onto the board.",
    /** Named for what it is. "Promote" is the chess word; "summon" is what a
     *  player who has never promoted actually sees happen. */
    hint: "A pawn that crosses the board becomes any piece you choose.",
  },
} as const;

export const LABYRINTH_COPY = {
  toggleExercises: "Exercises",
  toggleLabyrinths: "Labyrinths",
  /** Single exit pill shown while the labyrinth layer is active —
   *  replaced the EXERCISES/LABYRINTHS toggle in Slice 3C. */
  backToExercises: "Back to exercises",
  tryLabyrinth: "Try Labyrinth",
  /** Demoted text-link variant of tryLabyrinth — used when the action
   *  is offered alongside more important CTAs (e.g. PieceComplete) and
   *  needs to read as an alternative branch, not a competing primary. */
  orTryLabyrinth: "or try Labyrinth →",
  missionTitle: "Labyrinth",
  missionHint: (optimal: number) => `Reach the star · optimal ${optimal} moves`,
  movesLabel: (n: number) => `${n} ${n === 1 ? "move" : "moves"}`,
  completeTitle: "Training Complete!",
  completeStars: (stars: number) => `${stars}/3 ★`,
  completeMoves: (moves: number, optimal: number) =>
    moves === optimal
      ? `Optimal! ${moves} moves`
      : `${moves} moves · optimal ${optimal}`,
  completeMovesOptimalFormat: "Optimal! {moves} moves",
  completeMovesFormat: "{moves} moves · optimal {optimal}",
  perfectPath: "★ Perfect path",
  newBestFormat: "New best! Beat {previous} → {current}",
  firstCompletionFormat: "First completion · {moves} moves",
  yourBestFormat: "Your best: {previous} moves",
  retry: "Try again",
  back: "Back to Exercises",
  /** QA F3 (2026-06-11): primary CTA on the solved overlay. Continue
   *  exits the labyrinth and lands on the next pending exercise; the
   *  shell X shares the same intent so closing never strands the
   *  player inside the lab. */
  continue: "Continue",
  /** QA F2 (2026-06-11): muted exit pin in the contextual action row
   *  while the labyrinth layer is on. Replaces the full-width BACK TO
   *  EXERCISES band, which visually resurrected the retired tab strip. */
  exitLabyrinth: "Exit Training",
  /** Primary CTA shown when the user completes a labyrinth that closes the
   *  full training cascade — i.e. the labyrinth belongs to the final piece
   *  (King). Replaces "Try again" because at that point the natural next
   *  step is to enter Arena, not grind another lap. */
  enterArena: "Enter Arena",
  /** ARIA label for the L1/L2 layer toggle tablist on mission panel. */
  layerToggleAriaLabel: "Layer toggle",
} as const;

/**
 * The consequence line on the completion overlays (Paso 1 of the progress
 * visibility brief). One line, below the move narrative, above the buttons.
 * Shared by BOTH overlays: the labyrinth one and the exercise one. The rung
 * comes from `resolveConsequence`; this is only how it is said.
 *
 * ⛔ Every line NAMES ITS PRIZE. "3 of 4" alone is a number the player has no
 * reason to care about; "3 of 4, the crown is at the end" is a reason to come
 * back. Exercises pay the badge, challenges pay the crown, and a line that
 * names neither is the line nobody reads.
 *
 * ⛔ None of these may read as a dead end. "You finished everything" is the
 * highest-risk state in the product (it is the shape of the bug fixed
 * 2026-08-07), so `mastery` and `laneComplete` both point somewhere.
 *
 * ⚠️ `badgeReady` names the hub because the overlay deliberately has NO claim
 * button: claiming is a wallet transaction, and a failed one would turn the
 * celebration into an error (OQ-1, closed NO). The text has to carry the whole
 * hand-off on its own.
 */
export const CONSEQUENCE_COPY = {
  /** The crown. Achieved, never "within reach". */
  mastery: "Crown earned · pick your next piece",
  /* ⛔ No `badgeReady` line, deliberately. Crossing the completion gate already
     opens the `piece-badge-eligible` milestone modal on the same trigger, and
     that one has the Claim button. A line here said the same thing a beat
     earlier with nothing to tap. Deleted rather than left unused: an orphan
     string is what `badgeLockedFormat` ("Badge at {stars}★") had turned into —
     zero consumers, still quoting a gate the game dropped. That one is gone
     too now (2026-08-08); this comment is the reason it was found. */
  /** Does NOT promise where Continue goes: it lands on a pending exercise
   *  first when there is one, so "Continue takes you there" would be a lie
   *  about half the time. */
  challengeUnlocked: "New challenge unlocked · it is on your path now",
  /** Counted against the badge GATE, never the pool size. */
  badgeProgress: "{done} of {required} toward your badge",
  laneProgress: "{done} of {total} challenges · the crown is at the end",
  /** The lane finished but the crown did not land, which can only mean the
   *  badge is still unclaimed. Says exactly what is missing. */
  laneComplete: "Every challenge cleared · your badge is waiting in Exercises",
} as const;

export const DOCK_LABELS = {
  /** v1 5-slot taxonomy (SPEC 1 D7). The dock is destination-shaped
   *  not action-shaped: each slot is a route or hub sheet. */
  home: "Home",
  pieces: "Pieces",
  shop: "Shop",
  board: "Board",
  settings: "Settings",
  /** Legacy labels still referenced by destination sheets (leaderboard-
   *  sheet, trophies-sheet) for their own aria-labels. Kept as exports
   *  rather than inlined to preserve editorial as the single source. */
  arena: "Arena",
  badge: "Badges",
  trophies: "Trophies",
  leaderboard: "Leaders",
  /** ARIA label for the persistent dock <nav> landmark. */
  navAriaLabel: "Game navigation",
} as const;

export const ARENA_CTA_COPY = {
  label: "ARENA",
} as const;

export const ABOUT_LINK_COPY = {
  label: "About Chesscito",
} as const;

export const SPLASH_COPY = {
  loading: "Loading…",
  subtitle: "Setting up the board",
} as const;

/** Hub V2 onboarding splash (Splash A per design-lock §2.1).
 *  First-visit only; never re-shown after dismiss. WCAG 2.2.1 compliant
 *  (no auto-dismiss timer; tap-anywhere or Enter/Space dismiss). */
export const HUB_V2_SPLASH_COPY = {
  title: "Welcome, friend",
  tagline: "Small plays. Big mental habits.",
  dismissHint: "Tap anywhere to begin",
  ariaLabel: "Welcome screen",
  ariaTitleId: "splash-title",
} as const;

/** Hub V2 mastery dashboard (Dashboard D per design-lock §1.3 + §2.2).
 *  Per-piece copy for the 6-tile 2x3 grid plus section header strings.
 *  ariaLabel is state-aware; current/total only consulted for "in-progress". */
type HubV2MasteryState =
  | "mastered"
  | "in-progress"
  | "locked-buildable"
  | "coming-soon";

function buildHubV2MasteryPieceCopy(label: string) {
  return {
    label,
    subLocked: "Master to unlock",
    subInProgress: (current: number, total: number) => `${current}/${total}`,
    subMastered: "★★★",
    subComingSoon: "Coming soon",
    ariaLabel: (
      state: HubV2MasteryState,
      current?: number,
      total?: number,
    ): string => {
      if (state === "mastered") return `${label} mastered, three stars`;
      if (state === "in-progress")
        return `${label} in progress, ${current ?? 0} of ${total ?? 0} stars`;
      if (state === "locked-buildable")
        return `${label}: start practicing to earn stars`;
      return `${label}: coming soon`;
    },
  } as const;
}

export const HUB_V2_MASTERY_COPY = {
  rook: buildHubV2MasteryPieceCopy("Rook"),
  bishop: buildHubV2MasteryPieceCopy("Bishop"),
  knight: buildHubV2MasteryPieceCopy("Knight"),
  pawn: buildHubV2MasteryPieceCopy("Pawn"),
  queen: buildHubV2MasteryPieceCopy("Queen"),
  king: buildHubV2MasteryPieceCopy("King"),
  streakLabel: (days: number): string =>
    days === 0 ? "" : days === 1 ? "1-day streak" : `${days}-day streak`,
  masteryDashboardAriaLabel: "Piece masteries",
} as const;

/** Hub V2 Training Pass band (design-lock §1.5 + §2.3).
 *  Active state replaces V1's `<PremiumSlot>` strings; inactive state
 *  surfaces the upgrade pitch. Atmosphere shift trigger lives in the
 *  hub scaffold's purchase-success handler; the band only emits
 *  `hub_v2_training_band_tap` per design-lock §5. */
export const HUB_V2_TRAINING_COPY = {
  active: {
    kicker: "Training Pass",
    daysFormat: (d: number): string => `${d}d`,
    sessionsFormat: (used: number, total: number): string =>
      `Sessions: ${used}/${total}`,
    renewsFormat: (mmdd: string): string => `Renews ${mmdd}`,
    ariaLabel: (d: number, used: number, total: number): string =>
      `Training Pass active, ${d} days remaining, ${used} of ${total} sessions used`,
  },
  inactive: {
    /** M1 funnel (Commit 5, 2026-06-01) — band title aligns with the
     *  ProSheet canonical promise. Drops "Premium" wording (banned by
     *  M1 commercial copy rules). Short variants of the ProSheet
     *  bullets fit the chip-sized band layout. */
    title: "Train with Luz every day.",
    priceLabel: "$1.99 / 30 days",
    perks: [
      "Luz unlimited",
      "Training Journal",
      "PRO identity",
    ] as const,
    cta: "See plan",
    ariaLabel: "Training Pass, $1.99 for 30 days, see plan",
  },
} as const;

/** Hub V2 dock — Arena ceremony + secondary links (design-lock §1.4 + §2.4).
 *  Sticky footer: PrincipalButton "ENTER ARENA" + low-density text-link
 *  row above (Practice pieces / See all trophies) + Shield ribbon/shop
 *  entry. Pinned over carved-wood plinth in the visual finish (Phase 7
 *  commit c). */
export const HUB_V2_DOCK_COPY = {
  playLabel: "ARENA",
  playAriaLabel: "Enter the Arena and play a full chess match",
  practiceLinkLabel: "PIECES",
  practiceLinkAriaLabel: "Practice individual chess pieces",
  trophiesLinkLabel: "TROPHIES",
  trophiesLinkAriaLabel: "See all collected trophies",
  shieldsRibbonLabel: (count: number): string =>
    count === 1 ? "Shield ×1" : `Shields ×${count}`,
  shieldsRibbonAriaLabel: (count: number): string =>
    count === 1
      ? "1 streak shield available. Open shop"
      : `${count} streak shields available. Open shop`,
  primaryActionsAriaLabel: "Primary actions",
} as const;

export const COACH_COPY = {
  askCoach: "ASK",
  /** JOURNAL (coach/history) PLAY shortcut. Was missing, so the button
   *  rendered the raw key "COACH_COPY.playCta" (2026-06-15 fix). */
  playCta: "PLAY",
  loading: "Loading...",
  quickReviewTitle: "REVIEW",
  coachAnalysisTitle: "REVIEW",
  keyMoments: "KEY MOMENTS",
  whatYouDidWell: "WHAT YOU DID WELL",
  takeaways: "TAKEAWAYS",
  tips: "TIPS",
  yourSessions: "JOURNAL",
  pastSessions: "Past Sessions",
  yourProgress: "YOUR PROGRESS",
  gamesAnalyzed: (n: number) => `Games analyzed: ${n}`,
  highestDifficulty: (d: string) => `Highest difficulty: ${d}`,
  currentStreak: (n: number) => `Current streak: ${n} wins`,
  creditTitle: "I'm still here",
  creditExplain:
    "I saw your game. You've used your 3 free analyses. Add a pack and we keep talking.",
  creditPack5: "5 analyses",
  creditPack20: "20 analyses",
  creditBest: "BEST",
  buyWithUsdc: "Buy with stablecoin",
  orQuickReview: "REVIEW",
  /** M1 funnel (Commit 3, 2026-06-01) — paywall reskin for the
   *  loss/resign endgame surface. Adds a sample-only preview band
   *  (no LLM call, no credit consumption) plus a PRO alternative
   *  alongside the existing pack tiles. */
  paywallHeading: "Review your game with Luz.",
  paywallPreviewLabel: "Example insight",
  paywallPreviewTitle: "This move left your rook exposed.",
  paywallPreviewBody: "Luz explains what changed and what to try next.",
  paywallPack5Cta: "Get 5 reviews",
  paywallPack20Cta: "Get 20 reviews",
  paywallProCta: "Train with Luz every day",
  paywallDismiss: "Later",
  getFullAnalysis: "PRO REVIEW",
  getFullAnalysisSub: "See your key moments and personalized tips",
  analyzing: "Analyzing your game",
  reviewingMoves: "Reviewing your moves",
  canLeave: "You can leave. We'll keep your result ready",
  analysisReady: "Your analysis is ready",
  analysisProcessing: "Your analysis is still processing...",
  analysisFailed: "Analysis couldn't be completed. Your credit was not spent.",
  coachResting: "Coach is resting. Try again later.",
  cancel: "Cancel",
  retry: "RETRY",
  full: "Full",
  quick: "Quick",
  keyMomentsCount: (n: number) => `${n} key moments`,
  moveLabel: (n: number, move: string) => `Move ${n} · You played ${move}`,
  tryInstead: (move: string) => `→ Try ${move}`,
  welcomeTitle: "Meet Your Coach",
  welcomeSub:
    "A learning companion that helps you understand your decisions and improve step by step.",
  welcomePack: "3 analyses",
  welcomePackDetail: "Key moments · Lessons · Praise",
  claimFree: "CLAIM",
  welcomeNote: "Free analyses to start. After that, credit packs from $0.05.",
  creditComingSoon: "Credit packs coming soon!",
  connecting: "Connecting to Coach\u2026",
  coachThinking: "Coach is thinking\u2026",
  keepScreenOpen: "Keep this screen open.",
  reviewRetryTitle: "RETRY",
  slowThinking: "Coach is still thinking. Keep this screen open.",
  retryReview: "RETRY",
  analysisIncomplete: "Your review didn\u2019t complete.",
  analysisIncompleteBody: "Please try again. If it keeps happening, come back later.",
  // --- Secondary Screen Cohesion (2026-03-28) ---
  loadingCanLeave: "You can leave. Your result will be ready when you return.",
  creditPackSubtitle: (n: number) => `${n} game analyses`,
  historyAskNextTitle: "Ask Luz for your next analysis",
  historyAskNextSub:
    "Your free analyses are gone. Add a pack and keep talking.",
  unlockFullAnalysis: "PRO REVIEW",
  /* Coach session memory (PR 4 + PR 5). The footer renders inside
   * <CoachPanel> when proActive && historyMeta are present. */
  historyFooter: {
    building: "Building your history…",
    reviewing: (n: number) => `Reviewing ${n} past ${n === 1 ? "game" : "games"}`,
    manageLabel: "manage history",
  },
  /* Delete-by-self surface in /coach/history. Spec §8.2 / red-team
   * P0-1 (replay defense), P0-7 (honest UX), P0-8 (recovered-vs-body). */
  historyDelete: {
    title: "Delete all your Coach history",
    body:
      "Permanently removes every stored analysis from our records. This action cannot be undone. Your active PRO pass is unaffected.",
    cta: "Delete history",
    confirmTitle: "Delete all history?",
    confirmBody:
      "This will permanently remove all your past Coach analyses and weakness tracking. Your next analysis will start fresh.",
    confirmAccept: "Yes, delete everything",
    confirmCancel: "Keep my history",
    signMessage: buildDeleteMessage,
    /* Neutral wording so we never imply a positive action that may
     * not have happened (red-team P0-7). */
    successToast: "All Coach data cleared from our records",
    errorToast: "Could not delete. Please retry",
  },
  historyBannerSubtitle: "Personalized coaching from your game history.",
  /** /coach/history page header — back navigation + no-wallet gate. */
  backLabel: "Back",
  connectWalletForHistory: "Connect your wallet to view your Coach history.",
  /** The PLAY dock now routes here instead of opening the ProSheet, whose
   *  primary CTA was "Connect wallet". So this branch IS the connect funnel:
   *  the copy above states the gate, this button opens it. */
  connectWalletButton: "Connect Wallet",
  /** ARIA region label shared by all three render branches of
   *  <CoachHistory /> (loading, empty, content). Stable label keeps the
   *  landmark name consistent so AT users land on the same region as
   *  the panel transitions states. */
  historyAriaLabel: "Coach review history",
  /** Result chip labels. Used by <CoachHistory />'s `resultLabel()`
   *  switch. The capitalize fallback in the component stays English; if
   *  we ever extend `GameResult` beyond win/lose/draw/resigned, add the
   *  variant here instead of relying on the fallback. */
  resultLabels: {
    win: "Win",
    lose: "Loss",
    draw: "Draw",
    resigned: "Resigned",
  },
  /** Relative timestamp chips ("just now", "5m ago", "3h ago",
   *  "2d ago", "4mo ago"). ICU placeholders filled by the bundle
   *  mirrors in messages/en.ts and messages/es.ts. */
  relativeTime: {
    justNow: "just now",
    minutes: "{count}m ago",
    hours: "{count}h ago",
    days: "{count}d ago",
    months: "{count}mo ago",
  },
  /** <LatestReviewCard /> — the prominent tappable card at the top of
   *  the journal. Aria-label is ICU since it composes the type label,
   *  result, difficulty, and move count. */
  latestReviewCard: {
    title: "Latest Review",
    openLabel: "Review →",
    ariaLabel:
      "Open {typeLabel} Coach Review, {result}, {difficulty}, {moves} moves",
  },
  /** <ProgressCard /> stats — three short labels rendered under each
   *  stat number. "Reviewed" pairs with `analyzed.length`,
   *  "Highest" pairs with `highestDiffLabel`, "Win streak" pairs with
   *  `streak` (only shown when streak > 0). */
  progressStats: {
    reviewed: "Reviewed",
    highest: "Highest",
    winStreak: "Win streak",
  },
  /** <EmptyState /> — no-reviews-yet branch. CTA is uppercase "ARENA"
   *  matching the candy-game treatment used elsewhere. */
  emptyState: {
    title: "No reviews yet",
    body: "Play an Arena match and ask Coach after the game.",
    cta: "ARENA",
    ctaAriaLabel: "Go to Arena and play a match",
  },
  /** Save Later chip — visual indicator on a Training Journal row for a
   *  win that was never minted. Tapping the row routes to the visor
   *  with `?focus=save`, which scrolls + highlights the Save tile so
   *  the user can complete the save. Solves "yours forever IF you
   *  tapped at the right moment" — gives a second chance to past wins. */
  saveAvailable: "Save available",
  /** <CoachHistoryDeletePanel /> collapsible toggle. Flips between
   *  Manage / Close depending on `manageOpen` state. */
  manageHistoryOpen: "Manage history",
  manageHistoryClose: "Close",
  /** Locale badge rendered alongside the analysis title. Language codes
   *  ("EN"/"ES") stay identical in both bundles by convention; we keep
   *  them in editorial so the badge can be styled and aria-labeled
   *  consistently across surfaces. */
  analysisLocaleBadge: {
    en: "EN",
    es: "ES",
    /** Screen-reader-friendly long form, ICU-keyed by locale code. */
    ariaLabel: "Analysis language: {locale}",
  },
  /** Reanalyze flow (2026-05-24). User regenerates the cached analysis
   *  in their active locale — costs 1 credit (or none for PRO), fires a
   *  fresh LLM call, overwrites the per-locale cache key for the active
   *  locale only. `confirmBodyPro` is rendered when the caller passes
   *  `proActive` so the copy stays honest about the (lack of) cost. */
  reanalyze: {
    cta: "Reanalyze",
    ariaLabel: "Reanalyze this game in your current language",
    /* Discovery card body — sits below the analysis so the user
     * understands WHY the reanalyze button exists and when to use it.
     * Without this leg the CTA reads as a random "do this again"
     * button and most users skip past it. */
    panelTitle: "Want a different take?",
    panelBody:
      "Coach analyses are best-effort. Generate a fresh one if this didn't quite hit, or to read it in your current language.",
    confirmTitle: "Reanalyze this game?",
    confirmBody:
      "This generates a fresh analysis in your current language and uses 1 credit.",
    confirmBodyPro:
      "This generates a fresh analysis in your current language. PRO subscribers don't spend credits.",
    confirmAccept: "Yes, reanalyze",
    confirmCancel: "Cancel",
    /* Pending overlay reused while the LLM is regenerating. */
    inFlightLabel: "Generating new analysis…",
  },
} as const;

/**
 * Cluster E — Coach re-entry + unconditional GameRecord persistence.
 * Spec: _bmad-output/implementation-artifacts/spec-cluster-e-coach-re-entry-game-persistence.md
 *
 * Single source of truth for the new persistence toast, Coach re-entry
 * surfaces (Arena end-state CTA + /coach/history Analyze chip), and a11y
 * descriptions per §0.4. All copy is English.
 */
export const COACH_ENTRY_COPY = {
  getCoachAnalysis: "Ask Coach",
  savingMatch: "Saving match…",
  matchSaved: "Match saved",
  matchNotSaved: "Match not saved · play continues",
  matchNotSavedRetry: "RETRY",
  matchTooShort: "Match too short to analyze",
  historyMatchLabel: "Match",
  // 2026-05-29 (Cluster C follow-up): chip routes to /coach/[gameId]
  // (not analyze-in-place). The label was renamed to "Review" so it
  // honestly describes the tap target — analysis happens inside the
  // visor, via the credit-aware Ask Coach primary.
  analyzeChipLabel: "Review",
  historyAnalyzeAriaLabel: (timestamp: string, difficulty: string, result: string): string =>
    `Review match from ${timestamp}, ${difficulty}, ${result}`,
  offlineToAnalyze: "You need to be online to analyze",
  /** Dismiss control on the persist-error toast. */
  persistDismissLabel: "Dismiss",
  /** Loss/draw/resigned Coach Review panel — kicker + headline + body.
   *  Ready: match has ≥1 move and game record persisted, CTA enabled.
   *  TooShort: match has 0 moves, CTA disabled with explanation. */
  reviewKicker: "COACH REVIEW",
  reviewHeadlineReady: "Want a deeper look?",
  reviewBodyReady: "Coach reviews your match and surfaces key moments.",
  reviewHeadlineTooShort: "No moves to analyze",
  reviewBodyTooShort: "Make at least one move before asking the Coach.",
  /** M1 funnel — Coach Review primary CTA label, used only in the
   *  loss/resign endgame popup. The shared `getCoachAnalysis` label
   *  still covers the win-secondary slot. */
  lossReviewCta: "Let's see what happened.",
  /** M1 funnel (Commit 4) — Coach Review primary CTA label for the
   *  draw / stalemate endgame popup. Frame is curiosity, not regret —
   *  the player didn't lose, they tied. */
  drawReviewCta: "How did this end?",
} as const;

/* COACH_ONBOARDING_COPY removed by PLAY #8 (2026-07-13). It fed the "welcome"
 * modal where Luz asked "want me to show you?" AFTER the user had already
 * tapped Ask Coach — a confirmation of a decision already made. Luz keeps her
 * voice where it earns its place: the loading state (COACH_COPY.coachThinking /
 * analyzing / slowThinking) and the result. */

/**
 * Post-game CoachPreviewCard counter band — labels for the new
 * Luz-led free-user CTA. Spec §4 of
 * _bmad-output/planning-artifacts/coach-demo-redesign-discovery-2026-05-26.md.
 *
 * Rendered for free users only. PRO users continue to render
 * ARENA_COPY.coachPreview.activeCta ("REVIEW") since the counter is
 * meaningless on unlimited.
 */
export const COACH_CTA_COPY = {
  /** Free user with credits remaining. Counter is part of the
   *  affordance, not a separate chip, so the tap target carries the
   *  state in its own label. */
  askWithCounter: (count: number) =>
    `Ask Luz for your analysis (${count} free left)`,
  /** Free user with zero credits. Tap routes to the paywall sheet
   *  (PRO sub or pack purchase). */
  askWhenZero: "Ask Luz for your analysis (need PRO or a pack)",
} as const;

/** Shared chrome for /about, /support, /privacy, /terms — anything
 *  rendered through <LegalPageShell>. Centralizes labels that aren't
 *  page-specific so locale bundles only need to override this once. */
export const COACH_VIEWER_COPY = {
  tooShortToReview: "This match was too short to review.",
  replayStoppedAtMove: "Replay stopped at move {n}. Couldn't play {san}.",
  previousMove: "Previous move",
  nextMove: "Next move",
  sliderAriaLabel: "Jump to move",
  controlsAriaLabel: "Replay controls",
  sanListAriaLabel: "Move list",
  actionsAriaLabel: "Match actions",
  askCoach: "Ask Coach",
  askCoachAgain: "Ask Coach again",
  mintVictory: "Save Victory",
  // Plan 3 review (F7) — save/re-save confirmation toast in the viewer.
  mintSavedToast: "Saved on Celo · #{tokenId}",
  viewNft: "View collectible",
  share: "Share",
  playAgain: "Play again",
  title: "Match review",
  reconnectTitle: "Reconnect to view",
  reconnectSubtitle: "This match is tied to your wallet.",
  reconnectCta: "Connect wallet",
  loadErrorTitle: "Couldn't load this match",
  loadErrorSubtitle: "Network or server issue. Try again, or play another.",
  loadErrorRetry: "RETRY",
  notFoundMessage: "Match not found.",
  backLabel: "Back",
  // 2026-05-29 (Cluster C, commit 2): slider/replay polish.
  // `sliderProgress` is locale-neutral (numbers only).
  sliderProgress: "{current} / {total}",
  // 2026-05-29 (Cluster C, M1): move list redesigned to a static
  // 4-row panel with a flanking-flourish header — toggle pill dropped.
  movesPanelTitle: "Moves",
  moveAnnotationMate: "Mate",
  moveAnnotationCheck: "Check",
  // 2026-05-29 (Cluster C, commit 3a): state-driven actions stack.
  // Tertiary link reused across non-win states (loss / draw / resigned
  // / too-short / replay-errored). ES override in messages/es.ts.
  backToHub: "Back to Hub",
  // 2026-05-29 (Cluster C, commit 3b): Save Victory sprite primary.
  // `saveVictory` is the visor-only label — `mintVictory` stays in
  // arena context. ES override in messages/es.ts.
  saveVictory: "Save Victory",
  saveVictoryAriaLabel: "Save Victory for {price}",
  // F8 — neutral Save label for non-win outcomes (draw/lose/resign).
  saveMatch: "Save match",
  // 2026-05-29 (Cluster C, commit 3c): trophy ribbon + Celoscan
  // tertiary. ES overrides in messages/es.ts. `viewNft` (legacy key)
  // stays around because the dev fixture + existing tests still
  // resolve it; the visor renders `viewOnCeloscan` exclusively.
  trophyRibbon: "#{tokenId}",
  trophyRibbonAriaLabel: "Trophy #{tokenId} saved on Celo",
  viewOnCeloscan: "View receipt",
  // 2026-05-29 (Cluster C, M3): post-mint Share tile label —
  // distinct from the legacy `share` key (which arena re-uses) so
  // the tile copy can evolve without coupling.
  shareTrophy: "Share trophy",
  // 2026-05-30: pending banner shown inline while the coach hook is
  // running an analysis request. Replaces the silent wait that left
  // the visor visually identical for ~20-30s (cf. project_coach_viewer_cluster_c).
  analysisPending: "Analyzing your match…",
  // Short variant for the ~85px Ask Coach tile, where the full banner copy
  // truncates. The long string stays on the inline banner title.
  analysisPendingTile: "Analyzing…",
  analysisPendingHint: "Stay here. The analysis appears below as soon as it's ready.",
  // 2026-05-30 (Phase 2 shop oscuridad): point-of-use credits readout
  // rendered under the Ask Coach tile when the wallet has paid credits.
  // Suppressed at credits === 0 so the paywall stays the primary signal
  // for an empty balance. ES override in messages/es.ts.
  creditsHint: "Uses 1 credit · {count} left",
  // 2026-05-30 (Phase 2 shop oscuridad): PRO active variant — replaces
  // the paid-credits hint so PRO subscribers see a clear "no cost"
  // signal at the point of action. ES override in messages/es.ts.
  creditsHintPro: "Unlimited · PRO active",
} as const;

export const LEGAL_SHELL_COPY = {
  back: "Back",
  aboutTitle: "About",
  lastUpdatedLabel: "Last updated",
} as const;

export const LEGAL_COPY = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 15, 2026",
    sections: [
      {
        heading: "Independent Operator",
        body: "Chesscito is an independent product built and operated by Wolfcito (@akawolfcito). It is not operated by, affiliated with, or endorsed by Opera or MiniPay. References to MiniPay throughout the service identify it only as a wallet and distribution channel.",
      },
      {
        heading: "Service Description",
        body: "Chesscito is an educational pre-chess game experience on the Celo blockchain, designed to be used with MiniPay-compatible wallets. The service provides interactive chess piece movement puzzles with on-chain collectibles.",
      },
      {
        heading: "Eligibility",
        body: "You must have a compatible wallet (such as MiniPay) to use Chesscito. Age eligibility is determined by your applicable jurisdiction.",
      },
      {
        heading: "Wallet Responsibility",
        body: "You are solely responsible for the security of your wallet, private keys, and seed phrases. Chesscito never requests, stores, or has access to these.",
      },
      {
        heading: "On-Chain Transactions",
        body: "Certain actions (including badge claims, score submissions, shop purchases, and NFT mints) interact with smart contracts on the Celo blockchain. These transactions are irreversible once confirmed on-chain.",
      },
      {
        heading: "Digital Assets",
        body: "NFTs, badges, and shop items obtained through Chesscito have no guaranteed value, liquidity, or appreciation. They are game collectibles, not financial instruments.",
      },
      {
        heading: "Third-Party Dependencies",
        body: "Some features depend on third-party infrastructure, wallets, and blockchain networks that may be unavailable, delayed, or behave unexpectedly.",
      },
      {
        heading: "Service Changes",
        body: "Chesscito may modify, pause, or discontinue features at any time without prior notice.",
      },
      {
        heading: "Limitation of Liability",
        body: 'The service is provided "as is". Chesscito and its operator are not liable for losses arising from blockchain transactions, wallet issues, or service interruptions.',
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "July 23, 2026",
    sections: [
      {
        heading: "Data We Handle",
        body: "When you use Chesscito, the following data is involved: your public wallet address (provided by your wallet at connection), on-chain interaction data such as scores, badges, and purchases (publicly visible on the Celo blockchain), and local app state including tutorial progress, shield count, and gameplay preferences.",
      },
      {
        heading: "Data We Do Not Collect",
        body: "Chesscito does not collect passwords, seed phrases, government-issued identification, personal identifiable information (PII), your full IP address, precise location, phone number, or email. We use no advertising or cross-site tracking cookies.",
      },
      {
        heading: "Local Storage",
        body: "Tutorial state, gameplay preferences, streak shields, and UX settings are stored on your device for UX purposes. On-chain actions and related blockchain data are public by nature and may be transmitted through wallet and network infrastructure required to operate the app.",
      },
      {
        heading: "Product Analytics",
        body: "Chesscito records anonymous, first-party usage analytics to understand how the app is used and to keep it secure. For example, we record which screens are viewed, whether training exercises are started and completed, and whether the app runs inside MiniPay or a regular browser. These events are tied to a random, device-generated anonymous identifier stored on your device, never to your wallet address, name, phone, or email. We derive an approximate country (a two-letter country code only) from the network request; we never store your full IP address, city, or coordinates. Analytics are used only in aggregate for product and security decisions, not to profile individuals.",
      },
      {
        heading: "Third-Party Infrastructure",
        body: "Chesscito uses Celo RPC providers for blockchain reads and writes, and WalletConnect for wallet connection. Anonymous usage analytics are first-party and stored in our own database (Supabase); we do not use third-party analytics vendors or ad networks.",
      },
      {
        heading: "Purpose of Data Use",
        body: "Data is used solely to operate the game and keep it secure: validate moves, record scores, process purchases, mint collectibles, and measure aggregate product usage.",
      },
      {
        heading: "Data Retention",
        body: "On-chain data is permanent by nature of blockchain. Raw anonymous analytics events are retained for up to 90 days; anonymous first-visit records used to measure retention are kept longer in aggregated form. Local data stored on your device can be cleared by you at any time through your browser settings.",
      },
      {
        heading: "Contact",
        body: `For privacy-related questions, visit our Support page or email ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "our support team"}.`,
      },
    ],
  },
} as const;

/**
 * Coach session memory privacy disclosure (red-team P0-4 — corrected
 * path; lives in editorial.ts per CLAUDE.md SSOT rule, not legal-copy.ts).
 * Spec §8.3.
 *
 * Renders inside `app/privacy/page.tsx` as a separate <section> after
 * the existing privacy sections, so PRO subscribers can find the data-
 * handling story for their stored Coach analyses.
 */
export const PRIVACY_COACH_COPY = {
  heading: "Coach Match History (Chesscito PRO)",
  para1:
    "Active PRO subscribers have their game analyses stored to provide personalized coaching across sessions. We retain match analyses for 365 days from creation, after which they are automatically deleted. Free tier users' analyses live only in our 30-day cache and are never persisted long-term.",
  para2Title: "Your control:",
  para2:
    "You can delete all stored Coach history at any time via your wallet from the Coach history page, regardless of PRO status. Deletion is permanent and immediate.",
  para3Title: "What's stored:",
  para3:
    "Wallet address (lowercase), game ID, timestamps, game metadata (difficulty, result, total move count), and the AI-generated coaching response (summary, identified mistakes, lessons, praise). We do NOT store your full move list. No personal identifiers beyond the wallet address.",
  para4Title: "Lost wallet access:",
  para4:
    "Deletion requires control of the wallet that owns the analyses. If you lose access, contact support@chesscito.com for an out-of-band deletion request. We will require proof of original ownership.",
} as const;

export const SUPPORT_COPY = {
  title: "Support",
  primaryChannel: {
    label: "Email",
    value: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
    // href is undefined when env var is missing — support page guards the <a> render
    href: process.env.NEXT_PUBLIC_SUPPORT_EMAIL
      ? `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`
      : undefined,
    unavailable: "Contact unavailable",
  },
  secondaryChannel: {
    label: "GitHub Issues",
    value: "Report a bug or request a feature",
    href: "https://github.com/wolfcito/chesscito/issues",
  },
  tertiaryChannel: {
    label: "Telegram",
    value: "@chesscito_app",
    href: "https://t.me/chesscito_app",
  },
  howToReport: "Describe the issue, include screenshots if possible, and mention your device and browser.",
  reportableIssues: [
    "Loading problems",
    "Transaction errors",
    "UI bugs",
    "Gameplay questions",
    "Feature requests",
  ],
  responseTime: "We aim to respond within 48 hours.",
  sections: {
    contactUs: "Contact Us",
    community: "Community",
    technicalIssues: "Technical Issues",
    howToReport: "How to Report an Issue",
  },
} as const;

export const ABOUT_COPY = {
  title: "Chesscito",
  operatedBy: "Operated by Wolfcito",
  handle: "@akawolfcito",
  version: "v0.1.0",
  operatorDisclaimer:
    "Chesscito is an independent product built and operated by Wolfcito. It is not operated by, affiliated with, or endorsed by Opera or MiniPay. MiniPay is referenced solely as a wallet and distribution channel.",
  links: {
    /** Public landing — opens the narrative for parents, sponsors, and
     *  curious players. Lives at the top of the About link list so it's the
     *  first discovery surface. Was authored in Spanish and shipped that way
     *  in both locales until 2026-07-30. */
    why: "Why Chesscito",
    support: "Support",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    invite: "Invite a Friend",
  },
  clipboardFeedback: "Copied!",
  shareTitle: "Chesscito",
  shareText:
    "Train your mind with short chess challenges. Designed with MiniPay in mind.",
  shareUrl: "https://chesscito.com",
} as const;

/** Phase 0.5 C2 — methodology mini-section copy for /about. The body
 *  attributes the curriculum to the real human team behind Chesscito
 *  and anchors the differentiator (FIDE Master pedagogy + +100
 *  students with national/international tournament experience). The
 *  attribution chips render as compact pill labels so the section
 *  reads as a credit, not a marketing claim.
 *
 *  HARD RULE — never weaken these strings into medical or clinical
 *  claims. The cognitive disclaimer (full variant) renders separately
 *  at the page footer. See
 *  docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md §8. */
export const ABOUT_METHODOLOGY_COPY = {
  sectionTitle: "Methodology",
  body:
    "Chesscito's curriculum is designed by a real human team. Pedagogy by FIDE Master César Litvinov Alarcón. Over 100 students supported, with alumni who have competed in national and international tournaments.",
  cesar: "César Litvinov Alarcón · FIDE Master",
  wolfcito: "Luis Fernando Ushiña · Software Developer Architect · Founder",
} as const;

export const UNLOCK_COPY = {
  title: (piece: string) => `${piece} Unlocked!`,
  cta: (piece: string) => `Start ${piece}`,
} as const;

export const SHOP_ITEM_COPY = {
  founderBadge: {
    label: "Founder Badge",
    subtitle: "Support from day one. Yours to keep.",
  },
  /** Coach Credits — value-prop copy for an eventual Coach Pack tile
   *  in the shop sheet (parallel to Founder Badge / Streak Shield).
   *  Pack size labels are intentionally NOT here — those live in
   *  COACH_COPY.creditPack5/20 since the Coach paywall is the only
   *  surface that renders pack tiles today. If a shop tile ever
   *  surfaces Coach Packs, it should read pack labels from the same
   *  COACH_COPY source to avoid drift. */
  coachPack: {
    label: "Coach Credits",
    /** M1 funnel (Commit 7, 2026-06-02) — drops banned "AI" + "subscription"
     *  wording per the commercial-copy-rules. Aligned with the Coach
     *  paywall canonical voice from Commit 3. */
    subtitle: "Review your game with Luz from $0.05.",
  },
  pro: {
    label: "Chesscito PRO",
    subtitle: "Unlimited Coach analyses · 30-day pass.",
  },
} as const;


/** Chesscito PRO — first commercial SKU. Phase 0 scope: monthly pass
 *  that bypasses Coach credit consumption only. Other premium perks
 *  (Arena, achievements, VictoryNFT discounts) are roadmap-only copy
 *  for now — do not wire them up server-side. See
 *  docs/superpowers/plans/2026-04-29-pro-phase-0.md. */
export const PRO_COPY = {
  label: "Chesscito PRO",
  /** Category marker rendered above the title inside `<ProSheet>`.
   *  Frames PRO as a "training pass" rather than a feature gate, per
   *  the §11 canon mission line. Spec: addendum §3.6 / §6.1 commit #4. */
  kicker: "Training Pass",
  /** M1 funnel (Commit 5, 2026-06-01) — promise-first headline.
   *  Replaces the V1 "Chesscito that grows with you" tagline with the
   *  canonical M1 direction: PRO is the daily training pass with Luz,
   *  not a vague growth promise. */
  tagline: "Train with Luz every day.",
  /** M1 funnel (Commit 5) — short subline that names what PRO IS in
   *  plain language. Drops the V1 "the more you play, the more it
   *  unlocks" hook to avoid feature-gate framing. */
  taglineSub: "Your monthly training pass.",
  subtitle: "Monthly pass that keeps Chesscito open. Renew when you want.",
  priceLabel: "$1.99 USD / 30 days",
  durationLabel: "30 days",
  ctaBuy: "Activate PRO",
  /** Short CTA label used when the wallet is not connected — fits a
   *  PrincipalButton (≤16 char target). The longer
   *  `errors.walletRequired` copy stays as the inline error message
   *  for assistive flows but is NOT a button label. */
  ctaConnectWallet: "Connect wallet",
  /** Uppercase variant of `kicker` for the candy-panel "TRAINING PASS"
   *  purple pill rendered above the title. */
  trainingPassLabel: "TRAINING PASS",
  /** Uppercase label for the candy-panel "ACTIVE PERKS" purple pill
   *  rendered above the perks bullet list. */
  activePerksLabel: "ACTIVE PERKS",
  ctaActive: "PRO Active",
  ctaRenew: "Renew your training",
  /** Inline CTA labels surfaced inside <ProSheet> when the purchase /
   *  verification flow is mid-flight. Migrated to next-intl in the pro/*
   *  batch so the strings ship per-locale via PRO_COPY. */
  processingLabel: "Processing…",
  verifyingLabel: "Verifying…",
  statusCheckingLabel: "Checking PRO status…",
  statusUnavailableLabel: "PRO status unavailable",
  statusUnavailableMessage:
    "We could not confirm your subscription. Try again shortly; nothing was changed.",
  /** CTA label shown when the wallet is on the wrong chain (Celo). */
  switchNetworkLabel: "Switch Network",
  /** ARIA label for the close button inside <ProSheet>. */
  closeLabel: "Close PRO",
  /** Sub-line shown under the price label on the candy panel. ICU
   *  placeholder `{duration}` is filled from PRO_COPY.durationLabel. */
  noAutoBillingLine: "({duration} · no auto-billing)",
  /** Surfaced by use-pro-sheet-state when no accepted stablecoin
   *  balance covers the price. Same string twice in the hook (preview
   *  + post-purchase) — single source so they can never desync. */
  insufficientBalance: "Insufficient stablecoin balance.",
  /** Surfaced by use-pro-sheet-state when wagmi's wait-for-receipt
   *  exceeds the timeout. Distinct from a generic failure so the user
   *  knows their tx may still confirm on-chain. */
  txTimeout: "This is taking longer than expected. Please try again.",
  statusActiveSuffix: (daysLeft: number) =>
    daysLeft === 1 ? "Expires tomorrow" : `${daysLeft} days left`,
  /** M1 funnel (Commit 6, 2026-06-02) — PRO row + Hub chip + ProSheet
   *  shared days-left copy. Threshold for "expiring" surfaces is 7 days
   *  per the M1 plan. */
  daysLeftActiveLabel: (daysLeft: number) =>
    daysLeft === 1
      ? "Your pass expires tomorrow."
      : `Your pass expires in ${daysLeft} days.`,
  /** Post-expire copy surfaced on the Account PRO row. Frames the
   *  renewal as keeping training alive with Luz, not loss aversion. */
  expiredLabel: "Your pass expired. Renew to keep training with Luz.",
  /** Renew CTA reused across surfaces. Pairs with `ctaRenew` (which
   *  remains "Renew your training" since Commit 5). */
  renewTrainingCta: "Renew your training.",
  /** Short Hub-chip copy when daysRemaining ≤ 7. Fits the 120px chip
   *  while the aria-label below carries the long-form context. */
  chipDaysSuffix: (daysLeft: number) => `PRO · ${daysLeft}d`,
  /** Aria label for the expiring Hub chip — long-form for screen
   *  readers. Static "expires in X days" reads consistently regardless
   *  of whether the visible suffix uses the short "Nd" notation. */
  chipExpiringAriaLabel: (daysLeft: number) =>
    daysLeft === 1
      ? "PRO active, expires tomorrow"
      : `PRO active, expires in ${daysLeft} days`,
  /** Inline sub-line shown when daysLeft ≤ 3 (badge in EXPIRING variant).
   *  Pairs with a text-link reusing `ctaRenew` for the extend action.
   *  Canon §11 (Journey 3): no FOMO countdown, no urgency framing —
   *  just a calm reminder. Spec: addendum §3.3. */
  expiringMicroCopy: "Renew anytime to keep training",
  /** `<ProActiveBadge />` pill labels. ACTIVE for daysLeft > 3,
   *  EXPIRING when ≤ 3 — flips pill color emerald → amber. Spec:
   *  _bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md §3.3 */
  statusBadgeActive: "ACTIVE",
  statusBadgeExpiring: "EXPIRING",
  /** `<ComingSoonChip />` decorative pill rendered next to roadmap
   *  perks. Single source so the label can flip ES/EN without touching
   *  the primitive. Spec: addendum §3.7 (C3) / §6.1 commit #5. */
  comingSoonLabel: "SOON",
  /** `<ProActiveCTA />` surface-aware copy. Navigational variant fires
   *  from /hub, /exercises, /trophies, /leaderboard, /about, /why, /
   *  and any unmatched path. Close-only variant fires from /arena to avoid
   *  the mid-match nav footgun. Spec: §3.4 of the same addendum. */
  activeCtaPlay: "Play in Arena",
  activeCtaGotIt: "Got it",
  activeSublineHub: "Coach reviews after the match",
  activeSublineArena: "Coach activates after checkmate",
  /** Mission framing rendered between the perks list and the CTA. PRO
   *  is positioned as both a personal training plan and a way to
   *  sustain free access. M1 funnel (Commit 5) drops the "subscription"
   *  wording per the commercial-copy-rules ban; copy now reads PRO as
   *  a "pass" that keeps training open for everyone. */
  missionNote:
    "Every PRO pass helps Chesscito keep training open.",
  /** Floating chip in play-hub. Kept tight (28px tall, max 120px wide)
   *  so the inactive label has to be a single short token. We dropped
   *  the old "GET PRO" because it read transactional; "PRO" alone with
   *  the ✦ icon already signals the premium tier without selling. */
  chip: {
    inactive: "PRO",
    activePrefix: "PRO",
  },
  /** ARIA labels rendered on the chip — the visible label is just the
   *  PRO tier mark, so screen readers need the longer state-aware
   *  context. `{label}` ICU placeholder is filled from PRO_COPY.label. */
  chipActiveAriaLabel: "{label} active",
  chipGetAriaLabel: "Get {label}",
  /** <CoachProCard /> ARIA + kicker copy. Kicker flips between
   *  active/inactive subscription states. */
  coachCardAriaLabel: "Chesscito PRO training",
  coachChipsAriaLabel: "Coach Review includes",
  coachKickerActive: "Training Pass",
  coachKickerInactive: "Personal Coach",
  hubCoachCard: {
    inactive: {
      title: "Chesscito PRO",
      body: "Get feedback after games and practice.",
      chips: ["Insights", "Tips", "History"] as const,
      cta: "COACH",
    },
    active: {
      title: (remainingDays: number) => `PRO Active · ${remainingDays}d`,
      body: "Your Coach is ready.",
      features: "Reviews · History · Next training",
      chips: ["Reviews", "History", "Next training"] as const,
      cta: "JOURNAL",
    },
  },
  activeActions: {
    journal: "JOURNAL",
    journalSubline: "Review your coach history and pick the next lesson.",
  },
  /** Value bullets rendered before the price card so PRO is framed as
   *  "what you get" before "what you pay". Canonical hierarchy (founder,
   *  2026-07-23): PRO includes the full Season Pass, then adds unlimited
   *  Coach Review, the Training Journal and PRO identity. Season Pass is
   *  the entitlement PRO grants (source "pro" → training_pass), and it
   *  subsumes Special Trainings, so those are NOT a separate bullet here.
   *  "Play Chess" is folded into "every game you play": Arena is free
   *  (progression-gated), never a PRO-exclusive entitlement, so it must
   *  not read as one. Arena / VictoryNFT stay roadmap-only, never here. */
  perksActive: [
    "The full Season Pass, included.",
    "Luz unlimited. Coach review on every game you play.",
    "Full Training Journal. Every match kept.",
    "PRO identity on your profile.",
  ] as const,
  errors: {
    notConfigured: "PRO is not yet active. Check back shortly.",
    purchaseFailed: "Purchase could not be verified. Please try again.",
    walletRequired: "Connect your wallet to purchase PRO.",
    verifyFailedTitle: "Payment confirmed. Verification pending.",
    verifyFailedReassurance:
      "Your payment is saved on Celo. Retrying won't double-charge.",
    retryVerifyCta: "Retry verification",
    retryingVerify: "Verifying…",
  },
  receipt: {
    success: "PRO activated. Your training plan is live for 30 days.",
    extended: (daysLeft: number) =>
      `PRO renewed. ${daysLeft} days remaining.`,
  },
} as const;

/** `<GlobalStatusBar />` Z1 primitive copy. Spec:
 *  docs/specs/ui/global-status-bar-spec-2026-05-02.md §15 commit #1.
 *
 *  - `proManageLabel` is used while PRO is active (tap → manage / view
 *    expiration via `<ProSheet>`).
 *  - `proViewLabel` is used while PRO is inactive AND the transitional
 *    `onProTap` debt still exists (§6.1). Once Shop ships its PRO
 *    sub-section and the debt closes, this key is removed alongside the
 *    inactive pill.
 *  - `proInactiveLabel` is the visible label of the muted inactive pill.
 *  - Days-suffix copy ("28 days left", "Expires tomorrow") is REUSED
 *    from `PRO_COPY.statusActiveSuffix` — do not duplicate the key here. */
export const GLOBAL_STATUS_BAR_COPY = {
  guestLabel: "Guest",
  ariaLabelConnected: "Player status",
  ariaLabelAnonymous: "Anonymous status",
  ariaLabelLive: "Live match status",
  proManageLabel: "Manage Chesscito PRO",
  proViewLabel: "View Chesscito PRO",
  proInactiveLabel: "PRO",
  proLoadingAriaLabel: "Loading PRO status",
  backLabel: "Back to hub",
  accountLabel: "Open account",
  accountChipLabel: "Account",
} as const;

/** Non-blocking nudge shown to disconnected players when they hit a
 *  meaningful milestone (★★★ on a piece, arena victory, badge sheet
 *  with claimables). One-shot per milestone per browser — the hook
 *  flips a `chesscito:connect-prompt-shown:{milestone}` flag the
 *  first time the prompt fires and never re-nags the same milestone.
 *  Other milestones still fire independently.
 *
 *  Phase 2 of plan 2026-05-25-account-chip-and-local-progress.md. */
export const CONNECT_PROMPT_COPY = {
  title: "Save your progress",
  starsSubline: "You earned 3 stars. Connect your wallet to keep them safe.",
  victorySubline: "You won. Connect your wallet to keep your victory.",
  badgesSubline: "Badges are ready to claim. Connect your wallet to keep them.",
  connectCta: "Connect to save",
  dismissCta: "Maybe later",
  dismissAriaLabel: "Dismiss connect reminder",
  successAfterConnect: "Your progress is now saved on Celo.",
} as const;

export const ACCOUNT_SHEET_COPY = {
  title: "Account",
  description: "Wallet, network and PRO status",
  walletLabel: "Wallet",
  /** Names the derived identity every other player sees on the leaderboard. */
  chesscitoIdLabel: "Chesscito ID",
  networkLabel: "Network",
  proLabel: "PRO",
  copyAddress: "Copy address",
  copiedAddress: "Copied",
  disconnect: "Disconnect",
  minipayDisconnectHint: "If MiniPay keeps the session active, disconnect from MiniPay wallet settings.",
  managePro: "Manage PRO",
  viewPro: "View PRO",
  activePro: "Active",
  inactivePro: "Not active",
  unknownNetwork: "Unknown network",
  closeAriaLabel: "Close account",
  /** "Mi Coach" row inside <AccountSheet>. Routes to /coach/history.
   *  Status chip flips on Luz availability: PRO → always-on, free with
   *  credits → counted, free at 0 → soft empty state pointing to the
   *  paywall handoff. */
  coachRowLabel: "My Coach",
  coachStatusActive: "Talking",
  coachStatusFree: "Free",
  /** 2026-05-30 (shop oscuridad fix): explicit-count variant for free
   *  users with credits. ICU `{count}` is the integer credit balance. */
  coachStatusFreeWithCount: "{count} credits",
  coachStatusEmpty: "Out of free",
  /** 2026-05-30: Streak Shields inventory row. Renders below the Coach
   *  row, deep-links to /exercises (where shields fire on retry). */
  shieldsRowLabel: "Streak Shields",
  shieldsRowSubtitle: "Retry exercises without losing your streak.",
  shieldsStatusAvailable: "{count} ready",
  shieldsStatusEmpty: "None. Get some",
  /** 2026-05-30: Founder Badge inventory row. Permanent collectible;
   *  status flips to "Owned" once the chain scan confirms purchase. */
  founderRowLabel: "Founder Badge",
  founderRowSubtitle: "Day-one supporter recognition.",
  founderStatusOwned: "Owned",
  founderStatusNotYet: "Not yet",
  /** Locale switcher block — sits above the disconnect button. The two
   *  language names stay rendered as proper nouns ("English" / "Español")
   *  so the user reads the destination, not the source. */
  languageLabel: "Language",
  languageOptionEnglish: "English",
  languageOptionSpanish: "Español",
  /** Aria label for the segmented button. ICU `{name}` interpolates the
   *  destination language name in its native form. */
  languageSwitchAriaFormat: "Switch language to {name}",
} as const;

/** Chesito Card — the rechargeable "wallet" surface that frames the
 *  player's Peones balance like a debit/credit card. Lives as the hero of
 *  the Account sheet and behind the Peones HUD chip. Visual-first: the card
 *  IS the balance, the Top up CTA routes into the existing Get Peones rail. */
export const CHESITO_CARD_COPY = {
  title: "Chesscito Card",
  /** Currency unit shown next to the big balance number. */
  unit: "Peones",
  /** One-line promise under the balance, plain language, no web3 jargon. */
  caption: "Your balance to play and unlock",
  /** Primary CTA — opens the Get Peones rail to recharge. */
  topUp: "Top up",
  topUpAria: "Top up your Peones balance",
} as const;

/** Cognitive disclaimer used inside the app shell (play-hub footer,
 *  arena footer) and any other non-landing surface that mentions
 *  cognitive practice/wellness. It outlived the landing copy blocks it was
 *  split out of (WHY_PAGE_COPY / LANDING_COPY, deleted 2026-07-30), which is
 *  exactly why it was split out. The two variants exist so the
 *  same string set serves both the tight in-game footer (short) and
 *  the longer-form pages like /about (full).
 *
 *  HARD RULE — never weaken these strings to imply medical benefit.
 *  Only "does not replace" framing. */
export const COGNITIVE_DISCLAIMER_COPY = {
  short:
    "Chesscito is a playful cognitive companion. It does not replace medical diagnosis or treatment.",
  full:
    "Chesscito is a playful cognitive companion experience. It does not replace medical diagnosis, treatment, or professional therapy.",
} as const;


/** ============================================================================
 *  Game Home Redesign — editorial categories (Story 1.2, 2026-05-04)
 *
 *  Editorial source of truth for the 8 new primitives shipping in the Game
 *  Home redesign. Each category lives here so a single point of change rolls
 *  out consistently across surfaces.
 *
 *  Spec: docs/product/visual-language-minimum-2026-05-03.md §3.4 + §4.5–4.12
 *  Story: _bmad-output/planning-artifacts/epics.md Epic 1 Story 1.2
 *  ============================================================================ */

/** Aria-label and ambient hint copy for the central kingdom anchor.
 *  Consumed by `<KingdomAnchor>` (Step 11 §1 of UX spec). */
export const HOME_ANCHOR_COPY = {
  alt: "Chesscito kingdom: Wolfcito the wizard with chess piece statues",
  attractHint: "Your training is ready.",
  /** Two-line tagline rendered inside the portal asset, below the
   *  wizard. The first line is the lead-in; the highlight line is
   *  rendered bolded as the focal closer. Same copy in both
   *  inactive + PRO portal variants for now (per 2026-05-25 brief). */
  taglineLead: "Train your pieces first",
  taglineHighlight: "Then enter the arena",
} as const;

/** Persistent HUD chip copy. Consumed by `<HudResourceChip>` (top row) and
 *  `<HudSecondaryRow>` (conditional second row). Format functions stay
 *  singular/plural-aware so screen readers announce naturally. */
export const HUD_COPY = {
  /** Trophies chip (top row, always visible). */
  trophiesLabel: "Trophies",
  trophiesAriaLabel: (count: number) => `Trophies: ${count}`,

  /** PRO chip (top row, visible when PRO is active). */
  proLabel: "PRO",
  proRemainingFormat: (days: number) => `${days}d`,
  proAriaLabel: (days: number) =>
    days === 1
      ? "PRO active, 1 day remaining"
      : `PRO active, ${days} days remaining`,
  proInactiveAriaLabel: "PRO inactive: tap to learn more",
  proLoadingAriaLabel: "PRO status is being checked",
  proUnavailableAriaLabel: "PRO status unavailable: try again shortly",

  /** Connect-wallet chip (top row, conditional — visible only when no
   *  wallet is connected and a connect handler is wired). Acts as a
   *  desktop fallback when `<WalletProvider>`'s MiniPay auto-connect
   *  cannot fire (no injected `window.ethereum.isMiniPay` provider). */
  connectLabel: "Connect",
  connectAriaLabel: "Connect wallet to see your stats",

  /** Coach chip (top row, always visible). Surfaces the Coach session
   *  history page so PRO subscribers (and free users with seeded
   *  analyses) can jump to past insights without finishing another
   *  match first. Closes the discoverability gap from the
   *  2026-05-07 hub audit (D1). */
  coachLabel: "Coach",
  coachAriaLabel: "Open Coach session history",

  /** Streak chip (secondary row, conditional). */
  streakLabel: "Streak",
  streakFormat: (days: number) =>
    days === 1 ? "1-day streak" : `${days}-day streak`,
  streakAriaLabel: (days: number) =>
    days === 1 ? "Streak: 1 day" : `Streak: ${days} days`,

  /** Stars chip (secondary row, conditional — mission stars). */
  starsLabel: "Stars",
  starsFormat: (current: number, total: number) => `${current}/${total}`,
  starsAriaLabel: (current: number, total: number) =>
    `Stars: ${current} of ${total}`,

  /** Shields chip (secondary row, conditional — retry shields available). */
  shieldsLabel: "Shields",
  shieldsFormat: (count: number) => `Shield ×${count}`,
  shieldsAriaLabel: (count: number) =>
    count === 1
      ? "1 streak shield available"
      : `${count} streak shields available`,

  /** Region container aria-label for the secondary row. */
  secondaryRowAriaLabel: "Player resources",

  /** Secondary text-link rendered below `<PrimaryPlayCta>` so the
   *  kingdom launcher exposes /exercises (canonical home for piece
   *  exercises since 2026-05-09). Kept low-density so it does not
   *  compete with the dominant PLAY CTA. */
  practiceLinkLabel: "TRAIN PIECES",
  practiceLinkAriaLabel: "Practice individual chess pieces",
} as const;

/** Per-surface mission ribbon copy. Consumed by `<MissionRibbon>` (Step 11 §6
 *  of UX spec). Canon rule (strategy doc §11): mission rendered ABOVE the CTA
 *  on every payment surface. The PRO sheet variant aliases the canonical
 *  PRO_COPY.tagline so the line stays single-source. */
export const MISSION_RIBBON_COPY = {
  hub: "Small plays. Big mental habits.",
  arena: "Your training continues, one move at a time.",
  "pro-sheet": PRO_COPY.tagline,
  /** Exercises fallback. Live use passes runtime `pieceHint` via the
   *  `<MissionRibbon text>` override; this is the safety net for
   *  default rendering / tests. */
  exercises: "Pick a square. Move.",
  ariaLabel: "Mission statement",
} as const;

/** Aria-label for a reward tile that carries a progress counter (Paso 2 —
 *  `docs/specs/2026-08-09-hub-tile-progress-counter.md`).
 *
 *  ⛔ Deliberately a SIBLING of `REWARD_COPY`, never a key inside it:
 *  `RewardTileId` is `keyof typeof REWARD_COPY` (`reward-column.tsx`), so
 *  anything added there silently becomes a valid tile id.
 *
 *  One shared message instead of seven per-piece ones. The seven `ariaLabel`
 *  entries below are per-piece because their phrasing genuinely differs
 *  ("Claim Rook mastery badge" vs "Save victory ready"); this one does not,
 *  and `<RewardColumn>` already has the piece name from `PIECE_LABELS`.
 *  Seven copies of a uniform string is seven chances to drift. */
export const REWARD_PROGRESS_COPY = {
  ariaLabel: (piece: string, completed: number, required: number) =>
    `${piece} mastery: ${completed} of ${required} toward the badge`,
} as const;

/** Per-tile reward column copy. Consumed by `<RewardColumn>` (Step 11 §4 of
 *  UX spec). Tiles cover the 6 chess pieces (per game-brief §7 progression
 *  order) plus a victory tile for Arena wins ready to mint. Aria-label is a
 *  state-aware function so screen readers announce claimable / progress /
 *  locked states distinctly. */
export const REWARD_COPY = {
  rook: {
    label: "Rook mastery",
    claimableHint: "Tap to claim your Rook badge",
    lockedHint: "Complete all 3 Rook levels to unlock",
    unlockRequirement: "Complete Rook L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Rook mastery badge: ready"
        : state === "progress"
          ? "Rook mastery: in progress"
          : "Rook mastery: locked",
  },
  bishop: {
    label: "Bishop mastery",
    claimableHint: "Tap to claim your Bishop badge",
    lockedHint: "Master Rook first, then complete all 3 Bishop levels",
    unlockRequirement: "Complete Bishop L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Bishop mastery badge: ready"
        : state === "progress"
          ? "Bishop mastery: in progress"
          : "Bishop mastery: locked",
  },
  queen: {
    label: "Queen mastery",
    claimableHint: "Tap to claim your Queen badge",
    lockedHint: "Master Rook + Bishop to unlock",
    unlockRequirement: "Master Rook + Bishop",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Queen mastery badge: ready"
        : state === "progress"
          ? "Queen mastery: in progress"
          : "Queen mastery: locked",
  },
  knight: {
    label: "Knight mastery",
    claimableHint: "Tap to claim your Knight badge",
    lockedHint: "Master Queen first, then complete all 3 Knight levels",
    unlockRequirement: "Master Queen, then complete Knight L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Knight mastery badge: ready"
        : state === "progress"
          ? "Knight mastery: in progress"
          : "Knight mastery: locked",
  },
  king: {
    label: "King mastery",
    claimableHint: "Tap to claim your King badge",
    lockedHint: "Master Knight first",
    unlockRequirement: "Master Knight, then complete King L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim King mastery badge: ready"
        : state === "progress"
          ? "King mastery: in progress"
          : "King mastery: locked",
  },
  pawn: {
    label: "Pawn mastery",
    claimableHint: "Tap to claim your Pawn badge",
    lockedHint: "Master King first. Pawn is the boss final",
    unlockRequirement: "Master King, then complete Pawn L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Pawn mastery badge: ready"
        : state === "progress"
          ? "Pawn mastery: in progress"
          : "Pawn mastery: locked",
  },
  /** Victory tile — represents an Arena victory ready to mint. Distinct
   *  from piece-mastery tiles; appears at top of column when claimable. */
  victory: {
    label: "Save your victory",
    claimableHint: "Tap to save your latest Arena win",
    lockedHint: "Win an Arena match to unlock",
    unlockRequirement: "Win an Arena match",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Save victory ready: tap to save"
        : state === "progress"
          ? "Victory in progress"
          : "No victory ready: win an Arena match",
  },
} as const;

// =============================================================================
// SPEC 1 — Hub Redesign copy blocks
// =============================================================================

export const PROFILE_COPY = {
  pageTitle: "Profile",
  sheetDescription: "Profile, claims, stats and wallet",
  closeLabel: "Close profile",
  editNameAria: "Edit display name",
  tierAriaFormat: "Tier {title}, {xp} XP",
  pendingClaimsHeader: "Pending claims",
  generalStatsHeader: "General stats",
  walletLabel: "Wallet",
  networkLabel: "Network",
  networkValue: "Celo",
  disconnect: "Disconnect wallet",
  manage: "Manage",
  refreshAria: "Refresh pending claims",
  statLabels: {
    piecesMastered: "Pieces Mastered",
    dailyStreak: "Daily Streak",
    puzzlesSolved: "Puzzles Solved",
    arenaWins: "Arena Wins",
    trophies: "Trophies",
    nftsMinted: "Saved Victories",
  },
} as const;

export const DISPLAY_NAME_COPY = {
  dialogTitle: "Choose your name",
  placeholder: "Up to 20 characters",
  save: "Save",
  cancel: "Cancel",
  visitor: "Visitor",
} as const;

/**
 * Identity Lite — localized tokens for the deterministic player nickname.
 * The generator picks indices from a seed; this supplies the words + per-locale
 * order. EN is adjective-first; ES (messages/es.ts) is noun-first.
 * Spec: docs/specs/identity-lite-pr1.md
 */
export const IDENTITY_COPY = {
  pieces: {
    pawn: "Pawn",
    knight: "Knight",
    rook: "Rook",
    bishop: "Bishop",
    queen: "Queen",
    king: "King",
  },
  styles: {
    golden: "Golden",
    green: "Green",
    blue: "Blue",
    coral: "Coral",
    tropical: "Tropical",
    bright: "Bright",
  },
  guestPrefix: "Guest",
  /** Tokens: {piece} {style} {number}. */
  template: "{style} {piece} #{number}",
} as const;

export const TIER_LABELS = {
  visitor: "Visitor",
  apprentice: "Apprentice",
  trainee: "Trainee",
  knight: "Knight",
  wizard: "Wizard",
  grandmaster: "Grandmaster",
} as const;

export const TIER_THRESHOLDS = {
  trainee: 25,
  knight: 75,
  wizard: 200,
  grandmaster: 500,
} as const;

export const CLAIM_COPY = {
  kinds: {
    badge: "{name} badge",
    score: "Save score · {points} pts",
    victoryNft: "Save your victory · {difficulty}",
  },
  claimVerb: "Claim",
  costGasOnly: "Network fee only",
  costEstimateUsd: "~${amount}",
  inFlightLabel: "In progress. Reconnect to verify",
  refreshAria: "Refresh",
  emptyAria: "No pending claims",
} as const;

export const HERO_CTA_COPY = {
  newPlayer: {
    label: "TRAIN ROOK",
    sub: "learn the rook first",
    variant: "amber" as const,
  },
  dailyPending: {
    label: "TODAY'S TACTIC",
    sub: "today's tactic awaits",
    variant: "blue" as const,
  },
  defaultCaughtUp: {
    label: "TRAIN PIECES",
    sub: "tap a tile to pick",
    variant: "amber" as const,
  },
} as const;

/** Daily-tactic surface (Sally R2). Shown as a small pill near the HUD
 *  when the player has a pending daily challenge. Tapping routes to the
 *  daily slot inside /exercises. Copy stays short — the chip is a
 *  signal, not an explanation. */
export const DAILY_BADGE_COPY = {
  label: "Daily ready",
  ariaLabel: "Today's daily tactic is ready: tap to play",
} as const;

/** The LEARN/PLAY switch that sits at the foot of every hub. Its labels used to
 *  be hardcoded in the component, which pinned HUB_ACTION_RAIL_COPY.mateLabel to
 *  English too: both name the same destination, and translating one alone would
 *  have put two words for it on the same screen. `switchTo` is the accessible
 *  name of each half, so it has to carry the label it announces. */
export const APP_MODE_SWITCH_COPY = {
  groupLabel: "Choose app mode",
  learnLabel: "Training",
  playLabel: "Play",
  switchTo: "Switch to {mode}",
} as const;

/** Hub right-rail action tile labels. Short titles (≤6 chars) that
 *  sit inside the locked-piece tile below the icon, mirroring the
 *  LEARN rail tile labels ("Rook", "Bishop", …). */
export const HUB_ACTION_RAIL_COPY = {
  dailyLabel: "Daily",
  mateLabel: "Training",
  coachLabel: "Coach",
  /** PRO discovery panel — sits above the right rail when the user does
   *  NOT have an active subscription. The asset `panel-pro.png` is just
   *  the purple frame + crown; title + subtitle are rendered as text
   *  layered on top so we can re-style or localize without re-exporting
   *  the asset. When PRO is active the panel unmounts and the HUD chip
   *  ("PRO 7d") becomes the only recognition surface. */
  proDiscoveryTitle: "PRO",
  /* One word by design: it rides as a floating label on the PRO chip's foot,
   * where a sentence would wrap over the art (founder 2026-07-13). */
  proDiscoverySubtitle: "Unlock",
  proCheckingSubtitle: "Checking",
  proUnavailableSubtitle: "Unavailable",
  proDiscoveryAriaLabel:
    "Unlock PRO: full experience.",
  /** Arena tile aria labels — composed from MiniArenaSetup.name. */
  arenaUnlockedAriaFormat: "Special training: {name}",
  arenaLockedAriaFormat: "{name}: locked",
  /** Daily tile aria labels — composed from puzzle name + completion state. */
  dailyCompletedAriaFormat: "Daily Tactic completed. Fresh in {hours}h.",
  dailyPlayAriaFormat: "Play today's Daily Tactic. {name}.",
} as const;

export const SECONDARY_CTA_COPY = {
  arena: {
    label: "Enter Arena",
    ariaLabel: "Enter Arena: full chess vs AI",
  },
} as const;

/** Daily-streak nudge: the screen that teaches what lights the flame.
 *
 *  It is shown on the way OUT of a training session, to a player who has been
 *  solving exercises and has not touched today's Daily. Its whole job is one
 *  sentence of rule, so the body must never grow into a paragraph.
 *
 *  The tone is credit, then the rule: the player DID train. Nothing here may
 *  scold, and nothing may imply a lost day can be recovered (shields rescue a
 *  failed exercise, never a day). No "on-chain", NFT or mint language: the
 *  streak is local. Keep every string free of em-dashes; the file ceiling is 0
 *  and `anti-ai-prose.test.ts` counts string literals. */
export const STREAK_NUDGE_COPY = {
  rootAriaLabel: "Your daily streak is not lit yet today",
  title: "Your flame is still dark",
  body: "Nice training today. The Daily Tactic is the one thing that lights your streak, and it is a single quick puzzle.",
  cta: "Solve today's Daily",
  dismissHint: "Tap anywhere to keep going",
  closeLabel: "Close",
} as const;

/** Focus Passport (Chesscito Learn P1) — streak-based daily-focus card.
 *  Local-only; copy deliberately avoids any "verified", "on-chain",
 *  "proof", NFT/mint, or health/medical claims (it reflects a local
 *  streak, not a server- or chain-backed record). `{count}` is the
 *  current streak. */
export const FOCUS_PASSPORT_COPY = {
  heading: "Focus Passport",
  rootAriaLabel: "Focus Passport: your daily focus streak",
  currentStreak: "Current streak",
  loading: "Focus progress",
  emptyTitle: "Start your streak",
  emptySub: "Solve today's focus to begin",
  day1Title: "Day 1",
  day1Sub: "Come back tomorrow",
  buildingTitle: "{count} day streak",
  buildingSub: "Keep going",
  weekTitle: "7-day focus",
  weekSub: "Nice",
  slotFilledAria: "Day {index} done",
  slotEmptyAria: "Day {index}",
} as const;

export const CHALLENGE_CARD_COPY = {
  rootAriaLabel: "21-Day Mind Challenge",
  notJoinedTitle: "21-Day Mind Challenge",
  joinedTitle: "Mind Challenge",
  passportLabel: "Focus Passport",
  /** Small `?` in the Focus Passport header — replays the intro mini-tour.
   *  Replaying never touches progress, rewards or the "tour seen" flag. */
  replayTourLabel: "Replay the intro tour",
  /** Labels under the offer sheet's gift → tactic → habit story strip (same
   *  wording as the mini-tour's step 1). */
  storyGift: "Open gift",
  storyTactic: "Solve 1 tactic",
  storyHabit: "Build habit",
  activeBadge: "ACTIVE",
  includedWithPro: "PRO Benefit included",
  trainingPassStat: "Training Pass",
  specialTrainingStat: "Special Training",
  accessActive: "Access active",
  dayProgress: "Day {day} / {total}",
  daysStat: "days",
  dayStat: "day",
  focusDaysFormat: "{done}/{total} focus days",
  /** Passport headline, ABOVE the flames: the sentence the row illustrates.
   *  RETIRED from the card (Focus Days ledger, 2026-07-27): it read as an
   *  ordinal that advanced with the calendar while the number under it came
   *  from the streak, so it went backward after a skipped day. Replaced by
   *  `focusDaysProgress`, which counts rows the server actually recorded. */
  focusDayOrdinal: "Day {done} of {total}",
  /** Progress, from the ledger. Never derived from the streak: a count that
   *  can go backward is the whole defect this replaces. */
  focusDaysProgress: "{completed} of {goal} Focus Days",
  /** Access window. Its own metric, separate from progress. */
  windowDaysLeft: "{days, plural, =1 {1 day left} other {# days left}}",
  windowUnbounded: "Included with PRO",
  /** Shown where progress would be when the ledger cannot answer. Says a
   *  metric is missing, never that access or the Daily is broken, and never
   *  falls back to the streak. */
  progressUnavailable: "Focus progress is temporarily unavailable",
  /** `unreachable`: the goal no longer fits in the window. Explains the state
   *  and keeps the habit worth doing. It replaces optimistic progress lines
   *  ONLY; the CTA stays (spec: "convive con el CTA, no lo reemplaza"). Never
   *  defeatist, never "you already lost". */
  unreachableTitle: "Keep building the habit",
  unreachableBody: "Complete more days before your pass ends.",
  shieldsBonus: "+{count}",
  shieldsStat: "Shields",
  shieldsCount: "{count}",
  shieldsOwned: "{count} Shields",
  /** Daily Streak, canonical wording (docs/product/2026-07-23-combo-streak-
   *  vocabulary.md). NOT "Combo" — Combo is the session metric and stays
   *  exclusive to the exercise overlay / drawer. */
  streakFormat: "{days, plural, =1 {1-day streak} other {#-day streak}}",
  /** Weekly row — Monday-first, comma-separated so a locale can reorder or
   *  re-letter it without touching the component. */
  weekdayLetters: "M,T,W,T,F,S,S",
  weekAriaLabel: "This week",
  weekDayAria: "{day}: {state}",
  weekDone: "done",
  weekDoneToday: "done today",
  weekToday: "today, pending",
  weekMissed: "missed",
  weekUpcoming: "upcoming",
  joinCta: "Join Challenge",
  joinAriaLabel: "Join the 21-Day Mind Challenge for {price}",
  /** The offer CTA is the Season Pass banner — the SAME surface the visitor met
   *  on landing slide 2, wording included, so the two read as one product.
   *  `joinAriaLabel` still carries the verb and the price: the banner shows the
   *  product, the accessible name says what tapping it does. */
  passBannerTitle: "21-Day Season Pass",
  /** Shields come from `challenge.shieldBonus`, never a literal: the landing
   *  can hardcode "3" because it ships with the copy, the Hub reads config and
   *  would otherwise promise a number the purchase does not grant. */
  passBannerBenefits: "Daily training · Progress rewards · {shields} welcome Shields",
  /** Single primary CTA — one label per state, never two CTAs at once. */
  ctaStartToday: "Start Focus",
  ctaStartAriaLabel: "Start today's focus",
  ctaTomorrow: "Come Back Tomorrow",
  /** Informative, never a block: training, scores and the piece shortcuts all
   *  stay open once today's focus is done. */
  ctaTomorrowAriaLabel: "Today's focus is done. Training stays open.",
  ctaComplete: "Challenge Complete",
  ctaCompleteAriaLabel: "You finished the 21-Day Mind Challenge",
  /* Finishing the challenge is a STATE, so it lives in the status chip next to
     the title — not in the CTA slot, where announcing it cost the player their
     next action permanently (`completed` is terminal). */
  completedBadge: "COMPLETED",
  /* Content Loop labels (Sprint 1). The button NAMES THE THING, not the mood:
     with one line at 390px this label is everything the player has to know what
     is on the other side, and a concrete noun outperforms a motivational verb.
     ⛔ Do not read `ContentLoopAction.ctaEN/ctaES` instead — those travel
     outside next-intl and the whole-bundle parity guard cannot see them. */
  ctaClaimGift: "Claim your gift",
  ctaKeepTraining: "Keep training",
  ctaTryLabyrinth: "Try the labyrinth",
  ctaBeatScore: "Beat your score",
  ctaNewPiece: "Start a new piece",
  ctaViewProgress: "See your progress",
  /* Subtitles for the action banner's second line. The Content Loop already
     carries `subEN`/`subES` per variant, but those travel OUTSIDE next-intl and
     the whole-bundle parity guard cannot see them — so the wording is reused,
     the channel is not. One line each: the banner truncates with an ellipsis
     rather than wrapping, because wrapping would push it past the height the
     terminal band reserves. */
  subStartToday: "Complete your daily tactic",
  subClaimGift: "A reward is waiting for you",
  subKeepTraining: "Your path is growing",
  subTryLabyrinth: "Next challenge unlocked",
  subBeatScore: "Can you do better?",
  subNewPiece: "New moves await",
  subViewProgress: "See what you've achieved",
  /* Two notes, because the three destination-less variants do NOT mean the same
     thing. `come-back-tomorrow` is having finished everything; the quota
     variants are hitting the session wall with content still left — naming the
     Daily at someone who just hit the training quota answers a question they
     did not ask, since they already completed the Daily today. */
  noteDailyReturns: "Your Daily returns tomorrow",
  noteTrainingResumes: "Training resumes tomorrow",
  dotFilledAria: "Day {index} done",
  dotEmptyAria: "Day {index}",
  focusTapAria: "Open today's Daily Tactic",
  // SeasonPassSheet offer state — the checkout must complete the same promise
  // that starts in onboarding and continues in the ChallengeCard: a daily habit
  // via the Focus Passport, not "volume + consumables". The +Shields line is the
  // direct-purchase bonus ONLY; PRO holders see proIncludedTitle with no bonus.
  offerTitle: "Join the 21-Day Mind Challenge",
  // The sheet renders the kicker as text and the rest as the canonical wordmark
  // (`/art/mini-tour/tour-challenge-title`). `offerTitle` stays as the flat
  // fallback and as the accessible name — an image cannot carry either.
  offerJoinKicker: "Join the",
  // One line on purpose: the two icon rows below already carry the offer, and
  // the long version now lives behind the `?` chip.
  offerHabit: "Build your daily focus habit.",
  // Special Trainings, framed at category level so it stays valid as more
  // ludic games ship — never list individual games. `{days}` is still
  // accepted by callers even though the copy no longer interpolates it.
  offerPractice: "Advanced challenges, growing over time.",
  offerShieldsBonus: "Includes the direct-purchase +{count} Shields bonus",
  offerPriceNote: "One-time payment · No subscription",
  // Benefit tiles. Both counts are interpolated from the SKU — a pass sold with
  // a different duration or bonus must never advertise the old numbers.
  offerBenefitDays: "{days} Days",
  // The goal and the window are DIFFERENT numbers, and the offer has to say
  // both: {goal} days of focus to complete, {window} days to do it in. Without
  // this line the player sees a countdown of 30 over a goal of 21 that nobody
  // explained. Deliberately not "a 30-day challenge" — what is sold is the
  // 21-day challenge, with room to stumble.
  // Sin compuesto con guion: "{window}-day window" se partía como "30-" /
  // "day window" a 390px, que es justo lo que no queremos — el 30 destacado
  // solo. Esta forma es además paralela a la española.
  offerWindowNote: "Complete {goal} Focus Days within a window of {window} days.",
  offerBenefitTrainings: "Special Trainings",
  offerBenefitShields: "+{count} Shields",
  // Accessible name of the `?` chip that discloses offerPractice +
  // offerShieldsBonus. The chip itself renders a glyph, which names nothing.
  offerDetailsLabel: "What's included",
  offerPayWith: "Pay with",
  // The price already sits in its own pill above — repeating it on the CTA
  // reads as a second charge.
  offerCta: "Unlock Challenge",
  proIncludedTitle: "Included with PRO",
  // Post-purchase celebration. `celebrationShieldsPending` covers the path
  // where the payment settled but the shield grant did not (verify-payment
  // returns shieldsCredited: 0) — never promise shields the wallet lacks.
  celebrationTitle: "You are in!",
  celebrationSubtitle: "Your 21-Day Mind Challenge has started.",
  celebrationDaysStat: "{days} days",
  celebrationShieldsStat: "+{count} Shields",
  celebrationShieldsPending: "Shields soon",
  celebrationHabit: "Your 21-day mind habit starts now.",
} as const;

export const HUB_LITE_COPY = {
  rootAriaLabel: "Chesscito Learn home",
  // Start Focus label intents (keyed by start-focus-label.ts).
  startFocus: "Start Focus",
  continue: "Continue",
  practice: "Practice",
  startFocusAriaLabel: "Start today's focus",
  trainingPathLabel: "Training Path",
} as const;

/** Shared LEARN / PLAY mini-tour.
 *
 *  Every body has a variant for each way the player's state could make it a
 *  lie — they already solved today's daily, they are mid-streak, they already
 *  hold the pass. `{days}` / `{shields}` / `{price}` are INTERPOLATED from the
 *  same season-pass config that feeds the ChallengeCard (rail-config.ts).
 *  Typing "$0.99" here would rot silently the day pricing moves, and no test
 *  would go red. See docs/specs/2026-07-12-hub-tour-daily-first-spec.md. */
export const HUB_TOUR_COPY = {
  rootAriaLabel: "Hub tour",
  closeAriaLabel: "Close tour",
  dailyTitleStart: "Start your streak today",
  /** `dailyKeep` owns its own title: reusing `dailyTitle` would drag
   *  `dailyDone` along, and that variant must stay the informational one. */
  dailyTitleKeep: "Keep your focus streak going",
  dailyTitle: "Daily Tactic",
  /** The ritual variants (`dailyStart` / `dailyKeep`) describe ONE ritual with
   *  ONE vocabulary: "quick tactic" (the feature is named Daily Tactic — never
   *  "lesson", which exists nowhere else in the product) and "focus streak".
   *  Drifting between lesson/tactic/habit/streak by player state reads as four
   *  different features. */
  dailyStart:
    "Open your daily gift, complete one quick tactic, and begin building your focus streak.",
  dailyKeep:
    "Open your daily gift and complete one quick tactic to continue your focus streak.",
  /** Completed state — informational, NOT the ritual. Renders without the
   *  art-strip: showing the gift → tactic → streak sequence next to "come back
   *  tomorrow" invites a tap that does nothing today. */
  dailyDone:
    "Your Daily Tactic lives here. Come back tomorrow for the next one.",
  /** Daily step art-strip, ritual variants only: three labels under the
   *  gift → tactic → streak icons. Each label names the same beat as the body
   *  sentence, so the strip is a summary of the paragraph and not a fourth
   *  vocabulary. */
  dailyStripGift: "Gift",
  dailyStripTactic: "Quick tactic",
  dailyStripCombo: "Focus streak",
  dailyDetailsLabel: "Show daily focus details",
  challengeTitle: "Join the 21-Day Challenge",
  challengeTitleEnrolled: "21-Day Mind Challenge",
  /** The one screen that asks for money — carried by the benefit cards, not by
   *  a paragraph. The hook sells the outcome, the cards keep days/shields
   *  visible, and `challengePrice` keeps the price honest (quoted from config).
   *
   *  NOTHING here may imply the pass forgives a missed day. A shield rescues a
   *  FAILED EXERCISE; streak recovery is a permanent never-build, and selling it
   *  would be selling something that does not exist. "Keep your streak" is a
   *  forward promise (build the habit), NOT "we'll restore a broken one". */
  challengeJoin: "Decide better. Keep your streak. Build a daily habit.",
  challengeValue: "{days} days · +{shields} shields · {price}",
  challengeAsk: "Tap Join Challenge to commit.",
  /** Price line under the benefit cards on the tour's challenge step. Quoted
   *  from rail-config, never typed, so it can't rot the day pricing moves. */
  challengePrice: "{price} · one-time payment",
  challengeEnrolled:
    "Track your focus days and complete your {days}-day commitment.",
  rookTitle: "Start with the Rook",
  rookStart:
    "The Rook is your first Training Path lesson. Start here whenever you are ready.",
  /** PLAY step 1 of 3 — CONTEXT, never a sale. First-visit players get told
   *  where they are before they get told what to buy.
   *
   *  This body must NOT restate `PLAY_HUB_COPY.kingdomPanelBody`: the spotlit
   *  KingdomCard is the illustration and already lists Quick Match / Coach
   *  Review / Rewards as chips. The panel locates the player ("your home for"),
   *  it does not re-enumerate what is visible underneath it. */
  kingdomTitle: "Welcome to Play Kingdom",
  kingdomBody: "This is your home for matches, Coach Review, and rewards.",
  proTitle: "Unlock Chesscito PRO",
  proTitleActive: "Your Chesscito PRO",
  proJoin:
    "Get the Season Pass, unlimited Coach Review, and the complete Play experience.",
  proActive:
    "Your Season Pass and unlimited Coach access live here whenever you need them.",
  /** PRO step benefits — the SUBSCRIPTION's perks. Deliberately not the
   *  KingdomCard trio (Quick Match / Coach Review / Rewards): those describe
   *  hub navigation, so reusing them made steps 1 and 2 the same strip twice
   *  and left the sale step with nothing of its own to say. */
  proBenefitSeasonPass: "Season Pass",
  proBenefitUnlimitedCoach: "Unlimited Coach",
  proBenefitCompleteExperience: "Complete Experience",
  /** Both halves are INTERPOLATED from the shop catalog (`PRO_PRICE_USD6`,
   *  `PRO_DURATION_DAYS`). Typing "$1.99 · 30 days" here would rot silently the
   *  day pricing or duration moves, and no test would go red. */
  proPrice: "{price} · {days} days",
  playTitle: "Choose How to Play",
  playStart: "Tap Play to choose your match and start when you're ready.",
  /** Alt text for the headline art — the art bakes the words in, so this is what
   *  a screen reader (and any non-EN locale) actually gets. */
  challengeTitleAlt: "21-Day Mind Challenge",
  challengeHeroAlt:
    "Chesscito's mascot beside a 21-day calendar and a Season Pass chest",
  tapToContinue: "Tap to Continue",
  tapToExplore: "Tap to Explore",
  /** Legacy copy keys kept for locale/type compatibility; no button renders. */
  next: "Next",
  done: "Got it",
  stepCounter: "{current} of {total}",
} as const;

export const LEADERBOARD_TABS_COPY = {
  tabs: {
    puzzlesWeek: "Puzzles this week",
    arenaWins: "Arena wins",
  },
} as const;

export const PRO_DROP_COPY = {
  /** OPERATIONAL: update this constant in the same commit as the on-chain
   *  shop catalog item update. See SPEC 1 §D12 P1-11. */
  current: "Knight's Tour",
  activeLabel: "PRO · {puzzle}. Solve the board",
  inactiveLabel: "Unlock {puzzle} + monthly puzzles",
} as const;

export const SETTINGS_STUB_COPY = {
  title: "Settings",
  comingSoonTooltip: "Coming soon",
  versionChipLabel: "Build {sha}",
  themeToggleLabel: "Theme",
  hapticsToggleLabel: "Haptics",
  languageToggleLabel: "Language",
  closeAriaLabel: "Close settings",
} as const;

export const HUB_SCAFFOLD_COPY = {
  /** Aria label for the hub <main> landmark. */
  rootAriaLabel: "Chesscito Hub",
  /** Premium slot Training Pass kicker shown above the price/days bar. */
  premiumKicker: "Training Pass",
  /** CTA shown on the inactive PremiumSlot variant. */
  premiumInactiveLabel: "Go PRO",
  /** Dominant PLAY CTA on the hub footer. */
  playLabel: "ENTER ARENA",
  playAriaLabel: "Enter the Arena",
  /** Aria templates rendered on the PremiumSlot, composed inline by
   *  hub-scaffold-client based on PRO state. */
  premiumInactiveAriaLabel: "Training Pass: tap to unlock",
  premiumActiveAriaFormat:
    "Training Pass: {used} of {total} sessions used, {days} days remaining",
} as const;

export const PLAY_HUB_COPY = {
  rootAriaLabel: "Chesscito Play Hub",
  victoriesLabel: "Victories",
  victoriesAriaLabel: "Minted victories: {count}",
  actionsAriaLabel: "Play Path actions",
  coachLabel: "Coach",
  shopLabel: "Shop",
  shopAriaLabel: "Open Play Shop",
  playPathPlayLabel: "Play",
  arenaLabel: "PLAY CHESS",
  arenaAriaLabel: "Play Chess: full chess vs AI",
  // Play Kingdom panel. Arena remains free-to-all; PRO is an explanatory
  // secondary CTA, never a gate on the primary Play Chess action.
  kingdomPanelTitle: "Play Kingdom",
  kingdomPanelBody: "Play matches, sharpen tactics, and improve with Coach.",
  kingdomProCtaTitle: "Chesscito PRO",
  kingdomProCtaSubtitle: "Season Pass + unlimited Coach",
  quickMatchLabel: "Quick Match",
  coachReviewLabel: "Coach Review",
  rewardsLabel: "Rewards",
  playPathLabel: "PLAY PATH",
  replayTourAriaLabel: "Replay Play Hub tour",
} as const;

export const PLAY_TACTICS_COPY = {
  tileLabel: "Warm-up",
  tileAriaLabel: "Open Arena warm-up",
  completedAriaLabel: "Arena warm-up complete for today",
  doneBadge: "Done",
  sheetTitle: "Arena Warm-up",
  objective: "Find the best {piece} move before entering Arena.",
  prompt: "Find the winning move",
  solved: "Warm-up complete!",
} as const;

export const HUB_RAIL_COPY = {
  learnLabel: "TRAINING PATH",
  unlockLabel: "UNLOCK",
  tiles: {
    daily: "Daily",
    mate: "Mate K+R",
    labyrinth: "Labyrinth",
    proDrop: "PRO",
    shop: "Shop",
    badges: "Badges",
  },
} as const;

/** Fail-rescue modal copy (spec ux-shield-rescue-and-welcome-pack-2026-
 *  05-31.md §3.4). Lives inside the extended PhaseFlash failure branch.
 *  CTA labels reuse FOOTER_CTA_COPY.useShield + shieldsLeft(n) for the
 *  primary "Use Shield · N left" pair, so this constant only declares
 *  the body strings + the secondary/tertiary CTAs unique to the modal.
 *  Brief-compliance: no decorative emojis, buttons ≤2 words (critical
 *  actions ≤3), no Web3 jargon, verb-first. */
export const RESCUE_MODAL_COPY = {
  /** Big heading — same word, every variant, anchors the moment. */
  header: "Almost.",
  /** Above the heading, short ALL CAPS context label. Differs by
   *  variant so the player knows what they're being shown — "STREAK
   *  AT RISK" reads as protection-time, "NO SHIELDS LEFT" reads as
   *  acquire-time. */
  kicker: {
    withShields: "STREAK AT RISK",
    withoutShields: "NO SHIELDS LEFT",
  },
  body: {
    /** State A — with-shields, first encounter. Includes one-line
     *  shield primer (educate first time). */
    withShieldsFirst:
      "A Shield protects your streak. Use one now and try again without losing a star.",
    /** State B — with-shields, recurring. Compact; no primer. */
    withShieldsRecurring: "Use a Shield now to keep your streak.",
    /** State C — without-shields, pre-claim. Forcing-function pitch
     *  for the Welcome Pack deep link. */
    withoutShieldsPreClaim:
      "You ran out of Shields. Claim your first free gift and rescue this streak.",
    /** State D — without-shields, post-claim or 3+ ignores. Peones
     *  fallback (2 Peones per rescue, retired the paid Shop-TX SKU
     *  in Task B8 2026-07-02). */
    withoutShieldsPostClaim:
      "You ran out of Shields. Use Peones to keep your streak alive.",
  },
  /** Small footer line under the secondary CTA — clarifies what
   *  the primary CTA actually does (claim the free gift in place for C,
   *  spend Peones in place for D). Neither leaves the rescue.
   *
   *  `deepLink` ("We'll take you to the Shop.") was retired 2026-07-13 with the
   *  Shop trip it described: the Welcome Pack is free, so there was nothing to
   *  buy and no reason to send the player to a catalog of paid SKUs. */
  footer: {
    withShields: "Keep your streak alive.",
    /** Variant C only. */
    claimInPlace: "It's free. Yours right here.",
  },
  /** Stats pills row — shown between the body and the primary CTA.
   *  Mirrors the candy-pill HUD vocabulary so the count format
   *  reads consistently with the rest of the app. */
  pills: {
    /** `Shield · {n} left` */
    shieldCount: "Shield · {n} left",
    /** With-shields companion pill. */
    starProtected: "Star protected",
    /** Without-shields, variant C. */
    giftCount: "Gift · {n} free",
  },
  cta: {
    /** State A/B primary — appended with the live shieldsLeft chip
     *  via FOOTER_CTA_COPY.useShield + shieldsLeft(n) at render. */
    useShield: "Use Shield",
    /** State C primary. */
    claimShields: "Claim {n} Shields",
    /** State D primary — spends Peones via the same server-verified
     *  path as A/B's Use Shield, not a Shop deep link. */
    usePeones: "Use Peones",
    /** Secondary CTA (all states). Explicit "anyway" keeps the cost
     *  intuition: "yes, despite losing a star". */
    retryAnyway: "Retry anyway",
  },
  /** Top-right [✕] close button (reuses the existing
   *  `.candy-close-asset-button` sprite + a11y label pattern from
   *  victory-popup-shell.tsx). Same outcome as Retry anyway. */
  closeLabel: "Close rescue modal",
} as const;

/** Welcome Pack tile copy (spec ux-shield-rescue-and-welcome-pack-2026-
 *  05-31.md §4.3). Tile is pinned at the TOP of the Shop sheet as the
 *  Forcing-Function-for-Catalog-Awareness anchor (see
 *  docs/design-patterns/game-economy-patterns.md). Pinning is
 *  non-negotiable. */

/**
 * PeonesHintButton (piece exercises) i18n.
 * Sprint 4 commit E original / commit I (2026-06-08) trimmed to
 * 4 keys after the visual-first principle landed (founder
 * directive — see `project_chesscito_visual_first_principle.md`).
 * The hint is now revealed as a board-cell glow, NOT a textual
 * banner, so `success` + `hint` keys are intentionally gone.
 */
export const LANGUAGE_CHIP_COPY = {
  ariaLabel: "Change language",
  dialogAriaLabel: "Change language",
  title: "Language",
  apply: "Apply",
  closeLabel: "Close",
  /** ICU param {language} = display name; per-tile select label. */
  selectAriaFormat: "Select {language}",
  en: "English",
  es: "Español",
} as const;

/** Transaction feedback on the balance chip (2026-07-21). The AMOUNT is
 *  never authored here — it is derived from the balance actually moving,
 *  so these strings can never advertise a debit that did not happen.
 *  Only the reason label and the currency word live in copy. */
export const PEONES_DELTA_COPY = {
  /** Singular / plural of the currency itself. */
  unitOne: "Peón",
  unitMany: "Peones",
  /** Why the balance moved. Omitted when a change arrives without a
   *  reason (e.g. a top-up completed in another tab) — the signed number
   *  alone is still honest. */
  reasons: {
    hint: "Hint",
    shield: "Shield",
    coach: "Coach",
    daily: "Daily",
    milestone: "Milestone",
    pack: "Pack",
  } as const,
} as const;

export const PEONES_HINT_COPY = {
  button: "Hint \u00b7 2 Peones",
  /** Nano label under the action-row pin (founder 2026-06-11: HINT
   *  sits in the dock action row like SAVE/CLAIM). Cost detail stays
   *  in `button`, which becomes the aria-label. */
  pinLabel: "Hint",
  guest: "Connect to use Peones hints",
  /** Short feedback copy. Sprint 4 commit M — collapsed the stacked
   *  chip+sublabel into a single morphing chip; copy must fit one
   *  line in roughly the same width as the idle button.
   *  Cost-explicit per the D1 quota-comms direction (2026-06-11):
   *  tells the player WHAT is missing, not just that something is. */
  insufficient: "Need 2 Peones",
  /** No computable first step for this exercise — the pin renders dead
   *  and no spend is issued. Distinct from `error` (which means the
   *  spend was attempted and failed): here nothing was ever charged. */
  /** Same wording as `error` on purpose: to the player both mean "you
   *  cannot get a hint right now". They differ in mechanics, not in
   *  meaning — `error` is transient and stays tappable, `unavailable` is
   *  permanent for this exercise and renders dead — and inventing a
   *  second phrasing would only make the pin look inconsistent. */
  unavailable: "Hint unavailable",
  error: "Hint unavailable",
  /** Transient 429 from the spend endpoint. Distinct from `error`
   *  because the condition self-heals in seconds; the generic
   *  "unavailable" read as broken-until-later (founder hint-race
   *  report 2026-06-10). */
  rateLimited: "One sec, try again",
} as const;

// PEONES_RETRY_COPY (Sprint 5 commit C) was removed in Economy V1
// (2026-07-21) together with the `retry` spend target and
// PeonesRetryButton. Retry is FREE in the shipped product and the paid
// button was never mounted anywhere, so this copy advertised a price
// nothing charged. Bringing a paid retry back means bringing all three
// back together.

/**
 * GetPeonesSheet (buy-Peones surface) i18n. Migrated out of the component
 * 2026-06-14 (UX audit T2 \u2014 it was the only economy sheet still 100%
 * hardcoded English). `errorGeneric` intentionally drops the raw rail
 * `errorReason` that used to leak to the user (audit CRITICAL); the raw
 * reason stays in telemetry only.
 */
export const GET_PEONES_COPY = {
  title: "Get Peones",
  close: "Close",
  payWith: "Pay with",
  reward: "{count} Peones",
  credited: "+{count} Peones credited",
  /** Post-purchase balance, read from the verified receipt. */
  newBalance: "New balance: {balance}",
  /** Names the three sinks. A first-time buyer has no model of where
   *  Peones go, and the purchase reads as abstract without it. */
  usage: "Spend them on Hints, Shields and Coach.",
  duplicate: "Already credited (no double charge)",
  done: "Done",
  pay: "Pay {price}",
  confirmInWallet: "Confirm in your wallet\u2026",
  sending: "Sending\u2026",
  verifying: "Verifying\u2026",
  unavailable: "Payments are not available right now.",
  wrongChain: "Switch your wallet to Celo to continue.",
  unsupportedToken: "This token is not supported.",
  insufficientTitle: "Not enough balance",
  insufficientBody: "Add some stablecoins to your wallet, then try again.",
  lowBalance: "Not enough {token} balance.",
  lowBadge: "Low",
  cancelled: "Payment cancelled. You can try again.",
  errorGeneric: "Something went wrong. Please try again.",
  verifyAgain: "Verify again",
} as const;

export const WELCOME_PACK_COPY = {
  tile: {
    title: "Welcome gift",
    subtitle: "New players only",
    body: "3 free Shields. One per wallet.",
  },
  cta: {
    /** Primary CTA, candy-pill --green family. */
    claim: "Claim free",
    /** Connect-gated state (browser without wallet connected). */
    connect: "Connect to claim",
  },
  /** Post-claim collapsed label (does NOT disappear — preserves trust
   *  and serves as anchor for future seasonal welcome packs). */
  claimedLabel: "Claimed",
  toasts: {
    success: "+3 Shields",
    error: "Claim failed. Try again.",
  },
} as const;

/** Lite-mode First Focus Day achievement unlock overlay. */
export const FIRST_FOCUS_DAY_OVERLAY_COPY = {
  eyebrow: "Achievement Unlocked",
  title: "First Focus Day",
  description: "You completed your first daily chess focus session.",
  continueCta: "Claim",
} as const;

/** Lite-mode Welcome Package overlay — shown once after First Focus Day achievement. */
export const WELCOME_PACKAGE_COPY = {
  title: "You did it.",
  subtitle: "Your first Focus Day is complete.",
  body: "Here's something to mark the moment.",
  stampLabel: "Focus Stamp: Day 1",
  claimCta: "Claim",
  dismissCta: "Later",
  trophiesPendingLabel: "Welcome Package",
  // MiniPay delivery audit B8 (2026-07-07): avoid the vague "claim your
  // reward" promise on the hint. The claim action itself (claimCta) stays,
  // since the Welcome Package has a real overlay + Focus Stamp. The hint
  // uses advance language instead.
  trophiesPendingHint: "Tap to open your Welcome Package",
  trophiesClaimedLabel: "Focus Stamp: Day 1",
  trophiesClaimedDescription: "Saved on this device. Earned on your first Focus Day.",
  claimedConfirmation: "Focus Stamp: Day 1 saved on this device.",
  signingTitle: "Saving your gift...",
  successTitle: "Welcome Gift Claimed",
  successBody: "Your first Chesscito reward is ready. Your passport has its first stamp.",
  successCta: "Continue",
  errorBody: "Something went wrong. Tap to try again.",
  retryCta: "Try again",
} as const;

/** Shared unlock overlay copy for the progression milestone machine.
 *  Keyed by MilestoneId. `absorbed` holds the recognition lines that
 *  render INSIDE a closer overlay for lower majors that fired in the
 *  same drain, never as a second modal. */
export const PROGRESSION_COPY = {
  "first-reward": {
    title: "First Reward Earned",
    body: "Practice pays. Open your gift.",
    primary: "Open Gift",
    dismiss: "Later",
  },
  /**
   * ⚠️ Keyed by MILESTONE, so the generic copy below is shown to whatever piece
   * just unlocked its lane — and it used to read "First Maze Unlocked / Guide
   * the rook through it" for ALL SIX. The bishop got "guide the rook" for its
   * Diagonal Run, the knight for its Tour, the queen for N-Queens. Right for
   * exactly one piece, and the more signature games shipped, the more it lied
   * (founder caught it on the queen, 2026-07-16).
   *
   * `byPiece` names the game the player actually unlocked and states its
   * mission in one line — the unlock moment is the first place the mission can
   * be told, so it tells it. The generic stays as a neutral fallback: it must
   * never again name a piece or a game, because it cannot know either.
   */
  "first-labyrinth": {
    title: "First Challenge Unlocked",
    body: "Your first Special Training is ready.",
    primary: "Enter",
    dismiss: "Later",
    byPiece: {
      rook: {
        title: "First Maze Unlocked",
        body: "Guide the rook to the star in as few moves as you can.",
        primary: "Enter Maze",
      },
      bishop: {
        title: "Diagonal Run Unlocked",
        body: "The bishop only turns on a pivot. Choose them to reach the star.",
        primary: "Start Run",
      },
      knight: {
        title: "Knight's Tour Unlocked",
        body: "Every square you leave closes behind you. Cover as many as you can.",
        primary: "Start Tour",
      },
      queen: {
        title: "Queens Unlocked",
        body: "Place queens so none attack each other. Fill the board.",
        primary: "Start Puzzle",
      },
      pawn: {
        title: "First Maze Unlocked",
        body: "Guide the pawn to the star in as few moves as you can.",
        primary: "Enter Maze",
      },
      king: {
        title: "First Maze Unlocked",
        body: "Guide the king to the star in as few moves as you can.",
        primary: "Enter Maze",
      },
    },
  },
  "special-training": {
    title: "Special Training Unlocked",
    body: "Coordinate the rook and the king.",
    primary: "Start Training",
    dismiss: "Later",
  },
  "piece-badge-eligible": {
    title: "Badge Ready to Claim",
    /** ⛔ Read "Ten stars. The badge is yours." until 2026-08-08 — a rule the
     *  game has not had since the gate moved to 80% COMPLETION. A player with
     *  24 stars and 8 solves saw it and it matched nothing on their screen. */
    body: "Enough exercises cleared. The badge is yours.",
    primary: "Claim Badge",
    dismiss: "Later",
  },
  mastery: {
    title: "Piece Mastered",
    body: "Every exercise, every maze.",
    primary: "Continue",
    dismiss: "Close",
  },
  "great-focus-session": {
    title: "Great Focus Session",
    body: "A deep session, done.",
    primary: "Continue",
    dismiss: "Close",
  },
  absorbed: {
    "great-focus-session": "Great Focus Session recognized.",
    "first-great-session": "Badge unlocked: First Great Session",
    "piece-badge-eligible": "Your badge is ready to claim.",
  },
  /** a11y label for the overlay's X. Flat key (not per-milestone): the
   *  shell renders one close affordance regardless of which step is up. */
  closeLabel: "Close dialog",
} as const;

/**
 * The wallet branch failed to load (spec 2026-08-07-wallet-branch-lazy-load, E3).
 *
 * This state DID NOT EXIST before the branches became lazy: we created it, and
 * we created it in the worst network there is, MiniPay's. The rule it encodes is
 * that a `loading` which never ends is not a valid state — the player gets a
 * terminal message and a way out, never an eternal shell.
 *
 * ⚠️ Both locales are mandatory and neither is exempt from the translation
 * guard: the ES bundle is a top-level spread, NOT a deep merge, so a key added
 * on one side only makes next-intl print the raw path.
 */
export const WALLET_LOAD_ERROR_COPY = {
  title: "Wallet couldn't load",
  body: "Check your connection and try again.",
  retry: "Retry",
} as const;
