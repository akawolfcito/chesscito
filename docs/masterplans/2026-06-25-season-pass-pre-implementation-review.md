# Revisión Pre-Implementación: Lite Season Pass

**Fecha:** 2026-06-25  
**Rol:** Senior Staff Engineer  
**Documento base:** `docs/masterplans/2026-06-25-chesscito-lite-full-minipay-masterplan.md`  
**Commit auditado:** `main` — `4f26019e`  
**Decisión:** GO — con 4 correcciones técnicas antes de escribir código

---

## 0. Veredicto: GO / NO-GO

**GO.**

La infraestructura está lista. El riesgo de contaminación Lite/Full es bajo y controlable. Existen 4 correcciones técnicas que deben reflejarse en el prompt de implementación — no son bloqueadoras, pero si se ignoran generan código roto en el primer intento.

---

## 1. Treasury

### 1.1 Dónde se usa `CHESSCITO_TREASURY_ADDRESS`

| Archivo | Uso | Línea |
|---|---|---|
| `lib/payments/rail-config.ts:43` | `getTreasuryAddressServer()` — lee `CHESSCITO_TREASURY_ADDRESS ?? TREASURY_ADDRESS` | server-side |
| `lib/payments/rail-config.ts:35` | `getTreasuryAddressClient()` — lee `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | client-side |
| `app/api/verify-payment/route.ts:122` | `getTreasuryAddressServer()` → si null → `503 rail_not_configured` | antes de cualquier DB/RPC |
| `lib/payments/use-payment-rail.ts:100` | `getTreasuryAddressClient()` → si null → `unavailableReason = "no_treasury"` | bloquea botón de pago |

### 1.2 ¿Es requerido `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS`?

**Sí para la UI.** `usePaymentRail` llama a `getTreasuryAddressClient()` (línea 100) que lee la var pública. Si es null → el hook expone `available=false` → el componente bloquea el botón de pago. Sin esta var el usuario nunca puede iniciar el pago aunque el backend esté configurado.

Son dos variables independientes con propósitos distintos:
- `CHESSCITO_TREASURY_ADDRESS` — server-only, valida el recipient on-chain.
- `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` — client, habilita el botón de pago en UI.

**Ambas deben ser iguales y válidas para que el flujo funcione end-to-end.**

### 1.3 El `503 rail_not_configured`

Confirmado. `lib/payments/rail-config.ts:43–47`:
```typescript
export function getTreasuryAddressServer(): `0x${string}` | null {
  const raw = process.env.CHESSCITO_TREASURY_ADDRESS ?? process.env.TREASURY_ADDRESS;
  return isValidAddress(raw) ? raw : null;
}
```
`isValidAddress` = regex `/^0x[0-9a-fA-F]{40}$/`. Cualquier valor que no pase → `null` → `verify-payment/route.ts:123` retorna `503` antes de tocar RPC, Redis, o Supabase.

### 1.4 Treasury confirmada

```
0x917497b64eeB85859edcf2e4ca64059eDfeC1923
```

### 1.5 Dónde aparece en el repo

| Fuente | Key | Forma en que aparece |
|---|---|---|
| `apps/contracts/.env:24` | `SAFE_OWNER` | Valor exacto |
| `apps/contracts/.env:35` | `TREASURY_ADDRESS` | Valor exacto |
| `apps/contracts/.env.local:24` | `SAFE_OWNER` | Valor exacto |
| `apps/contracts/.env.local:35` | `TREASURY_ADDRESS` | Valor exacto |
| `apps/contracts/deployments/celo.json:5` | `safeOwner` | Valor exacto |
| `apps/contracts/deployments/celo-sepolia.json:5` | `safeOwner` | Valor exacto |
| `docs/superpowers/security/2026-03-12-shop-upgradeable-security-audit.md:89–90` | `Treasury` / `Owner` | Con label `(Safe)` |
| `docs/superpowers/specs/2026-03-12-shop-upgradeable-multi-token.md:229` | `treasury address` | "Same treasury address" |
| `apps/web/src/` | — | **AUSENTE** — la app web nunca hardcodea la address |

La address **no aparece en ningún archivo de `apps/web/src/`** — solo se inyecta vía env vars en runtime. Correcto por diseño.

### 1.6 Clasificación: Safe, EOA o unknown_from_repo

**SAFE — confirmado desde el repo.**

Evidencia explícita:
1. `docs/superpowers/security/2026-03-12-shop-upgradeable-security-audit.md:90`:
   ```
   | Owner | 0x917497b64eeB85859edcf2e4ca64059eDfeC1923 (Safe) |
   ```
   La palabra `(Safe)` es la clasificación explícita en el audit de seguridad del Shop.
2. La key `SAFE_OWNER` en `apps/contracts/.env` y `.env.local` (línea 24) nombra explícitamente la address como el owner del Safe.
3. `celo.json:3` — el campo se llama `"safeOwner"`.

### 1.7 Implicaciones Safe vs EOA para el rail

El rail actual (`ERC20.transfer(treasury, amount)`) **no distingue entre Safe y EOA como destinatario**. La instrucción `transfer()` de un ERC20 solo actualiza el balance del address recipient — no importa si detrás hay un contrato Safe o una EOA.

Implicaciones operativas documentadas:

| Aspecto | Safe | EOA |
|---|---|---|
| Recibir ERC20 (USDC/cUSD/USDT) | ✅ Sin acción — balance se actualiza | ✅ Igual |
| Retirar fondos | Requiere quórum de firmantes del Safe | 1 firma privada |
| Riesgo de pérdida de fondos | Bajo — multisig protege | Mayor — si se pierde la clave |
| Reversibilidad de tx erróneas | No reversibles on-chain en ningún caso | Igual |
| Compatibilidad con el rail | **100% compatible** | 100% compatible |

**Conclusión:** Para el rail de pago directo (`ERC20.transfer`) la treasury puede ser Safe o EOA indistintamente. La verificación en `verifyStablecoinTransfer()` solo comprueba que el log `Transfer` tenga `to == treasury_address`. La naturaleza del destinatario es irrelevante para la verificación.

### 1.8 ¿Full y Lite usan la misma treasury?

**Sí, por diseño existente.** El rail directo (`verify-payment`) y el Shop contract ya usaban la misma `TREASURY_ADDRESS` del workspace de contratos. Full y Lite compartirán `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` como treasury. Esto simplifica la operación — una sola address para monitorear fondos entrantes.

---

## 2. Season Pass scope — Confirmado

El MVP es exactamente el siguiente entitlement:

**Incluido:**
- `sku: "lite_season_pass_21"` — identificador del pass
- `season_id` — identificador de campaña (ej: `"21day-mind-challenge-2026-q3"`)
- `wallet` (lowercase, siempre)
- `tx_hash`
- `log_index`
- `chain_id` (42220)
- `token_address`
- `amount_paid` (bigint como string)
- `expires_at` (timestamptz, now() + 21 días)
- `+3 Streak Shields` al momento de compra
- `supporter_status` (ej: `"challenger"`) — campo texto, no implica lógica backend adicional

**Excluido explícitamente (fuera de scope del MVP):**
- Shields ilimitados (el pass da +3 al comprar, no elimina el consumo)
- Coach IA
- PRO membresía
- Shop completa
- Peones visibles en Lite
- Arena PvAI
- Victory NFT
- Labyrinth Badge (ver sección 6)
- Leaderboard de season
- Premios automáticos al completar 21 días
- Contratos nuevos
- USDm como token (fuera de scope hasta listing oficial)

---

## 3. Supabase schema — Validado con corrección

La tabla propuesta en el masterplan es correcta. Se confirma con la siguiente corrección:

**Esquema validado:**
```sql
CREATE TABLE lite_season_passes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet          text        NOT NULL,     -- siempre lowercase (normalizado en server antes del INSERT)
  season_id       text        NOT NULL,     -- ej: "21day-mind-challenge-2026-q3" — identifica la campaña
  sku             text        NOT NULL DEFAULT 'lite_season_pass_21',
  tx_hash         text        NOT NULL,
  log_index       int         NOT NULL,
  chain_id        int         NOT NULL DEFAULT 42220,
  token_address   text        NOT NULL,
  amount_paid     text        NOT NULL,     -- bigint serializado como string
  idempotency_key text        NOT NULL UNIQUE,
  shields_credited int        NOT NULL DEFAULT 3,
  supporter_status text,                   -- opcional: "challenger", etc.
  metadata        jsonb,                   -- campo libre para extras (overpaid, rail, etc.)
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(chain_id, tx_hash, log_index)     -- constraint de anti-replay a nivel DB
);

