# Bishop D2 — Diagonal Run: spike de un nivel (sin commit)

**Fecha:** 2026-07-15 · **Branch:** `fix/exercise-obstacles-a0`
**Alcance:** solo el spike en `/dev/diagonal-run`. Sin commit. Sin tocar currículo, Rook Rails,
bishop-lab-3/-4, navegación productiva, ExercisesScreen, ni el trabajo pivot staged.

> **⚠️ CORRECCIÓN DE MODELO (post-prueba del usuario).** La primera versión usaba "glide": el tap elegía
> una **dirección** y el alfil se deslizaba hasta el borde. Es incorrecto. El modelo definitivo es
> **pivote**: el tap elige una **casilla exacta (pivote)** = un movimiento normal de alfil; el alfil se
> desliza hasta el pivote, **pausa**, y **gira** hacia una diagonal **perpendicular** deslizándose hasta la
> **estrella** (captura), un **obstáculo** (para antes) o el **borde**. Si una perpendicular apunta a la
> estrella, la captura; si no, el juego elige la salida con **heurística suave** (landing más cercano a la
> estrella) — determinista, cero esfuerzo. Reusa `getBishopMoves`; `optimalMoves` vía `pivotBfs`.
> Nivel a1→g1/e5: **opt = 1** (pivote **d4** → gira SE → g1). Los sparks marcan los **pivotes alcanzables**
> (b2, c3, d4). `diagonal-run.ts` reescrito (`reachablePivots`/`resolvePivot`/`pivotBfs`); 8 unit + 7 E2E verdes.

Nivel: **a1 → g1, caballo amigo e5, glide optimalMoves = 2** (FEN ref `8/8/8/4N3/8/8/8/B7`).

---

## 1. Qué se construyó (aislado)

| Archivo (todos nuevos) | Rol |
|---|---|
| `src/lib/game/diagonal-run.ts` | puro: `getBishopGlideDestination`, `sparkSquares`, `legalGlides`, `glideBfs` |
| `src/lib/game/__tests__/diagonal-run.test.ts` | 9 unit (regla de glide + BFS) |
| `src/components/dev/diagonal-run-spike.tsx` | probe self-contained (reusa `<GameBoard>` + geometría + CSS `.is-selected`) |
| `src/app/dev/diagonal-run/page.tsx` | `/dev/diagonal-run` (`notFound` en prod) |
| `e2e/diagonal-run-spike.spec.ts` | 7 E2E |

**Cero cambios a archivos compartidos** (Board, ExercisesScreen, contenido). El probe usa el `<GameBoard>`
canónico + `cellCenter/pieceWidth` + las clases `.playhub-board-*`, así que el **zoom de selección es el
mismo** de los ejercicios, sin tocar el Board.

## 2. Contrato implementado (verificado)

- **Estado inicial:** alfil a1 sin seleccionar, sin sparks; banda "Ayuda al alfil a llegar a la estrella."
- **Tap antes de seleccionar:** no mueve + "Primero toca tu alfil."
- **Selección:** zoom idéntico + casilla iluminada + "Elige una dirección diagonal." + **sparks tutoriales**.
- **Sparks:** uno por dirección legal, en la primera casilla libre; **ninguno hacia el caballo e5** (dirección bloqueada). Aspecto (anillo azul luminoso) distinto de los dots blancos.
- **Elección:** tap de cualquier casilla de un rayo legal → **marcador temporal** (~380 ms) → **glide** hasta parada. Todas las casillas del mismo rayo → mismo destino.
- **Después del glide:** posición actualizada, movimientos +1, **sigue seleccionado**, sparks recalculados, siguiente turno inmediato.
- **Tap ilegal:** no mueve, no cuenta, "The bishop cannot move there." / "El alfil no puede moverse hasta ahí."
- **Subóptimo legal:** se ejecuta sin error, cuenta el movimiento, se puede continuar.
- **Insoluble:** tras cada glide, `glideBfs(pos, target, blockers).reachable`; si false → fade del alfil + "Este camino no llega a la estrella. Inténtalo de nuevo." → reinicio. (Path codificado + unit-verificado; en L1 solo se alcanza con varios glides deliberadamente malos — tablero indulgente.)
- **Éxito:** para en g1 → "¡Encontraste el camino!" + estrellas por `labyrinthStars(movesUsed, 2)` + "2/2 · ★★★".
- **Banda compacta** full-width, 2 líneas, cabe en 390×844 sin reducir el tablero.

