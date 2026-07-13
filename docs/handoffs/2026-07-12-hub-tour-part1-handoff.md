# Handoff — Hub Tour (Daily-first), part 1

- **Fecha:** 2026-07-12
- **Spec:** `docs/specs/2026-07-12-hub-tour-daily-first-spec.md` (**Parte 1 hecha, Parte 2 NO**)
- **Rama:** `feat/hub-tour-daily-first` → mergeada a `main` local (`63c4ea9d`).
  **SIN PUSHEAR** — esperando OK del founder, porque el push a `main` deploya prod.

## Qué se construyó

El tour de 3 pasos del hub de LEARN: **Daily → Challenge → Start Focus**.

| Archivo | Qué es |
| --- | --- |
| `lib/hub/hub-tour.ts` | Lógica pura: itinerario, flag versionado, gate de modales |
| `components/hub/hub-tour.tsx` | Presenter: scrim + anillo + flecha + panel |
| `components/hub/use-hub-tour.ts` | Orquestación: *si* corre, y persistencia del resultado |
| `hub-lite-scaffold.tsx` | Los tres `data-tour-target` (daily / challenge / start-focus) |
| `learn-hub-client.tsx` | Montaje, LEARN-only, con los steps ya construidos |

**Suite: 5058 passing / 426 files** (venía de 5026/423). `tsc` limpio.

## Las tres decisiones que quedaron en el código

1. **El itinerario es fijo; el copy es lo que se adapta.** Como el tour llega también a
   veteranos, `buildHubTourSteps` elige el cuerpo honesto por paso: a quien ya compró el
   pass no se le vende, a quien ya resolvió el daily de hoy se lo manda a mañana.
2. **El gate decide UNA vez por mount.** Si hay un modal en pantalla cuando el hub asienta,
   este hub no es elegible y el tour espera al próximo. Re-evaluar en cada render lo haría
   saltar apenas se cierra la SeasonPassSheet — una emboscada, y justo la invariante de
   "un solo modal" que el tour existe para respetar.
3. **El dim ES el `box-shadow` del spotlight** (spread 9999px). Un nodo abre el hueco; sin
   `mask`, sin `clip-path`. Las anclas son cajas reales — `display: contents` no tiene caja
   y `getBoundingClientRect()` mediría 0×0.

## El defecto que los tests no vieron

Con los 10 tests del presenter en verde, el panel estaba **anclado al borde del viewport**,
no al target. El regalo del header vive arriba del todo → su panel aterrizaba en el **piso**
de la pantalla, tapando Start Focus mientras decía explicar el regalo.

Lo encontró un pase con Playwright a 390px, no la suite. **jsdom mide todo como 0×0**, así
que ninguna aserción de layout podía fallar. Los tres tests nuevos stubean el rect del
target — la medición que los anteriores nunca hacían.

Es la misma lección del device pass anterior: cada componente era correcto solo; la
composición era la mentira.

## Lo que sigue

1. **Parte 2 del spec, no empezada:**
   - Cierre del Daily: primario **Continue training**, secundario **Join Challenge**.
   - Recordatorios del Challenge: CTA contextual + chip. **Nunca modal**, máximo uno por día.
   - Un test que fije que `recordDailyCompletion` sigue teniendo **solo tres llamadores**
     (`daily-tactic-slot`, `hub-daily-tile`, `/challenge/daily`) — un ejercicio normal nunca
     cuenta como Daily. Hoy se cumple por accidente, no por contrato.
2. **Replay del tour desde Settings** (estado `replay` del spec) — no construido.
3. **Pase en device** del tour sobre un perfil real: es lo único que ve lo que la suite no.

## Open questions

- El anillo del daily mide `y: -2` a 390px (el icono roza el techo del viewport, y el
  padding de 8px del anillo se sale). Se ve bien, pero el borde superior queda cortado.
  ¿Se acepta, o el icono baja unos px?
- El flag es **local-only** por decisión del spec (no hay tabla de perfiles). Cambiar de
  dispositivo hace reaparecer el tour una vez. Aceptado hasta que exista `player_profiles`.
