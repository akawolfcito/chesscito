import { THEME_CONFIG } from "@/lib/theme";

export const GLOSSARY = {
  badge: "Badge",
  claimBadge: "Claim Badge",
  submitScore: "Submit Score",
  piecePath: "Piece Path",
  trial: "Trial",
  progress: "Progress",
  leaderboard: "Leaderboard",
} as const;

export const CTA_LABELS = {
  startTrial: "Start Trial",
  continue: "Continue",
  claimBadge: GLOSSARY.claimBadge,
  submitScore: GLOSSARY.submitScore,
  retry: "Retry",
  viewLeaderboard: "View Leaderboard",
  backToPlay: "Back to Play",
} as const;

export const FOOTER_CTA_COPY = {
  submitScore: { label: "Submit Score", compactLabel: "Submit", loading: "Submitting..." },
  useShield: { label: "Use Shield", compactLabel: "Shield", loading: "Using Shield..." },
  claimBadge: { label: "Claim Badge", compactLabel: "Claim", loading: "Claiming..." },
  retry: { label: "Retry", compactLabel: "Retry", loading: null },
  connectWallet: { label: "Connect Wallet", compactLabel: "Connect", loading: null },
  switchNetwork: { label: "Switch Network", compactLabel: "Network", loading: null },
  shieldsLeft: (n: number) => `${n} left`,
  submitCanceled: "Submission canceled",
  submitFailed: "Submission failed — try again",
} as const;

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
  title: "Choose a piece",
} as const;

export const MISSION_DETAIL_COPY = {
  title: "Mission",
  scoreLabel: "Score",
  timeLabel: "Time",
  preFirstMoveHint: "Make your first move to start tracking",
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
    title: "Badge Claimed!",
    subtitle: (piece: string) => `${piece} Ascendant is now yours to keep`,
  },
  score: {
    title: "Score Recorded!",
    subtitle: "Sealed on Celo — this record is yours forever.",
  },
  shop: {
    title: "Purchase Complete!",
    subtitle: (item: string) =>
      `${item} acquired — thank you for supporting Chesscito`,
  },
  error: {
    title: "Transaction Failed",
    cancelled: "Transaction was cancelled",
    insufficientFunds: "Not enough funds to complete this transaction",
    network: "Network error — check your connection and try again",
    timeout:
      "This is taking longer than expected. Check your wallet or try again.",
    revert:
      "Transaction failed — this action may not be available right now",
    unknown: "Something went wrong. Please try again",
    /** Per-kind copy for purchase end states (Buy Item Shop, Buy Coach
     *  Credits). Mirrors the cancelled/timeout/error split that
     *  VictoryClaimError.errorKindCopy already uses for Mint Victory,
     *  so a cancellation feels calm ("Nothing was charged") and a
     *  timeout nudges the wallet ("check there before retrying")
     *  instead of dropping users into the generic error string. */
    purchaseKindCopy: {
      error: {
        title: "Purchase Failed",
        subtitle: "Something went wrong while completing your purchase.",
        hint: "No charge was applied. Try again or close and reopen the shop.",
      },
      cancelled: {
        title: "Purchase Cancelled",
        subtitle: "You declined the wallet prompt. Nothing was charged.",
        hint: "Tap the item again any time you change your mind.",
      },
      timeout: {
        title: "Still Confirming…",
        subtitle:
          "The network is taking longer than usual. Your wallet may already have the transaction.",
        hint: "Check your wallet first — if it's still pending, give it a moment before retrying.",
      },
    },
  },
  cta: {
    continue: "Continue",
    tryAgain: "Try Again",
    dismiss: "Dismiss",
    viewOnCeloscan: "View on CeloScan",
  },
} as const;

export const PIECE_COMPLETE_COPY = {
  title: "All Exercises Complete!",
  subtitleWithNext: (next: string) =>
    `You've mastered this piece! The ${next} awaits.`,
  subtitleFinal:
    "You've conquered every piece. Now prove it in the Arena!",
  subtitleKeepPracticing:
    "Keep pushing — more stars unlock your badge!",
  tryArena: "Try Arena",
  nextPiece: (piece: string) => `Start ${piece}`,
  practiceAgain: "Practice Again",
  /** Re-surface of the Submit Score transactional moment from
   *  BadgeEarnedPrompt. Same wording so the player recognizes it. */
  submitScore: "Submit Score",
  /** Tertiary discovery link for the Coach feature. Only rendered when
   *  the primary CTA is "Start <next piece>" — when the primary is
   *  already "Try Arena" we skip it to avoid a duplicate Arena hop. */
  coachHint: "Try Coach review in Arena",
} as const;

export const BADGE_EARNED_COPY = {
  title: (piece: string) => `${piece} Ascendant Earned`,
  claimBadge: "Claim Badge",
  submitScore: "Submit Score",
  later: "Later",
} as const;

export const BADGE_SHEET_COPY = {
  title: "Your Badges",
  subtitle: "Collect all three to master the board",
  owned: "Owned",
  claimBadge: "Claim Badge",
  claiming: "Claiming...",
  locked: (needed: number) => `Need ${needed} more ★ to unlock`,
  notStarted: "Complete trials to start",
  viewTrophies: "View your Victories",
} as const;

export const TUTORIAL_COPY = {
  rook: "The Rook moves in straight lines — horizontal or vertical",
  bishop: "The Bishop moves diagonally — any distance",
  knight: "The Knight jumps in an L-shape — 2+1 squares",
  pawn: "The Pawn moves forward one square — captures diagonally",
  queen: "The Queen moves any direction — any distance",
  king: "The King moves one square in any direction",
} as const;

export const CAPTURE_COPY = {
  statsLabel: "CAPTURE",
  tutorialBanner: "Capture the target — move your Rook to its square",
} as const;

export const SHIELD_COPY = {
  label: "Retry Shield",
  subtitle: "Failed a trial? Use a shield to try again without penalty.",
  useShield: "Use Shield",
  shieldsLeft: (n: number) => `${n} left`,
  shieldUsed: "Shield used!",
  buyLabel: "Buy (3 uses)",
} as const;

export const INVITE_COPY = {
  button: "Invite",
  text: "Come learn chess with me on Chesscito!",
  url: "https://chesscito.vercel.app",
  copied: "Link copied!",
} as const;

