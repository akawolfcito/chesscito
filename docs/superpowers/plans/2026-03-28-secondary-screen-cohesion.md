# Secondary Screen Cohesion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CTA hierarchy, modal trap, and progress feedback violations across 8 screens in the victory flow and coach screens.

**Architecture:** Pure component-level changes. No new routes, hooks, or API endpoints. Editorial constants added first, then victory flow (phases 1-4 as a shippable unit), then coach screens (phases 5-7 independently). Each phase produces a buildable, non-breaking intermediate state.

**Tech Stack:** React components (TSX), Tailwind CSS, editorial.ts constants

**Spec:** `docs/superpowers/specs/2026-03-28-secondary-screen-cohesion-design.md`

**Recoverability check result:** The current mint flow does NOT persist the tx hash during claiming (`sessionStorage` stores only `deadline`, not `claimHash`). If the player navigates away mid-claim, the tx completes on-chain but the app loses track. Therefore: the escape copy on `victory-claiming.tsx` must be neutral ("Back to Hub") with NO promise about background completion.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/lib/content/editorial.ts` | Modify | Add new copy constants for progress, recovery, claimed badge |
| `apps/web/src/components/arena/victory-claiming.tsx` | Modify | Add progress indicator, escape hatch, remove modal trap |
| `apps/web/src/components/arena/victory-celebration.tsx` | Modify | Reorder CTAs — Claim primary, Play Again secondary, remove Ask Coach |
| `apps/web/src/components/arena/victory-claim-success.tsx` | Modify | Add claimed badge, reorder CTAs — Play Again primary, Share utility strip, demote/remove View Trophies |
| `apps/web/src/components/arena/victory-claim-error.tsx` | Modify | Add recovery hint copy |
| `apps/web/src/components/arena/arena-end-state.tsx` | Modify | Pass `onBackToHub` to VictoryClaiming |
| `apps/web/src/components/coach/coach-panel.tsx` | Modify | Merge praise+takeaways, fix CTA hierarchy |
| `apps/web/src/components/coach/coach-fallback.tsx` | Modify | Swap CTA order — Play Again primary, upgrade secondary |
| `apps/web/src/components/coach/coach-loading.tsx` | Modify | Always show cancel, add progress dots |
| `apps/web/src/components/coach/coach-paywall.tsx` | Modify | Highlight 20-pack, add value subtitles, demote quick review link |

---

## Phase 1: Editorial Constants

**Risk:** Low — additive only, no component changes.
**QA:** `pnpm --filter web build` passes. No UI changes visible yet.

### Task 1: Add new editorial constants

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts:280-310` (VICTORY_CLAIM_COPY)
- Modify: `apps/web/src/lib/content/editorial.ts:426-470` (COACH_COPY)

- [ ] **Step 1: Add new VICTORY_CLAIM_COPY fields**

Add these fields inside `VICTORY_CLAIM_COPY` (before the closing `} as const`):

```typescript
  // --- Secondary Screen Cohesion (2026-03-28) ---
  progressSteps: ["Signing", "Confirming", "Done"] as const,
  progressTimeHint: "This usually takes a few seconds",
  claimedBadge: "Victory NFT Claimed",
  errorRecoveryHint: "Your game result is saved. You can try claiming again anytime.",
```

Insert after line 309 (`},` closing `card`), before line 310 (`} as const;`).

- [ ] **Step 2: Add new COACH_COPY fields**

Add these fields inside `COACH_COPY` (before the closing `} as const`):

```typescript
  // --- Secondary Screen Cohesion (2026-03-28) ---
  loadingCanLeave: "You can leave — your result will be ready when you return.",
  creditPackSubtitle: (n: number) => `${n} game analyses`,
  unlockFullAnalysis: "Unlock Full Analysis",
```

Insert after line 469 (`creditComingSoon: "Credit packs coming soon!",`), before line 470 (`} as const;`).

- [ ] **Step 3: Build to verify no type errors**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds. No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "$(cat <<'EOF'
feat: add editorial constants for secondary screen cohesion

New copy for progress indicator, claimed badge, error recovery,
and coach loading/paywall improvements.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 2: victory-claiming.tsx — Fix Modal Trap

**Risk:** Medium — this screen is shown during active blockchain transactions. Changes must not interfere with the claiming flow in `arena/page.tsx`.
**QA:**
- Start a game, win, click Claim Victory → claiming screen shows progress dots + "Back to Hub" link.
- Progress dots animate (pulse on active step).
- "Back to Hub" link is always visible and clickable.
- Transaction still completes normally if player stays on screen.

