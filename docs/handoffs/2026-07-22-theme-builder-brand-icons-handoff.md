# Handoff — Theme builder: OG card + derived brand icons

**Fecha:** 2026-07-22
**Estado:** cluster COMPLETO en `main`. 10/10 tareas del plan.
**Suite:** 5670 passing / 502 files · typecheck limpio · `theme:coverage` exit 0

Spec: `docs/superpowers/specs/2026-07-22-theme-builder-brand-icons-design.md`
Plan: `docs/superpowers/plans/2026-07-22-theme-builder-brand-icons.md`

## Qué se puede hacer ahora que antes no

1. **Actualizar el favicon sin tocar archivos.** Reemplazás `brand.favicon` en
   `/dev/theme-builder` y los 5 iconos de marca se regeneran solos, en las dos apps.
2. **`pnpm icons:generate`** los reconstruye a mano; **`--check`** falla si driftaron.
3. **El OG card es un slot** con gate de 1200×630 exactos.
4. **CI falla ante drift de assets** — job `Asset drift`, tres guards.

## Los dos conceptos nuevos del registry

Ambos son opcionales y ausentes en los ~165 slots que ya existían, así que
nada cambió para ellos.

| campo | qué hace |
|---|---|
| `format?: "jpg" \| "ico" \| "png"` | el slot es UN archivo con esa extensión, no el triplete PNG/WebP/AVIF |
| `derivedFrom?: ThemeAssetKey` | el slot se genera desde otro: read-only en UI **y** rechazado con 400 en la API |
| `exactSize?: {width, height}` | rechaza un upload que no mida exactamente eso |

## Los 5 iconos derivados

Master: `apps/web/public/art/favicon-wolf.png` (1254², slot `brand.favicon`).

```
apps/landing/public/favicon.ico      ICO 16+32+48   ← cataloged
apps/landing/public/apple-icon.png   180×180        ← cataloged
apps/web/src/app/favicon.ico         ICO 16+32+48
apps/web/src/app/apple-icon.png      180×180
apps/web/src/app/icon.png            192×192
```

Los 3 de `apps/web` viven fuera de `public/` (convención de Next), así que el
resolver del catálogo no los alcanza: el script sí los escribe, pero no son
slots. Es la razón por la que el builder cataloga solo 2 de los 5.

## Decisiones que quedaron fijadas

- **Write-then-derive.** Si la derivación falla, el master queda escrito y la
  respuesta lo dice (`derived: {ok:false}`). No se revierte: deshacer un
  reemplazo bueno por un icono malo es peor, y `icons:generate` recupera.
- **Solo la variante `default` deriva.** El arte PRO de un tema no puede cambiar
  el favicon del browser: estos iconos son **marca**, no tema.
- **El rechazo de slots derivados cubre upload, set-mode y undo.** Los tres
  serían borrados por la próxima regeneración.
- **ICO sin dependencia nueva.** `sharp` no encodea ni decodea ICO. El contenedor
  se arma a mano en `ico-encoder.ts` (~56 líneas). Validado con `file(1)` y
  CoreGraphics, no solo con sus propios asserts.
- **El JPEG se aplana sobre blanco.** JPEG no lleva alpha y el matte por defecto
  de sharp pinta los transparentes de **negro**.

## Cosas que descubrí y corrigen afirmaciones previas

- **Los dos `apple-icon.png` NO estaban visualmente divergidos.** Diferían en
  bytes (metadata/compresión), no en píxeles. Lo afirmé mirando solo el md5.
  El valor real del cambio no es arreglar una divergencia: es que ya no puede
  aparecer una.
- **El arte del favicon cambió.** `favicon-wolf` es más nuevo que lo que estaba
  en producción (sombrero con estrellas vs. sombrero liso con medallón).
  Decisión del founder: adoptar el arte nuevo. Visible en la pestaña del browser
  y en la home screen.
- **Hay tres ilustraciones del personaje conviviendo**: `favicon-wolf` (app icon
  cuadrado), `icon-512` (PWA, lobo con bastón sobre transparencia) y el arte
  viejo de los iconos, ahora reemplazado.
- **La derivación es determinista.** Regenerar sobre iconos ya generados da
  bytes idénticos → `--check` no va a dar falsos positivos en CI.

## Bugs encontrados y arreglados que no estaban en el plan

1. **Mensaje mentiroso en el gate de tamaño.** Un OG del tamaño equivocado
   respondía *"could not decode image — upload a valid PNG/JPG/WebP"*. La imagen
   decodificaba perfecto. Encontrado manejando el server real, no por los tests:
   todos miraban el writer, ninguno el mensaje que llega al usuario. Ahora
   `wrong-dimensions` es su propio código y nombra tamaño requerido y real.
2. **Flaky de timeout preexistente.** `responsive-asset-audit.test.ts` tarda
   ~8s y tenía el default de 5s: fallaba de forma intermitente bajo la suite
   completa, culpando a un timeout en vez de al audit. Verificado contra
   baseline con `git stash` antes de tocarlo. Timeout a 30s.

## Errores del plan, para la próxima

- **Pedía tests rojos + typecheck verde a la vez.** Imposible cuando el test
  nombra un `ThemeAssetKey` que no existe: eso es TS2367, error de compilación,
  no una aserción que falla. Las tasks 5 y 8 se reordenaron por eso.
- **Asumía un job de CI que no existía.** El plan decía "agregar
  `icons:generate:check` al job que ya corre `art:sync-landing:check`". Ese job
  nunca existió — el repo tenía tres guards y CI no corría ninguno.
- **Las tasks 6 y 8 se commitearon juntas** para no dejar main en rojo.

## Próximos pasos

Ninguno es bloqueante; el cluster está cerrado.

1. **`apps/web/public/icon-512.*`** quedó fuera de alcance a propósito. Es slot
   del builder y su arte es distinto (lobo con bastón). Si se quiere un solo
   master para todo, hay que decidir primero si ese arte se retira.
2. **Los 3 iconos de `apps/web/src/app` no son catalogables.** Para que lo sean,
   el resolver tendría que salir de `public/`, que es un cambio al contrato de
   `asset-roots.ts` más grande que este cluster.
3. **Housekeeping de cluster** (CLAUDE.md): cerrar issues/milestone asociados si
   los hay, y evaluar si `MEMORY.md` necesita una entrada — el concepto de slot
   derivado cambia la regla de "un slot = un archivo editable".

## Open questions

- ¿El `apple-icon` debería salir de un master **sin** esquinas redondeadas?
  `favicon-wolf` ya las trae horneadas e iOS aplica su propia máscara encima,
  así que puede haber doble redondeo. No lo verifiqué en device: el founder
  eligió adoptar el arte y esto no bloqueaba. Se ve en un iPhone en 5 segundos.