export const SHARE_COPY = {
  button: "Share",
  badge: (piece: string, stars: number) =>
    `I just earned the ${piece} Ascendant badge on Chesscito! ${stars}/15 stars`,
  score: (stars: number) =>
    `I just submitted my score on Chesscito! ${stars}/15 stars`,
  shop: (item: string) =>
    `I just got ${item} on Chesscito!`,
  fallbackCopied: "Copied to clipboard!",
  url: "https://chesscito.vercel.app",
} as const;

export const PHASE_FLASH_COPY = {
  success: "Well done!",
  failure: "Try again",
} as const;

export const SHOP_SHEET_COPY = {
  title: "Arcane Store",
  description: "Choose an item to support your practice.",
  featured: "Featured",
  buyButton: "Buy with stablecoin",
  /** Companion CTA shown next to the USDC button on the Founder Badge
   *  card when running outside MiniPay. Routes to the helper itemId
   *  whose priceUsd6 is calibrated so the contract charges 1 CELO
   *  rather than the ~10 % CELO equivalent of $0.10. */
  buyWithCelo: "Buy with 1 CELO",
  buyButtonComingSoon: "Coming soon",
  buyButtonUnavailable: "Unavailable",
  empty: "Shop items are not available right now.",
  moreSoonTitle: "More treasures coming",
  moreSoonHint: "Skins, cosmetics and boosters are brewing in the workshop.",
  status: {
    available: "Available",
    unavailable: "Unavailable",
    notConfigured: "Coming soon",
  },
} as const;

export const LEADERBOARD_SHEET_COPY = {
  title: "Hall of Rooks",
  description: "Check the leaderboard without leaving the board.",
  columnPlayer: "Player",
  columnScore: "★",
  loading: "Loading...",
  empty: "No scores recorded yet.",
  error: "Could not load the leaderboard.",
  retry: "Retry",
} as const;

export const PURCHASE_CONFIRM_COPY = {
  title: "Confirm purchase",
  description: "Review the details before signing.",
  confirmButton: "Confirm purchase",
  approving: (token: string) => `Approving ${token}...`,
  buying: "Buying...",
  miniPayWarning: "MiniPay may show \"Unknown transaction\". This screen describes the expected action before signing.",
  cancel: "Cancel",
} as const;

export const STATUS_STRIP_COPY = {
  walletNotConnected: "Connect your wallet to play",
  networkReady: "Network ready",
  switchNetwork: "Switch to the supported network",
  piecePathComplete: "Piece Path complete",
  piecePathInProgress: "Piece Path in progress",
  badgeClaimed: "Claimed",
  badgeReady: "Ready to claim",
  submittingScore: "Submitting score",
  scoreSubmitted: "Score submitted",
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

export const CONNECT_BUTTON_COPY = {
  miniPayDetected: "MiniPay detected",
  openInMiniPay: "Open in MiniPay",
} as const;

export const PASSPORT_COPY = {
  verifiedLabel: "Verified",
  infoBanner: "Verify with Gitcoin Passport to earn a ✓",
  ctaLabel: "Get verified",
  passportUrl: "https://passport.gitcoin.co",
} as const;

export const MISSION_BRIEFING_COPY = {
  label: "MISSION",
  play: "PLAY",
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
} as const;

export const VICTORY_PAGE_COPY = {
  tagline: "Train your mind with pre-chess challenges — a Celo MiniPay game",
  challengeLine: "Can you beat this?",
  acceptChallenge: "Accept Challenge",
  backToHub: "Back to Hub",
  metaCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  metaComplete: (moves: number) => `Complete in ${moves} moves`,
  metaChallenge: (id: string) => `Can you beat that? Victory #${id} saved as a Chesscito victory card.`,
  metaFallback: "Can you beat this? Play Chesscito on Celo.",
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
  claimButton: "Save this Victory",
  claimHelper: "Save this victory permanently and unlock your share card",
  claimValueHint: (price: string) => `Unlock your share card \u2022 ${price}`,
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
  tryAgain: "Try Again",
  shareCard: "Share Card",
  challengeFriend: "Challenge a Friend",
  challengeText: (moves: number, url: string) =>
    `I solved this in ${moves} moves. Can you beat me?\nPlay Chesscito on Celo 👉 ${url}`,
  copyLink: "Copy Link",
  copiedToast: "Copied!",
  sharedToast: "Shared!",
  viewTrophies: "View your Victories",
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
  errorRecoveryHint: "Your game result is saved. You can try saving again anytime.",
  /** Per-kind copy for the recoverable end states the claim flow can
   *  land in. The default "error" branch matches the historical
   *  errorTitle/errorSubtitle/errorRecoveryHint values so existing
   *  surfaces stay visually identical. */
  errorKindCopy: {
    error: {
      title: "Couldn't save your victory",
      subtitle: "Something went wrong while saving your result.",
      hint: "Your game result is saved. You can try saving again anytime.",
    },
    cancelled: {
      title: "Claim cancelled",
      subtitle: "You declined the wallet prompt. Your victory is still here when you are ready.",
      hint: "Nothing was charged. Tap try again to resume.",
    },
    timeout: {
      title: "Still confirming…",
      subtitle: "The network is taking longer than usual. Your wallet may already have the transaction.",
      hint: "Check your wallet first — if it's still pending, give it a moment before retrying.",
    },
  },
} as const;

export const VICTORY_CELEBRATION_COPY = {
  title: "Victory",
  /** Emotion headline shown big and first, BEFORE the stats line.
   *  Games are felt before they're counted — lead with the word the
   *  player came to hear. */
  headlineCheckmate: "Checkmate!",
  headlineWin: "Victory!",
  performanceLine: (moves: number, time: string) =>
    `Solved in ${moves} moves — ${time}`,
  performanceLineCheckmate: (moves: number, time: string) =>
    `Checkmate in ${moves} moves — ${time}`,
  shareTextBasic: (moves: number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nPlay Chesscito on Celo 👉 ${url}`,
  shareTextClaimed: (moves: number, tokenId: bigint | number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nI saved my Chesscito victory card #${tokenId} 👉 ${url}`,
  stats: { difficulty: "level", moves: "moves", time: "time" },
} as const;

export const TROPHY_VITRINE_COPY = {
  pageTitle: "Trophy Case",
  pageDescription: "Your verifiable victories, immortalized.",
  myVictories: "My Victories",
  hallOfFame: "Hall of Fame",
  movesLabel: "moves",
  shareLabel: "Share",
  loadingText: "Loading victories...",
  copiedToast: "Link copied!",
  connectWallet: "Connect wallet to see your victories",
  connectWalletButton: "Connect Wallet",
  noVictories: "No victories yet — win in the Arena to earn your first trophy",
  noGlobalVictories: "No victories recorded yet — be the first!",
  loadError: "Could not load victories — tap to retry",
  tapToRetry: "Tap to retry",
  configError: "Trophies unavailable",
  roadmap: "More coming soon — Tournaments • VIP Passes • Seasonal Rewards",
  arenaLink: "Go to Arena",
  cardIdPrefix: "Card",
} as const;

/** Achievement surface copy (feature #23). Achievements are derived from
 *  existing on-chain Victory NFT data — no new contracts. Keep titles
 *  short (2–3 words) and descriptions under 60 chars. */
export const ACHIEVEMENTS_COPY = {
  sectionTitle: "Achievements",
  sectionDescription: (earned: number, total: number) => `${earned} of ${total} unlocked`,
  emptyHint: "Win in the Arena to start unlocking achievements.",
  lockedLabel: "Locked",
  earnedLabel: "Earned",
  progressLabel: (current: number, goal: number) => `${current}/${goal}`,
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
  },
} as const;

/** Roadmap surface (feature #23). Non-speculative — explicitly "soon". */
export const ROADMAP_COPY = {
  sectionTitle: "On the roadmap",
  sectionDescription: "What's coming to Chesscito.",
  soonTag: "Soon",
  items: [
    {
      title: "Tournaments",
      description: "Scheduled brackets with shared prize pools.",
    },
    {
      title: "VIP Passes",
      description: "Entry passes tied to future Celo community events.",
    },
    {
      title: "Seasonal Rewards",
      description: "Rotating challenges with unique verifiable collectibles.",
    },
  ],
} as const;

export const ARENA_COPY = {
  title: "Arena",
  subtitle: "Challenge the AI",
  difficulty: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },
  difficultyDesc: {
    easy: "Friendly AI — makes mistakes often",
    medium: "Solid player — a fair challenge",
    hard: "Expert — plays to win",
  },
  startMatch: "Enter Arena",
  backToHub: "Back to Hub",
  playAsWhite: "Play as White",
  playAsBlack: "Play as Black",
  resign: "Resign",
  undo: "Undo",
  yourTurn: "Your Turn",
  newGame: "New Game",
  aiThinking: "AI is thinking...",
  preparingAi: "Preparing AI...",
  promotionTitle: "Promote pawn to:",
  endState: {
    checkmate: {
      win: "Checkmate — You Win!",
      lose: "Checkmate — AI Wins",
    },
    stalemate: "Stalemate — Draw",
    draw: "Draw",
    resigned: "You Resigned",
  },
  playAgain: "Play Again",
  /** Soft-gate banner shown only on direct /arena entry when the player
   *  has no recorded piece-path progress. Intent: guide rookies into the
   *  tutorial without gatekeeping. Two decisive CTAs replace the old
   *  question + Skip pattern: games don't ask permission to exist. */
  softGateTitle: "Want a warm-up first?",
  softGateBody: "Learn a piece in under 2 minutes, then challenge the AI.",
  softGateLearn: "Learn a piece",
  softGateEnter: "Jump into Arena",
  /** Prize pool surface — shown above the difficulty picker on direct
   *  /arena entry. Communicates what the 20% mint-fee cut becomes,
   *  transparently acknowledging distribution is not yet live. */
  prizePoolLabel: "Community prize pool",
  prizePoolLoading: "Loading pool…",
  prizePoolUnavailable: "Pool unavailable",
  prizePoolSoonHint: "Distribution v2 coming — 20% of every saved Victory funds the community pool",
  aiError: "AI disconnected",
  aiTimeout: "AI timed out",
  engineError: "Engine error — please restart the match",
  restartMatch: "Restart Match",
  boardError: "Board error — please restart the game",
} as const;

