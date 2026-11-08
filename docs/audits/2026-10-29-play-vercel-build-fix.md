# Chesscito Play — corrección P0 de compilación Vercel

Fecha: 2026-10-29. Rama: `fix/play-vercel-usage`. Base: `811278f2`.

## Destino y alcance

Destino confirmado por el operador y por la CLI/API: **`caos19/chesscito-play`**, proyecto `prj_DHUy3urmBKEPluBmO8KJII1MpWNx`.
No confundir con el proyecto homónimo del equipo `play-chess` registrado en la guía de topología el 7 de octubre. Esa evidencia histórica no describe este proyecto nuevo.

No se hicieron push, deployment, merge, commits, cambios de autoría ni cambios remotos de configuración. Se conservaron `fonts.ts`, `next.config.js` y el parche de caché `811278f2` sin modificaciones.

## Diagnóstico

El deployment fallido `chesscito-play-h5pi15zo4-caos19.vercel.app` ejecutó `pnpm run build` desde la raíz: Turbo lanzó cuatro tareas, incluyendo Landing. Falló Web con `TypeError: Cannot read properties of null (reading '1')` en `next/dist/compiled/@next/font/dist/google/loader.js:112:78`.

En Next **14.2.35**, esa línea extrae la extensión con `/\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]`. Si la URL no termina en una extensión reconocida, el resultado es `null`. Las URLs `/l/font?kit=…` y las URLs con query/fragment reproducen exactamente ese error en el loader de producción instalado.

Se consultaron los tres CSS públicos con el mismo user-agent Chrome 104 que emplea Next:

| Familia | Pesos | Respuesta observada |
| --- | --- | --- |
| Fredoka | 400, 700 | 6 declaraciones; 3 URLs distintas, todas `.woff2` |
| Rowdies | 300, 400, 700 | 9 declaraciones; todas `.woff2` |
| Lilita One | 400 | 2 declaraciones; todas `.woff2` |

No se recuperó el CSS exacto recibido durante el deployment fallido. La respuesta `/l/font?kit=…` es una causa demostrada mediante mock y compatible con la traza; no es una respuesta observada en esas consultas actuales. El fallo comprobado es la suposición de extensión del loader.

## Corrección indispensable

`patches/next@14.2.35.patch` adapta el tratamiento de extensiones del código actual de Next al paquete instalado:

1. Examina el pathname sin query/fragment.
2. Si no hay extensión, usa `format(...)` del CSS.
3. Si tampoco hay formato reconocido, conserva el supuesto WOFF2 correspondiente al user-agent de Next.
4. El loader utiliza esa extensión al emitir el mismo buffer descargado.

El parche está registrado en `package.json` mediante `pnpm.patchedDependencies` y en `pnpm-lock.yaml`. No se actualizó ninguna versión ni se añadió una dependencia. pnpm aplica el parche al instalar con el lockfile congelado. Al ser un parche del paquete compartido, también lo reciben los otros consumidores de Next 14.2.35 del workspace; el build configurado aquí solo ejecuta Web.

Fredoka, Rowdies y Lilita One conservan familias, pesos, subsets, display, variables, precarga y métricas de fallback. No cambia código de producto.

