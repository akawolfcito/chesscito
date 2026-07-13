# PASE 3 — Aplicación de los fallos del founder

**Fecha:** 2026-07-12 · Sin tocar código. Sin resolver la incoherencia de la llama.
**Nada se borró, fusionó ni compactó.** Todo son adiciones y anotaciones.

---

## Resultado en el grafo

| Métrica | Antes | Después |
| --- | --- | --- |
| Topics | 201 | **202** (nuevo: `project_dev_probes_index`) |
| Root-indexed | 19 | **20** |
| Alcanzables | 156 (78%) | **166 (82%)** |
| Huérfanos | 45 | **36** |
| **Links rotos** | 0 | **0** ✅ |

Los 36 huérfanos restantes **quedan como arqueología buscable por nombre**, tal como
fallaste. No se maximizó el porcentaje: se indexó lo **vivo**, nada más.

---

## Los seis arreglos mecánicos — APLICADOS

1. ✅ `project_infra_ops` → `[[project_founder_status_forno_partial_2026_06_03]]` (estaba
   citado en prosa, sin link).
2. ✅ `project_hard_rules` → `[[feedback_visual_over_text]]` (regla normativa que estaba
   huérfana).
3. ✅ `project_css_ui_gotchas` → `[[project_scene_rooted_vocabulary]]` (vocabulario **vivo**:
   `StonePedestal`, `PrincipalButton`, `VictoryPopupShell` — lo consumí esta misma sesión
   sin saber que el topic existía), `[[feedback_animation_resources]]`,
   `[[feedback_ux_pattern_references]]`.
4. ✅ Cluster de perf → **UN SOLO entry point** desde `project_infra_ops`:
   `[[project_js_cluster_analysis_next]]`, y desde ahí se alcanza el resto. **No se
   agregaron cuatro links paralelos.**
5. ✅ Taxonomía de rachas (abajo).
6. ✅ RainbowKit marcado como removido dentro del cluster histórico, **sin borrar el
   análisis**.

---

## Fallo A — `project_hub_perf_cluster_2026_06_03` = HISTORICAL

Marcado en el `description` (`[HISTORICAL 2026-06-03]`) y con un bloque al tope:

> **RainbowKit fue REMOVIDO** (P2, 2026-06-12 — el comentario está en
> `learn-hub-client.tsx`). Cualquier lever que razone sobre `@rainbow-me/rainbowkit` ya no
> aplica. **NO reemplazar el análisis por la implementación actual**; si hace falta un
> análisis de perf vigente, va en un topic nuevo.

Su análisis y sus mediciones quedaron **intactos**.

---

## Fallo B — El rail de PRO. **Mi auditoría acusó mal a un topic.**

### `project_monetization_consolidation` — NO ESTÁ STALE. Sin cambios.

El pase 3B lo marcó por citar `lib/pro/purchase.ts`. **Leído completo, dice exactamente lo
contrario de lo que asumí** (líneas 51-52):

> `executeProPurchase`/`lib/pro/purchase.ts` **deleted (zero remaining callers)**. 4609/4609
> green.

**Nombra el archivo porque documenta que lo borró.** Es historical-valid y **correcto**.
"Corregirlo" habría sido vandalismo sobre un topic sano. **Lección: una referencia a un
archivo inexistente no es evidencia de staleness — puede ser el registro de su borrado.**

### `project_pro_phase_0` — dos afirmaciones stale, anotadas (no reescrito)

Clasificación de cada afirmación contra el rail actual:

