# Verificación de la auditoría de producción (2026-08-05)

Contrastado contra el código en `main` @ `7ef0c2c3`. Un veredicto por punto antes de
tocar nada.

---

## P0 — La compra nunca arranca

### Veredicto: **confirmado en el mecanismo, incompleto en la causa**

**Confirmado, línea por línea:**

- `lib/pro/use-pro-sheet-state.ts:264-270` — `handlePurchase` emite
  `pro_purchase_failed{kind:"no-token"}` y pinta `t("insufficientBalance")`
  **antes** de `pro_purchase_started`. Exacto.
- `lib/payments/use-get-peones-token-selection.ts:91-93` — una lectura fallida
  colapsa a `0n`, indistinguible de wallet vacía. Exacto.
- No hay salida: `previewErrorMessage` sólo se limpia en el próximo
  `handlePurchase` o al cerrar la hoja. El botón de reintento del bloque de error
  (`components/pro/pro-sheet.tsx:520`) está condicionado a `verifyFailedTxHash`,
  que en este camino es `null`. Cero recuperación posible. Exacto.

**Corrección 1 — no son 3 lecturas, es 1.**

`@wagmi/core@2.22.1/createConfig.js:123` fija `batch: properties.batch ?? { multicall: true }`
y `wallet-provider.tsx` no lo sobreescribe. Los tres `balanceOf` salen como **un
solo `eth_call`** contra Multicall3 en Celo. Por lo tanto:

- No existe el escenario "1 de 3 falló". O responden los tres o no responde ninguno.
- La instrumentación que pediste ("cuántas de las 3 fallaron") va a medir siempre
  0 o 3. Sigue valiendo la pena registrarlo, pero el dato que discrimina es el
  **tipo de error del transporte**, no el conteo.
- Lo bueno: `allowFailure: true` hace que viem devuelva entradas
  `{status:"failure", error}` en vez de rechazar la query. **El error está
  disponible hoy y lo estamos tirando a la basura en la línea 93.** No hace falta
  cambiar el transporte para diagnosticar.

**Corrección 2 — falta un tercer estado, y explica el volumen mejor que los otros dos.**

`handlePurchase` no mira `selection.loading`. Mientras el multicall está en vuelo,
`selection.selected` es `null` → un toque en ese instante emite `no-token`. Las
otras dos hojas del mismo rail (`get-peones-sheet.tsx:219`,
`season-pass-sheet.tsx:291`) **sí** ramifican por `selection.noPayableToken`, que
es precisamente el flag "ya cargó y no alcanza" (`:103`). La hoja de PRO es la
única de las tres que no lo usa.

1.942 eventos / 574 cuentas = **3,4 por cuenta**. Esa es la forma de alguien que
toca, ve un error, y vuelve a tocar — no la de una lectura rota que falla una vez.

**Corrección 3 — "100 % no-token" no prueba que el RPC esté roto.**

10 sesiones llegaron a `pro_purchase_started` y 3 confirmaron: el transporte
funciona al menos a veces. Y PRO cuesta **$1,99** (`rail-config.ts:193`), contra
$0,50 del pack de Peones. En MiniPay, una mayoría de wallets genuinamente no tiene
$1,99 en un solo stablecoin. Hoy las tres hipótesis —saldo real insuficiente,
lectura fallida, y toque durante la carga— producen **el mismo evento con las
mismas props**, así que los datos no pueden separarlas. Esto no invalida el
hallazgo: lo vuelve exactamente el motivo por el que tu pedido #1 (instrumentar)
va primero, y por el que no arrancaría por el transporte.

### Parche propuesto (3 commits, TDD)

**Commit 1 — contrato + salud de la lectura** (`use-get-peones-token-selection.ts`)

Tipo nuevo, exportado, testeable puro:

```ts
export type BalanceReadHealth = {
  state: "loading" | "ok" | "unreadable";
  reads: number;          // 3
  ok: number;             // 0 o 3 con multicall; el campo sobrevive si se desactiva
  /** Clase de fallo del transporte, NO el mensaje. */
  errorKind: "http" | "timeout" | "rpc" | "unknown" | null;
  httpStatus: number | null;   // 403 / 429 / 5xx cuando viem lo expone
};
```