CREATE INDEX idx_lsp_wallet     ON lite_season_passes(wallet);
CREATE INDEX idx_lsp_expires_at ON lite_season_passes(expires_at);
```

**Corrección respecto al masterplan:** el masterplan no incluía `season_id`. El campo es necesario para diferenciar campañas (una misma wallet podría comprar passes en distintas temporadas). Sin él la query `WHERE wallet = ? AND expires_at > now()` retorna el pass más reciente pero no permite filtrar por campaña.

**RLS / service role:**
- Escritura: solo service role key (`SUPABASE_SERVICE_ROLE_KEY`) — nunca expuesta al cliente.
- Lectura de status: vía `GET /api/season-pass/status?wallet=0x...` — el backend consulta con service role y retorna solo `{ active: bool, expiresAt, seasonId }`.
- No exponer tabla directamente al cliente.
- El `NEXT_PUBLIC_SUPABASE_ANON_KEY` (si existe) **no debe tener permisos de lectura sobre esta tabla** — RLS policy: `USING (false)` para anon.

---

## 4. Payment verification — Confirmado con 4 correcciones técnicas

### 4.1 La extensión es viable

`api/verify-payment/route.ts` puede extenderse con una rama para `lite_season_pass_21` sin tocar el path existente de Peones. La verificación on-chain (receipt fetch, anti-replay, Transfer decode) es **idéntica** — solo el crédito backend difiere.

### 4.2 Correcciones técnicas necesarias (no mencionadas en el masterplan)

**Corrección 1 — Tipo `PeonesPackSku` en `ParsedInput`.**

`verify-payment/route.ts:70`:
```typescript
type ParsedInput = {
  sku: PeonesPackSku;   // ← ACTUALMENTE esto, debe ampliarse
  ...
}
```
`PeonesPackSku = "peones_pack_50"`. Si llega `sku: "lite_season_pass_21"` → falla la validación shape antes del treasury gate.

**Fix:** Cambiar a `sku: string` en `ParsedInput` (el tipo semántico lo controla la rama post-treasury), o crear un union `PaymentRailSku = PeonesPackSku | SeasonPassSku` en `rail-config.ts` y usarlo en `ParsedInput`.

**Corrección 2 — `usePaymentRail` tiene `sku: PeonesPackSku` en su firma.**

`use-payment-rail.ts:27`:
```typescript
import { type PeonesPackSku } from "@/lib/payments/rail-config";
```
`use-payment-rail.ts:74`:
```typescript
export function usePaymentRail({ sku, ... }: { sku: PeonesPackSku; ... })
```
`use-payment-rail.ts:207`:
```typescript
const tx = buildPeonesPackTransfer({ sku, treasury, tokenSymbol });
```

Si se pasa `sku: "lite_season_pass_21"` → TypeScript error en la llamada + `buildPeonesPackTransfer` falla porque el SKU no está en `PEONES_PACKS`.

**Fix recomendado:** Crear un hook dedicado `use-season-pass-rail.ts` que duplique la lógica genérica de `usePaymentRail` pero sin el acoplamiento a `PeonesPackSku`. El hook existente NO se modifica — cero riesgo de regresión en el flujo de Peones.

**Corrección 3 — `buildPeonesPackTransfer` es Peones-specific.**

`transfer-builder.ts:65–99` — el builder llama a `PEONES_PACKS[args.sku]` y retorna `sku: PeonesPackSku`. No puede usarse para Season Pass.

**Fix:** Crear `buildSeasonPassTransfer(args: { treasury, tokenSymbol, priceUsd6 })` en `transfer-builder.ts` (o en un archivo nuevo `season-pass-transfer-builder.ts`). La lógica es la misma — `encodeFunctionData` con `transfer(treasury, amount)` — solo cambia la fuente del `priceUsd6` y el tipo de retorno.

**Corrección 4 — La rama en `verify-payment` debe venir DESPUÉS de la semantic validation de chain y token, pero ANTES de `if (!(sku in PEONES_PACKS))`.**

El flujo actual en `verify-payment/route.ts:128–133`:
```typescript
if (chainId !== CELO_MAINNET_CHAIN_ID) return err("unsupported_chain", 400);
if (!(sku in PEONES_PACKS)) return err("unknown_sku", 400);  // ← aquí falla el Season Pass
```

La rama de Season Pass debe reemplazar la check monolítica `PEONES_PACKS`:
```typescript
if (chainId !== CELO_MAINNET_CHAIN_ID) return err("unsupported_chain", 400);

