# Chesscito — Estado en Supabase + análisis de planitud del contenido

**Fecha:** 2026-08-10 · **Método:** lectura read-only de producción vía PostgREST
(service role, sólo `SELECT`; cero escrituras) + parseo del catálogo autorado en
`apps/web/content/*.json` y `puzzles.generated.ts`.
**Pregunta que contesta:** ¿qué hay hoy en Supabase, y qué tan plano es el contenido?

> Complementa —no reemplaza— `docs/audits/2026-08-10-deep-product-data-business-audit.md`,
> que midió retención y negocio el mismo día. Este documento mira **el contenido**.

---

## 0. TL;DR

1. **La planitud es medible y es peor de lo que sugería la intuición.** 21 ejercicios le dan
   **3★ al 100 % de quien los toca**. El 79,1 % de los primeros contactos calificados terminan
   en 3★. La estrella no mide habilidad: mide asistencia.
2. **El carril 2 no llega tarde "en general" — llegan tarde los cinco juegos firma.** Los rails
   de la torre sí se juegan (429 wallets). `queens`, `knight-tour`, `safe-path` y
   `promotion-run` los ven entre **1,5 % y 3,7 %** de los jugadores.
3. ⚠️ **Corrección a la hipótesis obvia: más dificultad, sola, NO va a generar repetición.**
   La correlación entre dificultad y rejugadas es **débil y negativa** (r = −0,14). Nadie
   repite nada, fácil o difícil (1,05–1,23 intentos por wallet×ejercicio). Falta un **motivo**
   para repetir, no sólo un desafío.

---

## 1. Qué hay hoy en Supabase (producción, 2026-08-10)

| Tabla | Filas | Rango |
|---|---:|---|
| `analytics_events` | 253.220 | 2026-05-03 → 2026-08-11 |
| `score_attempts` | 7.984 | 2026-07-29 → 2026-08-11 |
| `peones_ledger` | 7.342 | — |
| `score_saves` | 4.153 | 2026-06-10 → 2026-08-11 |
| `victories` | 394 | — |
| `treasury_payment_consumptions` | 40 | — |

Notas de forma que importan para diseñar progresión:

- **`level_id` es la PIEZA (1–6), no el ejercicio.** El ejercicio vive en `exercise_id`.
  Cualquier métrica de progresión por nivel que se lea de `level_id` está midiendo piezas.
- **`score_attempts` es 100 % `surface = "learn"`.** PLAY/Arena **no persiste ni un intento**.
- **`score_saves` no tiene una sola fila con `surface = "play"`** (868 `learn/free`,
  131 `null/free`, 1 `null/peones`; 148 wallets distintas).
- `measure_kind` reparte así: `moves/graded` 59,3 %, `null/ungraded` 39,2 %,
  `coverage/starless` 0,6 %, `failures/graded` 0,5 %, `coverage/graded` 0,5 %.
  El 39,2 % sin calificar es lo que no pasa por el grader de movimientos.

**Consecuencia directa para P2P:** hoy no existe en la base ningún sujeto de un duelo.
No hay tabla de partidas, ni de oponentes, ni una sola fila escrita por la superficie donde
el duelo viviría. P2P no es "conectar lo que hay": es construir el registro desde cero.

---

## 2. La planitud, medida

### 2.1 En el catálogo autorado (antes de que juegue nadie)

De los **59 ejercicios del carril 1**:

- **35 (59 %) son UNA sola pieza en un tablero vacío.** Por pieza: caballo 9/10, rey 7/10,
  torre 5/10, alfil 5/9, dama 5/10, peón 4/10.
- **15 (25 %) se resuelven en UN movimiento.** 27 (46 %) en dos o menos.
- Tiers: 27 `easy`, 30 `medium`, **2 `hard`**.

El tipo `Exercise` explica el "atrapa estrellas tiene una sola estrella": el contrato es
**`targetPos` — una casilla objetivo, singular**. No existe un objetivo múltiple en el tipo.
`captureTargets` (múltiple) existe pero está reservado a laberintos de peón.
`rook-1` es literal: FEN `8/8/8/8/1R6/8/8/8`, mover `b4`, target `h4`. Tablero vacío,
un movimiento.

El carril 2, en contraste, **no tiene ni un tablero vacío**: densidad de 2 a 36 piezas,
mínimo 3 movimientos, y los juegos firma llegan a 15–25 movimientos (`knight-tour`).

