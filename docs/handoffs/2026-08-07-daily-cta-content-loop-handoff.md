# Handoff — Sprint 1: el CTA post-Daily consume el Content Loop

**Fecha:** 2026-08-07 · **Rama:** `feat/daily-cta-content-loop` (3 commits, **sin pushear**)
**Spec:** `docs/specs/2026-08-07-daily-cta-content-loop.md` (v2, READY)
**Red team:** `…-redteam.md` (4 P0 + 4 P1 resueltos) · **UX:** `…-daily-cta-slot-ux.md` (Sally)
**Roadmap del bloque:** `docs/product/2026-08-07-retention-loop-roadmap.md`

---

## Estado

| | |
|---|---|
| Suite web | **7503 passing / 610 files, EXIT=0** (baseline previa: 7471 / 607) |
| `tsc --noEmit` | limpio |
| VR | **minipay 62/62**, corrido con `--update-snapshots=none` |
| 390 px | **medido**: las 8 etiquetas en una línea, `overflow=0`, altura 53,2 px |
| Árbol | limpio |

### Commits

| Hash | Qué |
|---|---|
| `3e6db69` | `lib/hub/cta-slot.ts` — módulo puro + tabla de verdad (15 tests) + spec/red-team/UX/roadmap |
| `74fd2e4` | card, scaffold, adapter, copy EN/ES, CSS, source guards, `resolveCtaTap` |
| `2235ac0` | probe de `/dev/learn-hub` + un baseline VR regenerado |

---

## Qué cambió

El slot del CTA de la `ChallengeCard` dejaba de pasar `onFocusTap` en cuanto el día estaba
hecho y pintaba un `<p>` con clases de botón, desaturado (`saturate(.55)`) y con `opacity`
bajada: **el vocabulario de un control roto, servido en el segundo posterior a un éxito.**
El Content Loop derivaba la acción correcta y nadie la renderizaba.

Era una **regresión de integración**: el 2026-07-25 se ocultó el botón standalone START
FOCUS porque dos CTAs apilados hacían el panel ambiguo, y la tarjeta "absorbió su trabajo"
**sólo para el estado `start`**.

- `CtaState` pasa de 4 estados a 3: `join | complete | loop`.
- La tarjeta **ya no lee `focusPassport.todayDone`** para elegir el slot. Era una segunda
  lectura del hecho que el loop ya decide con `isCompletedToday`, hidratada por otro camino.
  El pasaporte sigue siendo dueño de las llamas; dejó de ser dueño del CTA.
- Terminal con clase propia `.challenge-card-cta--quiet`: una leyenda, sin fondo/borde/
  sombra/filtro, **con el `min-height` del botón reservado**.
- Dos notas, no una: `noteDailyReturns` (terminó todo) vs `noteTrainingResumes` (chocó con
  la cuota de sesión, que no es lo mismo). `tomorrowNote` retirada.
- `resolveCtaTap` concentra las dos decisiones que no son JSX — a dónde va y qué evento
  emite — para que el contenedor no crezca una segunda copia y para poder asertarlas sin
  montar el hub.

### Las dos excepciones, declaradas y no escondidas

1. **`daily-pending` conserva `startFocusExerciseDestination`** (`LEGACY_DESTINATION_VARIANTS`).
   El loop apunta a `/exercises?slot=daily`, y ese param tuvo la cuota diaria apagada hasta
   el 2026-08-05. Este sprint arregla el terminal; no mueve el camino más transitado.
   **Borrar esa constante es el trabajo pendiente, no un detalle.**
2. **`hub_start_focus_tap` queda exclusivo del start real.** Las otras seis variantes emiten
   `hub_content_loop_cta_tap` con `{ variant, destination }`. Sin esto, cualquier lectura
   histórica de esa serie se volvía incomparable en silencio.

---

## Baseline de exposición (OQ-2, medido 2026-08-07T19:56Z)

| Métrica | Valor |
|---|---|
| Filas `lite_season_passes` | 16 |
| **Pases activos** (`expires_at > now()`) | **13** |
| Wallets distintas con pase activo | **13** |

**Al 2026-07-27 eran 3: 4,3× en once días.** Misma definición de "activo" que
`readSeasonPassRow()`, para que el baseline y el código no discrepen.

