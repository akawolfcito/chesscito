# Handoff — Exercise Content 10/15 Milestone (2026-06-08)

**Cluster:** Rotation + Labyrinths — content wave 1 (Easy + Medium MVP).
**Status:** CLOSED. All six pieces at 10/15. Hard tier deferred to wave 2.
**Branch:** `main` · **Tip:** `2dae5798` · **Cero código de runtime nuevo** (solo catálogo de datos + tier metadata + tests de count).

---

## 1. Resumen ejecutivo

- **MVP de contenido Easy+Medium cerrado.**
- Las 6 piezas tienen **mínimo 10/15** ejercicios cada una.
- **Total: 60 ejercicios** (6 × 10).
- **Todos BFS-verificados** (hard-fail en `exercises-bfs-verifier.test.ts`, 60/60).
- `tier`, `objective`, `tags` ya existen como **metadata aditiva opcional** en el tipo `Exercise`.
- **Hard tier queda wave 2** (king-6/king-9 son las 2 únicas Hard existentes hoy).

Spec base: `docs/product/chesscito-rotation-and-labyrinths-2026-06-08.md`.
Backlog: `docs/product/chesscito-rotation-and-labyrinths-epics-2026-06-08.md` (epic CA — content authoring).

---

## 2. Estado por pieza

| Pieza | Total | Easy | Medium | Hard | Notas |
|---|---|---|---|---|---|
| Rook | 10/15 | 5 | 5 | 0 | rook-6..10 nuevos (rectas + obstáculos) |
| Bishop | 10/15 | 5 | 5 | 0 | bishop-6..10 nuevos (pivotes diagonales bloqueados) |
| Queen | 10/15 | 5 | 5 | 0 | queen-6..10 nuevos (rook+bishop combo, tope 3 por movilidad) |
| Knight | 10/15 | 4 | 6 | 0 | knight-5 reclasificado Medium; knight-6..10 rutas L |
| Pawn | 10/15 | 4 | 6 | 0 | pawn-5 reclasificado Medium; pawn-6..10 avance/captura/promotion-path |
| King | 10/15 | 4 | 4 | 2 | 9 existentes clasificados + king-8 resuelto; king-6/king-9 = Hard (7 movs) |

**Untiered: 0** en las 6 piezas.

Por qué Knight/Pawn son 4E/6M y no 5E/5M: un ejercicio existente (knight-5 = 3 saltos, pawn-5 = 3 movs) era genuinamente Medium por el rubric y se reclasificó honestamente en vez de mislabelearlo Easy.

Por qué King es 4E/4M/2H: king-6 y king-9 son endurance walks de 7 movimientos (banda 6+ = Hard por el rubric). King arranca wave 2 con **2/5 Hard ya hechos** (head start).

---

## 3. Commits incluidos

| Hash | Commit |
|---|---|
| `db50c58e` | feat(exercises): add tier metadata and expand Rook to 10 exercises |
| `d738b52e` | feat(exercises): expand Bishop to 10 exercises with tier metadata |
| `25ad807d` | feat(exercises): expand Queen to 10 exercises with tier metadata |
| `4b4d5836` | feat(exercises): expand Knight to 10 exercises with tier metadata |
| `2c0925f1` | feat(exercises): expand Pawn to 10 exercises with tier metadata |
| `2dae5798` | feat(exercises): expand King to 10 with tier metadata |

(El commit Rook también introdujo el tipo `ExerciseTier` y el bloque `TIER CRITERIA` en `exercises.ts`.)

---

## 4. Metadata contract

Campos añadidos a `Exercise` en `apps/web/src/lib/game/types.ts` (todos **opcionales + aditivos**):

```ts
export type ExerciseTier = "easy" | "medium" | "hard";

tier?: ExerciseTier;   // rotation + progression metadata
objective?: string;    // authoring-only pedagogical note
tags?: string[];       // lowercase kebab-case content tags
```

Notas:
- **`objective` es authoring EN-only, NO UI copy todavía.** Si se muestra al usuario en el futuro, se hará i18n EN/ES en otro commit.
- **`tags` son lowercase/kebab-case** (ej: `straight-line`, `blocked-file`, `detour`, `capture`, `diagonal-step`, `knight-l-shape`, `jump-over`, `promotion-path`, `one-step`, `blocked-square`).
- **La metadata es aditiva y NO cambia el runtime por sí sola.** Hoy nada la consume; la leerá el rotation engine cuando entre.
- **Criterio de tiers** documentado in-line en `exercises.ts` (bloque `TIER CRITERIA`): Easy 1-2 movs / Medium 3-5 movs / Hard 6+.

