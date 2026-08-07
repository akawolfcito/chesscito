# Spec — daily-cta-content-loop

**Fecha:** 2026-08-07
**Estado:** ✅ **READY para `/tdd`** (v2 — P0-1..4, P1-1..4 y P2-1..2 aplicados)
**Sprint:** 1 de `docs/product/2026-08-07-retention-loop-roadmap.md`
**Ronda de UX:** `docs/specs/2026-08-07-daily-cta-slot-ux.md` (Sally, incorporada acá)
**Red team:** `docs/specs/2026-08-07-daily-cta-content-loop-redteam.md` (v1, resuelto)

## Problema

Cuando un jugador con Season Pass activo completa su Diaria y vuelve al hub, el slot del
CTA de la `ChallengeCard` pinta un `<p role="status">` con **las mismas clases de botón**
más `filter: saturate(0.55) brightness(0.94)` y `opacity: 0.92` (`globals.css:8849`). Es
el vocabulario exacto de un botón deshabilitado: parece un control, y parece uno **roto**.
Llega en el instante posterior a un éxito, y dice *"ya terminaste, vete"*.

Es una **regresión de integración**, no un hueco de diseño. El 2026-07-25 se ocultó el
botón standalone START FOCUS porque dos CTAs primarios apilados hacían el panel ambiguo;
el comentario en `hub-lite-scaffold.tsx:220` dice que *"the ChallengeCard's single
state-driven CTA absorbed its job"*. La absorbió **sólo para el estado `start`**:
`onFocusTap` se pasa únicamente en esa rama (`challenge-card.tsx:570`).

Mientras tanto `lib/hub/content-loop.ts` sigue derivando la next-best-action correcta, con
destino, y `hub-lite-scaffold.tsx:59` documenta que `primaryFocus.contentLoop` existe para
*"drive the label intent"* — pero **el scaffold nunca se lo pasa a la tarjeta**. El motor
calcula bien y nadie renderiza el resultado.

⚠️ **Ese cable nunca fue ejercitado.** `primaryFocus.contentLoop` llega hidratado al
scaffold desde hace semanas y ningún consumidor lo lee. Se implementa como **código nuevo**,
no como código existente que se reusa.

## Goal

Que el slot del CTA de la `ChallengeCard` consuma la next-best-action del Content Loop en
vez de fabricar localmente el estado `tomorrow`, de modo que **nunca se renderice un
control con apariencia de acción sin una acción válida detrás**.

## Non-goals

- Vitrina / carrusel / banners rotativos. **Descartado explícitamente por el founder.**
- CTA secundario (`EXPLORE LABYRINTHS` u otro). Un solo CTA primario, invariante de 2026-07-25.
- Entrada propia de Labyrinths (Sprint 2). Si la variante es `labyrinth-ready`, alcanza el
  destino que ya existe.
- Semántica de estrellas de laberinto (decisión de modelo, Sprint 2).
- Rediseño del estado `complete` (21 días terminados). Merece su propia ronda, y **su CSS
  no se toca** (ver P0-3 → `Contracts`).
- Cambiar la URL de destino de `daily-pending` (ver **Excepción de compatibilidad**).
- Tocar el avatar/logo, la fila de beneficios, el pasaporte o la ruta de entrenamiento.
- Añadir una línea `DAILY COMPLETE ✓`. **Rechazada**: la celebración ya ocurrió en el overlay.
- Cambiar el estado `join` (banner de $0.99). Es la referencia de estilo, funciona.
- Alcanzar al jugador **sin** pase activo: `!isActive` gana siempre y seguirá viendo el banner.

## Excepción de compatibilidad — `daily-pending` (decisión del founder, P0-2)

**El Content Loop es la fuente de verdad de la VARIANTE. No lo es, todavía, del DESTINO de
`daily-pending`.**

- Hoy el hub navega a `startFocusExerciseDestination(primaryPiece)` (`learn-hub-client.tsx:652`).
- `ACTIONS["daily-pending"].destination` es `/exercises?slot=daily` (`content-loop.ts:93`).

Son URLs distintas, y `?slot=daily` es el query param que tuvo **apagada la cuota diaria
entera** hasta el 2026-08-05. Este sprint existe para arreglar el estado terminal; no mueve
el camino más transitado del producto.

