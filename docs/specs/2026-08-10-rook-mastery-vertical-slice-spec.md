# Spec — Rook Mastery Vertical Slice (Star Sweep)

**Fecha:** 2026-08-10 · **Estado:** propuesto, pendiente de aprobación
**Alcance:** SÓLO la torre. No expandir a las seis piezas. No tocar P2P.
**Evidencia que lo motiva:** `docs/audits/2026-08-10-content-flatness-and-progression-analysis.md`

---

## 1. La hipótesis (esto es un experimento, no una feature)

> **H1 — Dar una meta superable y visible genera repetición.**

El objetivo **no** es demostrar que podemos hacer ejercicios más difíciles. Es medir si un
jugador que ve *"tu mejor: 9 · perfecta: 7"* vuelve a intentarlo.

**Por qué hace falta medirlo:** hoy nadie repite nada, y la dificultad **no** predice la
repetición (r = −0,14 sobre 62 ejercicios; los difíciles tienen 1,23 intentos/wallet contra
1,14 los fáciles). Si la repetición no se mueve con una meta superable explícita, entonces el
problema no es la dificultad **ni** la meta, y hay que buscar en otro lado — ese resultado
negativo vale tanto como el positivo.

### Criterio de éxito / falsación

**La comparación primaria es within-subject:** `rook-1` queda sin convertir a propósito (§4),
así que el mismo jugador, en la misma sesión, produce las dos mitades del experimento.

| Métrica | Comparación | Umbral de éxito |
|---|---|---:|
| `replay_rate` — % de primeros resultados no-perfectos que reintentan el MISMO ejercicio | sweep vs. `rook-1` en el **mismo** jugador | **≥ 2× el control** |
| `improvement_rate` — % de reintentos que mejoran el best | sólo sweep | **≥ 40 %** |
| `perfect_rate` — % que llega a la corrida perfecta | sólo sweep | reportar |

Baseline histórico como referencia secundaria: **9,0 %** de las cadenas wallet×ejercicio con
nota < 3★ reintentaron (84 de 935). Es el número honesto contra el cual comparar, **no** el
3,0 % de los que ya sacaron 3★ — un ejercicio convertido casi nunca dará 3★ de una, así que la
población comparable es la que hoy queda por debajo.

**Qué probaría que H1 es falsa:** `replay_rate` se queda cerca del 9 % con el CTA visible y el
best score presente. Ahí la conclusión es que la repetición no se compra con una meta, y el
siguiente movimiento es de retención (día 2), no de contenido.

---

## 2. Decisiones ya tomadas (founder, 2026-08-10)

1. **Score = movimientos** (menor es mejor). **Corrida perfecta = mínimo teórico.**
   No hay criterio de tiempo ni de taps inválidos: ambos son invisibles para el jugador.
2. **Best score en `localStorage`; medición en `analytics_events`.** Ninguna de las dos pide
   firma, así que el experimento se mide sobre el 100 % de los jugadores y no sobre el ~60 %
   que firma.
3. **El grader nuevo aplica SÓLO a los ejercicios convertidos** (los que tienen `targets`).
   Los otros 56 conservan `computeStars` y la maestría ya otorgada intacta.

---

## 3. El contrato primero (SDD)

### 3.1 Tipo

```ts
// lib/game/types.ts — additivo
export type Exercise = {
  // …
  /** Star Sweep — el conjunto COMPLETO de casillas a recoger, en cualquier orden.
   *  Ausente = ejercicio de objetivo único (el 100 % del catálogo hasta hoy), que
   *  se sigue leyendo por `targetPos`. Nunca leer este campo directo: pasar por
   *  `exerciseTargets()`, que unifica las dos formas. */
  targets?: BoardPosition[];
};
```

⚠️ **`targetPos` NO se elimina y NO se vuelve opcional.** Lo leen el board, el BFS, el
hint de Peones y `getValidTargets`. Un ejercicio con `targets` mantiene `targetPos =
targets[0]` para que todo lector viejo siga funcionando; el orden real es libre.

### 3.2 El resolver único

```ts
// lib/game/targets.ts (nuevo)
/** Las casillas a recoger. UNA fuente de verdad para board, grader, BFS y UI. */
export function exerciseTargets(ex: Exercise): BoardPosition[];
/** Un ejercicio Star Sweep es el que declara más de un objetivo. */
export function isSweep(ex: Exercise): boolean;
```

> Patrón deliberado: el candado va en quien otorga la capacidad, no en cada llamador
> (`feedback_guard_the_grantor_not_the_callers`). Si un lector nuevo olvida `exerciseTargets`
> verá un solo objetivo y **fallará en silencio** — por eso el linter de contenido (§6) exige
> que todo ejercicio con `targets` tenga `targetPos === targets[0]`.

### 3.3 El grader

