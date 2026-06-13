# Coach 4-Button Action Model — Implementation Plan (Plan 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Play Again · Save · Share · Ask Coach four independent, always-present actions across Match Review and the victory popup, so an already-saved game never "loses" its Save/Share buttons — the confusing state the founder hit.

**Architecture:** Decouple the action button SET from mint state. In Match Review (`game-actions-bar.tsx`) wins always render 4 tiles; Save is shown regardless of `mintedTokenId` (unlimited re-save is intended), Share builds its card from `gameId` via `/api/og/match` (no mint-receipt dependency). The victory popups align to the same 4 actions. Single-tap idempotency already exists (`claimingRef`) and is locked with a regression test. The mint-receipt endpoint is adjusted so a second save (new tokenId) is not rejected.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest + RTL, Tailwind + `globals.css`, next-intl.

**Spec:** `docs/superpowers/specs/2026-06-13-coach-analysis-value-design.md` (Plan 1 section).

---

## File structure

- `apps/web/src/components/coach/game-actions-bar.tsx` — 4-tile slate (win), 3-tile (loss/draw); Save + Share unconditional on win.
- `apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx` — slate tests.
- `apps/web/src/app/globals.css` — `data-count="4"` grid rule.
- `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx` — `handleShare` builds a gameId card when no mint link exists.
- `apps/web/src/components/arena/victory-claim-success.tsx` — add Save + always-Share.
- `apps/web/src/app/api/games/[id]/mint-receipt/route.ts` — allow latest tokenId on re-save.
- `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts` — re-save acceptance test.

---

## Task 1: Match Review — Save tile unconditional on win

**Files:**
- Modify: `apps/web/src/components/coach/game-actions-bar.tsx:172-209`
- Test: `apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx`

- [ ] **Step 1: Write the failing test** (append to the existing `describe("GameActionsBar")`)

```tsx
it("win + minted: STILL shows Save Victory (unlimited re-save) plus Share + Ask Coach + Play Again", () => {
  render(
    <GameActionsBar
      {...baseProps}
      result="win"
      mintedTokenId="42"
      shareLinkUrl="https://www.chesscito.com/victory/42"
      claimPrice="$0.005"
    />,
  );
  expect(screen.getByRole("button", { name: /saveVictory/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /shareTrophy|share/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /askCoach/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- game-actions-bar`
Expected: FAIL — current `isWin && isMinted` branch (line 186) drops the Save tile, so `getByRole(... /saveVictory/)` throws.

- [ ] **Step 3: Merge the win branches so Save is always present on a win**

Replace the two win branches (`game-actions-bar.tsx:172-209`) with a single win branch:

```tsx
  } else if (isWin) {
    tiles = [
      playAgainTile,
      {
        kind: "save-victory",
        label: t("saveVictory"),
        ariaLabel: claimPrice
          ? t("saveVictoryAriaLabel", { price: claimPrice })
          : t("saveVictory"),
        onClick: onMint,
        priceRibbon: claimPrice ?? undefined,
      },
      {
        kind: "share",
        label: isMinted ? t("shareTrophy") : t("share"),
        onClick: onShare,
      },
      askCoachTile,
    ];
    if (isMinted) {
      tertiary = (
        <button
          type="button"
          onClick={onViewNft}
          className="coach-viewer__actions-tertiary"
          aria-label={t("viewOnCeloscan")}
        >
          {t("viewOnCeloscan")}
        </button>
      );
    }
  } else {
```

