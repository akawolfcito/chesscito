# Bishop B0 — Inventario (read-only)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Objetivo:** estabilizar currículo + Special Training del alfil usando la torre como baseline.
**Alcance B0:** solo inventario. No se cambió nada. Sin captura / multi-target / mecánicas nuevas.

Baseline de calidad = `docs/audits/2026-07-13-rook-curriculum-audit.md` (torre ya autorada y ordenada por maestría).

---

## 1. Fuentes de verdad

| Capa | Archivo | Rol |
|---|---|---|
| Contenido canónico | `apps/web/content/exercises.json` | 10 ejercicios alfil (editable por builder) |
| Contenido canónico | `apps/web/content/labyrinths.json` | 2 laberintos alfil |
| Derivado | `apps/web/src/lib/game/generated/puzzles.generated.ts` | FEN-decoded + BFS `optimalMoves` (`pnpm import-puzzles`) |
| Descripciones EN | `apps/web/src/lib/content/editorial.ts:1282-1291` | i18n title del alfil |
| Descripciones ES | `apps/web/src/lib/content/messages/es.ts:1916+` | i18n ES |
| Reglas de movimiento | `apps/web/src/lib/game/rules/bishop.ts` | 4 diagonales, ray-cast, blockers cortan |

**Overlay Git/Supabase:** el pipeline es content-sourced (`content/*.json` → generated). El overlay
de Supabase solo **appendea** ejercicios sobre el baseline (no muta bishop-1..10). No hay divergencia
Git: el generated es reproducible desde el JSON. `title/principle/learningObjective/playerPrompt`
en el JSON del alfil están **todos en `null`** — el contenido pedagógico vive solo en `editorial.ts`.

---

## 2. Ejercicios del alfil (10) — orden actual

| order | id | mover→target | tier | optimalMoves | tags | title (editorial) |
|---|---|---|---|---|---|---|
| 0 | bishop-1 | a1→h8 | easy | 1 | straight-line, long-diagonal | Main diagonal |
| 1 | bishop-2 | h1→a8 | easy | 1 | straight-line, long-diagonal | Anti diagonal |
| 2 | bishop-3 | d4→g7 | easy | 1 | straight-line | Short diagonal |
| 3 | bishop-4 | a1→g1 | easy | 2 | pivot | Two-move path |
| 4 | bishop-5 | c3→g3 | easy | 2 | pivot | Tricky route |
| 5 | bishop-6 | b2→f2 (N@d4) | medium | 3 | detour, blocked-diagonal | Blocked pivot |
| 6 | bishop-7 | c3→g3 (N@e5,N@e1) | medium | 3 | detour, blocked-diagonal | Twin pivot block |
| 7 | bishop-8 | a1→g7 (N@d4) | medium | 4 | detour, long-diagonal | Diagonal detour |
| 8 | bishop-9 | a1→g7 (N@f6,N@d4) | medium | 4 | friendly-blocker, detour | Capture detour |
| 9 | bishop-10 | a1→h8 (N@e5) | medium | 5 | detour, long-diagonal | Long diagonal wall |

FEN de cada uno registrado en `content/exercises.json`. Todos los obstáculos son caballos (`N`),
piezas amigas no capturables (consistente con el alcance "sin captura").

## 3. Laberintos del alfil (Special Training) — 2

| order | id | mover→target | FEN | obstáculos |
|---|---|---|---|---|
| 0 | bishop-lab-3 | c1→h6 | `8/8/8/6N1/8/4N3/8/2B5 w - - 0 1` | N@g5, N@e3 |
| 1 | bishop-lab-4 | a1→h8 | `8/8/8/4N3/8/2N5/8/B7 w - - 0 1` | N@e5, N@c3 |

**⚠️ Gap de numeración:** los ids son `bishop-lab-3` y `bishop-lab-4`. No existen `bishop-lab-1`
ni `bishop-lab-2` → verificar en B2 si fueron removidos (stale) o si es numeración heredada.

---

## 4. Contraste con baseline (torre)

| Dimensión | Torre (baseline) | Alfil (hoy) |
|---|---|---|
| Campos JSON pedagógicos | `title`, `principle`, `learningObjective` poblados | **todos `null`** |
| Orden | curado por maestría, con notas "Replaces X" | numérico crudo 1→10 |
| Dedup | explícito (rook-3/rook-5 reemplazados por diseño) | **sin dedup** — posibles redundantes |
| Test de pedagogía | `rook-pedagogy.test.ts` existe | **no existe `bishop-pedagogy.test.ts`** |
| Laberintos | Rook Rails niveles 1-3,5 con progresión | 2 tableros sin progresión declarada |

---

## 5. Banderas preliminares (a resolver en B1/B2 — NO tocar en B0)

- **Redundancia sospechada:** bishop-1/2/3 son los tres "una diagonal, 1 movimiento"; bishop-4/5
  ambos "pivot 2 movimientos"; bishop-8/10 ambos "a1 + detour en diagonal larga".
- **Mislabel:** bishop-9 title = "Capture detour" pero tag = `friendly-blocker` (caballo amigo
  **no capturable**). El wording implica captura → fuera de alcance y engañoso. (copiado de rook-9).
- **Tag `straight-line`:** aplicado a movimiento diagonal del alfil — semánticamente cuestionable
  (CLAUDE.md: "drop tags que el tablero no respalda"). Revisar en B1.
- **Cobertura pedagógica:** falta verificar si se enseña explícitamente "imposibilidad de línea
  recta" (el análogo alfil de rook-no-diagonal-1) y "permanencia en el mismo color".
- **Gap lab-1/lab-2:** posible contenido stale removido.

**Ningún cambio aplicado. Fin de B0.**
