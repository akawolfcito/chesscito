# Auditoría del flujo de compra de Peones

> **Read-only.** No se cambió código, datos ni configuración. SQL vía
> `scripts/ops/read-only-query.ts` (read-only forzado en servidor).

---

## Executive summary

```
Peons purchase works:        YES
Median end-to-end latency:   NOT MEASURABLE — el flujo no emite un solo evento
p95 latency:                 NOT MEASURABLE
Regression detected:         INCONCLUSIVE (causa probable identificada)
Likely bottleneck:           firma de MiniPay + waitForTransactionReceipt,
                             ejecutados EN SERIE con el verify de backend
Unique buyers:               14
Successful purchases:        27
Smallest observed purchase:  5 Peones ($0.05) — 5 compras, UNA sola wallet
Most common purchase amount: 50 Peones — 22 de 27 compras (81 %)
Technical failure rate:      NOT MEASURABLE (no hay eventos de fallo del flujo)
Double-credit risk:          NONE — verificado empíricamente
Measurement confidence:      HIGH para compras · LOW para latencia y fallos
```

⛔ **El hallazgo que domina el informe: `get-peones-sheet.tsx` no emite NI UN
evento de analytics.** Cero llamadas a `track()`. Las preguntas 2, 5 y 6 de tu
pedido — latencia, conversión y tasa de fallo — **no son respondibles hoy**, y no voy
a estimarlas con logs que miden otra cosa.

---

## §1 · Flujo real, paso a paso

Reconstruido de `use-payment-rail.ts` + `get-peones-sheet.tsx`.

```
[ CLIENTE ]  usuario elige monto (5–100, de a 5)   ← clampPeonesAmount
     │       useGetPeonesTokenSelection lee balances de USDC/USDT/cUSD
     │       vía useReadContracts  ────────────────────────────► [ RPC Celo ]
     │       selectPayableToken() elige el primero que ALCANCE
     ▼
  Pay $X   →  payInFlightRef bloquea reentradas
     │
     ├─ setPhase("preparing")
     │   └─ ⚠️ SOLO si el canary está ON (hoy OFF):
     │        POST /api/payment-intents/get-peones  ──► [ API + Supabase ]
     │        POST reportSubmission SUBMITTING      ──► [ API + Supabase ]
     │
     ├─ setPhase("awaiting_signature")
     │   └─ writeContractAsync(transfer + sufijo ERC-8021) ──► [ MiniPay / wallet ]
     │        ⏱ MEDIDO EN OTRO FLOW: p50 8.400 ms · p95 19.328 ms
     │
     ├─ setPhase("pending_tx")
     │   └─ await waitForTransactionReceipt(hash)  ──► [ RPC Celo / blockchain ]
     │        ⏱ NO MEDIDO. Block time de Celo ≈ 5 s
     │
     ├─ setPhase("verifying")
     │   └─ await fetch(verify)  ──► [ API → RPC → Supabase ]
     │        ⏱ NO MEDIDO. Con backoff [1000, 3000, 8000] ms si falla
     │
     └─ setPhase("success") → onVerified() → refetch de balance → UI
```

| Capa | Pasos |
| --- | --- |
| **Client-side** | selección de monto, `selectPayableToken`, máquina de fases, bloqueo de reentrada |
| **RPC / blockchain** | lectura de balances, firma, **espera de receipt** |
| **API / backend** | verify (y, con canary, intent + 2 reportes de submission) |
| **Supabase** | `peones_ledger` (acreditación), `treasury_payment_intents` (solo canary) |
| **Redis** | no participa en este flujo |
| **Externo** | MiniPay como wallet provider |

**El canary está OFF en producción** (`GET_PEONES_TREASURY_CANARY_ENABLED` solo
aparece en tests; `treasury_payment_intents` tiene 24 filas, todas entre 07-01 y
07-21). Con él apagado el rail legacy no hace ninguna llamada HTTP antes de firmar.

---

## §2 · Latencia — NO MEDIBLE, y por qué

**No existe instrumentación del flujo de Peones.** Los únicos flows con
`tx_progress_done` son:

| flow | n | p50 | p75 | p95 | máx |
| --- | ---: | ---: | ---: | ---: | ---: |
| `save-score` | 5.913 | 23 ms | 73 ms | 295 ms | 15.273 ms |
| `mint-victory` | 22 | 6 ms | 7 ms | 7 ms | 7 ms |

**No hay `shop-buy`, `peones-buy` ni equivalente.** El componente `TxProgressSteps`
tampoco se monta en `get-peones-sheet.tsx` (verificado contra el catálogo de
consumidores).

### Lo único medido que sirve de referencia

