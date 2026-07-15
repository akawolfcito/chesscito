# Handoff — A9: el bloqueador es una pieza, no un muro (2026-07-14)

Branch: `fix/exercise-obstacles-a0` · Suite: **5093 passing / 429 files** · `tsc --noEmit` limpio.
**Sin commitear todavía** (esperando tu revisión de las capturas).

---

## 1. Qué se cerró

| Superficie | Obstáculo | Clase |
| --- | --- | --- |
| `practice` | **Caballo blanco propio** — arte canónico, atenuado, más chico, sin animación | `.playhub-board-piece-float.is-friendly-blocker` |
| `labyrinth` | **Muro ambiental, intacto** | `.playhub-board-cell.is-wall` |

- Arte **reutilizado** (`PIECE_IMG.knight`), no se creó ninguno nuevo.
- Bloqueador **no interactivo**: `pointer-events: none` + `aria-hidden`. El tap lo recibe la casilla y
  la **regla** rechaza el movimiento — que es lo que enseña.
- **No se tocó** tablero, orden, BFS ni dificultad. Los 60 puzzles quedan idénticos.

### Archivos

| Archivo | Qué |
| --- | --- |
| `src/components/board.tsx` | Capa de bloqueadores friendly; `isWall` ahora exige `mode === "labyrinth"` |
| `src/app/globals.css` | `.is-friendly-blocker` (z-index 9, scale .88, desaturado) |
| `src/components/__tests__/board.test.tsx` | **4 tests**: practice→pieza/nunca muro, labyrinth→muro/nunca pieza, 1 bloqueador por obstáculo, no se come el tap |
| `src/lib/content/catalog.ts` | **Gate nuevo** (ver §2) |
| `src/lib/content/__tests__/lint.test.ts` | 3 tests del gate |
| `scripts/__tests__/import-puzzles.test.ts` | Fixture "boxed mover" ahora usa caballos (ver §2) |

El spec de capturas **se borró** — no pasó la barra de determinismo. Ver §4.5, que es el hallazgo más
importante de la sesión.

---

## 2. El agujero que encontré y tapé

`obstacles` es `BoardPosition[]`: lleva **casillas, no tipos de pieza**. El tablero **no puede
verificar lo que dibuja**. Hoy los 60 puzzles usan caballos blancos (auditado: 0 excepciones) y sólo
por eso el sprite dice la verdad — pero **un alfil blanco autorado mañana se renderizaría como
caballo**, y el tablero mentiría sobre la posición.

En vez de ensanchar `obstacles` (eso es cirugía de BFS, ver §3), el **linter de contenido** sostiene
la invariante: un bloqueador de ejercicio que no sea caballo **no compila**. Laberintos exentos: su
obstáculo es muro, la pieza detrás nunca se dibuja.

> **Un test rojo por esto.** El fixture `"rejects an unsolvable puzzle (boxed mover)"` encerraba la
> torre con **torres blancas**; el gate nuevo dispara antes y le robaba el error. Cambié el fixture a
> caballos: sigue probando lo suyo (b2 tapiado, a8 inalcanzable). La precedencia es la correcta y es
> la que ya declara `catalog.ts` — nombrar la casilla culpable **&gt;** decir "no hay camino".

---

## 3. Registrado, NO implementado

`obstacles → {pos, piece}` es la **misma cirugía** que ya está registrada en el plan §15.6.3:

> **Captura** (Fase B) y **objetivos múltiples** piden la **MISMA generalización del BFS**: el estado
> pasa de `posición` a `(posición, pendientes)`. Si se hace una, la otra sale casi gratis; si se hacen
> por separado, se paga dos veces.

**Ninguna de las dos se construyó.** A9 se apoya en el gate de contenido justamente para **no** abrir
esa cirugía antes de tiempo. Documentado en `docs/plans/2026-07-13-rook-curriculum-implementation-plan.md` §15.7.1.

---

## 4. Capturas 6–10 — la lectura

Contact sheet: artifact publicado (privado). Capturas en el scratchpad de la sesión.

| Slot | Título | Bloqueadores | Opciones iniciales |
| --- | --- | --- | --- |
| 6 | Your own piece blocks the way | 2 | **2** |
| 7 | The file is closed | 4 | **7** |
| 8 | The boxed star | 2 | 6 |
| 9 | Find the shortest route | 7 | 8 |
| 10 | Plan the whole route | 11 | 14 |

