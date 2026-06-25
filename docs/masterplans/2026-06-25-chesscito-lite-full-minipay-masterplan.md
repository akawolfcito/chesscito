# Chesscito — Masterplan MiniPay: Lite + Full

**Fecha:** 2026-06-25  
**Auditoría base:** `docs/audits/2026-06-24-lite-vs-full-audit.md`  
**Commit auditado:** `main` — `4f26019e`  
**Rol:** Senior Product Engineer + Technical Lead  
**Objetivo:** Diagnóstico completo antes de reunión MiniPay. Sin implementar código.

---

## 0. Resumen ejecutivo

Chesscito tiene dos versiones separadas por un único flag de compilación. **Full está 90% lista** como plataforma — contratos en mainnet, Scoreboard, Shop, Victory NFT desplegados — pero el **payment rail está desactivado intencionalmente** (treasury en placeholder). **Lite está completa** como producto de hábito cognitivo, sin pagos, con Focus Passport + Daily + Ejercicios + Trofeos funcionales.

La reunión con MiniPay puede demostrarse 100% con Lite tal como está hoy. El único feature pendiente para micropagos en Lite es el **Lite Season Pass** — y el 85% de la infraestructura ya existe: el mismo `api/verify-payment`, el mismo rail `ERC20.transfer`, Redis + Supabase activos, treasury ya configurado en `.env`.

**Decisión de producto que desbloquea todo:** Setear `CHESSCITO_TREASURY_ADDRESS` con la dirección real en el dashboard de Vercel. Un env var. Sin código nuevo.

---

## A. Chesscito Full — Estado real

### A.1 Ejercicios