### Task 2: Add progress indicator and escape hatch to victory-claiming

**Files:**
- Modify: `apps/web/src/components/arena/victory-claiming.tsx`

- [ ] **Step 1: Update Props type to accept step and onBackToHub**

Replace the `Props` type (lines 10-16):

```typescript
type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  claimStep?: "signing" | "confirming" | "done";
  onBackToHub: () => void;
};
```

- [ ] **Step 2: Update component signature to destructure new props**

Replace the destructuring (lines 18-22):

```typescript
export function VictoryClaiming({
  moves,
  elapsedMs,
  difficulty,
  claimStep = "signing",
  onBackToHub,
}: Props) {
```

- [ ] **Step 3: Add imports for editorial constants and Button**

Replace the imports (lines 2-6):

```typescript
import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { StatCard } from "@/components/arena/stat-card";
import { formatTime } from "@/lib/game/arena-utils";
```

- [ ] **Step 4: Replace the CTA section with progress indicator + escape**

Replace the entire `{/* Claiming state CTAs */}` div (lines 64-80) with:

```tsx
        {/* Progress indicator */}
        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            {VICTORY_CLAIM_COPY.progressSteps.map((label, i) => {
              const stepKeys = ["signing", "confirming", "done"] as const;
              const currentIdx = stepKeys.indexOf(claimStep);
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        isDone
                          ? "bg-emerald-400"
                          : isActive
                            ? "bg-emerald-400 animate-pulse"
                            : "bg-cyan-100/20"
                      }`}
                    />
                    <span
                      className={`text-[0.6rem] ${
                        isDone
                          ? "text-emerald-400/70"
                          : isActive
                            ? "text-emerald-300/80"
                            : "text-cyan-100/30"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < VICTORY_CLAIM_COPY.progressSteps.length - 1 && (
                    <div
                      className={`mb-4 h-px w-6 ${
                        isDone ? "bg-emerald-400/50" : "bg-cyan-100/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.65rem] text-cyan-100/40">
            {VICTORY_CLAIM_COPY.progressTimeHint}
          </p>
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="mt-2 text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
```

- [ ] **Step 5: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 6: Update arena-end-state.tsx to pass onBackToHub to VictoryClaiming**

In `apps/web/src/components/arena/arena-end-state.tsx`, line 84, the `<VictoryClaiming>` call currently only passes `{...sharedProps}`. Since `sharedProps` already includes `onBackToHub` (line 79), no change is needed — the prop is already being passed. Verify this is the case.

However, `onPlayAgain` and `onBackToHub` are currently optional in VictoryClaiming's old Props. Since we made `onBackToHub` required in step 1, confirm `sharedProps` includes it. It does (line 79: `onBackToHub`). No changes needed to `arena-end-state.tsx` for this task.

**Note on `claimStep` prop:** The parent (`arena/page.tsx`) does not currently track claiming sub-steps (signing vs. confirming). The `claimStep` prop defaults to `"signing"`, so the first dot will pulse. This is acceptable for v1 — the progress indicator already provides structure and escape. To make it dynamic, the `handleClaimVictory` function in `arena/page.tsx` would need to call a state setter at each stage (after signature, after approve, etc.). This is a follow-up enhancement, not a blocker for shipping.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/arena/victory-claiming.tsx
git commit -m "$(cat <<'EOF'
fix: victory-claiming — add progress indicator and escape hatch

Replace modal trap (disabled button + no escape) with:
- 3-step progress dots (Signing → Confirming → Done)
- Time hint copy
- Always-visible "Back to Hub" tertiary link

Guardrails fixed: #2 (no CTA), #3 (CTAs vanish), #4 (info hidden),
#6 (progress not felt), #12 (modal trap).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 3: victory-celebration.tsx — CTA Hierarchy

**Risk:** Low — reordering existing elements + removing one conditional CTA.
**QA:**
- Win a game → Claim Victory is the dominant CTA (full-width, emerald styling).
- Play Again is secondary (ghost variant, visible but quieter).
- Ask Coach button is NOT visible on this screen.
- Back to Hub is text-only at the bottom.
- If wallet not connected or wrong chain: Claim Victory is absent, Play Again becomes primary automatically.

### Task 3: Reorder CTAs in victory-celebration

**Files:**
- Modify: `apps/web/src/components/arena/victory-celebration.tsx`

- [ ] **Step 1: Remove AskCoachButton import**

Remove line 6:
```typescript
import { AskCoachButton } from "@/components/coach/ask-coach-button";
```

- [ ] **Step 2: Remove onAskCoach from Props type**

Remove `onAskCoach?: () => void;` from the Props type (line 22).

- [ ] **Step 3: Remove onAskCoach from destructuring**

Remove `onAskCoach,` from the component destructuring (line 35).

- [ ] **Step 4: Replace the CTAs section**

Replace the entire `{/* CTAs */}` div (lines 82-126) with:

```tsx
        {/* CTAs — Claim primary, Play Again secondary */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Claim Victory */}
          {onClaimVictory && (
            <button
              type="button"
              onClick={onClaimVictory}
              className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] py-3.5 transition-all hover:bg-emerald-500/[0.15] hover:border-emerald-400/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.12)] active:scale-[0.97]"
            >
              <span className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300/90">
                <Trophy size={16} /> {VICTORY_CLAIM_COPY.claimButton}
              </span>
              <span className="block text-xs text-emerald-200/60 mt-0.5">
                {VICTORY_CLAIM_COPY.claimValueHint(claimPrice ?? "")}
              </span>
            </button>
          )}

          {/* Secondary: Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game"
            onClick={onPlayAgain}
          >
            <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Tertiary: Back to Hub */}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
