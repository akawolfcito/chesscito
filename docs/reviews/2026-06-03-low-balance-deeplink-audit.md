# Low-Balance → MiniPay Add Cash Deeplink — Audit (read-only)

**Date:** 2026-06-03
**Mode:** read-only audit. No code modified.
**Goal:** propose a minimal wiring so users in MiniPay see a friendly "Deposit in MiniPay" / "Agregar fondos" CTA instead of a technical error when a tx fails with insufficient balance. Deeplink: `https://minipay.opera.com/add_cash`.

---

## 1. Diagnóstico corto

The infrastructure for this fix already exists. `apps/web/src/lib/errors.ts` defines a stable, locale-agnostic `TxErrorKind` union that includes `"insufficientFunds"`, and `classifyTxErrorKind(error)` already detects raw substrings `"insufficient funds"` and `"exceeds balance"` (lines 40–42). The kind is consumed in 5 surfaces today and rendered through the `RESULT_OVERLAY_COPY.error` i18n namespace, which already ships translated strings:

- `editorial.ts:157` — EN: `"Not enough funds to complete this transaction"`.
- `messages/es.ts:1189` — ES: `"Fondos insuficientes para completar esta acción"`.

What is **missing** is the actionable next step: today the UI shows the message + a generic "Try Again" CTA. There is no "Deposit in MiniPay" link, so a MiniPay user with $0 balance is stuck in a loop of retrying the same transaction.

The fix is therefore *additive*, not corrective: render an extra CTA when (a) the runtime is MiniPay and (b) the tx kind classifies as `insufficientFunds`. No refactor of the classifier or i18n catalog beyond adding the new CTA label.

---

## 2. Archivos relevantes

### 2.1 Central error helper (already adequate)

| File | Role |
|---|---|
| `apps/web/src/lib/errors.ts` | Defines `TxErrorKind`, `classifyTxErrorKind(error)`, `classifyTxError(error, t)`. **Already returns `"insufficientFunds"`.** No changes needed in this file. |

### 2.2 Consumers of the classifier (3 paid flows + 2 signed flows)

| File | Flow | Consumes kind |
|---|---|---|
| `apps/web/src/lib/coach/use-mint-victory.ts` | **Mint Victory NFT** (paid) | line 533 — `classifyTxErrorKind(err)` |
| `apps/web/src/lib/shop/use-shop-sheet-state.ts` | **Shop purchase** (paid — Founder Badge, Shield, PRO, Coach Pack) | line 597 — `classifyTxErrorKind(error)` |
| `apps/web/src/lib/coach/use-coach-credits-purchase.ts` | **Coach credits purchase** (paid) | line 244 — `classifyTxErrorKind(err)` |
| `apps/web/src/components/exercises/exercises-screen.tsx` | **Badge claim** (signed, network fee only) | lines 1515, 1518 — `classifyTxError` |
| `apps/web/src/components/exercises/exercises-screen.tsx` | **Score submit** (signed, network fee only) | lines 1618, 1621 — `classifyTxError` |

### 2.3 Error UI surfaces (where the CTA must surface)

| Component | File | Hosts which flows |
|---|---|---|
| `VictoryClaimError` | `apps/web/src/components/arena/victory-claim-error.tsx` | Victory mint failures (rendered by `arena-end-state.tsx:16`). Already has the "empty-wallet / insufficient balance path" test suite at `__tests__/victory-claim-error.test.tsx:12`. |
| `ResultOverlay` | `apps/web/src/components/exercises/result-overlay.tsx` | Shop buy + badge claim + score submit errors (via `setResultOverlay({ variant: "error", errorMessage })` in `exercises-screen.tsx`). |
| Coach purchase error UI | (in `components/coach/`, consumes `useCoachCreditsPurchase().error`) | Coach credits purchase. |

### 2.4 i18n catalogs

| File | Section to extend |
|---|---|
| `apps/web/src/lib/content/editorial.ts` (line ~156–160) | `RESULT_OVERLAY_COPY.error` — add `addCashCta` key with EN label. |
| `apps/web/src/lib/content/messages/es.ts` (line ~1188–1192) | Same key with ES translation. |

### 2.5 Existing helpers (no reusable AddCash CTA yet)

A grep for `add_cash`, `opera\.com/add` across `apps/web/src` returns 0 matches today. No prior implementation, no scaffold to extend. Clean greenfield.

