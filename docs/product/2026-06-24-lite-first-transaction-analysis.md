# Chesscito Lite — Análisis: Primera Transacción

**Fecha:** 2026-06-24  
**Rol:** Senior Product Engineer (consumer apps, MiniPay/Celo, monetización ligera)  
**Commit auditado:** `main` — `4f26019e`  
**Restricción principal:** No contaminar Lite con Full. No activar Coach, Shop completa, PRO, Peones UI, Arena, Victory NFT.

---

## Infraestructura existente relevante

Antes de evaluar opciones, el inventario técnico que Lite puede reutilizar:

| Sistema | Archivo | Estado | Reutilizable en Lite |
|---|---|---|---|
| **Payment rail** (`ERC20.transfer(treasury, amount)`) | `lib/payments/use-payment-rail.ts` | Real, fail-closed | ✅ Directo |
| **Verificación server-side** `/api/verify-payment` | `api/verify-payment/route.ts` | Real, idempotente | ✅ Solo agregar SKU |
| **Rail config + SKUs** | `lib/payments/rail-config.ts` | 1 SKU (`peones_pack_50 $0.50`) | ✅ Extendible |
| **Shields Redis** (earn/spend/balance) | `api/shields/me`, `api/shields/spend`, `api/credit-shield` | Real (Upstash) | ✅ Ya en Lite (Welcome Pack) |
| **Welcome Pack** (crédito shields en Lite) | `lib/welcome-package/use-welcome-package.ts`, `api/welcome-pack/claim/` | Real (Supabase + Redis) | ✅ Patrón reutilizable |
| **Stablecoins aceptados** | `lib/contracts/tokens.ts` | USDC/cUSD/USDT (USDm ❌ no configurado) | ✅ |
| **MiniPay detection** | `lib/minipay.ts`, `isMiniPayEnv()` | Real | ✅ |
| **feeCurrency MiniPay** | `lib/contracts/chains.ts:getMiniPayFeeCurrency()` | Real | ✅ |
| **Idempotencia anti-replay** | `rail-config.ts:buildPaymentIdempotencyKey()` | Real (`source:chainId:txHash:logIndex`) | ✅ |
| **Supabase peones ledger** | `api/peones/earn/route.ts` | Real | ✅ (silencioso en Lite) |

**Bloqueador actual del rail de pagos:** `CHESSCITO_TREASURY_ADDRESS=X` en `.env` prod/testnet → el API retorna `503 rail_not_configured` antes de tocar nada. Activar cualquier opción de pago requiere configurar este address en Vercel.

---

## Tabla comparativa — 10 opciones