### Sobre el salto de 2 → 7 (lo que te preocupaba)

**El número sube; la decisión no.** En el ejercicio 7 las **7 opciones están todas sobre la fila 1**:
la columna está cerrada a **cero** (caballo en d2, justo delante de la torre en d1). Las siete son
**la misma idea repetida siete veces** — *andá de costado y volvé*. El ejercicio 6, con sólo 2
opciones, ofrece **dos ideas distintas** (subir, o cruzar).

Contadas como **ideas** en vez de casillas, la curva va 2 → 1 → 2… El salto es nominal.

**Riesgo real, si querés mirarlo:** el 7 puede sentirse *más fácil* que el 6, no más difícil — porque
7 dots en una fila recta se leen como "obvio", mientras que 6 dots que exigen elegir dirección se
leen como decisión. No lo toqué (dijiste no cambiar orden ni dificultad). Queda a tu juicio.

---

## 4.5 ✅ RESUELTO — el estado sembrado NO aterrizaba en el ejercicio pedido

> **Cerrado el 2026-07-14.** Eran **tres bugs**, no uno, y todos el mismo pecado: *decidir con estado
> que todavía no cargó, y persistir la decisión.* Fixes: `d6d17f73` (loadProgress) y `4724f5ac`
> (rotación/steering). Red: `e2e/rook-ten-exercises-smoke.spec.ts` — **30/30 en dos corridas
> `--repeat-each=3`** con la rotación encendida. Detalle abajo, y el patrón en
> [[feedback_never_decide_from_unhydrated_state]].
>
> 1. **`loadProgress` validaba el `currentId` contra el pool** — que puede llegar incompleto. Para un
>    chequeo de pertenencia, *"todavía no cargó"* y *"fue borrado"* son la misma respuesta. Y en la
>    rama legacy **escribía el resultado de vuelta**: pérdida de datos permanente.
> 2. **El set visible del día se computaba con las estrellas vacías** (pre-hidratación) → los 10
>    parecían sin jugar → el corte salía por hash de sesión (aleatorio) → el steering **expulsaba** al
>    jugador de su propio ejercicio y lo persistía.
> 3. **`guestSessionSeed` se derivaba en un efecto** → en el render posterior a la carga las estrellas
>    eran reales pero la semilla seguía `null`, y `null` es **ambiguo**: el selector lee "invitado sin
>    semilla" como **primerizo** y devuelve los *canonical five*. Correcto sin progreso; muy incorrecto
>    para quien vuelve.
>
> **La pista que lo resolvió:** apagar la rotación. Con `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION=false`
> pasaba 30/30; con `true`, 28/30. Ese experimento valió más que diez teorías.
>
> **Decisión de producto tomada:** las estrellas legacy (array posicional) **ya no se acreditan** —
> A6 reordenó el pool, así que migrarlas acredita el ejercicio equivocado. `exerciseIndex` solo
> orienta la navegación. *Perder progreso ambiguo es preferible a certificar el aprendizaje
> equivocado.*

<details>
<summary>El hallazgo original, como se reportó</summary>

**Esto es lo que tiene que atacar el smoke funcional de los 10 de torre.**

Al intentar dejar el spec de capturas como test repetible (tu condición: determinístico), **falló la
barra**. Con `--repeat-each=3`:

- **Ejercicio 10: falla 3/3.**
- **Ejercicio 8: falla 1/3.**
- El tablero renderiza el **ejercicio 1** (torre b1 → h1, sin bloqueadores) aunque el contador de
  estrellas muestra el progreso correcto.

**No es el test.** Sembré el progreso de dos formas distintas y las dos derivan:

1. Forma legacy (`exerciseIndex` + array de estrellas) — la que usa `capture-exercise.spec.ts` hoy.
2. **Forma actual, con `currentId` explícito** (`{ piece, currentId, stars: Record<id, number> }`,
   estrellas en 3 para superar `MEDIUM_UNLOCK_STARS = 5`). **Sigue fallando.**

O sea: **incluso nombrando el ejercicio por id, la pantalla a veces cae al primero del pool.**
`exercises-screen.tsx:711-718` documenta ese fallback («A null/stale id falls back to the first pool
exercise»), así que algo está resolviendo `currentId` como null/stale de forma intermitente. Sospechas
en orden: carrera de hidratación (la pantalla monta con default y escribe antes de leer), o
`useRotationSteering` (aunque `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` parece apagado).

