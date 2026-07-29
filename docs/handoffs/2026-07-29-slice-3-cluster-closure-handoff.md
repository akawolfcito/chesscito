# Handoff — Slice 3 cerrado: mergeado, migrado y deployado

**Fecha**: 2026-07-29
**Branch**: `main` (la de trabajo se borró, local y en origin)
**Merge**: `f6283d9` — *“un intento deja de ser invisible”*, 29 commits
**Estado**: `main == origin/main`, árbol limpio
**Suite**: **6515 passing / 552 archivos, EXIT=0** (verificada **después** del merge).
`tsc --noEmit` limpio. Lint limpio. `pnpm build` EXIT=0.

> Este handoff **supersede** a `2026-07-28-…-4c-handoff.md` y
> `2026-07-29-…-4c3-handoff.md`: los dos se escribieron antes del kill switch, del merge
> y del deploy. Los hechos técnicos de ambos siguen valiendo; el estado, no.

## Qué quedó vivo

Un intento completado se registra. Antes la única marca de que alguien jugó era una fila
de `score_saves`, que sólo se escribe cuando el **total mejora** — así que repetir tu
mejor marca no dejaba rastro, y carril 2, que nunca mueve el total, no dejaba ninguno.

- `score_attempts`: una fila por intento, con la nota **calculada del lado del servidor**.
- Cola por wallet que sobrevive a cerrar la app; un POST en vuelo; FIFO.
- Un retry reusa el mismo `attemptId` ⇒ el server contesta replay ⇒ **consume cero**.
- Los tres ensambladores de la pantalla, con las seis familias midiendo lo suyo
  (`moves`, `failures`, `coverage`).
- La cola **visible** y el reintento manual.
- Kill switch: `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` (default **ON**).

## Migraciones aplicadas a prod

Se aplicaron **tres**, no una — la DB estaba atrás de `main`, no sólo de la branch:

| Migración | Qué era |
| --- | --- |
| `20260729000000_score_save_write_path_hardening` | ya estaba en `main`, nunca en la DB |
| `20260730000000_score_write_sessions` | ídem |
| `20260731000000_score_attempts` | la de este slice |

Los `NOTICE … already exists, skipping` confirman que partes ya existían por otra vía; el
push las dejó **registradas**, que es lo que faltaba.

## ⚠️ Lo único pendiente de verificación

**El check de privilegios en prod nunca se corrió.** Es el que ningún regex sobre el SQL
puede contestar, porque la respuesta no está en el texto de la migración sino en el ACL
que dejan los *default privileges* de Supabase:

```sql
select has_function_privilege('anon',
  'public.save_score_attempt(text,text,text,int,int,int,text,text,int,int,text,int,text)',
  'execute');
-- debe dar false
```

Si diera `true`, cualquiera con la anon key podría escribir filas de intento. La migración
hace los tres revokes (`public`, `anon`, `authenticated`) y localmente da `false`; falta
confirmarlo **en la DB real**.

## Lo que NO se midió, y va a doler primero si algo duele

1. **El presupuesto de 100 saves por sesión, contra una sesión real de carril 2.** El
   smoke gastó 3 unidades en 3 intentos. Nadie sabe cuántos intentos hace una sesión larga.
   Si aparece `session_exhausted`, ese es el número.
2. **La lane corre en learn Y en play** — `/exercises` no está gateada por modo. Es una
   decisión que nadie tomó explícitamente: salió así porque nada la gateaba. Se distinguen
   por `deployment_surface`. Si play no debería escribir intentos, es un gate chico.
3. **`clearPersistedOutbox` no lo llama nadie.** No hay fuga (la cola se borra sola al
   drenar), pero la función quedó sin consumidor: o tiene uno, o se va.

## Cierre de cluster

- ✅ Branch `feat/attempt-identity-slice-3` borrada (local y origin), verificada mergeada.
- ✅ `MEMORY.md` + `project_attempt_lane_is_live` nuevos; la memoria que decía “Slice 3
  bloquea Slice 2” corregida.
- ✅ `CLAUDE.md`: conteo de tests 5003/420 → **6515/552**.
- ➖ **README sin cambios**: “What’s live” no se movió para el jugador — esto es
  instrumentación, no una feature visible. Los contratos y el stack no cambiaron.
- ➖ **GitHub**: sólo queda abierto el #272 (Privy), ajeno a este cluster.

## Qué sigue

**Slice 2 — la ventana semanal en Leaders — ya no está bloqueada.** Era el motivo por el
que existió Slice 3: `score_attempts.created_at` sí significa “jugó”, que es exactamente
lo que `score_saves.created_at` nunca significó. El spec viejo
(`docs/specs/2026-07-27-leaders-weekly-window-redteam.md`) se escribió sobre la premisa
falsa y hay que releerlo con la tabla nueva antes de implementar nada.

Antes de eso, dos cosas baratas: el check de privilegios, y mirar `used_saves` de una
sesión real.
