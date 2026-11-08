# Preparación de publicación de Chesscito Play

## Alcance

La rama `codex/play-deploy-ready` reúne la caché de assets de `811278f2`, el parche del loader Google Fonts para Next 14.2.35 y su lockfile, el build limitado a Web mediante `apps/web/vercel.json`, y la corrección del polling de Coach del PR #273. No incluye un cambio de versión de Next, migraciones, cambios de pagos/progreso ni un despliegue.

La prueba del loader ahora se ejecuta también en CI; antes el runner Vitest no recogía su archivo `.cjs`. La guía canónica incorpora el proyecto Play vigente, verificado después del login.

## Destino confirmado

- Equipo: `caos19`, ID `team_1efDQcHa59J6jEFOw0lW0JiF`.
- Proyecto: `chesscito-play`, ID `prj_DHUy3urmBKEPluBmO8KJII1MpWNx`.
- Dominio: `play.chesscito.com`, verificado y sin redirect.
- Framework: Next.js; raíz: `apps/web`; Node: 24.x. Los overrides remotos de build/output están vacíos; el archivo versionado define el build y `.next`.
- Deployment de producción anterior: `dpl_FPcnynfBFJguUnKfnZe5RhagbQq7`, estado READY.
- No hay integración Git en este proyecto actual. El merge no publica Play automáticamente. Los links locales root/app apuntan a otros proyectos y no se modificaron.

## Configuración que debe comprobar el operador antes de publicar

La consulta de metadatos posterior al login no encontró `SUPABASE_URL` ni `UPSTASH_REDIS_REST_URL` en ningún entorno; no hay entradas ocultas ni paginación. Las claves asociadas sí están presentes en Production. **Añadir las URLs correctas directamente en Vercel, al proyecto anterior, target Production, antes de lanzar el deployment.** No copiarlas al repositorio ni compartir valores en el chat. Los clientes necesitan tanto URL como credencial del mismo servicio. Esta preparación no cambia configuración remota.

`NEXT_PUBLIC_CHESSCITO_MODE` está presente en Production, pero su mera presencia no demuestra su valor; debe ser `play`. El build local usa el modo explícito. No desactivar servicios ni suplir un fallo con respuestas falsas de progreso, derechos o pagos.

## Validación de la versión integrada

- Pruebas del loader de producción: 9/9 aprobadas.
- Regresión seleccionada de Coach, modo, fingerprint, cron/sync, pagos, Training, scores/progreso, juego y duelos: 126 archivos, 2.069 pruebas aprobadas en Node 20.19.5 / pnpm 8.10.0.
- Lockfile congelado offline: aprobado, sin scripts de instalación.
- Build Play real sin mocks, sin dotenv local y con modo `play`: aprobado, 122/122 páginas, 78,1 segundos. Código runtime integrado en `7c147b5b`; los cambios posteriores de preparación son CI/documentación. El build remoto en Node 24 sigue pendiente del lanzamiento.
- Los cuatro checks del PR integrado deben estar en verde antes del merge. La ejecución anterior del PR #273 ya había aprobado los cuatro, pero no sustituye esta ejecución con parche y lockfile integrados.

El build local usa una exportación del código versionado sin `.env`, `private/`, links `.vercel` ni credenciales. Reutiliza las dependencias locales para compilar y usa variables públicas mínimas. El artefacto de publicación se crea aparte desde el commit final y no reutiliza ese build ni los symlinks de dependencias. El build remoto recibirá su configuración de Vercel.

## Lanzamiento manual

La preparación no ejecuta estos comandos. Antes, confirmar metadatos de destino y las variables requeridas. Subir el repositorio completo exportado, porque pnpm, lockfile y `patches/` están en la raíz. No lanzar desde `apps/web` ni usar los vínculos locales como destino implícito.

Una vez integrado el PR y revisado `main`, crear una exportación nueva y limpia desde el SHA aprobado:

```sh
RELEASE_SHA=$(git rev-parse origin/main)
RELEASE_DIR=$(mktemp -d /tmp/chesscito-play-release.XXXXXX)
git archive "$RELEASE_SHA" | tar -x -C "$RELEASE_DIR"
vercel deploy "$RELEASE_DIR" --project prj_DHUy3urmBKEPluBmO8KJII1MpWNx --scope caos19 --prod --yes --meta sourceCommit="$RELEASE_SHA" --meta githubCommitSha="$RELEASE_SHA" --meta githubCommitRef=main
```

Revisar inventario de la exportación antes del comando de publicación: sin archivos de entorno reales, `private/`, credenciales, `.vercel`, `.next` ni dependencias locales. Los templates públicos sí son parte del repositorio. El responsable de la preparación entrega una ruta y SHA concretos después del merge, ya revisados, para evitar reconstruirla manualmente.

Exigir estado READY y verificar que el deployment y alias `play.chesscito.com` corresponden a este proyecto y al SHA esperado; un mensaje de upload no basta. Validar en móvil: Hub/Play, partida, Coach ready/failed, historial, redirección de Training a Learn, conservación de progreso y flujos de pago sin efectuar cobros reales en un smoke de lectura. Las pruebas financieras que impliquen cobros requieren el entorno e intención apropiados.

Revisar `/api/pro/status`, `/api/coach/history` y el cron de limpieza tras corregir URLs; no disparar un cron destructivo manualmente como prueba sin autorización. Comparar 12–24h equivalentes de CPU e invocaciones/errores por ruta. El ahorro de CPU y la eliminación del 20,6 % siguen pendientes de medición real.

Ante regresiones, identificar un deployment anterior funcional de este mismo proyecto antes de decidir rollback. El deployment anterior registrado no está certificado como saludable: se observaron errores 500 antes de esta preparación.