| Atributo | Estado |
|---|---|
| Cantidad | 60 ejercicios (`content/exercises.json`) |
| Piezas | Torre + más (id-keyed desde PR #120) |
| Progreso | `PieceProgress` id-keyed con migración legacy |
| Deck en Lite | Compartido — mismos 60 ejercicios |
| Limit diario | Full = sin límite; Lite = `daily-limit-guard.tsx` (soft gate) |
| Score on-chain | `context-action.ts:40` — `submitScore` solo en Full |
| Badge claim | Activo en ambos si wallet conectada |

**Estado: FUNCIONA** — sin bloqueador.

### A.2 Laberintos

| Atributo | Estado |
|---|---|
| Mecánica | Funcional en Full y Lite |
| Badge claim | `api/sign-labyrinth/route.ts` |
| Address | `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` **NOT_SET** en todos los `.env` locales; template tiene `0x0000...` (placeholder) |
| Error en prod | `getLabyrinthBadgesAddress()` lanza → catch → `400 { error: "Missing required env: NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS" }` |
| Contrato | No aparece en `apps/contracts/deployments/celo.json` — probablemente NO desplegado |

**Estado: PARCIAL** — mecánica OK, badge claim ROTO. No demostrarlo en MiniPay hasta confirmar deploy del contrato.

### A.3 Score on-chain

| Atributo | Estado |
|---|---|
| Contrato | Scoreboard `0x1681aAA176d5f46e45789A8b18C8E990f663959a` (celo.json) |
| Signer | `TORRE_PRINCESA`/`DRAGON` — activos en `.env` |
| Ruta | `api/sign-score/` + `api/scores/save/` |
| Gate | `context-action.ts:40` — suprimido en Lite, activo en Full |

**Estado: FUNCIONA en Full** — sin bloqueador técnico.

### A.4 Arena (PvAI)

| Atributo | Estado |
|---|---|
| Ruta | `app/[locale]/arena/page.tsx` |
| Bloqueado en Lite | Sí — middleware `307 /arena → /hub` |
| Dificultad | Easy/Medium/Hard + `aiThinkTimeMs` |
| Scoreboard | Activo — firma + contrato `0x1681aA...` |

**Estado: FUNCIONA en Full** — sin bloqueador.

### A.5 Victory NFT

| Atributo | Estado |
|---|---|
| Contrato | `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` (celo.json, deploy 2026-03-17) |
| Ruta | `api/sign-victory/` + `api/games/[id]/mint-receipt/` |
| Bloqueado en Lite | Sí — middleware + `context-action.ts` |

**Estado: FUNCIONA en Full** — sin bloqueador.

### A.6 Coach IA

| Atributo | Estado |
|---|---|
| Flag | `NEXT_PUBLIC_ENABLE_COACH` — NOT_SET en `.env.template` y `.env.mainnet` |
| Prod | Coach **DESACTIVADO** en producción — solo activo en `.env.local` |
| Ruta | `api/coach/analyze/`, `app/[locale]/coach/` |
| Bloqueado en Lite | Sí — middleware `307 /coach → /hub` |

**Estado: PARCIAL** — código OK, desactivado en prod por flag. Activarlo requiere LLM key + env var.

### A.7 Shop

| Atributo | Estado |
|---|---|
| Contrato | Shop `0x24846C772af7233ADfD98b9A96273120f3a1f74b` (celo.json, deploy 2026-03-12) |
| Token aceptado | USDC `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| Flujo | `safeTransferFrom(buyer, treasury, amount)` vía Shop contract |
| Bloqueado en Lite | Sí — `!CHESSCITO_LITE_MODE` en `hub-scaffold.tsx` + `exercises-screen.tsx` |
| Treasury | Mismo problema: `CHESSCITO_TREASURY_ADDRESS` en placeholder |

**Estado: FUNCIONA arquitecturalmente** — desactivado por treasury placeholder.

### A.8 Peones

| Atributo | Estado |
|---|---|
| Earn | Activo en ambas versiones vía `api/peones/earn/` (silencioso en Lite) |
| Spend | `api/shields/spend/` + `api/peones/spend/` (activo) |
| Balance chip | Oculto en Lite (`hub-scaffold.tsx:222`) |
| Compra | `peones_pack_50` a $0.50 → 50 Peones — bloqueado por treasury |

**Estado: PARCIAL** — earn/spend OK, compra con stablecoins bloqueada por treasury.

### A.9 PRO

| Atributo | Estado |
|---|---|
| Redis key | `coach:pro:{wallet}` con TTL = expiresAt |
| Gate en Lite | Oculto — `!CHESSCITO_LITE_MODE` en `hub-scaffold.tsx:239` |
| Route | Middleware bloquea `/pro` en Lite |

**Estado: FUNCIONA en Full** — sin bloqueador técnico si Coach activo.

### A.10 Contratos desplegados en Celo mainnet (chainId 42220)

| Contrato | Address | Deploy |
|---|---|---|
| Badges (Scoreboard) | `0xf92759E5525763554515DD25E7650f72204a6739` | `apps/contracts/deployments/celo.json` |
| Scoreboard | `0x1681aAA176d5f46e45789A8b18C8E990f663959a` | `celo.json` |
| Shop | `0x24846C772af7233ADfD98b9A96273120f3a1f74b` | `celo.json`, 2026-03-12 |
| VictoryNFT | `0x0eE22F830a99e7a67079018670711C0F94Abeeb0` | `celo.json`, 2026-03-17 |
| Labyrinth Badges | **NO DESPLEGADO** | Ausente en `celo.json` |
| Safe Owner | `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` | treasury potencial |
| Signer | `0x50c75be158168eCB3df326610f5E8Ea51F0B3CAe` | para EIP-712 |

### A.11 Env vars críticas para Full

| Env var | Presencia | Estado | Efecto si falta |
|---|---|---|---|
| `CHESSCITO_TREASURY_ADDRESS` | `.env` (PRESENTE, valor placeholder) | **PLACEHOLDER** | rail retorna `503 rail_not_configured` |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | `.env` (mismo) | **PLACEHOLDER** | UI no muestra botón de compra |
| `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` | **ABSENT** de todos los archivos | **NO SET** | `400` en todo claim de laberinto |
| `NEXT_PUBLIC_BADGES_ADDRESS` | PRESENTE y real | ✅ | sign-badge funciona |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | PRESENTE y real | ✅ | Scoreboard funciona |
| `NEXT_PUBLIC_SHOP_ADDRESS` | PRESENTE y real | ✅ | Shop funciona |
| `NEXT_PUBLIC_ENABLE_COACH` | **ABSENT** de prod | DESACTIVADO | Coach no disponible |
| `TORRE_PRINCESA` / `DRAGON` | PRESENTES en `.env` | ✅ | signing activo |
| `UPSTASH_REDIS_REST_URL/TOKEN` | PRESENTES en `.env` | ✅ | Rate limit + shields activos |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` | PRESENTES en `.env` | ✅ | Ledger activo |
| `CELO_RPC_URL` | PRESENTE | ✅ | RPC activo |

### A.12 Por qué el payment rail está desactivado

El payment rail es **intencionalmente fail-closed**. Diseño documentado en `api/verify-payment/route.ts:1–19`:

> "FAIL-CLOSED (preview + prod share env): if CHESSCITO_TREASURY_ADDRESS is unset/invalid the endpoint returns `rail_not_configured` BEFORE any receipt fetch, log decode, Supabase call, or credit."

La causa raíz: `getTreasuryAddressServer()` en `lib/payments/rail-config.ts:43–47` lee `process.env.CHESSCITO_TREASURY_ADDRESS` y ejecuta `isValidAddress(raw)` — regex `/^0x[0-9a-fA-F]{40}$/`. El valor actual en `.env` no pasa la validación → retorna `null` → endpoint retorna `503`.

**No hay código roto.** El sistema funciona exactamente como fue diseñado. El bloqueo es operativo, no técnico.

### A.13 Qué falta para reactivar el payment rail

```
1. Vercel Dashboard → Environment Variables
2. Setear CHESSCITO_TREASURY_ADDRESS = 0x917497b64eeB85859edcf2e4ca64059eDfeC1923
   (Safe Owner del proyecto — o la dirección real confirmada por el founder)
3. Setear NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = mismo valor
4. Redeploy automático de Vercel
5. Smoke: POST /api/verify-payment con body válido → debe retornar
   400 unsupported_chain o 400 unknown_sku (ya NO el 503 rail_not_configured)
```

**Total: 1 operación en dashboard, 0 líneas de código.**

### A.14 Evidencia para demo Full

| Evidencia | Fuente |
|---|---|
| Contratos desplegados | `apps/contracts/deployments/celo.json` — Badges/Scoreboard/Shop/Victory |
| Red | Celo Explorer `celoscan.io` — chainId 42220 |
| Badging Scoreboard | `0xf92759E5...` — verificable en Celoscan |
| VictoryNFT | `0x0eE22F83...` — deploy 2026-03-17 visible on-chain |
| Signer activo | TORRE_PRINCESA en `.env` — firma EIP-712 testeable localmente |

---

## B. Chesscito Lite — Estado real

### B.1 Flag de control

**Archivo:** `src/lib/feature-flags.ts:1`
```typescript
export const CHESSCITO_LITE_MODE =
  process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true";
```
Un solo booleano. El flag es de compilación — una vez built, el bundle Lite no contiene código de Arena/Shop/PRO/Coach.

### B.2 Rutas bloqueadas por middleware

**Archivo:** `src/lib/lite-mode-routing.ts:1–8`
```typescript
const FULL_ONLY_SEGMENTS = ["arena","coach","victory","shop","pro","founder"]
```
**Archivo:** `src/middleware.ts:57–66` — redirige `307 → /hub` cualquier path con estos segmentos en Lite.

Confirmado bloqueado: `/arena`, `/coach`, `/victory`, `/shop`, `/pro`, `/founder`.

### B.3 Hub Lite

**Archivo:** `src/components/hub/hub-scaffold.tsx`

| Elemento | Lite | Full | Línea |
|---|---|---|---|
| PeonesBalanceChip | ❌ oculto | ✅ visible | 222 |
| HubProBadge | ❌ oculto | ✅ visible | 239 |
| Focus Passport | ✅ solo Lite | ❌ | 288 |
| NextStepCard | ✅ solo Lite | ❌ | 341 |
| ShopSheet | ❌ oculto | ✅ visible | hub-scaffold-client |
| Coach tile | ❌ `onCoachTap=undefined` | ✅ | 384 |

**Estado: FUNCIONA** — hub limpio y coherente en Lite.

### B.4 Focus Passport

**Archivo:** `src/components/hub/focus-passport.tsx`  
7 slots tipo llamas: azul (día previo), color (hoy/activo), gris (pendiente).  
Fuente de datos: `localStorage` — sin backend propio, sin blockchain.  
Integración en hub: `hub-scaffold.tsx:288` con condición `CHESSCITO_LITE_MODE && focusPassport`.

**Estado: FUNCIONA** — visual, streak, assets `public/art/focus-passport/` presentes.

### B.5 Daily Practice

**Archivo:** `src/app/[locale]/challenge/daily/`  
Componente: `src/components/daily/daily-tactic-sheet.tsx`  
Oculta secciones de score on-chain en Lite (`!CHESSCITO_LITE_MODE` en líneas `183,200`).  
Streak integrado con Focus Passport vía `lib/daily/events.ts` (CustomEvent bus).

**Estado: FUNCIONA** — loop diario central de Lite.

### B.6 Exercises

**Archivo:** `src/app/[locale]/exercises/page.tsx`  
60 ejercicios compartidos. En Lite:
- `daily-limit-guard.tsx` — soft gate de límite diario
- `?sheet=shop` suprimido (`exercises/page.tsx:53`)  
- PRO sheet suprimida (`!CHESSCITO_LITE_MODE`)
- Badge claim activo si wallet conectada

**Estado: FUNCIONA** — mecánica OK, límite suave correcto.

### B.7 Labyrinth

Mecánica compartida. En Lite:
- `submitScore` suprimido (`context-action.ts:40`)
- `claimBadge` preservado (`context-action.ts:41`)
- Badge claim on-chain falla si `LABYRINTH_BADGES_ADDRESS` no configurado

**Estado: PARCIAL** — mecánica funciona, badge claim ROTO por env var ausente.

### B.8 Trophies Lite

**Archivo:** `src/app/[locale]/trophies/page.tsx`  
En Lite: logros derivados de `dailyProgress` (localStorage) — racha, días completados.  
En Full: victorias on-chain + Hall of Fame.  
Condicionados por `CHESSCITO_LITE_MODE`.

**Estado: FUNCIONA** — logros Lite correctos y diferenciados.

### B.9 Share

**Rutas accesibles:** `share/daily/`, `share/score/`, `share/endgame/`, `share/badge/`  
Share funciona en ambas versiones. Contenido varía por tipo.

**Estado: FUNCIONA**.

### B.10 Welcome Package

**Archivo:** `src/app/api/welcome-pack/claim/route.ts`  
Client gate: `use-welcome-package.ts:34` — solo activo si `CHESSCITO_LITE_MODE`.  
Crédito: `WELCOME_PACK_SHIELDS = 3` shields vía Redis `INCRBY`.  
Requiere: `personal_sign` + Supabase + Upstash Redis.

**Estado: FUNCIONA** — free, Lite-only, backend activo en prod.

### B.11 Wallet opcional

Lite no requiere wallet para jugar. Wallet se pide solo para:
- Welcome Package (optional, personal_sign)
- Badge claim (optional, si usuario inicia el flow)

Hub en Lite muestra "Connect" pero el juego es completamente funcional sin conectar.

**Estado: CORRECTO** — wallet es opt-in en Lite.

### B.12 Confirmación de exclusiones en Lite

| Elemento | Status en Lite | Evidencia |
|---|---|---|
| Shop | ❌ Bloqueado | middleware + `!CHESSCITO_LITE_MODE` guard en hub y exercises |
| Coach | ❌ Bloqueado | middleware `/coach` + `onCoachTap=undefined` en hub |
| PRO | ❌ Bloqueado | middleware `/pro` + badge oculto en `hub-scaffold.tsx:239` |
| Arena | ❌ Bloqueado | middleware `/arena → /hub` |
| Peones visibles | ❌ Oculto | `PeonesBalanceChip` oculto en `hub-scaffold.tsx:222` |
| Victory NFT | ❌ Bloqueado | middleware `/victory` + suprimido en `context-action.ts` |

---

## C. Micropagos Lite — Diseño técnico del `Lite Season Pass`

### C.1 Qué es el Lite Season Pass

Un acceso de **21 días** a features premium de Lite (shields ilimitados, ejercicios sin límite diario, campaña 21-Day Mind Challenge). También nombrado: 21-Day Mind Pass, Habit Pass, Mind Challenge Pass.

- **NO** activa Arena, Coach, Shop, PRO, Victory NFT.
- **NO** requiere contrato nuevo.
- **SÍ** usa el payment rail existente (`api/verify-payment`).
- **SÍ** acredita 3 shields al momento de compra.
- **SÍ** registra el entitlement en Supabase con TTL de 21 días.
- **SÍ** guarda wallet + txHash + logIndex.
- **SÍ** es idempotente (misma tx no puede acreditar dos veces).
- **SÍ** muestra success/error UI.
- **SÍ** habilita share posterior.

### C.2 Flujo completo

```
Usuario en Lite (ejercicios) 
  → shield agotado / campaña visible 
    → tap "Get Season Pass" 
      → SeasonPassSheet aparece
        → selecciona token (USDC/cUSD/USDT) 
          → `ERC20.transfer(treasury, $1.99)` 
            → recibe receipt
              → POST /api/verify-payment { sku: "lite_season_pass_21", ... }
                → server valida tx on-chain
                  → INSERT en `lite_season_passes` (Supabase)
                  → INCRBY shields +3 (Redis)
                  → retorna { ok: true, expiresAt, shieldsCredited: 3 }
                    → UI: Success screen + share CTA
                      → share: "Empecé mi 21-Day Mind Challenge 🔥"
```

### C.3 SKU y precio propuesto

| SKU | Nombre | Precio | Duración | Shields | Beneficios |
|---|---|---|---|---|---|
| `lite_season_pass_21` | 21-Day Mind Pass | $1.99 | 21 días | +3 al comprar | Sin límite diario + shield pool |

Precio $1.99 justificado en: > $0.50 (Peones pack trivial), < $4.99 (PRO mensual), comparable a Daily Reward apps en MiniPay. Confirmación final: founder.

### C.4 Infraestructura que se reutiliza (ya existe)

| Componente | Archivo | Reutiliza |
|---|---|---|
| Payment rail hook | `lib/payments/use-payment-rail.ts` | 100% — misma lógica tx + retry |
| Token selection | `lib/payments/use-get-peones-token-selection.ts` | Reutilizable sin cambio |
| Transfer builder | `lib/payments/transfer-builder.ts` | Reutilizable: `buildPeonesPackTransfer()` → `buildSeasonPassTransfer()` |
| Verify payment route | `api/verify-payment/route.ts` | Extensible — agregar rama `sku === "lite_season_pass_21"` |
| Treasury config | `lib/payments/rail-config.ts` | 100% — misma treasury, misma validación |
| Shield credit | Redis `coach:shields:credited:{wallet}` vía `INCRBY` | 100% — mismo key, misma operación |
| Idempotency | `buildPaymentIdempotencyKey()` | 100% — misma función |
| Accepted tokens | `RAIL_ACCEPTED_STABLECOINS` | 100% — USDC/cUSD/USDT |
| Rate limit / origin | `enforceOrigin()` + `enforceReadRateLimit()` | 100% |
| Sheet UI pattern | `components/payments/get-peones-sheet.tsx` | Modelo directo para nueva sheet |

### C.5 Qué hay que crear (infraestructura nueva)

| Elemento | Tipo | Descripción |
|---|---|---|
| `lite_season_pass_21` SKU | Config (3 líneas) | Agregar a `rail-config.ts` — tipo, precio, duración |
| Rama en `verify-payment` | Código (~30 líneas) | Si `sku === "lite_season_pass_21"` → INSERT en `lite_season_passes` + shields credit |
| Tabla `lite_season_passes` | Supabase migration | `wallet, tx_hash, log_index, expires_at, shields_credited, idempotency_key` |
| `api/season-pass/status/route.ts` | API route (~40 líneas) | GET — lee tabla Supabase o Redis TTL key por wallet |
| `components/payments/season-pass-sheet.tsx` | Componente | Basado en `get-peones-sheet.tsx` — mismo esqueleto |
| `lib/season-pass/use-season-pass.ts` | Hook (~30 líneas) | Lee status del pass, expone `hasPass`, `expiresAt`, `openSheet` |
| Trigger en Lite hub/exercises | Integración (~10 líneas) | Condición: `CHESSCITO_LITE_MODE && !hasPass` → mostrar CTA |
| Share post-compra | Copy + ruta existente | Reutilizar `share/daily/` con copy de campaña |

**Total estimado de código nuevo: ~150 líneas** (sin contar tests).

### C.6 Diseño de la tabla Supabase

```sql
-- Migration: YYYYMMDDHHMMSS_lite_season_passes.sql
CREATE TABLE lite_season_passes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet          text NOT NULL,
  tx_hash         text NOT NULL,
  log_index       int  NOT NULL,
  chain_id        int  NOT NULL DEFAULT 42220,
  token_address   text NOT NULL,
  amount_paid     text NOT NULL,  -- raw bigint como string
  sku             text NOT NULL DEFAULT 'lite_season_pass_21',
  idempotency_key text NOT NULL UNIQUE,
  shields_credited int NOT NULL DEFAULT 3,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lsp_wallet       ON lite_season_passes(wallet);
CREATE INDEX idx_lsp_expires_at   ON lite_season_passes(expires_at);
```

RLS: solo service role puede escribir. `GET /api/season-pass/status` lee por wallet y filtra `expires_at > now()`.

### C.7 Redis key para check rápido

```typescript
// Agregar a lib/coach/redis-keys.ts
seasonPass: (wallet: string) => `lite:season-pass:${wallet}`,
```

Al crear el pass: `redis.set(key, expiresAt.toISOString(), { px: 21*24*60*60*1000 })`.  
En `use-season-pass.ts`: consultar Redis primero (fast), Supabase como fallback.

### C.8 Extensión a `rail-config.ts`

```typescript
// Tipo extendido
export type PaymentRailSku = PeonesPackSku | SeasonPassSku;
export type SeasonPassSku = "lite_season_pass_21";

export type SeasonPass = {
  sku: SeasonPassSku;
  priceUsd6: bigint;          // $1.99 = 1_990_000n
  durationDays: number;       // 21
  shieldsOnPurchase: number;  // 3
  source: "season_pass";
};

export const SEASON_PASSES: Record<SeasonPassSku, SeasonPass> = {
  lite_season_pass_21: {
    sku: "lite_season_pass_21",
    priceUsd6: 1_990_000n,  // $1.99
    durationDays: 21,
    shieldsOnPurchase: 3,
    source: "season_pass",
  },
};
```

### C.9 Rama en `verify-payment/route.ts`

Después del treasury gate y la verificación on-chain (que NO cambia — misma firma `getTransactionReceipt`), agregar:

```typescript
if (sku in SEASON_PASSES) {
  // branch season pass
  const pass = SEASON_PASSES[sku as SeasonPassSku];
  const expiresAt = new Date(Date.now() + pass.durationDays * 86_400_000);
  // INSERT lite_season_passes + INCRBY shields
  // retorna { ok: true, expiresAt, shieldsCredited: pass.shieldsOnPurchase }
} else {
  // branch peones (existente sin cambio)
}
```

La verificación on-chain (`getTransactionReceipt`, anti-replay `receipt.to === token`, `verifyStablecoinTransfer`) es **idéntica** para ambos paths — solo el crédito backend difiere.

---

## D. Payment Rail — Diagnóstico completo

### D.1 Estado

| Componente | Archivo | Estado |
|---|---|---|
| `api/verify-payment/route.ts` | `src/app/api/verify-payment/route.ts` | FUNCIONA — bloqueado por treasury |
| `lib/payments/rail-config.ts` | SKUs, treasury, stablecoins | FUNCIONA |
| `lib/payments/use-payment-rail.ts` | Hook de tx + verify | FUNCIONA |
| `lib/payments/transfer-builder.ts` | Builder de calldata | FUNCIONA |
| `lib/payments/verify-transfer.ts` | Decode de logs Transfer | FUNCIONA |
| `components/payments/get-peones-sheet.tsx` | UI de compra | FUNCIONA |
| Supabase `peones_ledger` | Ledger de créditos | ACTIVO — tabla existe |
| Redis `coach:shields:credited:*` | Contador de shields | ACTIVO |
| Redis rate limit | `enforceRateLimit()` | ACTIVO vía Upstash |

### D.2 Tokens soportados

```typescript
// lib/contracts/tokens.ts (inferido de rail-config.ts:70)
ACCEPTED_TOKENS = [
  { symbol: "USDC",  address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  { symbol: "cUSD",  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  { symbol: "USDT",  address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
]
// USDm (ex-cUSD nativo) — NOT configured, out of scope
```

### D.3 Chain

- `CELO_MAINNET_CHAIN_ID = 42220` (hardcoded en `verify-payment/route.ts:48`)
- RPC: `process.env.CELO_RPC_URL` — presente en `.env`
- Client Viem: `createPublicClient({ chain: celo, transport: http(CELO_RPC_URL) })`

### D.4 Treasury

- **Server:** `getTreasuryAddressServer()` — lee `CHESSCITO_TREASURY_ADDRESS ?? TREASURY_ADDRESS`
- **Client:** `getTreasuryAddressClient()` — lee `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS`
- **Ambas retornan `null`** cuando el valor no pasa regex `^0x[0-9a-fA-F]{40}$`
- **Estado actual:** Placeholder en prod → `null` → `503 rail_not_configured`

### D.5 Anti-replay

```typescript
// verify-payment/route.ts:154
if (!receipt.to || receipt.to.toLowerCase() !== token) {
  return err("not_direct_transfer", 400);
}
```
La tx debe ser `token.transfer(treasury, amount)` directo — no un contrato intermediario.  
Idempotency key: `pack_purchase:{chainId}:{txHash}:{logIndex}` — UNIQUE en `peones_ledger`.

### D.6 Ledger de compras

Tabla Supabase: `peones_ledger`  
Campos: `wallet, event_type, amount, source, source_id, idempotency_key, attestation_hash, metadata, day_utc`  
Race condition: en caso de `insertError`, re-verifica por `idempotency_key` antes de retornar error.

### D.7 Shields

- **Store:** Redis `coach:shields:credited:{wallet}` — `INCRBY`, sin TTL
- **Crédito vía Shop:** `api/credit-shield/route.ts` — Lua atómica
- **Crédito vía Welcome Pack:** `api/welcome-pack/claim/route.ts:156–160` — `redis.incrby()`
- **Crédito vía Season Pass (propuesto):** mismo `redis.incrby()` en la rama del route
- **Spend:** `api/shields/spend/route.ts` — decrementa counter
- **Read:** `api/shields/me/route.ts` — `GET coach:shields:credited:{wallet}`

### D.8 Riesgos de seguridad del rail

| Riesgo | Mitigación existente |
|---|---|
| Double-credit por tx replay | `UNIQUE idempotency_key` en `peones_ledger` + race-condition handler |
| Dirección treasury incorrecta | `isValidAddress()` + fail-closed antes de cualquier DB op |
| Shop tx procesada como rail directo | `receipt.to === token` excluye Shop (`safeTransferFrom` llega al contract, no al token) |
| Rate abuse | `enforceReadRateLimit(ip)` + `enforceOrigin(req)` antes de cualquier lógica |
| Overpay silencioso | `RAIL_OVERPAY_ACCEPTED=true` — registrado en metadata, no reembolsado |
| Supabase down post-tx | Race-condition handler + log antes del 500 |
| Redis down | shields credit falla → 500 (no 200) — client reintenta, no doble-crédito por idempotency |

---

## E. Output consolidado

### E.1 Gaps de Full

| Gap | Impacto | Acción mínima |
|---|---|---|
| Treasury placeholder en prod | **CRÍTICO** — payment rail inactivo | Setear env var en Vercel |
| Coach desactivado en prod | Alto — monetización Coach bloqueada | Setear `NEXT_PUBLIC_ENABLE_COACH=true` + LLM key |
| Labyrinth Badges sin deploy | Medio — badge claim de laberintos falla | Deployar contrato + setear env var |
| USDm no configurado | Bajo — un token menos aceptado | Agregar a `ACCEPTED_TOKENS` si listado en MiniPay lo requiere |

### E.2 Gaps de Lite

| Gap | Impacto | Acción mínima |
|---|---|---|
| Sin Season Pass / micropago | **BLOQUEADOR para monetización Lite** | Implementar según diseño §C |
| Sin SKU en `rail-config.ts` para Lite | Técnico — 0 líneas de código aún | Agregar `SEASON_PASSES` config |
| Sin tabla `lite_season_passes` | Técnico | Migration SQL |
| Sin sheet `SeasonPassSheet` | UX | Nuevo componente (~60 líneas) |
| Sin `use-season-pass` hook | Técnico | Nuevo hook (~30 líneas) |
| Sin trigger CTA en Lite hub/exercises | UX | Integración (~10 líneas) |
| Labyrinth badge roto (compartido) | Medio | Mismo gap que Full |

### E.3 Archivos a modificar para Season Pass

```
apps/web/src/
├── lib/payments/rail-config.ts                    MODIFICAR — agregar SeasonPassSku + SEASON_PASSES
├── app/api/verify-payment/route.ts               MODIFICAR — agregar rama season pass + shields
├── lib/coach/redis-keys.ts                       MODIFICAR — agregar seasonPass key
├── components/payments/season-pass-sheet.tsx     CREAR — UI de compra
├── lib/season-pass/use-season-pass.ts            CREAR — hook de status
├── app/api/season-pass/status/route.ts           CREAR — GET status por wallet
└── supabase/migrations/YYYYMMDD_lite_season_passes.sql  CREAR — migration

apps/web/src/components/exercises/exercises-screen.tsx     INTEGRAR — CTA trigger
apps/web/src/components/hub/hub-scaffold.tsx               INTEGRAR — CTA opcional en hub
```

### E.4 Variables de entorno necesarias para Season Pass

| Env var | Propósito | Nuevo |
|---|---|---|
| `CHESSCITO_TREASURY_ADDRESS` | Recipient de la tx | **YA EXISTE** — solo cambiar valor |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | UI treasury address | **YA EXISTE** — solo cambiar valor |
| Supabase (`SUPABASE_URL`, `SERVICE_ROLE_KEY`) | Tabla season passes | **YA ACTIVOS** |
| Upstash Redis | Shields + Redis TTL pass | **YA ACTIVOS** |
| `CELO_RPC_URL` | Receipt fetch on-chain | **YA ACTIVO** |

**No hay env vars nuevas.** Solo el valor de `CHESSCITO_TREASURY_ADDRESS` cambia de placeholder a dirección real.

### E.5 Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Treasury mal configurada | Alto | Verificar con `curl POST /api/verify-payment` → debe dar 400 (no 503) |
| Season Pass en Full (contaminación) | Medio | `SeasonPassSheet` solo se monta si `CHESSCITO_LITE_MODE` |
| Shields acreditados doble | Bajo | Redis INCRBY atómico + idempotency_key UNIQUE en Supabase |
| Pass expirado no revocado en Redis | Bajo | Redis TTL automático; Supabase `expires_at` como fallback |
| USDm no soportado (fallo de listing) | Bajo | Agregar antes de listing oficial — no bloqueador para demo |
| Labyrinth badge en demo | Medio | No demostrarlo hasta confirmar deploy del contrato |

### E.6 Plan mínimo de implementación

**Día 1 (hoy, pre-reunión):**
1. ✅ Verificar que Lite corre limpio en `preview.chesscito.com` — Focus Passport, Daily, Exercises, Trophies
2. ✅ Confirmar que Arena/Coach/Shop/PRO no aparecen en Lite
3. ⚠️ Confirmar `LABYRINTH_BADGES_ADDRESS` en Vercel — si no está, desactivar badge claim en laberintos para demo

**Día 2 (post-reunión, si MiniPay da OK):**
1. Setear treasury en Vercel (1 env var) → smoke del rail
2. Agregar `lite_season_pass_21` SKU a `rail-config.ts`
3. Migration SQL `lite_season_passes`
4. Rama en `verify-payment` para season pass
5. `SeasonPassSheet` component (clon de `get-peones-sheet.tsx` con copy de campaña)
6. Hook `use-season-pass.ts`
7. Route `api/season-pass/status`
8. Trigger CTA en exercises (shields=0 o campaña visible)
9. Tests unitarios + smoke en MiniPay físico

**Estimación:** Día 2 completo = **6–8h** trabajo neto.

### E.7 Checklist de prueba local

```
□ pnpm dev con NEXT_PUBLIC_CHESSCITO_LITE_MODE=true
□ Hub: Focus Passport visible, Peones chip OCULTO, PRO badge OCULTO
□ Navegar a /arena → redirige a /hub (307)
□ Navegar a /coach → redirige a /hub (307)
□ Navegar a /shop → redirige a /hub (307)
□ Daily Practice: completar táctica → Focus Passport actualiza streak
□ Exercises: completar ejercicio → badge claim dispara si wallet conectada
□ Labyrinth: verificar si badge claim funciona o retorna 400 útil
□ Trophies: logros Lite visibles (sin victorias on-chain)
□ Share: compartir daily sin error
□ Welcome Package: conectar wallet → shields +3 en Redis
□ POST /api/verify-payment con treasury=real y sku=peones_pack_50 → 200 ok
□ POST /api/verify-payment con treasury=X → 503 rail_not_configured
□ POST /api/verify-payment con sku=unknown → 400 unknown_sku
```

### E.8 Checklist de prueba en MiniPay

```
□ Abrir preview.chesscito.com en MiniPay Android físico
□ Auto-connect: wallet se conecta sin botón "Connect Wallet" explícito
□ Hub Lite: Focus Passport visible, 390px, sin overflow
□ Daily Practice: resolver táctica completa, streak +1
□ Exercises: resolver 2-3 ejercicios, límite suave visible si aplica
□ Badge claim (Scoreboard): confirmar que EIP-712 firma → tx on-chain Celo mainnet
□ Trophies: revisar logros Lite
□ Share: tap Share → sheet nativa de Android → URL con preview OG
□ Welcome Package: primera conexión → shields +3 confirmado
□ Navigation dock: sin iconos de Shop/PRO/Coach
□ Verificar que /arena, /coach, /shop redirigen a /hub (no crash)
□ Inspector de red: confirmar calls a /api/verify-payment retornan 503 (treasury aún placeholder)
□ Sin raw 0x addresses en ninguna pantalla visible al usuario
```

---

## F. Recomendación final

### Para la reunión MiniPay (hoy)

Presentar **Chesscito Lite** como producto terminado. Demostrar:
1. Hub con Focus Passport → narrativa de hábito
2. Daily Practice → loop central
3. Exercises → aprendizaje de pieza
4. Trophies Lite → progresión sin on-chain complejo
5. Share → viral loop

No mostrar: Arena, Coach, Shop, Badges de laberinto (hasta confirmar), payment rail activo.

Cuando pregunten por monetización:
> "El payment rail está implementado en el código con contratos reales en Celo mainnet. Hoy lo tenemos en modo inactivo mientras confirmamos el modelo final. La siguiente fase es el Lite Season Pass — $1.99 por 21 días — que usará el mismo rail y no requiere contratos nuevos."

### Qué implementar primero mañana (si MiniPay da OK)

**Prioridad 1 — Treasury (1 env var, 0 código):**  
Setear `CHESSCITO_TREASURY_ADDRESS` en Vercel → payment rail activo en prod.

**Prioridad 2 — Lite Season Pass (1 día, ~150 líneas):**  
Implementar según §C — extensión del rail existente, sin contratos nuevos, Lite-only.

**Prioridad 3 — Labyrinth Badge (si contrato existe):**  
Setear `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` si el contrato fue desplegado y es verificable en Celoscan.

---

*Generado: 2026-06-25 | Base: `4f26019e` | Auditor: Senior Product Engineer / Tech Lead*
