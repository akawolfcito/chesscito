# Scripts de deploy — SQL que se corre a mano

Scripts operativos que acompañan a una migración cuando el deploy necesita algo
que la migración por sí sola no hace.

Las migraciones en `../migrations/` son la fuente de verdad del esquema. Estos
archivos son **envoltorios de ejecución**: agregan la transacción, los timeouts,
el `NOTIFY pgrst` y las verificaciones que un deploy hosted necesita y un
`supabase db reset` no.

## 2026-07-30 — write path de scores (Slice 0 + 0.1)

Commits: `d7691e31`, `ab1170af`, `edee4713`.
Contexto: `docs/product/2026-07-27-score-and-leaders-audit.md` §10–11.

| Archivo | Cuándo |
|---|---|
| `2026-07-30-score-write-path-DEPLOY.sql` | **Antes** del push. Las dos migraciones en una transacción. |
| `2026-07-30-score-write-path-VERIFY.sql` | Después del deploy, antes del push. Read-only. |
| `2026-07-30-score-write-path-ROLLBACK.sql` | Solo si hay que volver atrás. **Antes** de revertir el código. |

### Orden

```
1. DEPLOY.sql     (SQL Editor de Supabase)
2. VERIFY.sql     (todo debe decir OK)
3. git push       (el código nuevo recién ahora)
```

**El SQL va primero y no al revés.** El código nuevo llama funciones que todavía
no existen; el código viejo sí funciona contra el esquema nuevo — su llamada de
8 args resuelve contra la de 9 con `p_surface` default y escribe `surface = NULL`,
que es lo correcto para código que no sabe de superficies. Por eso la ventana
entre el SQL y el deploy es segura, y por eso Production puede seguir con el
código anterior indefinidamente.

### Por qué el `NOTIFY pgrst` está acá y no en la migración

PostgREST cachea las firmas de función. La migración dropea y recrea
`save_basic_score`, así que sin un `NOTIFY pgrst, 'reload schema'` las llamadas
`supabase.rpc()` pueden seguir viendo la firma vieja y fallar con `PGRST202`.
Es específico del deploy hosted: en un `supabase db reset` local no hace falta.

### Rollback — el orden importa

`ROLLBACK.sql` restaura la firma de 8 args y **va antes** de revertir el código.
Al revés, el código viejo llama una firma que no existe y todos los saves fallan
con 500.

Una vez que un deploy corre el código nuevo, revertir el SQL lo rompe: a partir
de ahí el rollback de SQL y el de código van juntos.

No borra datos. `surface` y `score_write_sessions` se dejan en pie a propósito:
son aditivos, no molestan al código viejo, y borrarlos destruiría la provenance
de las filas escritas durante el deploy. Las vistas `bigint` tampoco se
revierten — reintroducirían el overflow que tumba Leaders para todos (audit R13).