export const EXERCISE_DRAWER_COPY = {
  title: "Exercises",
  progressLabel: (earned: number, max: number) => `${earned}/${max}`,
  badgeThresholdHint: (threshold: number) => `Badge at ${threshold} stars`,
  locked: "Locked",
} as const;

export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  "rook-1": "Horizontal move",
  "rook-2": "Vertical move",
  "rook-3": "Center to edge",
  "rook-4": "Corner capture",
  "rook-5": "Cross capture",
  "bishop-1": "Main diagonal",
  "bishop-2": "Anti diagonal",
  "bishop-3": "Short diagonal",
  "bishop-4": "Two-move path",
  "bishop-5": "Tricky route",
  "knight-1": "L-jump center",
  "knight-2": "L-jump corner",
  "knight-3": "Horizontal L",
  "knight-4": "Two jumps",
  "knight-5": "Long journey",
  "pawn-1": "Forward step",
  "pawn-2": "Forward march",
  "pawn-3": "Diagonal capture",
  "pawn-4": "Capture decision",
  "pawn-5": "Mixed path",
};

export const PRACTICE_COPY = {
  label: "Practice mode",
} as const;

/** L2 Labyrinth — second level of per-piece pedagogy ladder.
 *  Unlocked after L1 mastery (badge claimable). Player navigates
 *  obstacles to reach the star in minimum moves. */
export const LABYRINTH_COPY = {
  toggleExercises: "Exercises",
  toggleLabyrinths: "Labyrinths",
  tryLabyrinth: "Try Labyrinth",
  /** Demoted text-link variant of tryLabyrinth — used when the action
   *  is offered alongside more important CTAs (e.g. PieceComplete) and
   *  needs to read as an alternative branch, not a competing primary. */
  orTryLabyrinth: "or try Labyrinth →",
  missionTitle: "Labyrinth",
  missionHint: (optimal: number) => `Reach the star · optimal ${optimal} moves`,
  movesLabel: (n: number) => `${n} ${n === 1 ? "move" : "moves"}`,
  completeTitle: "Labyrinth Solved!",
  completeStars: (stars: number) => `${stars}/3 ★`,
  completeMoves: (moves: number, optimal: number) =>
    moves === optimal
      ? `Optimal! ${moves} moves`
      : `${moves} moves · optimal ${optimal}`,
  retry: "Try Again",
  back: "Back to Exercises",
} as const;

