# Handoff — Íconos, cobertura VR del chip de ayuda, y la hoja PRO

**Fecha**: 2026-07-27 (segunda sesión del día) · **Rama**: `main` local, limpio
**Antecede**: `docs/handoffs/2026-07-27-focus-days-21-in-30-handoff.md`

## Estado

`main` local quedó **6 commits por delante de `origin/main`**: los cuatro de esta sesión más
`1c93d347` y `92b40d8b` de la anterior. ⏳ **El push a origin lo hace el founder.**

| Commit | Qué |
|---|---|
| `6c88ce2d` | `fix(hub)` — el ícono de ayuda ya trae su anillo; el CSS lo dibujaba otra vez |
| `1b5c85c3` | `chore(art)` — calendario nuevo para `hub.21-day-icon` (assets, sin código) |
| `30919b23` | `test(vr)` — los probes de hub estaban ciegos al chip de ayuda |
| `22418d08` | `fix(pro-sheet)` — la X se corría con el largo de la hoja; la corona no cruzaba el borde |

## Verificación

* Suite completa: **539 files / 6160 passing**, con **`VITEST_EXIT=0`** capturado aparte —
  no el exit del `tail` (vitest sale non-zero por `Unhandled Errors` con los conteos en verde).
* `pnpm exec tsc --noEmit`: limpio.
* VR `vr17` + `vr18`: **6/6**, y las seis fotos **miradas una por una**, no sólo el verde.
* Verificación visual a 390px: la hizo el founder sobre la app real.

## Lo que cerró

### Cluster Closure Protocol de Focus Days — completo

Issues y milestones: nada abierto del cluster (queda #272, Privy, que sobrevive). README sin
drift: no menciona los 21/30 días. MEMORY.md ya estaba sincronizado. Handoff: el de arriba.

**Branch hygiene**: `origin` quedó con `main` y `production` únicamente. Se borraron seis, todas
verificadas como squash-mergeadas antes de tocarlas (PRs #266–#271) — el `git log origin/main..`
las mostraba con commits "unmerged" porque el squash les cambia el SHA. Dos de las seis ya
estaban borradas en el servidor y sólo sobrevivían como refs de tracking stale en local.

### Los dos íconos

**`pregunta-icon`** (slot `shared.tour-help`) ahora incluye su circunferencia. Las **dos**
superficies que lo consumen la repintaban en CSS — `challenge-card-passport-help-icon` (LEARN) y
`kingdom-card-tour-help-icon` (PLAY) — con borde, fondo, `border-radius` e inset highlight, más un
`padding` que apretaba el glifo. Era anillo sobre anillo. Las cajas quedaron sólo como tamaño y
**el footprint no cambió**: el anillo CSS medía 22px/23px, que es lo que ahora mide el sprite.

**`21-day-icon`**: proporción de 240×272 → 240×284. **No pidió cambio de código** — los tres
consumidores son aspect-safe (la challenge card fija ancho con alto libre; hub-tour y la hoja de
compra usan cajas cuadradas con `object-fit: contain`). Efecto cosmético: ~3px más alto en la
card, ~4% más angosto dentro de las cajas cuadradas.

En los dos casos se verificó que **los tres formatos** (`png`/`webp`/`avif`) estén regenerados al
mismo tamaño. Si sólo se actualiza el PNG, el `<picture>` sirve el AVIF viejo y el ícono no cambia
en el navegador, sin ningún error que lo delate.

### La hoja PRO

`pro-sheet.tsx` posicionaba el botón cerrar con `top: 18%` desde el contenedor scrolleable. Un
`top` en porcentaje se resuelve contra el **alto** del contenedor — la hoja entera — así que caían
~160px y **el offset cambiaba con cada estado** (banner activo, perks, bloque de precio). El
`pt-[16%]` de al lado se ve igual en el código y es estable, porque el padding en porcentaje
siempre se resuelve contra el ancho. Dos números idénticos a la vista, comportamiento distinto.

Ahora el botón vive **dentro del panel** con `right-[4%] top-[4%]`, las mismas clases que
`MissionDetailSheet` — el vocabulario visual que pidió el founder.

La corona cruza el borde por la mitad: el banner mide 62% del ancho y el asset es 512×249, o sea
30.2% del ancho de alto; con `pt-[15.1%]` (la mitad) y el banner en `top-0`, su centro cae sobre
el borde del panel. **Los dos números tienen que moverse juntos** si cambia el ancho o el asset.

## Lo que se aprendió (y por qué costó)

**Los baselines VR salieron verdes fotografiando menos de lo que se envía.** Los fixtures de
`/dev/learn-hub` y `/dev/play-hub` no pasaban `onReplayTour`, y las dos tarjetas renderizan el
chip con `{onReplayTour ? … : null}`. Handler omitido → chip ausente → baseline ciego **justo del
cambio que iba a cubrir**, y en verde. Quedó como invariante en memoria:
`feedback_a_fixture_photographs_less_than_ships`.

**Los baselines de `vr17` traían dos semanas de drift sin revisar.** Venían del 2026-07-13 y
todavía mostraban el CTA `PLAY CHESS` y el dock `CHESS TOOLS`, que la refactorización a `PLAY
PATH` reemplazó. Nadie lo notó porque **CI no corre Playwright**. Recapturar por un cambio de
ícono adopta ese drift de contrabando: hay que mirar las fotos, no el verde.

**El wallpaper ausente en los probes es correcto, no un bug.** Lo pinta el shell, que `/dev` no
monta a propósito. Estos baselines vigilan layout, no fondo — y conviene tenerlo escrito para que
la próxima sesión no lo "descubra" otra vez.

**Re-baselinear se hace borrando el PNG**, nunca con `--update-snapshots`: un re-layout entero ya
entró una vez por debajo del `maxDiffPixelRatio` y dejó el baseline viejo en verde.

## Pendientes

1. **Las dos superficies de pago no tienen cobertura VR, y no se pueden fotografiar.** La hoja PRO
   no abre en headless (el CTA gatea por disponibilidad: `0` diálogos tras el tap), y la hoja de
   compra del Season Pass ya venía anotada con el mismo problema en el handoff anterior — el
   servidor visual corre en modo PLAY y la oferta sólo existe en LEARN. **Un probe `/dev` que monte
   cada hoja desacoplada de la wallet tapa las dos de una.** Estimado: media sesión.
2. **`pregunta-icon` está en 48×50** y se dibuja a 22px: alcanza para 2x, queda corto para 3x, que
   es lo que tiene la mayoría en MiniPay. No se upscalea. Si se ve blando, re-exportar a ~96×100.
3. **Falta una imagen del Play Kingdom** — la que está a la izquierda del título. El founder la
   cambia cuando le toque; no bloquea nada.

## Próximo paso

**Theme Builder** — el frente grande elegido el 2026-07-18. Arranca con `/spec`: estados de UI,
superficies del tablero que pinta un tema, persistencia y distribución. Arranca en frío y
**merece sesión propia**.

## Open questions

* ¿El probe de las hojas de pago se hace antes de Theme Builder, o se deja anotado y se avanza?
  Es deuda de cobertura, no un bug: nada está roto hoy por no tenerlo.
