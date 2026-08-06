# Verificación de `cruce-local.mjs` contra el código de producción

**Fecha:** 2026-08-05 · **Commit auditado:** `7ef0c2c3` · **Script:** externo al repo

Pedido: verificar `accountRef()` contra `apps/web/src/lib/analytics/account-ref.ts`
antes de correr el cruce, para descartar de entrada un "cruce cero" que parezca hallazgo.

---

## 1. Veredicto sobre `accountRef()`: IDÉNTICA ✅

`apps/web/src/lib/analytics/account-ref.ts:28` vs. la del script, eje por eje:

| Eje | Canónica | Script | |
|---|---|---|---|
| Algoritmo | `createHmac("sha256", secret)` | igual | ✅ |
| Clave | `TELEMETRY_ACCOUNT_SECRET` | igual (env) | ✅ |
| Casing | `.update(address.toLowerCase())` | igual | ✅ |
| Prefijo | `0x` incluido en el input | igual | ✅ |
| Truncado | `.digest("hex").slice(0, 32)` | igual | ✅ |

Las tres guardas que la canónica tiene *adentro*, el script las tiene *afuera* —
equivalentes en efecto:

- `if (!secret) return null` → el script sale con `exit 1` si falta el env.
- `ADDRESS_RE` → el caller filtra con `/^0x[0-9a-f]{40}$/` sobre la address ya
  lowercased, y además cuenta los descartes en `anonimizadas`.
- El doble `.toLowerCase()` (caller + `accountRef`) es inofensivo.

**Golden vector** para hard-assertear al arrancar (mismos valores que
`__tests__/account-ref.test.ts:4`):

```js
accountRef("0xAbC0000000000000000000000000000000000001")  // con SECRET="test-secret-not-a-real-one"
// === "2d56169f2de1638926a4c9012ce587c8"
```

Si esa igualdad falla, abortar antes de tocar nada.

## 2. El lado de la query: nombres correctos ✅

- Tabla `analytics_events` y columnas `account_ref` / `props` — `api/telemetry/route.ts:190-195,277`.
- `minipay_add_cash_click` — `components/minipay/add-cash-cta.tsx:37`
- `pro_purchase_confirmed` — `lib/pro/use-pro-sheet-state.ts:157`
- `pro_purchase_failed` con `kind:'no-token'` — `lib/pro/use-pro-sheet-state.ts:267`
- `props.kind` sobrevive `sanitizeProps` (es string) — `route.ts:141-143`
- `account_ref` sólo se puebla con wallet conectada (`lib/analytics/account.ts:20`),
  así que `where account_ref is not null` es correcto, pero el denominador **no** es
  "todos los que vieron el error": es "todos los que lo vieron con wallet conectada".

El cruce va a matchear. Los problemas son de interpretación, no de derivación.

---

## 3. Cuatro defectos que SÍ van a producir una conclusión falsa

### P0 — `no-token` NO significa "saldo insuficiente"

`handlePurchase` dispara `no-token` con `!selection.selected`
(`use-pro-sheet-state.ts:266`), y `selected` es null en **tres** situaciones distintas
(`lib/payments/use-get-peones-token-selection.ts:88-103`):

1. Ningún token con balance ≥ precio → saldo insuficiente real.
2. **Los balances todavía están cargando.** El hook expone `noPayableToken`, que sí
   guarda contra `!loading` (línea 103) — pero `handlePurchase` chequea
   `!selection.selected`, no `noPayableToken`. Un tap durante la carga emite `no-token`.
3. **Una lectura `balanceOf` que falló.** `allowFailure: true` y un read fallido
   cuenta como `0n` (líneas 89-93). Una wallet con fondos parece vacía.

Esto es exactamente el fenómeno que el script persigue: la fila "SÍ tenían ≥ $1.99 →
defecto real del checkout" mezcla el defecto de checkout con RPC flaky y con taps
apurados. Los tres son bugs, pero no el mismo bug ni el mismo arreglo.

### P0 — `total_usd` (suma) no es el criterio que usa el checkout (máximo por token)

`selectPayableToken` necesita **un solo token** con balance ≥ precio. El CSV suma.
Una wallet con $1.00 cUSD + $1.00 USDT da `total_usd = $2.00 ≥ $1.99` y el script la
cuenta como "defecto real del checkout" — cuando el rechazo fue correcto. Exportá el
balance **por token** y compará contra el máximo, no contra la suma.

### P1 — `totalUsd()` asume exactamente 6 decimales

Saca `.`/`,` y divide por 1e6. `"1.990000"` → 1.99 ✅. Pero `"1.99"` → `"199"` →
**$0.000199**. Un CSV exportado con 2 decimales manda a todos al tramo "menos de
$0.10" y el output concluye "ningún precio los alcanza" — lo opuesto a la verdad, sin
un solo error en pantalla. Además `/^\d+$/` rechaza negativos y notación científica,
y ese `continue` ocurre **antes** de `direcciones++`: descarte silencioso que no
aparece en ningún contador.

### P1 — Sección C: el denominador incluye a quien nunca abrió el checkout

`podian = eventos.filter(e => balPorRef.has(e.ref) && bal(e) >= P)` — pero `eventos`
incluye cuentas cuyo único evento fue `minipay_add_cash_click`. La etiqueta dice
"tocaron el flujo" y el paréntesis promete "intentaron Y podían pagar", pero el filtro
no exige haber intentado. Conversión sub-reportada. Debería llevar
`&& (e.rechazos > 0 || e.confirmadas > 0)`.

---

## 4. Orden sugerido

1. Agregar el golden vector como assert de arranque (barato, cierra la pregunta original).
2. Exportar balances **por token**, no `total_usd`, y comparar contra el máximo.
3. Separar el tramo "tenían el saldo" del ruido de carga/RPC antes de llamarlo
   defecto de checkout — o al menos rotular la fila como cota superior.
4. Arreglar el denominador de la sección C y el parseo decimal.