Del breakdown de `save-score`, que **comparte la wallet pero no el flujo**:

| step | n | p50 | p95 | máx |
| --- | ---: | ---: | ---: | ---: |
| `sign` | 224 | **8.400 ms** | 19.328 ms | 82.776 ms |
| `wait` | 391 | 286 ms | 3.516 ms | 13.126 ms |

⚠️ **Esto NO es la latencia de comprar Peones.** Es evidencia de que la firma de
MiniPay tarda ~8 s de mediana en este entorno. Lo cito como referencia del orden de
magnitud, no como medición del flujo auditado.

### Estimación estructural (no medición)

```
firma MiniPay        ~8 s   (medido en otro flow)
waitForTransactionReceipt  ~5 s   (block time de Celo, NO medido)
verify backend        ~1 s   (NO medido; hasta +12 s con backoff)
                     ──────
                     ~14 s en el camino feliz
```

**Lo declaro como estimación estructural derivada del código, no como dato.**

---

## §3 · ¿Hay regresión? — INCONCLUSIVE

**No puedo confirmar una regresión objetiva porque nunca hubo instrumentación:** no
existe un "antes" medido contra el cual comparar. Lo que sí puedo hacer es auditar
qué entró al camino crítico y cuándo.

| Fecha | Commit | ¿Suma espera al camino crítico? |
| --- | --- | --- |
| 2026-06-09 | `59ca62a2` hook original | **`waitForTransactionReceipt` YA ESTABA ACÁ** |
| 2026-06-11 | `fd6c7860` backoff de verify | ⚠️ Sí, pero **solo cuando el verify falla** |
| 2026-06-30 | `e5b4e616` canary foundation | ⚠️ 2 requests HTTP — **inactivo en prod** |
| 2026-07-20 | `d0eed70e` hardening de recovery | Toca el receipt; camino de error |
| 2026-07-20 | `485f5f7c` diagnostics MiniPay | Solo con canary ON |
| 2026-07-21 | `58351af6` celebración del pack | UI post-éxito |
| **2026-08-21** | `59e9d276` compra flexible 5–100 | Cambia monto/SKU, no la secuencia |
| **2026-08-21** | `4029339d` atribución ERC-8021 | ❌ **Descartado** — ver abajo |

### La atribución ERC-8021 está descartada como causa

Es un **data suffix memoizado** (`attribution.ts`): función pura, sin red, sin
cómputo por transacción. Cambia el calldata, no el tiempo. El único efecto plausible
sería una estimación de gas marginalmente distinta en la wallet.

### Causa más probable de la lentitud percibida

⛔ **`waitForTransactionReceipt` y `verify` corren EN SERIE, y siempre corrieron
así.** El usuario espera la confirmación on-chain COMPLETA antes de que el backend
empiece a verificar, y sólo después ve el crédito.

**Mi hipótesis sobre por qué se siente más lento ahora y antes no:** la percepción
cambió con `59e9d276` (2026-08-21). Antes comprabas **50 Peones por $0.50**; ahora
comprás **5 por $0.05**. La espera es la misma, pero la recompensa es 10× menor —
**14 segundos por 50 Peones se toleran; por 5 Peones, no.** No es una regresión de
código: es que el mismo costo temporal ahora compra mucho menos.

Es una hipótesis y la declaro como tal. **Sin instrumentación no se puede cerrar.**

### Espera serial que podría paralelizarse

`verify` recibe el `txHash` y vuelve a consultar la cadena. Hoy espera al receipt
primero. Un backend que acepte el hash y verifique por su cuenta permitiría
acreditar optimistamente y confirmar después — **pero eso es diseño, no auditoría.**

---

## §4 · Funnel histórico — fuente canónica `peones_ledger`

**Uso analytics sólo como complemento**, según pediste. La verdad de una compra
acreditada es la fila del ledger.

### Compras reales

| source | entries | wallets | Peones | primera | última |
| --- | ---: | ---: | ---: | --- | --- |
| `pack_purchase` | **27** | **14** | 1.125 | 2026-06-09 | **2026-08-25** |

*(el resto del ledger es Peones ganados: `welcome_pack` 7.101, `daily_tactic` 1.674,
`exercise_completion` 568 — no son compras)*

### Distribución de montos

| Peones | compras | wallets | primera | última |
| ---: | ---: | ---: | --- | --- |
| **50** | **22 (81 %)** | 14 | 2026-06-09 | 2026-08-17 |
| **5** | 5 | **1** | 2026-08-21 | 2026-08-25 |

⛔ **Las 5 compras de 5 Peones son de UNA sola wallet: la tuya, probando.** La compra
flexible tiene **cero usuarios reales** en sus 4 días de vida.