```ts
// lib/game/scoring.ts
/** Bandas RELATIVAS, y 0★ posible. Sólo para Star Sweep. */
export function sweepStars(movesUsed: number, optimalMoves: number): 0 | 1 | 2 | 3;
//  3★  movesUsed <= optimal                    ← corrida perfecta
//  2★  movesUsed <= optimal + ceil(optimal*.25)
//  1★  movesUsed <= optimal + ceil(optimal*.50)
//  0★  peor

/** El ÚNICO punto de dispatch. Cliente y servidor llaman a ésta, nunca a las dos de abajo. */
export function gradeExerciseRun(movesUsed: number, exercise: Exercise): 0 | 1 | 2 | 3;
```

⚠️ Hoy `computeStars` se llama en **cuatro** sitios (`exercises-screen.tsx:1794, 1838, 1866`
y `ATTEMPT_BUCKETS.exercise`). Los cuatro pasan a `gradeExerciseRun`. Dejar uno sin migrar
produce una pantalla que muestra una nota y un servidor que persiste otra —
exactamente el modo de fallo que `attempt-grading.ts` documenta en su cabecera.

Con `optimal = 7`: 3★ = 7 · 2★ = 8–9 · 1★ = 10–11 · 0★ = 12+.

### 3.4 El óptimo multi-objetivo

`computeExerciseBfs` resuelve start→un target. Para N objetivos el mínimo es el mejor orden
(TSP diminuto):

```ts
// lib/game/sweep-optimal.ts (nuevo)
/** Mínimo de movimientos para recoger TODOS los targets desde startPos, orden libre.
 *  BFS por pares + permutaciones (N<=4 → <=24 órdenes). null si alguno es inalcanzable. */
export function computeSweepOptimal(piece: PieceId, ex: Exercise): number | null;
```

⛔ **`optimalMoves` se COMPUTA en `pnpm import-puzzles`, no se autora a mano** — un óptimo
escrito a dedo que esté 1 de más convierte la corrida perfecta en inalcanzable y el
experimento mide una mentira. El import falla si el valor autorado no coincide con el
computado (mismo protocolo que el verificador BFS que ya existe).

### 3.5 Persistencia del best

```ts
// PieceProgress — additivo, misma clave `chesscito:progress:{piece}`
export type PieceProgress = {
  currentId: string | null;
  stars: Record<string, number>;
  /** Star Sweep — mejor (mínimo) conteo de movimientos por ejercicio.
   *  Ausente = nunca completado. Sólo se escribe si MEJORA. */
  bestMoves?: Record<string, number>;
};
```

⚠️ Lectura tolerante obligatoria: `readPieceStars` y `getExercisesCompletedCount` ya parsean
esta clave y **deben seguir funcionando** contra entradas sin `bestMoves` y contra el shape
posicional legacy. Un campo nuevo no puede invalidar progreso existente.

---

## 4. Contenido: qué se convierte

### ⛔ `rook-1` NO se toca — es el control (decisión del founder, 2026-08-10)

543 de 545 wallets pasan por `rook-1`: es la puerta del producto, y el cuello medido hoy es la
**activación** (84 % completa cero ejercicios). Romperla para correr un experimento es cambiar
el motor en marcha.

Dejarla intacta además **mejora el experimento**: el mismo jugador ve un ejercicio plano
(`rook-1`) y uno con meta (`rook-2`) en la misma sesión, con el mismo humor y el mismo
contexto. **El delta de repetición entre los dos ES el resultado** — un control
within-subject, mucho más fuerte que comparar contra el baseline histórico de 9 %.

### Los tres que sí se convierten

| id | Wallets | 3★ hoy | Por qué éste | Se convierte a |
|---|---:|---:|---|---|
| `rook-2` | 520 | **100 %** | máximo alcance sin ser la puerta | 3 estrellas, requiere un giro |
| `rook-distance-1` | 305 | **100 %** | plano y muy tocado | 4 estrellas, el orden importa |
| `rook-4` | 299 | 67,6 % | **ya tiene dificultad y aun así nadie repite** | 3 estrellas con un rodeo |

⚠️ `rook-4` es deliberadamente el impar del trío: **no** es de los "3★ garantizado". Con 67,6 %
de 3★ ya tiene gradiente real y su repetición sigue siendo ~1,0. Es el caso que separa las dos
explicaciones posibles: si `rook-4` empieza a repetirse al ganar una **meta explícita** sin
haberse vuelto más difícil, la causa es la meta y no la dificultad — que es exactamente H1.

`playerPrompt` y `title` se reescriben en los tres (EN; el bundle ES se sincroniza — ver
`feedback_es_bundle_spread_is_not_a_deep_merge`).

---

## 5. Superficie de jugador

1. **Tablero:** las N estrellas se pintan a la vez; una recogida se apaga. Reusar
   `.playhub-board-dot` / el asset de estrella existente — **no crear arte nuevo**
   (`CLAUDE.md`: reusar assets canónicos).