⚠️ **13 es la población expuesta**: son los únicos que pueden ver el estado arreglado
(sin pase, `!isActive` gana y el slot es el banner de $0.99). Con esa n, **un jugador
cambiando de hábito mueve el 7,7%** — no soporta atribución causal fuerte. Lo que sí se
puede afirmar es exposición, y eso lo cuenta `hub_content_loop_cta_tap`.
**Al cerrar, re-medir: si la población creció, la comparación mezcla dos cohortes.**

---

## Dos hallazgos que valen más que el sprint

### ⛔ Playwright graba los baselines que faltan y da el test por PASADO

`updateSnapshots: "missing"` es su **default**, sin pasar ninguna flag. La corrida completa
de este sprint reportó **69 passed** habiendo **creado 118 baselines** para `desktop`,
`iphone-safari` y `minipay-360` — proyectos que nunca tuvieron baselines — y comparado casi
nada. Se borraron con `git clean` y se repitió todo con `--update-snapshots=none`.

⇒ **El "VR 62/62" del repo es del proyecto `minipay` y sólo de él.** Regla ya escrita en
`CLAUDE.md`: correr `--project=minipay --update-snapshots=none`. PNG nuevos en el directorio
de snapshots son grabaciones, no cobertura.

### ⚠️ El probe de `/dev/learn-hub` fotografiaba el fallback, no la feature

`fixture.tsx` pasaba `contentLoop: null` a las tres variantes. Tras el cambio, las tres
fotografiaban el estado de **pre-hidratación** — un status — y el VR **no cubría la
presentación de acción en absoluto**. Habría quedado verde sin haber fotografiado nunca un
botón. Corregido: `pro` fotografía la acción, `active` el terminal.

---

## Evidencia, no aserciones

- **Exhaustividad (AC-8)** verificada empíricamente: se agregó una variante sonda a
  `ContentLoopVariant` y `tsc` cayó en `cta-slot.ts(142,9): TS2322: … not assignable to
  type 'never'`. Sonda revertida.
- **390 px** medido con el CSS y la fuente reales sobre el probe: el botón lleva
  `white-space: nowrap`, así que una etiqueta larga **no se parte, se desborda** — por eso
  se midió `scrollWidth − clientWidth`, que dio **0** en las 8. `Prueba el laberinto` (19
  car., el techo declarado) entra. **El fallback `Al laberinto` no hace falta.**
- **VR revisado antes de regenerar**: se leyeron el diff y el actual. `guest` y `pro` pasan
  contra sus baselines **originales sin tocar** ⇒ el botón nuevo renderiza **pixel-idéntico**
  al `start` viejo. Un solo baseline regenerado: `vr18-learn-hub-active`.
- **Guards de CSS por lectura de fuente**, no por layout: jsdom no mide altura, así que un
  test que dijera medirla pasaría verde sin medir nada.

🧯 **Corrección a algo que afirmé a mitad de sesión:** dije que la fila de llamas era
dependiente de la fecha y ensuciaría el baseline. **Falso** — `pro` pasó contra su baseline
original. El único diff real era el slot del CTA.

---

## Próximos pasos

1. ▶️ **Del founder: mirar el hub en device.** Es lo único que nadie vio renderizado en la
   app real (el 390 px está medido, pero sobre el probe de `/dev`).
2. ▶️ **Del founder: push de la rama y merge a `main`.**
3. Al cerrar el sprint: **re-medir los pases activos** y leer `hub_content_loop_cta_tap`.
4. Sprint 2 del roadmap: **identidad propia de Labyrinths**, que arrastra una decisión de
   modelo — hoy `path.ts:34` dice *"exercise stars ONLY — labyrinth stars never count"*, así
   que la cadena *más dificultad → más estrellas → mejor posición* **está cortada**.

## Open questions

- **OQ-1 (decidida, escrita):** `role="status"` es una live region; al pasar a `<button>` se
  pierde el anuncio automático. Se acepta — ese anuncio pertenece al flujo de celebración,
  no al hub. Queda deliberado, no como efecto lateral.
- **Estado `complete`** (21 días terminados): sigue compartiendo la leyenda gris con quien
  sólo hizo su Diaria de hoy. Fuera de alcance a propósito; merece su propia ronda.
- **¿Los otros tres proyectos VR merecen baselines?** Hoy no los tienen y cualquier corrida
  completa los "pasa" grabándolos. Generarlos son ~118 PNG que nadie revisó nunca.
