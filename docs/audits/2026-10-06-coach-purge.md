# Coach analyses purge — diagnóstico y fix aislado

## Evidencia y límites

- Checkout inicial limpio, `HEAD` = `4a83eb9a`.
- [Run del 6 de octubre](https://github.com/akawolfcito/chesscito/actions/runs/37444855163): llamada a las 09:42:55–09:42:57 UTC, HTTP 500 y exit 22. El workflow no conserva el body del error (`curl --fail`).
- GitHub confirma fallos el 3, 4, 5 y 6 de octubre; éxitos el 1 y 2. El primer fallo y el último éxito usan el mismo SHA (`46bb5783`). El fallo precede los fixes del 5 de octubre.
- Lecturas de dependencias con credenciales locales, sin ejecutar la purga: Redis `PING` = `PONG`; Supabase informa PostgREST **14.5** y **0** filas vencidas. Esto verifica esas dependencias actuales, no sus condiciones históricas ni la configuración exacta del deployment.
- La API de logs de Vercel rechaza la ventana histórica con HTTP 400, `ExceedsBillingLimitError`; la API de logs de Supabase responde 401 con la credencial disponible. No se cambió billing, configuración ni credenciales para superar estos límites.
- Se reprodujo **antes del fix** el SQL de mutación/representación de PostgREST 14.5 en PostgreSQL embebido local, con tabla vacía: **42703**, `column coach_analyses.expires_at does not exist`.
- **Límite de la conclusión:** el defecto de la query está demostrado por el código del planner y la reproducción SQL. No se obtuvo el error de runtime del run del 6 de octubre; su atribución histórica a este defecto sigue pendiente. Tampoco se conoce la fecha de actualización de PostgREST. No se ejecutó el endpoint productivo para reproducirlo.

## Flujo anterior y causa reproducida

1. `.github/workflows/cron-coach-purge.yml`, `Cron — Coach analyses purge`, llama `GET /api/cron/coach-purge` con `Authorization: Bearer ${CRON_SECRET}`. Timeout del cliente: 240 s; job: 5 min.
2. `apps/web/src/app/api/cron/coach-purge/route.ts` exige coincidencia exacta con el secreto del servidor. Secreto ausente/header inválido: 401, sin tocar dependencias.
3. `getSupabaseServer()` usa exclusivamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, con `persistSession: false`. Si falta una variable, devuelve null y la ruta responde 503. Una URL malformada puede lanzar al crear el cliente.
4. Redis, perfil `batch` (presupuesto 10 s por comando), adquiere `coach:cron:purge` con NX/TTL de 600 s. Una colisión devuelve 200/skipped. Antes, un rechazo de SET escapaba sin log específico.
5. Hasta 20 pasadas ejecutan `delete().lt('expires_at', ISO UTC).order('expires_at').limit(5000).select('game_id')` sobre `public.coach_analyses`.
6. Un error de Supabase devuelve 500 con `deleted_before_failure`. El contador anterior usa la longitud de la representación devuelta. Una respuesta vacía válida ya debería producir 200/0.
7. `finally` libera el lock. Antes se silenciaba un fallo de DEL.

PostgREST 13 retiró las mutaciones limitadas: `order`/`limit` afectan la representación devuelta. En 14.5 el planner incluye en `DELETE RETURNING` los campos seleccionados y la PK, aquí `game_id` y `wallet`; **no incluye `expires_at`**. El SELECT sobre ese resultado intenta ordenar por una columna ausente. PostgreSQL valida el SQL aunque no existan filas que borrar y lanza 42703. La ruta convierte el error en HTTP 500.

Agregar `expires_at` al SELECT eliminaría ese error, pero dejaría un DELETE sin límite real; por eso el fix conserva el límite dentro de SQL.

Fuentes primarias: [breaking change de PostgREST 13](https://github.com/PostgREST/postgrest/releases/tag/v13.0.0), [planner 14.5: mutatePlan e inferColsEmbedNeeds](https://raw.githubusercontent.com/PostgREST/postgrest/v14.5/src/PostgREST/Plan.hs). En versiones antiguas, la query también usaba un orden no único (`expires_at`), contrario al contrato de mutaciones limitadas.

## Comprobaciones solicitadas

- No hay `single()`/`maybeSingle()`, ni RPC previa en este endpoint. La respuesta de cero filas no es singular.
- La migración `20260506000000_coach_analyses_init.sql` define las columnas utilizadas, PK `(wallet, game_id)`, `expires_at timestamptz not null` e índice por vencimiento. No se encontraron renombres ni FK referenciando esta tabla en las migraciones del repositorio.
- La fecha se compara estrictamente (`<`): filas no vencidas se conservan. La migración inicial usa un TTL de un año; el fix no lo modifica.
- Los escritores (`lib/coach/persistence.ts`, `backfill.ts`) y lectores (`history-digest.ts`) son independientes del cron y no se modificaron. El soft cap del writer no forma parte de esta ejecución.
- Supabase utiliza service role, no anon ni una variable pública. Redis también es necesario aunque no figure en los dos secrets de GitHub.
- No hay error de cache GET en la query antigua: era DELETE. La nueva RPC es POST/VOLATILE y usa tiempo de la base de datos.
- La función Vercel mantiene `maxDuration = 60`. El fallo del job ocurrió en unos 2 segundos, sin evidencia de agotar los 240 s de curl. Una base lenta/backlog puede seguir agotando el presupuesto de la plataforma; el fix no amplía ese timeout.
- La query defectuosa nació en `8f4ecc37` (6 de mayo). `fc1ecdbb` ajustó auth/config; `49b4cedf` añadió el workflow. `b784dd34` (3 de agosto) cambió el cliente Redis por el perfil batch. Los cambios del 5 de octubre (`fdfe9e47`, `15857d13`) afectan reconciliación blockchain, no esta query.

## Cambio

- Nueva función `public.purge_expired_coach_analyses()`, SQL/VOLATILE/SECURITY INVOKER, con `search_path` vacío. Selecciona hasta 5.000 claves compuestas vencidas con orden estable y `FOR UPDATE SKIP LOCKED`; borra esas claves en la misma sentencia y devuelve un entero exacto.
- Solo `service_role` puede ejecutarla: permisos explícitamente revocados a PUBLIC, anon y authenticated. No se cambian tabla, columnas, RLS ni datos existentes.
- La ruta llama esa RPC, conserva 20 pasadas, lock, autenticación y JSON de éxito/error. Cero devuelve 200/`rows_deleted: 0`; un contador null/inválido devuelve 500, en vez de ocultar una respuesta defectuosa como cero.
- Los fallos de Supabase registran código, pasada y total parcial sin volcar mensajes arbitrarios. Un rechazo inesperado sigue devolviendo 500. Un fallo de adquisición del lock queda registrado y responde 503 sin ejecutar la RPC. Un fallo de liberación genera warning y mantiene la respuesta de la purga.

## Validación

- Baseline: `pnpm --filter web test src/app/api/cron/coach-purge/__tests__/route.test.ts`: 6 tests pasan, aunque no comprueban el SQL.
- Fix: `pnpm --filter web test src/app/api/cron/coach-purge/__tests__/route.test.ts src/lib/coach/__tests__/persistence.test.ts src/lib/server/__tests__/redis.test.ts`: **37 tests pasan, 3 archivos**.
- Casos cubiertos: autorización ausente/incorrecta y secreto ausente; config Supabase ausente; lock ocupado; cero filas; éxito; varias pasadas y cap de 20; error real de Supabase con conteo parcial; RPC inexistente; contador inválido/null; rechazo Redis/RPC; fallo de liberación y logs sin texto sensible.
- `node .tmp/reproduce-coach-purge.mjs`: reproduce 42703 con la query vieja y valida la migración con fixtures locales: 0 filas, lotes de 5.000, backlog de 5.001, conservación de análisis no vencidos, dos wallets con el mismo game_id y permisos de función. PostgreSQL embebido `@electric-sql/pglite@0.3.14` se instaló solo en `/private/tmp/chesscito-coach-purge-repro`; no se agregó dependencia al repo. Es una prueba del SQL reconstruido y la función, no una integración HTTP con PostgREST.
- `pnpm --filter web lint`: pasa; tres warnings existentes de hooks en duel-arena/exercises-screen.
- `pnpm --filter web exec tsc --noEmit`: falla por errores ajenos al cron (incluye `react-dom.preload` y tipos React incompatibles).
- Comparación con `node .tmp/compare-coach-types.cjs`, usando el compilador TypeScript y un reader en memoria que sustituye solo los dos archivos modificados por sus versiones de `HEAD`: **54 errores en baseline, 54 con el fix, 0 nuevos y 0 en los archivos modificados**. No se revirtieron archivos para esta comprobación.
- `pnpm --filter web build`: compilación exitosa; termina con error de tipos existente en `src/app/[locale]/arena/layout.tsx:1` (`react-dom.preload`). No se corrigieron errores ajenos.
- `git diff --check`: pasa.

## Riesgo y publicación posterior

Al cierre del diagnóstico inicial no se hizo commit, deploy, merge, cambio de secretos/configuración Vercel, DDL productivo ni borrado manual. Partidas, coach review, escrituras de análisis, otros crons y lógica on-chain no se modifican. Tras una publicación futura, únicamente los análisis ya vencidos serán purgados según la política existente.

**Dependencia de publicación:** aplicar primero la nueva migración por el proceso habitual y luego publicar la ruta. No se ejecutó ninguno de esos pasos. Publicar la ruta sin la función produciría un error real PGRST202 y HTTP 500. La migración recarga el schema cache de PostgREST. La validación histórica del incidente requiere el log de runtime pendiente.

## Punto de control local — 7 de octubre de 2026

- Branch: `main`. Antes de preparar el commit, el working tree contiene exactamente la ruta, su archivo de tests, la migración `20261006000000_coach_purge_batch.sql` y esta auditoría; el índice está vacío.
- Validaciones repetidas:
  - `pnpm --filter web test src/app/api/cron/coach-purge/__tests__/route.test.ts src/lib/coach/__tests__/persistence.test.ts src/lib/server/__tests__/redis.test.ts`: 37 tests pasan en 3 archivos; warning de configuración Vite existente.
  - `pnpm --filter web lint`: exit 0, con los tres warnings de hooks existentes en duel-arena/exercises-screen.
  - `node .tmp/reproduce-coach-purge.mjs`: exit 0; reproduce 42703 de la query anterior y verifica la nueva función, el límite de 5.000 filas, backlog, filas no vencidas, clave compuesta y permisos en PostgreSQL embebido local.
  - `node .tmp/compare-coach-types.cjs`: exit 0; 54 errores en baseline y 54 con el fix, sin errores nuevos ni errores en los dos archivos modificados. No se corrigen problemas preexistentes.
  - `git diff --check`: sin errores.
- La migración contiene `BEGIN`, creación de `public.purge_expired_coach_analyses()`, `REVOKE`, `GRANT EXECUTE ... TO service_role`, `NOTIFY pgrst, 'reload schema'` y `COMMIT`.
- El alcance autorizado termina con un commit local. La aplicación de la migración en Supabase producción queda pendiente de ejecución manual y confirmación del usuario; no se autoriza continuar con publicación, push, cron, cambios de secretos ni rollback.
- SQL a aplicar manualmente: el contenido completo, sin modificaciones, de `apps/web/supabase/migrations/20261006000000_coach_purge_batch.sql`. Crear la función no ejecuta la purga.