### Recompra

| compras por wallet | wallets |
| ---: | ---: |
| 1 | 9 |
| 2 | 4 |
| **10** | **1** |

| row_tag | compras | Peones | primera | última |
| --- | ---: | ---: | --- | --- |
| **`8200fe9b`** | **10** | 275 | 2026-07-09 | **2026-08-25** |
| `8b7dcd1a` · `0304da9c` · `b5a39139` · `26a7a5bc` | 2 c/u | 100 c/u | — | — |
| 9 wallets más | 1 | 50 | — | — |

🔥 **`8200fe9b` es el mismo row_tag del líder del reto de 21 días.** Ese usuario tiene
10/21 Focus Days, PRO, 10 compras de Peones y actividad hoy. **Es, con diferencia, el
usuario más valioso del producto** — y aparece en el tope de las dos auditorías
independientes de esta semana.

### Por semana

| semana | compras | wallets | Peones |
| --- | ---: | ---: | ---: |
| 2026-07-20 | 7 | 3 | 350 |
| **2026-08-03** | **10** | **9** | 500 |
| 2026-08-17 | 5 | 2 | 70 |
| 2026-08-24 | 1 | 1 | 5 |

El pico coincide con la llegada de usuarios (03-08). Después cae.

### Lo que NO se puede segmentar

| Pedido | Estado |
| --- | --- |
| Precio ($0.05 / $0.10 / …) | ❌ El ledger guarda **Peones, no precio**. Derivable sólo por la tabla de SKU |
| Token usado (USDC/USDT/cUSD) | ❌ **No se registra** en `peones_ledger` |
| País | ❌ No está en el ledger, y analytics no tiene eventos de este flujo |
| Cambios de cantidad | ❌ Sin instrumentación |
| Abandono | ❌ Sin instrumentación |

---

## §5 · Conversión — NO MEDIBLE

El embudo que pediste (`shop opened → amount selected → pay clicked → payment started
→ success → credited`) **sólo tiene visible el último paso**.

Lo único adyacente que existe:

| evento | events | installs |
| --- | ---: | ---: |
| `monetization.shop_item_view` (item 6 = PRO) | 1.458 | 729 |
| `minipay_add_cash_click` | 944 | 824 |
| `play_hub_shop_tap` | 659 | 419 |

⚠️ `monetization.shop_item_view` es **item_id 6, que es PRO**, no Peones. Y
`minipay_add_cash_click` (824 installs) es la señal de "no tengo saldo" — no de
intención de comprar Peones.

**No hay forma honesta de calcular conversión de esta compra hoy.**

---

## §6 · Fallos e idempotencia

### Idempotencia — **GARANTIZADA, y verificada**

| Verificación | Resultado |
| --- | ---: |
| Entradas de `pack_purchase` | 27 |
| `idempotency_key` distintas | **27** |
| Posibles duplicados | **0** |
| Filas sin clave | **0** |
| `attestation_hash` repetidos | **0** |

**Ninguna transacción se acreditó dos veces.** La garantía es estructural
(`idempotency_key` + `attestation_hash` por fila), no accidental. `peones_earned`
además lleva un flag `duplicate` en sus props.

**Riesgo de doble crédito: NINGUNO.**

### Fallos — no medibles en este flujo

El rail define razones de error (`intent_creation_failed`, `intent_mismatch`,
`submission_report_failed`, `verification_pending`, `unknown_submission_state`,
cancelación de usuario) **y no emite ninguna a analytics**.

Los eventos de fallo que sí existen son de OTROS flujos:
`pro_purchase_failed` (3.536 / 1.059 installs), `peones_spend_failed` (35),
`peones_spend_blocked` (267). **Ninguno cubre la compra.**

⚠️ Recordatorio de la auditoría anterior: `score_save_failed` acumula 2.332 eventos
en 32 installs, con 1.871 de un solo install. Es otro flujo, pero muestra que cuando
sí hay instrumentación de fallo, aparecen loops que nadie sospechaba.

---

## §7 · UX de la espera

| Pregunta | Respuesta |
| --- | --- |
| ¿Cuándo empieza el loading? | Al tocar Pay: `isBusy` cubre `preparing`, `awaiting_signature`, `pending_tx`, `verifying` |
| ¿Feedback de progreso? | **Sí, textual por fase** — el sheet distingue las cuatro |
| ¿Botón bloqueado? | **Sí.** `payInFlightRef` + `retryBlockedRef` impiden reentrada |
| ¿Doble tap posible? | **No** |
| ¿Diferencia "pagando" de "acreditando"? | **Sí**: `pending_tx` vs `verifying` son fases distintas |
| ¿Puede quedar esperando con el pago hecho? | ⚠️ **Sí.** `verification_pending` existe justo para eso: la tx entró y el verify no resolvió |

