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
  submitScore: { label: "Submit Score", loading: "Submitting..." },
  useShield: { label: "Use Shield", loading: "Using Shield..." },
  claimBadge: { label: "Claim Badge", loading: "Claiming..." },
  retry: { label: "Retry", loading: null },
  shieldsLeft: (n: number) => `${n} left`,
} as const;

export const PIECE_LABELS = {
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
} as const;

export const BADGE_TITLES = {
  rook: "Rook Ascendant",
  bishop: "Bishop Ascendant",
  knight: "Knight Ascendant",
} as const;

export const LEADERBOARD_COPY = {
  description: "The best scores recorded on-chain.",
  empty: "No scores recorded yet.",
} as const;

export const RESULT_OVERLAY_COPY = {
  badge: {
    title: "Badge Claimed!",
    subtitle: (piece: string) => `${piece} Ascendant is now in your wallet`,
  },
  score: {
    title: "Score Recorded!",
    subtitle: "Your score is now on-chain",
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
    revert:
      "Transaction failed — this action may not be available right now",
    unknown: "Something went wrong. Please try again",
  },
  cta: {
    continue: "Continue",
    tryAgain: "Try Again",
    dismiss: "Dismiss",
    viewOnCeloscan: "View on CeloScan",
  },
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
} as const;

export const TUTORIAL_COPY = {
  rook: "The Rook moves in straight lines — horizontal or vertical",
  bishop: "The Bishop moves diagonally — any distance",
  knight: "The Knight jumps in an L-shape — 2+1 squares",
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
  description: "Choose an item to purchase with USDC.",
  buyButton: "Buy with USDC",
  status: {
    available: "Available",
    unavailable: "Unavailable",
    notConfigured: "Not configured",
  },
} as const;

export const LEADERBOARD_SHEET_COPY = {
  title: "Hall of Rooks",
  description: "Check the leaderboard without leaving the board.",
  loading: "Loading...",
  empty: "No scores recorded yet.",
  error: "Could not load the leaderboard.",
} as const;

export const PURCHASE_CONFIRM_COPY = {
  title: "Confirm purchase",
  description: "Review the details before signing.",
  confirmButton: "Confirm purchase",
  approving: (token: string) => `Approving ${token}...`,
  buying: "Buying...",
  miniPayWarning: "MiniPay may show \"Unknown transaction\". This screen describes the expected action before signing.",
} as const;

export const STATUS_STRIP_COPY = {
  walletNotConnected: "Wallet not connected",
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
  waitingConfirmation: "Waiting for onchain confirmation.",
  scoreOnchain: "Your score is now recorded onchain.",
  badgeOnchain: "Your badge is now confirmed onchain.",
  purchaseOnchain: "Your purchase is now confirmed onchain.",
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
  moveHint: {
    rook: "The Rook moves in straight lines",
    bishop: "The Bishop moves diagonally",
    knight: "The Knight jumps in an L-shape",
  },
  captureHint: "Capture the target piece",
  pieceHint: {
    rook: "♜ Straight lines",
    bishop: "♝ Diagonal moves",
    knight: "♞ L-shaped jumps",
  },
  captureHintCompact: "♜ Capture the target",
} as const;

export const ARENA_COPY = {
  title: "Free Play",
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
  startMatch: "Start Match",
  backToHub: "Back to Hub",
  resign: "Resign",
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
  softGate: "Try learning a piece first?",
  softGateSkip: "Skip",
  aiError: "AI disconnected",
  aiTimeout: "AI timed out",
  restartMatch: "Restart Match",
  noWasm: "Could not load the AI engine. Try again or use a different browser.",
  loadingRetry: "Retry",
} as const;