export const DOCK_LABELS = {
  /** Center tab — routes to /arena. Short name matches the route + the
   *  page's own title ("Arena"). Previous label "Free Play" was
   *  ambiguous ("is there Paid Play?"). */
  arena: "Arena",
  /** Item labels — only rendered when the tab is active so the dock
   *  stays compact + the active state feels like a lift out of the
   *  bar. Trophies replaced Invite in the primary dock: Invite is a
   *  transient share action (lives in About + Victory share), while
   *  Trophies is a retention destination that earns a persistent slot. */
  badge: "Badges",
  shop: "Shop",
  trophies: "Trophies",
  leaderboard: "Leaders",
} as const;

export const ARENA_CTA_COPY = {
  label: "Enter Arena",
} as const;

export const ABOUT_LINK_COPY = {
  label: "About Chesscito",
} as const;

export const SPLASH_COPY = {
  loading: "Loading…",
  subtitle: "Setting up the board",
} as const;

export const COACH_COPY = {
  askCoach: "Ask the Coach",
  askCoachSub: "What can I improve?",
  loading: "Loading...",
  quickReviewTitle: "Quick Review",
  coachAnalysisTitle: "Coach Analysis",
  keyMoments: "KEY MOMENTS",
  whatYouDidWell: "WHAT YOU DID WELL",
  takeaways: "TAKEAWAYS",
  tips: "TIPS",
  yourSessions: "Your Sessions",
  pastSessions: "Past Sessions",
  yourProgress: "YOUR PROGRESS",
  gamesAnalyzed: (n: number) => `Games analyzed: ${n}`,
  highestDifficulty: (d: string) => `Highest difficulty: ${d}`,
  currentStreak: (n: number) => `Current streak: ${n} wins`,
  creditTitle: "Coach Credits",
  creditExplain: "1 credit = 1 full game analysis",
  creditPack5: "5 analyses",
  creditPack20: "20 analyses",
  creditBest: "BEST",
  buyWithUsdc: "Buy with stablecoin",
  orQuickReview: "Or try Quick Review for free",
  getFullAnalysis: "Get Full Analysis",
  getFullAnalysisSub: "See your key moments and personalized tips",
  analyzing: "Analyzing your game",
  reviewingMoves: "Reviewing your moves",
  canLeave: "You can leave — we'll keep your result ready",
  analysisReady: "Your analysis is ready",
  analysisProcessing: "Your analysis is still processing...",
  analysisFailed: "Analysis couldn't be completed. Your credit was not spent.",
  coachResting: "Coach is resting. Try again later.",
  cancel: "Cancel",
  retry: "Retry",
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
  claimFree: "Claim Free Analyses",
  welcomeNote: "Free analyses to start. After that, credit packs from $0.05.",
  creditComingSoon: "Credit packs coming soon!",
  // --- Secondary Screen Cohesion (2026-03-28) ---
  loadingCanLeave: "You can leave — your result will be ready when you return.",
  creditPackSubtitle: (n: number) => `${n} game analyses`,
  unlockFullAnalysis: "Unlock Full Analysis",
} as const;

export const LEGAL_COPY = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 15, 2026",
    sections: [
      {
        heading: "Service Description",
        body: "Chesscito is an educational pre-chess game experience on the Celo blockchain, accessible via MiniPay. The service provides interactive chess piece movement puzzles with on-chain collectibles.",
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
        body: "Certain actions — including badge claims, score submissions, shop purchases, and NFT mints — interact with smart contracts on the Celo blockchain. These transactions are irreversible once confirmed on-chain.",
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
    lastUpdated: "March 15, 2026",
    sections: [
      {
        heading: "Data We Handle",
        body: "When you use Chesscito, the following data is involved: your public wallet address (provided by your wallet at connection), on-chain interaction data such as scores, badges, and purchases (publicly visible on the Celo blockchain), and local app state including tutorial progress, shield count, and gameplay preferences.",
      },
      {
        heading: "Data We Do Not Collect",
        body: "Chesscito does not collect passwords, seed phrases, government-issued identification, personal identifiable information (PII), or analytics and tracking cookies.",
      },
      {
        heading: "Local Storage",
        body: "Tutorial state, gameplay preferences, retry shields, and UX settings are stored on your device for UX purposes. On-chain actions and related blockchain data are public by nature and may be transmitted through wallet and network infrastructure required to operate the app.",
      },
      {
        heading: "Third-Party Infrastructure",
        body: "Chesscito uses Celo RPC providers for blockchain reads and writes, and WalletConnect for wallet connection. We do not use analytics vendors or ad networks.",
      },
      {
        heading: "Purpose of Data Use",
        body: "Data is used solely to operate the game: validate moves, record scores, process purchases, and mint collectibles.",
      },
      {
        heading: "Data Retention",
        body: "On-chain data is permanent by nature of blockchain. Local data stored on your device can be cleared by you at any time through your browser settings.",
      },
      {
        heading: "Contact",
        body: `For privacy-related questions, visit our Support page or email ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "our support team"}.`,
      },
    ],
  },
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
    technicalIssues: "Technical Issues",
    howToReport: "How to Report an Issue",
  },
} as const;

export const ABOUT_COPY = {
  title: "Chesscito",
  operatedBy: "Operated by Wolfcito",
  handle: "@akawolfcito",
  version: "v0.1.0",
  links: {
    /** Public landing — opens the /why narrative for parents,
     *  sponsors, and curious players. Lives at the top of the
     *  About link list so it's the first discovery surface. */
    why: "Por qué Chesscito",
    support: "Support",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    invite: "Invite a Friend",
  },
  clipboardFeedback: "Copied!",
  shareTitle: "Chesscito",
  shareText:
    "Learn chess piece movements with gamified, verifiable challenges on Celo.",
  shareUrl: "https://chesscito.vercel.app",
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
    "Chesscito's curriculum is designed by a real human team. Pedagogy by FIDE Master César Litvinov Alarcón — over 100 students supported, with alumni who have competed in national and international tournaments.",
  cesar: "César Litvinov Alarcón · FIDE Master",
  wolfcito: "Wolfcito · Co-Founder",
} as const;

export const UNLOCK_COPY = {
  title: (piece: string) => `${piece} Unlocked!`,
  cta: (piece: string) => `Start ${piece}`,
} as const;

