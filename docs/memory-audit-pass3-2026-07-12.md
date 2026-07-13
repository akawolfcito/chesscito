# Auditoría de memoria — PASE 3 (reachability · freshness · authority)

**Fecha:** 2026-07-12 · **Nada aplicado.** Sin borrar, fusionar ni compactar topics. Sin
tocar código. Sin resolver la incoherencia de la llama.

Grafo y refs construidos con script (`scratchpad/mem-audit.mjs`, `mem-fresh.mjs`), no a ojo.

---

## PASE 3A — Reachability

**Total: 201 topics** (subieron de 189: el refactor agregó 12).

| Clasificación | Conteo |
| --- | --- |
| **root-indexed** (link directo desde `MEMORY.md`) | **19** |
| **transitively reachable** (vía otro topic) | **137** |
| **orphans** (sin camino desde `MEMORY.md`) | **45** |
| **broken targets** (wikilink a un topic inexistente) | **0** ✅ |
| **ciclos aislados** (huérfanos que solo se enlazan entre sí) | **1 cluster (3 topics)** |

**156 de 201 alcanzables (78%).** Cero links rotos: el grafo es sano.

### Los 45 huérfanos

Casi todos son **clusters cerrados de 2026-04 a 2026-06** — arqueología, no deuda:

`project_candy_system_2026_04_18` · `project_candy_migration_state` · `project_visual_redesign` ·
`project_e3_visual_reset` · `project_spec1_hub_redesign` · `project_hub_migration` ·
`project_stabilization_sprint_2026_05_02` · `project_sprint_4_arc` ·
`project_stats_mvp_closed_2026_06_03` · `project_hub_perf_p0_1_cluster_2026_06_03` ·
`project_minipay_zero_click_p0_4_pass_2026_06_03` · `project_minipay_intake_packet_2026_06_04` ·
`project_surface_redistribution_2026_06_11` · `project_m1_monetization_cluster_complete` ·
`project_training_content_v01_cluster` · `project_labyrinth_v02_phase_b` ·
`project_labyrinth_v02_phase_c` · `project_learn_header_hud_polish_2026_07` ·
`project_landing_narrative_v06` · `project_pitch_video` · `project_pro_bundle_v1` ·
`project_pro_freeze_lifted` · `project_coach_v1_redesign` · `project_coach_polish_followups` ·
`project_chesscito_coach` · `coach-stale-wallet-param` · `project_mission_briefing_bug` ·
`project_learn_save_proof_gate_regression` · `project_header_consistency_canary` ·
`project_vr_baseline_drift` · `project_test_infra` · `project_disk_telemetry` ·
`project_react_dom_preload_route_scoped` · `project_scene_rooted_vocabulary` ·
`project_trophy_vitrine_idea` · `project_lore_narrative_deferred` ·
`project_procedural_board_for_labyrinth_builder` · `project_founder_status_forno_partial_2026_06_03` ·
`feedback_animation_resources` · `feedback_ux_pattern_references` · `feedback_visual_over_text` ·
`feedback_bundle_analyzer_no_autopen` (+ su cluster).

**Ciclo aislado:** `feedback_bundle_analyzer_no_autopen` → `project_js_cluster_analysis_next`
→ `project_perf_image_levers_2026_06_12` → `project_perf_push_render_delay_2026_06_12`.
Cadena de perf que se enlaza a sí misma y **no cuelga de ningún índice**.

### Huérfanos que SÍ deberían indexarse (propuesta, no aplicada)