| Afirmación | Clase | Evidencia |
| --- | --- | --- |
| itemId 6 · $1.99 · 30 días · stablecoin | **vigente** | `shop-catalog.ts` |
| `POST /api/verify-pro` · `GET /api/pro/status` | **vigente** | ambas rutas existen |
| `lib/pro/is-active.ts` · `lib/pro/use-pro-status.ts` | **vigente** | existen |
| **`lib/pro/purchase.ts` (`executeProPurchase`)** | **🔴 ARQUITECTURA SUPERSEDED** | **borrado** en PR #161 (2026-07-01). Hoy: **`lib/pro/use-pro-rail.ts`** (`useProRail`, rail **no-approve**) + `pro-rail-error.ts`, orquestado por `useProSheetState()` |
| Bypass en `app/api/coach/analyze/route.ts` | **vigente** | el archivo existe |
| **`<ProChip>` "floating top-right in `/play-hub`"** | **🔴 RUTA INEXISTENTE** | no hay ruta `/play-hub`: el hub de PLAY se sirve en **`/`** bajo `CHESSCITO_MODE=play`. El componente vive en `components/pro/pro-chip.tsx` |
| Registro on-chain · pasos operativos · freeze de 7 días · telemetría · limitaciones | **histórico** | correcto para su fecha |

**Sin ambigüedades residuales**, así que apliqué la anotación en vez de escalarte el fallo.
Las dos afirmaciones stale quedaron marcadas al tope del topic con su equivalente actual.
**El resto del topic no se tocó.**

---

## Fallo C — Solo lo vivo se indexó

Indexados: `feedback_visual_over_text` · `project_scene_rooted_vocabulary` ·
`feedback_animation_resources` · `feedback_ux_pattern_references` ·
`project_founder_status_forno_partial_2026_06_03` · el cluster de perf (via 1 entry point).

**Los 36 restantes se quedan como están.** Ninguno borrado.

---

## Fallo D — `project_dev_probes_index` CREADO

Enumera las **22 rutas** (`app/dev/**` + `app/lite-debug/**`, más `api/dev/*`), cada una con
**source, gate, side effects y si ejercita la pantalla real**.

**Mecanismo de drift verificable** (dentro del topic):

```
git ls-files "apps/web/src/app/dev/**/page.tsx" "apps/web/src/app/lite-debug/**/page.tsx" | wc -l
```

**Debe dar 22.** Si no, la tabla está vencida.

### Dos hallazgos del enumerado

1. **`/dev/reset` NO tiene gate de entorno, y está bien.** Su docstring lo argumenta: solo
   borra el localStorage **del propio visitante** ("harmless by construction"). Borra toda
   clave `chesscito*`. **Pero NO borra los Peones (server-side) ni los badges on-chain** →
   un reset deja `badgeClaimed: true` con cero estrellas. Para pizarra limpia: wallet nueva.
2. **La regla del gate quedó registrada:** `VERCEL_ENV === "production"`, **nunca**
   `NODE_ENV` — preview corre con `NODE_ENV=production` y el probe se 404ea justo donde se
   valida.

**Y el motivo por el que este topic existe:** las rutas cuelgan de **`app/dev/`**, no de
`app/[locale]/dev/`. Buscar bajo `[locale]` no encuentra nada — **así fue como le dije al
founder que `/dev/reset` no existía.** El topic lo dice en su primer párrafo, para que no
vuelva a pasar.

---

## Taxonomía de rachas — DECLARADA

En `project_daily_streak_invariants`, al tope:

> **"Streak" sin calificador es AMBIGUO — son TRES conceptos**, y dos comparten el nombre
> `streak` en el código.

| # | Concepto | Dónde | Qué mide |
| --- | --- | --- | --- |
| **S1** | Exercise **COMBO** | `lib/exercises/use-streak.ts` | Ejercicios seguidos sin fallar, en una sesión. **Es lo que el escudo protege** |
| **S2** | **Daily streak** (la llama) | `lib/daily/progress.ts` | Días consecutivos. Focus Passport |
| **S3** | Arena **win streak** | `editorial.ts` | Victorias seguidas en PLAY |

**El escudo protege S1, NO S2.** Confundirlos lleva directo a "Daily-Streak recovery", que
está prohibido para siempre.