⇒ El adapter del Hub **preserva la navegación histórica sólo para `daily-pending`**, vía una
constante nombrada y greppable. Todas las demás variantes usan `action.destination`.

```ts
/** ⚠️ DEUDA TEMPORAL — Sprint 1, 2026-08-07.
 *  El Content Loop manda la variante; para `daily-pending` el destino sigue siendo el
 *  histórico. Unificar exige verificar que `?slot=daily` no vuelve a apagar la cuota
 *  (ver docs/handoffs/2026-08-05-daily-quota-slot-bypass-handoff.md). Borrar esta
 *  constante es el trabajo, no un detalle. */
export const LEGACY_DESTINATION_VARIANTS = ["daily-pending"] as const;
```

## Contracts (SDD)

```ts
// lib/hub/cta-slot.ts — NUEVO módulo puro. Sin React, sin IO, sin localStorage.

import type { ContentLoopAction, ContentLoopVariant } from "@/lib/hub/content-loop";

/** Cómo se PRESENTA el slot. Dos naturalezas distintas, no un objeto
 *  sano/enfermo: `action` es un <button>, `status` es una leyenda. */
export type CtaSlotPresentation =
  | { kind: "action"; variant: ContentLoopVariant; destination: string; labelKey: CtaLabelKey; noteKey: null }
  | { kind: "status"; variant: ContentLoopVariant; destination: null; labelKey: CtaLabelKey; noteKey: CtaNoteKey };

/** Claves de next-intl bajo CHALLENGE_CARD_COPY. ⛔ NO se usan los `ctaEN`/`ctaES`
 *  de content-loop.ts: viajan fuera de next-intl y el guard de paridad del bundle
 *  no los cubre. */
export type CtaLabelKey =
  | "ctaStartToday"      // daily-pending — YA EXISTE, no se toca
  | "ctaClaimGift"       // claim-pending
  | "ctaKeepTraining"    // continue-path
  | "ctaTryLabyrinth"    // labyrinth-ready
  | "ctaBeatScore"       // improve-stars
  | "ctaNewPiece"        // next-piece
  | "ctaViewProgress"    // view-progress
  | "ctaTomorrow";       // los tres sin destino — YA EXISTE, se reusa

/** P1-4: dos notas, porque las tres variantes sin destino NO dicen lo mismo. */
export type CtaNoteKey =
  | "noteDailyReturns"      // come-back-tomorrow — terminó todo
  | "noteTrainingResumes";  // daily-limit/max-reached — chocó con la CUOTA, no con la Diaria

/** Único traductor variante → presentación. Determinista y TOTAL: las 10 variantes
 *  tienen caso explícito, sin `default` (AC-8). */
export function toCtaSlotPresentation(action: ContentLoopAction): CtaSlotPresentation;
```

```ts
// components/hub/challenge-card.tsx

export type ChallengeCardProps = {
  // ...los actuales, sin cambios...

  /** Presentación YA resuelta por el adapter del Hub. La tarjeta no deriva nada:
   *  ni consulta el loop, ni mira `focusPassport.todayDone` para elegir el slot
   *  (P0-1). `null` = pre-hidratación → la tarjeta rinde `status` (AC-9). */
  ctaSlot?: CtaSlotPresentation | null;

  /** P1-1: recibe el destino. NO es `() => void`: una función que ignora el
   *  argumento compila y descarta el destino en silencio. */
  onFocusTap?: (destination: string) => void;
};
```

```ts
// P0-1: `tomorrow` desaparece como estado fabricado por la tarjeta.
type CtaState = "join" | "complete" | "loop";
//                                    ^^^^^^ TODO lo demás lo decide el Content Loop,
//                                    incluido el ex-`start` (que hoy es `daily-pending`).
```

**P0-3 — CSS:** el terminal del loop estrena `.challenge-card-cta--quiet`.
`.challenge-card-cta--info` **queda intacta** sirviendo sólo a `complete`, que está fuera de
alcance. El source guard apunta a la clase nueva, no a la vieja.

## Behavior

