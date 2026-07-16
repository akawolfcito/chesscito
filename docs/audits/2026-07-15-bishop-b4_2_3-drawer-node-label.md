# Bishop B4.2.3 — Label del nodo del drawer (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** solo el label del nodo de Special Training en `ExerciseDrawer`. Sin B4.3; sin tocar
path.ts/progreso/catálogo/adapter/navegación.

---

## 1. Regla aplicada

`label = specialTraining.title ?? "Special Training N"` — el título autorado gana; los labs sin título
caen al genérico. El título se deriva del **catálogo** (`specialTrainingCatalog[piece]`) y, para pivots, de
la **capa i18n** (`tPivot(\`title.${id}\`)`), **keyed por id solo para copy** (ningún comportamiento
depende del id).

- El drawer recibe un mapa `labyrinthLabels: Record<id,string>` (id → título resuelto/localizado) y resuelve
  `nodeLabel = labyrinthLabels[id] ?? specialTrainingLabelFormat`. Sustituye los 3 usos del viejo
  `labyrinthLabelFormat` ("Labyrinth N"): aria-label, texto sr-only y tooltip del nodo.

## 2. Copy final del drawer (EN / ES)

| Nodo | EN | ES |
|---|---|---|
| Pivot 1 | The Connector | El conector |
| Pivot 2 | Two Connections | Dos conexiones |
| Pivot 3 | Blocked Connection | Conexión bloqueada |
| Rook Rails | Two Turns / Dead End / Two Roads / Rook Run (títulos existentes, **conservados**) | (igual — sin ES en su fuente) |
| Fallback (labs sin título, p.ej. knight/pawn) | Special Training {n} | Entrenamiento especial {n} |

## 3. Archivos modificados

- `src/components/exercises/exercise-drawer.tsx` — prop `labyrinthLabels` + `nodeLabel` (3 usos)
- `src/components/exercises/exercises-screen.tsx` — `specialTrainingLabels` (mapa desde catálogo + i18n) → prop
- `src/lib/content/editorial.ts` — `specialTrainingLabelFormat` (EN, fallback)
- `src/lib/content/messages/es.ts` — `specialTrainingLabelFormat` (ES)
- `src/components/exercises/__tests__/exercise-drawer.test.tsx` — "Labyrinth N" → "Special Training N" (sin labels → fallback)
- `src/components/exercises/__tests__/celebration-order.test.tsx` — nodo del lab sin título → "Special Training 1"
- `e2e/rook-rails-shots.spec.ts` — selecciona el nodo por su **título** (ya no "Labyrinth N")
- `e2e/pivot-real-flow.spec.ts` — selecciona el nodo por su **título** (EN + ES)

## 4. Nota sobre la superficie del label

El nodo del drawer es **icono + badge numérico**; NO tiene un texto de título visible. El label
("Labyrinth N" antes, el título ahora) es el **nombre accesible + `sr-only` + tooltip** del botón. La
corrección actualiza esas superficies (verificado por `getByRole("button", { name: "The Connector" })`).
El badge numérico de escalera (1/2/3/4) se conserva. **Si se quisiera un título de texto VISIBLE bajo el
nodo, es un añadido aparte** (nuevo elemento) — no implicado por "corregir el label".

## 5. Validación

- **Rook Rails conserva y muestra sus títulos:** `rook-rails-shots.spec.ts` **5/5** (nodos por título).
- **Pivot Challenge muestra sus títulos (EN+ES):** `pivot-real-flow.spec.ts` **5/5**.
- **Drawer unit:** `exercise-drawer.test.tsx` + `celebration-order.test.tsx` verdes dentro de
  `components/exercises` + `lib/content` → **331/331** (33 files).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 6. Veredicto

### 🟢 DONE (sin commit)

El nodo del drawer usa el título real del Special Training (pivots localizados por i18n; Rook Rails con sus
títulos existentes), con fallback genérico "Special Training N" para labs sin título. Solo presentación +
i18n; sin tocar arquitectura. **Pendiente de tu decisión:** si el título debe también ser **texto visible**
bajo el nodo (hoy es nombre accesible + tooltip). B4.3 no iniciado.
