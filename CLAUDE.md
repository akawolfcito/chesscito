# Chesscito — CLAUDE.md

## Proyecto
Juego pre-ajedrecístico educativo en la red Celo, distribuido via MiniPay.
Enseña movimientos de piezas de ajedrez con mecánicas gamificadas on-chain.

## Stack
- **Monorepo**: Turborepo + pnpm
- **App principal**: `apps/web` — Next.js 14 App Router + TypeScript
- **Estilos**: Tailwind CSS + clases custom en `apps/web/src/app/globals.css`.
  **Ese es el ÚNICO archivo CSS del app** — el split por superficie
  (`src/styles/{arena,hub,coach,exercises}.css`, P4 2026-06-12) fue revertido y ese
  directorio no existe. Toda clase nueva va a `globals.css`.
- **Blockchain**: Celo / MiniPay

## Distribución: Mobile-First via MiniPay
- Ancho máximo de app: `390px` (`--app-max-width`)
- **Desktop no es prioridad** — si algo no se ve bien en desktop, NO tocarlo
- Todo se diseña y prueba en viewport móvil

## Arquitectura de tablero
- Imagen del tablero: `apps/web/public/art/chesscito-board.png`
  - Vista **plana/ortográfica** desde arriba (8x8 cuadros uniformes)
  - Aspect ratio: 1/1 (1024×1024)
- Componente: `apps/web/src/components/board.tsx`
- Hit-grid: `.playhub-board-hitgrid` con `inset: 4.9% 4.4% 3.6% 4.6%`
- Piezas jugables: las **seis** (`PLAYABLE_PIECES`, `lib/game/exercises.ts:9`). La torre
  es la primera del recorrido, no la única — lógica en `apps/web/src/lib/game/board.ts`

## Clases CSS del tablero (`globals.css`)
- `.playhub-board-canvas` — contenedor con la imagen de fondo
- `.playhub-board-hitgrid` — capa de interacción sobre la imagen
- `.playhub-board-cell` — casilla individual (botón)
- `.playhub-board-cell.is-highlighted` — casilla con movimiento válido
- `.playhub-board-cell.is-selected` — casilla seleccionada
- `.playhub-board-label` — etiqueta de coordenada (a1–h8)
- `.playhub-board-dot` — punto indicador de movimiento válido
- `.playhub-board-piece` — pieza en el tablero

## Arte / Assets
- `bg-game.png/webp` — fondo general de la pantalla de juego
- `chesscito-board.png` — tablero plano teal/verde 8x8
- `bg-playhub-forest-mobile.png` — fondo del play-hub móvil
- `panel-frame-rune.png`, `shop-slot-frame.png` — marcos UI

### Reglas de assets
- **Reusar assets canónicos existentes** (`apps/web/public/art/**`) antes de crear iconos/SVGs nuevos — auditar lo que ya existe primero
- **NUNCA upscalear** sprites/imágenes low-res (causa pixelación); pedir el asset en resolución correcta

## Seguridad — Reglas Duras
- **NUNCA** commitear ni mostrar en pantalla: `.env`, private keys, API keys, seeds, credenciales, datos personales, ni nada dentro de `private/`
- **NUNCA** imprimir, loguear ni mostrar en output de terminal: tokens, service role keys, connection strings, passwords, ni cualquier secreto — ni siquiera parcialmente
- **NUNCA** stagear archivos sensibles — siempre revisar `git diff --staged` antes de commitear
- **NUNCA** usar `NEXT_PUBLIC_` para claves de servicio (Supabase service role, signer keys, etc.) — solo server-side
- Usar `.env.template` como referencia pública; los valores reales van solo en `.env` (gitignored)
- Si accidentalmente se expone un secreto: alertar al usuario para rotar inmediatamente, no solo eliminarlo del historial
- Supabase: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son server-only — jamás exponerlos al cliente