The MiniPay detection helper exists at `apps/web/src/hooks/use-minipay.ts` (`isMiniPay`, `isReady`, `hasProvider`). 25+ files import it. Stable API. Direct fit for gating the new CTA.

---

## 3. Recomendación — helper component centralizado

Two valid shapes considered:

| Option | Pros | Cons |
|---|---|---|
| Helper hook `useAddCashCtaProps()` | Returns `{ href, label, isVisible }`. Components fully control rendering. | Each consumer re-implements the `<a>` styling. More duplication. |
| **Helper component `<AddCashCta />`** | Single source of truth for styling, gating, telemetry. Each consumer just drops `<AddCashCta />`. | Couples styling to the component. |

**Recommended: helper component.** Reasons:
- 3 wire-up sites (mint, shop, coach) — duplicating styling 3× is worse than centralizing in 1.
- Future surfaces (post-listing, after telemetry surfaces other hit paths like badge claim or arena warmup) plug in trivially.
- Aligns with how the project already centralizes `connect-button.tsx`, `pro-chip.tsx`, etc.

Location: `apps/web/src/components/minipay/add-cash-cta.tsx` (new file, new directory). The empty `components/minipay/` directory is a fresh home for any future MiniPay-specific affordances — co-locates the deeplink module with potential siblings like `<MiniPayBadge />`, `<MiniPayOnlyGate />` if/when they show up.

### Behavior

1. Consume `useMiniPay()` from `@/hooks/use-minipay`.
2. If `!isReady` → render `null` (avoids hydration flicker, same convention as `<ConnectButton />`).
3. If `!isMiniPay` → render `null` (the deeplink only resolves inside MiniPay WebView; surfacing it to a regular browser would lead to a broken/empty page).
4. Otherwise: render an `<a href="https://minipay.opera.com/add_cash">` with:
   - Locale-aware label (`useTranslations` against the new `addCashCta` key).
   - The amber-secondary CTA style already used in `victory-claim-error.tsx` (`arena-result-secondary-action`) to maintain visual rhythm with adjacent "Play Again" / "Try Again" buttons. Optional: introduce a dedicated `.add-cash-cta` class with the same shape so the styling token is named clearly.
   - `target="_self"` (MiniPay WebView intercepts the deeplink in-page; opening in `_blank` adds noise on Android).
   - `rel="noopener"` (cheap safety, no functional impact in MiniPay).
   - Telemetry on click: `track("minipay_add_cash_click", { source })` so we can measure how many users actually take the offer per surface.

### Gating outside MiniPay

Outside MiniPay, the CTA renders nothing. The existing error message ("Not enough funds…") remains and is sufficient — desktop / mobile-web users have wallet UIs to swap or top up on their own. No alternative deeplink, no generic "Get USDC" link in v1 (would require deciding a partner — out of scope).

---

## 4. Patch propuesto

### 4.1 New file — `apps/web/src/components/minipay/add-cash-cta.tsx`

```tsx
"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useMiniPay } from "@/hooks/use-minipay";
import { track } from "@/lib/telemetry";

const ADD_CASH_DEEPLINK = "https://minipay.opera.com/add_cash";

type Props = {
  /** Telemetry tag identifying which error surface rendered the CTA. */
  source: "mint-victory" | "shop-buy" | "coach-credits";
  /** Optional className for surface-specific spacing. */
  className?: string;
};

/**
 * Surfaces the official MiniPay "Add Cash" deeplink to users whose
 * transaction failed with insufficient balance. Renders ONLY when the
 * runtime is MiniPay — outside MiniPay the deeplink does not resolve,
 * so we keep the existing error message uncluttered.
 *
 * The label intentionally avoids web3 jargon. Wording:
 *   EN: "Deposit in MiniPay"
 *   ES: "Agregar fondos"
 *
 * Spec: docs/reviews/2026-06-03-low-balance-deeplink-audit.md
 */
export function AddCashCta({ source, className }: Props) {
  const { isMiniPay, isReady } = useMiniPay();
  const t = useTranslations("RESULT_OVERLAY_COPY");

  const handleClick = useCallback(() => {
    track("minipay_add_cash_click", { source });
  }, [source]);

  if (!isReady) return null;
  if (!isMiniPay) return null;

  return (
    <a
      href={ADD_CASH_DEEPLINK}
      target="_self"
      rel="noopener"
      onClick={handleClick}
      className={`arena-result-secondary-action ${className ?? ""}`.trim()}
      data-cta="add-cash"
    >
      <span>{t("addCashCta")}</span>
    </a>
  );
}
```