| Topic | Por qué | Dónde colgarlo |
| --- | --- | --- |
| `feedback_visual_over_text` | Regla **normativa** de producto, hermana de `project_chesscito_visual_first_principle` (que sí está indexado). Una regla de producto huérfana es una regla que no se aplica. | `project_hard_rules` § producto |
| `feedback_animation_resources` · `feedback_ux_pattern_references` | Referencias reutilizables, no historia. | `project_css_ui_gotchas` |
| `project_founder_status_forno_partial_2026_06_03` | Lo cita `project_infra_ops` **en prosa** pero **sin wikilink** → quedó huérfano por un link faltante, no por obsolescencia. | Fix mecánico: agregar el `[[link]]` |
| `project_scene_rooted_vocabulary` | Vocabulario visual vivo (`StonePedestal`, `PrincipalButton`) que **usamos hoy** — de hecho lo consumí esta sesión sin saber que existía el topic. | `project_css_ui_gotchas` |
| El cluster de perf (4 topics) | Análisis vivo de bundle/imágenes, no historia cerrada. | Un solo link desde `project_infra_ops` alcanza |

**El resto (≈36) se quedan como arqueología alcanzable-por-nombre.** No son deuda: un
postmortem viejo no necesita estar en el índice para ser útil cuando lo buscás. **No
proponer borrado.**

---

## PASE 3B — Freshness

**306 referencias distintas a rutas de código.**

| Clasificación | Conteo |
| --- | --- |
| **current** (resuelve contra el repo) | **273 (89%)** |
| **basename-only** (el path de memoria difiere del real) | 3 |
| **no está en el repo** | 30 |

### De los 30 "no está": la mayoría NO son stale

**Unverifiable / patrones (11)** — no son rutas, son plantillas. **No tocar:**
`.claude/settings*.json` · `.openzeppelin/<network>.json` · `messages/<locale>.ts` ·
`apps/web/supabase/migrations/<timestamp>_<name>.sql` · `lib/contracts/*-event-abi.ts` ·
`lib/payments/get-peones-canary*.ts` · `settings.local.json` (gitignored).

**Falsos positivos de mi indexador (2):** `deployments/celo.json` **existe** — está
gitignored, así que `git ls-files` no lo ve. **Es current.**

**Historical-valid (13)** — viven en topics de clusters cerrados, y la ruta histórica es
**correcta para su momento**. Por tu regla: **conservar el nombre histórico**, no marcarlo
stale. `gameplay-panel.tsx` · `mission-panel.tsx` · `piece-picker-sheet.tsx`
(`project_candy_system_2026_04_18`) · `CoachWelcome.tsx` · `coach-paywall.tsx`
(`project_coach_v1_redesign`) · `hooks/use-hub-onboarding.ts` (`project_spec1_hub_redesign`) ·
`welcome-overlay.tsx` · `app/dev/_components/procedural-board.tsx` · `connect-button.tsx` ·
`monetization-telemetry.ts` · `scripts/disk-telemetry.sh` · las 3 `.sql` sueltas.

### REMOVED de verdad, en topics que describen implementación actual (4)

| Ref | Topic | Realidad |
| --- | --- | --- |
| `@rainbow-me/rainbowkit/styles.css` | `project_hub_perf_cluster_2026_06_03` | **RainbowKit fue REMOVIDO** (P2, 2026-06-12; el comentario lo dice en `learn-hub-client.tsx`). El topic describe un lever de perf sobre una dependencia que ya no existe. |
| `lib/pro/purchase.ts` | `project_pro_phase_0` · `project_monetization_consolidation` | No existe. Ambos describen el rail de PRO como vigente. |
| `vercel.json` / `vercel.ts` | `feedback_supabase_workflow` | Ninguno existe en el repo. |
| `supabase/migrations/20260419000000_enable_rls.sql` + su rollback | `project_supabase_rls_audit` | No están en el índice de git. |

### 🔴 Hallazgo que me corrige a mí

**`/dev/reset` EXISTE** (`apps/web/src/app/dev/reset/page.tsx`), y también
`app/lite-debug/reset/page.tsx`. **Esta misma sesión le dije al founder que no existía.**
Busqué bajo `app/[locale]/dev/` y la ruta cuelga de `app/dev/`. La memoria no tenía la
culpa: **la tenía yo.** Merece un topic (`project_dev_probes_index`) que enumere las **25
rutas `/dev/*`** que hay, porque son invisibles a menos que las busques bien.

