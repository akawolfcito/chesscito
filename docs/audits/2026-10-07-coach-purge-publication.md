# Coach purge — publicación controlada, 7 de octubre de 2026

## Resultado

Deploy CLI de Play `READY`, dominio productivo asignado y cron exitoso con HTTP 200 / `rows_deleted: 0`. La verificación funcional de Coach sigue pendiente: la revisión automática rechazó el control de Google Chrome. No se declara completada la publicación hasta validar una solicitud/recuperación real de análisis.

Las secciones de la primera tentativa conservan evidencia histórica. El bloqueo de la integración Git del proyecto anterior no fue un bloqueo del proyecto CLI actual.

## Punto de partida y push

- El usuario confirmó haber aplicado manualmente la migración en producción. Verificación aportada: función `purge_expired_coach_analyses`, retorno `integer`, `prosecdef: false`, ACL `{postgres=X/postgres,service_role=X/postgres}`. No se reaplicó la migración ni se consultaron credenciales.
- `git rev-parse HEAD`: `5caad13e569cb6f9dd2275a913285e4fb3c1fea9`.
- `git branch --show-current`: `main`.
- `git status --porcelain=v1 --untracked-files=all`: vacío antes del push.
- `git push origin HEAD:main`: exit 0; avance remoto `4a83eb9a..5caad13e`.
- `gh api repos/akawolfcito/chesscito/git/ref/heads/main`: confirma el SHA solicitado en `refs/heads/main`.
- Commit publicado: [5caad13e](https://github.com/akawolfcito/chesscito/commit/5caad13e569cb6f9dd2275a913285e4fb3c1fea9).

## Primera tentativa: bloqueo de la integración Git de Vercel

- Dos consultas de `gh api repos/akawolfcito/chesscito/commits/5caad13e569cb6f9dd2275a913285e4fb3c1fea9/status` devuelven estado combinado `failure`.
- Checks `Vercel – chesscito`, `Vercel – lite-chesscito` y `Vercel – chesscito-landing`: estado `failure`, descripción literal `Account is blocked.`.
- El target de los checks es [la explicación de Vercel sobre deployments bloqueados](https://vercel.com/knowledge/why-is-my-account-deployment-blocked), no un deployment creado para este commit. No se investigó ni modificó billing o configuración de cuenta.
- Consulta de deployments en GitHub filtrada por el SHA: lista vacía. No se confirmó ningún deployment `Ready` ni que producción sirva este commit.
- La consulta MCP a Vercel sin scope explícito no encontró deployments para el SHA. La consulta con los IDs de proyecto/equipo de `apps/web/.vercel/project.json` devolvió 403 por falta de autorización al scope `goodwolf`; este límite de acceso es independiente del fallo reportado por la integración de GitHub.
- Fallback `vercel list chesscito --scope goodwolf`: el sandbox bloqueó inicialmente la caché/red local; se repitió fuera del sandbox con aprobación y terminó con `The specified scope does not exist`. No se cambiaron autenticación ni secretos.
- GitHub Actions lanzó automáticamente [Tests, run 37683281557](https://github.com/akawolfcito/chesscito/actions/runs/37683281557) por el push. Seguía `in_progress` en la última consulta; no se afirma un resultado final de CI.

## Cron y smoke test de la primera tentativa

- No se ejecutó `workflow_dispatch` de `Cron — Coach analyses purge`: estaba condicionado a un deployment `Ready` correspondiente al SHA publicado.
- Sin ejecución nueva del cron: no hay HTTP status, `rows_deleted` ni logs del job `Trigger /api/cron/coach-purge` para esta publicación. No puede afirmarse ausencia de errores de Redis, Supabase o RPC.
- No se realizó smoke test de Coach: estaba condicionado al éxito del cron tras el deploy.
- No se hicieron cambios adicionales de código, secretos, migraciones ni rollback. Este informe queda local y sin commit para conservar el SHA publicado.

## Plan de la primera tentativa, superado por la publicación CLI

Resolver el bloqueo de la cuenta en Vercel y verificar un deployment de producción `Ready` cuyo SHA sea `5caad13e569cb6f9dd2275a913285e4fb3c1fea9`. Solo después corresponde ejecutar el workflow manual, revisar respuesta/logs y realizar el smoke test del Coach. No se ejecutó ninguna de esas acciones posteriores.

## Continuación CLI: topología comprobada

- `HEAD`, `origin/main` y `git ls-remote origin refs/heads/main` coinciden en `5caad13e569cb6f9dd2275a913285e4fb3c1fea9` antes del deploy.
- La CLI autenticada verifica `play.chesscito.com` en proyecto **`chesscito-play`**, ID `prj_C0CCNCflbhnGsizesTW5yKBTLk3z`, team `team_vOGGEXd4hLuyJsuSDNYlX0uI`, scope **`play-chess`**. Root remoto `apps/web`, Next.js, Node `24.x`, sin overrides de build/install.
- `.vercel` local conserva vínculos anteriores: `apps/web/.vercel/project.json` apunta a `chesscito`/otro equipo; raíz apunta a `chesscito-learn`/su equipo. No se relinkea ninguno ni se cambia ownership.
- La cuenta CLI de esta sesión solo tiene acceso al equipo Play. Learn queda documentado con identidad local, sin afirmar una nueva verificación del alias/proyecto remoto.
- Play y Learn compilan la misma carpeta `apps/web/src/app/api`; los modos no eliminan la RPC ni el cron de Learn. Middleware excluye `/api`. Landing tiene una carpeta de rutas distinta y no contiene `coach-purge`.
- La configuración Cloudflare, Worker `chesscito-www-vinext-poc`, wrapper `deploy:vinext` y runbook canónico de www están en la rama local `migration/www-cloudflare-production`, commit `476f5d22e492a0120ab2f42f2cc2dd30fd402fb5`; no están integrados en `main`. No se copia runtime ni se despliega Cloudflare.
- No existe wrapper Vercel en los árboles inspeccionados. Se usa selección explícita del proyecto existente con la CLI.

## Fuente y validaciones repetidas

- `pnpm --filter web test src/app/api/cron/coach-purge/__tests__/route.test.ts src/lib/coach/__tests__/persistence.test.ts src/lib/server/__tests__/redis.test.ts`: exit 0; 37 tests / 3 archivos.
- `pnpm --filter web lint`: exit 0; mismos tres warnings de hooks.
- `node .tmp/reproduce-coach-purge.mjs`: exit 0; reproducción 42703 antigua y nueva función con fixtures locales validada. No se conecta a Supabase.
- `git diff --check`: sin errores.
- `git archive` del SHA exacto a `/private/tmp/chesscito-coach-purge-release-5caad13e`; sin dotenv reales ni `private/`, sin `.vercel` locales ni auditoría pendiente. Ruta, lockfile, manifest y Next config se compararon byte a byte contra Git. Archivo TAR SHA-256: `500208c9aa300e2b9ecc2c067dec96b55053428a1b0f36b45a5a334236912d21`.
- Dry run CLI: Next.js, 5.636 archivos / 159.642.593 bytes candidatos. Solo crea un inventario local; no un deployment. No se muestran contenidos de archivos sensibles.

## Deployment realizado

```sh
vercel deploy /private/tmp/chesscito-coach-purge-release-5caad13e --project prj_C0CCNCflbhnGsizesTW5yKBTLk3z --scope play-chess --prod --yes --no-wait --meta sourceCommit=5caad13e569cb6f9dd2275a913285e4fb3c1fea9 --meta githubCommitSha=5caad13e569cb6f9dd2275a913285e4fb3c1fea9 --meta githubCommitRef=main
```

- Deployment **`dpl_FVnT2rEVCnnot2Cox98L7ENB5ndX`**, [inspector Vercel](https://vercel.com/play-chess/chesscito-play/FVnT2rEVCnnot2Cox98L7ENB5ndX), URL `https://chesscito-play-pa9w756cn-play-chess.vercel.app`.
- API de Vercel: `readyState: READY`, `target: production`, proyecto correcto y metadata `sourceCommit` / `githubCommitSha` igual al fix SHA. Metadata cotejada con export exacto, no utilizada como única prueba de procedencia.
- `vercel inspect https://play.chesscito.com --scope play-chess` resuelve al mismo deployment, estado Ready; aliases incluyen `play.chesscito.com`.
- Build remoto: Turbo limita paquetes en scope a `web`; `next build` en `/vercel/path0/apps/web`, compilación y tipos superados. No se construyó/publicó otra superficie. Se mantienen warnings preexistentes.

## Cron verificado tras el deployment

- Dispatch autorizado por API: `gh api --method POST repos/akawolfcito/chesscito/actions/workflows/cron-coach-purge.yml/dispatches -f ref=main`.
- [Run 37689331895](https://github.com/akawolfcito/chesscito/actions/runs/37689331895): `workflow_dispatch`, SHA exacto del fix, `completed` / **`success`**.
- [Job 113025175399, Trigger /api/cron/coach-purge](https://github.com/akawolfcito/chesscito/actions/runs/37689331895/job/113025175399): setup, llamada y cierre exitosos. Comienza 21:25:53 UTC y termina 21:25:57 UTC.
- Se revisó el log completo del job (48 líneas): respuesta **`{"rows_deleted":0}`**, sin fallo de curl ni exit distinto de cero. El workflow no imprime HTTP status por sí mismo.
- `vercel logs dpl_FVnT2rEVCnnot2Cox98L7ENB5ndX --scope play-chess --project prj_C0CCNCflbhnGsizesTW5yKBTLk3z --since 10m --query coach-purge --json --no-follow --limit 20`: confirma GET `/api/cron/coach-purge` en **`play.chesscito.com`**, deployment nuevo, `responseStatusCode: 200`, environment production.
- Log a las **21:25:55.222 UTC**: `coach_purge_complete`, `rows_deleted: 0`; ningún evento de fallo Redis, Supabase, RPC ni liberación del lock en esa ejecución. No aparece el antiguo HTTP 500. El conteo cero es éxito válido.
- La correlación de tiempo/dominio/deployment del log confirma el destino real del workflow sin leer ni publicar `CRON_URL`.

## Smoke test y documentación

- No hay navegador disponible mediante la interfaz browser de Computer Use. Chrome existe como app nativa; `cua.getApp("com.google.Chrome")` fue rechazado por la revisión automática con mensaje literal `Computer Use was not approved to use Google Chrome`, sin motivo adicional.
- Se solicita al operador verificar Coach Review y cargar/recuperar un análisis en su sesión. Esa confirmación funcional queda pendiente; HTTP de páginas por sí solo no se considera smoke de análisis completo.
- Tras el deploy, `/` y `/coach/history` en Play responden HTTP 200; `/exercises` responde 307 a Learn, confirmando separación pública del modo Play. Son comprobaciones de acceso/routing, no una validación del análisis autenticado.
- Guía canónica nueva: [deployment-topology.md](../ops/deployment-topology.md), con evidencia/lagunas y referencias al runbook Cloudflare existente en su rama. Se enlaza desde `AGENTS.md`, `CLAUDE.md` y README raíz.
- Solo documentación cambia después del fix. No se modifican código, secretos, variables, teams, billing, migraciones ni Cloudflare; no se hace rollback.
- Un push documental puede repetir los checks Git bloqueados de los proyectos antiguos. Eso no invalida el deployment CLI ya Ready ni el cron observado en el nuevo deployment.