**No lo diagnostiqué a fondo** — pediste no avanzar. Pero es un bug de producto, no de test: si un
jugador vuelve a la app y el estado se resuelve mal, **lo tiran al ejercicio 1**.

> **Las capturas SÍ son válidas.** Cada una verificó su chip de misión, su conteo de bloqueadores y su
> conteo de opciones **antes** de disparar. Lo que es inestable es *llegar* al ejercicio, no lo que se
> ve cuando se llega.

</details>

---

## 5. 🔴 Disco — por qué se muere codex

**Medido hoy, no supuesto.** Disco: **425 G usados de 460 G. Contenedor APFS: 7.4 GB libres.**
El sistema vive crónicamente al 98%: **cualquier** corrida de Playwright es la gota que rebalsa.

### ⚠️ Mi primer diagnóstico estaba MAL. La medición me corrigió.

**Dije:** «el hog son los `node_modules` (21.5 G)». **Falso, y de forma instructiva.**

> **`du` sobre `node_modules` de pnpm MIENTE.** pnpm usa **hard links** contra un store global: cada
> `node_modules` parece pesar 1.6 GB, pero los bytes existen **una sola vez**. `du` los cuenta una vez
> por carpeta. Borré **13 GB** de `node_modules` y **recuperé 0.8 GB**.

**Dónde estaba el espacio de verdad** (medido, con `~/Library/pnpm/store` y `~/.npm`):

| Qué | Peso | Resultado |
| --- | --- | --- |
| **`~/.npm/_cacache`** — caché de npm | **12 G** | ✅ purgado (`npm cache clean --force`) |
| **`~/Library/pnpm/store/v10`** — store **huérfano** | **14 G** | ✅ eliminado — el pnpm pineado es **8.10.0**, que usa **v3**. Nadie usaba v10. |
| `~/Library/pnpm/store/v3` — store activo | 5.5 G | ✅ podado (`pnpm store prune`): 2796 paquetes |
| **Playwright — chromiums viejos** (1148, 1169 + headless shells) | ~1.9 G | ✅ eliminados. Solo se usa 1208. |
| Chrome (`Caches/Google` + `App Support/Google`) | ~46 G | ⬜ **intacto** — decidiste no tocarlo |

**Resultado: 2.9 GB → 33 GB libres.** Suite verde después (5100/5100), Playwright corre.

### Tu hipótesis, evaluada

Tenías razón en el **mecanismo** ("se quedan ahí silenciosamente"), pero el culpable no era Playwright:

- Playwright **sí** acumula: guarda **un Chromium por versión** que instalaste y **nunca borra el
  viejo**; y `video: retain-on-failure` escribió **31 MB en 3 tests fallidos** (una VR suite que falle
  feo escribe GB, y quedan hasta la próxima corrida).
- Pero eso es **el gatillo, no el hog**. El hog eran **26 GB de caches de paquetes** que ningún
  proyecto referenciaba — incluido un **store de pnpm entero (v10, 14 GB) que ninguna versión
  instalada usa**.

### El residuo específico de chesscito

`.claude/worktrees/` tiene **4 worktrees viejos** (`feat-pr4/5/6`, `victory-nft-permit-mint`), cada uno
con su `node_modules`. **Por hard links casi no cuestan disco**, pero sí inflan el store y ensucian.
**Pendiente:** verificar si esas branches están mergeadas y limpiar los worktrees (`git worktree prune`).

### Lo que queda como defensa permanente

- ✅ **Guard de preflight** (commit `8d400213`): Playwright **se niega a arrancar** con < 10 GB libres,
  en vez de morir a mitad y dejar basura que hace más probable la próxima muerte. **No borra nada.**
- ⬜ **`video: "off"`** en `playwright.config.ts` — el video es el artefacto pesado; screenshot + trace
  ya alcanzan para diagnosticar. Cambio de una línea, no lo hice.
- ⬜ **Higiene periódica:** `npm cache clean --force` + `pnpm store prune` cada tanto. Los caches de
  paquetes crecen sin techo y **nadie los mira**.

---

## 6. Estado y próximos pasos

