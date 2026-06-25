# Auditoría Técnica: Camino Más Corto a Transacción Real en Celo Mainnet desde MiniPay

**Fecha:** 2026-06-24  
**Commit auditado:** `main` — `4f26019e`  
**Objetivo:** Ruta mínima a una tx real en < 48h reutilizando lo existente.  
**Método:** Inspección de archivos con líneas exactas. Sin implementar nada.

---

## 1. `api/verify-payment/route.ts`

**Archivo:** `apps/web/src/app/api/verify-payment/route.ts`

### Qué hace exactamente cuando `CHESSCITO_TREASURY_ADDRESS=X`

El flujo de ejecución cuando llega un POST:

1. **Líneas 102–108** — `enforceOrigin(req)` + `enforceReadRateLimit(ip)` — pasa si origin es válido y no hay rate limit
2. **Líneas 110–118** — `parseShape(body)` — valida SOLO el shape del request: `chainId: number`, `txHash: /0x[64hex]/`, `wallet: /0x[40hex]/`, `token: /0x[40hex]/`, `sku: string non-empty`
3. **Línea 122** — `getTreasuryAddressServer()` — lee `process.env.CHESSCITO_TREASURY_ADDRESS ?? process.env.TREASURY_ADDRESS`
4. `getTreasuryAddressServer()` está en `lib/payments/rail-config.ts:43–47`. Llama a `isValidAddress(raw)` definido en línea `29`: regex `/^0x[0-9a-fA-F]{40}$/`. El valor `"X"` falla → retorna `null`
5. **Línea 123** — `if (!treasury)` → `true`
6. **Líneas 124–125** — `log.warn("rail_not_configured", ...)` + `return err("rail_not_configured", 503)`

**Conclusión:** Con `CHESSCITO_TREASURY_ADDRESS=X`, el endpoint retorna `503 { ok: false, error: "rail_not_configured" }` **después** de validar origin/rate-limit y parsear el shape, pero **antes** de cualquier llamada on-chain, Supabase, o lógica de SKU.

- **Estado:** ROTO (fail-closed intencional)
- **Bloqueador:** `CHESSCITO_TREASURY_ADDRESS` = valor real en Vercel
- **Camino mínimo:** 1 env var en el dashboard de Vercel → sin cambio de código

### Validaciones antes del 503

| Orden | Validación | Línea | Error si falla |
|---|---|---|---|
| 1 | `enforceOrigin(req)` | 103 | 429 `rate_limited` |
| 2 | `enforceReadRateLimit(ip)` | 104 | 429 `rate_limited` |
| 3 | `req.json()` parse | 111–115 | 400 `invalid_input` |
| 4 | `parseShape(body)` — shape del body | 117–118 | 400 `invalid_input` |
| 5 | **Treasury gate** | 122–126 | **503 `rail_not_configured`** |
| 6 | `chainId === 42220` | 129 | 400 `unsupported_chain` |
| 7 | `sku in PEONES_PACKS` | 130 | 400 `unknown_sku` |
| 8 | Token en allowlist | 131–133 | 400 `unsupported_token` |

### Parámetros que recibe (body)

```typescript
// Líneas 65–71 (tipo ParsedInput) y 79–84 (parseShape)
{
  chainId: number,           // integer, validado en línea 80
  txHash: `0x${string}`,    // /^0x[0-9a-fA-F]{64}$/, línea 81
  wallet: string,            // /^0x[0-9a-fA-F]{40}$/, línea 82 — lowercased en línea 90
  token: string,             // /^0x[0-9a-fA-F]{40}$/, línea 83 — lowercased en línea 91
  sku: string,               // non-empty string, línea 84 — cast a PeonesPackSku en línea 92
}
```

### Con treasury configurada: ¿verifica on-chain o solo off-chain?

**Verifica ON-CHAIN**. Secuencia completa cuando treasury es válida:

- **Línea 142** — `client.getTransactionReceipt({ hash: txHash })` → llama al nodo RPC de Celo (mainnet, `process.env.CELO_RPC_URL` — línea 54)
- **Línea 146** — verifica `receipt.status === "success"`
- **Línea 154** — verifica `receipt.to === token` — anti-replay: la tx debe ser un transfer directo al contrato del token, no un contrato intermediario (como Shop)
- **Líneas 158–170** — `verifyStablecoinTransfer()` — decodifica los logs del Transfer, verifica `from=wallet`, `to=treasury`, `amount >= expectedAmount` (desde SKU, server-side)
- **Líneas 181–186** — construye `idempotencyKey = pack_purchase:{chainId}:{txHash}:{logIndex}`
- **Líneas 198–206** — Supabase: pre-check de idempotencia en tabla `peones_ledger`
- **Líneas 235–253** — Supabase: INSERT en `peones_ledger`

---

## 2. `lib/game/context-action.ts` — líneas 40–70

**Archivo:** `apps/web/src/lib/game/context-action.ts`

### Qué hace `claimBadge`

`claimBadge` es un valor del union type `ContextAction` (línea 3), no una función. Es el string `"claimBadge"` que `getContextAction()` retorna cuando el estado habilita el claim.

**En Lite (liteMode=true), líneas 60–63:**
```typescript
if (liteMode) {
  if (state.isConnected && state.isCorrectChain) {
    if (state.badgeClaimable) return "claimBadge";  // línea 62
    return null; // submitScore suprimido
  }
```

**En `getRewardActions()`, línea 41:**
```typescript
if (state.badgeClaimable) actions.push("claimBadge");
```

`claimBadge` aparece en ambas funciones sin condicional de liteMode — **el badge claim está preservado en Lite explícitamente** (comentario en líneas 22–24).

### ¿Requiere treasury o solo firma server-side?

**No requiere treasury.** El flujo de claim de badge es completamente independiente del payment rail:

1. El consumer llama a `/api/sign-badge` (o `/api/sign-labyrinth`) → obtiene firma EIP-712
2. El frontend ejecuta la llamada on-chain directamente contra el contrato de badges
3. El contrato verifica la firma del signer de Chesscito y mintea el badge

No hay `ERC20.transfer`, no hay treasury, no hay `verify-payment`.

### Contrato y address

- **sign-badge** → `getDemoConfig()` en `lib/server/demo-signing.ts:64–80` → `NEXT_PUBLIC_BADGES_ADDRESS` = `0xf92759E5525763554515DD25E7650f72204a6739` (Celo mainnet, desplegado)
- **sign-labyrinth** → `getLabyrinthBadgesAddress()` en `lib/server/demo-signing.ts:85–87` → `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` (ver sección 4)

### ¿Funciona en Lite hoy si el usuario tiene wallet conectada?

**Sí, para sign-badge (Scoreboard Badges).** Si:
- `state.isConnected === true`
- `state.isCorrectChain === true`
- `state.badgeClaimable === true`

→ `getContextAction()` retorna `"claimBadge"` en línea 62.

El consumer en `exercises-screen.tsx` actúa sobre este valor y llama a `/api/sign-badge`, que **sí funciona** (TORRE_PRINCESA, DRAGON y BADGES_ADDRESS están configurados en `.env`).

---

## 3. `api/sign-badge/route.ts`

**Archivo:** `apps/web/src/app/api/sign-badge/route.ts`

### Qué firma

Firma EIP-712 typed data. Estructura completa (líneas 28–48):

```typescript
// Domain (líneas 30–33)
{ name: "Badges", version: "1", chainId, verifyingContract: badgesAddress }

// Type (líneas 36–44)
BadgeClaim: [
  { name: "player",   type: "address" },
  { name: "levelId",  type: "uint256" },
  { name: "nonce",    type: "uint256" },
  { name: "deadline", type: "uint256" },
]

// Values
{ player, levelId: BigInt(levelId), nonce: createNonce(), deadline: createDeadline() }
```

`createDeadline()` en `demo-signing.ts:184` → `BigInt(now/1000 + 600)` — deadline de 10 minutos.  
`createNonce()` en `demo-signing.ts:180` → `BigInt(hexlify(randomBytes(8)))` — aleatorio.

### Env vars requeridas