### 2.2 En producción (lo que realmente pasa)

**Estrellas sobre 7.984 intentos:** 3★ 47,2 % · 2★ 7,4 % · 1★ 4,9 % · 0★ 0,8 % ·
sin calificar 39,7 %.

**Primer contacto (684 pares wallet×nivel):** de los que recibieron nota, **el 99,3 % sacó 3★
de una** (302 de 304). Uno solo sacó 2★ y uno solo 1★.

**Cadenas calificadas (4.478 wallet×ejercicio):** 79,1 % arrancan en 3★.

**Los 21 ejercicios donde TODO intento calificado dio 3★** (n≥5):

```
rook-1, rook-2, rook-distance-1, bishop-1, bishop-2, bishop-3, knight-1, knight-2,
pawn-1, pawn-2, pawn-4, pawn-5, pawn-7, pawn-8, pawn-promotion-2,
queen-1, queen-3, queen-7, queen-8, king-1, king-2
```

> **⚠️ Corrección (2026-08-10, tras leer el código de grading).** La primera versión de este
> documento atribuía al carril 1 la banda de `labyrinthStars` (1★ hasta `optimal + 4`). **Es
> falso:** esa banda es del carril 2. El carril 1 se califica con `computeStars`
> (`lib/game/scoring.ts:9`), tanto en cliente (`exercises-screen.tsx:1794`) como en servidor
> (`ATTEMPT_BUCKETS.exercise`): **3★ si `moves <= optimal`, 2★ si `= optimal+1`, 1★ en
> cualquier otro caso — y 0★ es imposible.**
>
> La conclusión cambia, y hacia algo más fuerte: **el grader del carril 1 no está roto — el
> contenido no le da nada que medir.** Con `optimalMoves = 1`, ningún grader puede producir
> gradiente: el jugador toca la estrella y ya está en el mínimo teórico. Por eso `targets[]`
> es el arreglo primario y el grader es secundario: **sólo empieza a importar cuando el óptimo
> es lo bastante grande como para tener dispersión.**

---

## 3. El carril 2 llega tarde — con precisión

545 wallets tocaron algún ejercicio. Alcance de los juegos firma:

| Contenido | Wallets | % de 545 | 3★ rate | Intentos/wallet |
|---|---:|---:|---:|---:|
| `rook-1` | 543 | 99,6 % | **100 %** | 1,0 |
| `rook-rail-two-turns` | 429 | 78,7 % | 66,7 % | 1,1 |
| `rook-rail-rook-run` | 104 | 19,1 % | 46,1 % | 1,5 |
| `bishop-1` | 71 | 13,0 % | **100 %** | 1,1 |
| `knight-tour-1` | 20 | **3,7 %** | (sin ★) | 2,2 |
| `queens-1` | 11 | **2,0 %** | **7,7 %** | 1,2 |
| `pawn-promotion-1` | 10 | **1,8 %** | 78,6 % | 2,8 |
| `king-safe-1` | 8 | **1,5 %** | 60,0 % | 1,3 |

**Matiz importante:** los rails de la torre **no** llegan tarde — los ve el 78,7 %. Lo que
llega tarde son los **cinco juegos firma de las otras piezas**, y llegan tarde porque están
detrás de *la pieza*, no detrás del carril. El 86,6 % de las wallets toca **una sola pieza**
(mediana = 1 nivel; p90 = 2; máximo = 6).

Y ahí está la ironía: `queens-1` tiene un 3★ rate del **7,7 %** y `queens-2` del **0 %** —
es el contenido con dificultad real y honesta del producto, y lo ve el 2 % de la gente.

---

## 4. ⚠️ La corrección que cambia el plan

La hipótesis natural es "si subo la dificultad, la gente repite y siente mastery". **Los datos
no la sostienen.**

- Pearson r(3★ rate, intentos por wallet) sobre 62 ejercicios con ≥8 notas: **−0,140**. Débil.
- Ejercicios con 3★ ≥95 % (n=21): **1,14** intentos/wallet.
- Ejercicios con 3★ <70 % (n=19): **1,23** intentos/wallet.
- Tras un primer 3★, sólo el **3,0 %** vuelve a jugarlo. Tras un resultado **peor** que 3★,
  vuelve el **9,0 %**.

