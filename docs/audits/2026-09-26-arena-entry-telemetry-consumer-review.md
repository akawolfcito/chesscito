# Revisión de consumidores de telemetría de entrada de Arena

**Fecha:** 2026-09-26\
**Modo:** READ-ONLY\
**Eventos:** `arena_mount`, `arena_fresh_reset_fired`\
**Cutoff:** `2026-08-11T14:12:14.822368Z`

## Decisión

**SAFE AFTER SMALL AGGREGATE** para ambos eventos. Recomiendo conservar primero un agregado diario UTC de conteos por evento y ratio `arena_fresh_reset_fired / arena_mount`; después podría podarse el raw histórico anterior al cutoff. No se creó el agregado y no se ejecutó ningún DELETE.

No hay evidencia en el repositorio de un consumidor vigente de las filas raw anteriores al cutoff. La reserva restante es cualquier dashboard externo configurado fuera del repositorio: no es visible mediante búsqueda estática local. El agregado recomendado conserva tendencia y el ratio que aparece en análisis anteriores sin conservar el payload de diagnóstico por mount.

## Búsqueda de consumidores

Se buscaron ambos nombres exactos en el árbol de trabajo, excluyendo dependencias, `.next`, cobertura y `.git`. También se buscaron los nombres de props diagnósticas (`fresh_param`, `had_saved_game`, `game_status_at_mount`, `has_persisted_game_id`, `persist_state`, `pre_reset_status`, `will_call_reset`) y términos de recovery/reset. Se revisaron referencias de SQL, scripts, docs, auditorías, tests, dashboards/notebooks versionados y el historial Git.

| Tipo de referencia | Resultado |
|---|---|
| Emitter | Ambos en `apps/web/src/app/[locale]/arena/page.tsx`; son llamadas `track()` sujetas al flag de telemetría. |
| Consumer en runtime/RPC | No se encontró consumidor que vuelva a leer estos eventos; no aparecen como entrada de RPC, agregador de stats ni lógica de producto. |
| Test | No se encontró test que consulte o dependa de estos nombres. |
| SQL/query guardada/notebook/dashboard versionado | No se encontró consulta guardada ni dashboard/notebook versionado que los consuma. |
| Documentación histórica | Sí; varios análisis usan sus conteos, payloads o clasificación operacional. Esto prueba uso histórico, no que haya un consumidor activo hoy. |
| Dashboard externo | No verificable desde el repositorio; no se encontró export/configuración versionada que permita identificar uno. |

## Propósito y semántica

### `arena_mount`

Se emite una vez por montaje de la página Arena, guardado por `arenaMountTrackedRef`. Captura una instantánea de entrada: si venía `?fresh=1`, si había partida guardada en localStorage, `game.status` al montar, presencia de `persistedGameId` y `persistState`.

Se introdujo con la instrumentación del **Bug 2** en el commit `b57a1309` (2026-05-28). El handoff de estabilización describe el problema general de entrada/recovery y confirma que la telemetría se verificó en una sesión smoke. Su pregunta diagnóstica es: **¿en qué estado rehidratado aterriza la página al entrar a Arena y hay una partida persistida que explique una vuelta inesperada al juego/Coach?**

### `arena_fresh_reset_fired`

Se emite una sola vez cuando la URL incluye `?fresh=1`. Registra el estado anterior al reset: `pre_reset_status`, si había una partida guardada y `will_call_reset`. Después, si el estado no es `selecting`, ejecuta `game.reset()`.

La lógica de fresh reset aparece en el historial desde `fa39f5d2`; el evento diagnóstico y sus props se añadieron con `b57a1309`. La pregunta que responde es: **¿qué estado había antes del reset solicitado explícitamente para mostrar el selector y se ejecutó realmente `reset()`?** También permitía correlacionar un estado terminal inesperado con `arena_x_close_fired`.

### Diferencia

`arena_mount` observa **cada entrada/montaje** y captura estado general de rehidratación. `arena_fresh_reset_fired` observa sólo el subconjunto con `?fresh=1` y documenta la transición justo antes del reset. Son señales diferentes, aunque hoy suelen aparecer juntas.

La auditoría del 2026-08-18 explica que los conteos de una ventana de 24 horas coincidían porque entonces todas las entradas a Arena usaban `?fresh=1`. También advierte que esa igualdad es una consecuencia del ruteo de ese momento, no equivalencia semántica: si cambian los callers, pueden divergir. No se deben llamar duplicados por similitud de conteos.

## ¿Hay un análisis vigente que necesite raw?

No se encontró en el código o tooling versionado una lectura activa de:

- conteos absolutos de estos eventos;
- ratio mount/reset;
- secuencias entre ellos o con `arena_game_start`;
- props de estado de entrada/reset;
- análisis de abandono o de recuperación que vuelva a consultar las filas raw.

Sí hay **análisis históricos**:

1. `docs/audits/2026-08-18-telemetry-yellow-reduction.md` examinó frecuencia y props, concluyó que los eventos medían cosas distintas y que el ruteo de entonces explicaba conteos iguales. No contiene una consulta activa o dashboard dependiente.
2. `docs/audits/2026-08-27-play-behavior-and-retention.md` excluye explícitamente los eventos automáticos (`arena_mount`, `arena_fresh_reset_fired`) de su set de acciones de usuario.
3. `docs/audits/2026-08-17-cost-free-tier-readiness.md` clasificó `arena_mount` como `AGGREGATE_IS_ENOUGH` y `arena_fresh_reset_fired` como `OPERATIONAL_METRIC`.
4. `docs/audits/2026-08-17-supabase-historical-archive-recoverability.md` agrupa ambos como observabilidad operacional que no debería vivir eternamente como filas raw.
5. `docs/audits/2026-09-16-phase-1-disk-io-containment.md` deja `arena_fresh_reset_fired` como candidato a consolidar después de dashboard review; esa revisión pendiente es el indicio más reciente de incertidumbre externa.

Conclusión: los análisis localizados ya llegaron a conclusiones sobre semántica/telemetría; no hay evidencia de un estudio activo que necesite las filas raw. Los dashboards externos no están versionados y no pueden descartarse por búsqueda local.

## Qué información se perdería

Al eliminar únicamente las filas anteriores al cutoff se perdería la posibilidad de reconstruir, para ese periodo, el detalle por montaje/reset:

- `arena_mount`: `fresh_param`, `had_saved_game`, `game_status_at_mount`, `has_persisted_game_id`, `persist_state`.
- `arena_fresh_reset_fired`: `pre_reset_status`, `had_saved_game`, `will_call_reset`.
- Orden/secuencia individual entre montajes, resets y otros eventos; cohortes o correlaciones por props de cada fila.
- Cualquier análisis futuro del estado previo específico que disparó un reset.

Seguirían intactas las filas con `created_at >= cutoff`, el código/emitter actual y otros eventos como `arena_game_start`, `arena_game_end` y `arena_x_close_fired`. También quedarían los resultados ya escritos en informes históricos, pero esos documentos no conservan toda la secuencia ni cada payload.

## Utilidad del agregado

Un agregado diario UTC con `period`, conteo de `arena_mount`, conteo de `arena_fresh_reset_fired` y su ratio es pequeño frente a 10,605 filas. Preserva:

- cambio de volumen de entrada por día;
- proporción de entradas marcadas como fresh;
- una línea temporal que permitiría notar un cambio de ruteo o una desaparición de resets.

No preserva el diagnóstico por `game_status`, `persist_state`, existencia de save ni `will_call_reset`. Ese detalle sirvió para investigar el bug original; no aparece como necesidad vigente en los consumidores encontrados. La recomendación de agregado se limita a conteos diarios: no hace falta inventar infraestructura nueva; puede conservarse una extracción compacta junto al artefacto de auditoría/archivo existente. No se materializó aquí.

## Volumen confirmado

| Evento | Filas `< cutoff` | First seen UTC | Last seen UTC |
|---|---:|---|---|
| `arena_mount` | 5,368 | 2026-06-03 03:39:57.733017 | 2026-08-11 14:11:22.632923 |
| `arena_fresh_reset_fired` | 5,237 | 2026-06-03 03:39:58.412575 | 2026-08-11 14:11:22.632923 |
| **Total** | **10,605** | | |

Estos conteos vienen de la auditoría read-only anterior con el cutoff literal indicado. El delta bruto entre conteos no debe interpretarse como resets faltantes sin una comparación temporal/callsite: los eventos no son semánticamente intercambiables.

## Recomendación final

**Opción 2 — preservar agregado y luego podar.** Guardar primero conteos diarios UTC por evento y ratio, sin conservar props raw. Después, si se autoriza una operación separada, eliminar sólo filas de estos dos eventos con `created_at < '2026-08-11T14:12:14.822368Z'::timestamptz`.

La búsqueda local no encontró un consumidor vigente que requiera raw. El agregado es útil para preservar el uso histórico documentado como métrica, mientras que las filas recientes siguen disponibles para diagnóstico. Antes de ejecutar una futura poda, confirmar aparte si existe un dashboard externo no versionado; esta ejecución no tomó esa acción.
