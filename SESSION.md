# Session Handoff — 2026-07-27 (cierre del día)

> 📌 El detalle de esta sesión vive en
> `docs/handoffs/2026-07-27-icons-vr-coverage-and-pro-sheet-handoff.md`.
> El cluster Focus Days 21-en-30 vive en `docs/handoffs/2026-07-27-focus-days-21-in-30-handoff.md`.
> Este archivo es el checklist.

## Completed

- **Cluster Closure Protocol de Focus Days: completo.** `origin` quedó con `main` y `production`
  únicamente — seis branches borradas, todas verificadas como squash-mergeadas (#266–#271) antes
  de tocarlas. Issues/milestones sin nada abierto del cluster; README sin drift; MEMORY.md ya
  estaba sincronizado.
- `6c88ce2d` — **fix(hub)**: el ícono de ayuda ya trae su anillo y el CSS lo repintaba. Anillo
  sobre anillo en las **dos** superficies del slot `shared.tour-help` (LEARN y PLAY).
- `1b5c85c3` — **chore(art)**: calendario nuevo. Sin cambio de código: los tres consumidores son
  aspect-safe. Verificado que los tres formatos (png/webp/avif) estén regenerados igual.
- `30919b23` — **test(vr)**: los fixtures de `/dev/learn-hub` y `/dev/play-hub` no pasaban
  `onReplayTour`, así que los baselines estaban **ciegos al chip** y en verde. Seis baselines
  recapturados borrando el PNG.
- `22418d08` — **fix(pro-sheet)**: la X se posicionaba con `top: 18%` contra el **alto** de la
  hoja, así que se corría con cada estado. Ahora vive dentro del panel con las clases de
  `MissionDetailSheet`. La corona cruza el borde por la mitad (`pt-[15.1%]` + banner en `top-0`).

## Current State

- **Branch**: `main`, limpio, **6 commits por delante de `origin/main`** (los cuatro de arriba más
  `1c93d347` y `92b40d8b`). ⏳ **El push a origin lo hace el founder.**
- **Build**: suite **539 files / 6160 passing**, con **`VITEST_EXIT=0`** capturado aparte del
  `tail`. `tsc --noEmit` limpio. VR `vr17`+`vr18`: **6/6**, y las seis fotos miradas una por una.
- **Uncommitted work**: no.
- **Verificación visual**: la hizo el founder a 390px sobre la app real.

## Next Tasks

1. **Theme Builder** — el frente grande. Arranca con `/spec`: estados de UI, superficies del
   tablero que pinta un tema, persistencia y distribución. **Merece sesión propia.**
2. **Probe `/dev` para las dos hojas de pago** (PRO y Season Pass) — ninguna de las dos se puede
   fotografiar hoy. Media sesión, tapa las dos de una. Es deuda de cobertura, no un bug.
3. **`pregunta-icon` a ~96×100** si en un 3x se ve blando. No se upscalea.

## Blockers

- Ninguno.

## Notes

- **Un fixture de `/dev` fotografía SOLO lo que le pasa.** Un handler opcional omitido deja el
  baseline ciego a un elemento que en producción siempre está — y en verde. Antes de recapturar
  un baseline "para cubrir" un cambio: **abrir el PNG y verificar que el cambio esté ahí.**
- **El wallpaper ausente en los probes es correcto**, lo pinta el shell que `/dev` no monta a
  propósito. Estos baselines vigilan layout, no fondo. No es un bug que redescubrir.
- **`vr17` traía dos semanas de drift** (CTA `PLAY CHESS` y dock `CHESS TOOLS`, reemplazados por
  `PLAY PATH`) porque **CI no corre Playwright**. Recapturar por otra cosa lo adopta de contrabando.
- **Percentage `top` ≠ percentage `padding`.** El `top` de un absolute se resuelve contra el
  **alto** del contenedor; el padding en porcentaje, incluso el vertical, **siempre** contra el
  ancho. Se ven idénticos en el código y sólo uno es estable. Fue la causa del bug de la X.
- **Actualizar un ícono es actualizar tres archivos.** Si sólo se toca el PNG, el `<picture>`
  sirve el AVIF viejo y no cambia nada en el navegador, sin error que lo delate.