(Note: the `share` tile no longer depends on `shareLinkUrl`. The `t("share")` key is added in Task 3. `onViewNft` tertiary stays only when minted.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- game-actions-bar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/game-actions-bar.tsx apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx
git commit -m "feat(coach): Save Victory tile stays on win after minting (unlimited re-save)

Wolfcito 🐾 @akawolfcito"
```

---

## Task 2: Match Review — loss/draw shows Share too

**Files:**
- Modify: `apps/web/src/components/coach/game-actions-bar.tsx:210-222`
- Test: same test file

- [ ] **Step 1: Write the failing test**

```tsx
it("loss: shows Play Again + Share + Ask Coach (no Save)", () => {
  render(<GameActionsBar {...baseProps} result="lose" />);
  expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /askCoach/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /saveVictory/ })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- game-actions-bar`
Expected: FAIL — current else branch (line 212) is `[playAgainTile, askCoachTile]`, no Share.

- [ ] **Step 3: Add Share to the loss/draw/resigned branch**

Replace `game-actions-bar.tsx:212`:

```tsx
    tiles = [
      playAgainTile,
      { kind: "share", label: t("share"), onClick: onShare },
      askCoachTile,
    ];
```

(Keep the existing `tertiary` Back to Hub button below.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- game-actions-bar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/coach/game-actions-bar.tsx apps/web/src/components/coach/__tests__/game-actions-bar.test.tsx
git commit -m "feat(coach): show Share on loss/draw match review (independent action)

Wolfcito 🐾 @akawolfcito"
```

---

## Task 3: Add `share` i18n key + 4-tile CSS

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts` (COACH_VIEWER_COPY block) + ES catalog
- Modify: `apps/web/src/app/globals.css` (tiles-row)

- [ ] **Step 1: Add the `share` string** to the `COACH_VIEWER_COPY` object in `editorial.ts` (next to `shareTrophy`):

```ts
share: "Share",
```

Add the ES equivalent in the Spanish catalog where `shareTrophy` lives:

```ts
share: "Compartir",
```

- [ ] **Step 2: Add the `data-count="4"` grid rule** to `globals.css` (immediately after the `[data-count="3"]` rule):

```css
.coach-viewer__tiles-row[data-count="4"] {
  --coach-viewer-tile-count: 4;
}
```

- [ ] **Step 3: Verify build + i18n key resolves**

Run: `pnpm --filter web test -- game-actions-bar`
Expected: PASS (the `t("share")` taps now resolve; tests mock next-intl to echo the key, so this is a non-regression check).

- [ ] **Step 4: Manual viewport check (390px)**

Run: `pnpm --filter web dev`, open a won game's Match Review at 390px width.
Expected: 4 tiles fit on one row (4 × ~96px ≈ 384px + gaps within `--app-max-width: 390px`); no wrap/overflow.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts apps/web/src/app/globals.css
git commit -m "feat(coach): add Share label + 4-tile grid rule for action bar

Wolfcito 🐾 @akawolfcito"
```

---

## Task 4: Share independent of mint in the viewer

**Files:**
- Modify: `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx` (`handleShare` + `shareLinkEffective`, around lines 150-159, 338, 573-576)

**Context:** today `shareLinkEffective = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? null` (line 338). When neither exists (never minted), Share has no card. `/api/og/match` builds a card from `{moves,time,diff,result,fen,color}` — all present on `gameRecord` — with NO mint receipt (verified: `app/api/og/match/route.tsx`).

- [ ] **Step 1: Read** `coach-game-client.tsx:110-160` and `330-580` to confirm the `handleShare` body, the `ShareModal` props, and the `gameRecord` fields available (`moves`, `result`, `difficulty`, `startingFen`/`fen`, `playerColor`).

- [ ] **Step 2: Build a gameId-based card fallback.** Where `shareLinkEffective` is computed (line 338), add a `shareCardEffective` that falls back to an `/api/og/match` URL built from `gameRecord` when no minted card exists:

```tsx
const matchCardUrl = (() => {
  const p = new URLSearchParams({
    moves: String(gameRecord.totalMoves ?? 0),
    time: String(gameRecord.elapsedMs ?? 0),
    diff: gameRecord.difficulty,
    result: gameRecord.result === "win" ? "win" : gameRecord.result === "draw" ? "draw" : "loss",
  });
  if (gameRecord.startingFen) p.set("fen", gameRecord.startingFen);
  return `/api/og/match?${p.toString()}`;
})();
const shareCardEffective = mint.data.shareCardUrl ?? gameRecord.shareCardUrl ?? matchCardUrl;
const shareLinkEffective = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? SHARE_COPY.url;
```

(Import `SHARE_COPY` from `@/lib/content/editorial` if not already imported. Use the exact `gameRecord` field names confirmed in Step 1; adjust `totalMoves`/`elapsedMs`/`startingFen` to the real property names.)

- [ ] **Step 3: Pass the effective card/link to `ShareModal`** so Share works pre-mint. Ensure the `ShareModal` `cardUrl`/`url` props use `shareCardEffective`/`shareLinkEffective`.

- [ ] **Step 4: Verify** — open a never-minted won game's Match Review, tap Share.
Expected: ShareModal opens with the `/api/og/match` card; no error, no dependency on a mint.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx
git commit -m "feat(coach): Share builds a match card from gameId when unminted

Wolfcito 🐾 @akawolfcito"
```

---

## Task 5: Victory popup — add Save + always-Share to VictoryClaimSuccess

**Files:**
- Modify: `apps/web/src/components/arena/victory-claim-success.tsx`
- Modify: `apps/web/src/components/arena/arena-end-state.tsx` (pass an `onMint`/re-save handler + always-ready share to the success popup)

**Context:** `VictoryCelebration` (pre-mint) already renders all 4 actions (Save section, Coach section, Play Again, Share). `VictoryClaimSuccess` (post-mint) is MISSING Save and gates Share on `shareStatus==="ready"`. Add both so the post-save popup also exposes the 4 independent actions.

- [ ] **Step 1: Read** `victory-claim-success.tsx:222-243` (the secondary row) and `arena-end-state.tsx:240-251` (how the success popup is wired) to confirm available handlers.

- [ ] **Step 2: Add a Save action** to `VictoryClaimSuccess`. Add an `onSaveAgain?: () => void` prop and render a Save button in the secondary/tertiary row (reuse `arena-result-secondary-action` styling or the Save sprite). Wire it from `arena-end-state.tsx` to the same claim handler used by `VictoryCelebration` (`guardedOnClaim` / `onClaimVictory`).

- [ ] **Step 3: Make Share unconditional.** Change `victory-claim-success.tsx:234` from `{isShareReady && (...)}` to always render the Share button; when `shareStatus !== "ready"`, fall back to the gameId `/api/og/match` card (mirror Task 4's `matchCardUrl` from the `claimData`/match params already in scope).

- [ ] **Step 4: Test (RTL)** — add `victory-claim-success.test.tsx` if absent (use the next-intl echo mock from `game-actions-bar.test.tsx`):

```tsx
it("renders Save, Share, Ask Coach, and Play Again after a save", () => {
  render(<VictoryClaimSuccess {...baseClaimProps} onSaveAgain={vi.fn()} />);
  expect(screen.getByRole("button", { name: /playAgain|playAgainShort/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /winCoachReviewCta/ })).toBeInTheDocument();
});
```

(Build `baseClaimProps` from the component's `Props` — see `victory-claim-success.tsx:16-36`.)

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter web test -- victory-claim-success`
Expected: PASS.

```bash
git add apps/web/src/components/arena/victory-claim-success.tsx apps/web/src/components/arena/arena-end-state.tsx apps/web/src/components/arena/__tests__/victory-claim-success.test.tsx
git commit -m "feat(arena): post-save popup exposes Save + Share alongside Coach + Play Again

Wolfcito 🐾 @akawolfcito"
```

---

## Task 6: Lock single-tap idempotency with a regression test

**Files:**
- Test: `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts` (create if absent)

**Context:** `use-mint-victory.ts:326` already guards re-entrancy: `if (claimingRef.current) return; claimingRef.current = true;`. This test locks that behavior so a future refactor can't reintroduce a double-charge from one tap.

- [ ] **Step 1: Write the failing/locking test** — render the hook (via `@testing-library/react` `renderHook`), mock the signing fetch + wallet client so `start()` stays in the "claiming" phase, call `start()` twice synchronously, assert the signing fetch fired exactly once.

```ts
it("a double-tapped start() fires exactly one signature request", async () => {
  const signFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({/* signed payload */}) });
  // ...wire signFetch into the hook's fetch dependency / global fetch mock...
  const { result } = renderHook(() => useMintVictory(baseMintInput));
  act(() => { result.current.start(); result.current.start(); });
  await waitFor(() => expect(signFetch).toHaveBeenCalledTimes(1));
});
```

(Wire the exact fetch/wallet mocks per the hook's dependencies — read `use-mint-victory.ts:280-340` to see what `start()` calls first.)

- [ ] **Step 2: Run** — Expected: PASS immediately (the guard already exists). If it FAILS, the guard regressed — fix before continuing.

Run: `pnpm --filter web test -- use-mint-victory`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts
git commit -m "test(coach): lock single-tap mint idempotency (claimingRef guard)

Wolfcito 🐾 @akawolfcito"
```

---

## Task 7: Allow re-save (new tokenId) in the mint-receipt endpoint

**Files:**
- Modify: `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:108-119`
- Test: `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts`

**Context (decision):** today a different tokenId on the same gameId returns **409 "Token mismatch"** (`route.ts:108-115`). With unlimited re-save, a second save mints a NEW tokenId for the same game — the 409 would reject its receipt, leaving the UI pointing at the first trophy. Decision: **store the latest tokenId** (most recent save wins) so Share/acknowledgment reflect the newest collectible. (Alternative — a list of tokenIds — is heavier; defer unless the founder wants a gallery.)

- [ ] **Step 1: Write the failing test**

```ts
it("re-save with a new tokenId overwrites with the latest (no 409)", async () => {
  // seed gameRecord with mintedTokenId="1"
  // POST mint-receipt with tokenId="2"
  // expect 200 and gameRecord.mintedTokenId === "2"
});
```

(Follow the existing test file's Redis-mock + request-builder boilerplate.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test -- mint-receipt`
Expected: FAIL — current code returns 409 on a different tokenId.

- [ ] **Step 3: Replace the 409 mismatch branch with latest-wins**

In `route.ts`, replace the `if (existing.mintedTokenId && existing.mintedTokenId !== body.tokenId) { ... 409 }` block: keep a `log.info("mint_receipt_resave", {...})` for observability, then fall through to the normal write (overwrite with the new tokenId/txHash/share URLs). Keep the `existing.mintedTokenId === body.tokenId` idempotent-200 branch.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test -- mint-receipt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/games/[id]/mint-receipt/route.ts apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts
git commit -m "feat(api): mint-receipt accepts re-save with latest tokenId (unlimited re-save)

Wolfcito 🐾 @akawolfcito"
```

---

## Task 8: Full suite + VR baselines

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm --filter web test`
Expected: green (baseline 3623/3623 per last handoff; report the new count).

- [ ] **Step 2: Refresh VR baselines** for the action bar + popups (4-tile row is a visual change)

Run: `pnpm --filter web test:e2e:visual -g "coach-viewer|victory|action"`
Review diffs (4 tiles vs 3), refresh validated baselines in the same change. If reds are unrelated stale baselines, follow MEMORY `vr-baseline-drift` triage.

- [ ] **Step 3: Commit baselines**

```bash
git add apps/web/<vr-baseline-paths>
git commit -m "test(vr): refresh action-bar + victory popup baselines for 4-button row

Wolfcito 🐾 @akawolfcito"
```

---

## Open decisions (resolve during execution, do not block)

1. **Popup convergence (Task 5):** once both popups expose 4 actions, the pre/post-save distinction is mostly the headline. Converging `VictoryCelebration` + `VictoryClaimSuccess` into one popup is a nice follow-up but NOT required here — keep them separate unless trivial.
2. **Re-save receipt (Task 7):** latest-wins chosen. If the founder later wants every saved NFT visible (a gallery), revisit to store a tokenId list.
3. **Loss saveability:** Save = mint a victory collectible → not offered on loss/draw (Task 2). Confirm with founder if a "save any match" collectible is ever wanted.

## Self-review notes

- Spec Plan-1 coverage: 4-button slate (T1,T2), Share independent (T3,T4), popup alignment (T5), single-tap idempotency (T6), receipt ordering/re-save (T7). ✓
- Render fix (Plan 2) and ribbon (Plan 3) are separate plans — not in this file. ✓
- Idempotency item confirmed already-implemented → reframed as a locking test (T6), not new code. ✓