```

- [ ] **Step 5: Update arena-end-state.tsx — remove onAskCoach from VictoryCelebration**

In `apps/web/src/components/arena/arena-end-state.tsx`, line 108, remove `onAskCoach={onAskCoach}` from the `<VictoryCelebration>` JSX.

The updated block (lines 103-109) becomes:

```tsx
        return (
          <VictoryCelebration
            {...sharedProps}
            onClaimVictory={onClaimVictory}
            claimPrice={claimPrice}
          />
        );
```

- [ ] **Step 6: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds. No unused import warnings.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/arena/victory-celebration.tsx apps/web/src/components/arena/arena-end-state.tsx
git commit -m "$(cat <<'EOF'
fix: victory-celebration — Claim primary, Play Again secondary

Reorder CTAs: Claim Victory (primary) > Play Again (ghost) > Back to Hub (text).
Remove Ask Coach from pre-claim screen to avoid splitting attention
at the monetization moment. Coach remains available post-claim and on loss.

Guardrails fixed: #2 (multiple primaries), #8 (fragmented), #10 (ambiguous).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 4: victory-claim-success.tsx — Retention First

**Risk:** Medium — removing View Trophies link and restructuring share. Must not break share functionality.
**QA:**
- Win + claim → success screen shows "Victory NFT Claimed" pill badge below title.
- Play Again is the primary CTA (full-width, game-primary variant).
- Share icons row (X, WhatsApp, Copy) is compact, below Play Again.
- Ask Coach is a ghost button below share row.
- Back to Hub is text-only at the bottom.
- NO "Share Card" gradient button. NO "View Trophies" link.
- Share icons still work (X opens tweet intent, WhatsApp opens share, Copy copies link).
- Toast still appears on share/copy actions.

### Task 4: Restructure victory-claim-success CTA hierarchy

**Files:**
- Modify: `apps/web/src/components/arena/victory-claim-success.tsx`

- [ ] **Step 1: Remove unused imports**

Remove `Share2` and `Trophy` from the lucide-react import (line 5), and remove `Link` from next/link (line 4). The updated imports:

```typescript
import { useState } from "react";
import { RotateCcw, Link2 } from "lucide-react";
import { ARENA_COPY, SHARE_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { StatCard } from "@/components/arena/stat-card";
import { AskCoachButton } from "@/components/coach/ask-coach-button";
import { formatTime } from "@/lib/game/arena-utils";
import type { ClaimData, ShareStatus } from "./arena-end-state";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";
```

- [ ] **Step 2: Remove handleShareCard and handleChallengeFriend functions**

Delete the `handleShareCard` function (lines 50-63) and the `handleChallengeFriend` function (lines 66-79). Keep only `handleCopyLink` (lines 81-86).

- [ ] **Step 3: Add claimed badge below the subtitle**

After the subtitle `<p>` tag (line 116-118), add:

```tsx
        {/* Claimed badge */}
        <span className="mb-4 inline-flex items-center gap-1 rounded-full border border-amber-400/15 px-3 py-1 text-sm font-semibold text-amber-400/80">
          {VICTORY_CLAIM_COPY.claimedBadge}
        </span>
```

- [ ] **Step 4: Replace the entire share/CTAs section**

Replace everything from `{/* Share area */}` (line 127) through the closing `</div>` of the share area (line 214) with:

```tsx
        {/* CTAs — retention first */}
        <div className="flex w-full flex-col items-center gap-2.5">
          {/* Primary: Play Again */}
          <Button
            type="button"
            variant="game-primary"
            size="game"
            onClick={onPlayAgain}
            className="shadow-[0_0_16px_rgba(20,184,166,0.25)] hover:shadow-[0_0_24px_rgba(20,184,166,0.4)]"
          >
            <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Secondary (utility): Share icon strip */}
          {isShareReady && (
            <div className="flex w-full items-center justify-center gap-3">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(challengeText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(challengeText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                aria-label="Copy link"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <Link2 size={16} />
              </button>
            </div>
          )}

          {/* Toast feedback */}
          {toast && (
            <p className="text-center text-xs font-semibold text-emerald-400 animate-in fade-in duration-200">
              {toast}
            </p>
          )}

          {/* Secondary (engagement): Ask Coach */}
          {onAskCoach && <AskCoachButton onClick={onAskCoach} />}

          {/* Tertiary: Back to Hub */}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
```

- [ ] **Step 5: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/arena/victory-claim-success.tsx
git commit -m "$(cat <<'EOF'
fix: victory-claim-success — retention first, share as utility strip

- Add "Victory NFT Claimed" badge below title
- Play Again is now primary CTA (was buried near bottom)
- Share icons demoted to compact utility strip (h-9 w-9)
- Remove full-width "Share Card" gradient button
- Remove "View Trophies" link (feature not live)
- Ask Coach stays as ghost secondary below share

Guardrails fixed: #2, #7, #8, #9, #11.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 5: victory-claim-error.tsx — Recovery Hint

**Risk:** Low — one line of copy added.
**QA:**
- Win + claim → error → recovery hint text visible below the error message.
- Existing CTAs unchanged (Try Again > Play Again > Back to Hub).

### Task 5: Add recovery hint to victory-claim-error

**Files:**
- Modify: `apps/web/src/components/arena/victory-claim-error.tsx`

- [ ] **Step 1: Add recovery hint after the error message**

After line 73 (`</p>` closing the `errorMessage` paragraph), add:

```tsx
        {/* Recovery reassurance */}
        <p className="mb-2 text-center text-xs text-cyan-100/30">
          {VICTORY_CLAIM_COPY.errorRecoveryHint}
        </p>
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/arena/victory-claim-error.tsx
git commit -m "$(cat <<'EOF'
fix: victory-claim-error — add recovery hint copy

Show "Your game result is saved. You can try claiming again anytime."
below the error message to reassure players progress is not lost.

Guardrail fixed: #6 (recovery path opaque).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Victory Flow Checkpoint

At this point, phases 1-5 form a complete, shippable unit. The entire victory flow (celebration → claiming → success → error) has correct CTA hierarchy and no modal traps.

**Full QA acceptance for victory flow:**
1. Win a game (any difficulty) → celebration screen: Claim Victory primary, Play Again ghost, no Ask Coach.
2. Click Claim → claiming screen: progress dots animate, "Back to Hub" visible.
3. Claim succeeds → success screen: "Victory NFT Claimed" badge, Play Again primary, share icons compact, no "Share Card" button, no "View Trophies".
4. Claim fails → error screen: recovery hint visible, Try Again primary.
5. Win without wallet/wrong chain → celebration screen: no Claim button, Play Again becomes the only large CTA.
6. Build passes: `pnpm --filter web build`

---

## Phase 6: coach-panel.tsx + coach-fallback.tsx — CTA Hierarchy

**Risk:** Low — reordering existing elements + merging two sections.
**QA (coach-panel):**
- After full analysis: Play Again is primary (game-primary), Back to Hub is text-only.
- "WHAT YOU DID WELL" and "TAKEAWAYS" merged into single "TAKEAWAYS" section.
- Positive items prefixed with `✓`, improvement items prefixed with `→`.

**QA (coach-fallback):**
- After quick review: Play Again is primary, "Unlock Full Analysis" is ghost/secondary.
- Back to Hub is text-only at bottom.

### Task 6: Fix coach-panel CTA hierarchy and merge sections

**Files:**
- Modify: `apps/web/src/components/coach/coach-panel.tsx`

- [ ] **Step 1: Replace the "What You Did Well" + "Takeaways" sections and CTAs**

Replace everything from `{/* What You Did Well */}` (line 60) through the end of the component (line 92) with:

```tsx
      {/* Takeaways — merged praise + lessons */}
      {(response.praise.length > 0 || response.lessons.length > 0) && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{COACH_COPY.takeaways}</h3>
          <ul className="flex flex-col gap-1">
            {response.praise.map((p, i) => (
              <li key={`p-${i}`} className="text-sm text-cyan-100/60">{"\u2713"} {p}</li>
            ))}
            {response.lessons.map((l, i) => (
              <li key={`l-${i}`} className="text-sm text-cyan-100/60">{"\u2192"} {l}</li>
            ))}
          </ul>
        </section>
      )}

      {/* CTAs — Play Again primary, Back to Hub tertiary */}
      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
          <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
        </Button>
        <Button type="button" variant="game-text" size="game-sm" onClick={onBackToHub}>
          {ARENA_COPY.backToHub}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/coach/coach-panel.tsx
git commit -m "$(cat <<'EOF'
fix: coach-panel — merge praise+takeaways, fix CTA hierarchy

Merge "WHAT YOU DID WELL" and "TAKEAWAYS" into single section.
Positive items marked with ✓, improvements with →.
Play Again is primary, Back to Hub is text-only tertiary.

Guardrails fixed: #2, #8, #10, #11.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

### Task 7: Fix coach-fallback CTA hierarchy

**Files:**
- Modify: `apps/web/src/components/coach/coach-fallback.tsx`

- [ ] **Step 1: Replace the CTAs section**

Replace everything from the first `<Button` (line 53) through the last `</Button>` (line 71) with:

```tsx
      {/* Primary: Play Again — retention first */}
      <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
        <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
      </Button>

      {/* Secondary: Unlock Full Analysis — subtle upsell */}
      <Button
        type="button"
        variant="game-ghost"
        size="game-sm"
        onClick={onGetFullAnalysis}
        className="border-emerald-400/10 text-emerald-300/70"
      >
        {COACH_COPY.unlockFullAnalysis}
      </Button>

      {/* Tertiary: Back to Hub */}
      <Button type="button" variant="game-text" size="game-sm" onClick={onBackToHub}>
        {ARENA_COPY.backToHub}
      </Button>
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/coach/coach-fallback.tsx
git commit -m "$(cat <<'EOF'
fix: coach-fallback — Play Again primary, upgrade demoted to ghost

Swap CTA order: Play Again (primary) > Unlock Full Analysis (ghost) > Back to Hub (text).
f2p players feel encouraged, not paywalled.

Guardrails fixed: #2, #9, #10, #11.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 7: coach-loading.tsx — Always Show Cancel + Progress

**Risk:** Low — the cancel handler already exists in `arena/page.tsx` (line 552: `onCancel={() => setCoachPhase("idle")}`), so making it always-visible is safe.
**QA:**
- Ask Coach → loading screen: Cancel is always visible (not conditional).
- 5 progress dots animate over time.
- "You can leave" message is visible.

### Task 8: Fix coach-loading — always-visible cancel + progress dots

**Files:**
- Modify: `apps/web/src/components/coach/coach-loading.tsx`

- [ ] **Step 1: Add Button import**

Add to imports (after line 4):

```typescript
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Make onCancel required in Props**

Change `onCancel?: () => void;` to `onCancel: () => void;` in the Props type (line 15).

- [ ] **Step 3: Add elapsed time state for progress dots**

Add after the `onFailedRef` lines (after line 24):

```typescript
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const filledDots = Math.min(5, elapsed + 1);
```

- [ ] **Step 4: Replace the JSX return**

Replace the entire return block (lines 59-77) with:

```tsx
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12">
      <div className="h-16 w-16">
        <LottieAnimation src="/animations/sandy-loading.lottie" loop className="h-full w-full" />
      </div>
      <p className="text-lg font-semibold text-white">{COACH_COPY.analyzing}{dots}</p>
      <p className="text-sm text-cyan-100/40">{COACH_COPY.reviewingMoves}</p>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < filledDots
                ? i === filledDots - 1
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-emerald-400"
                : "bg-cyan-100/20"
            }`}
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-cyan-100/30">{COACH_COPY.loadingCanLeave}</p>

      <Button
        type="button"
        variant="game-text"
        size="game-sm"
        onClick={onCancel}
        className="mt-2 text-xs"
      >
        {COACH_COPY.cancel}
      </Button>
    </div>
  );
```

- [ ] **Step 5: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds. The parent in `arena/page.tsx` already passes `onCancel` (line 552), so no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/coach/coach-loading.tsx
git commit -m "$(cat <<'EOF'
fix: coach-loading — always-visible cancel + progress dots

Cancel button is now always rendered (no conditional).
Add 5 progress dots that fill over time with pulse on active.
Replace "canLeave" with clearer "loadingCanLeave" copy.

Guardrails fixed: #3 (CTA vanishes), #6 (no progress), #12 (broken pattern).

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Phase 8: coach-paywall.tsx — Highlight Pack + Value Clarity

**Risk:** Low — styling changes + copy additions only.
**QA:**
- Open coach paywall: 20-credit pack has emerald ring highlight + "BEST" badge.
- Both packs show subtitle ("5 game analyses" / "20 game analyses").
- "Or try Quick Review for free" is very small text (`text-[0.65rem] text-cyan-100/30`).

### Task 9: Polish coach-paywall visual hierarchy

**Files:**
- Modify: `apps/web/src/components/coach/coach-paywall.tsx`

- [ ] **Step 1: Add value subtitles to both packs**

In the 5-credit pack button (line 36-37), add after `$0.05`:

```tsx
            <p className="mt-1 text-xs text-cyan-100/40">{COACH_COPY.creditPackSubtitle(5)}</p>
```

In the 20-credit pack button (line 44-45), add after `$0.10`:

```tsx
            <p className="mt-1 text-xs text-cyan-100/40">{COACH_COPY.creditPackSubtitle(20)}</p>
```

- [ ] **Step 2: Add ring highlight to 20-credit pack**

Update the 20-credit pack button className (line 42) from:

```
"rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4 text-center transition-all hover:bg-emerald-500/[0.08]"
```

to:

```
"rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] ring-1 ring-emerald-400/10 p-4 text-center transition-all hover:bg-emerald-500/[0.08]"
```

- [ ] **Step 3: Demote the "Or quick review" link**

Update the wrapper `<p>` className (line 54) from:

```
"mt-4 text-center text-xs text-cyan-100/30"
```

to:

```
"mt-4 text-center text-[0.65rem] text-cyan-100/25"
```

- [ ] **Step 4: Build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/coach-paywall.tsx
git commit -m "$(cat <<'EOF'
fix: coach-paywall — highlight 20-pack, add value subtitles

- 20-credit pack gets emerald ring highlight
- Both packs show "N game analyses" subtitle for concrete value
- "Or quick review" link demoted to smallest text

Guardrails fixed: #2, #7, #10.

Wolfcito 🐾 @akawolfcito
EOF
)"
```

---

## Final Build Verification

### Task 10: Full build + incremental ship validation

- [ ] **Step 1: Run full build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && pnpm --filter web build`
Expected: All pages compile. No type errors.

- [ ] **Step 2: Verify commit history**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && git log --oneline -10`
Expected: 9 commits from this plan (1 editorial + 4 victory + 4 coach).

- [ ] **Step 3: Verify no sensitive files staged**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito && git diff --staged`
Expected: Empty (all committed).

---

## Incremental Ship Strategy

The plan is designed so the flow is **never left half-broken**:

| After phase | State | Safe to ship? |
|-------------|-------|---------------|
| 1 (editorial) | New constants exist but are unused. No visual change. | Yes (no-op) |
| 2 (claiming) | Claiming screen has progress + escape. Other screens unchanged. | Yes |
| 3 (celebration) | Celebration has correct hierarchy. Claiming already fixed. | Yes |
| 4 (success) | Full victory flow complete (celebration → claiming → success). | **Yes — ship here for maximum impact** |
| 5 (error) | Error screen has recovery hint. All victory screens done. | Yes |
| 6 (panel+fallback) | Coach CTA hierarchy fixed. Independent of victory flow. | Yes |
| 7 (loading) | Coach loading has cancel + progress. Independent. | Yes |
| 8 (paywall) | Paywall polished. Independent. | Yes |

**Recommended ship points:** After phase 5 (complete victory flow) and after phase 8 (complete coach flow).
