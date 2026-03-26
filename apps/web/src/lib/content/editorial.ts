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

export const PIECE_IMAGES: Record<keyof typeof PIECE_LABELS, string> = {
  rook: "/art/pieces/w-rook",
  bishop: "/art/pieces/w-bishop",
  knight: "/art/pieces/w-knight",
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
  viewTrophies: "View your Victories",
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
  empty: "Shop items are not available right now.",
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
  retry: "Retry",
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

export const VICTORY_PAGE_COPY = {
  challengeLine: "Can you beat this?",
  acceptChallenge: "Accept Challenge",
  backToHub: "Back to Hub",
  metaCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  metaChallenge: (id: string) => `Can you beat that? Victory #${id} claimed onchain.`,
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
  claimButton: "Claim Victory",
  claimHelper: "Claim your onchain victory and unlock your share card",
  claimValueHint: (price: string) => `Unlock your share card \u2022 ${price}`,
  teaserLabel: "Unlock on claim",
  teaserCheckmate: (moves: number) => `Checkmate in ${moves} moves`,
  teaserShare: "SHARE",
  claiming: "Claiming Victory...",
  claimProgress1: "Recording your result onchain",
  claimProgress2: "Preparing your victory card",
  successTitle: "Victory Recorded",
  successSubtitle: "Your onchain result is live. Your share card is ready.",
  errorTitle: "Couldn't record victory",
  errorSubtitle: "Something went wrong while saving your result onchain.",
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
} as const;

export const VICTORY_CELEBRATION_COPY = {
  title: "Victory",
  performanceLine: (moves: number, time: string) =>
    `Solved in ${moves} moves — ${time}`,
  performanceLineCheckmate: (moves: number, time: string) =>
    `Checkmate in ${moves} moves — ${time}`,
  shareTextBasic: (moves: number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nPlay Chesscito on Celo 👉 ${url}`,
  shareTextClaimed: (moves: number, tokenId: bigint | number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nVictory #${tokenId} claimed on-chain 👉 ${url}`,
  stats: { difficulty: "level", moves: "moves", time: "time" },
} as const;

export const TROPHY_VITRINE_COPY = {
  pageTitle: "Trophy Vitrine",
  pageDescription: "Your onchain victories, immortalized.",
  myVictories: "My Victories",
  hallOfFame: "Hall of Fame",
  movesLabel: "moves",
  shareLabel: "Share",
  loadingText: "Loading victories...",
  copiedToast: "Link copied!",
  connectWallet: "Connect wallet to see your victories",
  noVictories: "No victories yet — win in the Arena to earn your first trophy",
  noGlobalVictories: "No victories recorded yet — be the first!",
  loadError: "Could not load victories — tap to retry",
  configError: "Trophies unavailable",
  roadmap: "More coming soon → Tournaments • VIP Passes • Seasonal Rewards",
  arenaLink: "Go to Arena",
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
};

export const PRACTICE_COPY = {
  label: "Practice mode",
} as const;

export const COACH_COPY = {
  askCoach: "Ask the Coach",
  askCoachSub: "What can I improve?",
  quickReviewTitle: "Quick Review",
  coachAnalysisTitle: "Coach Analysis",
  keyMoments: "KEY MOMENTS",
  whatYouDidWell: "WHAT YOU DID WELL",
  takeaways: "TAKEAWAYS",
  tips: "TIPS",
  yourSessions: "Your Sessions",
  yourProgress: "YOUR PROGRESS",
  gamesAnalyzed: (n: number) => `Games analyzed: ${n}`,
  highestDifficulty: (d: string) => `Highest difficulty: ${d}`,
  currentStreak: (n: number) => `Current streak: ${n} wins`,
  creditTitle: "Coach Credits",
  creditExplain: "1 credit = 1 full game analysis by AI coach",
  creditPack5: "5 uses",
  creditPack20: "20 uses",
  creditBest: "BEST",
  buyWithUsdc: "Buy with USDC",
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
  welcomeSub: "Get personalized analysis of your games — mistakes, lessons, and what you did well.",
  welcomePack: "3 analyses",
  welcomePackDetail: "Key moments · Lessons · Praise",
  claimFree: "Claim Free Analyses",
  welcomeNote: "After your free analyses, credit packs start at $0.05",
  creditComingSoon: "Credit packs coming soon!",
} as const;

export const LEGAL_COPY = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 2026",
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
    lastUpdated: "March 2026",
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
    href: `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ""}`,
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
} as const;

export const ABOUT_COPY = {
  title: "Chesscito",
  operatedBy: "Operated by Wolfcito",
  handle: "@akawolfcito",
  version: "v0.1.0",
  links: {
    support: "Support",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    invite: "Invite a Friend",
  },
} as const;
