# Chesscito Coach — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Author:** Wolfcito + Claude

---

## Product Vision

### What it is

Chesscito Coach is a personal chess improvement layer inside Chesscito that analyzes games, detects recurring mistakes, explains why they happened, and tracks improvement through visible learning signals such as lessons, skill badges, and progress tracking.

### Core thesis

The value is knowledge, not crypto.

Players should feel rewarded because they understand their mistakes, improve faster, and can visibly track what they have learned. MiniPay is only the payment rail for the coaching service. It is not the reward system.

### Value philosophy

- The reward is understanding why you lost and how to improve
- Progress is visible through skill, not token accumulation
- Crypto stays mostly invisible in the experience
- The coach adapts to each player based on recurring mistakes and learning patterns
- Over time, anonymized gameplay patterns may improve the coaching layer, but this is secondary to the personal coaching experience

### Access model

1. **Server-paid analysis** — user pays a micro-fee through MiniPay via a credit system. 1 credit = 1 full AI analysis.
2. **Heuristic review (fallback)** — no wallet or no credits required. Lightweight rule-based review using game metrics (move count, result, difficulty, game length). Does not perform deep analysis or engine-level evaluation — serves as acquisition funnel and graceful degraded mode.

### Important positioning

- Do not frame as a crypto rewards product
- Do not frame badges as financial rewards
- Do not make tokens the center of motivation
- This is a learning product first. Payments are infrastructure. Progress is the visible reward.

---

## Architecture (v3 — Post Red Team)

### Data flow

```
Arena Game Ends
      |
      v
GameRecord saved
  +-- localStorage (cache, losable)
  +-- server-side (POST /api/games, keyed by wallet address)
      |
      v
User taps "Ask the Coach"
      |
      +-- Has wallet + credits? --> Paid Analysis Flow
      |     |
      |     v
      |   POST /api/coach/analyze
      |   { gameId, walletAddress }
      |     |
      |     +-- Check idempotency: existing result for wallet+gameId? return it
      |     +-- Check idempotency: pending job for wallet+gameId? return jobId
      |     +-- Verify off-chain credit balance (derived from on-chain purchases)
      |     +-- Validate game record server-side (replay moves via chess.js)
      |     +-- Recompute result server-side (verify client claim)
      |     +-- Build prompt (server-side template, no user-controlled text)
      |     +-- Call LLM (server-side, budget-capped, single model)
      |     +-- Validate response (Zod schema)
      |     +-- Normalize -> CoachResponse
      |     +-- Store analysis record server-side
      |     +-- Decrement credit (only on success)
      |     +-- Return to client
      |
      +-- No wallet / no credits? --> Fallback Mode
            |
            v
          Heuristic/rule-based review engine (runs client-side, no LLM)
          Analyzes: move count, game length, result, difficulty
          Returns: BasicCoachResponse (subset of CoachResponse)
      |
      v
Post-Game Coach UI renders response
      |
      +---> Lesson Feed (server-side for paid, localStorage for fallback)
      +---> Badge evaluation (objective metrics only, never LLM-driven)
```

### Component and module boundaries

```
apps/web/src/
+-- lib/coach/
|   +-- types.ts              # GameRecord, CoachResponse, BasicCoachResponse
|   +-- fallback-engine.ts    # Heuristic review (client-side, no LLM, no engine eval)
|   +-- normalize.ts          # Zod validation + safe defaults
|   +-- badge-evaluator.ts    # Objective metrics -> badge progress
|
+-- app/api/
|   +-- games/route.ts        # POST: save game record (wallet-keyed)
|   |                         # GET: retrieve game history
|   +-- coach/
|   |   +-- analyze/route.ts  # POST: paid LLM analysis (idempotent per wallet+gameId)
|   |                         #   1. idempotency check
|   |                         #   2. verify off-chain credit balance
|   |                         #   3. validate + recompute game
|   |                         #   4. call LLM (budget-capped)
|   |                         #   5. validate+normalize response
|   |                         #   6. store + decrement credit + return
|   +-- coach/
|       +-- history/route.ts  # GET: past analyses for wallet
|       +-- job/[id]/route.ts # GET: poll async job status
|
+-- components/coach/
    +-- ask-coach-button.tsx   # Entry point post-game
    +-- coach-panel.tsx        # Analysis display (Screen 4)
    +-- coach-fallback.tsx     # Basic analysis (Screen 5)
    +-- coach-loading.tsx      # Async loading state (Screen 3)
    +-- coach-paywall.tsx      # Credit purchase sheet (Screen 2)
    +-- coach-history.tsx      # Past sessions list (Screen 6)
```