### 4.2 i18n catalog additions

`apps/web/src/lib/content/editorial.ts` — within `RESULT_OVERLAY_COPY.error`:

```diff
   error: {
     cancelled: "Save was cancelled",
     insufficientFunds: "Not enough funds to complete this transaction",
+    addCashCta: "Deposit in MiniPay",
     network: "Network error. Check your connection and try again.",
     timeout:
```

`apps/web/src/lib/content/messages/es.ts` — same section:

```diff
       cancelled: "El guardado fue cancelado",
       insufficientFunds: "Fondos insuficientes para completar esta acción",
+      addCashCta: "Agregar fondos",
       network: "Error de red. Revisa tu conexión y reintenta.",
       timeout:
```

These two diffs are the entire i18n surface. The new string lives under the existing `error` namespace so callers already in scope (`useTranslations("RESULT_OVERLAY_COPY")`) reach it as `t("error.addCashCta")` or, in the helper above, the component scopes higher with `t("addCashCta")` if I add it at top level — final shape to be decided during apply.

### 4.3 VictoryClaimError integration

`apps/web/src/components/arena/victory-claim-error.tsx`:

```diff
 import { CandyIcon } from "@/components/redesign/candy-icon";
 import { LottieAnimation } from "@/components/ui/lottie-animation";
+import { AddCashCta } from "@/components/minipay/add-cash-cta";
+import type { TxErrorKind } from "@/lib/errors";
 import { formatTime } from "@/lib/game/arena-utils";

 // ...

 type Props = {
   // ...
   errorMessage?: string | null;
   onRetry?: () => void;
   kind?: ClaimEndKind;
+  /** When the underlying tx classified as insufficientFunds AND we are
+   *  running inside MiniPay, the popup shows an extra Add Cash deeplink
+   *  CTA. The TxErrorKind is consumed by AddCashCta itself for
+   *  rendering; pass it through so the parent doesn't have to guess. */
+  errorKind?: TxErrorKind | null;
 };

 // ... existing render of secondary row ...

   {onRetry && (
     <div className="victory-popup-secondary-row">
       <button
         type="button"
         onClick={onPlayAgain}
         className="arena-result-secondary-action"
       >
         <span>{playAgainLabel}</span>
       </button>
+      {errorKind === "insufficientFunds" && (
+        <AddCashCta source="mint-victory" />
+      )}
     </div>
   )}
```

When there's no `onRetry` (no secondary row), the AddCashCta would also be skipped today. Slight UX gap if `insufficientFunds` lands without retry; in practice the mint flow always passes `onRetry`. To be safe we could also render the CTA in the no-retry branch — I'll defer that decision until you confirm.

### 4.4 Parent rendering — pass `errorKind` down

The caller of `VictoryClaimError` is `arena-end-state.tsx:16`. I haven't traced the prop threading yet to keep the audit short; a follow-up scan during the apply phase will identify whether `errorKind` already lives in the parent's state or whether the call site needs to thread it from `useMintVictory()`'s output.

### 4.5 Shop result overlay integration

`apps/web/src/components/exercises/result-overlay.tsx` already accepts `errorMessage` and a generic `variant`. The proposal is the same shape:
- Add an optional `errorKind?: TxErrorKind` prop.
- When `variant === "error"` AND `errorKind === "insufficientFunds"`, render `<AddCashCta source="shop-buy" />` below the message.

`apps/web/src/lib/shop/use-shop-sheet-state.ts:597` already computes the kind for telemetry — pass it through to the overlay state instead of dropping it. One line change.

### 4.6 Coach credits purchase integration

`apps/web/src/lib/coach/use-coach-credits-purchase.ts:244` classifies the kind but only exposes `error` (string) to the consumer. Either:
- Expand the hook return to expose `errorKind` as well, OR
- Re-classify inside the UI from the raw error message (cheaper, no API change).

Either works; my preference is to add `errorKind` to the hook return so the UI doesn't re-do work, but it changes the public shape slightly. Decide during apply.