1. Dado `seasonPass.active === false`, gana `join` (banner de $0.99). Sin cambios.
2. Dado `progress.state === "completed"`, gana `complete`. Sin cambios, **CSS incluido**.
3. En cualquier otro caso el slot rinde `ctaSlot`, resuelto desde el Content Loop.
   ⛔ La tarjeta **no** lee `focusPassport.todayDone` para esto (P0-1): esa propiedad sigue
   alimentando el pasaporte y las llamas, que es su trabajo.
4. Dado `kind === "action"`, el slot es un `<button>` con el label de su `labelKey`, que
   invoca `onFocusTap(destination)`. **Sin nota debajo.**
5. Dado `kind === "status"`, el slot es un `<p role="status">` con `.challenge-card-cta--quiet`
   (sin fondo, borde, sombra, `filter` ni `opacity`), con su `noteKey` debajo.
6. `kind === "status"` conserva el `min-height` del botón. La tarjeta **no cambia de alto**
   entre presentaciones.
7. El adapter del Hub navega a `presentation.destination`, **salvo** para las variantes de
   `LEGACY_DESTINATION_VARIANTS`, que conservan `startFocusExerciseDestination(primaryPiece)`.
8. **Telemetría (P1-3, decisión del founder):**
   - `hub_start_focus_tap` se emite **exclusivamente** para `daily-pending` (el start real).
     Su significado histórico queda intacto y las series siguen comparables.
   - `hub_content_loop_cta_tap` es **nuevo**, con `{ variant, destination }`, y cubre las
     otras seis variantes accionables.
9. Dado `ctaSlot === null` o `isHydrated === false`, el slot rinde **`status`** con
   `ctaTomorrow` + `noteDailyReturns` — nunca un botón. Un botón pre-hidratación prometería
   un destino que todavía no se calculó.
10. **P1-2:** `kind === "action"` requiere `isHydrated === true`. La distinción "no sé
    todavía" vs "sé y no hay nada" la decide **la hidratación**, nunca la variante. Un
    `view-progress` sobre catálogo hidratado-pero-vacío es una acción legítima (`/trophies`
    siempre resuelve); el mismo estado sin hidratar es `status`.

## Copy (next-intl, `CHALLENGE_CARD_COPY`)

**P2-2 — modo gramatical unificado: imperativo en ES**, salvo las dos claves ya shippeadas.

| Clave | EN (base) | ES | car. ES |
|---|---|---|---|
| `ctaStartToday` | *(existe)* `Today's Focus` | `Enfoque de hoy` | 14 |
| `ctaClaimGift` | `Claim your gift` | `Reclama tu regalo` | 17 |
| `ctaKeepTraining` | `Keep training` | `Sigue entrenando` | 16 |
| `ctaTryLabyrinth` | `Try the labyrinth` | `Prueba el laberinto` | **19** |
| `ctaBeatScore` | `Beat your score` | `Mejora tu marca` | 15 |
| `ctaNewPiece` | `Start a new piece` | `Empieza otra pieza` | 18 |
| `ctaViewProgress` | `See your progress` | `Mira tu progreso` | 16 |
| `ctaTomorrow` | *(existe)* `Come Back Tomorrow` | `Vuelve mañana` | 13 |
| `noteDailyReturns` | `Your Daily returns tomorrow` | `Tu Diaria vuelve mañana` | 23 |
| `noteTrainingResumes` | `Training resumes tomorrow` | `El entrenamiento sigue mañana` | 29 |

⚠️ **`Prueba el laberinto` (19) es el techo y hay que verificarlo en device a 390px.** Si
parte, el fallback aprobado es `Al laberinto` (12) — no acortar inventando otro registro.

⚠️ `Daily` → **`Diaria`**, nunca "Diario". Vocabulario cerrado.

`tomorrowNote` (*"El entrenamiento sigue abierto. Sigue mejorando tus marcas."*) queda
**retirada**: en `action` la repetiría el botón, y en `status` la reemplazan las dos notas
específicas.

## Mapa variante → presentación