Two paths, not three. Two API route groups (games + coach). One fallback engine. Minimal surface.

### Security decisions

**1. No BYOK, no relay, no client-side keys**

The server is the only entity that talks to the LLM. One API key, controlled by us, with spend ceiling. The user never touches an API key.

**2. Prompt template — server-side, sealed**

The prompt is built server-side with validated data only. No user-controlled strings enter the prompt. Player summary (weakness tags, patterns) is computed server-side from game records, not from prior LLM output. This eliminates prompt injection via feedback loops.

**3. Game validation pre-analysis**

The server replays all moves from the standard starting position using chess.js. Each move is applied via `game.move(san)`. If any move throws, the game is rejected with 400. The claimed result is verified against `game.isCheckmate()`, `game.isStalemate()`, `game.isDraw()`.

**4. Response validation post-LLM**

```typescript
const CoachResponseSchema = z.object({
  kind: z.literal("full"),
  summary: z.string().max(500),
  mistakes: z.array(z.object({
    moveNumber: z.number().int().positive(),
    played: z.string(),
    better: z.string(),
    explanation: z.string().max(300),
  })).max(10),
  lessons: z.array(z.string().max(200)).max(5),
  praise: z.array(z.string().max(200)).max(3),
});
```

If the LLM returns invalid data, Zod rejects. The client receives a friendly error, not corrupt data. No credit is burned on failure.

### Types

```typescript
/**
 * Move format: SAN (Standard Algebraic Notation) from chess.js.
 * Examples: "e4", "Nf3", "O-O", "Qxd7+", "e8=Q"
 *
 * useChessGame must be extended to accumulate game.history() and expose it.
 * The server validates moves by replaying them with chess.js.
 */

/**
 * Trust boundaries:
 *   moves:      client input, validated server-side by replaying with chess.js
 *   result:     client claim, recomputed server-side from final position
 *   totalMoves: derived server-side from moves.length (client value ignored)
 *   timestamp:  client timestamp for display; server adds receivedAt on save
 */
type GameRecord = {
  gameId: string;             // crypto.randomUUID()
  moves: string[];            // SAN: ["e4", "e5", "Nf3", "Nc6", ...]
  result: GameResult;         // client claim — server recomputes
  difficulty: "easy" | "medium" | "hard";
  totalMoves: number;         // derived server-side from moves.length
  elapsedMs: number;
  timestamp: number;          // client-side timestamp
  receivedAt?: number;        // server-side timestamp, added on POST /api/games
};

/**
 * Result mapping from ArenaStatus:
 *   checkmate + isPlayerWin  → "win"
 *   checkmate + !isPlayerWin → "lose"
 *   stalemate                → "draw"
 *   draw                     → "draw"
 *   resigned                 → "resigned"
 */
type GameResult = "win" | "lose" | "draw" | "resigned";

type CoachResponse = {
  kind: "full";
  summary: string;
  mistakes: Mistake[];
  lessons: string[];
  praise: string[];
};

type Mistake = {
  moveNumber: number;
  played: string;
  better: string;
  explanation: string;
};

type BasicCoachResponse = {
  kind: "quick";
  summary: string;
  tips: string[];
};

type CoachAnalysisRecord = {
  gameId: string;
  provider: "server" | "fallback";
  model?: string;
  analysisVersion: string;
  createdAt: number;
  response: CoachResponse | BasicCoachResponse;
  // Discriminate via response.kind: "full" | "quick"
};

type PlayerSummary = {
  gamesPlayed: number;
  recentMistakeCategories: string[];
  avgGameLength: number;
  difficultyDistribution: Record<string, number>;
  weaknessTags: string[];     // computed server-side from game records, capped at 10
};
```

### Game persistence

GameRecord is saved automatically when ArenaStatus transitions to a terminal state (checkmate, stalemate, draw, resigned):

- **With wallet**: POST /api/games saves server-side (Upstash, keyed by wallet address) + localStorage cache.
- **Without wallet**: localStorage only (keyed by gameId). Data is losable.
- **Sync-on-connect**: When a user connects a wallet for the first time, pending localStorage games are POSTed to the server in batch.

### Payment verification — hybrid credit model