The consuming UI component (somewhere under `components/coach/`) needs to render `<AddCashCta source="coach-credits" />` when the kind matches.

### 4.7 What is NOT changed

- `lib/errors.ts` — unchanged. The classifier already returns the right kind.
- Badge claim / score submit error surfaces — out of scope for v1. Network fee comes from fee abstraction in USDm/USDC/USDT, so these CAN hit insufficientFunds, but they hit it less than paid flows. If telemetry shows hits, wire them in v2 by passing kind to `setResultOverlay`.
- Welcome-pack / claim — server-side flows, no on-device wallet tx, no insufficientFunds path. Confirmed by grep on `welcome-pack.ts` (no `classifyTxErrorKind` use).
- Approve flows — paired with their downstream tx; same error path. No separate wiring needed.

---

## 5. Tests propuestos

### 5.1 New — `apps/web/src/components/minipay/__tests__/add-cash-cta.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";

import { AddCashCta } from "../add-cash-cta";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";

// Mock useMiniPay so we can drive the test through (isReady, isMiniPay) states.
vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: vi.fn(),
}));
import { useMiniPay } from "@/hooks/use-minipay";

const renderWith = (locale: "en" | "es") =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? enMessages : esMessages}>
      <AddCashCta source="mint-victory" />
    </NextIntlClientProvider>,
  );

