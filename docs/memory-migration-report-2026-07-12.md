# Reporte de migración — Memory refactor, PASE 1 (estructural)

**Fecha:** 2026-07-12 · **Alcance:** solo estructura. **Ningún statement compactado,
generalizado ni eliminado**, salvo el backlog duplicado (aprobado).

---

## 1. Archivos nuevos

### Memory store (`~/.claude/projects/…/memory/`)

| Archivo | Contenido movido desde | Bytes |
| --- | --- | --- |
| `MEMORY.md` (reescrito) | — | **2.2KB** (budget 6KB) |
| `project_current_state.md` | `MEMORY.md` § Current state | ~3.5KB |
| `project_hard_rules.md` | `MEMORY.md` § HARD RULES | ~6KB |
| `project_stack_facts.md` | `MEMORY.md` § Stack | ~1KB |
| `project_board_geometry.md` | `MEMORY.md` § Board architecture | ~1KB |
| `project_contract_deployments.md` | `MEMORY.md` § Smart contracts | ~1.5KB |
| `project_css_ui_gotchas.md` | `MEMORY.md` § CSS/UI patterns | ~2.5KB |
| `project_surfaces_map.md` | `MEMORY.md` § Surfaces / systems | ~4KB |
| `project_minipay_platform.md` | `MEMORY.md` § MiniPay (+ 1 línea de Infra) | ~1.5KB |
| `project_infra_ops.md` | `MEMORY.md` § Infra / ops | ~1KB |

### Repo

| Archivo | Rol |
| --- | --- |
| `docs/postmortems/2026-07-12-ghost-badge-overlay.md` | Incidente #220, causalidad completa |
| `docs/postmortems/2026-07-12-start-focus-rook-loop.md` | Incidente del loop + **mis dos diagnósticos equivocados** |

---

## 2. Secciones movidas

Las 10 secciones de `MEMORY.md` se movieron **verbatim**. `MEMORY.md` quedó como índice
puro: **ningún hecho vive ahí**, solo punteros + el orden de autoridad.

Ajustes del founder aplicados:
- ✅ El índice **no** repite el hash de `main` ni el NEXT → solo `[[project_current_state]]`.
- ✅ Pointer al backlog canónico conservado; contenido duplicado eliminado.
- ✅ Nombres completos: `project_stack_facts`, `project_current_state`, `project_board_geometry`,
  `project_contract_deployments`, `project_surfaces_map`, `project_minipay_platform`, `project_infra_ops`.
- ✅ `project_surfaces_map` marcado **como mapa**, con los hechos propios a normalizar listados dentro.
- ✅ Postmortems = causalidad e historia. Los `feedback_*` = invariantes. El índice no repite ninguna.

**Movimiento fuera de sección:** la línea "MiniPay no manda `Origin`/`Referer`" pasó de
§ Infra a `project_minipay_platform` — es una propiedad de la plataforma, no de la infra.
Queda una nota en `project_infra_ops` señalando el traslado.

---

## 3. DESVIACIÓN deliberada (requiere tu visto bueno)

**`HARD RULES` NO se redujo a wikilinks.** Se movió **verbatim** a `project_hard_rules.md`.

**Por qué:** tu regla 3 exige verificar que cada regla escrita alrededor de un link exista
dentro de su topic **antes** de reducir. Verificar 24 líneas × ~45 topics no cabía en este
pase sin riesgo de perder una regla normativa por descuido. Moverla íntegra es **lossless
y honesto**; el pase 2 abre cada topic, confirma, y recién ahí borra la prosa.

El archivo lleva el aviso adentro. **Cero reglas perdidas.**

---

## 4. Duplicados encontrados

| # | Duplicado | Resolución |
| --- | --- | --- |
| 1 | § Open backlog de `MEMORY.md` vs `docs/backlog/2026-07-10-backlog-index.md` | **Verificado ítem por ítem: el índice del repo cubre TODO, y con más detalle** (custom-errors, server-verified, cache-score, divergencia score/badge, edge-walls, social login, PRO growth, Welcome Package, Save Flow, Focus Passport P1.5, Deep Hint, prize-pool v2, observability). **Eliminado** de memoria; queda el pointer. |
| 2 | Incidentes (#220, loop) descritos en `MEMORY.md` **y** en commits | Movidos a postmortems. `project_current_state` conserva 1 línea de estado, sin causalidad. |

---

## 5. Conflictos encontrados y auditados contra el código

| # | Conflicto | Autoridad consultada | Fallo |
| --- | --- | --- | --- |
| 1 | Memoria: "pool **15**/pieza". Código: **10** por pieza. | `lib/game/generated/puzzles.generated.ts` | **NO era un error.** El pool de 15 es el **objetivo de diseño**; hoy hay **10 autorados**. La decisión #1 del topic dice literalmente "content gate = **10/15**". **Ambos hechos son verdaderos.** Anotado en `project_exercise_rotation` con la distinción explícita, en vez de "corregir" y perder el objetivo. |
| 2 | Memoria: `legacy-hub-client.tsx`. Código: `learn-hub-client.tsx` (renombrado hoy). | El repo | Ya no queda **ninguna** referencia stale en el store (grep limpio). |
| 3 | Memoria: "Lote 2.5 open". Realidad: superseded. | `docs/specs/2026-07-12-hub-tour-daily-first-spec.md` | Ya figuraba como ⛔ SUPERSEDED. Sin cambios. |
| 4 | `rook-gen-00q06dtn`: ¿ejercicio o laberinto? | `puzzles.generated.ts:1441` | **Es un LABERINTO.** Confundirlo me costó un diagnóstico equivocado. Anotado en `project_exercise_rotation` para que no vuelva a pasar. |

---

## 6. Statements propuestos para ELIMINAR

**Uno solo, y ya aprobado:** el contenido de § Open backlog en `MEMORY.md` (duplicado
verificado al 100% contra el índice canónico del repo). El pointer se conserva.

**Nada más se eliminó.** Ni un statement se compactó ni se generalizó en este pase.

---

## 7. Deuda para el PASE 2 (semántico) — NO ejecutado

1. **Verificar `project_hard_rules` línea por línea** contra sus ~45 topics. Mover lo que
   falte. Recién entonces reducir a wikilinks.
2. **Normalizar `project_surfaces_map`**, que acumuló hechos propios que no son punteros:
   - **Shields** (fórmula de display + invariante de reconciliación) → `project_shields_economy`.
   - **Daily/racha** (`recordDailyCompletion` como único escritor + sus 3 llamadores) →
     `project_daily_streak_invariants`. **Es la base de la incoherencia de la llama.**
   - **Content Loop** (las 3 puertas al rook) → `project_content_loop`.
   - **Path map** (offsets por columna) → `project_path_layout`.
   - **Score cap** → verificar si ya vive en `project_score_ceiling_invariant`.
3. Mismo tratamiento a `project_css_ui_gotchas`.
4. Auditar los 189 topic files existentes: cuántos están huérfanos (sin link desde ningún
   índice) y cuántos describen código que ya no existe.
