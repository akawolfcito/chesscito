# Reducción del amarillo de telemetría, antes de Supabase Free

**Fecha:** 2026-08-18 · **Alcance:** acotado a propósito. Cero cambios de producto, precios,
pagos, PRO, P2P, `/stats`, Redis, retención o plan.

Etiquetas: **[FACT]** medido · **[INFERENCE]** · **[ESTIMATE]**

---

## 0. El amarillo no era lo que decía ser

⛔ **La sesión de 660 eventos —el `max` que dispara la alarma— no es ruido de instrumentación.
Es una persona que jugó 22 partidas.**

**[FACT]** Su perfil: `arena_game_end` **22**, `game_persist_outcome` **22**,
`arena_difficulty_tap` **44**, `coach_viewer_mint_tap` **23**. Eso es un jugador intenso, y
**cada uno de esos eventos es señal de producto legítima.**

**[FACT] El p50 de cada evento del top es 2.** La sesión típica no es ruidosa.

⚠️ **Entonces la métrica que disparó el amarillo —media de 42,07 contra umbral 35— está
midiendo una cola pesada de usuarios reales.** Reducir "eventos por sesión" persiguiendo ese
número habría significado borrar la evidencia del mejor jugador que tenemos.

**[FACT] Lo que SÍ había, y no estaba en la hipótesis del brief: pares de eventos con números
IDÉNTICOS.**

---

## PARTE 1 — La cola pesada, medida (24 h)

| Evento | Total | Sesiones | Por sesión | p50 | p95 | Máx |
|---|---:|---:|---:|---:|---:|---:|
| `peones_balance_viewed` | 593 | 152 | 3,9 | **2** | 14 | 44 |
| `play_hub_view` | 347 | 97 | 3,6 | **2** | 11 | 30 |
| **`arena_coach_signal_viewed`** | **255** | **68** | **3,8** | **2** | **13** | **33** |
| **`arena_select_view`** | **255** | **68** | **3,8** | **2** | **13** | **33** |
| `modal_open` | 215 | 57 | 3,8 | 2 | 15 | 22 |
| `app_opened` | 197 | 154 | 1,3 | 1 | 3 | 15 |
| **`arena_game_start`** | **189** | **64** | **3,0** | **1** | **11** | **25** |
| **`arena_start_tap`** | **189** | **64** | **3,0** | **1** | **11** | **25** |
| **`arena_mount`** | **174** | **68** | **2,6** | **1** | **7** | **33** |
| **`arena_fresh_reset_fired`** | **174** | **68** | **2,6** | **1** | **7** | **33** |

⛔ **Tres pares, idénticos en las seis columnas.** No es coincidencia estadística: es la firma de
dos eventos disparados en el mismo instante.

**El ruido no está concentrado en pocas sesiones: es estructural.**

---

## PARTE 2 — Semántica de disparo, rastreada al callsite

| Evento | Clasificación | Evidencia |
|---|---|---|
| `arena_select_view` | ⛔ **RENDER_DRIVEN, redundante** | `arena/page.tsx`, efecto con deps `[arenaScaffoldEnabled, game.status]`. **Sin props.** Mismo instante que el de abajo |
| `arena_coach_signal_viewed` | ✅ **FIRST_VIEW_ONLY** | Ya tiene guard (`arenaCoachSignalViewedRef`) y **lleva el payload del coach** |
| `arena_start_tap` | ✅ **USER_ACTION** | `onStart` del scaffold. 4 props |
| `arena_game_start` | ✅ **STATE_CHANGE** | ⚠️ Ver abajo — **no es un duplicado** |
| `arena_mount` | ✅ **FIRST_VIEW_ONLY** | Guard propio, 5 props de estado de entrada |
| `arena_fresh_reset_fired` | ✅ **STATE_CHANGE** | Sólo con `?fresh=1`, 3 props de diagnóstico |
| `peones_balance_viewed` | ⛔ **REFRESH_DRIVEN, parcialmente redundante** | Guard **por instancia de componente** → el remount reemite |
| `play_hub_view` | **MEANINGFUL_VIEW** | Efecto con dep `[isConnected]` |

### ⚠️ Dos casos donde los números idénticos MIENTEN

**`arena_game_start` / `arena_start_tap`** — parecían el duplicado más limpio: mismo tap, y los
props del primero son subconjunto del segundo. ⛔ **Pero `handleStartWithLoading` tiene TRES
llamadores** (`page.tsx:1016`, `:1163`, `:1297`) y **sólo uno emite `arena_start_tap`**. Los
conteos coinciden porque hoy todo entra por el scaffold. **Borrarlo habría perdido los arranques
automáticos y los del panel legacy en silencio.**

**`arena_mount` / `arena_fresh_reset_fired`** — coinciden porque **hoy toda entrada a la Arena
lleva `?fresh=1`** (el link del play-hub es `/arena?fresh=1`). Miden cosas distintas, y el
segundo es telemetría de diagnóstico de un bug real (`will_call_reset`). Si el ruteo cambiara,
divergirían.

