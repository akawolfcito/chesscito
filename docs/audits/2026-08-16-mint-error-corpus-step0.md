# Lote 2, paso 0 — el corpus del error del mint

**Fecha:** 2026-08-16 · **Tipo:** consulta de sólo lectura contra producción, **cero código**
**Runner:** `scripts/ops/read-only-query.ts` (sesión `READ ONLY` del lado del servidor)
**Estado:** ⛔ **detenido acá a propósito.** Ningún clasificador escrito hasta revisar esto.

⚠️ Ningún mensaje de acá contiene wallets, hashes ni ids: el único que traía un dump de
argumentos quedó normalizado a `0xH` en la propia consulta, antes de salir de la base.

---

## Veredicto en una línea

✅ **El corpus existe, está casi completo y es extremadamente agrupable.** Y contesta algo que
nadie preguntó: **el fallo principal del mint no es un error de cadena, es nuestro propio gate
de saldo** — el mismo que el Lote 1 acaba de instrumentar en PRO.

---

## 1. Cobertura — ¿está poblado `error`?

| `error_kind` | filas | wallets | con mensaje | % |
|---|---:|---:|---:|---:|
| `unknown` | 319 | 161 | 294 | **92,2%** |
| `revert` | 41 | 24 | 28 | 68,3% |
| `cooldownActive` | 39 | 32 | 39 | 100% |
| `insufficientFunds` | 8 | 7 | 8 | 100% |
| `expired` | 4 | 2 | 4 | 100% |
| `signingUnavailable` | 3 | 0 | 0 | 0% |

**Los 25 huecos del `unknown` son todos `NULL`, ninguno vacío, y ninguno tiene `account_ref`.**
No son un agujero de instrumentación abierto: son anteriores al arreglo.

## 2. Por qué la cobertura es tan buena — la línea de tiempo

| mes | filas de error | con mensaje |
|---|---:|---:|
| 2026-05 | 10 | 0 |
| 2026-06 | 22 | 0 |
| 2026-07 | 20 | 11 |
| **2026-08** | **362** | **362 (100%)** |

⚠️ **El arreglo del 2026-07-21 llegó ANTES del volumen, no después.** Agosto es el 87% de todos
los fallos y está cubierto entero. Era el escenario que el plan daba por menos probable.

## 3. ¿Son agrupables? Sí, brutalmente

| filas | crudos distintos | normalizados | prefijo 60 | prefijo 30 |
|---:|---:|---:|---:|---:|
| 294 | **7** | 7 | 7 | 6 |

294 filas, **7 mensajes distintos**. La normalización de hashes no cambió nada: ya colapsaban
solos. No hace falta un parser — con siete strings alcanza.

## 4. Las familias del `unknown`

| familia | filas | wallets | de dónde sale |
|---|---:|---:|---|
| **No token with sufficient balance** | 251 | **148** | **nuestro**, `use-mint-victory.ts:431` |
| Rate limit exceeded | 20 | 13 | **nuestro**, `demo-signing.ts` → 429 |
| Illegal move in transcript | 11 | 8 | **nuestro**, `api/sign-victory/route.ts:69` → 400 |
| An unknown RPC error occurred. · Permission denied | 9 | 3 | MiniPay (audit 2026-07-21) |
| Failed to fetch | 1 | 1 | red |
| `Unexpected token '<', "<!DOCTYPE "…` | 1 | 1 | una página HTML donde se esperaba JSON |
| An unknown RPC error occurred. (dump de args) | 1 | 0 | viem |

⛔ **Seis de las siete familias son NUESTRAS, no del proveedor.** La premisa del §9 —"los
proveedores no dicen nada útil"— no aplica: el que no se estaba escuchando era el propio código.

**148 de los 161 wallets del `unknown` (92%) son un único mensaje**, y es el de saldo.

## 5. El defecto de verdad: la clasificación se bifurca dentro de la misma función

`use-mint-victory.ts` clasifica el MISMO error dos veces, distinto:

```
línea 748  setClaimErrorKind(… isNoTokenBalance ? "insufficientFunds" : …)   ← lo que VE el jugador
línea 726  const errorKind = … String(classifyTxErrorKind(err))              ← lo que se MIDE
línea 763  error_kind: errorKind
```

`classifyTxErrorKind` no conoce la guarda `No token with sufficient balance`; el camino de UI sí,
y por eso el jugador **ya recibe** el CTA de cargar saldo. Lo que está roto **es sólo la medición**.

⚠️ Eso explica exactamente el número que el plan mandaba cruzar: `insufficientFunds` marcaba
**7 wallets** mientras **148** vivían en `unknown` con ese mensaje. Subcontaba **21×**.

⛔ **Y no es un clasificador nuevo: es hacer que la telemetría diga lo que la UI ya decide.**
El Lote 2 se encoge de "extender `classifyTxErrorKind` contra mensajes reales" a **eliminar una
divergencia de dos líneas en un archivo**.

## 6. Qué familia justifica un `TxErrorKind` nuevo

Regla del módulo: un `error_kind` nuevo se justifica **sólo si cambia lo que el jugador haría
después**.

| familia | ¿kind nuevo? | por qué |
|---|---|---|
| No token with sufficient balance | ⛔ **No** | `insufficientFunds` **ya existe y la UI ya lo usa**. Sólo hay que dejar de perderlo al medir |
| Rate limit exceeded | ✅ **Sí, candidato** | La acción siguiente es *esperar y reintentar* — ni cargar saldo ni volver a firmar. Hoy es indistinguible. 13 wallets |
| Illegal move in transcript | ⚠️ **Sí, pero antes hay que mirarlo** | El servidor rechazó la partida: reintentar **no puede** funcionar y hoy le ofrecemos "Try again". 8 wallets, y huele a bug nuestro, no a estado del jugador |
| Permission denied (MiniPay) | ⛔ No | Ya tiene su audit y su causa conocida. 3 wallets |
| Failed to fetch · DOCTYPE | ⛔ No | 1 wallet cada una. Ruido |

## 7. El denominador, medido en la misma corrida

| etapa | filas | wallets |
|---|---:|---:|
| `start` | 1046 | 520 |
| `error` | 414 | 213 |
| `success` | 373 | 213 |
| `cancelled` | 234 | 182 |

Error sobre desenlaces terminales: **414 / 787 = 52,6%** por filas. Por wallets, `error` y
`success` empatan en 213 — el mismo jugador falla y acierta, no son poblaciones separadas.

## 8. Lo que esto le hace al Lote 1

⛔ **148 de los 213 wallets que fallaron el mint (69%) fallaron por la misma pregunta que el
Lote 1 acaba de instrumentar en PRO**: ¿no tenían saldo, o la lectura falló?

El Lote 1 se acotó a PRO porque ahí estaba el 98,4% medido de `pro_purchase_failed`. Este corpus
dice que la MISMA incógnita gobierna el mint, que es *el producto que sí convierte*. La
instrumentación de lectura en el camino del mint pasa a ser candidata fuerte a lo siguiente —
**decisión del founder**, no la tomo yo.

## Preguntas abiertas

1. ¿Se corrige la divergencia de `error_kind` (dos líneas) como Lote 2, y se deja el resto?
2. ¿`rateLimited` entra como `TxErrorKind`, o se mide primero un mes más?
3. **"Illegal move in transcript", 8 wallets: ¿se investiga como bug?** No es un estado del
   jugador; es el servidor diciendo que la partida no valida.
4. ¿Se extiende la instrumentación de lectura de saldo al camino del mint?