## Convenciones
- Commits: Conventional Commits (`feat:`, `fix:`, `style:`, `refactor:`)
- Firma de commit: `Wolfcito 🐾 @akawolfcito`
- Tests: Vitest + RTL (unit) + Playwright (E2E + VR); **7565 passing / 614 files**
  (medido en `main` limpio el 2026-08-09, `38b9d6c`). ⚠️ Este número **envejece con cada
  commit**: medilo vos en `main` limpio ANTES de empezar y compará contra esa medición,
  no contra lo que dice acá. Lo que NO envejece es la regla: **si el conteo de archivos
  BAJA respecto de tu propia medición, la corrida no vale** (ver más abajo por qué).
  ✅ **El VR está 66/66** — verde entero, **verificado con `--update-snapshots=none`**
  el 2026-08-09 (`e569d5f`, 66 passed en 2.1m).
  ⛔ **Ese 62/62 es del proyecto `minipay` y SÓLO de él.** `desktop`, `iphone-safari` y
  `minipay-360` **no tienen baselines**, y Playwright **graba el que falta y da el test por
  PASADO** (`updateSnapshots: "missing"` es su default, sin pasar ninguna flag). Una corrida
  completa reportó **69 passed** el 2026-08-07 habiendo **creado 118 baselines** y comparado
  casi nada. **Correr siempre `--project=minipay --update-snapshots=none`**: `none` no puede
  grabar, así que un verde ahí sí comparó. Si aparecen PNG nuevos en
  `e2e/visual-regression.spec.ts-snapshots/`, son grabaciones, no cobertura: `git clean`.
  ⛔ **El `webServer.env` NO protege a un server REUSADO.** `reuseExistingServer: !CI` hace
  que Playwright adopte el `pnpm dev` que ya tengas en 3002, y ese proceso **nunca recibe el
  pin de `NEXT_PUBLIC_CHAIN_ID`** — salió de tu shell, con lo que tu shell tenga. Ahí
  `hub-shop-sheet-open` y `hub-clean` se ponen rojas por el motivo de siempre y **parece**
  una regresión de código. Antes de correr el VR: **bajá tu dev server** y dejá que
  Playwright levante el suyo.
  ⛔ **Un `pnpm dev` (o un túnel) arriba INVALIDA la suite de Vitest, y no de forma honesta.**
  No la pone roja: hace que **algunos workers no arranquen** (`Failed to start forks worker`
  / `Timeout waiting for worker to respond`), y esos archivos **no corren**. El resumen dice
  "todo verde" con `exit 1`, y el error vive en `Unhandled Errors`, en la **cola** del log.
  El síntoma que lo delata es el **conteo de ARCHIVOS**, no el de tests: el 2026-08-07 fue
  bajando 610 → 605 → 604 mientras la duración subía de 142 s a 506 s; con la máquina libre
  volvió al conteo entero en 142 s. **Si el conteo de archivos baja respecto de tu propia
  medición en `main` limpio, no confíes en la corrida** — y nunca la reportes como número de
  commit. ⛔ **No pinees la constante acá**: este archivo llegó a declarar 598 en un lado y
  610 en otro estando el real en 614, y en disco hay 647 archivos de test (los patrones de
  `include` no coinciden con un `find`). Ningún número se deriva estáticamente: se mide.
  Diagnóstico de por qué había 49 rojas: `docs/audits/2026-08-06-vr-red-diagnosis.md`.
  ⛔ **El `webServer.env` del config PINEA `NEXT_PUBLIC_CHAIN_ID=42220` — no lo saques.**
  En Next las variables **del shell ganan sobre `.env*`**, y un shell con
  `NEXT_PUBLIC_CHAIN_ID=11142220` (Celo Sepolia) exportado reconfigura la app bajo test:
  `getConfiguredChainId()` da Sepolia mientras wagmi —hardcodeado `chains: [celo,
  celoSepolia]`— reporta 42220 para un visitante desconectado. Nunca coinciden →
  `getShopAddress()` null → el catálogo no se lee → todo pill en "Coming soon".
  Eso tuvo roja `hub-shop-sheet-open` durante meses, atribuido a "entorno sin treasury",
  que era **falso**: el address estaba bien y no se llegaba a mirar. El valor debe seguir
  siendo 42220 porque es el `chains[0]` de wagmi.
  ⚠️ Ese mismo shell afecta a `pnpm dev` normal: si el Shop se ve en "Coming soon" en
  local, mirá `echo $NEXT_PUBLIC_CHAIN_ID` antes de tocar código. Desde el 2026-08-06 eso
  **se avisa solo**: `ChainConfigWarning` (`components/dev/chain-config-warning.tsx`) pinta
  un banner ámbar en dev cuando el id configurado no es el `chains[0]` de wagmi. Se monta en
  las dos ramas de wallet y **fuera** de `ProductContextProviders`, porque a quien golpea es
  al visitante desconectado. ⛔ No es un pin: el override a Sepolia sigue siendo posible a
  propósito (ahí se validó Privy), sólo que ahora se ve.
  ⚠️ El config ya resuelve `BASE_URL` a 3002 solo (`fad1e3d9`); en 3000 `ProOriginWarning`
  pinta un banner de dev sobre cada página real. ⛔ Si pasás `--reporter=list`, el reporte
  HTML **no se escribe** — no uses su `mtime` como prueba de que la suite corrió.
  Un test que verifica "un solo modal a la vez" **debe contar
  `[aria-modal="true"]`, nunca `role="dialog"`**: `LabyrinthCompleteOverlay` usa
  `role="alert"`, así que contar roles pasa en verde con dos diálogos en pantalla
- Idioma de UI: English (ver `lib/content/editorial.ts`)
- **Git staging**: stagear paths explícitos en `git add`; NUNCA pathspecs con brackets/globs (zsh los interpreta y deja archivos fuera — ya rompió main una vez)

