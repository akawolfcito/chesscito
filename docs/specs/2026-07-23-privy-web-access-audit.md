# Privy como capa de acceso web — Auditoría Fase 1 (sin implementar)

> **Fecha:** 2026-07-23 · **Estado:** Auditoría / diseño. **No implementa nada, no toca prod.**
> **Objetivo:** MiniPay intacto; web (no-MiniPay) usa Privy para login social/email + wallet
> embebida; guest opcional; sin linking automático de cuentas; sin tocar pagos/economía.

---

## 1. Diagnóstico de arquitectura actual

### 1.1 Detección de entorno
- **`isMiniPayEnv()`** — `lib/minipay.ts:28` → `Boolean(window.ethereum?.isMiniPay ?? window.provider?.isMiniPay)`.
  Hay una variante equivalente en `lib/minipay/provider.ts:15` (`getMiniPayProvider`).
- **`getInjectedProvider()`** — `lib/minipay.ts:18`. Ambas son client-only (guard `typeof window`).
- **Un solo punto de decisión** ya existe y es booleano. La bifurcación MiniPay vs web es trivial de insertar.

### 1.2 Providers (árbol actual)
`components/wallet-provider.tsx`:
```
WagmiProvider(wagmiConfig)
  └ QueryClientProvider
     └ WalletProviderInner   ← auto-connect injected() SOLO si isMiniPayEnv()
        └ EffectiveTrainingPassProvider
           └ ThemeVariantProvider → children
```
- `wagmiConfig = createConfig({ chains:[celo, celoSepolia], connectors:[injected()], ssr:true })`.
- **Único connector: `injected()`**. RainbowKit ya fue removido (P2, 2026-06-12).
- Auto-connect se dispara **solo en MiniPay**; en web/desktop el connect es manual vía
  `useConnectWallet()` (`lib/wallet/use-connect-wallet.ts`, busca connector `id==="injected"`).

### 1.3 wagmi / viem
- `celo` y `celoSepolia` vienen de `wagmi/chains` (= viem chains). Celo es de **primera clase** en viem.
- Transports `http()` por chain. `getConfiguredChainId()` valida contra `{42220, 44787, 11142220}`.

### 1.4 Manejo de account / address
- **Identidad = `useAccount().address`** en todas partes. Ejemplos: `usePaymentRail` (address para
  transfer + verify), `use-is-pro-active` (cache localStorage keyed por wallet), `use-founder-status`,
  `peones-balance-chip` (balanceOf on-chain), `use-pro-status` (`proStatusQueryKey(wallet)`).
- **Asunción de wallet única en todo el código.** No hay multi-account ni switching de identidad.

### 1.5 Modelo de confianza del backend (hallazgo central)
- **No hay sesión firmada tipo SIWE como auth global.** El backend **ancla entitlements a
  transacciones on-chain reales, keyed por dirección EVM**:
  - `/api/verify-pro` — recibe `{txHash, walletAddress}`, verifica el evento `ItemPurchased`
    on-chain, escribe expiry en Redis keyed por `wallet`. Idempotente por txHash.
  - `/api/verify-payment` — recibe `{txHash, wallet, token, sku}`, verifica el `transfer` al treasury.
  - `/api/welcome-pack/claim` — recibe `{address, signature}`, idempotente por `wallet_address` (Supabase).
- **Implicación clave para Privy:** cualquier dirección EVM que pueda **firmar/enviar un ERC20.transfer
  en Celo mainnet** es una identidad válida de primera clase. Una embedded wallet de Privy sobre Celo
  cumple exactamente eso → entra al rail de pago **sin reescribir la lógica de features**.

### 1.6 Progreso / score / identidad de display
- **localStorage, device-scoped.** `use-exercise-progress.ts` ya distingue **guest session**
  (`lib/exercises/guest-session`) vs wallet conectada, con regla *"connected wallet always wins"* y
  migración guest→wallet ya contemplada. → **El patrón de precedencia que necesitamos ya existe.**
- **Nick de display = generado, NUNCA sale del localStorage** (invariante de proyecto). Toda superficie
  de identidad muestra el nick generado, no un handle de la wallet.

---

## 2. Matriz de compatibilidad por feature

