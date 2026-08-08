# Backlog — el teatro del overlay y cómo se llega al claim

**Fecha:** 2026-08-08 · **Origen:** founder, durante el slice 1B del Paso 1
**Estado:** capturado, **no agendado** · ⛔ fuera del alcance del Paso 1

> El Paso 1 declara explícitamente fuera de alcance "animar el cambio: la consecuencia es
> texto en este paso, el teatro es otra discusión". Estas tres ideas son ese teatro, más una
> que no lo es. Se anotan acá para que no se pierdan, no para hacerlas ahora.

---

## 1. ⭐ La más valiosa: el CTA no debe estar desde el frame 0

> *"Si solo está ahí desde el principio, casi que le estoy enseñando a que no lea y pase."*

**Esto no es decoración, y es la única de las tres que cambia comportamiento.** Un botón
presente desde el instante cero convierte el overlay en un obstáculo: el pulgar ya sabe dónde
va a estar antes de que el ojo lea nada. Con 434 de 443 jugadores de un solo día, un overlay
que enseña a saltearse es exactamente lo que no podemos permitirnos — y el Paso 1 acaba de
poner ahí la información que más queremos que se lea.

Retrasar el CTA unos cientos de ms compra el tiempo de lectura sin costar un tap.

⚠️ **Riesgo que hay que medir, no asumir:** un CTA que aparece tarde puede leerse como lag, y
un jugador que ya toca donde el botón *iba a estar* toca vacío. Necesita un número, no una
corazonada, y el número sale de un playtest.

⚠️ Aplica a **todos** los overlays de victoria, no sólo a este. Vive en
`VictoryPopupShell` / `PrincipalButton`, no en cada consumidor.

## 2. Transición de entrada de los overlays

Que el overlay **aparezca** en vez de estar. Hoy hay salida (`modal-exiting`, 250 ms) pero la
entrada es instantánea.

Costo bajo, es CSS. ⚠️ **MiniPay es el único criterio de performance**: transición CSS sí,
librería de animación no.

## 3. Números que suben (0 → 1 → 2 → 3)

Las estrellas y los contadores contando hacia arriba en vez de aparecer ya escritos.

⚠️ El más caro de los tres y el de menor retorno: es JS por frame, y son tres píldoras. Si
algo se recorta, se recorta esto.

⛔ **No animar el número de la consecuencia** (`3 de 4`): un número que se mueve mientras el
jugador intenta leerlo es peor que uno quieto. Las estrellas son celebración; la consecuencia
es información.

---

## 4. Wayfinding hasta el claim — mini-tour, NO un icono nuevo

**Problema:** el overlay dice "reclamá tu insignia en Exercises" pero no puede llevar. La
baldosa del hub tampoco reclama (`learn-hub-client.tsx:415` sólo rutea); el único botón
**Claim Badge** vive en el drawer (`exercise-drawer.tsx:620`), detrás de la píldora de
estrellas, que el jugador no tiene motivo para abrir en ese momento.

**Por qué un icono no alcanza.** Un icono es una **etiqueta** ("esto existe"); acá hace falta
un **puntero** ("tocá acá, ahora"). Y el vocabulario de este overlay ya está tomado: estrella
= estrellas del intento, trofeo = mejor marca, sprite = movidas. Un icono nuevo o colisiona o
no orienta — el que orientaría bien (la estrella, porque es el glifo del abridor real) es
justamente el que se confunde.

**Por qué el mini-tour sí, y es barato.** `hub-tour.tsx` **ya existe** y su mecanismo **no es
hub-only**: ilumina cualquier `[data-tour-target="…"]` del DOM. Haría falta el atributo en la
píldora del drawer y un paso nuevo. Es reuso, no un sistema nuevo.

⛔ **No encadenarlo al overlay.** Dispararlo al cerrar la celebración es celebrar y después
interrumpir — el anti-objetivo de "no celebrar dos veces lo mismo", y dos ceremonias apiladas
a 390px. Va cuando el jugador **vuelve** a la pantalla de ejercicios, **una sola vez**.

➡️ **Esto es material del Paso 2**, no del 1. Y llega junto con el trabajo que el Paso 2 ya
heredó: para que la baldosa ofrezca la acción, primero hay que ponérsela.

⚠️ Antes de construirlo: contrastar con el especialista de BMAD/GDS. Un tour es una
interrupción, y la línea entre guiar y molestar la decide alguien que la haya cruzado antes.

---

## Orden sugerido si esto se agenda

1. **#1 (CTA diferido)** — el único que cambia comportamiento; el resto es acabado.
2. **#4 (mini-tour)** — dentro del Paso 2, con su consulta de diseño.
3. **#2 (entrada)** — barato, mejora el conjunto.
4. **#3 (números subiendo)** — lo primero que se recorta.
