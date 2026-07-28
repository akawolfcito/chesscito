# Score & Leaders — Auditoría del sistema actual

**Fecha:** 2026-07-27
**Alcance:** auditoría read-only. No se modificó código, `Leaders`, pagos, entitlements,
esquema, Focus Passport, Daily ni UI.
**Commit auditado:** `4f16d6c1` (main, working tree limpio).

> ### ⚙️ Estado post-Slice 0 (actualizado 2026-07-29)
>
> - **Learn y Play comparten proyecto Supabase: CONFIRMADO** por el founder. El open
>   question de §1.12 queda cerrado y **R12 pasa de riesgo hipotético a riesgo estructural
>   confirmado**.
> - **R1 (critical): CERRADO** en el write path off-chain. Ver §10 para el estado residual —
>   quedan dos superficies con el defecto original que Slice 0 no tocó.
> - **Slice 0.1 (§11): la firma por save pasó a ser una SESIÓN** — una firma compra 2h / 25
>   escrituras revocables. Cierra la fricción de UX sin ceder autoría.
> - **R13 (overflow): CERRADO.** `total_score` es `bigint`; verificado contra Postgres local
>   con una suma de 4.000.000.000 que antes hacía *raise* a la vista entera.
> - **R12: MITIGADO, no cerrado.** El dato ya se etiqueta (`score_saves.surface`), pero el
>   agregado sigue mezclando ambas superficies — separarlo es decisión de Slice 2.
> - Sin cambios en la fórmula de score, en Leaders, ni en la UI.

---

## 0. Resumen ejecutivo (leer esto si no vas a leer el resto)

Los cuatro conceptos que el brief quiere separar hoy **no existen como cuatro**. Existe
**uno solo**, y es débil:

| Concepto pedido | Estado real |
|---|---|
| Exercise Score | **No existe.** Existe una nota de estrellas (0–3) por ejercicio. |
| Daily Focus Score | **No existe.** El Daily es binario: completado / no completado. |
| Leaderboard Score | **Existe, y es lo único que existe.** `Σ estrellas × 100`, all-time, sin ventana. |
| Proof of Consistency | **No existe.** Hay dos señales parciales y desconectadas. |

Tres hallazgos que cambian la decisión:

1. **🔴 CRITICAL — `/api/scores/save` no autentica ni acota.** No verifica firma de wallet,
   el `saveId` es un `${player}:${levelId}:${gameId}` en texto plano sin secreto, `score`
   solo se valida como `> 0` y finito (el techo `MAX_SUBMITTABLE_SCORE` vive **únicamente**
   en el carril on-chain `/api/sign-score`, que ya no es el camino base), y `enforceOrigin`
   deja pasar cualquier request que **omita** `Origin` y `Referer` — bypass documentado en el
   propio código. Un `curl` puede poner **cualquier wallet** en el #1 con una sola llamada.
2. **🟠 El score no mide rendimiento, mide inventario.** Es una función pura de "cuántas
   estrellas acumulaste", donde las estrellas son best-of e inmutables a la baja. Con
   contenido fijo, todo jugador que termine el catálogo converge al mismo número. El
   leaderboard mide *quién llegó primero al techo*, no *quién juega mejor*.
3. **🟠 El desempate es la dirección de wallet.** `ORDER BY total_score DESC, player ASC`:
   con empate gana quien tenga la wallet lexicográficamente menor. Como el empate es el
   estado **esperado** (punto 2), el ranking real de la cabeza de la tabla es un ranking
   alfabético de direcciones.

**Recomendación: ruta D (rediseñar el score antes de tocar Leaders)**, con la salvedad de
que el arreglo del punto 1 no espera a ningún rediseño. Ver §8.

---

## 1. Sistema actual

### 1.1 Dónde se calcula

Hay **una sola** línea que produce el número que llega al leaderboard:

```ts
// apps/web/src/components/exercises/exercises-screen.tsx:1016
const score = useMemo(
  () => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR_BIG,
  [totalStars],
);
```

- `POINTS_PER_STAR = 100` — `apps/web/src/lib/game/score.ts:39`
- `totalStars` = suma de las mejores estrellas de la pieza **activa** (`progress-adapter.ts`,
  `getTotalStarsFromIdMap`)
- `levelId = getLevelId(piece)` → `1..6` — `apps/web/src/lib/contracts/scoreboard.ts:31`
  (la "pieza" ES el "nivel"; no hay más granularidad en toda la cadena)

`lib/game/score.ts` **no calcula el score**. Solo define constantes y `getMaxScoreForPiece`
(display/análisis, explícitamente no-validación).

### 1.2 Estrellas: los graders reales

| Grader | Archivo | Regla | Dirección |
|---|---|---|---|
| `computeStars` | `lib/game/scoring.ts:9` | 3★ si `moves ≤ optimal`; 2★ si `= optimal+1`; 1★ si `≥ optimal+2` | menos es mejor |
| `endgameStars` | `lib/game/scoring.ts:30` | 3★ `≤10`; 2★ `≤ parMoves`; 1★ resto | menos es mejor |
| `tourStars` | `lib/game/tour-score.ts:41` | 0★ `<80%`; 1★ `≥80%`; 2★ `≥90%`; 3★ `=100%` | **más** es mejor |
| `labyrinthStars` | (laberintos) | por movimientos | menos es mejor |

**Solo `computeStars` alimenta el score.** Los otros tres graden contenido que nunca llega
al leaderboard (§1.9).

`computeStars` nunca devuelve 0 si el jugador completó: el piso es 1★. Fallar no resta, y
no completar simplemente no escribe nada.

### 1.3 Qué suma / qué resta

**Suma:**
- Completar un ejercicio por primera vez (`completeExercise` → `withBestStars`).
- Repetir un ejercicio y sacar **más** estrellas que la vez anterior (delta neto).

**Resta / penaliza:** **nada**. Cero mecanismos de penalización en todo el sistema.

**Congelamiento** (única forma de que un solve no cuente) —
`shouldFreezeScoring(liteMode, session, isReplay)`, `lib/daily/session-quota.ts:120`:
congela **solo** si `mode === "learn"` **y** es replay **y** la sesión diaria ya cerró. Un
solve fresco nunca se congela (por diseño: congelarlo trabaría la progresión del drawer).

### 1.4 Qué factores afectan al score