Privacidad: se emiten **símbolos y clase de error**, jamás la dirección ni
`error.message` — los errores de viem embeben la URL del RPC y el body del
request, y ese body lleva la wallet dentro del calldata del `balanceOf`. Mapeo por
`error.name` contra una lista corta; cualquier otra cosa cae en `"unknown"`. Nada
nuevo se persiste en `analytics_events` que hoy no se persista.

Se agrega `refetchBalances()` (el `refetch` de `useReadContracts`, ya disponible).

**Commit 2 — separar los dos mensajes** (`use-pro-sheet-state.ts` + copy)

```
selection.loading            → no emitir nada, CTA en "Checking balance…"
health.state === "unreadable"→ pro_purchase_failed{kind:"balance-unreadable", …}
                               copy nueva: "No pudimos leer tu saldo" + reintentar
!selection.selected          → pro_purchase_failed{kind:"no-token", …}
                               copy actual: insufficientBalance
```

Se mantiene el nombre de evento `pro_purchase_failed` (no rompe los dashboards) y
se discrimina por `kind`, que es como ya discrimina el resto del hook (`:200-207`).
Copy nueva en `lib/content/editorial.ts` **y** `lib/content/messages/es.ts` — el
guard de traducción cubre el bundle entero.

**Commit 3 — salida de emergencia** (`pro-sheet.tsx`)

Generalizar el bloque de error: hoy el botón de reintento se muestra sólo si
`verifyFailedTxHash`. Pasa a mostrarse también con `onRetryBalance`, reusando el
mismo botón y los mismos estilos. Sin superficie nueva.

**Fuera de alcance, anotado:** `pro-sheet.tsx:453-456` — el link `pro-extend-link`
llama `props.onPurchase()` sin pasar por `resolveCta`, o sea sin el gate de
`isConnected` / `isCorrectChain`. Sólo alcanzable en estado activo. Lo arreglo si
querés, pero no es parte del P0.

---

## P1 — El transporte RPC de MiniPay

### Veredicto: **el hecho es correcto; la diferencia fue deliberada y está documentada**

`components/wallet-provider.tsx:20-23` usa `http()` pelado. Confirmado.
`lib/wallet/web-transports.ts:33-45` tiene `fallback([drpc, 1rpc, forno])` con
`timeout: 10_000`, `retryCount: 1`, `rank: false`. Confirmado.

**Sí hubo una razón, y está escrita.** `web-transports.ts:27-29`:

> *"MiniPay never touches this: it injects its own RPC and keeps its bare `http()`
> config byte-identical."*

La decisión fue: MiniPay inyecta su propio provider, así que las **escrituras** y
las lecturas que pasan por el wallet no tocan nuestro transporte; dejarlo intacto
era no arriesgar el camino que ya funcionaba mientras se agregaba la rama web.

**Pero esa razón no cubre este caso.** `useReadContracts` es una lectura de
`publicClient`, no del wallet: sale por **nuestro** transporte, o sea Forno pelado —
el mismo endpoint que ese archivo documenta devolviendo 403 bajo ráfaga. Con ~2.700
instalaciones diarias, es exactamente la ráfaga descrita. El comentario justifica
no tocar el camino de firma; no justifica que el saldo se lea por un transporte sin
respaldo.

Recomendación: aplicar `fallback()` **sólo al transporte de lectura de Celo
mainnet**, extrayendo `createWebTransports()` a un helper compartido. No se toca el
connector inyectado ni `writeContractAsync`. Es un cambio chico, pero es P1 y no P0:
sin la instrumentación del P0 no vamos a saber si movió la aguja.

---

## P2 — Riesgos del rail de pago

### Veredicto: **los cuatro confirmados**

