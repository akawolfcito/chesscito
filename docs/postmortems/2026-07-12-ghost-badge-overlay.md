# Postmortem — El overlay fantasma "Badge Ready to Claim"

- **Fecha:** 2026-07-12 · **Fix:** PR #220 · **Detectado por:** el founder, en device
- **Severidad:** alto (UX rota + un menú de continuación suprimido) — sin corrupción de estado ni de pagos
- **Suite al momento del bug:** **5009 tests en verde**

## Síntoma

El overlay "Badge Ready to Claim" reaparecía cada dos o tres ejercicios, **en piezas con
9★** (el umbral es 10), y su CTA no hacía nada: sin transacción, sin error, sin badge.
Aparecía incluso en el peón, que el jugador nunca había reclamado.

## Causalidad — tres eslabones

Arreglar uno solo **no** mataba el bug. Los tres eran necesarios.

**1. El derecho a reclamar sobrevivía al reclamo.**
`deriveEarnedMilestones` emitía `piece-badge-eligible` con `pieceStars >= 10` **sin mirar
`badgeClaimed`**. Un badge ya minteado seguía, para siempre, "ganando el derecho a
reclamarse".

**2. La cola de celebración es GLOBAL.**
`selectPending` drena **todos** los eventos pendientes, sin filtrar por la pieza en
pantalla. Un solo evento atascado reabría el overlay en **cada solve de cualquier pieza**.
Y como el overlay **no nombra su pieza**, leía como una mentira sobre la pieza que el
jugador tenía delante: de ahí el caballo con 9★ al que se le decía "Ten stars".

**3. El CTA no podía limpiarlo.**
Llamaba a `handleClaimBadge`, que devuelve un **`false` silencioso** sobre un badge ya
poseído (`exercises-screen.tsx:1735`). El caller leía ese `false` como "el jugador
canceló" → `releaseAbsorbed`, **nunca** `dismissCurrent` — el único escritor de
`celebratedAt`. El evento quedaba pendiente. **El loop se alimentaba solo.**

## El daño colateral que nadie conectó

El menú de continuación al terminar un pool (`PieceCompletePrompt`) exige
`celebration.current === null` para renderizar. El fantasma lo mantenía **no-nulo**, así
que el menú **jamás salía**: el jugador resolvía el último ejercicio y volvía al tablero,
en loop.

Se reportó como un bug distinto ("START FOCUS me deja en loop"). **Era el mismo bug.**

## Por qué la suite no lo vio

Cada componente era **correcto solo**:
- `deriveEarnedMilestones` emitía un evento legítimo.
- La cola drenaba lo pendiente, como debe.
- `handleClaimBadge` se protegía contra un doble-mint, como debe.

**La composición era la mentira.** Ninguna suite verificaba las tres juntas.

## Fix

1. `piece-badge-eligible` y `piece-badge-claimed` son ahora **estados excluyentes de un
   mismo badge**, no una secuencia.
2. **`lib/progression/repair-claimed-badges.ts`** — los perfiles ya rotos fueron marcados
   como migrados hace rato, así que un marcador de una sola vez **jamás los alcanzaría**.
   El repair corre en cada mount con el estado on-chain conocido y escribe solo si hay una
   elegibilidad gastada en disco.
3. El CTA **consume** el reconocimiento si el badge ya es tuyo. Todo otro fallo (cancelado,
   revertido, sin wallet, cadena mala) lo mantiene pendiente: ese badge **sí** se debe.

## Lo que casi rompo al arreglarlo

Mi primera versión cortaba antes de `releaseAbsorbed` cuando el claim no se podía intentar.
`celebration-order` se puso **rojo**: se perdía una Great Focus Session absorbida en un
claim que no completaba. **El reconocimiento no puede depender de la firma.** El test lo
defendió.

## Invariantes que dejó (viven en sus topics, no acá)

- [[feedback_tests_green_against_dead_shape]] — dos suites verdes aisladas no prueban su
  composición.
- [[feedback_aria_modal_not_role_dialog]] — contar `[aria-modal="true"]`.
- **El reconocimiento nunca depende de firmar una transacción.**
- **Un `false` silencioso que el caller interpreta como intención del usuario es un bug en
  espera.**

Wolfcito 🐾 @akawolfcito