2. **Contador en vivo:** `2/3` mientras juega, junto al contador de movimientos.
3. **Pantalla de resultado** (es `PhaseFlash`, no un overlay —
   `project_exercise_completion_surface_is_phaseflash`):

   ```
   ★★         9 movimientos
   Tu mejor: 9      Perfecta: 7
   [ Volver a intentar — te faltan 2 ]
   ```

   - Primera vez: `Tu mejor` es este resultado.
   - Con best previo y resultado peor: se muestra el best y **no** se sobrescribe.
   - Corrida perfecta: el CTA cambia a *"Corrida perfecta"* y **no** invita a repetir —
     invitar a superar lo insuperable es la clase de número que el jugador lee como mentira
     (`feedback_an_unauditable_number_reads_as_a_lie`).

⚠️ El CTA de replay **no** puede abrir una celebración nueva: la cola de celebraciones ya
tiene dueño y un `awaitTap` mal puesto se re-arma solo
(`feedback_sampling_outside_the_window_misses_transient_bugs`).

---

## 6. Instrumentación (el entregable real)

Vía `track()` → `analytics_events`. Sin firma.

| Evento | Cuándo | Campos |
|---|---|---|
| `sweep_result` | cada corrida completada | `exercise_id`, `moves`, `optimal`, `stars`, `is_perfect`, `attempt_number`, `best_before`, `improved` |
| `sweep_replay_cta_shown` | se pinta el CTA | `exercise_id`, `best`, `optimal`, `gap` |
| `sweep_replay_started` | se toca el CTA | `exercise_id`, `best`, `optimal` |

`attempt_number` + `best_before` + `improved` bastan para reconstruir
**first_result → replay → improvement** por wallet sin una tabla nueva.

⛔ **`exercise_complete` NO se toca** — es el evento con el que se compara el baseline. Un
campo nuevo ahí cambiaría la serie histórica.

⚠️ El linter de contenido (`lib/content/lint.ts`) suma dos reglas para Star Sweep:
`targetPos === targets[0]`, y `optimalMoves === computeSweepOptimal(...)`.

---

## 7. Plan de ejecución (TDD por etapas, un commit atómico por etapa)

| # | Etapa | Test primero |
|---|---|---|
| 1 | `exerciseTargets` / `isSweep` | single-target devuelve `[targetPos]`; sweep devuelve los N |
| 2 | `sweepStars` + `gradeExerciseRun` | barrido de dominio 0..3; no-sweep sigue en `computeStars` |
| 3 | `computeSweepOptimal` | orden óptimo ≠ orden autorado; target inalcanzable → `null` |
| 4 | Migrar los 4 call sites a `gradeExerciseRun` | cliente y servidor coinciden para el mismo run |
| 5 | `bestMoves` en `PieceProgress` | sólo escribe si mejora; lectura tolerante del shape viejo |
| 6 | Conversión de contenido + reglas de lint | import falla si el óptimo autorado miente |
| 7 | Condición de victoria multi-objetivo en la pantalla | `2/3` no completa; `3/3` sí |
| 8 | CTA de replay + `PhaseFlash` | perfecta no invita a repetir; peor no pisa el best |
| 9 | Los tres eventos | `improved` es falso cuando el run empata el best |

**Verificación antes de cerrar:** suite completa de Vitest con la máquina libre (⚠️ bajar
`pnpm dev`: un server arriba hace que workers no arranquen y el conteo de ARCHIVOS baja
mientras el resumen dice verde), `pnpm exec tsc --noEmit`, y VR con
`--project=minipay --update-snapshots=none`.

⚠️ **El VR no va a ver esto.** `hub-clean` tolera ~1.646 píxeles y un chip mide ~450: el
contador `2/3` y el CTA **se anclan con aserciones de DOM**, nunca con la foto
(`feedback_vr_tolerance_hides_small_elements`).

---

## 8. Riesgos abiertos

1. **`rook-1` es la puerta del producto.** Ver §4. Es el riesgo dominante del slice.
2. **Ranking.** `score = max(1, totalStars) × 100`, así que introducir 0★ en tres ejercicios
   puede bajar el techo de un jugador que hoy tiene 3★ garantizados. Al aplicarse sólo a los
   convertidos el impacto es acotado, pero **hay que confirmar que un best previo no se
   revoca** (`project_retired_lane_preserves_mastery`).
3. **El experimento puede no ser medible con el tráfico actual.** El firehose del listing
   decayó 94 %; si llegan pocos jugadores nuevos, `replay_rate` no alcanza significancia.
   Decidir de antemano el N mínimo antes de leer el resultado.
4. **`bestMoves` vive en localStorage** y el WebView de la wallet lo borra. El CTA puede
   perder la meta entre sesiones. Aceptado a propósito: la alternativa costaba una firma que
   el 40 % rechaza. La medición no depende de esto (va por telemetría).