| Hallazgo | Verificación |
|---|---|
| `use-pro-rail.ts` sin mutex | Confirmado. `use-payment-rail.ts:120,141,269-270,475` tiene `payInFlightRef`; `use-pro-rail.ts` no tiene nada equivalente. Dos toques rápidos en "Unlock PRO" → dos `transfer` firmados. |
| Receipts sin timeout/status | Confirmado. `use-pro-rail.ts:195`, `use-payment-rail.ts:421,438`. Los helpers existen (`lib/contracts/transaction-helpers.ts`) y los usan Shop, coach-mint y `use-onchain-write` — **los dos rails de pago son los únicos que no**. `assertReceiptSuccess` documenta en `:53-55` que viem resuelve receipts revertidos sin mirar `status`: hoy una tx revertida entra a `verify()` como si hubiera salido bien. |
| `publicClient?.` opcional | Confirmado. Si es `undefined`, `await undefined` resuelve y se sigue a `verify(hash)` sin ninguna confirmación. |
| PRO fuera de `treasury_payment_intents` | Confirmado en el código: `use-pro-rail.ts` va directo de `writeContractAsync` a `POST /api/verify-payment`, sin crear intent. No verifiqué las 17 filas en la base (no toqué prod). |

Costo/beneficio de llevar PRO a intents: el ciclo ya existe para el canary de Get
Peones, así que es reuso, no construcción. Lo que compra es reconciliación de pagos
huérfanos (tx confirmada + verify caído = hoy queda invisible). Lo evalúo con
número de filas cuando lleguemos al P2.

---

## P3 — Infraestructura y seguridad

### Veredicto: **el punto de rate limit está desactualizado; los otros tres, en pie**

**Telemetría / rate limit — la premisa ya no describe el código.** El batching
entró el **2026-08-03** (`lib/telemetry.ts:13-37`, "Fase 1"): 20 eventos por
request o 5 s de idle, con `sendBeacon` en unload. El header documenta el incidente
que citás ("54K requests en 12 h, 66 % de las invocaciones de Vercel") como el
problema **que este archivo ya resolvió**. Los ~74.000 eventos/día siguen siendo
74.000 filas, pero son ~1/20 de los requests. Además `route.ts:30-47` ya impone
límites de body (64 KB), de evento (8 KB) y de batch (20), todos **antes** de
construir el cliente de Supabase.

Lo que sigue faltando es un límite por origen, sí — pero el diseño correcto ahora es
otro (por `session_id` / IP sobre requests ya batcheados), y el riesgo de "perder
datos legítimos" es mucho menor del que la auditoría asume. Lo redimensiono cuando
lleguemos.

**Telemetría descartable bajo presión — ya lo es a medias.** `route.ts:275` la mete
en `afterResponse()` y responde 204 sin esperar a la base; el cliente **descarta**
los flushes fallidos y no reintenta nunca (`lib/telemetry.ts:23-36`, deliberado).
Existe además un kill switch, `NEXT_PUBLIC_TELEMETRY_ENABLED`. Lo que falta es que
la degradación sea **automática**, no manual. Eso sí es trabajo real.

**3 vistas SECURITY DEFINER.** No lo verifiqué contra la base — hace falta correr el
advisor o mirar `pg_views` en prod, y no toqué prod en esta sesión. En el repo las
migraciones que las definen están en `apps/web/supabase/migrations/` y ninguna
declara `security_invoker = on`, que es exactamente lo que dispara el aviso. Muy
probablemente cierto; lo confirmo con SQL cuando lleguemos.

**Upstash y conexiones de Supabase.** No verificados en esta sesión — son medidas
de plataforma, no del repo. La aritmética que planteás (8-12 comandos × 2.700
instalaciones) se chequea contra el bootstrap real antes de proponer qué mover.

---

## Orden que propongo

1. **P0** ahora, los 3 commits. Sin esto, cualquier cosa que hagamos en P1 es a ciegas.
2. **P2 mutex + receipts** — es el que arriesga dinero de gente real y son parches chicos.
3. **P1 transporte** — con el P0 ya midiendo, sabremos si sirvió.
4. **P3** — el rate limit hay que re-dimensionarlo contra el código post-batching.