## Command hygiene (evita prompts de permiso — aplica a mí Y a subagentes)
Estas reglas hacen que los comandos matcheen la allowlist y no disparen gates de seguridad. Codificadas aquí para que cada sesión las herede (2026-06-16):
- **NUNCA prefijes con `cd`.** `cd <ruta> && git ...` dispara el aviso de seguridad "cd cambia de directorio antes de git → hooks no confiables" Y rompe el match de `Bash(git:*)`. Usa `git -C <ruta-absoluta> ...` y `pnpm -C <ruta-absoluta> ...` (empiezan con `git`/`pnpm` → matchean).
- **Un comando por herramienta**; no mezcles `cd`/`cat`/`node`/pipes en una línea (no matchea un prefijo único).
- **Sin heredocs** (`<<EOF`) ni scripts probe en `/tmp`: crea archivos con la tool Write. zsh tiene `noclobber` → `>` sobre un archivo existente falla; usa Write o `git checkout --`.
- **Typecheck con `pnpm exec tsc --noEmit`** (matchea), NO la ruta cruda `node_modules/.bin/tsc` ni con `| grep/wc`.
- **Todo `docker run` de probe/test lleva `--rm`.** Borra el contenedor **y sus volúmenes
  anónimos** al salir; sin él cada corrida deja un Postgres colgado con su volumen de datos
  (así se juntaron 17 huérfanos hasta el 2026-08-06). El defecto **no es `-d`**: es `-d --name`
  **sin `--rm`**, que además sobrevive a la sesión y colisiona con la siguiente. Los tres
  consumidores del repo ya cumplen y muestran las dos formas válidas —
  `--rm -i` en foreground (`scripts/ops/verify-stats-rpcs.ts:860`,
  `scripts/ops/collectors/supabase.ts:190`) y `--rm -d --name` cuando hace falta entrar por
  `psql` desde otra terminal (`apps/web/scripts/privileged-views-role-probe.sql:15`, que se
  cierra con `docker rm -f <name>`).
  ⚠️ Excepción deliberada: el `postgres:16-alpine` **persistente** de `pnpm ops:health` — esa
  no se toca ni se levanta a mano.
- Al despachar **subagentes**, repite estas reglas en su prompt (hereda este archivo, pero reforzar evita el `cd`-por-default).

## Specs de features con UI

Antes de implementar cualquier feature con flujo interactivo, el spec DEBE enumerar:

- Todos los estados de UI y sus transiciones (locked/unlocked, completed/incomplete, progresión)
- Edge cases por estado (¿qué pasa si tap en elemento locked? ¿qué pasa al completar el último item?)
- Sin esta enumeración, los bugs de flujo aparecen en QA post-entrega y cuestan rondas extra

## Verificación de deploys — NO es mi tarea (founder, 2026-07-16)

**NO verifiques deploys por tu cuenta. Solo si te lo piden explícitamente.**

El founder lo verifica **visualmente**: le cuesta 0 tokens y menos de 1 segundo. Que yo
haga polling a la URL + smoke test cuesta minutos y tokens para producir la misma
respuesta que él ya tiene de un vistazo.

- ❌ NO poll a la URL esperando que propague el build.
- ❌ NO smoke test contra la URL live por iniciativa propia.
- ❌ NO dejar "verificar el deploy" como próxima tarea en el handoff.
- ✅ Mergear, pushear, y **avanzar**. Si el deploy está mal, él lo ve antes que yo.
- ✅ Si pide "verificá el deploy" explícitamente: ahí sí, y con smoke test.

> Regla anterior (derogada): "después de cada deploy, poll + smoke test + no cerrar sesión
> sin confirmar". Se escribió pensando en que yo era el único que podía mirar. No lo soy.

## Cluster Closure Protocol

Cuando un cluster / feature / spec termine y haga merge a `main`, ejecutar este checklist antes de pasar al siguiente:

1. **GitHub housekeeping**
   - Cerrar issues asociados al cluster
   - Cerrar milestone si todos sus issues están `closed`
   - Reasignar issues que sobreviven al milestone correcto
2. **README sync** — si la sección "What's live" cambió:
   - Actualizar tabla de contracts (mainnet addresses)
   - Actualizar tagline + bullets de features
   - Actualizar Tech Stack si hay layer nuevo
3. **MEMORY.md sync** — actualizar índice con estado final del cluster
4. **Branch hygiene** — borrar branches mergeadas en origin (verificar `git log origin/main..origin/<branch>` antes)
5. **Handoff doc** — escribir `docs/handoffs/YYYY-MM-DD-<topic>-handoff.md` con estado, próximos pasos y open questions

Sin este protocolo, la documentación deriva del estado real y el repo acumula ruido visible (branches stale, issues abiertos, README desactualizado).