---

## PASE 3C — Authority

Candidatos generados **por entidad compartida** (no comparación semántica N×N). 19 entidades
aparecen en ≥3 topics.

### Conflictos con autoridad clara — RESUELTOS

| # | Entidad | Topics | Statements incompatibles | Autoridad | Fallo |
| --- | --- | --- | --- | --- | --- |
| 1 | Flujo de merge | `feedback_auto_merge_prs_solo_main` vs `feedback_local_merge_single_push` | "abrir PR + auto-merge" vs "mergear local + un push" | Decisión del founder 2026-07-12 | **Ya resuelto en el pase 2.** El viejo quedó ⛔ OBSOLETO con lo que sobrevive listado. |
| 2 | `messages/en.ts` | `feedback_i18n_key_parity` · `project_i18n_es_en` · `project_anti_ai_prose_ceiling` | ¿Se edita a mano? | El header del propio archivo | **Sin conflicto.** Los tres coinciden: `en.ts` es **DERIVADO**. `feedback_i18n_key_parity` ya se auto-corrigió el 2026-07-11. |
| 3 | `lib/daily/progress.ts` | `project_daily_streak_invariants` (nuevo) · `project_minipay_delivery_audit_2026_07` | — | Código | **Sin conflicto: son complementarios.** Pero hay un **hueco**: el audit tiene la **taxonomía de las 3 rachas** (S1 COMBO de ejercicios `lib/exercises/use-streak.ts` · S2 Daily · S3 Arena win) y mi topic nuevo **no la enlaza**. Dos topics dueños de "streak" sin cruzarse es exactamente cómo nace una contradicción. |

### Casos que requieren TU fallo

| # | Caso | Por qué no lo decido yo |
| --- | --- | --- |
| A | **`project_hub_perf_cluster_2026_06_03` describe levers sobre RainbowKit, que ya no existe.** | ¿Es historia (se conserva tal cual, marcada) o implementación actual (se corrige)? Tiene ambas cosas mezcladas. |
| B | **`project_pro_phase_0` / `project_monetization_consolidation` citan `lib/pro/purchase.ts`, que no existe.** | El rail de PRO **sí** funciona hoy (`/api/verify-pro`). O el archivo se renombró y hay que actualizarlo, o el topic describe una fase superada. Requiere leerlos enteros contra el código. |
| C | **Los 45 huérfanos.** | Propongo indexar 8 y **dejar 37 como arqueología**. Ninguno se borra. Tu fallo sobre si querés más indexados. |
| D | **`project_dev_probes_index` (topic nuevo).** | 25 rutas `/dev/*` invisibles. ¿Lo creo? |

---

## Arreglos mecánicos SEGUROS (listos para aplicar, no aplicados)

1. `project_infra_ops`: agregar el `[[project_founder_status_forno_partial_2026_06_03]]` que
   falta (ya está citado en prosa). **Deshuerfaniza un topic con un solo link.**
2. `project_hard_rules`: indexar `[[feedback_visual_over_text]]` (regla normativa huérfana).
3. `project_css_ui_gotchas`: indexar `[[project_scene_rooted_vocabulary]]`,
   `[[feedback_animation_resources]]`, `[[feedback_ux_pattern_references]]`.
4. `project_infra_ops`: un link al cluster de perf (rompe el ciclo aislado).
5. `project_daily_streak_invariants`: cruzar con la **taxonomía de las 3 rachas** de
   `project_minipay_delivery_audit_2026_07`.
6. Marcar `@rainbow-me/rainbowkit` como **removido (P2, 2026-06-12)** dentro de
   `project_hub_perf_cluster_2026_06_03` — **sin borrar** el análisis histórico.

**Todos son adiciones de links o notas. Ninguno borra, fusiona ni compacta nada.**
