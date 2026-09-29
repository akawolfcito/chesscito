# El experimento que corrió, se retiró, y nadie leyó

**Fecha:** 2026-09-02 · **Tipo:** lectura de resultado (read-only)
**Experimento:** *Tour → first activity* (LEARN) · `lib/onboarding/first-activity-experiment.ts`
**Ventana:** 2026-08-05 → 2026-08-30 · **n = 1.264 installs**
**Estado:** retirado el 2026-08-30 con el mini-tour (`40e09b38`), a un rollout **vivo del 50%**

---

## Por qué existe este documento

Al retirar el tour, el código dejó escrito: *"What it already collected stays valid; what it
would collect from here does not."* **Lo recolectado nunca se leyó.** Esto lo lee.

**Hipótesis original:** *"el hub pide decisiones antes de que el jugador haya sentido ningún
valor, así que quien termina el tour y cae en una grilla de opciones se va sin hacer nada"*.
El brazo variante lo tiraba directo a la única actividad sin decisiones — el Daily Focus.

---

## El resultado

**Volumen:** control 764 installs · variante 500. Asignación por FNV-1a sobre el install id
(estable, no manipulable refrescando).

### Activación — la variante arrasó

| | Control | **Variante** | |
|---|---:|---:|---|
| Empezó el Daily el día de asignación | 39,7% | **99,8%** | +60,1 pp |
| **Completó el Daily** | **26,4%** | **60,2%** | **2,3×** |

**[HECHO]** La intervención funcionó exactamente como se diseñó. Más que duplicó la
proporción de jugadores nuevos que completan una actividad real en su primer día.

### Retención — no se movió

| | Control | Variante |
|---|---:|---:|
| Volvió algún otro día | **6,0%** (46/764) | **4,6%** (23/500) |

**[HECHO]** −1,4 pp. **[INFERENCIA]** Con esas proporciones, z ≈ 1,1: **no es una diferencia
detectable**. La lectura honesta no es *"la variante empeoró la retención"* sino **"no se
detectó ningún efecto"**.

---

## Lo que esto significa, y por qué corrige mi propia recomendación

Hace unas horas, en `2026-09-02-where-they-quit-and-why-they-return.md`, medí que **terminar
una partida es lo que mejor predice que alguien vuelva** (42,4% vs 25,6%) y recomendé:
*"el experimento correcto es hacer que más gente termine y ver si la retención se mueve"*.

⛔ **Ese experimento ya se corrió, sobre el Daily, y la respuesta fue no.**

La variante duplicó las actividades completadas en el día 1 — el mediador exacto que yo
proponía empujar — y la retención quedó plana. Con n = 1.264 y un efecto de 2,3× sobre el
mediador, si la cadena causal *"hacer más en el día 1 → volver"* fuera fuerte, algo se
tendría que haber movido.

> **[INFERENCIA, con evidencia] La correlación "quien completa vuelve" es de SELECCIÓN, no de
> causa.** La gente enganchada completa *y* vuelve; forzar el completar no fabrica el
> enganche.

Ésta es exactamente la advertencia que dejé escrita como caveat, ahora con un experimento
que la respalda. **La retención no está río abajo de la activación.**

---

## Qué queda en pie después de esto

Por eliminación, no por entusiasmo:

- ❌ **"Que hagan algo el primer día"** — probado, n=1.264, no mueve la retención.
- ❌ **"Que lleguen al tablero"** — el 87,7% ya llega (`first_move_made`). No es la fuga.
- ❓ **"Que la partida tenga un desenlace satisfactorio"** — no probado. El desenlace modal
  hoy es **tablas en `easy` tras 70 movimientos** (50,8%). Es la hipótesis viva más barata.
- ❓ **"Que alguien te esté esperando"** — no probado, **y nunca expuesto**: la tabla `duels`
  tiene 16 filas en toda su historia.

**[INFERENCIA]** Lo que separa a las dos hipótesis vivas de la que falló: las dos crean una
razón para volver que **existe fuera de la app**. Un Daily completado no le debe nada a nadie.
Una partida a medias con una persona del otro lado, sí.

⚠️ Esto **no prueba** que el PvP retenga. Prueba que la alternativa más barata y más obvia ya
se descartó con datos, lo cual sube el valor esperado de probar la que queda.

---

## Deuda concreta que dejó el retiro

⛔ El propio código lo dice y sigue pendiente:

> *"`NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` is still 50 in production — set it to 0 so
> the flag matches the code."*

Hoy la variable vale 50 en producción mientras **nada la consume** (el único llamador se fue
con el tour, `learn-hub-client.tsx:471`). No hace daño — es código huérfano con su bandera
prendida — pero es una mentira de configuración esperando a confundir a alguien.

---

## Caveats

- **LEARN únicamente**, por decisión del diseño del experimento. LEARN es ~11% de PLAY (655
  cuentas vs 6.048). No se puede extrapolar a PLAY sin correrlo ahí.
- Retención definida como **≥2 días activos distintos**, igual que en el análisis del 93,4%.
- La unidad es `session_id` = install id anónimo, que es la unidad de asignación correcta acá.
- El brazo control cambió el 2026-08-30 (la grilla desapareció). Por eso el experimento se
  cerró: *"the treatment became the control"*. Los datos previos al cierre no están afectados.

---

*Consultas 18-20 en el scratchpad. Reproducibles con `pnpm ops:query`.*