Es decir: fallar triplica la probabilidad de reintento, pero **la base es tan baja que el
efecto absoluto es ruido** (9 % de 935 cadenas = 84 reintentos). El producto no tiene hoy
ningún mecanismo que diga *"volvé a este ejercicio"*. La dificultad crea la *posibilidad* de
repetir; no crea el *deseo*.

**Implicación de diseño:** de la lista del founder, `score / perfect run` no es "posiblemente"
— es **la pieza que hace que todo lo demás funcione**. Más estrellas y más dificultad sin un
marcador que persista y se pueda superar producen exactamente lo que ya tenemos: un jugador
que resuelve, recibe 3★, y no vuelve nunca.

---

## 5. Lo que el dato sugiere, en orden

Ordenado por (evidencia que lo respalda) × (costo), no por atractivo:

1. **Objetivo múltiple en el tipo — primero, porque habilita todo lo demás.** `targetPos`
   singular es el techo estructural de "atrapa estrellas". Un `targets: BoardPosition[]`
   convierte cada ejercicio plano en uno con ruta —y el mínimo deja de ser trivial, porque hay
   que elegir el ORDEN—, sin arte nuevo y sin motor nuevo (la torre ya se mueve igual; cambia
   la condición de victoria, no las reglas). Es el cambio con mejor relación alcance/costo.
2. **Después el grader.** Con `optimalMoves = 1` ninguna banda sirve; con un óptimo de 7 sí.
   Una banda relativa (`optimal`, `+25 %`, `+50 %`, y **0★ posible**) recién ahí produce
   gradiente. *Riesgo:* 21 ejercicios pasarían de "3★ garantizado" a exigir precisión — y hay
   maestría ya otorgada que no se revoca (ver `project_retired_lane_preserves_mastery`), por lo
   que conviene aplicarlo sólo a los ejercicios convertidos.
3. **Adelantar densidad al carril 1.** No hace falta autorar 59 ejercicios nuevos: 35 tienen
   tablero vacío. Meterles bloqueadores los sube de "1 movimiento" a "hay que rodear".
4. **Score / perfect run persistido por ejercicio.** Es lo que da el motivo de repetir que hoy
   no existe (§4). Sin esto, 1–3 mejoran la calidad y no mueven la repetición.
5. **Sacar los juegos firma de detrás de la pieza.** Hoy `queens-1` exige llegar a la dama.
   El audit de negocio del mismo día llega a la misma conclusión por otro camino (§4 de ese
   doc: "la mejor pedagogía del producto mide 6 niveles y está última en la fila").

### Sobre P2P Play

Es el objetivo declarado del founder y no es mi decisión, pero el dato pide dejarlo dicho:

- No existe **ninguna** fila en Supabase escrita por la superficie PLAY. Ni intentos, ni
  guardados. El leaderboard semanal de `play` **no puede producir salida jamás**
  (`weekly_ranking()` lee `score_attempts WHERE surface = p_surface`).
- El 86,6 % de los jugadores toca una sola pieza; el duelo apunta a una capa de día 5 en un
  producto cuyo día 2 es ~2,6 %.
- El audit de negocio de hoy lo lista explícitamente en "no construir ahora" (§6).

Eso **no** es un argumento para no hacerlo — es un argumento para que P2P venga **después**
de que exista un jugador que quiera volver, y para que su primer entregable sea el registro
de partidas que hoy no existe. Si P2P se hace igual, lo barato y honesto es empezar por
**hacer que PLAY escriba algo**: sin eso, el duelo no va a poder medirse ni rankearse.

---

## 6. Cómo reproducir esto

Scripts read-only usados (scratchpad de la sesión, no versionados):
`catalog-flatness.mjs`, `flat3.mjs` (catálogo), `attempts.mjs`, `exercises-depth.mjs`,
`lanes.mjs`, `frame.mjs` (producción vía PostgREST).

⚠️ `pnpm ops:health` **no midió Supabase** en esta sesión: su transporte es `psql` en Docker y
el daemon de Docker estaba abajo. El eje salió `[not observable]` — no significa que la base
estuviera caída. Para lectura de agregados, PostgREST con el service role alcanza y no
necesita Docker.

⚠️ El corte de `score_attempts` empieza el **2026-07-29**: es más joven que `score_saves`
(2026-06-10). Toda métrica de intentos describe las últimas ~2 semanas, no la vida del
producto.
