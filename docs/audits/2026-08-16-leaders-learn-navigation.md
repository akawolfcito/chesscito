# Leaders → la tarjeta semanal mandaba a la superficie equivocada

**Fecha:** 2026-08-16 · **Parte B de la pasada Phase 0.5**
**Reportado por:** el founder, en dispositivo real

---

## 1. Lo observado `[FACT]`

En **LEARN → Leaders**, con el jugador fuera del ranking de la semana:

```
PLAY TO JOIN THIS WEEK
Complete an exercise to enter the weekly ranking.
```

Al tocarla, el jugador terminaba en **PLAY**.

---

## 2. La regla real de elegibilidad `[FACT]`

Trazada al código y a la migración, no a la memoria:

> **Se entra al ranking semanal teniendo una fila en `score_attempts` con la superficie DEL
> DEPLOYMENT, dentro de la ventana de la semana.**

- `weekly_ranking(p_surface, …)` filtra `where a.surface = p_surface`
  (`supabase/migrations/20260801000000_leaderboard_weekly.sql`)
- La superficie **no la elige el cliente**: `requireDeploymentSurface()` la deriva de
  `NEXT_PUBLIC_CHESSCITO_MODE`, y la ruta lo dice explícitamente — *"a value the client picks is
  a value the client can lie about"*
- En LEARN eso es `learn`; en PLAY, `play`

⛔ **Una partida de PLAY no puede entrar al tablero de LEARN, ni al revés.**

---

## 3. El defecto `[FACT]`

La tarjeta tenía **la copy de una superficie y el enlace de la otra**, fijos:

| | valor | correcto para |
| --- | --- | --- |
| copy | *"Complete an exercise…"* | LEARN |
| enlace | `/arena?fresh=1` | PLAY |

⛔ **Estaba mal en las DOS superficies, en direcciones opuestas.** En LEARN ofrecía una acción
que **no puede** satisfacer el requisito que ella misma enuncia; en PLAY enunciaba un requisito
que no es el suyo.

⚠️ Y en LEARN el daño era mayor: `mode-routing.ts` rebota **todo** `/arena` al host de play, así
que la tarjeta **expulsaba al jugador a otro dominio** desde una pantalla de Learn.

---

## 4. Impacto en medición `[INFERENCE]`

Un jugador de LEARN que tocaba una tarjeta **de Learn** aterrizaba en el host de PLAY, generando
una visita y —si jugaba— filas de `score_attempts` con `surface = 'play'`.

⚠️ Eso **contamina exactamente la comparación Learn/Play** que la línea de evidencia va a mirar:
uso de Play fabricado por un redirect accidental, no por interés.

`[INFERENCE]` y no `[FACT]` porque no se midió cuántos lo hicieron; el mecanismo está probado, el
volumen no.

---

## 5. Intención original `[UNKNOWN]`

No se encontró un spec que fije el destino de esta tarjeta. El comentario en el código explica
**cuándo** aparece (Slice 2C, el estado ordinario del tablero semanal) pero **no** a dónde debía
llevar.

⚠️ La memoria del founder —que apuntaba al flujo de elegibilidad, no a expulsar a otra app— es
**coherente con la regla del código**, pero no es evidencia documental. Queda como desacuerdo
resuelto por el código, que es la autoridad.

---

## 6. La corrección `[FIX]`

Mínima: **el destino y la pista salen de la superficie**, del mismo `NEXT_PUBLIC_CHESSCITO_MODE`
que usa el servidor para armar el tablero.

| superficie | enlace | pista |
| --- | --- | --- |
| LEARN | `/exercises` | *"Complete an exercise to enter the weekly ranking."* |
| PLAY | `/arena?fresh=1` | *"Play a match to enter the weekly ranking."* |

⛔ **No** se rediseñó la pantalla, **no** se agregó ranking, **no** se agregaron recompensas, y
**no** se inventó un destino: los dos son las acciones canónicas que ya existían.

⚠️ El test lo fija con las dos mitades **juntas**: `href.includes("/exercises") === saysExercise`.
Fijarlas por separado es exactamente cómo quedaron contradiciéndose.
Verificado por mutación: volviendo el enlace a `/arena` fijo, 2 de 3 casos se ponen rojos.

---

## 7. Criterios de aceptación

- [x] La copy describe el requisito real de elegibilidad
- [x] La acción va a la acción canónica que lo satisface
- [x] El jugador **no** es enviado a PLAY salvo que PLAY sea genuinamente el requisito
- [x] No se fabrica uso de Play por un redirect accidental
- [x] El estado ya-elegible sigue mostrando el pie de rango, no la tarjeta (condición `!ownRow`)

✅ **Smoke en dispositivo: VERDE (2026-08-16, founder).** La tarjeta lleva a la acción de su
propia superficie y ya no expulsa a otro dominio.

⚠️ **Y el camino hasta ese smoke dejó una lección:** la primera vez el founder no veía la
tarjeta y parecía que la había borrado. No: la pantalla no tenía **control de pestañas**, y esas
se dibujan con la MISMA bandera (`NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`). Sin bandera no hay
semanal, y sin semanal no hay tarjeta — estaba mirando el tablero all-time, que nunca la tuvo.
**La ausencia de las pestañas es el síntoma que lo delata**, y ahorra buscar el defecto en el
lugar equivocado.