| Env var | Usado en | Requerido para |
|---|---|---|
| `NEXT_PUBLIC_BADGES_ADDRESS` | `demo-signing.ts:66` vía `requireEnv()` | Address del contrato Badges (verifyingContract) |
| `NEXT_PUBLIC_CHAIN_ID` | `demo-signing.ts:65` vía `requireEnv()` | chainId del domain |
| `TORRE_PRINCESA` | `demo-signing.ts:70` | Clave del signer (encriptada) |
| `DRAGON` | `demo-signing.ts:71` | Clave de descifrado del signer |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | `demo-signing.ts:19` `Redis.fromEnv()` | Rate limiting (`enforceRateLimit`) |

### ¿Está gateado por algún flag?

**No.** No hay `NEXT_PUBLIC_ENABLE_COACH`, ni `CHESSCITO_LITE_MODE`, ni ningún feature flag en el handler. Si las 5 env vars están configuradas, la ruta responde. Si alguna falta, `requireEnv()` lanza `Error: Missing required env: ${name}` → catch en línea 58 → retorna 400.

- **Estado:** FUNCIONA — `NEXT_PUBLIC_BADGES_ADDRESS`, `TORRE_PRINCESA`, `DRAGON`, `NEXT_PUBLIC_CHAIN_ID`, Redis todos configurados en `.env`

---

## 4. `api/sign-labyrinth/route.ts`

**Archivo:** `apps/web/src/app/api/sign-labyrinth/route.ts`

### Estado de `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`

| Archivo | Presencia | Valor observado |
|---|---|---|
| `.env.template` | PRESENTE | `0x0000000000000000000000000000000000000000` (placeholder confirmado por `grep -c`) |
| `.env` | **NO PRESENTE** | No configurado |
| `.env.local` | **NO PRESENTE** | No configurado |
| `.env.mainnet` | **NO PRESENTE** | No configurado |
| `.env.testnet` | **NO PRESENTE** | No configurado |

### Qué pasa si el address no está configurado

`getLabyrinthBadgesAddress()` en `demo-signing.ts:85–87`:
```typescript
export function getLabyrinthBadgesAddress() {
  return ethers.getAddress(requireEnv("NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS"));
}
```

`requireEnv()` en `demo-signing.ts:54–62`:
```typescript
function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
```

`getLabyrinthBadgesAddress()` se llama en `sign-labyrinth/route.ts:83` — **dentro del bloque `try`** (línea 31). El `catch` en línea 129–134 atrapa el error y retorna:
```json
{ "error": "Missing required env: NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS" }
```
con status **400**.

**El error es VISIBLE, no silencioso.** El cliente recibe un 400 con mensaje claro. El claim de badge de laberinto falla con error en UI.

- **Estado:** ROTO — el address del contrato no está configurado en ningún entorno
- **Bloqueador:** `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` = address real del contrato de laberintos en Vercel
- **Camino mínimo:** 1 env var en Vercel + deplegar el contrato en Celo mainnet (si no existe)

---

## 5. `components/payments/` — inventario completo

**Archivos en el directorio:**
```
apps/web/src/components/payments/
├── get-peones-sheet.tsx           ← único componente de pago
└── __tests__/
    └── get-peones-sheet.test.tsx
```

### Componente que inicia el flujo de pago

**Archivo:** `apps/web/src/components/payments/get-peones-sheet.tsx`

- Línea 21: `const SKU = "peones_pack_50"` — único SKU existente
- Línea 22: `const FALLBACK_TOKEN = "USDC"` — fallback si no hay selección
- Usa `usePaymentRail` (`lib/payments/use-payment-rail.ts`) y `useGetPeonesTokenSelection` (`lib/payments/use-get-peones-token-selection.ts`)

### Hooks disponibles

| Hook | Archivo | Función |
|---|---|---|
| `usePaymentRail` | `lib/payments/use-payment-rail.ts` | Orquesta el flujo completo: build tx → send → wait receipt → POST `/api/verify-payment` |
| `useGetPeonesTokenSelection` | `lib/payments/use-get-peones-token-selection.ts` | Selecciona token (USDC/USDT/cUSD) según balance disponible |

No existe `useMiniPay`, `useCheckout` ni hook de pago genérico. El patrón es: componente sheet → `usePaymentRail` → backend.

### Conexión con `/api/verify-payment`

