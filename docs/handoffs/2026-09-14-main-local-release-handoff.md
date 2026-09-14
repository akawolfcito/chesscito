# Handoff — main local: PRO, observabilidad Redis y backups

**Fecha:** 2026-09-14
**Estado:** integrado en `main` local; sin push ni despliegue

## Integrado

| Commit | Alcance |
| --- | --- |
| `6115dd7f` | Añade el chip coronado de PRO al header de PLAY, conservando la baldosa PRO del rail como segunda puerta. |
| `f81303ce` | Instrumentación agregada de uso Redis por feature, endpoint y operación lógica. |
| `3c10aea1` | Backup verificado, restore desechable, archive transaccional y espejo externo con checksums. |
| `2bd6c923` | Corrige el inventario documental de consumidores de assets de tema. |

## Validado

- Chip PRO: dos accesos intencionales en PLAY (header y rail); ambos abren el mismo sheet.
- Redis: 157 pruebas focalizadas pasaron; TypeScript y revisión de whitespace pasaron.
- Ops/archive: 70 pruebas existentes pasaron; TypeScript pasó.
- No se ejecutaron backups ni se hizo push o deploy. La consulta previa a Upstash fue estrictamente read-only; no cambió datos ni planes.

## Redis: siguiente paso de producción

1. En Vercel, configurar `REDIS_OBSERVABILITY_SAMPLE_RATE=1` sólo para Production.
2. Conservar `RATE_LIMIT_LOG_SAMPLE` ausente o en `0`; no mezclar sus líneas históricas con `redis_usage`.
3. Desplegar el commit de `main` por el flujo habitual.
4. Registrar en UTC el instante de activación y el contador mensual de Commands de Upstash.
5. Tras 24 horas, filtrar Runtime Logs por Production, deployment y `redis_usage`; sumar exclusivamente `redis_estimated_commands`.
6. Comparar esa suma con el delta de Commands de Upstash. No escalar la suma: con sample rate `1` ya representa todos los eventos instrumentados.
7. Reducir o eliminar `REDIS_OBSERVABILITY_SAMPLE_RATE` tras la ventana y redeployar.

Notas de interpretación:

- Los eventos `rate_limit` y los de feature se suman: representan conjuntos distintos de comandos.
- Un rate limit bloqueado desde caché efímera tiene estimación `0`; no llega a Redis.
- Los timeouts/errores son estimaciones conservadoras y algunas ramas Redis aún no instrumentadas aparecerán como residual frente al contador de Upstash.

## Operaciones de backup

- Nuevo comando: `pnpm ops:backup:verified`.
- Su uso es manual: crea snapshot local privado, valida restore, refresca/verifica archive y copia ambos árboles a un destino externo fuera del repositorio.
- Antes del primer uso real, confirmar que el restore cabe en el tmpfs de 512 MB; si no, el verificador fallará aunque el dump sea válido.
- No usar este comando como parte del build, deploy o cron sin una política explícita de retención y revisión operativa.

## Worktree pendiente, deliberadamente fuera de commits

- `SESSION.md`.
- Audits no relacionados aún sin trackear en `docs/audits/`.
- `docs/audits/2026-09-14-upstash-vercel-handoff.md` ya existía como material de consulta y no fue incluido.

## Límites de privacidad

- La nueva línea `redis_usage` no incluye IP, wallet, hash de identidad, key Redis, token, sesión ni payload.
- No guardar valores de variables de entorno, credenciales, URLs de servicios ni rutas de snapshots privados en este documento.