| Factor | ¿Afecta? | Detalle |
|---|---|---|
| Completar | ✅ | Es la condición de entrada. |
| Estrellas | ✅ | Es el **único** input. `score = Σ★ × 100`. |
| Eficiencia de movimientos | ⚠️ indirecto | Solo vía las 3 bandas de `computeStars`. Resolución de 3 niveles. |
| Dificultad | ❌ | `Exercise.tier` **existe y está poblado** (29 easy / 60 medium / 4 hard en `puzzles.generated.ts`) pero **ningún consumidor de scoring lo lee**. El propio tipo lo documenta como "consumed by the future rotation engine, NOT by current UI". |
| Hints | ❌ | `PeonesHintButton` cuesta **Peones**, no estrellas. Un 3★ con hint pagada es idéntico a un 3★ limpio. |
| Intentos | ❌ | Ilimitados. El best-of se queda con el mejor y descarta el resto. No se cuentan. |
| Tiempo | ❌ | `timeMs` viaja hasta la tabla y hasta el contrato, pero es **decorativo**: solo el tiempo del último ejercicio, y `1000n` si la fase no es `success` (`exercises-screen.tsx:1026`). El comentario lo dice: *"on-chain time is informational, not used for scoring"*. |
| Optimalidad absoluta | ⚠️ | Solo el bucket 3★ (`moves ≤ optimal`). No distingue óptimo de sub-óptimo dentro del bucket. |
| Racha / consistencia | ❌ | Ninguna influencia. |

### 1.5 Alcance temporal del score

**Por pieza, acumulado, sin ventana.** No hay score por ejercicio, ni por sesión, ni por
día. El "score de la pieza" es un agregado monótono creciente sobre toda la vida de la
cuenta. Se recalcula en cada render desde localStorage.

### 1.6 Qué se guarda localmente

| Clave | Contenido | Módulo |
|---|---|---|
| `chesscito:progress:{piece}` | `{ stars: Record<exerciseId, 0..3> }` (best-of) | `use-exercise-progress` |
| `chesscito:save:{piece}` | `{ lastSavedScore, lastSavedAt, lastSavedTxHash }` | `hooks/use-save-score-state.ts` |
| `chesscito:daily-progress` | `{ streak, lastCompletedDate, totalCompleted }` | `lib/daily/progress.ts` |
| `chesscito:daily-session` | `{ date, consumedContentIds[], paidUnlocked }` | `lib/daily/session-quota.ts` |
| `chesscito:labyrinth-best:{piece}` | `Record<levelId, number>` (min movimientos / max cobertura) | `lib/game/labyrinth-progress.ts` |
| `chesscito:optimistic-score` (sessionStorage) | `{ player, score, levelId, ts }` | `exercises-screen.tsx:2244` |

**El servidor nunca ve el progreso.** Es el hecho que define todo lo demás.

### 1.7 Qué se guarda on-chain

`ScoreboardUpgradeable.submitScoreSigned(levelId, score, timeMs, nonce, deadline, sig)`:

- **No persiste el score en storage.** Solo emite `event ScoreSubmitted(...)`.
  El storage del contrato son `lastSubmissionAt`, `dailyWindows`, `usedNonces` — antiabuso,
  no datos de juego.