Credits are purchased on-chain but tracked off-chain for simplicity.

**Purchase flow (on-chain):**

```
User selects credit pack in paywall
      |
      v
Client calls ShopUpgradeable.purchase(itemId, payToken)
  - Coach credits are a ShopUpgradeable item (e.g., itemId 3n = 5 credits, itemId 4n = 20 credits)
  - Reuses existing Shop contract + purchase-confirm UX
      |
      v
Server listens for ShopPurchase event (same pattern as existing shop items)
      |
      v
Server increments credit balance in Upstash: credits:{wallet} += N
```

**Consumption flow (off-chain, idempotent):**

```
POST /api/coach/analyze { gameId, walletAddress }
      |
      v
Idempotency check (wallet + gameId)
      |
      +-- Result already exists? -> return existing result (no credit consumed)
      +-- Pending job exists? -> return existing jobId (no new job)
      |
      v
Server reads credits:{wallet} from Upstash (off-chain balance)
      |
      +-- credits > 0 AND no pending job for this wallet:
      |     1. Create job (status: pending)
      |     2. Call LLM (timeout: 45s, max_tokens: 1500)
      |     3. On success: decrement credits:{wallet}, store result, mark job ready
      |     4. On failure: mark job failed, do NOT decrement credits
      |
      +-- credits == 0 -> return 402, client shows paywall
```

Never more than 1 credit consumed per wallet + gameId, regardless of retries or re-requests.

**Why this approach:**
- No new contract needed — reuses ShopUpgradeable (proven, audited)
- On-chain purchase provides payment proof and receipt
- Off-chain balance tracking avoids the "who burns the credit" problem — server is the authority
- Credits only decremented on successful analysis (no refund complexity)
- Rate limited: 1 pending job per wallet at a time (prevents spam)
- Pricing: 5 analyses for $0.10 (itemId 3n), 20 for $0.30 (itemId 4n)

### Badge progression — 100% objective, 0% LLM

- Computed server-side from GameRecord[]
- No LLM intervention
- Deterministic, reproducible, not manipulable
- The coach can explain why you earned/missed a badge, but cannot grant it
- Anti-farming guardrails prevent grinding easy games for badges (see Badge guardrails section below)

### Storage strategy

```
              +-------------+
              |   Server    |
              |  (Upstash)  |  <-- source of truth
              |             |
              | GameRecords |
              | Analyses    |
              | BadgeState  |
              +------+------+
                     |
                sync on load
                     |
              +------v------+
              | localStorage |  <-- convenience cache
              |             |
              | last 5 games|
              | last analysis|
              | UI prefs     |
              | pending jobId|
              +-------------+
```

- Server (Upstash Redis): source of truth for game history, analyses, badge state. Keyed by wallet address.
- localStorage: cache for fast render. If cleared, re-fetched from server. Stores pending job IDs for async re-entry.
- No wallet: localStorage only, fallback mode only. Data is losable and the user knows it.

### Failure modes

| Scenario | What happens | User sees |
|----------|-------------|-----------|
| LLM API down | Server returns 503 | "Coach is resting. Try again later." Game saved for later analysis. Credit not burned. |
| LLM returns invalid JSON | Zod rejects, 502 | "Analysis couldn't be completed. Your credit was not spent." |
| Payment fails mid-flow | MiniPay cancel/error | Standard MiniPay error. No credit purchased. |
| WebView suspends during analysis | Client polls for result on resume | Job continues server-side. Result available on re-entry. |
| localStorage cleared | Re-fetch from server on next load | Transparent to user (brief loading state). |
| No wallet connected | Fallback engine only | Quick Review + "Get Full Analysis" upsell. |
| Upstash down | Serve from localStorage cache if available | Degraded mode, warn user data may not persist. |
| User fabricates game locally | Server validates moves with chess.js | 400 "Invalid game record". |

### Async job pattern

```
POST /api/coach/analyze -> returns { jobId }
Client polls GET /api/coach/job/{jobId} every 3s
  -> { status: "pending" }
  -> { status: "ready", response: CoachResponse }
  -> { status: "failed", reason: "..." }
```

If the WebView suspends, the job keeps running. The client stores the jobId in localStorage and checks on re-entry.

### Idempotency rules

One analysis per wallet + gameId. The server enforces this at the analyze endpoint:

1. If an analysis result already exists for this wallet + gameId: return the existing result immediately. No credit consumed.
2. If a pending job already exists for this wallet + gameId: return the existing jobId. No new job created.
3. If neither exists: create a new job (if credits > 0).

This means a user can never be charged twice for the same game, and re-requesting an analysis is always safe.

### Job lifecycle

| State | TTL | Behavior |
|-------|-----|----------|
| pending | 60 seconds | If the LLM hasn't responded within 60s, the job transitions to failed. |
| ready | 30 days | Results are retained for 30 days. After that, cleaned up by a scheduled job. |
| failed | 24 hours | Failed jobs are retained briefly for debugging, then cleaned up. |

- **Timeout handling**: The server sets a 45-second timeout on the LLM call. If exceeded, the job is marked failed with reason "Analysis timed out". No credit is consumed.
- **Cleanup**: A lightweight cron or on-read expiry in Upstash TTL handles expired jobs. No separate cleanup service needed for v1.
- **Rate limit**: 1 pending job per wallet at a time. Additional requests return 429.

### LLM operational limits (v1)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Model | Single model, chosen at deploy time (e.g., claude-haiku-4-5-20251001) | Simplicity. One model = predictable cost and quality. |
| Request timeout | 45 seconds | Generous for a chess analysis. Covers slow responses without blocking indefinitely. |
| Max input tokens | ~2000 (prompt template + moves + summary) | A 40-move game in SAN is ~200 tokens. Template + summary adds ~1500. Leaves headroom. |
| Max output tokens | 1500 | Enough for summary + 5 mistakes + 5 lessons + 3 praises in JSON. |
| Retries | 0 in v1 | On failure, mark job as failed. User can retry manually. Avoids compounding costs. |
| Spend ceiling | Set on the API key (provider dashboard) | Hard cap to prevent runaway costs. |

### Editorial tone by result

The LLM prompt template adjusts section emphasis based on game result:

| Result | Summary focus | KEY MOMENTS focus | WHAT YOU DID WELL focus | TAKEAWAYS focus |
|--------|--------------|-------------------|------------------------|-----------------|
| **win** | Strengths shown | Missed improvements — moments where a stronger opponent would have punished | Specific strong decisions | How to win more efficiently or at higher difficulty |
| **lose** | What went wrong (encouraging tone) | Critical mistakes that turned the game | Defensive moves or good attempts | Concrete skills to practice |
| **draw** | Why the game didn't resolve | Moments where either side could have pressed advantage | Solid defensive play | How to convert drawn positions |
| **resigned** | The turning point | The position that felt lost + a safer continuation | Moves before the collapse | Pattern recognition for similar positions |

This is encoded in the prompt template, not in the UI. The UI renders whatever the LLM returns — but the prompt steers the tone.

### Badge guardrails

To prevent farming on easy difficulty:

```typescript
const BADGE_DEFINITIONS: BadgeCriteria[] = [
  // "tactics" — requires hard difficulty games
  { area: "tactics",     metric: "win_rate_hard",       threshold: 0.4, windowSize: 10,
    minDifficulty: "hard" },

  // "efficiency" — requires medium+ difficulty
  { area: "efficiency",  metric: "avg_moves_to_win",    threshold: 25,  windowSize: 10,
    minDifficulty: "medium" },

  // "consistency" — requires diversity: at least 2 different difficulties in window
  { area: "consistency", metric: "win_streak",          threshold: 5,   windowSize: 20,
    minDiverseDifficulties: 2 },

  // "endgame" — requires medium+ difficulty, long games only
  { area: "endgame",     metric: "win_rate_long_games", threshold: 0.5, windowSize: 10,
    minDifficulty: "medium" },
];
```

Rules:
- `minDifficulty`: only games at this difficulty or higher count toward the badge.
- `minDiverseDifficulties`: the evaluation window must contain games from at least N different difficulties.
- A player grinding only easy games cannot earn any skill badge.
- Badge evaluator filters the game window before computing metrics.

---

## UI Surfaces

### Screen 1 — Post-Game Coach Entry

**Goal:** Introduce the coach at the moment of highest emotional engagement — right after the game ends.

**Entry condition:** Arena game ends (any result: win, lose, draw, resigned).

**UI structure:**

The existing ArenaEndState gains one additional CTA between Play Again and Back to Hub:

```
+-----------------------------+
|                             |
|      [Trophy / Defeat]      |
|      Checkmate -- You Win!  |
|                             |
|   +-----------------------+ |
|   |   >  Play Again       | |  game-primary
|   +-----------------------+ |
|   +-----------------------+ |
|   |   Ask the Coach       | |  game-solid emerald
|   |   What can I improve? | |
|   +-----------------------+ |
|                             |
|       Back to Hub           |  game-text
|                             |
+-----------------------------+
```

**CTA behavior:**

| User state | Tap result |
|-----------|-----------|
| Wallet + credits > 0 | Start paid analysis immediately |
| Wallet + credits = 0 | Open credit purchase sheet (Screen 2) |
| No wallet | Show Quick Review (Screen 5) with upgrade prompt at bottom |

The no-wallet path never blocks with a connect prompt upfront. The user sees value first, then gets invited to unlock more.

**Notes:**
- Button always visible regardless of user state. The path adapts, the entry point does not.
- Subtitle "What can I improve?" frames the coach as learning, not transaction.

---

### Screen 2 — Credit Purchase Sheet

**Goal:** Let the user buy analysis credits with minimal friction. 1 credit = 1 full AI analysis. No ambiguity.

**Entry condition:** User taps Ask the Coach with wallet connected but zero credits.

**UI structure:**

Bottom sheet (same mechanic as existing Shop). Reuses purchase-confirm-sheet flow.

```
+-----------------------------+
|  Coach Credits              |
|                             |
|  1 credit = 1 full game     |
|  analysis by AI coach       |
|                             |
|  +--------+  +--------+    |
|  | 5 uses |  |20 uses |    |
|  | $0.10  |  | $0.30  |    |
|  |        |  | BEST   |    |
|  +--------+  +--------+    |
|                             |
|  +-----------------------+  |
|  |  Buy with USDC        |  |
|  +-----------------------+  |
|                             |
|  Or try Quick Review        |
|  for free -- no wallet      |
|  needed                     |
|                             |
+-----------------------------+
```

**Notes:**
- "1 credit = 1 full game analysis" must be visible without scrolling.
- "Or try Quick Review" links to Screen 5. Never a dead end.

---

### Screen 3 — Analysis Loading (Async Job)

**Goal:** Show progress while the server processes the LLM analysis. Handle WebView suspension gracefully.

**Entry condition:** Analysis job started (job ID received, credit will be consumed on success).

**UI structure:**

```
+-----------------------------+
|                             |
|         [coach icon]        |
|                             |
|   Analyzing your game...    |
|                             |
|   [progress bar]            |
|   Reviewing your moves      |
|                             |
|   You can leave -- we'll    |
|   keep your result ready    |
|                             |
+-----------------------------+
```

**Async states and re-entry behavior:**

| State | User stays on screen | User leaves and returns |
|-------|---------------------|----------------------|
| Pending | Progress bar + "Reviewing your moves" | "Your analysis is still processing..." with subtle pulse. Auto-resolves when ready. |
| Ready | Transitions to Screen 4 automatically | "Your analysis is ready" banner at top of ArenaEndState or coach entry. Tap opens Screen 4. |
| Failed | "Analysis couldn't be completed. Your credit was not spent." + Retry button | Same message on re-entry. Credit was not burned. |

**Notes:**
- Client polls GET /api/coach/job/{jobId} every 3 seconds.
- Job ID persisted in localStorage for re-entry after WebView suspension.
- "You can leave" is critical for MiniPay trust.

---

### Screen 4 — Coach Analysis Result

**Goal:** Present actionable, human-toned coaching feedback. The user should feel like a coach talked to them, not a data dump.

**Entry condition:** Analysis job completed successfully.

**UI structure:**

Scrollable vertical layout. Sections in reading order of priority.

```
+-----------------------------+
|  < Back         4 credits   |
|                             |
|  Coach Analysis             |
|  Hard - 18 moves - 1:42    |
|-----------------------------|
|                             |
|  "You played aggressively   |
|   but left your king        |
|   exposed after move 8.     |
|   Castling early would      |
|   have changed the game."   |
|                             |
|-----------------------------|
|  KEY MOMENTS                |
|                             |
|  Move 8 - You played Bf4   |
|  > Try O-O (castle)         |
|  "Castling protects your    |
|   king and activates        |
|   your rook"                |
|                             |
|  Move 11 - You played Qh5  |
|  > Try Nf3                  |
|  "Develop knights before    |
|   bringing out the queen"   |
|                             |
|-----------------------------|
|  WHAT YOU DID WELL          |
|                             |
|  "Strong knight develop-    |
|   ment on move 3 -- you     |
|   controlled the center     |
|   early"                    |
|                             |
|-----------------------------|
|  TAKEAWAYS                  |
|                             |
|  - Castle early to protect  |
|    your king                |
|  - Develop minor pieces     |
|    before the queen         |
|                             |
|-----------------------------|
|  +-----------------------+  |
|  |   >  Play Again       |  |
|  +-----------------------+  |
|       Back to Hub           |
+-----------------------------+
```