export const SHOP_ITEM_COPY = {
  founderBadge: {
    label: "Founder Badge",
    subtitle:
      "Support the mission from its earliest days. An exclusive badge that's yours to keep.",
  },
  retryShield: {
    label: "Retry Shield",
    subtitle:
      "Protect your practice rhythm. Three retries for tough captures — keep going without losing your streak.",
  },
  /** Coach Credits — value-prop copy for an eventual Coach Pack tile
   *  in the shop sheet (parallel to Founder Badge / Retry Shield).
   *  Pack size labels are intentionally NOT here — those live in
   *  COACH_COPY.creditPack5/20 since the Coach paywall is the only
   *  surface that renders pack tiles today. If a shop tile ever
   *  surfaces Coach Packs, it should read pack labels from the same
   *  COACH_COPY source to avoid drift. */
  coachPack: {
    label: "Coach Credits",
    subtitle: "Try AI analysis without committing to a subscription.",
  },
} as const;

/** Chesscito PRO — first commercial SKU. Phase 0 scope: monthly pass
 *  that bypasses Coach credit consumption only. Other premium perks
 *  (Arena, achievements, VictoryNFT discounts) are roadmap-only copy
 *  for now — do not wire them up server-side. See
 *  docs/superpowers/plans/2026-04-29-pro-phase-0.md. */