| # | Opción | Fit Lite | Fit MiniPay | Viralidad | Complejidad técnica | Riesgo contaminar Lite | Archivos necesarios | Tiempo relativo | Recomendación |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Streak Shield Pack** | ✅✅ Alto | ✅✅ Directo | Bajo–Medio (utilidad personal) | Bajo — 1 SKU nuevo + 1 sheet | Mínimo — shields ya existen en Lite | `rail-config.ts`, `verify-payment/route.ts`, `<ShieldRefillSheet>` (nuevo) | **Bajo** | ✅ **Implementar hoy** |
| 2 | **Daily Mind Pass** | ✅ Alto | ✅ Directo | Bajo (suscripción personal) | Medio — entitlement con expiración | Bajo si NO toca PRO | `rail-config.ts`, nuevo SKU, tabla `daily_passes` Supabase o Redis TTL | Medio | Roadmap corto |
| 3 | **Challenge a Friend** | ⚠️ Parcial | ⚠️ Necesita escrow | ✅✅ Alto (viral) | Alto — contrato escrow o custodial trust | Bajo (nueva superficie) | Contrato nuevo, `api/challenge/`, UI match | Alto | Descartar ahora |
| 4 | **Sponsor a Puzzle** | ✅ Bueno | ✅ Directo | Medio (bien público) | Medio-Alto — pool tracking + gate de puzzle | Bajo | Pool table en Supabase, UI de sponsorship | Medio-Alto | Roadmap largo |
| 5 | **Unlock Today's Labyrinth** | ✅✅ Alto | ✅ Directo | Bajo | Bajo-Medio — 1 SKU + entitlement local/Redis | Mínimo | `rail-config.ts`, SKU, `labyrinth-access` Redis key | Bajo | Roadmap corto |
| 6 | **Proof of Practice Badge** | ✅✅ Alto | ✅ Directo | ✅✅ Alto (compartible) | Medio — badge contract o adaptar sign-badge | Bajo | `sign-badge/route.ts` adaptado, UI badge minting | Medio | Roadmap corto (fuerte candidato post-#1) |
| 7 | **Focus Sprint Entry** | ✅✅ Alto | ✅ Directo | Medio (FOMO/reto) | Medio — tracking de sprint 7 días, entitlement | Bajo | SKU nuevo, tabla `sprint_entries`, UI entry | Medio | Roadmap corto |
| 8 | **Gift a Habit Pack** | ✅ Bueno | ✅ Directo (cash link) | ✅✅ Alto (regalo viral) | Medio — gift link generado, claim flow | Bajo | `api/gift/`, gift link storage, claim UI | Medio | Roadmap corto |
| 9 | **Community Goal / Pool** | ✅ Bueno | ⚠️ Necesita contrato pool | ✅✅ Alto | Alto — contrato + revelation + tracking | Bajo | Contrato nuevo, pool API, progress UI | Alto | Descartar ahora |
| 10 | **Lite Founder Supporter** | ✅ Bueno | ✅ Directo | Bajo | Bajo — SKU simple + stamp/badge | Mínimo | `rail-config.ts`, 1 SKU, `<FounderStamp>` (similar WelcomePackageStamp) | **Bajo** | Roadmap corto (demo alternativa) |

---

## Opción #1 recomendada: **Streak Shield Pack**

### Por qué esta y no otra

**Evidencia técnica directa:**

1. Shields ya tienen backend real en Lite: `api/shields/me` (Redis), `api/shields/spend` (lua atómica), `api/credit-shield` (earn).
2. El Welcome Pack ya acredita shields en Lite via `api/welcome-pack/claim/` — el patrón post-tx está probado.
3. `usePaymentRail` hace `ERC20.transfer(treasury, amount)` — funciona en MiniPay sin approve, sin contrato propio.
4. Solo necesita 1 nuevo SKU en `rail-config.ts` y que `/api/verify-payment` lo reconozca (mismo patrón que `peones_pack_50`).
5. El entitlement (shields en Redis) no toca Peones UI, PRO, Coach, Arena, Shop completa, Victory NFT.

**Por qué Streak Shield Pack tiene sentido con hábitos mentales:**
> "Perdiste la racha de 7 días. ¿Quieres proteger el progreso de hoy por $0.25?" — ese momento de frustración + utilidad inmediata es la motivación más honesta para una primera transacción.

**Duolingo lo valida:** Streak Freeze es el microtransacción más convertidor de Duolingo precisamente porque el usuario ya está en modo "no quiero perder esto". Chesscito Lite tiene el mismo loop: Focus Passport + daily habit + riesgo de perder la racha.

---

## Arquitectura mínima

```
[Exercises — fail screen en Lite, shields=0]
         ↓
<ShieldRefillSheet open={true}>
         ↓
usePaymentRail({ sku: "shields_pack_3", tokenSymbol: "USDC" })
         ↓
ERC20.transfer(treasury, $0.25) — MiniPay nativo
         ↓
/api/verify-payment  (nuevo SKU handler)
         ↓
/api/credit-shield (credita +3 en Redis)
         ↓
shields actualizados → UI muestra "3 shields added"
```

**Sin nuevos contratos. Sin nuevas tablas DB. Sin lógica nueva en el frontend de shields.**

---

## Datos / entitlement a guardar

| Dato | Dónde | Por qué |
|---|---|---|
| Shields acreditados | Redis: `chesscito:shields:{wallet}` (ya existe) | Fuente de verdad actual para shields en Lite |
| Registro de la tx | `peones_ledger` (fuente `pack_purchase`) o tabla nueva `shield_purchases` | Anti-replay + historial |
| Idempotency key | `pack_purchase:{chainId}:{txHash}:{logIndex}` (ya existe en `buildPaymentIdempotencyKey`) | Previene doble crédito |
| Wallet | Normalizada lowercase (ya normalizada en ledger service) | Consistencia |

**Preferencia**: usar `peones_ledger` con source `shield_pack_purchase` (nuevo source type) en lugar de tabla nueva. Minimiza superficie DB. Alternativa: tabla separada `shield_purchases` si se quiere separar cuentas.

---

## UI mínima

```
ShieldRefillSheet (bottom sheet, Lite-only)
├── Header: "Protect your streak"
├── Reward visual: 3 escudos + brillo ámbar (misma clase CSS que GetPeonesSheet)
├── Price: "$0.25 USDC" — token auto-seleccionado (USDC → USDT → cUSD)
├── AddCashCta (solo si MiniPay + saldo insuficiente, ya existe)
├── PrincipalButton: "Get 3 Shields" (ya existe)
└── Cancel link (ya existe en GetPeonesSheet)
```

**Puede ser 80% código copiado de `get-peones-sheet.tsx`** con cambios de SKU, copy e ícono.

**Trigger:** cuando `phase === "failure"` + `shields === 0` + `CHESSCITO_LITE_MODE` → abre automáticamente.

---

## Validaciones de seguridad

| Riesgo | Mitigación | Evidencia código existente |
|---|---|---|
| **No acreditar sin tx verificada** | `/api/verify-payment` hace `client.getTransactionReceipt` antes de cualquier crédito | `api/verify-payment/route.ts:~145` |
| **No reusar txHash** | `buildPaymentIdempotencyKey(source:chainId:txHash:logIndex)` + UNIQUE en DB | `rail-config.ts:129` |
| **No confiar en localStorage para economía** | Shields viven en Redis server-side, nunca en localStorage. El cliente NO puede decrementar sin pasar por `api/shields/spend` | `api/shields/spend/route.ts` — Lua atómica |
| **Overpay** | Aceptado pero solo acredita el nominal (ya configurado `RAIL_OVERPAY_ACCEPTED=true`) | `rail-config.ts:89` |
| **Treasury no configurada** | Fail-closed: `getTreasuryAddressServer()` retorna null → 503 antes de tocar DB | `api/verify-payment/route.ts:~104` |
| **Wallet spoof** | Server verifica el `from` del Transfer log contra el wallet enviado en body | `verify-transfer.ts` (fromWallet comparison) |
| **Race condition doble-crédito** | Idempotency pre-check + catch 23505 con re-query | `api/verify-payment/route.ts:~167,~212` |
| **Rate limiting** | `enforceReadRateLimit(ip)` + `enforceOrigin(req)` en todas las rutas | `api/verify-payment/route.ts:~99` |

---

## Plan de implementación — pasos pequeños

### Paso 0 — Prerequisito (configurar treasury en Vercel Lite)
- Ir a Vercel → Chesscito Lite project → Environment Variables
- Setear `CHESSCITO_TREASURY_ADDRESS` y `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` con la dirección real del safe owner
- Sin este paso, nada del rail funciona

### Paso 1 — Nuevo SKU en rail-config
- `lib/payments/rail-config.ts`: agregar `shields_pack_3` al tipo `PeonesPackSku` (o crear nuevo union type `LitePackSku`)
- Price: `250_000n` ($0.25, 6 decimals), reward: 3 shields
- Source: `shield_pack_purchase` (nuevo, agregar a tipos ledger)

### Paso 2 — Extender `/api/verify-payment` para nuevo SKU
- Mismo handler, el `sku in PEONES_PACKS` check falla para el nuevo SKU → mover a un map unificado o agregar branch
- Después de verificar la tx: llamar a `api/credit-shield` internamente (o inline la lógica Redis `INCRBY 3`)
- Retornar `{ ok: true, shieldsCredited: 3, newShieldBalance: N }`

### Paso 3 — `<ShieldRefillSheet>` (nuevo componente Lite-only)
- Copiar estructura de `get-peones-sheet.tsx` como base
- Cambiar: SKU, copy ("Protect your streak"), ícono de escudo, reward visual
- Usar `usePaymentRail` con el nuevo SKU (reutilizar hook sin cambios)
- Token auto-seleccionado: reusar `useGetPeonesTokenSelection` o simplificarlo para shields

### Paso 4 — Trigger desde exercise fail screen
- En `exercises-screen.tsx`: cuando `phase === "failure" && shields === 0 && CHESSCITO_LITE_MODE` → estado local `shieldRefillOpen: true`
- Montar `{CHESSCITO_LITE_MODE && <ShieldRefillSheet open={...} onSuccess={() => { /* refresh shields */ }} />}`

### Paso 5 — Post-success: refrescar shields UI
- `onSuccess()` del sheet → invalidar query de `api/shields/me` (o disparar evento local)
- Shields actualizados → usuario puede usar rescue inmediatamente

### Paso 6 — Tests
- Unit: `rail-config.ts` — nuevo SKU parseado correctamente
- Unit: `verify-payment` handler — crédita shields, idempotente en replay
- Integration: shield balance sube +3 después de tx verificada
- Smoke: en MiniPay 390px — selección USDC, firma, crédito visible

---

## Archivos a modificar / crear

| Archivo | Acción | Scope |
|---|---|---|
| `lib/payments/rail-config.ts` | Agregar SKU `shields_pack_3`, type union | Compartido (sin UI) |
| `lib/peones/types.ts` | Agregar `shield_pack_purchase` a `PeonesLedgerSource` | Compartido (sin UI) |
| `app/api/verify-payment/route.ts` | Branch para SKU shields, crédito en Redis post-verify | Server |
| `app/api/credit-shield/route.ts` | Revisar si soporta llamada interna o adaptar | Server |
| `components/payments/shield-refill-sheet.tsx` | Nuevo componente Lite-only | Lite |
| `components/exercises/exercises-screen.tsx` | Agregar trigger ShieldRefillSheet cuando `shields=0 + fail` | Lite (guard `CHESSCITO_LITE_MODE`) |

---

## Variables de entorno requeridas

| Variable | Dónde | Descripción |
|---|---|---|
| `CHESSCITO_TREASURY_ADDRESS` | Vercel Lite (server) | Dirección treasury para verificación server-side |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | Vercel Lite (client) | Misma dirección para que el rail client no falle |
| `NEXT_PUBLIC_USDC_ADDRESS` | Ya en Vercel | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` en mainnet |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Ya en Vercel (shields ya usan Redis) | Shields backend |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Ya en Vercel | Registro de compra en ledger |

---

## Checklist de prueba en MiniPay

- [ ] Abrir Chesscito Lite en MiniPay mobile (390px)
- [ ] Completar ejercicio → forzar fallo hasta shields = 0
- [ ] Verificar que `<ShieldRefillSheet>` abre automáticamente
- [ ] Confirmar que se muestra "Get 3 Shields — $0.25 USDC"
- [ ] Confirmar auto-selección de token (USDC si tiene balance, fallback cUSD)
- [ ] Tap "Get 3 Shields" → MiniPay abre confirmation dialog
- [ ] Confirmar tx en MiniPay → esperar receipt
- [ ] Verificar que el backend acredita +3 shields (llamar `api/shields/me`)
- [ ] Intentar repetir con mismo txHash → debe retornar `duplicate: true`, no doble crédito
- [ ] Verificar que shield se puede gastar inmediatamente en rescue
- [ ] Probar con saldo USDC insuficiente → `<AddCashCta>` debe aparecer (deeplink MiniPay)
- [ ] Probar fuera de MiniPay (MetaMask/Celo) → rail debe funcionar igual
- [ ] Verificar que en Chesscito Full NO aparece el sheet de shields Lite (guard correcto)
- [ ] Confirmar que treasury `=X` → sheet muestra "coming soon" / stay fail-closed

---

## Por qué descartar #3 y #9 ahora

**Challenge a Friend (#3)**: Requiere un contrato de escrow o un modelo de custodial trust. Cualquier escrow tarda semanas en auditarse. Sin él, el diseño crea un riesgo de fondos atascados. El viral es real pero el costo técnico es 5x.

**Community Goal / Pool (#9)**: Mismo problema. Un pool on-chain sin contrato auditado es una promesa que no se puede cumplir. Off-chain es posible pero el tracking de goal-vs-contributions agrega complejidad sin precedente en el codebase.

---

## Candidatos para roadmap corto (post Streak Shield Pack)

1. **#6 Proof of Practice Badge** — el viral más alto sin contrato nuevo. Adaptar `sign-badge` para emitir un badge de racha (7 días consecutivos = minteable). Compartible en social.
2. **#8 Gift a Habit Pack** — regalar 3 shields a un amigo vía cash link. El viral de "regalo" convierte más que la utilidad personal. Requiere diseñar un gift link (UUID en Supabase, claim por cualquier wallet).
3. **#5 Unlock Today's Labyrinth** — si los laberintos tienen un límite diario en Lite, cobrar $0.10 por extra unlock es la opción más contextual después de shields.
