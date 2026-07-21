# Diagnóstico — Get Peones bloqueado + Victory mint fallando

**Fecha:** 2026-07-20, actualizado 2026-07-21
**Estado:** **Bloqueo actual identificado y probado.** Gatillo original aún abierto.
**Aviso:** una versión previa afirmaba que la causa era falta de gas (0 CELO). **Era FALSA**,
retirada en §5.1. Se conserva el registro del error a propósito.

---

## 1. Resumen ejecutivo

Son **dos problemas distintos**, no uno:

| # | Problema | Estado |
|---|---|---|
| **A** | **Deadlock del 409**: 5 intents vencidos y sin resolver bloquean *toda* compra nueva, para siempre. | ✅ Causa raíz probada |
| **B** | Victory mint falla con `error_kind:"unknown"` y sin tx en cadena. | 🔶 Acotado, falta el mensaje crudo |

**No hay dinero perdido.** No existe ninguna transferencia al Treasury por 500000.

---

## 2. Problema A — El deadlock del 409 (causa raíz probada)

### 2.1 Evidencia

`POST /api/payment-intents/get-peones` → **409** en `learn-preview` (21/07 00:03:55 GMT-5).
La UI traduce ese 409 al genérico *"Something went wrong. Please try again"*. **La compra nunca
llega a MiniPay**: muere en la creación del intent.

Estado real de la tabla `treasury_payment_intents` (consulta read-only, 21/07):

| id (corto) | created_at | expires_at | lifecycle | retry_safe | tx_hash | last_error |
|---|---|---|---|---|---|---|
| `d9351aa8` | 03:49:24 | 03:59:24 | SUBMITTING | false | null | `-1` |
| `82e5093f` | 20/07 19:58 | 20:08 | SUBMITTING | false | null | `PRE_MIGRATION_STATE_UNKNOWN` |
| `c76939e1` | 20/07 19:58 | 20:08 | SUBMITTING | false | null | `PRE_MIGRATION_STATE_UNKNOWN` |
| `c1f7977a` | 20/07 19:48 | 19:58 | SUBMITTING | false | null | `PRE_MIGRATION_STATE_UNKNOWN` |
| `90d31d3e` | 20/07 19:47 | 19:57 | SUBMITTING | false | null | `PRE_MIGRATION_STATE_UNKNOWN` |

**Los cinco están vencidos.** Ninguno tiene `tx_hash`.

### 2.2 El defecto

`apps/web/src/app/api/payment-intents/get-peones/route.ts:133-154`

```ts
.eq("wallet", wallet)
.eq("sku", GET_PEONES_CANARY_SKU)
.in("lifecycle_status", ["SUBMITTING", "SUBMITTED"])
.eq("retry_safe", false)
// ← NO hay filtro por expires_at
```

El lookup filtra por lifecycle y `retry_safe`, **pero nunca mira `expires_at`**. Un intent que
venció hace 10 minutos —o hace un día— sigue devolviendo 409 igual. **No hay TTL, no hay barrido,
no hay salida automática.** El único camino de vuelta es intervención manual en la base.

El fix anti-doble-submit (`81d0e87e`, "serialize Get Peones intent creation") protegía contra
cobrar dos veces, pero al no acotar la ventana convirtió cada fallo transitorio en un **bloqueo
permanente de la compra para esa wallet**.

> **Invariante que deja este incidente:** todo lock de pago debe tener **caducidad**. Un intent
> vencido, sin `tx_hash` y sin transferencia on-chain no puede seguir bloqueando: la protección
> anti-doble-cobro tiene que expirar sola, o se convierte en denegación de servicio.

### 2.3 Por qué es seguro desbloquear

Los 5 intents tienen `tx_hash = null` **y** §4 confirma que no hay ninguna transferencia al
Treasury por 500000. No existe riesgo de doble cobro al resolverlos: no hubo primer cobro.

---

## 3. Problema B — Victory mint

### 3.1 Evidencia (telemetría, tabla `analytics_events`)

```
04:38:52.749  victory_claim_tx  {stage:"start",  moves:7, elapsed_ms:8591}
04:38:57.158  victory_claim_tx  {stage:"error",  error_kind:"unknown"}
```

- Falla en **4.4 s**, sin transacción en la cadena.
- `POST /api/sign-victory` → **200**: la firma server-side está bien.
- `save-score` en el mismo instante → `outcome:"success"`.
- `error_kind:"unknown"` ⇒ **no** fue cancelación, ni timeout, ni fondos, ni red, ni revert conocido.

### 3.2 Hueco de observabilidad (fix de una línea)

`use-mint-victory.ts:756-761` **sí** emite el error crudo (`error: raw`), pero
`app/[locale]/arena/page.tsx:386-395` reenvía solo `stage`, `difficulty`, `moves`, `elapsed_ms`,
`has_token_id` y `error_kind` — **descarta `event.error`**. Por eso el mensaje real nunca se
guardó. Reenviarlo truncado convierte el próximo intento en diagnóstico definitivo.

