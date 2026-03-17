# Victory Celebration UX — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** PoC — Lottie animations + 3-phase post-win celebration + share

## Problem

After minting a Victory NFT the player sees only a disabled "Victory Minted" button. There is no visual celebration, no receipt, no share mechanism. The experience feels anticlimactic — the player paid but has nothing to show for it.

## Solution

Replace the current static `ArenaEndState` with a cinematic 3-phase victory overlay powered by Lottie animations, stat pills, and a two-tier share system.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Fullscreen overlay (replaces board) | Cinematic, epic — matches Chesscito fantasy identity |
| Animation lib | `lottie-react` (~60KB gzip) | Pure JS, no WASM, MiniPay WebView safe |
| Animation style | Sparkles / magic particles | Fantasy RPG feel, matches teal/cyan aesthetic |
| Share text | Challenge/provocative | "Checkmate in N moves. Can you beat that?" — drives competition and virality |
| Share visibility | Two-tier: basic on win, upgraded on mint | Maximizes viral reach; rewards minters with exclusive share |
| Color progression | Cyan (win) → Amber (minted) | Visual "level up" when you mint your victory |

## Phase Flow

```
WIN (checkmate, player wins)
  │
  ▼
PHASE 1: Victory Celebration
  - Lottie sparkles fullscreen behind card
  - "VICTORY!" title, emerald-300 with cyan glow
  - Stat pills: difficulty, moves, time (cyan borders)
  - [Share Win] — ghost/cyan style, basic share text
  - [Mint Victory — $X.XX] — amber gradient, primary CTA
  - [Play Again] [Back to Hub] — secondary, smaller
  │
  ├─ (does not mint) → stays in Phase 1, plays/navigates
  │
  └─ (mints) ──▼

PHASE 2: Minting
  - Lottie loading loop (sparkle spinner)
  - "Minting your victory..." with CSS pulse
  - Replaces card content, overlay persists
  │
  ▼
PHASE 3: Minted Receipt
  - Lottie sparkles intensified
  - Wolf icon glow: cyan → amber
  - "Victory #N Minted!" in amber-400
  - "on Celo blockchain" subtitle, white/50
  - Stat pills: amber borders (upgraded from cyan)
  - [Share Victory] — amber gradient, primary CTA, upgraded text
  - Mint button gone
  - [Play Again] [Back to Hub] — secondary
```

## Layout (390px mobile)

### Phase 1: Victory Celebration

```
┌────────────────────────────────────┐
│  bg-black/60 + Lottie sparkles     │
│  (absolute, behind card)           │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       wolf icon (64px)       │  │  cyan glow
│  │                              │  │
│  │    ✦  V I C T O R Y !  ✦    │  │  emerald-300, drop-shadow
│  │                              │  │
│  │  ┌────┐ ┌──────┐ ┌───────┐  │  │
│  │  │EASY│ │♟ 12  │ │⏱ 2:34│  │  │  stat pills, glass bg
│  │  └────┘ └──────┘ └───────┘  │  │
│  │                              │  │
│  │  [ ♟ Share Win             ] │  │  border-cyan, ghost
│  │  [ ✦ Mint Victory — $0.01 ] │  │  amber gradient
│  │                              │  │
│  │    [Play Again] [Back to Hub]│  │  existing styles
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

### Phase 2: Minting

```
┌────────────────────────────────────┐
│  bg-black/60 + Lottie sparkles     │
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │     [Lottie loading 80px]    │  │  sparkle loop
│  │                              │  │
│  │  "Minting your victory..."   │  │  animate-pulse
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

### Phase 3: Minted Receipt

```
┌────────────────────────────────────┐
│  bg-black/60 + Lottie sparkles++   │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       wolf icon (64px)       │  │  amber glow (upgraded)
│  │                              │  │
│  │   ✦ Victory #42 Minted! ✦   │  │  amber-400
│  │     on Celo blockchain       │  │  white/50 subtitle
│  │                              │  │
│  │  ┌────┐ ┌──────┐ ┌───────┐  │  │
│  │  │EASY│ │♟ 12  │ │⏱ 2:34│  │  │  amber borders (upgraded)
│  │  └────┘ └──────┘ └───────┘  │  │
│  │                              │  │
│  │  [ 🏆 Share Victory        ] │  │  amber gradient
│  │                              │  │
│  │    [Play Again] [Back to Hub]│  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

## Visual Progression: Cyan → Amber

| Element | Phase 1 (Win) | Phase 3 (Minted) |
|---------|---------------|-------------------|
| Wolf icon glow | `rgba(103,232,249,0.5)` cyan | `rgba(245,158,11,0.5)` amber |
| Title color | `emerald-300` | `amber-400` |
| Title text | "VICTORY!" | "Victory #N Minted!" |
| Stat pill border | `border-cyan-400/30` | `border-amber-400/30` |
| Share button | Ghost, cyan border | Amber gradient, primary |
| Lottie intensity | Normal speed (1x) | Faster speed (1.5x) |
| Mint button | Amber gradient, visible | Gone |

## Architecture

### New Files

```
apps/web/
├── public/animations/
│   ├── sparkles.json            ← Lottie: magic particle celebration
│   └── sparkles-loading.json    ← Lottie: sparkle loading loop
├── src/components/arena/
│   ├── victory-celebration.tsx  ← Phase 1: win overlay
│   ├── victory-minting.tsx      ← Phase 2: minting loader
│   └── victory-receipt.tsx      ← Phase 3: minted receipt
├── src/components/ui/
│   ├── lottie-animation.tsx     ← "use client" wrapper, reusable
│   ├── share-button.tsx         ← Web Share API + clipboard fallback
│   └── stat-pill.tsx            ← Reusable stat pill component
```

### Modified Files

```
apps/web/src/components/arena/arena-end-state.tsx  ← Rewrite: orchestrate 3 phases
apps/web/src/app/arena/page.tsx                    ← Capture tokenId from mint receipt
apps/web/src/lib/content/editorial.ts              ← Add VICTORY_CELEBRATION_COPY
```

### New Dependency

```
lottie-react  (~60KB gzip, pure JS, SVG renderer)
```

### Component Hierarchy

```
ArenaEndState (orchestrator)
├── Phase === "celebration"
│   └── VictoryCelebration
│       ├── LottieAnimation (sparkles, fullscreen)
│       ├── StatPill × 3
│       ├── ShareButton (basic)
│       └── MintButton + PlayAgain + BackToHub
├── Phase === "minting"
│   └── VictoryMinting
│       └── LottieAnimation (loading loop)
└── Phase === "minted"
    └── VictoryReceipt
        ├── LottieAnimation (sparkles, intensified)
        ├── StatPill × 3 (amber)
        ├── ShareButton (upgraded)
        └── PlayAgain + BackToHub
