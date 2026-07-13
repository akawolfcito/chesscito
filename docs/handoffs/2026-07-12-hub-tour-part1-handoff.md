# Handoff — Hub Tour (Daily-first), Parte 1

- **Fecha:** 2026-07-12
- **Spec:** `docs/specs/2026-07-12-hub-tour-daily-first-spec.md` — **Parte 1 HECHA, Parte 2 NO**
- **Estado git:** todo mergeado a `main` **local**. **El founder pushea.**
- **Suite:** 5073 passing / 426 files (venía de 5026/423). `tsc` limpio.
- **Pendiente #1:** **smoke en device MiniPay real.** Es lo único que falta para cerrar.

## Qué quedó construido

El mini-tour de **2 pasos** del hub de LEARN: **Daily → Challenge**.

| Archivo | Qué es |
| --- | --- |
| `lib/hub/hub-tour.ts` | Lógica pura: itinerario, flag `chesscito:hub-tour:v1`, gate de modales |
| `components/hub/hub-tour.tsx` | Presenter: scrim + anillo + flecha + panel + arte |
| `components/hub/use-hub-tour.ts` | Orquestación: *si* corre, y persistencia del resultado |
| `hub-lite-scaffold.tsx` | Los `data-tour-target` + pulso del regalo |
| `challenge-card.tsx` | Pulso del CTA **Join Challenge** |
| `public/art/mini-tour/**` | `tour-challenge-title` + `tour-challenge-hero` (avif/webp/png) |

**Paso 1 (Daily):** copy según racha — *start your streak* (racha 0) / *keep your streak alive*
(con racha) / *come back tomorrow* (ya hecho hoy).

**Paso 2 (Challenge):** arte de título + hook + hero + **`21 days · +3 shields · $0.99`** +
*"Tap Join Challenge to commit."* + **Got it**. A quien ya tiene el pase: solo el arte, sin
términos ni pedido de compra.

## Las decisiones que hay que respetar (no re-litigar)

1. **Sin Skip.** Con 2 pasos, una salida al lado del primario solo desangraba jugadores de la
   única pantalla que nombra el pase.
2. **El paso 2 PIDE la venta.** Es la razón por la que MiniPay nos listaría. Un paso que
   describe el reto y no pide la transacción no es un paso de venta.
3. **Nunca prometer que el pase perdona un día perdido.** El escudo rescata un **ejercicio
   fallido**; la recuperación de racha es *never build*. Hay un test con regex sobre el copy
   (`challengeJoin` + `challengeValue` + `challengeAsk`) que se pone rojo si alguien lo
   vuelve a prometer.
4. **Precio/escudos/días se interpolan** desde `lib/payments/rail-config.ts` — la misma fuente
   que alimenta la ChallengeCard. Escribir `$0.99` como texto se pudre sin poner ningún test
   en rojo, y el repo tiene dos precios vivos ($0.99 pase, $1.99 PRO).
5. **Orden de sacrificio en pantallas cortas:** primero se cae **el arte**; el precio y el
   botón no se caen nunca.

## Los dos defectos que encontró el device (y que la suite no vio)

1. **El tour no se podía terminar.** El chrome de MiniPay come alto, la card queda más abajo
   que en un navegador 390×844 limpio, y el panel —con el "Got it" adentro— se salía por
   abajo. Ahora el panel **mide el espacio arriba y abajo del target**, toma el lado más
   holgado y **se capa a lo que hay**. Verificado a 844 / 700 / 640px.
2. **El panel le cobraba $0.99 a quien ya tenía el pase** (card en ACTIVE). `useState`
   congelaba los **objetos** de los pasos al montar, copy incluido, así que un pase que
   confirmaba un tick después seguía vendiéndose. Hoy solo se congelan los **IDs**
   alcanzables; los cuerpos se leen vivos en cada render.

**La lección, que ya es la tercera vez que aparece:** jsdom mide todo como 0×0 y el navegador
limpio no tiene el chrome de MiniPay. **Ningún test de layout puede fallar por un supuesto de
viewport falso.** Lo que la suite protege ahora son las *reglas* (el botón entra, el arte cede,
el dueño no ve precio), no los píxeles.

## Próxima sesión

1. **Smoke en MiniPay real** (lo trae el founder):
   - ¿Entra el "Got it" y se completa el tour?
   - ¿El flag `chesscito:hub-tour:v1` impide que reaparezca?
   - Con pase ACTIVO: ¿el paso 2 muestra arte **sin** precio ni "Tap Join Challenge"?
   - ¿Late el CTA **Join Challenge** de la card, y deja de latir al comprar?
2. **Parte 2 del spec** (no empezada):
   - Cierre del Daily: primario **Continue training**, secundario **Join Challenge**.
   - Recordatorios del Challenge: CTA contextual + chip. **Nunca modal**, máximo uno por día.
   - Test que fije que `recordDailyCompletion` sigue teniendo **solo tres llamadores**
     (`daily-tactic-slot`, `hub-daily-tile`, `/challenge/daily`): hoy se cumple por accidente,
     no por contrato.
3. **Replay del tour desde Settings** (estado `replay` del spec) — no construido.

## Open questions

- El anillo del regalo mide `y: -2` a 390px: el borde superior queda cortado contra el techo
  del viewport. Se ve bien igual. ¿Se acepta o baja el icono unos px?
- El flag es **local-only** (no hay tabla de perfiles). Cambiar de dispositivo hace reaparecer
  el tour una vez. Aceptado hasta que exista `player_profiles`.
- El título del paso 2 es **arte con las palabras horneadas en inglés**. El `alt` lleva el
  texto traducido (lectores de pantalla + locales no-EN), pero **visualmente un usuario ES ve
  inglés**. Si eso molesta, hace falta una segunda pieza de arte en ES.