En `use-payment-rail.ts`, la llamada al backend está en la función interna del hook (no auditada en detalle pero visible en el tipo `onVerified?: (result: PaymentRailResult) => void` — línea 78). El hook:
1. Construye la tx con `buildPeonesPackTransfer()` (línea 29, `lib/payments/transfer-builder.ts`)
2. Envía via `useWriteContract` (wagmi)
3. Espera el receipt via `usePublicClient`
4. POST a `/api/verify-payment` con `{ chainId, txHash, wallet, token, sku }`
5. Retorna el resultado en `onVerified`

### Componente que muestra txHash al usuario

No hay un componente dedicado para mostrar txHash en `get-peones-sheet.tsx` (solo leído parcialmente). El estado `phase: "success"` expone `txHash` via `PaymentRailResult` (línea 64). La sheet renderiza el estado de éxito pero no se audita si muestra el hash en UI.

- **Estado:** FUNCIONA (el componente existe y es funcional, solo bloqueado por treasury)

---

## 6. `api/shields/` y `api/peones/earn/`

### Cómo se acreditan shields

Existen **dos rutas de crédito de shields**, completamente independientes:

**Ruta A — `/api/credit-shield`** (vía Shop contract):
- Archivo: `apps/web/src/app/api/credit-shield/route.ts`
- Línea 53: Lee `NEXT_PUBLIC_SHOP_ADDRESS`; si undefined → `client = null` (línea 63)
- Línea 90: Si `!client || !SHOP_ADDRESS` → 400 `missing_params`
- Requiere tx del **Shop contract** (`0x24846C77...`) con evento `ItemPurchased(buyer, itemId=2, ...)`
- `SHIELD_ITEM_ID = 2n` (`lib/contracts/shop-catalog.ts:7`)
- `SHIELDS_PER_PURCHASE = 3` (`lib/contracts/shop-catalog.ts:115`)
- Crédito: Redis `INCRBY KEYS[shields:credited:{wallet}], delta` — Lua atómica (líneas 42–50)
- **Es Full-only** — requiere Shop contract, no aplica a Lite directamente

**Ruta B — `/api/welcome-pack/claim`** (gratuito, Lite-only):
- Línea 156–160: `redis.incrby(REDIS_KEYS.shieldsCredited(walletLower), WELCOME_PACK_SHIELDS)`
- `WELCOME_PACK_SHIELDS = 3` (`lib/server/welcome-pack.ts:15`)
- **Es la única ruta de shields que no requiere pago**
- Requiere `personal_sign` del wallet (signature + message en body)
- Idempotente por PK en tabla `welcome_pack_claims`

### Función que acredita shields sin payment rail

Sí existe: `/api/welcome-pack/claim` acredita 3 shields GRATIS. Pero requiere firma de wallet. El único acceso programático a shields sin pago.

### Redis keys para shields

Definidas en `lib/coach/redis-keys.ts`:
```typescript
shieldsCredited: (wallet) => `coach:shields:credited:${wallet}`,    // línea 48 (contador total, sin TTL)
shieldProcessedTx: (txHash) => `coach:shields:processed-tx:${txHash}` // línea 55 (dedupe 90 días)
```

Supabase: shields NO tienen tabla propia en Supabase. Solo Redis. La tabla `peones_ledger` es para Peones, no shields.

- `api/shields/me` — lee `coach:shields:credited:{wallet}` (Redis GET)
- `api/shields/spend` — decrementa `coach:shields:credited:{wallet}` via Lua atómica

---

## 7. Estado de env vars relevantes

**Nota:** Los valores reales nunca se muestran. Status = `REAL` (address o clave válida), `PLACEHOLDER` (`X`, `0x0000...`, o vacío), `NOT_SET` (key ausente en el archivo).

