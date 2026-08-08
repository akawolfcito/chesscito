# Design brief — hacer visible el progreso sin gastar una pantalla

**Fecha:** 2026-08-08 · **Autor:** Samus Shepard (Game Designer, BMAD/GDS) con Wolfcito
**Estado:** dirección **aprobada** por el founder · insumo del spec del Paso 1
**⛔ Revierte** la dirección del Sprint 2 fijada en `docs/handoffs/2026-08-07-cta-slot-and-restore-bug-handoff.md`

---

## La reversión, explícita

El Sprint 2 estaba decidido como **"desenterrar el Path y hacerlo el hogar de la progresión"**
(`HUB → PATH → TABLERO`). Este brief lo **degrada a Paso 3, condicional**.

**Por qué cambió:** el objetivo nunca fue el mapa — era **que el progreso se vea**. El mapa era
un vehículo. El founder lo dijo exacto:

> *"Si pudiera mostrar el progreso sin el tap del mapa, para mí sería el éxito."*

Si hay forma de dar visibilidad sin gastar una pantalla, esa gana. La hay.

⚠️ **El HUB → tablero original no fue un error.** Bajó fricción, que era correcto. Lo que faltó
no fue una pantalla: **faltó que las pantallas que ya existían hablaran.**

---

## El diagnóstico que ordena todo

**434 de 443 jugadores jugaron un solo día.** Nadie vio nunca que estaba avanzando.

Y la trampa de la que casi caemos: *"otros juegos tienen mapas así"*. Candy Crush y Mario World
tienen mapas porque tienen **cientos de niveles** y necesitan una columna vertebral para que el
progreso no se vuelva sopa.

> **Chesscito tiene 78 niveles, sesiones de ~2 minutos y cuota diaria de 10.**
> No hay problema de columna vertebral. **Hay un problema de aviso.**
> Copiar la **función** (que el progreso se lea), nunca la **forma** (una pantalla-mapa).

---

## La regla

**El progreso va donde el jugador YA está, no en una pantalla nueva.**

### Paso 1 — la CONSECUENCIA en el overlay de completado

El overlay ya existe y ya dispara en **el momento de máxima atención del juego entero**. Hoy
entrega **el momento** ("lo lograste, 3 estrellas"). Que entregue también **la consecuencia**:

> *"3 de 4 · uno más abre la insignia"*

**Cero taps. Cero pantallas nuevas.** Es la sonda más barata que existe para la hipótesis: si el
problema es visibilidad, esto solo ya debería moverla.

### Paso 2 — progreso fino en la baldosa del hub

`reward-column.tsx:10` ya distingue cuatro estados (`claimed` / `claimable` / `progress` /
`locked`), pero **no dice cuánto**. Que lo diga.

Cubre el caso que el overlay **no puede**: volver tres días después, cuando no hay ningún
overlay que disparar. **Cero taps** — la baldosa ya es la puerta.

### Paso 3 — promover el mapa · ⚠️ SÓLO si 1 y 2 no alcanzan

El mapa sigue existiendo como detalle opcional. **Nunca obligatorio.**

> 🎯 Si los pasos 1 y 2 alcanzan, el mapa que queríamos desenterrar resulta **innecesario**.
> Eso sería la mejor noticia del sprint, no un fracaso.

---

## Anti-objetivos

- ⛔ **No agregar taps.** Cualquier propuesta que cueste un tap más tiene que ganárselo contra
  una alternativa de cero taps. Ese es el estándar, y lo fija el founder.
- ⛔ **No celebrar dos veces lo mismo.** El overlay entrega el momento **y** la consecuencia en
  un solo golpe; no se parte en dos pantallas.
- ⛔ **No mentir cuando no pasó nada.** Si no hubo cambio, no hay consecuencia que anunciar.
- ⛔ **No copiar la forma de juegos con otra escala de contenido.**

---

## Cómo se valida (y cómo NO)

⛔ **No con métricas.** Con 443 jugadores no hay poder estadístico para un A/B; cualquier
lectura sería ruido con forma de conclusión.

✅ **Con playtest, una pregunta:** a alguien que jugó hace tres días, **antes de que toque
nada**: *"¿qué hiciste la última vez?"*. Si no puede contestar, no está resuelto.

---

## Restricciones que el spec no puede ignorar

- **MiniPay es el único criterio de performance.** Ninguno de los tres pasos debe agregar peso
  al camino al juego.
- **`buildTrainingPath` deja todos los nodos en `locked` sin error si se omite `labyrinthBests`.**
  Si el overlay o la baldosa leen de ahí, **anunciarían progreso falso**. Pide guard —
  y ahora aplica antes que antes, porque el Paso 1 lo consume.
- **La cola de celebración de la milestone machine ya existe.** Reusarla, no inventar una segunda.
- **Carril 2 no consume cuota** (`exercise-drawer.tsx:155-156`) y los ejercicios sí se apagan al
  límite (`isQuotaLocked`, `:470`). Cuando pega el muro diario, *hay* algo que sigue abierto —
  candidato natural para el Paso 2.

---

## Preguntas abiertas para el spec del Paso 1

- **¿Qué consecuencia se anuncia cuando hay más de una?** (cierra un desafío **y** desbloquea el
  siguiente **y** acerca la insignia). Una sola, la más alta de la escalera, o se encolan.
- **¿Qué dice cuando la consecuencia es "terminaste todo"?** Es el estado del bug que acabamos
  de arreglar, y es el de mayor riesgo de sonar a callejón sin salida.
- **¿El overlay de ejercicio y el de desafío dicen lo mismo?** Son overlays distintos con
  reglas de puntuación distintas (cuatro reglas en seis juegos).
- **¿Cuánto texto entra a 390px** sin empujar los botones fuera de la vista?