User-facing labels separados: `EXERCISE_DESCRIPTIONS` en `editorial.ts` (EN) + `messages/es.ts` (ES), con parity test (`exercise-descriptions.test.ts`). Cada id nuevo tiene su label EN+ES.

---

## 5. Testing / safety

- **BFS verifier hard-fail: 60/60** — cada `optimalMoves` declarado coincide con el mínimo BFS real (engine de verdad vía `getValidTargets`).
- **TypeScript clean** (`tsc --noEmit`, exit 0).
- **Full suite verde: 3172/3172** (`pnpm vitest run --max-workers=2`).
- **Eslint clean** en todos los archivos tocados.
- **Migration stars safe:**
  - Pools 5→10 (Rook, Bishop, Queen, Knight, Pawn): legacy `stars[5]` se pad a 10 con ceros, valores preservados, `totalStars` y `exerciseIndex` intactos.
  - King 9→10: mismo path de padding.
- **King append-only:** `PieceProgress.stars` mapea al array por índice. king-8 se **appendó en index 9** (no se insertó en orden numérico) para NO remapear el progreso de usuarios King existentes. Índices 0-8 (king-1..7, king-9, king-10) quedaron congelados. Se detectó y evitó un reorder que habría corrompido el progreso live.
- **Tests de count actualizados:** `queen-rules` (5→10), migration King (9→10), telemetry senda (Rook 5→10, King 9→10). El test "verbatim cuando count=5" migró de pieza en pieza (bishop→queen→knight→pawn) y, al quedar todas en 10, se convirtió en "verbatim cuando length == count (10)".

---

## 6. Qué NO cambió

- ❌ No rotation engine.
- ❌ No UI.
- ❌ No Peones.
- ❌ No badge/progress (10★ threshold, 3★/ejercicio intactos).
- ❌ No Coach/PRO/ledger.
- ❌ No payment rails.
- ❌ No motor de movimiento (cero en passant, coronación, jaque, enroque, oposición, checkmate logic).

Pawn especial: solo se usaron reglas ya modeladas por el engine (avance fwd1/fwd2 desde rank inicial, captura diagonal vía `captureTargets ∪ targetPos`, obstáculos). pawn-9 (`d2→e5`, isCapture sin captureTargets) confirmado correcto: la captura diagonal cae solo sobre `targetPos`, patrón idéntico al pawn-5 existente.

---

## 7. Decisiones relevantes

- **10/15 aprobado como MVP de contenido** (Easy + Medium por pieza). Founder 2026-06-08.
- **Hard tier (×5 por pieza → 15/15) queda wave 2.**
- **Rotation engine puede arrancar con 10/15** (no necesita el pool completo de 15).
- **10★ se calcula across pool** (suma de estrellas únicas en todo el pool de la pieza) cuando el rotation engine entre. Badge contract intacto.
- **PRO/free mismo ritmo educativo** — PRO no adelanta tiers; diferencia por 2do Daily Lab, hints/retries, coach premium, themes, historial.
- **Guest:** canonical 5 → wallet prompt post-5 → `session_uuid` fallback.

(Detalle en el spec §10 y el handoff `2026-06-08-rotation-and-labyrinths-epics-handoff.md`.)

---

## 8. Próximo fork recomendado

**Opción A — Rotation engine con 10/15 (RECOMENDADO):**
- Siguiente paso natural.
- Valida el modelo híbrido **tier progression + daily rotation** con contenido real ya listo.
- Stories: ER-1..7 (engine + seed determinístico + guest model) + TP-1..6 (tier gates 5★/9★ + 10★ across pool).
- El contenido ya clasificado por `tier` desbloquea el bias del selector y los gates sin más authoring.

**Opción B — Hard tier 15/15 (wave 2):**
- Útil DESPUÉS de validar la rotación (no antes).
- King ya tiene head start 2/5 Hard; faltan 5 Hard por pieza en las otras 5 + 3 en King.
- Riesgo de autorear contenido que la rotación todavía no ejercita.

**Recomendación final:** **arrancar rotation engine antes que Hard tier.** Validar que el modelo de rotación + tiers funciona con 10/15 da señal real antes de invertir en 25 ejercicios Hard más.

---

## 9. Archivos clave

- Catálogo: `apps/web/src/lib/game/exercises.ts`
- Tipo + tier: `apps/web/src/lib/game/types.ts`
- BFS engine compartido: `apps/web/src/lib/game/exercise-bfs.ts` + verifier `__tests__/exercises-bfs-verifier.test.ts`
- Descripciones: `apps/web/src/lib/content/editorial.ts` (EN) + `messages/es.ts` (ES)
- Migration/telemetry: `apps/web/src/hooks/__tests__/use-exercise-progress-{migration,telemetry}.test.ts`