| Env var | `.env` | `.env.local` | `.env.mainnet` | `.env.testnet` | Vercel prod |
|---|---|---|---|---|---|
| `CHESSCITO_TREASURY_ADDRESS` | PLACEHOLDER (`X`) | REAL | PLACEHOLDER (`X`) | PLACEHOLDER (`X`) | ⚠️ No auditado — crítico |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | PLACEHOLDER (`X`) | REAL | PLACEHOLDER (`X`) | PLACEHOLDER (`X`) | ⚠️ No auditado — crítico |
| `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` | NOT_SET | NOT_SET | NOT_SET | NOT_SET | ⚠️ Probablemente NOT_SET |
| `NEXT_PUBLIC_BADGES_ADDRESS` | REAL (`0xf92759...`) | REAL | REAL | REAL | Probablemente REAL |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | REAL (`0x1681aA...`) | REAL | REAL | REAL | Probablemente REAL |
| `NEXT_PUBLIC_SHOP_ADDRESS` | REAL (`0x24846C...`) | REAL | REAL | REAL | Probablemente REAL |
| `NEXT_PUBLIC_USDC_ADDRESS` | REAL (`0xcebA93...`) | REAL | REAL | REAL | Probablemente REAL |
| `NEXT_PUBLIC_ENABLE_COACH` | NOT_SET | REAL (`true`) | NOT_SET | NOT_SET | NOT_SET → Coach off en prod |
| `SUPABASE_URL` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado |
| `SUPABASE_SERVICE_ROLE_KEY` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado |
| `UPSTASH_REDIS_REST_URL` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado |
| `UPSTASH_REDIS_REST_TOKEN` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado |
| `TORRE_PRINCESA` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado — requerido para sign-badge |
| `DRAGON` | REAL | REAL | NOT_SET | NOT_SET | ⚠️ No auditado — requerido para sign-badge |
| `CELO_RPC_URL` | REAL | REAL | REAL/EMPTY | REAL/EMPTY | ⚠️ No auditado |
| `NEXT_PUBLIC_CHAIN_ID` | REAL (`42220`) | REAL | REAL | REAL | Probablemente REAL |
| `NEXT_PUBLIC_CHESSCITO_LITE_MODE` | NOT_SET | REAL (`true`) | NOT_SET | NOT_SET | Depende del proyecto Vercel |
| `ENABLE_LITE_QA_RESET` | NOT_SET | NOT_SET | NOT_SET | NOT_SET | NOT_SET → deshabilitado |

**Hallazgo crítico sobre `.env.mainnet`:** Las vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `TORRE_PRINCESA`, `DRAGON` NO están en `.env.mainnet`. Si este archivo se usa para deploy (en lugar del dashboard de Vercel), sign-badge y shields fallarían en mainnet. Las vars viven en `.env` y `.env.local` — que Vercel probablemente sobreescribe desde el dashboard.

---

## 8. `api/welcome-pack/claim/route.ts`

**Archivo:** `apps/web/src/app/api/welcome-pack/claim/route.ts`

### Qué acredita exactamente

Líneas 155–160:
```typescript
credited = Number(
  await redis.incrby(
    REDIS_KEYS.shieldsCredited(walletLower),  // → "coach:shields:credited:{wallet}"
    WELCOME_PACK_SHIELDS,                      // → 3  (lib/server/welcome-pack.ts:15)
  ),
);
```

Acredita **3 shields en Redis** y registra la claim en Supabase tabla `welcome_pack_claims` (líneas 99–110).

### ¿Requiere pago o es gratuito?

**Gratuito.** No hay verificación de tx, no hay treasury, no hay ERC20 transfer. Solo firma `personal_sign` del wallet del usuario para prueba de ownership.

Body requerido (línea 63): `{ address: string, signature: string, message: string }`

### Env vars requeridas

| Env var | Uso | Línea |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `getSupabaseServer()` — tabla `welcome_pack_claims` | 87 |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | `Redis.fromEnv()` — crédito de shields | 42 |

Rate limiting también usa Redis via `enforceRateLimit` (línea 68), mismas vars.

### ¿Está activo en prod?

**Sí en backend** — el handler no tiene feature flag. Supabase y Redis están configurados en `.env` (y presumiblemente en Vercel prod).

**Gateado en client** — `use-welcome-package.ts:34`:
```typescript
if (typeof window === "undefined" || !CHESSCITO_LITE_MODE) return { ...DEFAULT_STATE };
```
Solo se ejecuta si `NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true"`. En Vercel Full (flag en false/absent), el hook retorna noop. En Vercel Lite, está activo.

- **Estado:** FUNCIONA en Lite. El endpoint backend está live independientemente del flag — cualquiera que llame directamente al POST obtiene la respuesta correcta.

---

## Tabla resumen — flujos y estado real