```

### State Management (arena/page.tsx)

```typescript
type MintPhase = "idle" | "minting" | "minted";

// Replaces the current isMinting + hasMinted booleans with a single state machine
const [mintPhase, setMintPhase] = useState<MintPhase>("idle");
const [tokenId, setTokenId] = useState<bigint | null>(null);
const [mintError, setMintError] = useState<string | null>(null); // kept as-is

// In handleMintVictory():
// setMintPhase("minting")
// ... sign → approve → mint ...
// After waitForTransactionReceipt, parse logs for VictoryMinted event
// Extract tokenId from event args
// setTokenId(extractedId)
// setMintPhase("minted")
//
// On error/rejection:
// setMintPhase("idle")   ← reverts to Phase 1
// setMintError(msg)      ← shown inline in Phase 1
```

**Note:** The existing `isMinting` and `hasMinted` booleans are **removed** and fully replaced by `mintPhase`. This avoids redundant state that could drift.

### TokenId Extraction

The `VictoryMinted` event signature:
```solidity
event VictoryMinted(
  address indexed player,
  uint256 indexed tokenId,
  uint8 difficulty,
  uint16 totalMoves,
  uint32 timeMs,
  address token,
  uint256 totalAmount
);
```

Parse from transaction receipt logs using viem's `decodeEventLog`.

### Share Logic

```typescript
// Phase 1 — basic share (any win)
const basicShareText = `♟ Checkmate in ${moves} moves. Can you beat that?\nPlay Chesscito on Celo 👉 ${APP_URL}`;

// Phase 3 — upgraded share (minted)
const mintedShareText = `♟ Checkmate in ${moves} moves. Can you beat that?\nVictory #${tokenId} minted on-chain 👉 ${APP_URL}`;

// Implementation: Web Share API with clipboard fallback
async function share(text: string) {
  if (navigator.share) {
    await navigator.share({ text });
  } else {
    await navigator.clipboard.writeText(text);
    // Show "Copied!" toast for 2s
  }
}
```

### Lottie Animation Files

Source from LottieFiles.com free library:
- `sparkles.json` — magic/sparkle particle effect, ~20-40KB
- `sparkles-loading.json` — looping sparkle spinner, ~10-20KB

Requirements:
- No embedded images (keeps size small)
- Works with SVG renderer
- Loop-capable
- Fantasy/magic aesthetic (not corporate/flat)

### Editorial Copy

```typescript
export const VICTORY_CELEBRATION_COPY = {
  title: "Victory!",
  mintedTitle: (id: number | bigint) => `Victory #${id} Minted!`,
  mintedTitleFallback: "Victory Minted!",
  mintedSubtitle: "on Celo blockchain",
  shareWin: "Share Win",
  shareVictory: "Share Victory",
  mintingMessage: "Minting your victory...",
  statMoves: (n: number) => `♟ ${n}`,
  statTime: (s: string) => `⏱ ${s}`,
  shareTextBasic: (moves: number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nPlay Chesscito on Celo 👉 ${url}`,
  shareTextMinted: (moves: number, tokenId: bigint | number, url: string) =>
    `♟ Checkmate in ${moves} moves. Can you beat that?\nVictory #${tokenId} minted on-chain 👉 ${url}`,
  copiedToast: "Copied!",
} as const;
```

## Error Handling: Mint Failure in Phase 2

If the mint transaction fails (revert, network error) or the user rejects the wallet prompt during Phase 2:

1. `mintPhase` reverts to `"idle"` → UI returns to **Phase 1**
2. `mintError` displays inline below the Mint button (existing behavior)
3. The Lottie loading animation stops, sparkles resume at normal speed
4. User can retry minting or choose Play Again / Back to Hub

## What Does NOT Change

- Smart contract (`VictoryNFTUpgradeable.sol`)
- API endpoint (`/api/sign-victory`)
- Mint logic flow (sign → approve → mint)
- Existing game hook (`use-chess-game.ts`)
- Difficulty selector, arena board, arena HUD
- Loss/draw/stalemate end states (keep current minimal style)

## Testing

- Manual QA on MiniPay WebView (primary target)
- Verify Lottie renders on mobile Safari and Chrome
- Verify Web Share API triggers native share sheet on mobile
- Verify clipboard fallback works on desktop
- Verify tokenId extraction from mint receipt logs
- Verify phase transitions: idle → minting → minted
- Verify share text includes correct stats and tokenId

## Risks

| Risk | Mitigation |
|------|------------|
| Lottie JSON too heavy | Pick simple animations <50KB; lazy load |
| SVG render perf on low-end | Use `lottie-react` light build if needed |
| Web Share API unsupported | Clipboard fallback already planned |
| tokenId extraction fails | Graceful fallback: show "Victory Minted!" without # |