⛔ **Los tres pares tenían la misma apariencia estadística y sólo uno era realmente redundante.
La igualdad de conteos es una pista, nunca una prueba.**

---

## PARTE 3 — Semántica de dedup elegida

| Evento | Regla | Mecanismo |
|---|---|---|
| `arena_select_view` | **eliminado** | — |
| `peones_balance_viewed` | **ONLY_ON_VALUE_CHANGE, por superficie, alcance de sesión** | `Set` en memoria a nivel de módulo |

⛔ **Sin muestreo global. Sin Redis. Sin coste de infraestructura nuevo.** El `Set` vive en el
módulo, muere con la página, y ese es exactamente el alcance que se quiere.

---

## PARTE 4 — `peones_balance_viewed`

**Significaba B: "la UI renderizó/obtuvo un balance"** — pero sólo a medias, y la mitad importa.

**[FACT] Ya tenía dedup por valor** (`lastEmittedBalanceRef`). El defecto es que el guard era
**por INSTANCIA DE COMPONENTE**: cada remount empezaba de cero.

**[FACT] Medido en 24 h:** 596 filas contra **305** combinaciones distintas de
(sesión, superficie, balance) → **48,8% era reemisión**.

| Superficie | Filas | Combos | Amplificación |
|---|---:|---:|---:|
| `hub` | 332 | 199 | 1,67× |
| **`arena`** | **207** | **68** | ⛔ **3,04×** |
| `exercises` | 57 | 38 | 1,50× |

**La Arena a 3,04× es exactamente lo que parece un chip que se remonta en cada transición de
estado.**

**Semántica nueva:** *el balance se hizo visible para esta sesión, en esta superficie, con este
valor, por primera vez.*

⚠️ **La clave incluye la SUPERFICIE a propósito.** "Dónde ve el jugador su balance" es la señal
de producto; colapsar a un evento por sesión la habría destruido. El payload no se tocó.

---

## PARTE 5 — `play_hub_view` — ⛔ NO se toca

Dispara en `[isConnected]`, así que emite dos veces cuando la wallet conecta a mitad de la
vista. **[FACT] 349 filas / 98 sesiones / 196 combos** de (sesión, `wallet_connected`).

⛔ **No lo toco, por dos razones y ninguna es pereza:**
1. **Es un evento CANÓNICO consumido**: `canonical-events.ts:17` lo mapea a `hub_viewed`. Cambiar
   su emisión cambiaría un número que otra cosa ya reporta.
2. **Volver al hub varias veces es legítimo.** Colapsarlo por sesión sería el error que el brief
   advierte explícitamente.

⚠️ Queda anotado para Fase 2: la dep `[isConnected]` convierte un **cambio de estado** en una
segunda **vista**. Es corregible, pero exige decidir antes qué reporta `hub_viewed`.

---

## PARTE 6 — `arena_coach_signal_viewed` — ⛔ NO se toca

**[FACT] Ya está bien.** `arenaCoachSignalViewedRef` lo limita a una emisión por entrada a
"selecting", y lleva el payload del coach. **Es el que se queda de su par.**

---

## PARTE 7 — Otros duplicados

Revisados los siguientes por volumen: `modal_open` (3,8/sesión, pero `modal_open` con props de
qué modal es señal real), `app_opened` (1,3/sesión — sano), `tx_progress_view` (3,3/sesión,
diagnóstico del rail). ⛔ **Ninguno con evidencia suficiente. Freno acá.**

**Familias tocadas: 2 de un máximo de 5.**

---

## PARTE 8 — Tests

**Siete casos nuevos** en `peones-balance-chip.test.tsx`. Al escribirlos, **sólo uno falló** —
el del remount. Los otros seis pasaban ya, lo que confirma que rerender y cambio de valor
estaban bien y aísla el defecto real.

- ✅ emite en el primer render de un balance
- ⛔ **NO reemite tras un REMOUNT con el mismo balance** ← *la regresión exacta de producción*
- ✅ no reemite en un rerender simple
- ✅ **SÍ** reemite cuando el balance cambia de verdad
- ✅ **SÍ** emite por superficie — la señal de producto se conserva
- ✅ conserva el payload completo
- ✅ nunca emite en loading ni en error

⚠️ El `Set` es estado de módulo, así que los tests lo resetean con
`resetPeonesBalanceViewDedup()`. Sin eso, un verde podría depender del orden en que corrieron.

---

## PARTE 9 — Impacto estimado

**[FACT] Base de 24 h:** 6.672 eventos / 158 sesiones = **42,07 por sesión**.

| Cambio | Eventos/24 h retirados | Fuente |
|---|---:|---|
| `arena_select_view` eliminado | **−255** | **[FACT]** conteo directo |
| `peones_balance_viewed` deduplicado | **−291** | **[FACT]** 596 − 305 |
| **TOTAL** | **−546** | |

**[ESTIMATE] Esperado:** 6.672 − 546 = **6.126 eventos/24 h** → **38,8 por sesión**.
**Reducción: 8,2%.**

