# Handoff — slot del CTA cerrado + bug de restore confirmado

**Fecha:** 2026-08-07 · **Rama:** `feat/daily-cta-content-loop` (12 commits, **sin pushear**)
**Handoff previo de la sesión:** `2026-08-07-daily-cta-content-loop-handoff.md`

---

## Estado

| | |
|---|---|
| Suite web | **7513 passing / 610 files, EXIT=0**, cero `Unhandled Errors` |
| VR | **minipay 63/63** con `--update-snapshots=none` |
| `tsc --noEmit` | limpio |
| Árbol | limpio |

⚠️ Verificar siempre que el conteo dé **610 archivos**. Menos = workers que no arrancaron
(ver reglas de entorno en `CLAUDE.md`).

---

## Lo que cerró

**Sprint 1 + 1.5 + tres iteraciones de diseño del slot del CTA.** Detalle completo en el
handoff previo; lo nuevo desde entonces:

- **`complete` dejó de tragarse el CTA.** Quien terminaba los 21 días no volvía a recibir una
  acción de esa tarjeta **nunca más** (`completed` es terminal). El logro se mudó al chip de
  estado y el slot volvió al Content Loop. `.challenge-card-cta--info` **borrada** — no queda
  ningún botón atenuado en el producto.
- **El slot quedó con un solo idioma visual:** oferta dorada · acción verde · aviso hundido.
  Elevado se toca, hundido informa.
- **El banner de acción es un PUERTO FIEL de `.kingdom-card-pro-cta`**, en verde. Un intento
  previo re-derivó los valores (52px en vez de 54, padding propio, bevel propio) y el founder
  lo describió exacto: *cerca pero a unos pixeles*. Hay guards que comparan la geometría
  **contra la regla de PRO en vivo** y que prohíben enganchar esto a los tokens verdes
  compartidos.

---

## 🐛 Bug de prod CONFIRMADO — el restore reabre contenido terminado

**Síntoma reportado por el founder** en `learn.chesscito.com`, **en dos cuentas**: completa el
último laberinto de la torre (`Rook Run`) al óptimo, 3/3 estrellas; vuelve al hub, toca la
torre, y **aterriza otra vez en `Rook Run`**. Se lee como "mi progreso no se guarda".

### ⛔ NO es un bug de guardado

El `localStorage` del founder lo desmiente:

```json
{"rook-rail-two-turns":12,"rook-rail-dead-end":6,"rook-rail-two-roads":6,"rook-rail-rook-run":10}
```

Los cuatro bests están escritos. `getNextChallenge` devuelve **null** correctamente — no hay
ningún laberinto disponible.

### La causa

`exercises-screen.tsx:3240`:

```ts
const contentId = directContentId ?? readLastTrainingContentId(selectedPiece);
```

El restore al montar **reabre el último contenido jugado de la pieza sin preguntar si ya está
terminado**. Para un ejercicio es correcto (reanudar a mitad de intento). Para un laberinto
cerrado al óptimo es indistinguible de no haber avanzado.

**Reproducido en test limpio** (rojo confirmado antes de tocar código):
`components/exercises/__tests__/restore-completed-content.test.tsx`.

### ⚠️ Por qué el fix NO es de una línea

Filtrar el restore rompió `training-pass-screen-integration`:

> **El restore no sólo abre contenido — también asienta la hidratación inicial de la
> pantalla.** Con el `return` temprano, un laberinto gateado por Challenge Pass deja la
> pantalla colgada en `aria-busy` y el nodo bloqueado nunca renderiza.

Son **dos responsabilidades mezcladas en el mismo efecto**. El fix real tiene que separarlas:
**siempre asentar la hidratación, y decidir aparte qué abrir.**

### Lo que queda en el repo

- `__tests__/restore-completed-content.test.tsx` — la reproducción, **`it.skip`** a propósito,
  con el porqué escrito adentro. ⛔ **Un-skip como parte del fix. No borrar.**
- `lib/training/restore-content.ts` — el predicado puro `restorableContentId`, con el
  razonamiento de por qué un ejercicio se reanuda y un laberinto completo no.

▶️ **Siguiente**: `/spec` corto para el fix, con red team. No improvisarlo dentro de un
archivo de 4.469 líneas.

