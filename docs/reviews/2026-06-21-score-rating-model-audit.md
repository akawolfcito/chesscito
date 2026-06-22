# Audit — Score/Rating Model (Exercises + Labyrinths + LEADERS)

**Date**: 2026-06-21  
**Scope**: read-only diagnosis. No code changes.  
**Commit verified against**: `6014b0d8` (last main HEAD at audit time)

---

## Q1 — ¿Dónde está definido "1200"?

No es una constante en código. Es un valor calculado en tiempo de ejecución:

```ts
// exercises-screen.tsx:1085
const POINTS_PER_STAR = 100n; // line 166
const score = useMemo(
  () => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR,
  [totalStars]
);
```

**1200 = 12 estrellas de ejercicio × 100 puntos/estrella.**

---

## Q2 — ¿Qué representa ese valor?

El score local del jugador para la **pieza actualmente seleccionada** (rook en Lite). Mide cuántas estrellas ha acumulado en los ejercicios de esa pieza, expresado en puntos.

---

## Q3 — ¿Qué inputs alimentan el score?

| Input | ¿Cuenta? | Fuente |
|---|---|---|
| Estrellas de ejercicios (pieza seleccionada) | ✅ SÍ | `calculateTotalStarsFromIdMap` |
| Laberintos | ❌ NO | No aparece en la fórmula |
| Daily Focus / streak | ❌ NO | Solo afecta Focus Passport |
| Badges / trophies | ❌ NO | Sistema separado |
| Ejercicios de otras piezas | ❌ NO | Solo pieza seleccionada actual |

---

## Q4 — ¿Dónde se calcula el score local?

`apps/web/src/components/exercises/exercises-screen.tsx:1085` — `useMemo` reactivo a `totalStars`.

`totalStars` viene de `useExerciseProgress(selectedPiece)` → `calculateTotalStarsFromIdMap(piece, progress.stars, catalog)` (`progress-adapter.ts:116`) → suma de `getPieceMasteryStars` por ejercicio en el pool de esa pieza.

---

## Q5 — ¿Cómo llega el score a LEADERS (Supabase)?

Flujo manual usuario → API:

1. Usuario toca "Save Score" (visible solo cuando `scorePendingNew = true`)
2. `exercises-screen.tsx` llama `POST /api/scores/save` con `{ player, levelId, score, timeMs, gameId, saveId }`
3. Route handler (`apps/web/src/app/api/scores/save/route.ts`) valida + llama RPC `save_basic_score`
4. RPC inserta en `score_saves` tabla (Supabase) — FREE las primeras N veces, cuesta Peones después
5. `leaderboard_combined_v` view combina `scores` (on-chain legacy) + `score_saves` (off-chain)
6. `total_score` en la view = `SUM(MAX(score) per level)` — suma de mejores scores del jugador por pieza

---

## Q6 — Diferencia entre los tres "scores"

| Variable | Dónde vive | Qué representa | Se actualiza cuándo |
|---|---|---|---|
| `localScore` (= `score`) | Memoria React | Estrellas actuales × 100 | Cada vez que cambia `totalStars` |
| `lastSavedScore` | localStorage `chesscito:save:{piece}` | Último score guardado en Supabase | Solo tras save exitoso |
| LEADERS `total_score` | Supabase `leaderboard_combined_v` | SUM de best scores por pieza | Solo tras save exitoso (con propagación DB) |

**Trampas:**
- `lastSavedScore` es por pieza, LEADERS es el total de todas las piezas del jugador.
- Si el jugador tiene rook=1200 y bishop=800, su LEADERS total es 2000, no 1200.

---

## Q7 — ¿Cuándo `scorePendingNew` es true/false?

```ts
// exercises-screen.tsx:1287-1311
const canSaveScore = Boolean(address) && isConnected && isCorrectChain && levelId > 0n;
const localScoreNum = Number(score);
const scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore;
```

**true** → wallet conectada, chain correcta, ≥1 estrella, Y score actual > último guardado.

**false** (casos comunes):
- Wallet desconectada o chain incorrecta (más frecuente en Lite — no se exige wallet)
- `totalStars = 0` (ningún ejercicio completado)
- `localScoreNum === lastSavedScore` (ya guardó este score — más frecuente que se crea)
- `localScoreNum < lastSavedScore` (imposible en práctica — estrellas solo suben)

---

## Q8 — ¿Los laberintos cuentan para el score?

**NO.** Completar un laberinto actualiza `labyrinthBests` (sessionStorage `chesscito:labyrinth-best:{piece}`) y desbloquea el siguiente nodo de entrenamiento, pero **no modifica `totalStars` ni el score**.

Hay CERO referencias a `labyrinthBests` en la fórmula `score = totalStars * 100n`.

---

## Q9 — ¿Los ejercicios cuentan para el score?

**SÍ, directamente.** Cada estrella ganada en un ejercicio suma 100 puntos al score del jugador para esa pieza. El sistema usa el **mejor resultado por ejercicio** (no el acumulado de intentos), lo que significa que re-intentar un ejercicio con menor resultado no baja el score.

---

## Q10 — ¿Qué pasa después de cada acción?

