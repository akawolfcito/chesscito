# Commit 6B — UI Shape Proposal

Anexo de `2026-04-29-pro-phase-0.md`. Reviewed before coding.

## 1. `<ProChip>` — floating chip

**Archivo**: `apps/web/src/components/pro/pro-chip.tsx`

```ts
type ProChipProps = {
  status: { active: boolean; expiresAt: number | null } | null;
  isLoading: boolean;
  onClick: () => void;
};
```

**Estados visuales** (mobile 390px lock):

| Estado | Render |
|--------|--------|
| `isLoading` (status === null) | Skeleton: chip vacío con shimmer 28px alto, mismo footprint |
| `status.active === false` | "GET PRO" + sparkle icon, gold→amber gradient bg |
| `status.active === true` | "PRO • <N>d" — donde N = `Math.ceil((expiresAt - now) / 86400000)`. Si N === 1: "Expires today". Bg purple→violet gradient |

**Posición exacta** en play-hub-root:
```tsx
// Inside <main className="mission-shell ..."> wrapper, BEFORE <MissionPanelCandy />:
<button
  type="button"
  onClick={() => setProSheetOpen(true)}
  aria-label="Chesscito PRO"
  className="
    pointer-events-auto
    absolute right-2 z-30
    top-[calc(env(safe-area-inset-top)+0.5rem)]
    h-7 min-w-[64px] max-w-[120px]
    rounded-full px-2.5 ...
  "
>...</button>
```
- `absolute` dentro del `mission-shell` (que es `position: relative` por defecto en CSS de candy panel).
- `z-30` mayor que MissionPanelCandy HUD (`z-20`) pero menor que sheets (`z-50`).
- 28px alto, 64–120px ancho — no compite con touch targets dock (mín 44px) y queda en zona segura del HUD.

**Tap conflict avoidance**:
- Sin overlay sobre dock (que está fixed bottom).
- Sin overlay sobre `actionRowLeft`/`actionRowRight` (que ocupan top-mid del panel).
- HUD del MissionPanelCandy tiene piece-selector + Lv-badge en el centro-arriba; el chip va al **right** corner.
- Confirmar visualmente que no choca con piece-rail; si lo hiciera, mover a `top-right` del `<main>` directamente (fuera del HUD).

**Accesibilidad**:
- `role="button"`, `aria-label="Chesscito PRO"`.
- Keyboard focus visible.
- Si `isLoading`: `aria-busy="true"` y desactivado (`disabled`).

## 2. `<ProSheet>` — bottom sheet

**Archivo**: `apps/web/src/components/pro/pro-sheet.tsx`

```ts
type ProSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: { active: boolean; expiresAt: number | null } | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isPurchasing: boolean;
  isVerifying: boolean;
  errorMessage: string | null;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onBuy: () => void;
};
```

**Copy desde `PRO_COPY` (editorial.ts)**:
- Header: `PRO_COPY.label` + `PRO_COPY.tagline` + `PRO_COPY.priceLabel` + `PRO_COPY.durationLabel`
- Active perks list: `PRO_COPY.perksActive` (renderizada como check-list verde)
- Roadmap list: `PRO_COPY.perksRoadmap` (renderizada como disabled list gris con prefijo "Coming later:")
- Status active: `PRO_COPY.statusActiveSuffix(daysLeft)` debajo del header
- Receipt (toast/inline confirmation tras éxito): `PRO_COPY.receipt.success` o `PRO_COPY.receipt.extended(daysLeft)`
- Errors: `PRO_COPY.errors.notConfigured | purchaseFailed | walletRequired`

**CTA states (single button, swap label/handler)**:

| Condición | Label | Handler | Variant |
|-----------|-------|---------|---------|
| `!isConnected` | `PRO_COPY.errors.walletRequired` | `onConnectWallet` | secondary |
| `isConnected && !isCorrectChain` | `"Switch Network"` (reusable de FOOTER_CTA_COPY si existe; si no, hardcoded) | `onSwitchNetwork` | secondary |
| `isPurchasing` | `"Approving / Buying..."` (spinner) | no-op | disabled primary |
| `isVerifying` | `"Verifying..."` (spinner) | no-op | disabled primary |
| `status.active === true` | `PRO_COPY.ctaRenew` | `onBuy` | secondary (sutil; PRO ya activo) |
| `status.active === false` | `PRO_COPY.ctaBuy` | `onBuy` | primary (gold/amber gradient) |
| `errorMessage !== null` | inline error en rose-* + el botón vuelve a CTA normal | (mostrar error encima, reintenta con onBuy) | — |