| Variante | kind | labelKey | noteKey | destino |
|---|---|---|---|---|
| `daily-pending` | action | `ctaStartToday` | — | ⚠️ legacy (`startFocusExerciseDestination`) |
| `claim-pending` | action | `ctaClaimGift` | — | `/trophies` |
| `continue-path` | action | `ctaKeepTraining` | — | `action.destination` |
| `labyrinth-ready` | action | `ctaTryLabyrinth` | — | `action.destination` |
| `improve-stars` | action | `ctaBeatScore` | — | `action.destination` |
| `next-piece` | action | `ctaNewPiece` | — | `action.destination` |
| `view-progress` | action | `ctaViewProgress` | — | `/trophies` |
| `daily-limit-reached` | status | `ctaTomorrow` | `noteTrainingResumes` | — |
| `daily-max-reached` | status | `ctaTomorrow` | `noteTrainingResumes` | — |
| `come-back-tomorrow` | status | `ctaTomorrow` | `noteDailyReturns` | — |

## Edge cases

- **Pre-hidratación** → status, nunca botón (Behavior 9/10). Es el escenario de "decidir con
  estado no hidratado", que ya produjo flake en este repo.
- **Parpadeo status → action** en el primer render hidratado: **aceptado y declarado**. La
  caja está reservada (Behavior 6), así que cambia el texto, no el layout. Cero CLS.
- **Cuota agotada** → status con `noteTrainingResumes`. El CTA **no puede** ofrecer training:
  la pared existe y hay que nombrarla, no esconderla.
- **Doble tap rápido** → `router.push` idempotente sobre la misma ruta.
- **Pase que vence entre render y tap** → el jugador aterriza en ejercicios y el gate de esa
  pantalla decide. El slot no es un control de acceso.
- **`onFocusTap` ausente** (probes `/dev` sin router) → el slot rinde el label como status,
  no un botón muerto.
- **Cambio de locale en caliente** → el label sale de next-intl, se re-renderiza solo.

## Acceptance criteria

- [ ] **AC-1** Sin pase activo se rinde el banner de $0.99 con su precio y su chevron.
      *(P2-1: se asserta lo observable, no que `toCtaSlotPresentation` no se invocó.)*
- [ ] **AC-2** Con `daily-pending`, el slot es un `<button>` con `ctaStartToday`.
- [ ] **AC-3** Con una variante accionable, el slot es un `<button>` con el label mapeado y
      al tocarlo se navega al destino de la tabla.
- [ ] **AC-4** Con una variante sin destino, el slot es `<p role="status">` y **no** existe
      ningún `<button>` dentro de `.challenge-card-cta-row`.
- [ ] **AC-5** El nodo de estado usa `.challenge-card-cta--quiet` y ninguna clase de botón.
      **Source guard**: `.challenge-card-cta--quiet` no puede declarar `saturate(`, `filter`
      ni `opacity`. ⛔ El guard **no** toca `.challenge-card-cta--info`, que sigue sirviendo
      a `complete`.
- [ ] **AC-6a** *(P0-4, source guard)* La regla CSS de `.challenge-card-cta--quiet` declara
      `min-height` con el mismo valor/token que el botón. Se lee el archivo, no el layout.
- [ ] **AC-6b** *(P0-4, VR)* Baseline VR del hub LEARN en estado terminal, que fotografía la
      caja reservada. jsdom no mide altura: el unit test no puede cubrir esto.
- [ ] **AC-7** En `action` no se renderiza nota. En `status` se renderiza exactamente la
      `noteKey` mapeada — `noteTrainingResumes` para las dos de cuota, `noteDailyReturns`
      para `come-back-tomorrow`.
- [ ] **AC-8** `toCtaSlotPresentation` es total: las 10 variantes tienen caso explícito,
      verificado exhaustivamente y **sin `default`**.
- [ ] **AC-9** Con `ctaSlot === null` o `isHydrated === false` se rinde `status`. Nunca botón.
- [ ] **AC-10** *(P1-1)* El adapter navega al destino **recibido** por `onFocusTap`, no a uno
      recalculado. Test con destino no-default que falla si el argumento se descarta.
      Enumerar y actualizar los call sites: `hub-lite-scaffold.tsx`, `learn-hub-client.tsx`,
      probes de `/dev`, y los tests que hoy pasan `() => void`.
- [ ] **AC-11** *(P0-2)* `daily-pending` navega a `startFocusExerciseDestination(primaryPiece)`
      y **no** a `/exercises?slot=daily`. Source guard sobre `LEGACY_DESTINATION_VARIANTS`.