| Acción | `totalStars` | `localScore` | `scorePendingNew` | DB |
|---|---|---|---|---|
| Completar ejercicio con nueva ★ | ↑ | ↑ | → true (si wallet) | sin cambio |
| Completar ejercicio sin mejorar ★ | sin cambio | sin cambio | sin cambio | sin cambio |
| Completar laberinto | sin cambio | sin cambio | sin cambio | sin cambio |
| Save Score exitoso (nuevo score) | sin cambio | sin cambio | → false | nueva fila en `score_saves` |
| Save Score → "duplicate" | sin cambio | sin cambio | → false (API llama `recordSaveFor`) | sin cambio |
| Reconectar wallet | sin cambio | sin cambio | puede → true | sin cambio |

---

## Q11 — ¿Por qué el usuario ve 1200 en LEADERS y ya no puede subir?

Tres escenarios posibles:

**A) Ya guardó en 1200 y no ha completado más ejercicios**
- `lastSavedScore = 1200`, `localScore = 1200`
- `scorePendingNew = false` (equal, not greater)
- "Save Score" CTA no aparece
- LEADERS muestra 1200 (último guardado)
- **Fix necesario**: completar más ejercicios para subir `totalStars`

**B) Completó más ejercicios pero wallet desconectada**
- `localScore > 1200` pero `canSaveScore = false`
- "Save Score" CTA no aparece aunque haya progreso nuevo
- LEADERS sigue mostrando 1200
- **Diagnóstico**: verificar si wallet está conectada y en Celo

**C) Pool de ejercicios para rook tiene exactamente 12 estrellas máximas (score techo)**
- 12 ejercicios × 1★ máximo = 1200 (si ninguno da 2★ o 3★)
- O 4 ejercicios × 3★ = 1200
- El score no puede subir porque ya tiene todas las estrellas del pool
- `scorePendingNew = false` permanentemente
- **Esto es diseño correcto si el pool tiene cap**

---

## Q12 — Recomendaciones de producto

### Opción A — Status quo (no cambiar nada)
El modelo es coherente. 1200 = 12 estrellas = progress completo del rook si ese es el techo. LEADERS refleja el mejor save. **Ventaja**: cero riesgo de regresión. **Desventaja**: el usuario no entiende por qué el score no sube.

### Opción B — Mostrar breakdown en UI (mínimo, no rompe nada)
Debajo del score en LEADERS o en exercises screen: "12 stars × 100 = 1,200". Hace el modelo transparente sin cambiar lógica. **Esfuerzo**: 1-2h. **Riesgo**: cero.

### Opción C — Incluir laberintos en el score
Cambio de modelo: `score = (exerciseStars + labyrinthBonusStars) * POINTS_PER_STAR`. Da incentivo a completar laberintos. **Esfuerzo**: 1 sesión (spec → TDD). **Riesgo**: rompe el saveId dedup key y la lógica de `scorePendingNew` — requiere spec cuidadoso.

### Opción D — Multi-piece total en HUD (no solo pieza seleccionada)
Mostrar el `total_score` de LEADERS (suma de todas las piezas) en el HUD de exercises, no solo el score de la pieza actual. Ahora mismo el usuario ve "1200" para rook pero no ve que su score real en LEADERS puede ser 2400. **Esfuerzo**: 2-4h. **Riesgo**: bajo si es display-only.

### Opción E — Auto-save en background (sin CTA visible)
Eliminar el botón "Save Score". Guardar automáticamente después de cada ejercicio completado (debounced, silent). Requiere resolver el modelo de Peones para saves pagados. **Esfuerzo**: 1-2 sesiones. **Riesgo**: medio — el modelo de economía (free/paid) está en el RPC.

### Opción F — Score cap indicator
Si el pool de ejercicios del rook tiene un máximo de estrellas alcanzable, mostrar `1200 / 1200` en lugar de solo `1200`. El usuario sabe que llegó al techo. **Esfuerzo**: 2-3h (necesita calcular `maxPossibleScore` del pool). **Riesgo**: bajo.

---

## Hallazgos sin bug (diseño correcto)

1. **Dedup key correcta**: `${wallet}:${levelId}:${gameId}` donde `gameId = String(score)` garantiza idempotencia. Mismo score = duplicate, score mayor = nueva fila. Correcto.
2. **No hay race condition en saves**: el RPC es atómico (una transacción Postgres).
3. **`lastSavedScore` persiste en localStorage**: el jugador que rota de pieza y vuelve ve el mismo `lastSavedScore`. Correcto.
4. **LEADERS no lo muestran hasta save exitoso**: no hay score "optimistic" en la view (el optimistic score de sessionStorage solo afecta a la fila de "You" en `LeaderboardSheet.applyRows`). Correcto.

## Bugs encontrados

**Ninguno inequívoco** en el modelo de score. El comportamiento de "score atascado en 1200" es consecuencia de diseño correcto (score = current stars × 100, save es manual, CTA solo aparece cuando hay progreso nuevo).

---

## Resumen ejecutivo

El score de 1200 es determinista y correcto: el jugador tiene 12 estrellas de ejercicios del rook. El modelo no tiene bugs — si el CTA "Save Score" no aparece, es porque `localScore === lastSavedScore` o wallet desconectada. LEADERS muestra el total across piezas (SUM), no solo rook.

**Recomendación inmediata**: Opción B (mostrar breakdown) o Opción D (mostrar total cross-piece en HUD) — bajo esfuerzo, cero riesgo, transparencia para el usuario.