**Dónde se siente lento:** `pending_tx` es la fase más larga (espera de bloque en
Celo) y es la que menos puede acelerarse desde el cliente. El backoff
`[1000, 3000, 8000]` puede sumar **12 s adicionales** sin que la UI explique que está
reintentando.

---

## §8 · Relación con `no-token`

**Son dos caminos SEPARADOS.**

| | Compra de Peones | PRO |
| --- | --- | --- |
| Hook | `useGetPeonesTokenSelection` | `useStablecoinTokenSelection` |
| Lógica | `selectPayableToken()` — elige el primer token que **alcance** | idem, otro hook |
| Emite `no-token` | **No** | **Sí** (`use-pro-sheet-state.ts:275`) |

**Los hallazgos de `ops:no-token` NO se aplican directamente a esta compra**, y el
motivo es la parte interesante:

`ops:no-token` midió que **95 de 166 intentos tienen USDT por debajo del precio** —
de **$1.99**. Para **$0.05**, la enorme mayoría de esos saldos **sí alcanza**.

⛔ **Esto convierte a la compra de Peones en el experimento exacto que la auditoría
anterior pedía**: si el bloqueo es el precio y no la billetera, este flujo debería
convertir donde PRO no convierte. Ya funciona. Lo que falta es exponerlo y medirlo.

---

## Product implication

> **¿Ya tenemos suficiente señal para considerar la compra de Peones nuestro primer
> experimento real de microeconomía?**

**Como producto: SÍ. Como experimento medido: NO todavía.**

**A favor:**
- 14 compradores únicos y 27 compras reales en 78 días
- **Recompra probada**: 5 de 14 compraron más de una vez; uno compró 10 veces
- Idempotencia verificada: 0 duplicados en 27 compras
- Ya funciona a $0.05 — el ticket exacto que el análisis de `no-token` señalaba
- No requiere construir nada: existe y está en producción

**En contra:**
- **Las compras de $0.05 son 5, todas tuyas.** Cero usuarios reales en el tramo micro
- **No hay embudo**: no sabemos cuántos lo ven, lo abren o lo abandonan
- Sin latencia ni tasa de fallo medidas
- El 81 % de las compras históricas son del pack de 50, no del micro-ticket

⛔ **Construir un cosmético de $0.25 ahora sería repetir el error**: lanzarías un
segundo producto sin instrumentar, sin saber por qué el primero convierte o no.
**El producto de $0.05 ya existe y ya funciona. Lo que no existe es la medición.**

---

## Recommended next actions

1. **Instrumentar el flujo de compra de Peones.** Es la acción de mayor valor del
   informe y la más barata: el rail ya tiene las cinco fases como estados
   (`preparing → awaiting_signature → pending_tx → verifying → success`) y
   `tx_progress` ya existe para otros flujos. Reusarlo cierra latencia, conversión y
   tasa de fallo de una sola vez.
2. **Medir antes de optimizar.** La lentitud es real como percepción, pero
   `waitForTransactionReceipt` está ahí desde junio. Sin números, cualquier
   optimización sería a ciegas — y mi hipótesis (14 s por 5 Peones se toleran peor que
   14 s por 50) apunta a **valor percibido**, no a rendimiento.
3. **Exponer la compra de Peones** en vez de construir otro producto. Hoy `item_id 6`
   del shop es PRO; la micro-compra que sí puede pagar la gente no tiene vitrina.
4. **Registrar precio y token en `peones_ledger`** (o en su metadata). Hoy la tabla
   guarda Peones pero no cuánto se pagó ni con qué — imposible segmentar por ticket.
5. **Mirar a `8200fe9b`.** Un usuario con 10 compras, PRO y 10/21 Focus Days es el
   único caso de éxito del producto entero. Entender qué lo distingue vale más que
   otro producto nuevo.

⛔ **No recomiendo todavía: optimizar la latencia, ni lanzar el cosmético de $0.25.**
Ambas decisiones necesitan la instrumentación del punto 1.

---

## Sanity checks

- Fuente canónica `peones_ledger`, no analytics, para todo lo que es una compra.
- Idempotencia verificada por **dos** vías independientes (claves e `attestation_hash`).
- La latencia de `save-score` se cita **explícitamente** como referencia de orden de
  magnitud de la wallet, nunca como medición de este flujo.
- Se descartó la atribución ERC-8021 leyendo su implementación, no asumiendo.
- Se verificó que el canary está inactivo antes de contar sus 2 requests como latencia.
