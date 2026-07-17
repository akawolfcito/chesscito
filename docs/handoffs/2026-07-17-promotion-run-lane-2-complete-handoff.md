# Handoff — Promotion Run 10/10 · el carril 2 cierra 6/6

**Fecha:** 2026-07-17 · **Branch:** `main` · **Suite:** 5344/5344 (452 files) · `tsc` limpio ·
e2e del probe 28/28 · **VR: no re-corrido tras el cableado**

> El estado vivo es `SESSION.md` en la raíz. Este doc es el registro del cluster.

## Qué cerró

**Promotion Run** — el juego firma del peón, etapas 7→10. Con él, **las seis piezas tienen juego
firma** y el carril 2 (Special Training) queda **6/6**:

| Pieza | Juego firma |
| --- | --- |
| Alfil | Diagonal Run |
| Caballo | Knight's Tour |
| Dama | N-Queens |
| Rey | Safe Path |
| **Peón** | **Promotion Run** ← este cluster |
| Torre | los 4 laberintos `rook-rail-*` curados (su juego firma **ES** un laberinto) |

Commits de esta sesión: `a0ef796` (tablero + probe) · `2dc3bad` (estrellas) · `05b21f7` (selector) ·
`1f471d3` (host) · `01ce87b` (e2e) · `ec3380e` (inventario de probes) + handoffs.

## Las tres cosas que hay que entender antes de tocar esto

### 1. El mapa de amenaza es VIVO, y no es un detalle de implementación

Safe Path memoiza su mapa **una vez por nivel** porque sus enemigos son intocables (D1). Acá el peón
**se los come**, así que los enemigos son **estado** y el mapa se recalcula por posición.

**Los niveles cuelgan su única ruta de eso.** `pawn-promotion-1`: el peón corona subiendo la columna
b, que la torre de b4 vigila entera — hasta que se la come. Un tablero que copiara el memo del rey
haría el nivel **injugable**.

### 2. Las estrellas cuentan FALLOS, porque las movidas no pueden

Un peón avanza exactamente una fila por movida → **toda corrida ganadora desde la fila r mide
exactamente `7-r`**. Movidas == óptimo en **cualquier** victoria → `labyrinthStars` daría 3★ a todo
el que gane. No es un bug del contenido y **ningún ajuste lo arregla**: es la regla del peón.

`promotionRunStars(failures)`: 3 limpio, −1 por fallo, **piso en 1** (quien murió cinco veces y
coronó hizo lo que el nivel pidió; un 0 leería "perdiste" sobre una victoria).

⛔ **El escudo NO borra el fallo.** Compra la **consecuencia** (no repetir la corrida), no el
registro. Si lo borrara, 3★ serían comprables — y una estrella que se compra califica una billetera.

⚠️ **`handleLabyrinthMove` acepta un grader INYECTADO** (`{metric, starsFor}`). Se inyecta la
**función**, no un número, porque **el best se guarda y se RE-gradúa**: `previousBest` tiene que pasar
por el mismo grader o el ledger compara fallos contra una escala de movidas e **inventa estrellas en
silencio**. Los dos son `number`; nada se quejaría.

### 3. DOS formas de fallar, UNA promesa del escudo

Te comen en casilla vigilada, o coronás la pieza que la misión no pidió. **Las dos vuelven al
inicio.**

El founder propuso primero que el escudo comprara un *re-pick* (volver a coronar sin repetir la
corrida) y después dijo de conservar el comportamiento anterior si costaba mucho. **No solo cuesta
menos: es la máquina más segura.** Un escudo que significa "al inicio" acá y "solo reelegí" allá es
**un token con dos sentidos**, y eso deriva.

## P4, reencuadrado por el founder

P4 decía: *"coronar enseña la cadena de valores (dama 9, torre 5, alfil/caballo 3, peón 1)"*.

**El founder lo cambió** (2026-07-17): el jugador **todavía no sabe jugar un caballo**, así que
"coroná caballo y das mate" es una frase que no puede evaluar — obedecerla enseña **obediencia**, no
ajedrez. La lección de esta etapa es más simple y más cierta: **un peón que cruza el tablero INVOCA
la pieza que elijas**. La misión lo hace concreto nombrando una. Los números vuelven cuando haya un
nivel que se los gane.

Esto **cierra** la objeción que la etapa 8 dejó abierta sobre el caballo de `pawn-promotion-3`: el
nivel no enseña "el caballo es mejor acá", enseña que la elección existe.

El modal **dice la misión en claro** (condición explícita del founder para que errar cueste algo:
fallar una elección que nunca te dijeron es una trampa) y ofrece **las cuatro siempre**, sin
pre-marcar la pedida — resaltarla contestaría la pregunta, la misma decisión que los tableros toman
con las casillas vigiladas.

## Verificado, y cómo

- **Suite 5344/5344, `tsc` limpio, e2e del probe 28/28** en los 4 proyectos.
- **Cada casilla de los tests se MIDIÓ contra el solver antes de escribirla.** El nivel de test del
  tablero (peón c6, torre negra b7) y las rutas del e2e salieron de correr `promotionRunSolve`, no de
  razonar sobre el tablero.
- ✅ **El cableado al `/exercises` real: verificado por el FOUNDER** (*"se ve muy bien; exactamente
  como lo esperaba"*). ⚠️ **Ningún test monta el host** — cubren el selector solo, el tablero solo y
  el probe. **El hueco sigue abierto para el próximo cambio**: la evidencia es el ojo del founder, no
  la suite.
- ❌ **VR no re-corrido tras el cableado** y el carril del peón cambió. Pendiente.

## Hallazgos laterales (no los buscaba)

- 🔴 **El builder no sabe autorar NINGÚN juego firma, y te los lista igual** → memoria
  `project_builder_only_knows_two_kinds`. **Es el trabajo de la próxima sesión.**
  Desmiente una instrucción que dos handoffs arrastraban: *"afinar queens en `/dev/labyrinth-builder`,
  no hace falta tocar código"*. **Era falsa.**
- ⚠️ **9 de 10 probes `/dev` gatean por `NODE_ENV`, no `VERCEL_ENV`** → **404ean en preview**. La
  autoría solo funciona en local. La memoria afirmaba `VERCEL_ENV` para `labyrinth-builder` y era
  falso. No lo arreglé: son 9 archivos y cambiar un gate expone rutas dev — decisión del founder.
- 🧯 **El inventario de probes estaba 8 rutas atrasado** (`ec3380e`). El script `check-dev-probes.sh`
  solo protege si se corre, y **no hay hook ni CI que lo dispare**.
- 🧯 **`editorial.ts` tiene techo de 0 em-dashes** (`anti-ai-prose.test.ts`). Se rompe fácil copiando
  copy del JSON de contenido, que sí los tiene.

## Próximo

1. **⬅️ EL BUILDER** (acordado con el founder). Primer paso: **medir** si un guardado falla ruidoso o
   corrompe callado — tracé el código, no lo ejecuté.
2. **Cluster Closure Protocol** del carril 2: issues + milestone · **README** (su tabla dice
   "Exercises + labyrinths" para piezas que ya no tienen laberintos: **con el peón ya son las 6**) ·
   branches.
3. **Correr el VR.**