- **No hay `getScore()` view.** Confirmado en `use-save-score-state.ts` (*"there is no
  Scoreboard.getScore() view on the contract"*). Por eso `lastSavedScore` es local.
- Antiabuso on-chain real: `submitCooldown` + `maxSubmissionsPerDay` por wallet + nonces
  de un solo uso, con firma EIP-712 del backend.
- **Pero el backend firma lo que le pidan.** `lib/game/score.ts` lo declara sin ambigüedad:
  *"Nothing ties the `score` in the request body to real progress… Anyone can POST a maximal
  score for a piece they never played and it will be signed."*

Este carril hoy es **opcional y secundario** ("Leaderboard Proof lane"): el flujo base es
off-chain. Lo que hace visible al carril on-chain en Leaders es la marca `has_onchain` y la
fila que el cliente escribe en `scores` vía `/api/cache-score` después de la tx.

### 1.8 Qué se envía / lee en Leaders

**Escritura** (dos carriles, mismo destino conceptual):

| Carril | Endpoint | Tabla | Costo | Trigger |
|---|---|---|---|---|
| Base (off-chain) | `POST /api/scores/save` → RPC `save_basic_score` | `score_saves` | gratis siempre | **automático**, `useEffect` en `exercises-screen.tsx:2313` |
| Proof (on-chain) | `POST /api/sign-score` → `submitScoreSigned` → `POST /api/cache-score` | `scores` | gas | manual (CTA en el footer de Leaders) |

**Lectura:** `GET /api/leaderboard[?player=0x…]` → `lib/server/leaderboard.ts` →
`get_leaderboard()` / `get_player_rank()` (con fallback a las vistas — misma fuente, por
diseño).

**La fórmula del leaderboard** (`20260611120000_leaderboard_onchain_flag_player_rank.sql`):

```sql
-- leaderboard_full_v
SELECT player,
       SUM(best_score)::int AS total_score,
       RANK() OVER (ORDER BY SUM(best_score) DESC, player ASC) AS rank,
       COALESCE(pc.is_verified, false),
       BOOL_OR(level_has_onchain)
FROM (
  SELECT player, level_id, MAX(score) AS best_score, BOOL_OR(src_onchain)
  FROM ( scores UNION ALL score_saves ) unified
  GROUP BY player, level_id
) sub
LEFT JOIN passport_cache pc ON pc.player = sub.player
GROUP BY sub.player, pc.is_verified;
```

En una línea: **`Σ_pieza max(score registrado en esa pieza)`, all-time, sin decaimiento.**
`leaderboard_combined_v` es el corte top-10; `get_player_rank` da el rank real fuera del corte.

### 1.9 Qué superficies alimentan el score

Recorrido exhaustivo de los callers de `postScoreSave` / `cache-score`:

| Superficie | ¿Alimenta Leaders? |
|---|---|
| Training Path (ejercicios) | ✅ — único escritor real |
| Free Practice (mismo `exercises-screen`) | ✅ — **indistinguible** del Training Path |
| Daily Focus | ❌ |
| Laberintos | ❌ |
| Juegos firma (Knight's Tour, Queens, Safe Path, Promotion Run) | ❌ |
| Play / Arena | ❌ (mints de victoria → `victories` → Hall of Fame, carril aparte) |
| Cola de claims del perfil (`profile-sheet.tsx:211`) | ✅ — vía `submitScoreSigned` |

**No hay ninguna dimensión en el dato para distinguirlas.** `score_saves` tiene
`(save_id, wallet, level_id 1..6, score, time_ms, game_id, mode, peones_spent, metadata,
created_at)`. `level_id` es la pieza. `game_id` es `String(score)`. `metadata` se escribe
`null`. No hay columna de superficie, de modo, ni de app.

### 1.10 ¿Repetir un ejercicio vuelve a sumar?

**No, por dos capas independientes:**
1. Cliente: `withBestStars` — solo sube el best. `addNetStars(previousBest, earned)` acredita
   la mejora neta.
2. Servidor: `MAX(score) GROUP BY (player, level_id)` en la vista + `UNIQUE(save_id)` con
   `save_id = player:levelId:score` → reguardar el mismo score es `duplicate`.

El grind por repetición **no** infla el score. Esta parte está bien resuelta.

**Efecto lateral:** el techo por pieza es `poolSize × 3 × 100`. El techo global es
`Σ_6 piezas`. Es finito, alcanzable, e idéntico para todos.

### 1.11 ¿Hay límite diario?

| Límite | Valor | Ámbito |
|---|---|---|
| `SESSION_EXERCISE_LIMIT` | 10 (env `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT`) | **solo LEARN** (`CHESSCITO_LITE_MODE === mode==="learn"`). En PLAY no hay límite. |
| `HARD_MAX_EXTRAS` | 15 (10 + 2 packs × 5) | idem |
| Rate limit HTTP | 30 req/min **por IP** | `/api/scores/save` |
| Rate limit firma | 5/min | `/api/sign-score` |
| `maxSubmissionsPerDay` | configurable on-chain | solo carril on-chain |

Ninguno es un límite **de score**: el de sesión limita *contenido nuevo consumido*, y el
freeze que aplica al pasarse solo toca replays.

### 1.12 Learn vs Play

**Mismo código, misma tabla, sin columna que los separe.** `score_saves` no tiene campo de
app/modo. Si ambos despliegues apuntan al mismo proyecto Supabase — que es lo que sugiere el
patrón de configuración compartida — **Leaders está mezclando poblaciones de dos productos
con reglas distintas** (PLAY sin límite diario, LEARN con 10/día).

> ✅ **RESUELTO 2026-07-29 (founder):** LEARN y PLAY **comparten** el mismo proyecto
> Supabase. R12 deja de ser hipotético. Slice 0 agregó `score_saves.surface` (validada
> server-side contra el modo del deployment) para que el dato **quede etiquetado desde hoy**;
> las filas anteriores quedan en `NULL` — provenance genuinamente desconocida, y rellenarlas
> con una suposición sería fabricar evidencia. Separar el agregado por superficie es una
> decisión de producto que **no** se tomó en Slice 0.

### 1.13 Empates

`ORDER BY total_score DESC, player ASC`. El desempate es el **orden lexicográfico de la
dirección de wallet**. No hay criterio por tiempo, por fecha de logro, por consistencia, ni
por número de piezas cubiertas. Ver riesgo R4.

### 1.14 Qué parte es manipulable

| Vector | Estado |
|---|---|
| `score` arbitrario vía `POST /api/scores/save` | 🔴 **abierto** — sin firma, sin techo, `saveId` derivable |
| `score` arbitrario vía `/api/sign-score` → on-chain | 🟠 acotado a `MAX_SUBMITTABLE_SCORE` (30.000) pero igualmente falso; cuesta gas |
| Escribir en la wallet **de otro** | 🔴 **abierto** — `player` es un campo del body, no una firma |
| Bypass de `enforceOrigin` | 🔴 **abierto y documentado** — omitir `Origin` y `Referer` pasa el guard |
| Editar localStorage | 🟡 sube el score local → se auto-guarda al servidor; equivalente al vector 1 pero más lento |
| Farming por repetición | 🟢 **cerrado** (best-of doble capa) |
| Rate limit | 🟡 30/min/IP; irrelevante cuando **una** request basta |

---

## 2. Mapa de datos end-to-end

```
┌─ ACCIÓN ────────────────────────────────────────────────────────────────┐
│ El jugador completa un ejercicio en `exercises-screen`                   │
│   movesCount vs currentExercise.optimalMoves                             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ CÁLCULO (cliente, puro) ───────────────────────────────────────────────┐
│ computeStars(moves, optimal) → 1..3★        scoring.ts:9                 │
│ withBestStars(map, id, ★)    → best-of      progress-adapter.ts:101      │
│ totalStars = Σ best★ de la pieza                                         │
│ score      = max(1, totalStars) × 100       exercises-screen.tsx:1016    │
│ levelId    = 1..6 (la pieza)                scoreboard.ts:40             │
│ timeMs     = decorativo                     exercises-screen.tsx:1026    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ PERSISTENCIA ──────────────────────────────────────────────────────────┐
│ ① localStorage `chesscito:progress:{piece}`   ← FUENTE CANÓNICA REAL     │
│ ② useEffect auto-save (score nuevo) ────────────────────────────────┐    │
│ ③ localStorage `chesscito:save:{piece}` (eco del último guardado)   │    │
│ ④ sessionStorage `chesscito:optimistic-score` (fila fantasma UI)    │    │
└─────────────────────────────────────────────────────────────────────│────┘
                               ┌─────────────────────────────────────┘
                               ▼
        ┌──────────────────────┴────────────────────────┐
        ▼ CARRIL BASE (auto, gratis)                    ▼ CARRIL PROOF (manual, gas)
  POST /api/scores/save                           POST /api/sign-score  → EIP-712
   · enforceOrigin  (bypassable)                   · rate limit 5/min
   · rate limit 30/min/IP                          · score ≤ MAX_SUBMITTABLE_SCORE
   · re-deriva saveId (sin secreto)                     ▼
   · score > 0  ← ÚNICA cota                       submitScoreSigned (Celo)
        ▼                                           · nonce + cooldown + daily cap
  RPC save_basic_score                              · emite ScoreSubmitted (NO storage)
        ▼                                                ▼
  tabla `score_saves`                              POST /api/cache-score
  UNIQUE(save_id)                                        ▼
        │                                          tabla `scores` (UNIQUE tx_hash)
        └───────────────────┬──────────────────────────────┘
                            ▼
┌─ AGREGADO (Postgres) ───────────────────────────────────────────────────┐
│ leaderboard_full_v :  UNION ALL → MAX por (player, level_id) → SUM       │
│                       RANK() OVER (score DESC, player ASC)               │
│                       ⟵ passport_cache.is_verified                       │
│ leaderboard_combined_v : top-10                                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ LECTURA ───────────────────────────────────────────────────────────────┐
│ get_leaderboard()   /  get_player_rank(wallet)   (+ fallback a la vista) │
│ lib/server/leaderboard.ts → toApiRow: wallet → rowId opaco + variant     │
│ GET /api/leaderboard  (force-dynamic, sin cache)                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─ RENDER ────────────────────────────────────────────────────────────────┐
│ leaderboard-sheet.tsx : top-10 + fila propia con rank real               │
│ + fila optimista de sessionStorage si aún no aparece                     │
│ + sello has_onchain  + chip is_verified                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Clasificación de los datos

| Categoría | Qué |
|---|---|
| **Fuente canónica del progreso** | `localStorage chesscito:progress:{piece}`. El servidor no tiene una copia y no puede reconstruirla. |
| **Fuente canónica del ranking** | `score_saves` ∪ `scores`. Es un **eco no verificado** de la anterior. |
| **Duplicados** | (a) `score` vive en `score_saves.score`, en `score_saves.game_id` (string del mismo número) y en `save_id`; (b) `chesscito:save:{piece}.lastSavedScore` duplica lo que el servidor ya sabe; (c) `scores` y `score_saves` guardan el mismo concepto en dos tablas. |
| **Derivados** | `total_score`, `rank`, `has_onchain`, `rowId`, `variant`, `walletShort`, `maxPossibleStars`, `badgeEarned`, todo el `PassportView`. |
| **Estado local puro** | racha diaria, cuota de sesión, bests de laberinto/tour, `optimistic-score`. Ninguno cruza a Leaders. |
| **On-chain** | Solo el **evento** `ScoreSubmitted` + antiabuso. No hay score legible on-chain. |
| **Divergibles** | ver abajo |

### 2.2 Puntos de divergencia reales

1. **localStorage ↔ `score_saves`** — el usuario borra el sitio, cambia de dispositivo o de
   navegador: el progreso local vuelve a cero, el leaderboard no. No existe reconciliación
   (documentado como diferido en `deferred-work.md`).
2. **`chesscito:save:{piece}` ↔ servidor** — es per-device. Dos dispositivos muestran
   estados de "guardado" distintos para la misma cuenta.
3. **`scores` ↔ cadena** — `/api/cache-score` es fire-and-forget desde el cliente. Si la tx
   confirma y el POST falla, la tx existe y la fila no: `has_onchain` queda en `false` para
   alguien que sí pagó gas.
4. **fila optimista ↔ ranking real** — se inyecta con `rank: rows.length + 1`, un rank
   inventado.
5. **LEARN ↔ PLAY** — §1.12.

---

## 3. Riesgos

Clasificados por impacto sobre la credibilidad del ranking y sobre cualquier reward futuro.

| # | Riesgo | Nivel | Evidencia | Nota |
|---|---|---|---|---|
| **R1** | **Manipulación cliente-side** | 🔴 **critical** | `api/scores/save/route.ts` — sin firma; `player` viene del body; `score` solo `> 0`; `deriveScoreSaveId` es concat sin secreto; `enforceOrigin` con bypass sin-headers documentado | Un `curl` pone cualquier wallet en #1. Y en la wallet de **otro**. Cualquier reward atado a esto es indefendible. |
| **R2** | **Score idéntico para todos** | 🟠 **high** | `score = Σ★ × 100` sobre catálogo finito | Con contenido fijo, el techo es común. El ranking colapsa en un empate masivo. |
| **R3** | **Ventaja por antigüedad / imposible de alcanzar** | 🟠 **high** | acumulativo all-time, sin ventana ni decaimiento | Un jugador nuevo no puede superar a uno viejo hasta completar todo el catálogo. La cabeza de la tabla es un registro histórico congelado. |
| **R4** | **Desempate por dirección de wallet** | 🟠 **high** | `RANK() OVER (… , player ASC)` | Combinado con R2 (empate = estado esperado), el orden visible del top es alfabético por wallet. Es farmeable: generá wallets hasta obtener un prefijo bajo. |
| **R5** | **Dificultad ignorada** | 🟠 **high** | `tier` poblado (29/60/4) y nunca leído por scoring | Un `easy` de 2 movimientos vale exactamente lo mismo que un `hard`. El contenido difícil no tiene retorno. |
| **R6** | **Divergencia local ↔ servidor** | 🟠 **high** | §2.2 (1)(2) | Progreso irrecuperable al cambiar de dispositivo. Ya es un problema de soporte hoy, no solo de score. |
| **R7** | **Intentos infinitos sin costo** | 🟡 **medium** | sin contador de intentos; best-of se queda con el mejor | No infla el score (R11 está cerrado) pero borra toda diferencia entre "lo sacó a la primera" y "lo sacó a la vigésima". Mata la señal de rendimiento. |
| **R8** | **Hints sin penalización** | 🟡 **medium** | `PeonesHintButton` cobra Peones, no estrellas | Convierte precisión en un producto comprable. Hoy es menor porque las estrellas ya casi no discriminan; escala mal en cuanto el score importe. |
| **R9** | **Ventaja por volumen** | 🟡 **medium** | `SUM` sobre 6 piezas | Acotado por el techo finito, así que no es ilimitado — pero premia amplitud sobre calidad. |
| **R10** | **Score acumulativo sin ventana** | 🟡 **medium** | (=R3, causa raíz) | Sin ventana no hay forma de rankear "esta semana". Bloquea cualquier temporada. |
| **R11** | **Farming por repetición** | 🟢 **low** | best-of en cliente + `MAX()` + `UNIQUE(save_id)` | **Cerrado.** Único riesgo del brief que ya está bien resuelto. |
| **R12** | **LEARN y PLAY mezclados** | 🟡 **medium** | `score_saves` sin columna de app | Grado depende del open question de §1.12. |
| **R13** | **`SUM(...)::int` puede desbordar** | 🟡 **medium** | `score` es `int` (máx 2.147.483.647); 6 niveles sumados exceden `int` | Explotable vía R1: **la vista entera falla** y Leaders devuelve 500 para todos. DoS de un request. |
| **R14** | **Rank optimista falso** | 🟢 **low** | `rank: apiRows.length + 1` | Cosmético y transitorio. |

---

## 4. Huecos (lo que hace falta y no existe)

| Hueco | Consecuencia |
|---|---|
| **No hay identidad de intento.** Ni `attemptId`, ni contador, ni marca de primer intento. | Imposible distinguir first/best/final. Bloquea el Daily Focus Score de §5.2 y dos señales de §7. |
| **No hay score por ejercicio.** El score solo existe agregado por pieza. | Nada que normalizar a 0–100. Cualquier Exercise Score empieza de cero. |
| **El Daily no produce ningún número.** Solo `{streak, lastCompletedDate, totalCompleted}`. | No hay "Daily Focus Score" que auditar; hay que crearlo. |
| **No hay dimensión temporal en el agregado.** `created_at` existe en `score_saves` pero **no se usa en ninguna vista**. | Las ventanas weekly/monthly/season son **imposibles** hoy… salvo que se lean de `created_at`, que sí está. Es el hueco más barato de tapar. |
| **No hay dimensión de superficie.** `level_id` = pieza; `metadata` = null. | Daily / Path / Practice / Labyrinth son indistinguibles en el dato. Cualquier regla "máximo un Daily puntuable por día" no tiene sobre qué operar. |
| **No hay prueba de posesión de wallet en el write path.** | R1. Es el hueco fundacional: sin esto, nada de lo demás es defendible. |
| **No hay progreso server-side por wallet fuera del score.** | R6, y el Proof of Consistency queda sin base para no-entitled. |
| **`focus_day_ledger` está gateado por entitlement.** | La única señal de hábito **durable y server-owned** solo existe para quien compró el pase. Los demás no dejan rastro. |
| **Sin `difficulty` en el registro guardado.** | Aunque `tier` exista en el catálogo, la fila guardada no lo lleva → no se puede auditar retroactivamente el mix. |

---

## 5. Propuesta de contratos (diseño, NO implementación)

> Todo lo de esta sección es propuesta. Nada de esto está implementado ni se implementó
> durante esta auditoría.

### 5.1 Exercise Score — rendimiento de un intento

Hoy la única señal medible con datos existentes es la eficiencia de movimientos. Propuesta
que usa **solo lo que ya se puede medir hoy** más dos campos nuevos baratos:

```
ExerciseScore ∈ [0, 100]   // por INTENTO, no por ejercicio

base        = 60   si completó, 0 si no
efficiency  = 40 × clamp(optimalMoves / movesUsed, 0, 1)     ya medible
difficulty  = ×{ easy: 0.9, medium: 1.0, hard: 1.15 }        `tier` ya existe
hintPenalty = −10 por hint usada (piso 0)                    requiere contar hints
firstTryBonus = +5 si attemptIndex === 0                     requiere contador
```

- **Ya medible hoy:** completar, movimientos, optimalMoves, dificultad (`tier`).
- **Requiere campo nuevo (barato):** `hintsUsed`, `attemptIndex`.
- **Deliberadamente fuera:** tiempo. `timeMs` hoy es basura (§1.4) y arreglarlo es un
  trabajo aparte; además penaliza a quien piensa, que es exactamente el comportamiento que
  un juego pre-ajedrecístico quiere premiar.

El `stars` actual se mantiene **como está**, sin tocarlo: es la métrica de display del
jugador y ya está en toda la UI. `ExerciseScore` es una capa nueva, no un reemplazo.

### 5.2 Daily Focus Score — cuál de los tres intentos

| Opción | Feedback personal | Leaderboard | Rewards futuros |
|---|---|---|---|
| **first attempt** | 🟡 duro (un error y el día quedó marcado) | 🟢 **el más honesto**: no farmeable por repetición, mide lo que el jugador realmente sabía | 🟢 **el más defendible** |
| **best attempt** | 🟢 el más amable, premia mejorar | 🔴 farmeable: intentos ilimitados → todos convergen a 100 | 🔴 no discrimina |
| **final attempt** | 🟡 ambiguo (¿abandonó o terminó?) | 🔴 igual que best pero con más ruido | 🔴 |

**Recomendación:** **guardar los tres, puntuar con `first`.**

- **Feedback personal → `best`.** Es lo que se le muestra al jugador ("tu mejor de hoy").
- **Leaderboard → `first`.** Es la única de las tres que no se puede farmear con la
  mecánica actual de intentos infinitos.
- **Rewards → `first`**, con `best` como desempate secundario.

Guardar los tres cuesta tres columnas y elimina para siempre el "¿y si eligiéramos otra?".
Elegir una sola ahora es una decisión irreversible sobre datos que no volverán.

### 5.3 Leaderboard Score — versión inicial

**Principio:** el leaderboard debe medir **la ventana**, no la biografía.

```
LeaderboardScore(window) = Σ_{d ∈ window} min(dailyPoints(d), DAILY_CAP)

dailyPoints(d) = DailyFocusScore(d, first)          // máx UN Daily puntuable por día
               + Σ (ExerciseScore de ejercicios NUEVOS ese día)   // acotado por sesión
consistencyBonus = +2% por cada día activo en la ventana, tope +20%
```

Reglas mínimas:

- **Máximo un Daily puntuable por día** — natural: `recordDailyCompletion` ya es idempotente
  por día UTC, y `focus_day_ledger` ya tiene `UNIQUE(wallet, season_id, date_utc)`. La
  invariante ya está construida, solo falta que el score la use.
- **Límite diario** — reusar `SESSION_EXERCISE_LIMIT` (10) como cota natural. Ya existe; hoy
  no aplica en PLAY (§1.11) y eso habría que unificarlo.
- **Dificultad** — vía el multiplicador de §5.1.
- **Bonus de consistencia pequeño** — deliberadamente pequeño: si el bonus decide el
  ranking, el ranking es de asistencia, no de juego.

**Desempates, en orden:** (1) score de la ventana → (2) días activos en la ventana → (3)
mejor Daily Focus Score → (4) primero en alcanzar el score (menor `created_at` de la fila
que lo produjo). **Nunca la dirección de wallet.** El criterio (4) resuelve por mérito
temporal y ya se puede calcular con `created_at`, que existe y hoy está ocioso.

### 5.4 Ventana: cuál debe ser el ranking principal

| Ventana | Veredicto |
|---|---|
| **weekly** | ✅ **Ranking principal.** Todo jugador nuevo empieza empatado cada lunes → mata R3 y R4 de raíz. Ciclo corto = razón semanal para volver, que es exactamente el hábito que el producto vende. |
| **monthly** | Secundario. Buen resumen; ciclo demasiado largo para ser el motor. |
| **season** | Reservarlo para rewards, no para el ranking visible. Ya hay noción de temporada (`season_id` en `focus_day_ledger`) — es el ancla natural de Proof of Consistency. |
| **all-time** | ⚠️ Conservar como **archivo/vitrina**, nunca como ranking principal. Es lo que hay hoy y es la causa raíz de R3. |

**Propuesta: `weekly` es el ranking principal; `all-time` se degrada a "Hall of Fame".**
El dato para calcular weekly (`score_saves.created_at`) **ya está en la tabla**. No hace
falta migración para la ventana.

### 5.5 Proof of Consistency

Sin fórmula, por instrucción. Lo relevante de la auditoría es que **hoy no hay base de datos
para construirla**: ver §7. La única señal server-owned y durable
(`focus_day_ledger`) está gateada por entitlement, y sus filas `backfill_streak` son
**inferidas, no evidencia** — el propio comentario de la migración advierte que *"any future
rewards system must be able to exclude them"*. Eso es correcto y hay que respetarlo.

---

## 6. Señales de consistencia — inventario

| Señal | Estado | Dónde vive hoy | Persistencia mínima que faltaría |
|---|---|---|---|
| **focus days completed** | 🟢 **exists** | `focus_day_ledger` (wallet, season, date, source) | Ninguna nueva — pero **quitar el gate de entitlement** para que todos dejen rastro. |
| **unique active days** | 🟡 **partial** | agregado por `session_id` de browser (`computeHabitDepth`, `analytics_events`), **no por wallet**; per-wallet solo dentro de `focus_day_ledger` (entitled) | Tabla o vista de `(wallet, date_utc)` derivada de `score_saves.created_at` — **cero migración**, se puede hacer como vista. |
| **current streak** | 🟡 **partial** | `DailyProgress.streak` en **localStorage** (`lib/daily/progress.ts`) | Copia server-side. Hoy se pierde al cambiar de dispositivo (R6). |
| **longest streak** | 🔴 **missing** | — | Campo nuevo, o derivable de `focus_day_ledger` con una query de gaps (entitled) / de la vista de días activos (todos). |
| **gaps between focus days** | 🟡 **partial** | derivable de `focus_day_ledger.date_utc` (solo entitled) | Igual que "unique active days": derivable sin schema nuevo. |
| **average Daily score** | 🔴 **missing** | — | **No existe el Daily score.** Requiere §5.2 completo. |
| **best Daily score** | 🔴 **missing** | — | Idem. |
| **difficulty mix** | 🟡 **partial** | `Exercise.tier` en el catálogo (29 easy / 60 medium / 4 hard) — **no se guarda con el resultado** | Persistir `tier` en la fila del intento. Sin eso no es auditable retroactivamente. |
| **piece variety** | 🟢 **exists** | `level_id` (1..6) en `score_saves` / `scores` | Ninguna. Es la única señal rica que ya está guardada y sin usar. |
| **first-attempt score** | 🔴 **missing** | — | `attemptIndex` + el score del intento. Bloqueante para §5.2. |
| **repeated-attempt score** | 🔴 **missing** | — | Idem. Hoy los reintentos **se descartan** (best-of), no se guardan. |

**Balance: 2 exists / 5 partial / 4 missing.** Y las cuatro `missing` son exactamente las
que hacen falta para medir *rendimiento*, que es lo que el brief quiere que el Score mida.

---

## 7. Recomendación senior

### Ruta: **D — rediseñar el score antes de tocar Leaders**

Con dos precisiones importantes:

**(a) R1 no es parte del rediseño. Es un incidente abierto y va antes que todo.**
Hoy cualquiera puede escribir cualquier score en cualquier wallet con un `curl`. Mientras
eso siga así, mejorar la fórmula es decorar una tabla que no significa nada, y **cualquier
reward futuro atado a estos datos es indefendible**. Esto se arregla con firma de wallet en
el write path y un techo real en `/api/scores/save` — no requiere ninguna decisión de
producto, ni tabla nueva, ni tocar Leaders.

**(b) La ruta D es más barata de lo que suena, porque tres piezas ya están construidas:**

| Lo que hace falta | ¿Existe? |
|---|---|
| Timestamp por evento de score | ✅ `score_saves.created_at` — presente y **sin usar** |
| Idempotencia por día | ✅ `focus_day_ledger UNIQUE(wallet, season_id, date_utc)` |
| Dificultad autorada | ✅ `Exercise.tier`, poblado, **sin usar** |
| Anti-farming por repetición | ✅ best-of + `MAX()` + `UNIQUE(save_id)` |
| Noción de temporada | ✅ `season_id` |
| Identidad de intento | ❌ **el único hueco estructural real** |

El rediseño es, en lo esencial, **empezar a usar datos que ya están guardados** más un
concepto nuevo (el intento). Eso no es una reescritura.

### Por qué no las otras

- **A (solo presentación)** — no. R1 sigue abierto y R2/R4 hacen que la presentación esté
  mostrando un ranking alfabético de wallets. No hay presentación que arregle eso.
- **B (ajustar cálculo sin migrar)** — insuficiente. Se puede hacer weekly hoy con
  `created_at`, y eso solo ya mata R3/R4 — pero sin identidad de intento el score sigue sin
  medir rendimiento, que es el objetivo declarado. Sirve como paso intermedio, no como
  destino.
- **C (solo persistencia mínima)** — necesario pero no suficiente: agrega los campos y deja
  la fórmula rota y el write path abierto.

---

## 8. Slice mínimo siguiente

Ordenado por dependencia. Cada slice es independiente y entregable.

**Slice 0 — Cerrar el write path** *(seguridad, no producto; no toca Leaders ni la fórmula)*
- Exigir prueba de posesión de wallet en `POST /api/scores/save` (firma sobre el payload).
- Aplicar un techo real al `score` en ese endpoint (hoy solo existe en el carril on-chain).
- Decidir el bypass de `enforceOrigin` con la telemetría que ya se está recogiendo.
- Corregir el desborde potencial de `SUM(...)::int` (R13).
- **Salida:** los datos del leaderboard pasan a ser defendibles. Nada visible cambia.

**Slice 1 — Decidir el open question de infra** *(1 pregunta, 0 código)*
- ¿LEARN y PLAY comparten proyecto Supabase? De la respuesta depende si R12 es un bug vivo.

**Slice 2 — Ventana temporal** *(sin migración)*
- Vista `leaderboard_weekly_v` sobre `score_saves.created_at` (+ `scores.created_at`).
- Desempate por días activos → mejor score → `created_at`, **nunca por `player ASC`**.
- **Salida:** R3 y R4 muertos. Todo jugador nuevo compite desde el lunes.

**Slice 3 — Identidad de intento** *(la única migración necesaria)*
- Registrar cada intento: `attemptIndex`, `hintsUsed`, `tier`, `surface`, `movesUsed`,
  `optimalMoves`. Sin borrar los reintentos.
- **Salida:** first/best/final pasa a ser una decisión reversible; §5.1 y §5.2 se vuelven
  construibles; 4 de las 11 señales de consistencia pasan de `missing` a `exists`.

**Slice 4 — Exercise Score y Daily Focus Score** *(fórmula, sobre datos ya persistidos)*

**Slice 5 — Proof of Consistency** *(último, y solo cuando haya ≥1 temporada de datos reales)*
- Construirlo sobre datos **observados**, nunca sobre `backfill_streak`.

---

## 9. Go / No-Go

| Ítem | Veredicto |
|---|---|
| **Construir un nuevo leaderboard hoy** | 🔴 **NO-GO** — construirlo sobre R1 abierto es construir sobre datos que cualquiera puede escribir. |
| **Definir rewards sobre el score actual** | 🔴 **NO-GO** — indefendible ante el primer jugador que pregunte cómo se calculó. |
| **Slice 0 (cerrar el write path)** | 🟢 **GO inmediato** — no depende de ninguna decisión de producto pendiente. |
| **Slice 2 (ventana weekly)** | 🟢 **GO** — sin migración, mata los dos riesgos `high` más visibles. |
| **Slice 3 (identidad de intento)** | 🟢 **GO** — es el único hueco estructural; todo lo demás depende de él. |
| **Slices 4–5** | 🟡 **HOLD** hasta que 0/2/3 estén en `main`. |
| **Tocar Focus Passport / Daily / UI de Leaders** | 🔴 **NO-GO** — fuera de alcance y no hace falta para nada de lo anterior. |

---

## 10. Slice 0 — entregado 2026-07-29

Cierra el write path off-chain. **No** cambia la fórmula de score, el agregado del
leaderboard, la UI de Leaders, Focus Passport, pagos ni entitlements.

### Qué cambió

| Propiedad | Antes | Ahora |
|---|---|---|
| Autoría | `player` venía del body | Recuperada de una firma **EIP-191**; **no existe** campo `player` en el body |
| Techo de score | solo `> 0` | `1 ≤ score ≤ MAX_SCORE_PER_LEVEL` (30.000), server-side |
| Nivel / tiempo / chain | `levelId` 1..6, resto libre | validados, más `chainId` contra el deployment |
| Replay | ninguno | ventana ≤ 5 min + **nonce de un solo uso** en Postgres |
| Origin sin headers | bypass silencioso y **único** guard | permitido pero **logueado**, y ya no autentica nada |
| Superficie | inexistente | `surface` firmada y contrastada con el modo del deployment |
| Agregado | `SUM(...)::int` → *raise* al desbordar | `bigint` |

### Por qué EIP-191 y no EIP-712

Documentado en el header de `lib/scores/save-authorization.ts`. Resumen: es el único método
ya probado en producción **en este repo** sobre las dos wallets que el producto usa
(`useSignMessage` en el claim del Welcome Gift, verificado con `verifyMessage` de viem en
`lib/server/welcome-pack.ts`; `/dev/sign-probe` lo confirmó en un MiniPay real; el embedded
de Privy es una EOA). EIP-712 exigiría un `verifyingContract` y aquí no hay contrato — sería
un dominio inventado. Además el texto firmado es **lo que el jugador ve** en el prompt: que
nombre el score y la superficie es una propiedad de seguridad, no cosmética.

### ⚠️ Estado residual de R1 — lo que Slice 0 NO cerró

R1 está cerrado **en `/api/scores/save`**. Dos superficies conservan el defecto original y
quedaron deliberadamente fuera de alcance:

1. **`/api/sign-score` + `/api/cache-score` (carril on-chain).** `sign-score` sigue firmando
   cualquier score que le pidan (acotado a `MAX_SUBMITTABLE_SCORE`) sin prueba de posesión
   de wallet, y `cache-score` sigue aceptando `player` desde el body. Cuesta gas, lo cual
   frena el abuso masivo pero no lo impide. **Cerrarlo es un slice propio.**
2. **La cola de claims del perfil** (`profile-sheet.tsx:211`) usa ese mismo carril.

Además, el techo de 30.000/nivel es un **guard de DoS/overflow, no un anti-cheat**: sigue
sin haber progreso server-side contra el cual derivar un techo real por jugador. Eso es
Slice 3 (identidad de intento), tal como decía §8.

### 🚩 Decisión bloqueante — RESUELTA en Slice 0.1 (§11)

El auto-save es silencioso (`useEffect` en `exercises-screen.tsx`, dispara con cada score
nuevo). Con firma por save, eso significaba **un prompt de wallet por cada mejora de
estrellas**. Se eligió la opción **(b)**: challenge server-issued → token de sesión.
Implementada abajo.

### Rollback

Ver §11 — el rollback de Slice 0 y Slice 0.1 es uno solo, y el orden importa.

### Verificación ejecutada

- `vitest run` completo: **540 archivos, 6227 tests, exit 0**.
- Tests nuevos: 77 (`save-authorization` + ruta), con **firmas viem reales**, no un verifier
  mockeado.
- `tsc --noEmit`: limpio. `next lint`: sin warnings.
- Migración aplicada contra **Postgres local** (`supabase_db_web`), re-ejecutable.
- Probes SQL (en transacción, con `ROLLBACK`): `surface` persiste; `duplicate` no crea
  segunda fila; superficie inválida rechazada por el propio RPC (`22023`); replay de nonce
  rechazado (`23505`); mismo nonce con otra wallet permitido; purga solo lo expirado.
- **R13 probado empíricamente:** `total_score = 4.000.000.000` se devuelve como `bigint` en
  vez de hacer *raise*.
- **No ejecutado:** smoke en dispositivo real de MiniPay y de Privy web. La equivalencia a
  nivel protocolo está probada en tests (ambas son EOA con `personal_sign`), pero el
  comportamiento del prompt en un device real requiere hardware — queda para el founder.

---

## 11. Slice 0.1 — sesión de escritura, entregado 2026-07-30

Cierra la decisión bloqueante de §10 sin debilitar nada de lo que Slice 0 estableció.

```text
una firma EIP-191  →  una sesión server-issued  →  N saves silenciosos
```

La propiedad de autoría **no cambia**. Cambia su granularidad: la wallet prueba posesión una
vez y el servidor emite un bearer token acotado a esa wallet, esa superficie, 2 horas y 25
escrituras. Un token robado vale como máximo 25 filas en una wallet — y **es revocable**,
cosa que una firma nunca fue.

### Contrato

```text
POST /api/scores/session/challenge   { wallet }
  → { message, sessionId, expiresAt, maxSaves }

POST /api/scores/session/authorize   { message, signature }
  → { token, sessionId, expiresAt, maxSaves }      # token: 256 bits, UNA sola vez

POST /api/scores/save
  Authorization: Bearer <token>
  { levelId, score, timeMs }                       # sin wallet: sale de la sesión
```

Mensaje canónico firmado (`Chesscito Score Session v1`): `chainId`, `wallet`, `surface`,
`sessionId`, `issuedAt`, `expiresAt`, `maxSaves`. **Todos los términos los decide el
servidor** — el cliente manda una wallet y recibe límites que no eligió. Esa es la
diferencia entre un challenge y un bearer token auto-emitido, y es por qué la ventana
elegida por el cliente en Slice 0 desapareció.

### Decisiones que vale la pena defender

| Decisión | Por qué |
|---|---|
| **Una tabla, dos etapas** (`token_hash IS NULL` = challenge pendiente) | Es **un objeto** observado antes y después de que el jugador acepte: mismo `session_id`, mismos términos. Separarlo obligaría a copiar cada término al autorizar e inventar qué pasa si la copia falla a medias. |
| **El token vive en memoria del módulo, no en storage** | Es una credencial bearer. Persistirla cambia el radio de exposición (XSS, device compartido, perfil sincronizado) a cambio de ahorrar un prompt tras un reload. Un prompt cada 2h es barato; una capacidad de escritura persistida no. |
| **Solo se guarda el SHA-256** | Un dump de la tabla no debe rendir una credencial usable. SHA-256 plano y no un KDF: la entrada son 256 bits de CSPRNG, no hay preimagen adivinable que ralentizar — un KDF solo agregaría latencia a cada save. |
| **La wallet sale de la fila, no del body** | "Un token escribiendo en la wallet de otro" deja de ser un caso *expresable*. Es estructural, no una validación que alguien pueda olvidar. |
| **Consumo = UN `UPDATE`** con `WHERE used_saves < max_saves` | El predicado se evalúa bajo el lock de fila. Dos saves concurrentes en `max-1` no pueden pasar ambos. Más un `CHECK (used_saves <= max_saves)` como respaldo de esquema. |
| **Se borra `score_save_nonces`** | Existía solo para hacer single-use una firma por save. Ya no hay firma por save, nunca se desplegó, nadie escribió en ella. Dejarla sería una tabla inexplicable en seis meses. |
| **Reintento exactamente UNA vez** | Un segundo reintento es un loop de prompts del que el jugador no puede salir — peor que un save fallido que puede reintentar a mano. Y **solo** ante `session_expired/revoked/invalid`: re-firmar no vuelve válido un score fuera de rango ni recarga un presupuesto gastado. |

### Parámetros (centralizados en `lib/scores/session-authorization.ts`)

| Parámetro | Valor | Razón |
|---|---|---|
| `SCORE_SESSION_TTL_SECONDS` | 2 h | Dimensionado contra la sesión de juego real: la cuota diaria son 10 ejercicios, que se terminan bien dentro de 2h. Menos re-promptea a mitad de sesión; mucho más convierte el token en credencial permanente en un device compartido. |
| `SCORE_SESSION_MAX_SAVES` | 25 | `HARD_MAX_EXTRAS` es 15 (10 + 2×5). Los saves disparan por **mejora**, no por ejercicio, así que hace falta margen. 25 cubre un día maxeado y deja un token filtrado en molestia, no en capacidad ilimitada. |
| `SCORE_SESSION_CHALLENGE_TTL_SECONDS` | 3 min | Cuán fresca debe ser la firma. **No** va en el mensaje: es política del servidor, no un término que el jugador acepta. |
| `EXPIRY_MARGIN_SECONDS` (cliente) | 60 s | Sin margen, un token que pasa el chequeo del cliente puede expirar en vuelo → 401 que el jugador vive como un save fallido al azar. |

### UX — cuándo se pide la firma

**Just-in-time, en el primer save puntuable.** Nunca al montar Learn, ni al abrir el Hub, ni
antes de completar un ejercicio. Dos saves que corren en el mismo tick se *coalescen* en un
solo prompt (`inFlight`), porque dos prompts seguidos para una sesión es exactamente la
confusión que este slice existe para eliminar.

El caché se invalida **por construcción**: está keyed por `(wallet, surface)`, así que cambiar
de wallet o de superficie es un miss, no una limpieza que alguien deba recordar. Disconnect y
unmount llaman `clearScoreSession()` para no dejar una credencial viva en memoria.

### MiniPay / Privy

A nivel protocolo **no hay nada que distinguir**: ambas son EOA y producen una firma
`personal_sign` estándar sobre los mismos bytes — que es precisamente por qué se eligió
EIP-191. Los tests afirman la propiedad honesta (el material de clave de cualquiera de las
dos funciona en igualdad de condiciones) en vez de fingir que el endpoint detecta un
proveedor.

### Rollback completo (Slice 0 + 0.1) — el orden importa

```sql
-- 1. Restaurar la firma de 8 args de save_basic_score (el código pre-Slice-0
--    la llama sin p_surface). Reaplicar 20260708120000_savescore_always_free.sql
drop function if exists public.save_basic_score(text,text,int,int,int,text,text,jsonb,text);

-- 2. Recién ahora, revertir el código (git revert de los dos commits).

-- 3. Opcional — el esquema es aditivo y puede quedarse sin daño:
drop function if exists public.consume_score_write_session(text);
drop function if exists public.authorize_score_write_session(text,text,text,text);
drop function if exists public.revoke_score_write_session(text);
drop function if exists public.purge_expired_score_write_sessions();
drop table if exists public.score_write_sessions;
alter table public.score_saves drop column if exists surface;
-- Las vistas bigint son compatibles hacia atrás; NO revertirlas.
```

⚠️ Revertir el código **antes** del paso 1 deja el endpoint viejo llamando una firma que no
existe → todos los saves fallan con 500.

### Verificación ejecutada

- Suite completa: **543 archivos, 6263 tests, exit 0**.
- `tsc --noEmit` limpio · `next lint` sin warnings · `next build` exit 0, con
  `/api/scores/save`, `/api/scores/session/authorize` y `/api/scores/session/challenge` en el
  manifiesto.
- Firmas **viem reales** en los tests de endpoint, no un verifier mockeado.
- Migración aplicada y **re-ejecutada** contra Postgres local (exit 0 ambas veces).
- **Concurrencia contra Postgres real** (no el mock single-thread de vitest):
  - 12 conexiones concurrentes consumiendo una sesión de `max_saves=3` → exactamente
    **3 `consumed`, 9 `exhausted`**, `used_saves = 3`. Ninguna carrera cruza el límite.
  - 12 racers autorizando **un** challenge → **1 `authorized`, 11 `already_used`**.
  - `CHECK` rechaza `used_saves > max_saves` incluso ante un `UPDATE` a mano.
  - Revocación idempotente; sesión revocada → `revoked`; expirada → `expired`.
  - `score_save_nonces` confirmada como inexistente tras la migración.
- **No ejecutado:** smoke en dispositivo real de MiniPay/Privy — requiere hardware.

---

## Anexo — Índice de archivos auditados

**Cálculo**
`lib/game/scoring.ts` · `lib/game/score.ts` · `lib/game/tour-score.ts` ·
`lib/game/progress-adapter.ts` · `lib/game/exercise-progress.ts` ·
`components/exercises/exercises-screen.tsx` (1016, 1026, 1260-1312, 1623-1720, 2161-2322)

**Persistencia cliente**
`hooks/use-save-score-state.ts` · `lib/daily/progress.ts` · `lib/daily/passport.ts` ·
`lib/daily/session-quota.ts` · `lib/game/labyrinth-progress.ts`

**Transporte**
`lib/scores/save-client.ts` · `lib/scores/save-service.ts` ·
`app/api/scores/save/route.ts` · `app/api/sign-score/route.ts` ·
`app/api/cache-score/route.ts` · `app/api/leaderboard/route.ts` ·
`app/api/focus-day/route.ts` · `lib/server/demo-signing.ts` (`enforceOrigin`,
`enforceScoreSaveRateLimit`)

**Write path endurecido (Slice 0 + 0.1)**
`lib/scores/save-authorization.ts` (superficie + cotas) ·
`lib/scores/session-authorization.ts` (mensaje canónico + política) ·
`lib/scores/session-client.ts` (caché e invalidación) ·
`lib/scores/deployment-surface.ts` ·
`lib/server/score-session-verification.ts` · `lib/server/score-session-store.ts` ·
`lib/server/score-save-origin.ts` ·
`app/api/scores/session/{challenge,authorize}/route.ts` ·
`supabase/migrations/20260729000000_score_save_write_path_hardening.sql` ·
`supabase/migrations/20260730000000_score_write_sessions.sql`

**Agregado / lectura**
`lib/server/leaderboard.ts` · `lib/supabase/queries.ts` ·
`supabase/migrations/20260609000000_score_saves_init.sql` ·
`supabase/migrations/20260610000000_leaderboard_combined_view.sql` ·
`supabase/migrations/20260611120000_leaderboard_onchain_flag_player_rank.sql` ·
`supabase/migrations/20260728000000_focus_day_ledger.sql`

**Render**
`components/exercises/leaderboard-sheet.tsx` · `components/exercises/persistent-dock.tsx`

**On-chain**
`contracts/ScoreboardUpgradeable.sol` · `lib/contracts/scoreboard.ts`

**Contexto**
`lib/stats/public-aggregator.ts` · `lib/stats/funnels.ts` · `lib/game/types.ts` ·
`lib/game/generated/puzzles.generated.ts` · `lib/feature-flags.ts`