**Cerrado:**
- [x] A9 aprobado visualmente. **Orden 6 → 7 se mantiene** (concepto antes que aplicación — plan §15.7.0).
- [x] Gate de caballos = **invariante temporal**, con su condición de borrado escrita en el código y en el plan.
- [x] A9 commiteado en 3 commits atómicos.
- [x] Spec de capturas **borrado** (no determinístico — §4.5).

- [x] **Guard de disco** (`8d400213`) — preventivo, no destructivo.
- [x] **Bug de reanudación arreglado** (`d6d17f73`, `4724f5ac`) — ver §4.5.
- [x] **Smoke funcional de los 10** (`c81748d3`) — 30/30 × 2 corridas, rotación ON.

- [x] **capture-exercise.spec.ts** → forma moderna + captura real de peón (`f10560d5`).
- [x] **A10/A11 — Rook Rails Delivery 1** (`f9c7bb35` contenido, `c5a02530` capturas).

### 🟡 REVISIÓN VISUAL: válida pedagógicamente, INSUFICIENTE visualmente (founder, 2026-07-14)

Los 4 tableros **cumplen principios y métricas** pero **no se sienten como laberintos** — se leen como
*ejercicios de ruta con muros*. Causa: se **generaron desde métricas**, y las métricas no miden la
identidad espacial. **Placeholder válido, NO definitivos.** Se rediseñan (ver plan §9, el callout).

**Criterios del rediseño** (más humano/visual, con el builder a mano, validar contra el motor DESPUÉS):
pasillos más claros · agrupación de muros · sensación real de camino · falsas rutas más visibles ·
mejor identidad de "laberinto".

**Sigue:**
- [ ] **Rediseño espacial de los 4 rails** (manual → validar métricas después). Los principios/métricas
      quedan; los layouts no.
- [ ] **NO Fase B** (Break Through) hasta cerrar el rediseño.
- [ ] `video: "off"` en `playwright.config.ts` (los videos son el artefacto pesado).
- [ ] Limpiar los 4 worktrees stale en `.claude/worktrees/` (verificar merge antes).

### A10/A11 — Rook Rails Delivery 1 (medido, no estimado)

| Nivel | id | Óptimo | Rutas | Decisiones iniciales | Obstáculos | Decisión |
| --- | --- | --: | --: | --: | --: | --- |
| 1 One Turn | `rook-rail-one-turn` | 2 | 1 | 4 | 4 | reconocer el giro |
| 2 Two Turns | `rook-rail-two-turns` | 3 | 1 | 4 | 5 | bifurcación falsa |
| 3 Dead End | `rook-rail-dead-end` | 4 | 1 | 2 | 6 | d2=ruta (3★), e1=callejón +2 (2★) |
| 4 Two Roads | `rook-rail-two-roads` | 6 | 2 | 2 | 8 | b2=corto (3★), a1=largo +2 (2★) |

- **0 obstáculos redundantes** en los 4 (cada uno cambia una decisión). Pasan el linter sin warning.
- **Óptimo declarado = BFS mínimo** (verifier oficial, hard-fail). Verde.
- **Break Through (nivel 4) NO entra** — necesita captura (Fase B).
- **Muro ambiental conservado** en laberintos (A9): obstáculos = `.is-wall`, no piezas.
- IDs nuevos (cambió tablero, óptimo y principio → §10.3). Los 4 viejos salen del pool; `loadProgress`
  descarta huérfanos, sin migración.
- Obst por debajo del rango del plan (spec pedía 8-10 / 10-14) **a propósito**: la regla #1 del spec
  ("se juzga por decisiones, no obstáculos") gana sobre la cuenta. Si querés más densidad visual, es
  ajuste de revisión.

## Preguntas abiertas

1. **`capture-exercise.spec.ts` siembra con la forma legacy (`exerciseIndex` + array de estrellas).**
   Ese array ya **no acredita estrellas**, así que ese spec ahora corre con un jugador de 0★. Sigue
   verde, pero puede estar probando menos de lo que cree. Vale revisarlo.
2. La rotación está **ON en dev** y **el steering puede navegar y persistir**. ¿Es el comportamiento
   deseado que la rotación mueva a un jugador que vuelve, aunque sea con un set correcto? Hoy no lo
   hace (su ejercicio siempre está en el set), pero la capacidad sigue ahí.