---

## 4. Hecho transversal

**No existe ninguna transacción hacia el Treasury (`0xcd3837dd…`) por 500000.**
Los dos flujos mueren **antes del broadcast**. La wallet, en cambio, firma y broadcastea otras
operaciones de la app sin problema (nonce 472, 21/07 03:28, CIP-64 exitosa).

---

## 5. Hipótesis DESCARTADAS con evidencia

### 5.1 ❌ Falta de gas / `feeCurrency` — **RETIRADA**

Fue la conclusión de la primera versión. **Falsa.**

- El 21/07 03:28 una tx de la app salió **CIP-64 con `feeCurrency` inyectado por MiniPay** y
  funcionó, minutos antes de los fallos.
- `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY` **nunca** estuvo en Vercel ⇒ `getMiniPayFeeCurrency()`
  siempre devolvió `undefined` en producción y todos los rails siempre mandaron sin fee currency,
  funcionando. Nada de eso cambió.
- MiniPay/Celo permiten tx sin gas nativo por diseño. 0 CELO es normal, no un defecto.

> **Lección de método:** deduje "0 CELO ⇒ no puede pagar gas" sin comprobar si había
> transacciones saliendo. El nonce (474 vs 470) lo desmintió en **una** consulta. Consultar el
> estado real antes de razonar desde una premisa.

### 5.2 ❌ Refactor de themes rompió el wallet provider

`wallet-provider.tsx` sí fue tocado (`11a16982`, `6c868919`), pero solo se agregaron wrappers.
`WagmiProvider`, `createConfig`, connector y transports quedaron idénticos.

### 5.3 ❌ `enforceOrigin` reescrito rompió los endpoints

`11a16982` lo migró a `classifyProOriginHost`. Auditado línea por línea: equivalente. Además
`/api/sign-victory` responde 200.

### 5.4 ❌ `NEXT_PUBLIC_APP_URL=http://localhost:3002` filtrado a producción

En Vercel tiene 63 días y valor propio por ambiente; `NEXT_PUBLIC_PREVIEW_URL` no existe allí.
El `localhost:3002` quedó solo en el `.env` local del experimento con ngrok.

### 5.5 ❌ Payload del transfer / cambio de wagmi-viem / saldo insuficiente

Coincide con Codex en las dos primeras. Saldo: 526.57 `USD₮` disponibles.

### 5.6 ❌ `use-mint-victory.ts` lo rompió el refactor

No fue modificado desde el 17 de julio (`git log --since` sobre `lib/coach`, `lib/contracts`,
`lib/minipay`, `lib/wallet`). El minteo rompió sin que su código cambiara.

---

## 6. Pistas abiertas para el gatillo original (Problema B y el primer fallo de A)

1. **Códigos `MINIPAY_PERMISSION_DENIED_PRE_BROADCAST` y `MINIPAY_PROVIDER_NO_HASH`** aparecen en
   filas de la tabla (`f2533121`, `6940d35d`) pero **no existen en el código del repo**. Origen a
   confirmar: probablemente anotación manual durante la recuperación. **No tratarlos como
   generados por el sistema sin verificar.**
2. **La app corre dentro de "Mini App Test" de MiniPay** (visible en la barra del screenshot).
   Hipótesis a validar: ese harness puede restringir permisos de transacción, lo que encajaría con
   una denegación pre-broadcast en ambos flujos. **Sin confirmar.**

---

## 7. Plan propuesto (SDD → TDD → EDD) — requiere aprobación

**Paso 1 — Desbloquear (urgente, habilita todo lo demás)**
- Resolver administrativamente los 5 intents vencidos → `EXPIRED`, dejando referencia a §2.3.
- Requiere aprobación humana explícita: es una escritura en producción.

**Paso 2 — Cerrar el defecto de diseño (TDD)**
- Test rojo: un intent vencido y sin `tx_hash` **no** debe producir 409.
- Fix: acotar el lookup de §2.2 por `expires_at`, o barrer a `EXPIRED` antes de consultar.

**Paso 3 — Cerrar el hueco de observabilidad**
- Reenviar `event.error` truncado en `arena/page.tsx` (§3.2).

**Paso 4 — Smoke MiniPay**
- Un solo intento. Con 1–3 hechos, entrega el mensaje crudo del minteo y el gatillo original.

**Paso 5 — Defecto secundario ya identificado**
- `use-payment-rail.ts:371-392`: la rama `intent` manda `feeCurrency` sin el fallback que sí tiene
  la rama legacy. Asimetría no intencional; cerrarla.

---

## Anexo — scripts de diagnóstico read-only

`apps/web/scripts/query-telemetry-readonly.mjs` y `apps/web/scripts/query-intents-readonly.mjs`.
Leen `.env`, no imprimen credenciales. **Borrar al cerrar la investigación.**