---

## 🎯 Sprint 2 — dirección DECIDIDA (no implementada)

**Se descarta crear un modo separado "THE CHALLENGES".** La decisión del founder, tras
inventariar el contenido real:

> **Desenterrar el Path y hacerlo el hogar de la progresión.**
> `HUB → PATH de la pieza → TABLERO`, con los desafíos distinguidos por iconografía dentro
> del mismo camino. No mover los juegos, no tocar estrellas, no crear un índice de seis.

### El inventario que llevó ahí (medido del código)

| Pieza | Juego | Niveles | Estrellas |
|---|---|---|---|
| Torre | Rook Rails *(los únicos laberintos reales)* | 4 | movidas |
| Alfil | Pivot Challenge | 3 | movidas |
| Caballo | Knight's Tour | 3 | ⛔ **ninguna** (`starlessLaneIds`) |
| Dama | N-Queens | 3 | cobertura |
| Rey | Safe Path | 3 | movidas |
| Peón | Promotion Run | 3 | **fallos** |

**19 niveles**, desbloqueo a **6★ + 3 ejercicios**, plano para las seis piezas.

⚠️ **"Laberintos" es el nombre de la maquinaria, no del contenido**: sólo la torre juega
laberintos. Y hay **cuatro reglas de puntuación distintas** en seis juegos.

### Nombres descartados y por qué

`Trials/Pruebas` (promete culminación; se desbloquea a mitad de camino) · `Labyrinths` como
paraguas (miente) · `Mini Games` (suena accesorio) · `Mastery Challenges` (demasiado fuerte
para 6★) · `Focus Games` (pierde el ajedrez) · `Special Training` como nombre visible
principal (genérico).

### Tres cosas que el Sprint 2 va a encontrar

1. **Es más barato de lo que suena.** `exercise-drawer.tsx` ya es un componente propio de
   **650 líneas**. El monstruo es `exercises-screen.tsx` con **4.469**, pero ese es el
   problema de *armado de datos*, no de UI.
2. ⛔ **Un modo de falla silencioso que se vuelve peligroso.** `buildTrainingPath` deja todos
   los nodos de desafío en `locked` **sin error** si se omite `labyrinthBests`. Hoy eso sólo
   hace que el CTA no ofrezca un desafío; con el Path como hogar de la progresión, **el mapa
   miente sobre qué está desbloqueado**. Pide guard.
3. **Los iconos por juego no son gratis:** un slot de tema nuevo cuesta **tres baselines
   pineados + `tsc`**. Seis iconos firma son seis slots.
4. ⛔ **Arreglar el bug del restore ANTES de promover el mapa.** Con el mapa a la vista, ese
   bug pasa de "me repite un nivel" a "mi mapa me miente".

### El argumento que cerró la dirección

El índice de seis desafíos los mostraría juntos pero **desconectados de la senda** — y la
idea central es que el desafío es *un momento del camino*. El índice contradice la narrativa;
el mapa la encarna. Y el mapa **también delata**: este bug lleva tiempo vivo y nadie lo vio
porque el camino está enterrado.

---

## Pendiente del founder

1. ▶️ **Push de la rama y merge a `main`.** 12 commits, árbol limpio.
2. ▶️ Mirar el banner de acción en device (390px, dos líneas) — está medido, no visto en la
   app real.
3. Al cerrar el sprint: **re-medir los pases activos** (hoy 13, venían de 3 hace once días).

## Open questions

- **Estrellas del carril**: sigue sin decidirse si son de progresión, de leaderboard, ambas o
  ninguna. Es lo que destraba el Sprint 4. ⚠️ Un juego (Knight's Tour) **no puntúa**, así que
  el hueco empieza dentro del carril.
- **`Special Training` visible en seis lugares** (`specialTrainingLabelFormat`,
  `nowLabyrinthFormat` y su aria, `arenaUnlockedAriaFormat`, `specialTrainingStat`, la
  baldosa). Adoptar otro nombre obliga a renombrarlos o el producto queda con dos nombres.
- **El spotlight del mini-tour** puede iluminar la banda de aviso. Preexistente, agravado.
- **Qué aloja la banda** cuando llegue el primer tip. Hoy es geometría preparada; la vitrina
  rotativa está descartada.
