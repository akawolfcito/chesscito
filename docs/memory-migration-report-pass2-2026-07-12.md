# Reporte — Memory refactor, PASE 2 (semántico)

**Fecha:** 2026-07-12 · **Alcance:** 3 clusters. **Sin tocar código. Sin resolver la
incoherencia de la llama** (solo se representó una vez, en su topic dueño, y se enlazó
desde current state mientras siga abierta).

---

## Cluster 1 — `project_hard_rules`

**Método:** se verificó **cada afirmación atómica** (no la mera presencia del wikilink)
contra el topic dueño. Los topics con prosa sustantiva se leyeron completos; para las
glosas cortas se comparó contra la `description` del topic, que es su afirmación canónica.

### Huecos encontrados y COMPLETADOS antes de reducir

| # | Afirmación que vivía solo en `MEMORY.md` | Topic dueño | Acción |
| --- | --- | --- | --- |
| 1 | **"Dos suites verdes aisladas no prueban su composición."** Más las dos confirmaciones (#214 con 4900+ tests verdes; device pass con 4 defectos y 5000+ verdes) y el corolario **"un pase manual en device sobre un perfil real es lo único que ve esto"**. | `feedback_tests_green_against_dead_shape` | **Añadido.** El topic solo tenía los dos bugs de 2026-07-09. Era la regla más cara del proyecto viviendo en un índice. |
| 2 | **"Suite roja en masa → sospechar del entorno antes que del código."** | `feedback_stale_next_start_port_screenshot` | **Añadido** como corolario general ("el entorno miente antes que el código"). |
| 3 | ⛔ El flujo de PRs con auto-merge seguía descrito como **vigente**. | `feedback_auto_merge_prs_solo_main` | **Marcado OBSOLETO** en el `description` y con un bloque al tope. Se listó explícitamente **lo que SOBREVIVE** (gate = suite+`tsc` antes; nunca vigilar CI; rama primero; aterrizar en `main`; nunca tocar `production`). **Conflicto real:** una sesión futura podía cargarlo y seguir el flujo que dispara deploys de más. |

### Verificado sin cambios (afirmación presente en su dueño)

`feedback_command_hygiene` · `feedback_next_build_pipe_tail_truncation` ·
`feedback_plan_before_edit` · `feedback_aria_modal_not_role_dialog` ·
`feedback_local_merge_single_push` · `feedback_shell_env_overrides_dotenv_local` ·
`feedback_vr_baseline_discipline` · `feedback_dev_probe_mirrors_real_screen` ·
`feedback_deprecated_constant_outlives_migration` ·
`feedback_duplicate_union_defeats_tsc_migration` ·
`feedback_dispatch_without_write_is_a_noop` · `feedback_i18n_key_parity` ·
`feedback_payment_rail_fail_closed` · `feedback_no_chained_destructive_git` ·
`feedback_verify_subagent_citations` · `feedback_final_review_catches_composition_bugs` ·
y las 30 glosas restantes (working style, Supabase, Vercel env, hooks, on-chain, UI/copy,
proceso), todas confirmadas contra la `description` de su topic.

**Resultado:** `project_hard_rules` reducido a wikilinks, **agrupado por dominio**
(cómo trabajo · shell y git · por qué una suite verde no alcanza · el entorno miente ·
dinero y cadena · código · producto y UI). **Cero reglas perdidas.**

---

## Cluster 2 — `project_surfaces_map`

**Topics nuevos** (los hechos propios se movieron a sus dueños):

| Topic nuevo | Qué se llevó |
| --- | --- |
| `project_daily_streak_invariants` | `recordDailyCompletion` = único escritor del streak, sus 3 llamadores, `exercises-screen` NO lo llama. **Y la incoherencia de la llama, ABIERTA**, con la tabla de las tres nociones de "día". |
| `project_content_loop` | 10 variantes en prioridad · `daily-pending` = #1 · `selectPrimaryPiece`/`selectNextAvailablePiece` · **"trabajo pendiente" = ejercicios, los laberintos NO** · **toda entrada a `/exercises` debe nombrar su pieza** · la deuda de la tabla estática. |
| `project_shields_economy` | `min(3, credited − consumed)` · `credited` monotónico en Redis · **todo path que acredite reconcilia el espejo** · el escudo salva un EJERCICIO, no un día. |
| `project_path_layout` | base + tiles · `TILE_PADS` · **offsets POR COLUMNA** y por qué un solo knob era imposible. |

**Score:** ya vivía completo en `project_score_ceiling_invariant` (incluido "el cap es
validación de input, NO anti-cheat"). **No se duplicó.**

**Resultado:** `project_surfaces_map` es ahora una **tabla de rutas y dueños**. Ninguna
línea afirma nada normativo; cada una da un `dónde` y un `quién`.

---

## Cluster 3 — `project_css_ui_gotchas`

Clasificado por dominio (**layering · Tailwind/cascada · jerarquía visual y tokens ·
layout · OG · assets · design system**) y reducido a wikilinks. **No se creó un segundo
blob.**

Verificadas y presentes en sus dueños las 20 afirmaciones, incluida "WebP renderiza VACÍO
en `@vercel/og`" (`project_satori_og_perf_constraints:27`, con el archivo y las líneas que
lo documentan en el código).

**Nota:** los tokens del design system (colores, container 390px, touch ≥44px) **no** son
dueños de un topic: su fuente de verdad es **`DESIGN_SYSTEM.md` en el repo**. La línea
quedó como pointer, que es lo correcto.

---

## La llama (respetando tu instrucción)

- **No se resolvió.** No se tocó código.
- Queda representada **una sola vez**, en `project_daily_streak_invariants`, con la tabla
  de las tres nociones de "día" y la aclaración de que **el spec del Hub Tour la hace
  visible pero no la resuelve**.
- Enlazada desde `project_current_state` con un ⚠️ y la nota de que el link se queda
  **mientras siga abierta**.

---

## Estado del store

| Archivo | Rol | Tamaño |
| --- | --- | --- |
| `MEMORY.md` | Índice puro | **~2.6KB** (budget 6KB) |
| `project_hard_rules` | Índice normativo por dominio | ~3KB |
| `project_surfaces_map` | Tabla de rutas y dueños | ~3KB |
| `project_css_ui_gotchas` | Índice por dominio | ~2KB |
| + 4 topics nuevos | Dueños de sus invariantes | — |

## Pendiente: PASE 3 (no ejecutado)

Auditoría de los ~193 topics sobre tres ejes: **reachability** (huérfanos sin link desde
ningún índice), **freshness** (describen código que ya no existe), **authority** (dos
topics que se contradicen).