**Telemetría hooks**: solo TODOs en JSX:
```tsx
// TODO(commit-8): on first open → track("pro_card_viewed", { active: status.active })
// TODO(commit-8): onClick CTA → track("pro_cta_clicked", { state: "buy"|"renew" })
```

## 3. `useProStatus` — fetch hook

**Archivo**: `apps/web/src/lib/pro/use-pro-status.ts`

```ts
type ProStatus = { active: boolean; expiresAt: number | null };

type UseProStatusReturn = {
  status: ProStatus | null;
  isLoading: boolean;
  refetch: () => void;
};

export function useProStatus(wallet?: string): UseProStatusReturn;
```

**Comportamiento**:
- Sin wallet (`wallet === undefined`): retorna `{ status: null, isLoading: false, refetch: noop }`. No fetch.
- Con wallet: fetch en mount + cuando wallet cambia (useEffect dep `[wallet]`).
- `refetch()`: re-dispara el efecto manualmente (incrementar `version` state).
- `AbortController` por fetch — al cambiar wallet o desmontar, abortar el anterior.
- Error de fetch (network, 5xx): trata como `{ active: false, expiresAt: null }` — no rompe UI. Solo UI se ve "inactive".
- 403/400: idem.
- Polling: **NO** automático. Solo fetch manual via `refetch()` después de purchase verify.

**Implementación esquemática**:
```ts
const [status, setStatus] = useState<ProStatus | null>(null);
const [version, setVersion] = useState(0);
const [isLoading, setIsLoading] = useState(false);
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  if (!wallet) { setStatus(null); setIsLoading(false); return; }
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setIsLoading(true);
  fetch(`/api/pro/status?wallet=${wallet}`, { signal: controller.signal })
    .then(r => r.ok ? r.json() : { active: false, expiresAt: null })
    .then(data => { setStatus(data); setIsLoading(false); })
    .catch(() => { /* aborted or network */ });
  return () => controller.abort();
}, [wallet, version]);

const refetch = useCallback(() => setVersion(v => v + 1), []);
return { status, isLoading, refetch };
```

## 4. Compra PRO — handler en play-hub-root

**Reutiliza** (vía wagmi hooks que **ya están** importados):
- `useAccount` (address, isConnected)
- `useChainId`, `useSwitchChain`
- `usePublicClient`
- `useWriteContract` — el writeAsync existente del shop (`writeShopAsync`) o uno nuevo. Reutilizable.
- `waitForReceiptWithTimeout` — helper compartido
- `selectPaymentToken` — ya existe en play-hub-root:438
- `normalizePrice`, `erc20Abi`, `shopAbi`, `shopAddress`, `chainId` — todos en scope

**Token Fase 0**: USDC (primer en `ACCEPTED_TOKENS`). El selector `selectPaymentToken(PRO_PRICE_USD6)` cae al USDC si tiene balance suficiente; si no, otro stablecoin. **No CELO** (verify-pro lo rechaza).

