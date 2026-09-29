# Arena Select View: revisión de definición del agregado

**Fecha:** 2026-09-28\
**Resultado:** `AGGREGATE DEFINITION UNCLEAR`\
**Modo:** inspección de archivos local; no se consultó la base de datos.

## Alcance

Se revisó la posibilidad de preservar un agregado histórico de `arena_select_view` previo al cutoff fijo `2026-08-11T14:12:14.822368Z`, con las columnas solicitadas por la tarea. Esta fase no autorizaba poda.

## Corrección del wrapper

El wrapper temporal `/private/tmp/analytics-events-wrapper-validation.py` tenía pruebas smoke en el nivel superior del módulo. Cargarlo podía iniciar sus pruebas, incluidas operaciones sobre objetos temporales y rutas de COMMIT/ROLLBACK.

Se encapsuló ese bloque en `run_smoke_tests()` y se condicionó su ejecución a un entry point explícito:

```python
if __name__ == "__main__" and "--smoke-tests" in sys.argv:
    run_smoke_tests()
```

La lógica transaccional de operación no se cambió. `py_compile` pasó y la carga del módulo con `runpy.run_path(...)` no produjo actividad observable (`IMPORT_SIDE_EFFECTS=none`). No se ejecutaron los smoke tests en esta fase ni se conectó el wrapper a producción.

## Evidencia del informe histórico

`docs/audits/2026-09-02-where-they-quit-and-why-they-return.md` describe una comparación del “día 1 de cada cuenta” entre quienes jugaron un solo día y quienes volvieron, para cohortes desde `2026-08-06`. Publica para `arena_select_view` tasas de 28,9% y 47,9%, respectivamente.

El informe no incluye la consulta fuente ni define de forma reproducible:

- qué fecha asigna cada cuenta a `cohort_date_utc`;
- qué evento o condición define la entrada a una cohorte y el universo elegible;
- la ventana de observación y cómo se decide que una cuenta jugó un solo día o volvió;
- si “día 1” es el día UTC de primera actividad, una ventana de 24 horas u otra regla;
- qué cuenta como presencia de `arena_select_view` en el día 1 y cómo se deduplican eventos;
- los denominadores exactos ni la relación entre el periodo del análisis y el cutoff de este agregado.

Las menciones en resúmenes y documentación corroboran las cifras publicadas, pero no aportan la consulta o semántica faltante. Tampoco se encontró una query/script versionado que resuelva esas definiciones. La lógica genérica actual de estadísticas no demuestra que el análisis histórico usara esas mismas reglas, así que no se sustituyó por ella.

## Efecto y siguiente requisito

Sin la query original o una especificación inequívoca de las reglas anteriores, el CSV por `cohort_date_utc` podría representar una métrica distinta de la que sustenta el análisis de retención. Por eso:

- no se emitió SQL contra `analytics_events`;
- no se creó `docs/audits/data/2026-09-28-arena-select-view-retention-aggregate.csv`;
- no se generó ni exportó información de cuentas, sesiones o payloads;
- no se ejecutó DELETE ni mantenimiento y no se modificaron datos persistentes.

Para reanudar la preservación hace falta localizar la consulta fuente del análisis del 2 de septiembre o acordar explícitamente sus reglas exactas, en particular cohortización, retorno, ventana del día 1 y atribución de `arena_select_view`. Hasta entonces, el resultado es **`AGGREGATE DEFINITION UNCLEAR`**.