## 3. Capturas del flujo (390×844)

- **Idle** → banda "toca el alfil".
- **Seleccionado + sparks** → alfil a1 con zoom, 1 spark azul en b2 (única dirección NE).
- **Marcador** → anillo dorado en la casilla tocada antes de deslizar.
- **Turno 2** → alfil en d4, **3 sparks** (NW/SW/SE), ninguno hacia e5; banda "· 1".
- **Éxito** → alfil en g1, "You found the way! · 2/2 · ★★★" + retry.

(Screenshots en scratchpad: `dr-1-idle`, `dr-2-selected-sparks`, `dr-3-marker`, `dr-4-after-glide`, `dr-5-won`.)

## 4. Validaciones

- **Unit** `diagonal-run.test.ts` → **9/9** (tap no-diagonal→null; blocker primer paso→ilegal; blocker
  adelante→para antes; sin blocker→borde; **estrella detiene aunque haya casillas libres detrás**; taps del
  mismo rayo→mismo destino; glideBfs opt 2; reachable vs insoluble).
- **E2E** `diagonal-run-spike.spec.ts` (minipay) → **7/7** (tap-antes-de-seleccionar; zoom + 1 spark/dirección;
  marcador→glide a1→d4; d4→SE→g1 con 3★; subóptimo sin error; ilegal no mueve; 390×844 sin overflow).
- `tsc --noEmit` → limpio. · `git diff --check` → exit 0.

## 5. Validación de producto

- **¿Se distingue de un ejercicio / se siente lúdico?** Sí — es control por turnos: seleccionar → elegir
  dirección → ver el deslizamiento → repetir. Muy distinto del "adivina la casilla" del pivote.
- **¿Contradice demasiado lo aprendido en ejercicios?** No en lo esencial: el alfil **sigue moviéndose solo
  en diagonal, se detiene ante piezas propias y conserva el color** — igual que los ejercicios. La novedad
  (deslizar hasta el final en vez de parar donde quieras) es una **capa de juego** claramente señalizada por
  sparks + banda + animación; tensión leve, bien comunicada, no confusa.
- **¿Sigue clara sin leer texto largo?** Sí: sparks (dónde puedes lanzar), zoom (seleccionado) y la
  animación de glide comunican el loop visualmente; la banda es de 2 líneas.
- **Esfuerzo real:** **MEDIUM** (módulo puro + BFS + probe self-contained + 9 unit + 7 E2E + banda). Sin
  tocar Board/ExercisesScreen; sin segundo board productivo (reusa `<GameBoard>`).
- **Kill criteria:** **ninguno disparado** — óptimo con BFS pequeño ✅, sin multi-target, sin motor
  genérico, sin refactor de ExercisesScreen, sin segundo board productivo, dentro de MEDIUM, y la mecánica
  refuerza (no contradice) las reglas del alfil.

---

## VEREDICTO: 🟢 GRADUATE DIAGONAL RUN

El spike se siente claramente más lúdico y turn-based que el pivote, lee sin texto largo, y respeta las
reglas del alfil aprendidas en los ejercicios. Listo para **Gate D3** (integración productiva: renombrar
pivot→diagonal-run, 2–4 niveles, ocultar la experiencia pivot, conservar labs históricos, i18n/progreso/E2E).

**Restricciones respetadas:** sin commit · currículo de 9 intacto · Rook Rails intacto · labs conservados ·
ExercisesScreen sin tocar · sin framework · sin multi-target · IDs no usados para comportamiento.

**Detente tras D2.**