**Section labels:**

| Label | Tone |
|-------|------|
| KEY MOMENTS | Neutral, factual — these are the important turns |
| WHAT YOU DID WELL | Encouraging, specific — coach recognizes effort |
| TAKEAWAYS | Actionable — what to practice next |

**Notes:**
- Summary is conversational — one paragraph, max 3 sentences.
- Key Moments capped at 5 (Zod). Most games have 1-3.
- "What You Did Well" is never empty. Even in a loss, the coach finds something positive. Fallback is generic encouragement from editorial.ts.
- Credit count shown top-right as info, not a button.

---

### Screen 5 — Quick Review (Fallback)

**Goal:** Deliver immediate value without wallet, without credits, without LLM. This is the acquisition funnel — show enough to make the user want the full coach.

**Entry condition:** User taps Ask the Coach without wallet, or explicitly chooses "Quick Review" from paywall.

**UI structure:**

Same layout skeleton as Screen 4 but simpler, rule-based content:

```
+-----------------------------+
|  < Back                     |
|                             |
|  Quick Review               |
|  Easy - 12 moves - Win      |
|-----------------------------|
|                             |
|  You won in 12 moves on     |
|  easy difficulty. That's a  |
|  solid game length.         |
|                             |
|-----------------------------|
|  TIPS                       |
|                             |
|  - Try medium difficulty    |
|    for a bigger challenge   |
|  - Winning in under 10      |
|    moves signals strong     |
|    tactical play            |
|                             |
|-----------------------------|
|                             |
|  +-----------------------+  |
|  | Get Full Analysis     |  |  emerald outline
|  | See your key moments  |  |
|  | and personalized tips |  |
|  +-----------------------+  |
|                             |
|  +-----------------------+  |
|  |   >  Play Again       |  |
|  +-----------------------+  |
|       Back to Hub           |
+-----------------------------+
```

**CTA behavior:**
- "Get Full Analysis": if no wallet -> connect wallet prompt. If wallet -> credit purchase sheet (Screen 2).
- Upsell comes AFTER the user has already received basic value.

**Notes:**
- Title is "Quick Review" not "Basic Analysis" — avoids making the user feel they got the cheap version.
- Tips generated by fallback-engine.ts using objective metrics.
- Upsell block previews what full analysis includes without being pushy.

---

### Screen 6 — Coach History (Your Sessions)

**Goal:** Give returning users a reason to review past analyses and perceive their own improvement over time. Not just an archive — a progress signal.

**Entry condition:** Accessible from Screen 4 via back navigation. In v1, no dedicated dock entry.

**UI structure:**

```
+-----------------------------+
|  < Back         4 credits   |
|                             |
|  Your Sessions              |
|                             |
|  +-----------------------+  |
|  | Today                 |  |
|  | Win - Hard - 18 moves |  |
|  | "Castle earlier"      |  |  <- top takeaway
|  | 2 key moments    Full |  |  <- analysis type
|  +-----------------------+  |
|  +-----------------------+  |
|  | Yesterday             |  |
|  | Loss - Medium - 31 mv |  |
|  | "Protect your queen"  |  |
|  | 4 key moments    Full |  |
|  +-----------------------+  |
|  +-----------------------+  |
|  | Mar 20                |  |
|  | Win - Easy - 12 moves |  |
|  | "Try harder modes"    |  |
|  |               Quick   |  |  <- fallback type
|  +-----------------------+  |
|                             |
|-----------------------------|
|  YOUR PROGRESS              |
|                             |
|  Games analyzed: 8          |
|  Highest difficulty: Hard   |
|  Current streak: 3 wins     |
|                             |
+-----------------------------+
```

**Progress signals per history item:**