Referencia del loader original: [Next v14.2.35](https://github.com/vercel/next.js/blob/v14.2.35/packages/font/src/google/loader.ts). Referencia del manejo de extensiones consultado: [parser actual de Next](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/find-font-files-in-css.ts), consultado el 29 de octubre; `canary` es una referencia móvil.

## Configuración exacta del proyecto nuevo

| Ajuste | Remoto verificado antes de la corrección | Configuración preparada |
| --- | --- | --- |
| Framework | `null` / Other | Next.js (`nextjs`) |
| Root Directory | `null` / raíz del repositorio | `apps/web` |
| Build Command | `null` / comando por defecto de la raíz | `cd ../.. && pnpm exec turbo run build --filter=web...` |
| Output Directory | `null` / salida por defecto de Other | `.next`, relativa a `apps/web` |
| Install Command | `null` / automático | Automático con pnpm 8.10.0; equivalente explícito: `pnpm install --frozen-lockfile` |
| Node.js | `24.x` | Conservar `24.x` |

`apps/web/vercel.json` prepara Framework, Build Command y Output Directory. **Root Directory se establece en Project Settings de Vercel**, no dentro de `vercel.json`. Habilitar la inclusión de archivos fuera del Root Directory para acceder al workspace, lockfile, Turbo y `patches/` en la raíz. Subir el repositorio completo con el destino explícito correcto, cuando se autorice un deployment.

El modo público de esta superficie debe ser `NEXT_PUBLIC_CHESSCITO_MODE=play` en el entorno Vercel correspondiente. No se leyeron ni modificaron valores de entorno remotos en esta tarea.

El filtro `web...` incluye Web y sus dependencias de workspace. El plan actual contiene exclusivamente `web#build`, comando `next build`, sin dependencias internas. Mantiene la instalación del monorepo; limita las tareas de compilación. No modifica el build general usado por otras superficies.

Referencia: [Vercel y Turborepo](https://vercel.com/docs/monorepos/turborepo).

## Comparación con el proyecto anterior

| Proyecto / evidencia | Framework | Root Directory | Build Command | Output Directory |
| --- | --- | --- | --- | --- |
| `chesscito`, ID `prj_ZiblC0AJ0K6Mgz2MOPa1IwBugQoS`; conector actual | `nextjs`, verificado | No expuesto por el conector | No expuesto por el conector | No expuesto por el conector |
| `play-chess/chesscito-play`; guía canónica del 2026-10-07 | Next.js | `apps/web` | Por defecto, sin override | No registrado expresamente |
| `caos19/chesscito-play`; CLI/API actual | Other | Raíz | Por defecto de la raíz: ejecutó `pnpm run build` | Por defecto de Other |

La guía histórica de build-skipping también relaciona `chesscito` con `apps/web`, pero no certifica sus ajustes remotos actuales. La CLI autenticada solo enumera `caos19`; el conector accede al proyecto antiguo, pero omite los tres ajustes restantes. La comparación remota completa del anterior queda pendiente de acceso o de sus ajustes visibles. No se dedujeron valores ausentes.

## Validación

- Reproducción anterior al parche: 2 pruebas pasan y 7 fallan con el mismo TypeError.
- Después del parche: **9/9** pruebas del loader pasan, sin red, usando `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`. Cubren URLs ordinarias, kit, query/fragment, los formatos reconocidos, fallback WOFF2, deduplicación, precarga y conservación del CSS/variables/métricas. Los buffers del mock no son archivos tipográficos reales y no prueban renderizado visual.
- Lockfile: `pnpm install --lockfile-only --frozen-lockfile --offline --ignore-scripts` pasa en un workspace temporal con los manifests y el parche.
- Pruebas existentes de mode-routing, app-mode y source-fingerprint: **25/25** pasan.
- Cabeceras de producción: las tres familias de assets conservan `Cache-Control: public, max-age=86400`.
- Build real sin mocks: **exit 0**, una tarea Web, 122/122 páginas, 1m33.17s. Incluye lint y validación de TypeScript. Tres advertencias existentes de dependencias de hooks no bloquean la compilación.
- Build real con `NEXT_PUBLIC_CHESSCITO_MODE=play` explícito: **exit 0**, una tarea Web, 122/122 páginas, 1m19.243s. Se verificó la firma binaria WOFF2 de los 14 archivos `.woff2` emitidos.
- `apps/web/vercel.json` validado y `git diff --check` sin errores.
- Entorno local: Node 20.19.5, pnpm 8.10.0. El nuevo proyecto remoto usa Node 24.x; no se ejecutó ni se certificó un build remoto en esta tarea.

Comandos desde la raíz del repositorio:

```sh
pnpm install --frozen-lockfile
node --test apps/web/scripts/__tests__/google-font-loader.test.cjs
pnpm -C apps/web exec vitest run src/lib/__tests__/mode-routing.test.ts src/lib/hub/__tests__/app-mode.test.ts src/lib/bundle/__tests__/source-fingerprint.test.ts
NEXT_PUBLIC_CHESSCITO_MODE=play pnpm exec turbo run build --filter=web... --force
git diff --check
```

El build real continúa descargando fuentes desde Google; necesita acceso de red. La reproducción del fallo mediante mocks es independiente de Google. No se sustituyó la tipografía ni se convirtió el build en uno sin red.