const isSeasonPass = sku in SEASON_PASSES;
const isPeonesPack = sku in PEONES_PACKS;
if (!isSeasonPass && !isPeonesPack) return err("unknown_sku", 400);

if (!RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER.includes(token)) {
  return err("unsupported_token", 400);
}
// ... receipt fetch igual para ambas ramas ...
// después: bifurcar por isSeasonPass vs isPeonesPack para el crédito
```

### 4.3 Garantías que el rail mantiene para Season Pass

| Garantía | Mecanismo | ¿Cambia para Season Pass? |
|---|---|---|
| Tx debe ser `ERC20.transfer(treasury, amount)` directo | `receipt.to === token` (línea 154) | No |
| No acepta Shop contract tx | Anti-replay `receipt.to === token` excluye `safeTransferFrom` | No |
| No acredita sin receipt verificado | `getTransactionReceipt()` + `receipt.status === "success"` | No |
| Valida chain id = 42220 | Línea 129 | No |
| Valida token aceptado | `RAIL_ACCEPTED_STABLECOIN_ADDRESSES_LOWER` | No |
| Valida amount mínimo | `verifyStablecoinTransfer()` + `expectedAmount` del config | No — `SEASON_PASSES` config define el precio |
| Overpay aceptado | `RAIL_OVERPAY_ACCEPTED = true` | No |
| Idempotente — misma tx no double-credits | `UNIQUE idempotency_key` en DB | No — Season Pass usa misma función `buildPaymentIdempotencyKey` |
| Si Supabase ya tiene la tx | Pre-check en DB → retorna estado existente sin duplicar shields | No — mismo patrón |

### 4.4 Comportamiento si Redis falla después de INSERT en Supabase

Escenario: `lite_season_passes` INSERT exitoso → `redis.incrby` falla.

El masterplan no especificaba este behavior. **Recomendación:**

```
if (shieldsCreditError) {
  // El pass está activo (Supabase insertado exitosamente).
  // Los shields fallaron. No retornar error 500 — el usuario pagó y tiene el pass.
  // Retornar ok:true con shields_credited=0 y un flag `shields_pending=true`.
  // El cliente muestra success del pass + mensaje "shields se acreditarán en breve".
  // Una reconciliation task puede re-intentar el INCRBY leyendo lite_season_passes sin shields.
  log.error("shield_credit_failed_after_pass_insert", { wallet, idempotencyKey });
  return NextResponse.json({ ok: true, ..., shieldsCredited: 0, shieldsPending: true });
}
```

Esto es fail-safe para el usuario — el pass está registrado y puede verificarse en Supabase. Los shields son un bonus, no el entitlement principal.

---

## 5. Lite gating — Confirmado

### Dónde montar el CTA

**Opción recomendada:** `exercises-screen.tsx` — trigger cuando `shields === 0` después de un fallo.

**Segunda opción:** Hub Lite — banner en `hub-scaffold.tsx` si `!hasPass && CHESSCITO_LITE_MODE`.

**Gating concreto (en ambos puntos):**
```typescript
{CHESSCITO_LITE_MODE && !hasSeasonPass && (
  <SeasonPassCta onOpen={() => openSeasonPassSheet()} />
)}
```

**Confirmado que NO debe:**
- Abrir `ShopSheet` (bloqueada en Lite por `!CHESSCITO_LITE_MODE`)
- Abrir `ProSheet` (bloqueada en Lite)
- Mostrar `PeonesBalanceChip` (oculto en Lite, `hub-scaffold.tsx:222`)
- Cambiar la navegación principal (el dock Lite no se modifica)
- Montar en Full (el guard `CHESSCITO_LITE_MODE` es suficiente)

`hub-scaffold.tsx` ya tiene 5 guards `CHESSCITO_LITE_MODE` explícitos en el archivo. La adición de uno más sigue el patrón establecido.

---

## 6. Labyrinth Badge

### Clasificación definitiva

| Deploy | Evidencia |
|---|---|
| Celo **Sepolia** (testnet) | `apps/contracts/deployments/celo-sepolia.json:22` — `"labyrinthBadgesProxy": "0x8AA4006dfb3D5B7e255Df26B1065CD87A193171b"`, deploy `2026-06-03` |
| Celo **Mainnet** | **AUSENTE** — `apps/contracts/deployments/celo.json` no tiene `labyrinthBadgesProxy` |

**Conclusión:** El contrato de Labyrinth Badges **existe en Sepolia únicamente**. En mainnet no está desplegado. `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` no está configurado en ningún `.env` de `apps/web/` (solo el template tiene `0x0000...`).

Cualquier llamada a `api/sign-labyrinth` en prod retorna `400 { error: "Missing required env: NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS" }` — error visible al usuario.

### Recomendaciones

1. **No demostrar badge claim de laberintos en la reunión MiniPay.**
2. Si el flujo de laberinto es visible en la demo, suprimir el botón de claim cuando `CHESSCITO_LITE_MODE` si `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` está ausente. La mecánica de juego puede mostrarse sin el claim on-chain.
3. **No desplegar el contrato en mainnet dentro de este scope** — es un esfuerzo separado (deploy + configuración del signer + tests).
4. **No mezclar con Season Pass** — son features ortogonales. El Season Pass no depende de Labyrinth Badges.

**Acción mínima opcional antes de demo:** Si la UI muestra el botón de claim incluso cuando el address no está configurado, agregar en `context-action.ts` o `labyrinth-complete-overlay.tsx`:
```typescript
const canClaimLabyrinthBadge = 
  !!process.env.NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS && 
  process.env.NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS !== "0x0000000000000000000000000000000000000000";
