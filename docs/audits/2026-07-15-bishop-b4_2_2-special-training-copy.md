# Bishop B4.2.2 — Copy genérico de Special Training (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** microajuste de copy presentacional/i18n. Sin B4.3; sin tocar path.ts/catálogo/progreso/adapter/navegación.

---

## 1. Cambio aplicado

Las tres etiquetas chrome del canal Special Training (compartidas por Rook Rails y Pivot Challenge)
dejan de filtrar "Labyrinth". Solo se cambiaron **strings** en la capa i18n existente — cero lógica,
cero IDs. El copy se deriva del contexto Special Training existente (`LABYRINTH_COPY` /
`MISSION_BRIEFING_COPY`), común a todo lo proyectado por ese canal.

| Clave (namespace) | EN antes → después | ES antes → después |
|---|---|---|
| `MISSION_BRIEFING_COPY.nowLabyrinthFormat` | "Now: Labyrinth {n}" → **"Now: Special Training {n}"** | "Ahora: Laberinto {n}" → **"Ahora: Entrenamiento especial {n}"** |
| `MISSION_BRIEFING_COPY.nowLabyrinthAriaFormat` | "Start Labyrinth {n}" → **"Start Special Training {n}"** | "Empezar Laberinto {n}" → **"Empezar Entrenamiento especial {n}"** |
| `LABYRINTH_COPY.exitLabyrinth` | "Exit Labyrinth" → **"Exit Training"** (CSS → "EXIT TRAINING") | "Salir del Laberinto" → **"Salir del entrenamiento"** |
| `LABYRINTH_COPY.completeTitle` | "Labyrinth Solved!" → **"Training Complete!"** | "¡Laberinto Resuelto!" → **"¡Entrenamiento completado!"** |

## 2. Archivos modificados

- `src/lib/content/editorial.ts` — 4 strings EN (source; `en.ts` los bundlea)
- `src/lib/content/messages/es.ts` — 4 strings ES
- `src/components/exercises/mission-detail-sheet.tsx` — 1 comentario (higiene, no copy visible)
- `src/components/exercises/__tests__/mission-detail-sheet.test.tsx` — aserciones al copy nuevo
- `src/components/exercises/__tests__/celebration-order.test.tsx` — aserciones al copy nuevo
- `e2e/pivot-real-flow.spec.ts` — asserts "Exit Training" + "Training Complete!"

## 3. Superficies donde NO se generalizó (reportadas)

Estas mantienen "Labyrinth"/"Laberinto" intencionalmente o por estar **fuera de la lista aprobada** —
requieren decisión antes de tocarlas:

1. **⚠️ Nodo del drawer "Labyrinth N"** (ExerciseDrawer). Sigue diciendo "Labyrinth 1/2/3" para los
   pivots — **filtra el término**, pero NO estaba en las 3 etiquetas aprobadas. Es la superficie más
   visible pendiente. Confirmar si extender el copy genérico también ahí.
2. **`LABYRINTH_COPY` pedagógico de Rook Rails** (condición 5): `toggleLabyrinths` ("Labyrinths"),
   `tryLabyrinth`, `orTryLabyrinth`, `missionTitle` ("Labyrinth"), `missionHint`. Son naming intencional
   de Rook Rails; **intactos**. (En modo pivot no se muestran: el prompt reemplaza `missionHint` y el chip
   muestra la casilla, no `missionTitle`.)
3. **Claves de acción internas** `enterLabyrinth`/`exitLabyrinth` (identificadores → íconos, no copy):
   **intactas** (cambiarlas sería tocar comportamiento, no presentación).

## 4. Validación

- **Rook Rails sigue funcionando:** `rook-rails-shots.spec.ts` **5/5** (4 rails + regresión).
- **Pivot Challenge sigue funcionando:** `pivot-real-flow.spec.ts` **5/5** (incluye "Exit Training" +
  "Training Complete!" + ES) · `pivot-spike.spec.ts` **6/6**.
- **Unit impactadas:** `components/exercises` + `lib/content` + `components/redesign` → **438/438** (37 files).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 5. Veredicto

### 🟢 DONE (sin commit)

Las tres etiquetas que filtraban "Labyrinth" ahora usan terminología genérica de Special Training (EN/ES),
solo en la capa i18n, sin tocar arquitectura. Rook Rails y Pivot Challenge verificados. **Pendiente de tu
decisión:** si el **nodo del drawer "Labyrinth N"** también debe generalizarse (superficie visible fuera
de la lista aprobada). B4.3 no iniciado.