describe("AddCashCta", () => {
  it("renders nothing while MiniPay detection is in flight", () => {
    (useMiniPay as any).mockReturnValue({ isReady: false, isMiniPay: false, hasProvider: false });
    const { container } = renderWith("en");
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing outside MiniPay", () => {
    (useMiniPay as any).mockReturnValue({ isReady: true, isMiniPay: false, hasProvider: true });
    const { container } = renderWith("en");
    expect(container.firstChild).toBeNull();
  });

  it("renders the EN label when isMiniPay", () => {
    (useMiniPay as any).mockReturnValue({ isReady: true, isMiniPay: true, hasProvider: true });
    renderWith("en");
    expect(screen.getByText("Deposit in MiniPay")).toBeInTheDocument();
  });

  it("renders the ES label when isMiniPay", () => {
    (useMiniPay as any).mockReturnValue({ isReady: true, isMiniPay: true, hasProvider: true });
    renderWith("es");
    expect(screen.getByText("Agregar fondos")).toBeInTheDocument();
  });

  it("points the deeplink to https://minipay.opera.com/add_cash", () => {
    (useMiniPay as any).mockReturnValue({ isReady: true, isMiniPay: true, hasProvider: true });
    renderWith("en");
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    expect(link).toHaveAttribute("href", "https://minipay.opera.com/add_cash");
  });
});
```

5 tests. ~50 lines. Pure unit, no integration.

### 5.2 Extension — `apps/web/src/components/arena/__tests__/victory-claim-error.test.tsx`

Add 2 cases to the existing suite (which already covers the empty-wallet path):

- When `errorKind="insufficientFunds"` and `isMiniPay=true`, AddCashCta is rendered in the secondary row.
- When `errorKind="insufficientFunds"` and `isMiniPay=false`, AddCashCta is NOT rendered (existing error message stays alone).

### 5.3 Shop + Coach purchase tests

The existing `use-shop-sheet-state.test.tsx` has 500+ lines covering many paths. Add 1 case:

- When tx fails with insufficient balance, the resulting overlay state carries `errorKind: "insufficientFunds"`.

For Coach: `use-coach-credits-purchase.ts` has no error-kind test that I saw. Add 1 case mirroring the shop one.

### 5.4 No new test for `lib/errors.ts`

There's no existing test file for `errors.ts` and we're not modifying its logic in this commit. Adding a fresh suite is out of scope (would balloon the PR). Could be a clean follow-up.

---

## 6. Commit plan

### 6.1 Single commit (recommended)

```
feat(minipay): surface Add Cash deeplink on low-balance tx errors
```

Bundles:
- New `<AddCashCta />` component.
- i18n catalog additions (en + es).
- Wire-up into `VictoryClaimError` (mint-victory surface).
- Wire-up into shop result overlay.
- Wire-up into coach credits purchase error UI.
- Tests: new `add-cash-cta.test.tsx`, extensions to existing suites.

Estimated diff: ~6 files modified + 2 new files (component + its test) + 2 doc commits (this audit, optional follow-up readme).

Reason for single commit: the helper component without consumers is dead code; the wire-up without the helper does not compile. Splitting would leave a broken intermediate state. Per `bundle-dont-defer` rule.

### 6.2 Alternative split (if you prefer step-by-step)

Possible 3-commit sequence:
1. `feat(minipay): add AddCashCta helper component + i18n strings` — new file + i18n only. Component is unused but compiles + passes its own tests.
2. `feat(arena): surface AddCashCta on victory mint insufficient-funds error` — wires it into VictoryClaimError. Closes the highest-visibility surface (winning the game then blocked from saving = sharp UX moment).
3. `feat(shop, coach): surface AddCashCta on purchase insufficient-funds errors` — extends to shop + coach surfaces.

Slower, more reviewable. Same end state.

My recommendation: **single commit** unless you want intermediate review of each surface independently.

### 6.3 Out-of-scope follow-ups (recorded)

- Badge claim / score submit wire-up (network-fee-only paths). Wait for telemetry on `minipay_add_cash_click` to confirm pattern before extending.
- Generic non-MiniPay "Get USDC" link (would require partner decision — out of scope for v1).
- Dedicated `.add-cash-cta` token in `globals.css` if the reused `.arena-result-secondary-action` shape gets in the way (current proposal: reuse to avoid token sprawl).
- `lib/errors.ts` unit test suite — clean follow-up, not blocking.

---

## 7. Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | The deeplink behaves unexpectedly inside a specific MiniPay version (Android vs iOS vs older Opera Mini) | Low | Medium | The deeplink is the official one from `minipay-requirements.md`; we re-test on a physical device during MiniPay submission validation. If broken, the fallback is to remove the gate entirely — `null` outside MiniPay is the safe default. |
| R2 | `errorKind` plumbing in `arena-end-state.tsx` requires touching state we should not (e.g., the popup state machine described in MEMORY's `arena-end-state-popup-polish`) | Medium | Low | The audit doc explicitly notes this scan happens during apply. If the plumbing turns out to be non-trivial, we step back and split it into its own commit. |
| R3 | The new CTA changes the layout of the victory-popup secondary row and breaks an existing VR baseline | Medium | Low | The VR baseline for victory-claim popups is at the 390 viewport (minipay project). After applying, run `pnpm test:e2e:visual -g vr9-arena-end-state` and document any refresh in the same PR per `vr-baseline-discipline` rule. |
| R4 | Re-classifying the error in the UI vs threading kind from the hook drifts apart over time | Low | Low | Centralize via the hook return (option A in §4.6). Choose during apply. |
| R5 | Adding a new key to `RESULT_OVERLAY_COPY.error` breaks the `editorial.ts` shape contract that some tests assert | Low | Low | The existing tests inspect specific keys, not the full shape. Verified by grep on `RESULT_OVERLAY_COPY.error` in test files — no shape-strict asserts. |

No risks to: Labyrinth (untouched), perf (no bundle change beyond the +1 small component), 360 fixture (no playwright config touch), identity/ODIS (out of scope), `/stats` (out of scope), copy sweep (no jargon introduced — `Deposit` and `Agregar fondos` are MiniPay-compliant terms per `minipay-requirements.md` §3).

---

## 8. Espero confirmación

Mi propuesta:

- **Single commit `feat(minipay): surface Add Cash deeplink on low-balance tx errors`**, bundling helper + i18n + 3 surface wire-ups + 5 new tests.
- **Helper component at `apps/web/src/components/minipay/add-cash-cta.tsx`** (new file).
- **Gating: `isMiniPay === true && isReady === true`**, otherwise renders `null`.
- **Reusing `.arena-result-secondary-action` style** for visual rhythm (avoid token sprawl).
- **Telemetry: `track("minipay_add_cash_click", { source })`** for funnel measurement.

¿Procedo con el patch tal cual, o querés ajustes?
- (a) Split en 3 commits vs 1 commit.
- (b) Hook return change para `useCoachCreditsPurchase` (expose `errorKind`) vs re-classify en UI.
- (c) Render-also-without-onRetry en VictoryClaimError, o mantenerlo solo en la secondary row.
- (d) Token CSS dedicado `.add-cash-cta` vs reuso de `.arena-result-secondary-action`.
- (e) Cualquier otra preferencia.