| Feature | ¿Depende de address? | ¿Funciona con embedded Privy? | ¿Depende de MiniPay? | ¿Backend extra? |
|---|---|---|---|---|
| **Peones** (balance) | Sí — `balanceOf(address)` on-chain | ✅ Sí, misma address | No (feeCurrency opcional) | No |
| **Season Pass** (LEARN) | Sí (entitlement por wallet) | ✅ Sí | No | No |
| **PRO** | Sí — cache + `/api/pro/status` + `/api/verify-pro` por wallet | ✅ Sí | No | No |
| **Coach Review** | Sí (gate por PRO/wallet) | ✅ Sí | No | No |
| **Welcome Pack** | Sí — `{address, signature}` idempotente | ✅ Sí (Privy firma) | No | No |
| **Progress saves** | No (localStorage/guest) | ✅ Sí (device) | No | No |
| **Score saves** | No (localStorage) | ✅ Sí | No | No |
| **Victories** | Address si hay NFT/on-chain | ✅ Sí | No | Posible |
| **Shields** | Local (write-then-notify) | ✅ Sí | No | No |
| **Onboarding** | No | ✅ Sí | No | No |
| **Account / Profile** | Nick local + address | ✅ Sí (mostrar login state) | No | No |
| **Payments** (rail) | Sí — `ERC20.transfer` + verify | ✅ Sí (feeCurrency ya opcional) | No | No |

**Conclusión:** ninguna feature depende *específicamente* de MiniPay. MiniPay solo es *un* proveedor
de la address. `feeCurrency` ya es opcional en `usePaymentRail` (MetaMask-on-Celo ya funciona), así que
una embedded wallet de Privy es un tercer proveedor de address sin cambios de lógica.

---

## 3. Precedencia de identidad (regla propuesta)

```
1. isMiniPayEnv() === true      → MiniPay injected wallet   (flujo actual, INTACTO)
2. !MiniPay && usuario logueado → Privy embedded wallet     (address de Privy)
3. !MiniPay && sin login        → Guest mode                (localStorage/guest-session, sin address)
```

**Regla dura: la precedencia se resuelve UNA vez, arriba del árbol, y no cambia en runtime salvo
que el usuario haga login/logout explícito.** Un solo "identity provider" efectivo por sesión.

### Cómo evitar cada patología
- **Conflicto entre wallets** — En web NUNCA montar el connector `injected()`. Privy es el único
  proveedor de address fuera de MiniPay. MiniPay nunca ve a Privy (bifurcación por `isMiniPayEnv()`
  antes de elegir el WagmiProvider/config).
- **Leer beneficios en una wallet y comprar en otra** — La `address` de lectura (balance/PRO/pass) y
  la `address` de firma (transfer) provienen **del mismo `useAccount()`**. Con un único connector activo
  por rama, no puede haber mismatch. Regla: *la wallet que lee es la wallet que paga; nunca dos activas*.
- **Errores de hydration** — Toda detección es client-only. Render inicial = estado "unknown"
  (ya existe en `use-pro-status`). No decidir identidad en SSR; hidratar y recién ahí resolver
  precedencia (respeta `feedback_never_decide_from_unhydrated_state`).
- **Duplicación de identidad** — **Sin linking automático.** Guest→Privy y MiniPay↔Privy NO se
  fusionan solos. El progreso guest ya migra a "la sesión activa" por diseño; cross-device/cross-wallet
  merge queda **fuera del MVP** (decisión explícita del usuario).

---

## 4. Evaluación de Privy para este caso

| Requisito | Soporte | Nota |
|---|---|---|
| Celo / EVM custom | ✅ | `celo` es viem chain de primera clase (ya se importa). Se pasa a `supportedChains`/`defaultChain`. |
| wagmi/viem | ✅ | `@privy-io/wagmi` `createConfig` es **drop-in** de wagmi. Privy patrocina wagmi. Hooks actuales no cambian. |
| Embedded wallets | ✅ | Auto-creación al login. |
| Social login (Google) | ✅ | |
| Email login | ✅ | |
| Recovery | ✅ | Recovery flows integrados. |
| Account linking (futuro) | ✅ | Soportado; lo dejamos **fuera del MVP**. |
| Export wallet | ✅ | El usuario puede exportar su key. |
| Server-side verification | ✅ | `@privy-io/server-auth` `verifyAuthToken` (access tokens). |
| Session handling | ✅ | Tokens access (corto) + identity. |

**Riesgo técnico único real:** confirmar que **Privy permite `celo` (42220) en `supportedChains`** con
el plan/app-id concreto. La doc y viem lo soportan; validar en dashboard antes del slice. Todo lo demás
encaja con la arquitectura actual sin fricción.

---

## 5. MVP UX propuesto

**Landing** (ref. del founder, no restrictiva): dos rutas —
- **`Launch in MiniPay`** → deep-link a MiniPay → flujo actual, cero cambios.
- **`Open Web App`** → app web con Privy montado.

**Dentro del web app (no-MiniPay):**
- `Continue with Google`
- `Continue with Email`
- `Continue as Guest`