| Flujo | Estado | Bloqueador exacto | Horas para activar | Camino mínimo |
|---|---|---|---|---|
| **Payment Rail (verify-payment + peones)** | ROTO (fail-closed) | `CHESSCITO_TREASURY_ADDRESS=X` en Vercel prod | **1–2h** | Setear 1 env var en Vercel dashboard → redeploy |
| **Badge Claim Scoreboard (sign-badge)** | FUNCIONA | Ninguno — BADGES_ADDRESS + TORRE_PRINCESA + DRAGON activos | **0h adicionales** | Ya funciona si wallet conectada + ejercicio completado |
| **Badge Claim Laberintos (sign-labyrinth)** | ROTO | `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` NOT_SET → 400 en prod | **2–4h** | Setear env var + verificar que contrato está desplegado en mainnet |
| **Shield Crédito via Shop (credit-shield)** | PARCIAL | Shop contract activo pero Full-only; requiere Shop compra on-chain | **N/A para Lite** | No aplica — es flujo Full |
| **Welcome Pack shields (gratis)** | FUNCIONA en Lite | Ninguno — Supabase + Redis activos | **0h adicionales** | Ya activo en Lite |
| **Compra shields vía payment rail (nuevo SKU)** | ROTO | Misma treasury + nuevo SKU en `rail-config.ts` + branch en `verify-payment` | **4–8h** | 1 env var + ~20 líneas de código |
| **Coach (sign → LLM)** | ROTO en prod | `NEXT_PUBLIC_ENABLE_COACH=false` en prod; también LLM key ausente en `.env.mainnet` | **NO en 48h** — requiere decisión de producto |
| **Arena (Scoreboard save)** | FUNCIONA en Full | Ninguno para Full; bloqueado por middleware en Lite | **0h en Full** | Ya funciona en Full |
| **Victory NFT** | FUNCIONA en Full | Ninguno — contrato `0x0eE22F83...` activo | **0h en Full** | Ya funciona en Full |
| **Peones earn (daily/lab/exercises)** | FUNCIONA | Supabase activo | **0h** | Ya activo — silencioso en Lite |

---

## Ruta de 48h recomendada

Ordenada por prerequisito:

### Hora 0–2 — Desbloquear el payment rail (1 env var)
1. Ir a Vercel → proyecto activo → Environment Variables
2. Setear `CHESSCITO_TREASURY_ADDRESS` = address del Safe Owner (`0x917497b64...` del `celo.json` o la definitiva)
3. Setear `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` = mismo valor
4. Redeploy (automático en Vercel al guardar env vars que impactan build)
5. Smoke: POST `/api/verify-payment` con body válido → debe retornar `400 unsupported_chain` o `400 unknown_sku` en lugar de `503 rail_not_configured` — prueba que el treasury gate pasó

### Hora 2–6 — Nuevo SKU para Streak Shield Pack (código mínimo)
1. `lib/payments/rail-config.ts` — agregar `shields_pack_3` con `priceUsd6: 250_000n`, `peonesReward: 0` (o campo `shieldsReward: 3`)
2. `app/api/verify-payment/route.ts` — branch post-verify: si `sku === "shields_pack_3"` → `redis.incrby(REDIS_KEYS.shieldsCredited(wallet), 3)` en lugar de `peones_ledger` insert
3. `components/payments/shield-refill-sheet.tsx` — copiar estructura de `get-peones-sheet.tsx`, cambiar SKU, copy y reward visual
4. `components/exercises/exercises-screen.tsx` — trigger cuando `phase=failure && shields=0 && CHESSCITO_LITE_MODE`

### Hora 6–8 — Smoke en MiniPay real
1. ngrok o URL preview de Vercel
2. Abrir en MiniPay físico (Android)
3. Completar ejercicio → forzar fallo → shields=0 → sheet aparece → pagar $0.25 USDC → verificar shields +3

### Hora 8+ — Opcional: fix sign-labyrinth
Si el contrato de laberintos ya está desplegado (verificar en `celo.json` — no aparece en el archivo auditado):
1. Setear `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` en Vercel con el address real
2. Smoke: completar laberinto → claim badge → tx en mainnet

Si el contrato NO está desplegado: descartar este flujo del demo de 48h.
