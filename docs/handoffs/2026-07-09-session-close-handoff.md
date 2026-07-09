# Session close — 2026-07-09

**`main` = `daf4de36`.** Suite **4760 passing / 395 files**. Cuatro PRs mergeados.

La sesión empezó como un re-smoke y terminó destapando tres bugs que compartían
la misma firma: **algo verde verificaba una realidad muerta.**

---

## Qué se cerró

| PR | Qué |
| --- | --- |
| [#191](https://github.com/akawolfcito/chesscito/pull/191) `0f44eadc` | Deadlock de progresión de la sesión diaria |
| [#192](https://github.com/akawolfcito/chesscito/pull/192) `1cede56d` | Checklist de re-smoke + handoff + backlog del modal |
| [#193](https://github.com/akawolfcito/chesscito/pull/193) `04de19fa` | Los techos de estrellas leen el pool real |
| [#194](https://github.com/akawolfcito/chesscito/pull/194) `daf4de36` | Handoff del techo de estrellas |

**El re-smoke de LEARN pasó completo en device.** Badge de la torre minteado en
mainnet ([`0x327e80ae…`](https://celoscan.io/tx/0x327e80aee165a4aa2486458038ad252a453fb9432ed16732c6a67dec9c96ff4b)),
torre **Owned**, save proof sin 400.

Detalle en:
- `docs/handoffs/2026-07-09-daily-session-progression-deadlock-handoff.md`
- `docs/handoffs/2026-07-09-star-ceiling-real-pool-handoff.md`
- `docs/testing/2026-07-09-re-smoke-checklist.md`

## El patrón de la sesión

Tres fallos, una sola causa de fondo: una señal verde custodiando algo que ya no
existía.

1. **El test aislaba el predicado, nunca la composición.** `shouldFreezeScoring`
   estaba probado solo; nadie probaba `congelado → 0★ → gate del drawer`.
2. **Un comentario congeló el dato de hoy como garantía de mañana.**
   `EXERCISES_PER_PIECE = 5` decía "today every piece returns 5". Los pools
   crecieron a 10 y nada falló.
3. **El umbral de píxeles se tragó el texto que debía custodiar.**
   `maxDiffPixelRatio: 0.01` dejó pasar cuatro baselines dibujando `12/15`.

Codificado en [[feedback_deprecated_constant_outlives_migration]] y en la
corrección a [[feedback_vr_baseline_discipline]].

## Decisión de diseño tomada (no implementada)

Si `sign-badge` verifica estrellas, el umbral **proporcional evaluado en vivo se
rompe**: agregar ejercicios sube el techo y des-califica retroactivamente a quien
ya había cruzado la barra. La respuesta es **calificación monótona**: cuando el
jugador cruza por primera vez, el servidor escribe un bit permanente
`qualified(player, piece)` y `sign-badge` consulta el bit, no el catálogo vivo.
Encaja con la semántica del contrato, donde `hasClaimedBadge` ya es permanente.

Guardar el mapa disperso `exerciseId → estrellas`, nunca un `totalStars`: es la
única forma que sobrevive a que crezca o se reordene el catálogo.

---

## Estado del backlog

Auditado contra el código en `docs/backlog/2026-07-09-pending-work-triage.md`.
Dos items del backlog **ya estaban hechos** y nadie lo había anotado (el CTA
dorado, arreglado en #183; Post-Focus Free Practice, arreglado en #191).

**Rojo ahora mismo:** el baseline VR `hub-shop-sheet-open`. Verificado
corriéndolo, no inferido.

## Preguntas abiertas

- **¿Un laberinto fresco debe poder jugarse pasado el límite diario?** Ya no gasta
  cupo, pero `isLabReplayable()` lo trata como contenido nuevo. Ahora es decisión
  de producto, no consecuencia del código.
- **¿El reset diario debe ser UTC o local?** En UTC-5 el día entra a las 19:00,
  en plena sesión de noche. Local rompe la rotación determinista entre devices.
- **`/api/sign-badge` firma sin verificar estrellas.** Hay un badge en mainnet que
  ya ejercitó ese camino.