export const PRO_COPY = {
  label: "Chesscito PRO",
  tagline: "Your training plan. Your way to keep Chesscito free for everyone.",
  subtitle: "Monthly pass that supports open access. Renew when you want — no auto-billing.",
  priceLabel: "$1.99 / month",
  durationLabel: "30 days",
  ctaBuy: "Start training",
  ctaActive: "PRO Active",
  ctaRenew: "Extend training",
  /** Active-state post-purchase CTA. PRO active users see this above
   *  the Renew button; tapping routes to `/arena` so they can play a
   *  match — Coach analysis surfaces in the post-game flow. Spec:
   *  docs/superpowers/plans/2026-05-02-product-stabilization-sprint.md
   *  Commit 1. */
  activeStateCta: "Play Arena",
  activeStateCopyEnabled:
    "After your match, PRO unlocks Coach analysis so you can review your decisions.",
  activeStateCopyDisabled:
    "Coach analysis is included with PRO and will appear after your Arena match.",
  statusActiveSuffix: (daysLeft: number) =>
    daysLeft === 1 ? "Expires tomorrow" : `${daysLeft} days left`,
  /** `<ProActiveBadge />` pill labels. ACTIVE for daysLeft > 3,
   *  EXPIRING when ≤ 3 — flips pill color emerald → amber. Spec:
   *  _bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md §3.3 */
  statusBadgeActive: "ACTIVE",
  statusBadgeExpiring: "EXPIRING",
  /** `<ProActiveCTA />` surface-aware copy. Navigational variant fires
   *  from /play-hub, /trophies, /leaderboard, /about, /why, / and any
   *  unmatched path. Close-only variant fires from /arena to avoid
   *  the mid-match nav footgun. Spec: §3.4 of the same addendum. */
  activeCtaPlay: "Play in Arena",
  activeCtaGotIt: "Got it",
  activeSublineHub: "Coach reviews after the match",
  activeSublineArena: "Coach activates after checkmate",
  /** Mission framing rendered between the perks list and the CTA. PRO
   *  is positioned as both a personal training plan and a way to
   *  sustain free access for new players, families and schools. */
  missionNote:
    "Every PRO subscription helps us keep the free tier open for new players, families, and schools.",
  /** Floating chip in play-hub. Kept tight (28px tall, max 120px wide)
   *  so the inactive label has to be a single short token. We dropped
   *  the old "GET PRO" because it read transactional; "PRO" alone with
   *  the ✦ icon already signals the premium tier without selling. */
  chip: {
    inactive: "PRO",
    activePrefix: "PRO",
  },
  perksActive: [
    "AI Coach with no daily limit",
    "Your contribution keeps Chesscito free for new players",
  ] as const,
  perksRoadmap: [
    "Early access to new challenges (coming soon)",
    "Tournament priority (coming soon)",
    "Premium achievements (coming soon)",
    "Discounts on victory cards (coming soon)",
  ] as const,
  errors: {
    notConfigured: "PRO is not yet active. Check back shortly.",
    purchaseFailed: "Purchase could not be verified. Please try again.",
    walletRequired: "Connect your wallet to purchase PRO.",
    verifyFailedTitle: "Payment confirmed — verification pending.",
    verifyFailedReassurance:
      "Your transaction is preserved on-chain. Retry won't double-charge.",
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
  proManageLabel: "Manage Chesscito PRO",
  proViewLabel: "View Chesscito PRO",
  proInactiveLabel: "PRO",
  proLoadingAriaLabel: "Loading PRO status",
} as const;

/** /why public landing page copy. Spanish-only in v1 by product
 *  decision (English version is a follow-up sprint). All strings are
 *  centralized here per the no-inline-copy rule of the codebase.
 *
 *  Strict editorial: never make medical / clinical claims. The
 *  cognitive disclaimer must render at least twice on the page
 *  (inline + footer) per the spec at
 *  docs/superpowers/specs/2026-04-25-why-landing-page-design.md. */

/** Cognitive disclaimer used inside the app shell (play-hub footer,
 *  arena footer) and any other non-landing surface that mentions
 *  cognitive practice/wellness. Lives separately from WHY_PAGE_COPY
 *  / LANDING_COPY so it can be lifted into in-game contexts without
 *  pulling in the whole landing block. The two variants exist so the
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

export const WHY_PAGE_COPY = {
  meta: {
    title: "Chesscito — Juega. Piensa. Entrena tu mente.",
    description:
      "Una aventura de retos inspirados en ajedrez para fortalecer atención, memoria y toma de decisiones mediante juego.",
  },
  back: "Volver",
  hero: {
    eyebrow: "BIENESTAR COGNITIVO LÚDICO",
    headline: "Juega. Piensa. Entrena tu mente.",
    subcopy:
      "Una aventura de retos inspirados en ajedrez para fortalecer atención, memoria y toma de decisiones mediante juego.",
    primaryCta: "Empezar a jugar",
    secondaryCta: "Conocer el propósito",
  },
  preChess: {
    title: "Ajedrez antes del ajedrez.",
    body:
      "En Chesscito convertimos piezas, movimientos y decisiones en retos cortos, visuales y fáciles de jugar. No necesitas saber jugar ajedrez para empezar — solo curiosidad.",
    bullets: [
      "Movimientos sencillos",
      "Tableros guiados",
      "Sin presión de tiempo",
    ] as const,
  },
  cognitive: {
    title: "Diseñado para estimular la mente.",
    body:
      "Cada reto está pensado para activar habilidades clave: atención sostenida, memoria visual, planificación, reconocimiento de patrones y toma de decisiones bajo restricciones simples.",
    capabilities: [
      { icon: "crosshair", label: "Atención" },
      { icon: "star", label: "Memoria visual" },
      { icon: "move", label: "Planificación" },
      { icon: "refresh", label: "Patrones" },
      { icon: "crown", label: "Decisiones" },
    ] as const,
    disclaimer:
      "Chesscito no reemplaza tratamiento médico. Es una experiencia lúdica de acompañamiento cognitivo.",
  },
  progress: {
    title: "Progreso que se siente como aventura.",
    body:
      "Avanzas por mundos, completas retos, ganas estrellas, desbloqueas piezas y coleccionas insignias que viven contigo. Cada paso suma — sin atajos, sin trampas.",
    bullets: [
      "Mundos por desbloquear",
      "Estrellas por reto",
      "Insignias coleccionables",
    ] as const,
  },
  community: {
    title: "Una herramienta simple para acompañar el bienestar cognitivo.",
    body:
      "Pensado para que cualquier persona — un niño en casa, una familia, un docente, una comunidad o una institución — pueda integrarlo a una rutina sana de ejercicio mental.",
    cards: [
      {
        title: "Familias",
        body:
          "Una rutina ligera para compartir minutos de juego y conversación.",
      },
      {
        title: "Educadores",
        body:
          "Material lúdico que complementa actividades de aula sin pedir instalación.",
      },
      {
        title: "Comunidades",
        body:
          "Una experiencia abierta que cualquier programa puede ofrecer a sus participantes.",
      },
    ] as const,
  },
  sponsors: {
    title: "Construido para impacto.",
    body:
      "Buscamos aliados que crean en el juego como vehículo de bienestar cognitivo y aprendizaje. Tu apoyo nos ayuda a llegar a más personas — más niños, más comunidades, más impacto.",
    denLabs:
      "Chesscito es el primer experimento de Den Labs, un laboratorio que combina tecnología web2/web3 e IA para crear experiencias con propósito.",
    contactPrimary: "Escríbenos",
    contactSecondary: "GitHub Issues",
    githubUrl: "https://github.com/wolfcito/chesscito/issues",
  },
  finalCta: {
    headline: "¿Listo para hacer tu primera jugada?",
    cta: "Empezar a jugar",
    note:
      "Sin descargas. Sin registros largos. Solo el tablero, tú y tu próximo movimiento.",
  },
  footer: {
    brand: "Chesscito · A Den Labs experiment",
    year: "© 2026 Den Labs",
  },
} as const;

/* ════════════════════════════════════════════════════════════════
 *  LANDING_COPY — v0.5 narrative (locked).
 *
 *  Source of truth:
 *  docs/superpowers/specs/2026-04-25-landing-narrative-v0.5.md
 *
 *  Strategy: WHY_PAGE_COPY above stays untouched so the current
 *  landing keeps rendering. The upcoming commits (C3–C8) build the
 *  new sections against LANDING_COPY without breaking anything;
 *  C9 swaps the hero / final CTA / footer render to LANDING_COPY
 *  and removes the legacy WHY_PAGE_COPY block in a single
 *  coordinated commit.
 *
 *  Never make medical / clinical / absolute claims here. The
 *  disclaimer is the only place clinical vocabulary appears,
 *  intentionally, to draw the line.
 * ════════════════════════════════════════════════════════════════ */

export const LANDING_COPY = {
  meta: {
    title: "Chesscito — Pequeñas jugadas. Grandes hábitos mentales.",
    description:
      "Chesscito convierte el ajedrez en retos visuales de pocos minutos para ejercitar atención, memoria, planificación y toma de decisiones desde edades tempranas.",
  },

  /** Disclaimer — required to render at least twice on the landing
   *  (capabilities section + footer). Single source so any wording
   *  edit propagates everywhere. */
  disclaimer:
    "Chesscito es una experiencia lúdica de acompañamiento cognitivo. No reemplaza diagnóstico, tratamiento médico ni terapia profesional.",

  /** Header brand bar shared across the page. */
  nav: {
    brand: "Chesscito",
    primaryCta: "Empezar gratis",
  },

  /** §1 Hero — locked replacement for WHY_PAGE_COPY.hero. */
  hero: {
    eyebrow: "BIENESTAR COGNITIVO LÚDICO",
    headline: "Pequeñas jugadas. Grandes hábitos mentales.",
    subcopy:
      "Chesscito convierte el ajedrez en retos visuales de pocos minutos para ejercitar atención, memoria, planificación y toma de decisiones desde edades tempranas.",
    primaryCta: "Empezar gratis",
    secondaryCta: "Conocer la iniciativa",
  },

  /** §2 Problem — new section, no parallel in v0.1 copy. */
  problem: {
    title: "La mente también necesita rutina.",
    body:
      "Tienes rutina para tu cuerpo. Para tu sueño. Hasta para tu nutrición. Pero ¿una para tu mente? Atención, memoria, planificación y decisiones son habilidades. Como cualquier habilidad, se fortalecen con práctica constante.",
    claims: [
      {
        icon: "coach" as const,
        label:
          "Se fortalecen con repetición consciente, no con esfuerzo bruto.",
      },
      {
        icon: "star" as const,
        label: "Mientras antes empieces, más fácil es crear el hábito.",
      },
      {
        icon: "time" as const,
        label: "10 minutos diarios pueden construir un hábito poderoso.",
      },
    ],
  },

  /** §3 Solution — body identical to v0.1 preChess; duplicated here
   *  so LANDING_COPY is self-sufficient and C9 can drop WHY_PAGE_COPY
   *  cleanly. */
  solution: {
    title: "Ajedrez antes del ajedrez.",
    body:
      "No necesitas saber jugar para empezar. En Chesscito conviertes cada pieza en retos cortos, visuales y guiados. Aprendes cómo se mueve, resuelves laberintos con ella, dominas su identidad. Cuando ya juntas todas las piezas, el ajedrez completo se desbloquea solo — sin acantilados, sin clases pesadas, sin frustración.",
  },

  /** §4 How it works — new five-step ladder. */
  howItWorks: {
    title: "Una escalera, no una pared.",
    body:
      "Cada pieza vive en tres niveles. Los dominas por etapas. El mapa avanza contigo, una pieza a la vez.",
    steps: [
      {
        label: "APRENDE",
        body: "La pieza se mueve así. Simple. Claro. Sin presión.",
      },
      {
        label: "EXPLORA",
        body: "Laberintos con obstáculos. Mínimos movimientos, máximo de estrellas.",
      },
      {
        label: "DOMINA",
        body: "Un reto único por pieza que exprime su identidad.",
      },
      {
        label: "COMBINA",
        body: "Torres y alfiles. Después la dama. Después el caballo. El tablero crece contigo.",
      },
      {
        label: "JUEGA",
        body: "El ajedrez completo se desbloquea solo. Lo lograste tú, paso a paso.",
      },
    ],
  },

  /** §5 Capabilities — softened title vs v0.1, plus a body line per
   *  item. Pulls disclaimer from the top-level field above. */
  capabilities: {
    title: "Cinco habilidades que te acompañan a lo largo del tiempo.",
    items: [
      {
        icon: "crosshair" as const,
        label: "Atención sostenida",
        body: "Foco que aguanta los distractores.",
      },
      {
        icon: "star" as const,
        label: "Memoria visual",
        body: "Leer y recordar el tablero como patrón.",
      },
      {
        icon: "move" as const,
        label: "Planificación",
        body: "Pensar varios pasos antes de mover.",
      },
      {
        icon: "refresh" as const,
        label: "Reconocimiento de patrones",
        body: "Ver lo familiar en lo nuevo.",
      },
      {
        icon: "crown" as const,
        label: "Toma de decisiones",
        body: "Elegir bajo restricciones simples.",
      },
    ],
  },

  /** §6 Audiences — softened from "ventana / toda la vida". */
  audiences: {
    title: "Hecho para empezar pronto. Útil a cualquier edad.",
    cards: [
      {
        title: "Niños y adolescentes (8–16)",
        body:
          "Una etapa clave para cultivar hábitos cognitivos que pueden acompañar a lo largo del tiempo.",
      },
      {
        title: "Familias",
        body:
          "Una rutina ligera para compartir minutos de juego, conversación y crecimiento personal — sin pantallazos infinitos.",
      },
      {
        title: "Educadores y comunidades",
        body:
          "Material lúdico que complementa actividades de aula, clubes y programas sociales. Sin instalación pesada, sin curva técnica.",
      },
    ],
  },

  /** §7 Plans — "Un modelo donde nadie se queda fuera."
   *  Aligned with docs/business/business-model-2026-04-28.md.
   *  Order: Gratuito → PRO (featured, primary commercial CTA) →
   *  Familia (waitlist) → Educadores y Aliados (outbound).
   *  Render rules in C6:
   *    - tier.featured = true  → primary filled button (game-primary).
   *    - tier.ctaKind === "internal" → routes to /hub.
   *    - tier.ctaKind === "mailto"   → composes mailto with subject.
   *    - tier.priceLabel             → small price tag under tagline.
   *    - tier.badge                  → soft pill next to the name. */
  plans: {
    title: "Un modelo donde nadie se queda fuera.",
    body:
      "Chesscito puede empezar gratis. Las familias, educadores y aliados ayudan a sostener y ampliar el acceso. Web3 hace que cada aporte sea trazable y útil.",
    tiers: [
      {
        name: "GRATUITO",
        tagline: "Para empezar.",
        bullets: [
          "Acceso al ajedrez introductorio",
          "Las primeras piezas con sus niveles",
          "Insignias de progreso verificables",
          "Leaderboard y comunidad pública",
        ],
        ctaLabel: "Empezar gratis",
        ctaKind: "internal" as const,
      },
      {
        name: "CHESSCITO PRO",
        tagline: "Para sostener tu práctica.",
        priceLabel: "Desde $1.99/mes en stablecoin",
        featured: true,
        bullets: [
          "Coach con IA para analizar tus partidas",
          "Retry Shield incluido — sin compras adicionales",
          "Badge PRO visible en tu perfil",
          "Guarda tus victorias sin costo extra",
          "Tu aporte sostiene el acceso gratuito",
        ],
        ctaLabel: "Quiero acceso PRO",
        ctaKind: "mailto" as const,
        ctaSubject: "Chesscito PRO — Quiero acceso",
      },
      {
        name: "FAMILIA",
        tagline: "Para entrenar juntos en casa.",
        badge: "Próximamente",
        bullets: [
          "Pensado para compartir minutos de juego en casa",
          "Sin publicidad, sin distractores",
          "Early access — tu interés nos ayuda a priorizar",
        ],
        ctaLabel: "Avísame cuando esté listo",
        ctaKind: "mailto" as const,
        ctaSubject: "Plan Familia — Lista de espera",
      },
      {
        name: "EDUCADORES Y ALIADOS",
        tagline: "Para ampliar el acceso.",
        bullets: [
          "Licencias para aulas, clubes y programas",
          "Sponsor-a-player o sponsor-a-school",
          "Acompañamiento de un Maestro FIDE",
          "Trazabilidad pública de cada aporte",
        ],
        ctaLabel: "Conversemos",
        ctaKind: "mailto" as const,
        ctaSubject: "Educadores y Aliados",
      },
    ],
    /** Footnote under the grid — small entry point to test the
     *  Coach feature without committing to PRO. Keeps the four-tier
     *  visual hierarchy clean while still surfacing the micro-SKU. */
    complement:
      "También puedes probar el coach con Coach Credits desde $0.05.",
  },

  /** §8 Impact + allies row. Replaces v0.1 sponsors block. */
  impact: {
    title: "Construido para impacto.",
    body:
      "Cada partida deja huella. Cada aliado abre una puerta. Trazabilidad clara, comunidad creciente, propósito explícito.",
    pillars: [
      {
        icon: "share" as const,
        title: "Trazabilidad",
        body: "Cada badge y aporte queda registrado de forma transparente. Pública. Verificable. Sin opacidad.",
      },
      {
        icon: "trophy" as const,
        title: "Escala",
        body: "El motor pedagógico es reutilizable. Detrás de Chesscito vienen otros verticales cognitivos.",
      },
      {
        icon: "crown" as const,
        title: "Comunidad",
        body: "DAOs, fundaciones, clubes, escuelas. El círculo crece con cada alianza.",
      },
    ],
    alliesPlaceholder: "Próximamente.",
  },

  /** §9 Founders — Luis Fernando Ushiña (Wolfcito) + César Litvinov
   *  Alarcón + Den Labs. Updated 2026-04-27: real names primary,
   *  handles secondary; lead reframed away from "web3" jargon and
   *  anchored on the real pedagogical metric (+100 students with
   *  national/international tournament experience). See spec
   *  docs/superpowers/specs/2026-04-27-pitch-video-script.md §6. */
  founders: {
    title: "La gente detrás de Chesscito.",
    lead:
      "Una combinación poco común: tecnología, IA y un Maestro FIDE con décadas de aula. La metodología detrás de Chesscito viene de más de 100 estudiantes acompañados — incluyendo alumnos que compitieron en torneos nacionales e internacionales.",
    cards: [
      {
        name: "Luis Fernando Ushiña",
        handle: "aka Wolfcito",
        title: "Software Developer Architect · Co-Founder Chesscito",
        body: "Lidera producto, tecnología y la visión de plataforma cognitiva escalable.",
      },
      {
        name: "César Litvinov Alarcón",
        handle: null,
        title: "Maestro FIDE · Entrenador · Co-Founder Chesscito",
        body: "Trayectoria en escuelas e instituciones, incluyendo Concentración Deportiva de Pichincha en Ecuador. Aporta la pedagogía y la metodología de cada nivel.",
      },
      {
        name: "Den Labs",
        handle: null,
        title: "Parent brand",
        body: "Laboratorio que combina web2, web3 e IA para construir experiencias digitales con propósito. Chesscito es su primer experimento.",
      },
    ],
  },

  /** §10 Final CTA — locked v0.5 wording. Replaces WHY_PAGE_COPY.finalCta
   *  in C9. */
  finalCta: {
    headline: "¿Listo para tu primera jugada?",
    subcopy:
      "Sin descargas. Sin registros largos. Solo el tablero, tú y tu próximo movimiento.",
    primaryCta: "Empezar gratis",
    secondaryCta: "Hablar con el equipo",
  },

  /** Footer brand line + year. Disclaimer is rendered separately
   *  from the top-level `disclaimer` field above. */
  footer: {
    brand: "Chesscito · A Den Labs experiment",
    year: "© 2026 Den Labs",
  },

  /** Microcopy shared across loading / error / confirm flows on the
   *  landing CTAs. Surfaces them as reusable keys so every section
   *  composer pulls the same wording. */
  microcopy: {
    loading: "Preparando…",
    error: "Vuelve a intentarlo",
    confirm: "Listo. Te escribiremos pronto.",
  },
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
  alt: "Chesscito kingdom — Wolfcito the wizard with chess piece statues",
  attractHint: "Your training awaits in the kingdom",
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
  proInactiveAriaLabel: "PRO inactive — tap to learn more",

  /** Connect-wallet chip (top row, conditional — visible only when no
   *  wallet is connected and a connect handler is wired). Acts as a
   *  desktop fallback when `<WalletProvider>`'s MiniPay auto-connect
   *  cannot fire (no injected `window.ethereum.isMiniPay` provider). */
  connectLabel: "Connect",
  connectAriaLabel: "Connect wallet to see your stats",

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
      ? "1 retry shield available"
      : `${count} retry shields available`,

  /** Region container aria-label for the secondary row. */
  secondaryRowAriaLabel: "Player resources",
} as const;

/** Per-surface mission ribbon copy. Consumed by `<MissionRibbon>` (Step 11 §6
 *  of UX spec). Canon rule (strategy doc §11): mission rendered ABOVE the CTA
 *  on every payment surface. The PRO sheet variant aliases the canonical
 *  PRO_COPY.tagline so the line stays single-source. */
export const MISSION_RIBBON_COPY = {
  hub: "Small plays. Big mental habits.",
  arena: "Your training continues, one move at a time.",
  "pro-sheet": PRO_COPY.tagline,
  /** Landing CTA bar stays in Spanish per LANDING_COPY v0.5 locked content. */
  "landing-cta-bar": "Pequeñas jugadas. Grandes hábitos mentales.",
  ariaLabel: "Mission statement",
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
        ? "Claim Rook mastery badge — ready"
        : state === "progress"
          ? "Rook mastery — in progress"
          : "Rook mastery — locked",
  },
  bishop: {
    label: "Bishop mastery",
    claimableHint: "Tap to claim your Bishop badge",
    lockedHint: "Master Rook first, then complete all 3 Bishop levels",
    unlockRequirement: "Complete Bishop L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Bishop mastery badge — ready"
        : state === "progress"
          ? "Bishop mastery — in progress"
          : "Bishop mastery — locked",
  },
  queen: {
    label: "Queen mastery",
    claimableHint: "Tap to claim your Queen badge",
    lockedHint: "Master Rook + Bishop to unlock",
    unlockRequirement: "Master Rook + Bishop",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Queen mastery badge — ready"
        : state === "progress"
          ? "Queen mastery — in progress"
          : "Queen mastery — locked",
  },
  knight: {
    label: "Knight mastery",
    claimableHint: "Tap to claim your Knight badge",
    lockedHint: "Master Queen first, then complete all 3 Knight levels",
    unlockRequirement: "Master Queen, then complete Knight L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Knight mastery badge — ready"
        : state === "progress"
          ? "Knight mastery — in progress"
          : "Knight mastery — locked",
  },
  king: {
    label: "King mastery",
    claimableHint: "Tap to claim your King badge",
    lockedHint: "Master Knight first",
    unlockRequirement: "Master Knight, then complete King L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim King mastery badge — ready"
        : state === "progress"
          ? "King mastery — in progress"
          : "King mastery — locked",
  },
  pawn: {
    label: "Pawn mastery",
    claimableHint: "Tap to claim your Pawn badge",
    lockedHint: "Master King first — Pawn is the boss final",
    unlockRequirement: "Master King, then complete Pawn L1 + L2 + L3",
    ariaLabel: (state: "claimable" | "progress" | "locked") =>
      state === "claimable"
        ? "Claim Pawn mastery badge — ready"
        : state === "progress"
          ? "Pawn mastery — in progress"
          : "Pawn mastery — locked",
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
        ? "Save victory ready — tap to save"
        : state === "progress"
          ? "Victory in progress"
          : "No victory ready — win an Arena match",
  },
} as const;
