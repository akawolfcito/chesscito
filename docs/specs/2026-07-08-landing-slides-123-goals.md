# Landing slides 1/2/3 — goals (founder, 2026-07-08)

Fuente: founder, sesión 2026-07-08. Slide 4 ya cerrado (PR #184), fuera de alcance.
Este doc fija el GOAL de cada pantalla antes de la crítica de UX (Sally) y del mock.

## Rol del carrusel

Cuatro pantallas, una sola vez en la vida del visitante. Después de la primera
selección la cookie lo manda directo al juego vía `welcome-back.tsx` — no vuelve
a ver los slides. Por eso 2 y 3 son la **única** oportunidad de explicar la capa
paga, y por eso existen.

## Slide 1 — Welcome

**Goal:** que un desconocido total salga sabiendo dos cosas y ninguna más:
1. esto tiene que ver con ajedrez;
2. hay dos modos, Learn y Play.

No vender. No precios. Las dos pills (Learn / Play) son el mensaje completo.
El CTA avanza el carrusel.

**Acoplamiento:** `welcome-back.tsx` reusa `slide1.headline`, el avatar y el
wordmark. Cambiarlos cambia la pantalla del visitante que regresa.

## Slide 2 — Season Pass

**Goal:** existe el Season Pass, cuesta $0.99, y estos son los beneficios; por eso
deberías adquirirlo.

Qué es el Season Pass para nosotros: la puerta de entrada al mundo de **Learn**.
Es el acceso al 21 Day Challenge, que no es un set de retos sino un andamio para
construir un hábito — el hábito de aprender, de entender, de sostener el cambio
cognitivo. El beneficio real es bienestar mental, mejores tomas de decisión, y
foco para gente dispersa.

**Restricciones de copy:**
- Hay rewards, pero NO se prometen como valor monetario. Se enuncian como apoyo
  de la comunidad. (Ver `minipay-listing-safety`.)
- Existe una capa paga y se dice sin rodeos.
- El cruce con eventos del mundo real es dirección de producto, NO va al copy.

## Slide 3 — Coach PRO

**Goal:** esto es Coach PRO, cuesta $1.99, y por esto deberías elegirlo.

**Cambio respecto de hoy:** el slide actual lidera con "Play free. Upgrade for
Coach PRO." — mezcla el pitch de Play con el de PRO. El goal del founder es que
la pantalla sea el pitch de PRO, no el de Play.

**Argumento central:** PRO incluye Season Pass. Se ganan los dos. Y PRO es la
puerta a lo que se va sumando en el camino: personalizaciones, avatares, apoyo
en juego, y distribución del pool para quienes sostienen la consistencia ganada
en Learn.

## Preguntas abiertas

- Si PRO incluye Season Pass, ¿el orden 2→3 es el correcto, o el visitante
  aprende el precio menor primero y ancla ahí? (Para Sally.)
- ¿Cuánto del "por esto deberías" cabe en el marco sin romper la composición
  móvil de 390px? (Para el mock.)