- [ ] **AC-12** *(P1-3)* `hub_start_focus_tap` se emite **sólo** para `daily-pending`; las
      otras seis emiten `hub_content_loop_cta_tap` con `{ variant, destination }`. Test que
      falla si una variante no-`daily-pending` emite el evento histórico.
- [ ] **AC-13** Paridad ES/EN de las 9 claves nuevas bajo el guard de todo el bundle.
- [ ] **AC-14** `tomorrowNote` eliminada de EN y ES, sin claves huérfanas.
- [ ] **AC-15** Los baselines VR del hub LEARN (`vr18-learn-hub-{guest,active,pro}`) se
      re-generan **una sola vez** y con revisión visual del diff. ⛔ Nunca `--update-snapshots`
      a ciegas.
- [ ] **AC-16** *(OQ-3)* Los dos tests que hoy fijan el comportamiento informativo
      (`challenge-card.test.tsx:571`, `hub-lite-scaffold.test.tsx:343`) se **reescriben**, no
      se borran: la invariante que protegen —el slot no bloquea la ruta de entrenamiento—
      sigue siendo cierta y debe seguir aserta.

## Rollback

Revert del commit. Sin flag, sin migración, sin estado persistido que cambie de forma. La
red de seguridad es el VR (AC-6b, AC-15).

## Out of scope / future

- Estado `complete` (21 días terminados): hoy comparte la leyenda gris con quien sólo hizo su
  Diaria. Merece su propio momento.
- Unificar el destino de `daily-pending` con el Content Loop → **borrar
  `LEGACY_DESTINATION_VARIANTS`**. Exige verificar que `?slot=daily` no reabre el bypass de
  cuota.
- Alcanzar al jugador sin pase después de su Diaria (hoy recibe la venta como única respuesta
  a haber ganado). Es Sprint 2 disfrazado.
- Restaurar el botón standalone START FOCUS: la API sigue en su sitio, es un revert.

## Open questions

- **OQ-1** `role="status"` es una live region: hoy un lector de pantalla **anuncia solo** el
  cambio a "Vuelve mañana". Al pasar a `<button>` en los estados accionables ese anuncio se
  pierde. **Decisión tomada: se acepta** —el anuncio correcto pertenece al flujo de
  celebración, no al hub— y queda escrito acá para que sea deliberado, no un efecto lateral.
- ~~**OQ-2** ¿Cuántos Season Pass activos hay hoy?~~ ✅ **MEDIDO — ver Baseline de exposición.**

## Baseline de exposición (OQ-2 cerrada, medido 2026-08-07T19:56Z)

Conteo **read-only** sobre `lite_season_passes` vía PostgREST con service role.
"Activo" = `expires_at > now()`, la **misma definición** que usa `readSeasonPassRow()`
(`lib/season-pass/read-season-pass-row.ts:34`), para que el baseline y el código no
discrepen sobre qué es un pase vivo.

| Métrica | Valor |
|---|---|
| Filas totales | 16 |
| **Pases activos** | **13** |
| Pases vencidos | 3 |
| **Wallets distintas con pase activo** | **13** |

📈 **Al 2026-07-27 eran 3 activos. Hoy son 13: 4,3× en once días.** Sin filas duplicadas
(13 filas = 13 wallets), así que el número es población real, no ruido de escritura.

⚠️ **Cómo leer cualquier efecto posterior.** 13 jugadores es la población **expuesta** —
son los únicos que pueden ver el estado que este sprint arregla. Con esa n:

- Un movimiento en sesión/continuación post-Daily **no soporta atribución causal fuerte**.
  Un solo jugador cambiando de hábito mueve el 7,7% de la muestra.
- Lo que sí se puede afirmar es **exposición**: cuántos de los 13 llegaron al estado
  terminal y cuántos tocaron el CTA nuevo (`hub_content_loop_cta_tap`, AC-12).
- El baseline se vuelve a medir al cerrar el sprint. **Si la población creció otra vez, la
  comparación antes/después mezcla dos cohortes** — reportar ambas cifras, nunca una sola.

🔁 Reproducir: `readSeasonPassRow`-equivalente con `count=exact`; el script de medición vivió
en scratchpad y **no se versiona** (mide un estado, no es tooling del repo).