```
Esta condición suprime el botón de claim en prod sin tocar contratos.

---

## 7. Env vars — Lista final

### Variables para activar el rail (ambas versiones)

| Env var | Valor a configurar en Vercel | Dónde se usa |
|---|---|---|
| `CHESSCITO_TREASURY_ADDRESS` | `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` | `getTreasuryAddressServer()` — backend, valida recipient |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` | `getTreasuryAddressClient()` — frontend, habilita botón |

### Variables ya activas en Vercel prod (no requieren acción)

| Env var | Estado | Confirmación |
|---|---|---|
| `CELO_RPC_URL` | ACTIVO | `.env` y `.env.mainnet` |
| `SUPABASE_URL` | ACTIVO | `.env` y `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | ACTIVO | `.env` y `.env.local` |
| `UPSTASH_REDIS_REST_URL` | ACTIVO | `.env` y `.env.local` |
| `UPSTASH_REDIS_REST_TOKEN` | ACTIVO | `.env` y `.env.local` |
| `TORRE_PRINCESA` / `DRAGON` | ACTIVO | `.env` y `.env.local` |
| `NEXT_PUBLIC_BADGES_ADDRESS` | ACTIVO | Todos los `.env` |
| `NEXT_PUBLIC_CHAIN_ID` | ACTIVO (`42220`) | Todos los `.env` |

### Nombres de variables — ¿Difieren del masterplan?

No difieren. Los nombres documentados en el masterplan coinciden exactamente con los que usa el código:
- `getTreasuryAddressServer()` busca `CHESSCITO_TREASURY_ADDRESS` (y fallback `TREASURY_ADDRESS`)
- `getTreasuryAddressClient()` busca `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS`

**Nota:** La variable de fallback `TREASURY_ADDRESS` (sin prefijo `CHESSCITO_`) también sería aceptada por `getTreasuryAddressServer()`. Sin embargo, por claridad operativa se recomienda usar `CHESSCITO_TREASURY_ADDRESS` explícitamente en Vercel.

---

## 8. Lista de correcciones al masterplan

| # | Corrección | Sección en masterplan |
|---|---|---|
| 1 | Treasury clasificada como **SAFE** (no EOA ni unknown) — confirmado por `celo.json:safeOwner`, `apps/contracts/.env:SAFE_OWNER`, y audit `(Safe)` en security doc | §A.10, §C.1 |
| 2 | `usePaymentRail` tiene `sku: PeonesPackSku` en su firma — Season Pass necesita **hook propio** (`use-season-pass-rail.ts`), NO extender el existente | §C.4 |
| 3 | `buildPeonesPackTransfer` es Peones-specific — Season Pass necesita **`buildSeasonPassTransfer`** o un builder genérico | §C.4 |
| 4 | `ParsedInput.sku` en `verify-payment/route.ts` es `PeonesPackSku` — debe widening a `string` o union type antes de la rama Season Pass | §C.9 |
| 5 | El schema de `lite_season_passes` requiere `season_id` — sin él no es posible identificar la campaña | §C.6 |
| 6 | Labyrinth Badges: desplegado en **Celo Sepolia únicamente** (no mainnet) — no demostrar en reunión | §B.7, §E.2 |
| 7 | El comportamiento de Redis failure post-INSERT en Supabase no estaba documentado — el pass se entrega sin shields + flag `shields_pending=true` | §C.9 |

---

## 9. Lista final de archivos a modificar

```
apps/web/src/
├── lib/payments/rail-config.ts
│   └── AGREGAR: type SeasonPassSku, type SeasonPass, const SEASON_PASSES
│       El tipo PeonesPackSku existente NO cambia.
│
├── app/api/verify-payment/route.ts
│   └── MODIFICAR: widening ParsedInput.sku, check semántico ampliado,
│       rama post-verify para season pass (INSERT + shields)
│
├── lib/coach/redis-keys.ts
│   └── AGREGAR: seasonPass key (con TTL 21d en el setter, no aquí)
│
├── lib/payments/transfer-builder.ts
│   └── AGREGAR: buildSeasonPassTransfer() — misma mecánica, precio desde SEASON_PASSES
│       buildPeonesPackTransfer() NO cambia.
│
├── lib/season-pass/use-season-pass-rail.ts          [NUEVO]
│   └── Hook para Season Pass — no extiende usePaymentRail, replica el patrón genérico
│
├── lib/season-pass/use-season-pass-status.ts        [NUEVO]
│   └── Hook: lee /api/season-pass/status, expone { hasPass, expiresAt, seasonId }
│
├── app/api/season-pass/status/route.ts              [NUEVO]
│   └── GET — consulta lite_season_passes por wallet + expires_at > now()
│
├── components/payments/season-pass-sheet.tsx        [NUEVO]
│   └── Basado en get-peones-sheet.tsx, usa use-season-pass-rail
│       Gateado: solo monta si CHESSCITO_LITE_MODE
│
└── components/exercises/exercises-screen.tsx
    └── INTEGRAR: CTA trigger cuando shields=0 && CHESSCITO_LITE_MODE && !hasPass