**Patrón duplicado** (espejo de arena/page.tsx:340-389, no refactor):
```ts
async function handleProPurchase() {
  if (!address || !shopAddress || !publicClient) return;
  if (!isCorrectChain) return; // sheet ya muestra Switch Network
  const token = selectPaymentToken(PRO_PRICE_USD6);
  if (!token) { setProError(PRO_COPY.errors.purchaseFailed); return; }

  const normalizedTotal = normalizePrice(PRO_PRICE_USD6, token.decimals);
  setProError(null);
  setProUiState("purchasing");
  // TODO(commit-8): track("pro_purchase_started", { walletHash, priceUsd6 })

  try {
    // 1. Allowance + approve
    const allowance = await publicClient.readContract({
      address: token.address, abi: erc20Abi,
      functionName: "allowance", args: [address, shopAddress],
    }) as bigint;
    if (allowance < normalizedTotal) {
      const approveHash = await writeShopAsync({
        address: token.address, abi: erc20Abi, functionName: "approve",
        args: [shopAddress, normalizedTotal], chainId, account: address,
      });
      await waitForReceiptWithTimeout(publicClient, approveHash);
    }

    // 2. buyItem(PRO_ITEM_ID, 1, token)
    const buyHash = await writeShopAsync({
      address: shopAddress, abi: shopAbi, functionName: "buyItem",
      args: [PRO_ITEM_ID, 1n, token.address], chainId, account: address,
    });
    await waitForReceiptWithTimeout(publicClient, buyHash);

    // 3. verify
    setProUiState("verifying");
    const verifyRes = await fetch("/api/verify-pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.active) throw new Error("verify-pro returned inactive");

    // TODO(commit-8): track("pro_purchase_confirmed", { walletHash, txHash: buyHash })
    refetchProStatus();
    hapticSuccess();
    setProUiState("idle");
    setProSheetOpen(false);
  } catch (error) {
    if (isUserCancellation(error)) {
      setProUiState("idle");
      // TODO(commit-8): track("pro_purchase_failed", { kind: "cancelled" })
      return;
    }
    if (isTransactionTimeout(error)) {
      setProError("Transaction timed out. Please try again.");
      setProUiState("idle");
      // TODO(commit-8): track("pro_purchase_failed", { kind: "timeout" })
      return;
    }
    setProError(PRO_COPY.errors.purchaseFailed);
    setProUiState("idle");
    // TODO(commit-8): track("pro_purchase_failed", { kind: "unknown" })
  }
}
```

**Manejo de errores**:
- Cancelación (user rechaza wallet): silencioso, vuelve a idle.
- Timeout: error message + reintento manual via CTA.
- Approve fallido: misma rama de error genérico.
- Verify-pro fallido (200 active=false, o 4xx, o 5xx): error message + el usuario puede reintentar verify (no recompra) — **opcional para v1**, OK fallar al genérico y que reintente con un nuevo buyItem si quiere.

## 5. Diff exacto en `play-hub-root.tsx`

**Imports nuevos**:
```ts
import { ProChip } from "@/components/pro/pro-chip";
import { ProSheet } from "@/components/pro/pro-sheet";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { PRO_COPY } from "@/lib/content/editorial";
import { PRO_ITEM_ID, PRO_PRICE_USD6 } from "@/lib/contracts/shop-catalog";
```

**State nuevo** (top de `PlayHubRoot()`):
```ts
const { status: proStatus, isLoading: isProLoading, refetch: refetchProStatus } = useProStatus(address);
const [proSheetOpen, setProSheetOpen] = useState(false);
const [proUiState, setProUiState] = useState<"idle" | "purchasing" | "verifying">("idle");
const [proError, setProError] = useState<string | null>(null);
```

**Handler nuevo**: `handleProPurchase` (definido arriba) — pegado cerca de `handleConfirmPurchase` (~L820) para mantener vecindad temática.

**Mount points** (en el JSX final):
```tsx
<main className="mission-shell mx-auto h-[100dvh] w-full max-w-[var(--app-max-width)] px-0 py-0 sm:px-0 relative">
  {/* NEW — floating chip */}
  <ProChip
    status={proStatus}
    isLoading={isProLoading}
    onClick={() => setProSheetOpen(true)}
  />
  <MissionPanelCandy ... />
  {/* ... existing PurchaseConfirmSheet etc. ... */}

  {/* NEW — bottom sheet */}
  <ProSheet
    open={proSheetOpen}
    onOpenChange={(open) => {
      // Bloquear cierre durante tx in-flight
      if (!open && proUiState !== "idle") return;
      setProSheetOpen(open);
      if (!open) setProError(null);
    }}
    status={proStatus}
    isConnected={isConnected}
    isCorrectChain={isCorrectChain}
    isPurchasing={proUiState === "purchasing"}
    isVerifying={proUiState === "verifying"}
    errorMessage={proError}
    onConnectWallet={() => openConnectModal?.()}
    onSwitchNetwork={() => configuredChainId != null && switchChain({ chainId: configuredChainId })}
    onBuy={() => void handleProPurchase()}
  />
</main>
```