### ¿Cuándo pedir login? (fricción mínima → conversión)
| Momento | ¿Pedir login? | Razón |
|---|---|---|
| Al entrar | ❌ No | Guest juega YA; el valor primero. |
| Tras primer ejercicio | ⚠️ Soft-prompt | "Guardá tu progreso" (no bloqueante). |
| Al guardar progreso | ❌ No | Guest ya persiste local; login solo para portabilidad. |
| **Antes de comprar** | ✅ **Sí (hard gate)** | Compra necesita address firmante. Punto natural. |
| En Account | ✅ Sí (CTA visible) | Login/logout, export wallet, estado PRO/Pass. |

> Principio: **guest juega y progresa sin login; el login se pide en el borde del valor on-chain**
> (comprar, portar, reclamar). Esto respeta la asunción de wallet única: el guest no tiene address,
> y recién al comprar aparece una (Privy).

---

## 6. Riesgos y red-team

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | **Account fragmentation** MiniPay vs Privy (mismo humano, dos wallets, PRO en una) | Alta | Sin linking en MVP; comunicar "una wallet = un progreso on-chain". Linking = fase futura. |
| R2 | **Session spoofing** — cliente afirma address ajena a `/api/verify-*` | Media | Ya mitigado: el server verifica **tx on-chain**, no confía en la address sola. Reforzable con `verifyAuthToken` en rutas sensibles. |
| R3 | **Wallet mismatch** (lee en A, firma en B) | Alta si mal hecho | Un solo connector activo por rama; misma `useAccount()` para leer y firmar. |
| R4 | **Provider conflicts** (injected + Privy montados juntos) | Alta | En web NO montar `injected()`. Bifurcación dura por `isMiniPayEnv()` en el provider root. |
| R5 | **Pérdida de acceso** (usuario pierde email/social) | Media | Privy recovery + export wallet; CTA de export en Account. |
| R6 | **Dependencia del proveedor** (Privy caído / lock-in) | Media | Export wallet = self-custody real; MiniPay no depende de Privy; guest funciona sin Privy. |
| R7 | **Abuso de guest mode** (farming welcome/peones sin login) | Media | Welcome pack ya es idempotente por wallet; guest **no tiene address → no reclama on-chain**. El abuso on-chain ya está cerrado; el guest solo progresa local. |
| R8 | Privy no habilita Celo en el plan | Bloqueante | **Validar en dashboard antes del slice** (única blocker real). |

---

## 7. Propuesta de implementación por fases

- **Fase 0 — Validación (0 código):** confirmar Celo 42220 en Privy dashboard + app-id. **Gate go/no-go.**
- **Fase 1 — Provider split (aislado, feature-flag):** un `WebWalletProvider` (Privy + `@privy-io/wagmi`)
  paralelo al `WalletProvider` MiniPay. Root elige por `isMiniPayEnv()`. MiniPay branch **byte-idéntico**.
  Detrás de flag `NEXT_PUBLIC_PRIVY_ENABLED`, off en prod.
- **Fase 2 — Landing + entry:** `Open Web App` / `Launch in MiniPay`. Guest juega sin login.
- **Fase 3 — Login gates:** soft-prompt post-ejercicio; hard gate en compra; Account (login/export/logout).
- **Fase 4 — Server hardening:** `verifyAuthToken` en rutas de compra/claim (defensa en profundidad).
- **Fase 5 (futura, fuera de MVP):** account linking MiniPay↔Privy, cross-device merge.

### Slice mínimo de implementación (primer PR tras go)
1. `WebWalletProvider` con `PrivyProvider` (Google/email, embedded wallets, `supportedChains:[celo]`)
   + `@privy-io/wagmi` `createConfig` (mismos chains/transports que hoy).
2. Bifurcación en el root: `isMiniPayEnv() ? <WalletProvider> : <WebWalletProvider>` (flag-gated).
3. **Cero cambios** en features: consumen `useAccount()`/wagmi hooks igual.
4. Botón `Open Web App` en landing → monta la rama web.
5. Tests: (a) MiniPay branch sin regresión; (b) web branch expone address de Privy a `usePaymentRail`;
   (c) guest sin login progresa local.

---

## 8. Go / No-Go

**GO condicional.** El encaje arquitectónico es **excelente**: identidad = address EVM, backend ancla a
tx on-chain (no a sesión), `feeCurrency` ya opcional, guest+migración ya existen, wagmi es la interfaz
única y Privy es drop-in de wagmi con Celo de primera clase. El riesgo se concentra en **un** punto
verificable (Fase 0: Celo habilitado en Privy). Con eso confirmado → **GO** al slice mínimo detrás de flag.

**No-Go si:** Privy no habilita Celo 42220 en el plan, o si se exige linking automático de cuentas en el
MVP (explícitamente descartado).

---

### Restricciones respetadas
✅ No implementa · ✅ No toca prod · ✅ Sin linking automático · ✅ Sin cambiar pagos/economía ·
✅ MiniPay intacto · ✅ MVP simple detrás de feature-flag.