⛔ **38,8 sigue por encima del umbral de 35, y lo digo de frente.** Este cambio **no apaga el
amarillo**, y perseguir el umbral habría exigido borrar eventos de jugadores reales.

⚠️ **[INFERENCE] El umbral puede ser la métrica equivocada.** Con p50 = 17 —la mitad del
umbral— una alarma sobre la MEDIA se dispara por la cola. Medir la mediana, o eventos por sesión
excluyendo el p95, describiría mejor lo que se quiere vigilar. **Propuesta para Fase 2, no un
cambio de esta pasada.**

---

## PARTE 10 — Plan de observación posterior al deploy

Durante 24 h después de desplegar, comparar contra la línea base de hoy:

| Señal | Base **[FACT]** | Esperado **[ESTIMATE]** |
|---|---:|---:|
| Eventos / 24 h | 6.672 | ~6.126 |
| Eventos / sesión | 42,07 | ~38,8 |
| p50 | 17 | **sin cambio** |
| p95 | 156 | ligera baja |
| máx | 660 | **sin cambio** ⚠️ *es un jugador real* |
| `arena_select_view` | 255 | **0** |
| `peones_balance_viewed` | 593 | ~305 |
| Errores de `/api/telemetry` | 0 | **0** |
| Ritmo de escritura analítica | ~270 filas/h | ~250 |

⛔ **Si `peones_balance_viewed` cae por debajo de ~250/24 h, es sobre-dedup y hay que revisar**:
significaría que se están perdiendo cambios de balance reales, no repeticiones.

⛔ **Si el p50 se mueve, el cambio tocó la sesión típica y no debía.**

---

```
CURRENT EVENTS/SESSION:
42.07  (p50 = 17, p95 = 156, max = 660, n = 158)

ROOT CAUSE:
Dos causas distintas, y la principal NO era ruido.
  1. La cola pesada es un jugador real: la sesión de 660 eventos tiene 22
     partidas terminadas y persistidas. Eso es señal, no amplificación.
  2. La redundancia real es estructural: `arena_select_view` duplicaba el
     instante de `arena_coach_signal_viewed` sin props ni consumidores, y el
     guard de `peones_balance_viewed` era por instancia de componente, así que
     cada remount reemitía (48,8% de sus filas).

EVENT FAMILIES CHANGED:
  1. arena_select_view          → ELIMINADO (255/24h, cero props, cero lectores)
  2. peones_balance_viewed      → dedup por (superficie, balance) con alcance
                                  de sesión (−291/24h). Payload intacto.

EVENT FAMILIES DELIBERATELY NOT TOUCHED:
  · arena_game_start / arena_start_tap — conteos idénticos, pero
    handleStartWithLoading tiene TRES llamadores y sólo uno emite el tap
  · arena_mount / arena_fresh_reset_fired — coinciden sólo porque hoy toda
    entrada lleva ?fresh=1; semánticas distintas y props de diagnóstico
  · play_hub_view — evento CANÓNICO consumido; volver al hub es legítimo
  · arena_coach_signal_viewed — ya está correcto, es el que se queda del par
  · modal_open, app_opened, tx_progress_view — sin evidencia suficiente
  · PRO, no-token, pagos, mint, compras, ejercicios, Daily, Arena, Coach,
    identidad, retención, P2P, seguridad, errores, auditoría de escrituras

ESTIMATED REDUCTION:
−546 eventos/24h (−8,2%) → ~6.126/24h → ~38,8 por sesión  [ESTIMATE]
⛔ NO apaga el amarillo (umbral 35), y perseguirlo habría borrado señal real.

TARGET POST-DEPLOY OBSERVATION:
arena_select_view = 0 · peones_balance_viewed ~305 · p50 sin cambio (17) ·
máx sin cambio · 0 errores de telemetría. Ver la tabla de la Parte 10.

PRO INSTRUMENTATION PRESERVED:
YES — ni una línea tocada. El Lote 1 sigue recolectando.

PAYMENT TELEMETRY PRESERVED:
YES

PRODUCT SEMANTICS CHANGED:
NO — cero cambios de UX o de lógica de negocio. Sólo emisión de telemetría.

FULL SUITE:
PASS  (ver abajo)

TSC:
PASS
```

---

# READY TO DEPLOY TELEMETRY REDUCTION

⚠️ **Con una expectativa que conviene fijar antes de desplegar: esto NO va a poner
`ops:health` en verde.** Baja de 42,07 a ~38,8, y el umbral está en 35.

⛔ **Eso es correcto, no un fracaso.** Lo que quedaba entre 38,8 y 35 son partidas terminadas,
ejercicios completados y taps de dificultad de gente que juega mucho. **La única forma de bajar
más era borrar la evidencia de nuestros mejores usuarios.**

**Lo que yo miraría después es el umbral, no el emisor:** con p50 = 17 y p95 = 156, una alarma
sobre la media vigila la cola y no la sesión típica. Eso es Fase 2.