**Que NO se toca**:
- ❌ `<MissionPanelCandy>` (sin nuevos slots)
- ❌ `<PersistentDock>` (sin nuevo item)
- ❌ `<ShopSheet>` / `<PurchaseConfirmSheet>` / `<BadgeSheet>` (PRO va aparte)
- ❌ Hooks de coach (analyze/credits) — UI consumer no se entera
- ❌ Lógica existente de approve/buy del Founder Badge / Shield

**Riesgo de mount en `<main>`**: el wrapper actual tiene `position` implícito; agregamos `relative` para anclar `absolute` del chip. Cambio de 1 palabra. Verificar que ningún descendant absolute existente dependía de un ancestor distinto — quick visual check en dev.

## 6. Tests RTL mínimos

**Archivo 1**: `components/pro/__tests__/pro-chip.test.tsx`
1. `renders "GET PRO" when status.active === false` — verifica texto.
2. `renders days-left when active` — `expiresAt = now + 7d` → texto contiene "7d".
3. `renders skeleton when isLoading` — `aria-busy="true"`.
4. `calls onClick when tapped`.

**Archivo 2**: `components/pro/__tests__/pro-sheet.test.tsx`
1. `shows Connect Wallet CTA when !isConnected` — texto = `PRO_COPY.errors.walletRequired`.
2. `shows Get PRO CTA when connected and inactive` — texto = `PRO_COPY.ctaBuy`. Click llama `onBuy`.
3. `shows Renew when active` — texto = `PRO_COPY.ctaRenew`.
4. `disables CTA when isPurchasing` — botón disabled.
5. `renders error message when errorMessage prop set`.
6. `renders perksActive list AND perksRoadmap list with disabled style`.

**Archivo 3**: `lib/pro/__tests__/use-pro-status.test.tsx` (RTL `renderHook`)
1. `returns null status when wallet is undefined` — sin fetch.
2. `fetches and returns status on mount` — mock fetch resolves `{ active: true, expiresAt: 123 }`.
3. `refetches when refetch() is called`.
4. `aborts pending request on unmount`.

**Total nuevo**: ~14 tests RTL.

**No visual snapshots** — el repo no los exige (los hooks de Playwright son falsos positivos en commits previos).

## 7. ¿Un solo commit o partir 6B?

**Mi recomendación: partir 6B en dos commits**.

| Commit | Scope | Riesgo |
|--------|-------|--------|
| **6B.1** — `feat(pro): add ProChip + ProSheet + useProStatus` | Componentes + hook standalone, **sin** wire en play-hub. Tests RTL. | Bajo — código aislado, no cambia comportamiento del play-hub. |
| **6B.2** — `feat(play-hub): wire PRO chip + sheet + purchase flow` | Imports + state + handler + mount points en play-hub-root. | Medio — toca archivo crítico, cambia layout del `<main>`. |

Beneficios del split:
- 6B.1 mergeable y reviewable en isolation.
- 6B.2 puede revertirse sin perder los componentes (pueden quedar idle).
- Si 6B.2 introduce regresión visual mobile, 6B.1 sobrevive.

Alternativa: un solo commit si querés que la feature aterrice como unidad. En ese caso ~310 líneas nuevas + ~30 modificadas en play-hub-root.

## Decisiones pendientes para el user
1. **6B en 1 commit o split en 6B.1 + 6B.2?** → propongo split.
2. **Token Fase 0**: confirmamos USDC primero en `selectPaymentToken`? → propongo sí (mismo orden que ACCEPTED_TOKENS).
3. **Polling automático del status**: hacer fetch periódico cada N min? → propongo NO. Solo fetch en mount + refetch tras compra. Usuario abre la app, ve estado correcto. Si compró desde otro device y vuelve, refresh manual.
4. **Posición del chip**: top-right absolute en `<main>`. ¿Confirmás o preferís banner top-collapsable?