| Signal | Source | Display |
|--------|--------|---------|
| Top takeaway | First lesson or fallback tip | One-line summary |
| Key moments count | mistakes.length from CoachResponse | "N key moments" |
| Analysis type | provider field | "Full" or "Quick" badge |
| Result + context | GameRecord | "Win - Hard - 18 moves" |

**Progress summary block** (bottom of list):
Computed server-side from GameRecord[] using objective metrics:
- Games analyzed (total count)
- Highest difficulty played (factual, not interpretive)
- Current streak (consecutive wins)

**Notes:**
- History fetched from server (GET /api/coach/history). localStorage is render cache only.
- "Your Sessions" as title feels personal.
- Progress summary uses same metrics as badges, presented as encouragement not gates.
- Each card is tappable and opens full analysis (Screen 4) or quick review (Screen 5).

---

### Entry points

```
                  +----------------+
                  |  Arena End     |---- "Ask the Coach" button (PRIMARY, v1)
                  |  State         |
                  +----------------+

                  +----------------+
                  |  Coach Panel   |---- "Your Sessions" back nav
                  |  (Screen 4)    |     opens Coach History (Screen 6)
                  +----------------+
```

### New components vs reused

| Component | Status |
|-----------|--------|
| ask-coach-button.tsx | New |
| coach-paywall.tsx | New (reuses purchase-confirm UX) |
| coach-loading.tsx | New |
| coach-panel.tsx | New |
| coach-fallback.tsx | New |
| coach-history.tsx | New |
| purchase-confirm-sheet | Reused (Shop pattern) |
| Button variants | Reused (game-solid, game-primary, game-text) |
| StatCard | Reused from arena |

---

## v1 Scope Notes

### New infrastructure

- **Upstash Redis**: server-side persistence for game records, coach analyses, credit balances, and badge state. New dependency — requires account setup, env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), and cost monitoring.
- **ShopUpgradeable items**: Two new shop items for coach credit packs. No new contract deployment needed.
- **useChessGame extension**: Hook must accumulate `game.history()` (SAN move array) and expose it alongside existing `moveCount` and `elapsedMs`.

### In scope

- Post-game entry point (Screen 1) in ArenaEndState
- Credit purchase sheet (Screen 2) reusing purchase-confirm flow
- Async loading with re-entry support (Screen 3)
- Full AI analysis result (Screen 4)
- Rule-based Quick Review fallback (Screen 5)
- Coach history with progress signals (Screen 6)
- Two analysis paths only: server-paid and fallback
- Credit-based payment via ShopUpgradeable items
- Objective badge progression (no LLM dependency)
- Server-side storage (Upstash) as source of truth
- Game validation via chess.js server-side
- Zod response validation and normalization

### Future iterations (not v1)

| Feature | Reason deferred |
|---------|----------------|
| Coach icon in persistent dock | Dock has 5 items, adding 6th needs layout redesign. v1 entry is post-game only. |
| BYOK (bring your own key) | CORS blocks direct calls, relay adds security liability. Revisit if users demand it. |
| Lesson feed (curated learning path) | Requires content pipeline and sequencing logic. Post-game analysis is the core loop for v1. |
| Public API (POST /api/coach/analyze) | Build internal coach first. API extraction is straightforward once server layer exists. |
| Badge explanations | Badges are objective-metric based. Explanation UI is nice-to-have, not launch-critical. |
| Mid-game coach hints | Changes game dynamic fundamentally. Separate product decision. |
| Knowledge base from collective play | Requires significant data pipeline. Personal coaching comes first. |

---

## What We Cut and Why

| Cut | Why |
|-----|-----|
| BYOK | CORS blocks direct calls. Relay creates key-handling liability. Massive complexity for a MiniPay audience unlikely to have API keys. |
| Direct client-side LLM calls | Do not work due to CORS. |
| 3 provider abstraction | 2 paths (server + fallback) cover all users. Less testing surface, simpler normalization. |
| LLM-driven skillSignals | Non-deterministic, gameable, unfair across tiers. Badges from objective metrics are trustworthy. |
| localStorage as source of truth | Unreliable in MiniPay WebView. Treat as cache only. |
| Per-call payment verification | Race conditions, bad UX. Credit model is simpler and proven. |
| Public API v1 | Build internal coach first. API extraction is trivial once server layer exists. |
| Lesson Feed | Post-game analysis is the core loop. Curated lessons need a content pipeline. |
| Crypto rewards / learn-to-earn | Value is knowledge, not tokens. Rewards are visible skill progression. |