apps/web/supabase/migrations/
└── YYYYMMDDHHMMSS_lite_season_passes.sql            [NUEVO]
    └── Tabla lite_season_passes + índices + RLS policy
```

**Archivos que NO deben modificarse:**
- `lib/payments/use-payment-rail.ts` — sin tocar
- `components/payments/get-peones-sheet.tsx` — sin tocar
- `src/middleware.ts` — sin tocar
- Contratos — sin tocar

---

## 10. Riesgos restantes

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Treasury SAFE requiere quórum para retirar fondos | Operativo, no técnico | El rail no depende de esto — solo envía funds, no los retira. El founder gestiona el Safe. |
| Copiar `usePaymentRail` en el hook de Season Pass crea deuda técnica | Bajo | Aceptable para MVP. Una abstracción genérica puede venir en fase 2 si hay más SKUs. |
| Shield credit falla post-INSERT | Bajo | Documentado §4.4 — `shields_pending=true` como fallback |
| `lite_season_passes` INSERT falla (Supabase down) | Bajo | El mismo patrón de `verify-payment` — race-condition handler ya existe; copiar el patrón |
| Usuario compra Season Pass en Full accidentalmente | Imposible | La `SeasonPassSheet` solo se monta con `CHESSCITO_LITE_MODE=true` |
| Labyrinth badge error visible en demo | Medio | Suprimir botón de claim si `LABYRINTH_BADGES_ADDRESS` ausente — acción mínima opcional pre-demo |
| `peones_pack_50` y `lite_season_pass_21` comparten `verify-payment` — merge conflict futuro | Bajo | Ambas ramas son aditivas. No hay dependencia entre ellas. |

---

## 11. Prompt exacto de implementación

Usar exactamente este prompt en la próxima sesión:

---

> **Actúa como Senior Staff Engineer. Implementa `Lite Season Pass` en Chesscito.**
>
> **Documento base:** `docs/masterplans/2026-06-25-chesscito-lite-full-minipay-masterplan.md`  
> **Revisión pre-implementación:** `docs/masterplans/2026-06-25-season-pass-pre-implementation-review.md`
>
> **Contexto:**
> - Treasury: `0x917497b64eeB85859edcf2e4ca64059eDfeC1923` (SAFE, confirmed)
> - SKU: `lite_season_pass_21`, precio $1.99, duración 21 días, +3 shields
> - season_id initial value: `"21day-mind-challenge-2026-q3"`
>
> **Orden de implementación (en este orden exacto, un commit por paso):**
>
> 1. `lib/payments/rail-config.ts` — agregar `SeasonPassSku`, `SeasonPass`, `SEASON_PASSES`. NO modificar nada existente.
>
> 2. `supabase/migrations/YYYYMMDDHHMMSS_lite_season_passes.sql` — tabla con campos: `id, wallet (lowercase), season_id, sku, tx_hash, log_index, chain_id, token_address, amount_paid, idempotency_key UNIQUE, shields_credited DEFAULT 3, supporter_status, metadata jsonb, expires_at, created_at`. UNIQUE(chain_id, tx_hash, log_index). RLS: USING (false) para anon.
>
> 3. `lib/payments/transfer-builder.ts` — agregar `buildSeasonPassTransfer()`. NO modificar `buildPeonesPackTransfer`.
>
> 4. `lib/coach/redis-keys.ts` — agregar `seasonPass: (wallet) => \`lite:season-pass:\${wallet}\``.
>
> 5. `app/api/verify-payment/route.ts` — widening de `ParsedInput.sku` a `string`. Agregar rama `lite_season_pass_21` post-receipt-verify: INSERT en `lite_season_passes` + `redis.incrby` shields. Si Redis falla post-INSERT: retornar `ok:true, shieldsCredited:0, shieldsPending:true`. NO modificar el path de Peones.
>
> 6. `app/api/season-pass/status/route.ts` — GET, lee `lite_season_passes WHERE wallet=? AND expires_at > now() LIMIT 1`. Retorna `{ active, expiresAt, seasonId }`.
>
> 7. `lib/season-pass/use-season-pass-status.ts` — hook que llama al GET de status. Expone `{ hasPass, expiresAt, loading }`.
>
> 8. `lib/season-pass/use-season-pass-rail.ts` — nuevo hook independiente de `usePaymentRail`, adaptado para `lite_season_pass_21`. Misma estructura de fases: idle/preparing/awaiting_signature/pending_tx/verifying/success/error.
>
> 9. `components/payments/season-pass-sheet.tsx` — basado en `get-peones-sheet.tsx`. Gateado: no monta si `!CHESSCITO_LITE_MODE`. Copy: "21-Day Mind Challenge". Incluye share CTA en estado success.
>
> 10. `components/exercises/exercises-screen.tsx` — trigger CTA: si `CHESSCITO_LITE_MODE && shields === 0 && !hasPass` → mostrar CTA o abrir `SeasonPassSheet` directamente.
>
> **Restricciones:**
> - No modificar `usePaymentRail`, `get-peones-sheet.tsx`, `middleware.ts`, contratos.
> - No activar en Full: todo lo de Season Pass debe tener guard `CHESSCITO_LITE_MODE`.
> - No agregar Coach, PRO, Shop, Arena, Victory NFT, Labyrinth Badge.
> - Un commit atómico por paso numerado arriba.
> - Correr `pnpm exec tsc --noEmit` antes de cada commit.
> - Tests: al menos 1 test por route nueva y 1 por hook nuevo.

---

*Revisión: 2026-06-25 | GO para implementar | Correcciones técnicas documentadas*
