# Auditoría pedagógica y propuesta — TORRE (Rook)

**Fecha**: 2026-07-13
**Alcance**: los 10 ejercicios y los 4 laberintos de torre, auditados **contra el contenido y el
código**, no contra la documentación.
**Estado**: auditoría + propuesta. **Sin implementación, sin commits.**
**Frente**: Frente 1 — pulir el aprendizaje actual (`docs/product/2026-07-13-direction-where-we-are.md` §6).

**Método**: se decodificaron los FEN de `apps/web/content/exercises.json` y
`apps/web/content/labyrinths.json`, y se corrió un BFS que **replica exactamente**
`lib/game/rules/rook.ts` + `lib/game/board.ts` (el rayo se corta **antes** del bloqueador, y
`withoutBlockers` prohíbe aterrizar en él). Todas las cifras de este doc son medidas, no estimadas.

---

## 1. Resumen ejecutivo

**El catálogo de torre funciona mecánicamente y está mal usado pedagógicamente.** Los tableros son
legales, todos los objetivos son alcanzables, y el BFS confirma los `optimalMoves` publicados. El
problema no es que esté roto: es que **no enseña lo que dice enseñar, y no le dice al jugador nada**.

Cinco hallazgos, en orden de gravedad:

1. **🔴 La captura de torre NO EXISTE en el motor.** `getRookMoves` (`rules/rook.ts:36-38`) hace
   `break` **sin** `push` al topar un bloqueador: la torre nunca puede aterrizar sobre él. Y
   `getValidTargets` (`board.ts:41-43, 72-73`) filtra las casillas de obstáculo del resultado. Los
   parámetros `isCapture` y `captureTargets` **sólo tienen efecto en la rama `pawn`** (`board.ts:50-67`).
   → **Los puntos 6, 7 y 8 del temario (todo el bloque de captura) son hoy inimplementables sin
   trabajo de motor.**

2. **🔴 Tres ejercicios mienten en sus tags.** `rook-4`, `rook-5` y `rook-9` están tagueados
   `capture`. **`rook-4` y `rook-5` tienen CERO piezas en el tablero** — no hay absolutamente nada que
   capturar. `rook-9` tiene dos caballos, pero son bloqueadores incapturables. El tag anuncia una
   lección que el motor no puede entregar.

3. **🔴 El jugador lee una ETIQUETA, no una lección — y dos de ellas le mienten.**

   > ⚠️ **CORRECCIÓN (2026-07-13, durante A1/A7).** La v1 de este punto afirmaba que la UI mostraba
   > literalmente **"Exercise 1"… "Exercise 10"**. **ERA FALSO.** `GENERATED_EXERCISE_DESCRIPTIONS`
   > sí estaba vacío, pero `resolveExerciseDescription` tiene **un escalón intermedio que no vi**:
   > `EXERCISE_DESCRIPTIONS` (`editorial.ts:1271`), un mapa i18n con una etiqueta por cada id. El
   > fallback `Exercise {n}` **nunca se alcanzaba**. Verifiqué mal: busqué `"rook-1"` en `src/` y sólo
   > miré los hits de tests, sin abrir el resolver hasta el final.

   Lo que el jugador **sí** leía era un **nombre**, no un principio: *"Horizontal move"*, *"Around the
   wall"*, *"Boxed-in square"*. Nombran la postal, no enseñan la regla — y **el ejercicio no dice en
   ninguna parte qué principio practica**.

   **Y la mentira de los tags también llegaba a la pantalla**: `rook-4` = *"Corner capture"*, `rook-5`
   = *"Cross capture"*, `rook-9` = *"Capture detour"* — **en tableros donde no hay absolutamente nada
   que capturar**. No era sólo metadata sucia: **el jugador leía la palabra "capture" y el juego no le
   permitía capturar nada.**

   El campo `objective` del tipo `Exercise` (`types.ts:46`) ya estaba declarado — y vacío en los 10.

4. **🟠 Hay ejercicios duplicados y un temario con huecos.** `rook-4` y `rook-5` son el **mismo
   ejercicio** (giro en L, 2 movimientos, tablero vacío) con distintas coordenadas. `rook-2` y
   `rook-3` son ambos "movimiento en columna". Mientras tanto, **la distancia variable (punto 4) nunca
   se aísla** y **"no es una diagonal" (punto 3) sólo se enseña por accidente** en `rook-8`.

5. **🟠 La curva de dificultad tiene dos saltos y una joya enterrada.** El salto real no está en los
   movimientos (1,1,1,2,2,3,4,4,3,4) sino en el **ruido visual**: `rook-6` pasa de 0 a **21 obstáculos**
   de golpe, para un desvío de sólo 3 movimientos — la mayoría son decorativos. Y **`rook-8` es el mejor
   ejercicio del set** (el objetivo está en diagonal adyacente y cuesta 4 movimientos: enseña la
   identidad de la torre mejor que ningún otro) y está **sepultado en la posición 8, sin una sola
   palabra que lo explique**.

**La buena noticia:** los ejercicios que hay que conservar son mayoría. Esta auditoría propone
**0 eliminaciones**, 1 reemplazo, 4 ajustes y una reordenación — más la deuda de motor para el bloque
de captura.

---

## 2. Inventario real de ejercicios (medido, no declarado)

Los obstáculos son **caballos blancos (`N`) = piezas propias bloqueadoras, incapturables**.
`optimalSolutions` = cuántas rutas distintas alcanzan el óptimo (mide ambigüedad).
`firstMoveChoices` = casillas legales en el primer movimiento (mide la amplitud de la primera decisión).

| ID | Orden | Tier | Tags | Inicio → Objetivo | Obst. | Óptimo | Soluciones óptimas | Opciones 1er mov. |
| --- | --: | --- | --- | --- | --: | --: | --: | --: |
| `rook-1` | 0 | easy | `straight-line` | b1 → h1 | 0 | 1 | 1 | 14 |
| `rook-2` | 1 | easy | `straight-line` | a2 → a8 | 0 | 1 | 1 | 14 |
| `rook-3` | 2 | easy | `straight-line` | d7 → d2 | 0 | 1 | 1 | 14 |
| `rook-4` | 3 | easy | `capture`, `corner-turn` | g7 → b2 | **0** | 2 | 2 | 14 |
| `rook-5` | 4 | easy | `capture`, `corner-turn` | g2 → c7 | **0** | 2 | 2 | 14 |
| `rook-6` | 5 | medium | `detour`, `blocked-rank` | d6 → d2 | **21** | 3 | 2 | 8 |
| `rook-7` | 6 | medium | `detour`, `blocked-file` | a1 → d5 | 14 | 4 | 3 | 14 |
| `rook-8` | 7 | medium | `detour`, `boxed-target` | d4 → e5 | 2 | 4 | **18** | 6 |
| `rook-9` | 8 | medium | `capture`, `detour` | a1 → c3 | 2 | 3 | 2 | **2** |
| `rook-10` | 9 | medium | `detour`, `blocked-file`, `rook-lift` | d1 → d5 | 4 | 4 | **15** | 7 |

### Qué aprende realmente el jugador, ejercicio por ejercicio

- **`rook-1` (b1→h1, 1 mov.)** — Principio supuesto: línea recta. **Principio real: movimiento en FILA.**
  Limpio, correcto, es el mejor primer ejercicio posible. *No se comunica.*
- **`rook-2` (a2→a8, 1 mov.)** — **Movimiento en COLUMNA, hacia arriba.** Correcto. *No se comunica.*
- **`rook-3` (d7→d2, 1 mov.)** — **Movimiento en COLUMNA, hacia abajo.** Es el punto 2 otra vez. Su
  único aporte nuevo es "la columna también va hacia abajo", que ningún jugador duda. **Ocupa un
  espacio del recorrido sin enseñar nada nuevo.**
- **`rook-4` (g7→b2, 2 mov.)** — Tag dice `capture`; **el tablero está vacío**. Principio real:
  **cambiar de dirección ENTRE movimientos, no dentro de uno** (temario 9). Es un buen ejercicio con
  la etiqueta equivocada.
- **`rook-5` (g2→c7, 2 mov.)** — **Idéntico a `rook-4`** en principio, forma y dificultad. Duplicado.
- **`rook-6` (d6→d2, 3 mov., 21 obstáculos)** — Principio supuesto: fila bloqueada. **Realidad: un muro
  de 21 caballos del que sólo unos pocos tocan la solución; el resto es decoración.** El jugador
  aprende "hay que rodear", pero paga un costo de lectura enorme por una lección chica. **Éste es el
  salto de dificultad percibido del recorrido**, y es un salto de *ruido*, no de *pensamiento*.
- **`rook-7` (a1→d5, 4 mov., 14 obstáculos)** — Ruta larga con desvío. Válido, pero llega demasiado
  pronto y repite la lección de `rook-6` con más distancia.
- **`rook-8` (d4→e5, 4 mov., 2 obstáculos)** — **La joya.** El objetivo está a **un paso en diagonal** y
  cuesta **cuatro movimientos**. Con sólo dos bloqueadores (d5, e4) enseña, en una sola imagen, **que la
  torre no es un alfil** (temario 3) y **que las piezas propias tapan** (temario 5). *Sepultado en la
  posición 8 y sin explicación.* Contrapunto: **18 soluciones óptimas** → la ruta exacta es indiferente,
  lo que está bien para "rodeá", pero lo hace un mal ejercicio de "ruta más corta".
- **`rook-9` (a1→c3, 3 mov., 2 obstáculos)** — **El más limpio de los avanzados.** Sólo **2 opciones en
  el primer movimiento**: el tablero *fuerza* a pensar sin gritar. Tag `capture` es falso. **Debería
  estar mucho antes.**
- **`rook-10` (d1→d5, 4 mov., 4 obstáculos)** — Columna tapada, hay que salir y volver (*rook lift*).
  Buen cierre. 15 soluciones óptimas.

---

## 3. Mapeo contra el temario

| Orden actual | ID | Tags | Principio supuesto | Principio real | Dificultad real | Problema detectado | Veredicto |
| --: | --- | --- | --- | --- | --- | --- | --- |
| 0 | `rook-1` | `straight-line` | Línea recta | **Fila** (temario 1) | Trivial (1 mov.) | Sólo le falta el nombre | `KEEP_AND_RENAME` |
| 1 | `rook-2` | `straight-line` | Línea recta | **Columna** (temario 2) | Trivial (1 mov.) | Sólo le falta el nombre | `KEEP_AND_RENAME` |
| 2 | `rook-3` | `straight-line` | Línea recta | Columna otra vez | Trivial (1 mov.) | **Duplica a `rook-2`**; el temario 4 (distancia variable) queda sin cubrir | `ADJUST` |
| 3 | `rook-4` | `capture`, `corner-turn` | Captura + giro | **Cambio de dirección** (temario 9) | Baja (2 mov.) | **Tag `capture` es falso: 0 piezas en el tablero** | `KEEP_AND_RENAME` |
| 4 | `rook-5` | `capture`, `corner-turn` | Captura + giro | Idéntico a `rook-4` | Baja (2 mov.) | **Duplicado exacto** + tag falso | `REPLACE` |
| 5 | `rook-6` | `detour`, `blocked-rank` | Fila bloqueada | Rodear un muro | Media (3 mov.) pero **ruido alto** | **21 obstáculos, casi todos decorativos** → salto de dificultad *percibida* | `ADJUST` |
| 6 | `rook-7` | `detour`, `blocked-file` | Columna bloqueada | Ruta larga | Alta (4 mov., 14 obst.) | Llega **antes** que la lección simple que lo precede lógicamente | `ADJUST` + `REORDER` |
| 7 | `rook-8` | `detour`, `boxed-target` | Objetivo encajonado | **La torre NO es diagonal** (temario 3) | Alta (4 mov., **2 obst.**) | **El mejor del set, enterrado y mudo** | `KEEP_AND_RENAME` + `REORDER` |
| 8 | `rook-9` | `capture`, `detour` | Captura + desvío | **Pieza propia bloquea** (temario 5) | Media (3 mov.), muy dirigido | Tag `capture` falso; **está 3 puestos tarde** | `ADJUST` + `REORDER` |
| 9 | `rook-10` | `detour`, `blocked-file`, `rook-lift` | Columna bloqueada | Salir de la columna y volver | Alta (4 mov.) | Correcto | `KEEP_AND_RENAME` |

### Cobertura del temario

| # | Principio | ¿Cubierto hoy? | Dónde |
| --: | --- | --- | --- |
| 1 | Movimiento en fila | ✅ | `rook-1` |
| 2 | Movimiento en columna | ✅ (duplicado) | `rook-2`, `rook-3` |
| 3 | Distinguir fila/columna de diagonal | ⚠️ **por accidente** | `rook-8` (nunca enunciado) |
| 4 | Distancia variable (una o varias casillas) | ❌ **hueco** | — nunca se aísla |
| 5 | Una pieza propia bloquea | ✅ | `rook-6/7/9/10` |
| 6 | Enemigo capturable que detiene el recorrido | 🔴 **imposible en el motor** | — |
| 7 | Captura en la misma línea | 🔴 **imposible en el motor** | — |
| 8 | No capturar detrás de otra pieza | 🔴 **imposible en el motor** | — |
| 9 | Cambiar de dirección entre movimientos | ✅ | `rook-4`, `rook-5` |
| 10 | Planificar ruta eficiente | ⚠️ parcial | `rook-7/8/10` (pero 15–18 soluciones óptimas diluyen "la más corta") |

**Resultado: 4 de 10 principios bien cubiertos, 3 parciales, 1 hueco, y 3 bloqueados por el motor.**

---

## 4. Problemas encontrados

### P0 — El motor no soporta captura de torre
`rules/rook.ts:36-38` corta el rayo antes del bloqueador; `board.ts:72-73` prohíbe aterrizar en él.
**Sin esto, un tercio del temario no se puede enseñar.** Requiere introducir un obstáculo de tipo
`capturable` que **detenga el rayo pero acepte el aterrizaje** — y ahí caen naturalmente los puntos 6,
7 y 8 (el 8 sale gratis: la pieza de atrás sigue tapada).

### P0 — Los tags mienten y nadie los valida
`capture` en tres ejercicios sin nada capturable. **La causa raíz es que no hay ningún chequeo que
compare el tag con el tablero**: `import-puzzles` verifica el BFS, no la semántica. Cualquier tag es
aceptado. Esto es lo que permite que la divergencia exista.

### P0 — El aprendizaje no se comunica
"Exercise 1…10". El campo `objective` existe en el tipo y está vacío en los 10. **El jugador captura
una estrella sin saber qué acaba de aprender.**

### P1 — Ruido visual confundido con dificultad
`rook-6` (21 obstáculos / 3 movimientos) y `rook-7` (14 / 4) parecen difíciles y no lo son. El mejor
ejercicio (`rook-8`) tiene **dos** obstáculos. **La dificultad debe venir de la decisión, no del
desorden.**

### P1 — Los bloqueadores parecen enemigos
Los obstáculos se renderizan como **caballos**. Un caballo en el tablero le dice al jugador "capturame",
y el juego le contesta que no. **La forma contradice la regla.** El punto 5 del temario es "una pieza
**propia** bloquea": debería *verse* propia.

### P2 — Duplicados que gastan espacio del recorrido
`rook-5` ≡ `rook-4`; `rook-3` ≈ `rook-2`. Dos de diez casillas del recorrido no enseñan nada nuevo,
mientras el temario 4 queda sin cubrir.

---

## 5. Nueva secuencia de 10 ejercicios

Progresión: **reconocer → ejecutar → restringir → capturar → planificar.**
(El bloque de captura queda **explícitamente diferido** — ver §5.1.)

| Nº | Título | Principio | Prompt | Qué detecta | Dificultad | Acción |
| --: | --- | --- | --- | --- | --- | --- |
| 1 | **Move along the rank** | `rank-movement` | *Reach the star without leaving the rank.* | Que confunda fila con columna | Trivial (1) | `KEEP_AND_RENAME` ← `rook-1` (b1→h1) |
| 2 | **Move along the file** | `file-movement` | *Now go straight up the file.* | Idem, eje opuesto | Trivial (1) | `KEEP_AND_RENAME` ← `rook-2` (a2→a8) |
| 3 | **One square is a move too** | `variable-distance` | *A rook can move just one square. Take it.* | Que crea que la torre "debe" ir lejos | Trivial (1) | `ADJUST` ← `rook-3` (d7→**d6**, era d2) |
| 4 | **The rook is not a bishop** | `no-diagonal` | *The star is one diagonal step away. The rook needs two moves.* | El error #1 de todo principiante | Baja (2) | `REPLACE` ← `rook-5` (nuevo: d4→e5, **tablero vacío**) |
| 5 | **Turn the corner** | `direction-change` | *Change direction between moves — never inside one.* | Que crea que puede doblar en L en un solo movimiento | Baja (2) | `KEEP_AND_RENAME` ← `rook-4` (g7→b2) |
| 6 | **Your own piece blocks the way** | `friendly-blocker` | *You cannot jump over your own piece. Go around it.* | Que intente atravesar una pieza propia | Media (3) | `ADJUST` + `REORDER` ← `rook-9` (a1→c3; quitar tag `capture`) |
| 7 | **The file is closed** | `blocked-file` | *The file is shut. Step out, climb, and come back.* | Que se quede empujando contra el bloqueo | Media (4) | `KEEP_AND_RENAME` ← `rook-10` (d1→d5) |
| 8 | **The boxed star** | `no-diagonal-advanced` | *One diagonal step away, and four moves of work.* | Que no sepa rodear una caja | Alta (4) | `KEEP_AND_RENAME` + `REORDER` ← `rook-8` (d4→e5, obst. d5/e4) |
| 9 | **Find the shortest route** | `route-planning` | *Many roads work. Find the shortest one.* | Que se conforme con la primera ruta que ve | Alta (3) | `ADJUST` ← `rook-6` (**recortar de 21 a ~6 obstáculos**) |
| 10 | **Plan the whole route** | `route-planning-advanced` | *Look before you move. Plan all four.* | Falta de planificación anticipada | Alta (4) | `ADJUST` + `REORDER` ← `rook-7` (**recortar de 14 a ~8 obstáculos**) |

**Cambios de curva:** el nuevo recorrido va **1,1,1,2,2,3,4,4,3,4** en movimientos, pero — y esto es lo
que importa — va **0,0,0,0,0,2,4,2,~6,~8** en obstáculos. **El ruido crece monótonamente. Hoy salta de
0 a 21 en un paso.**

### 5.1 — El bloque de captura queda diferido (con motivo)

Los puntos 6, 7 y 8 del temario **no entran en esta secuencia** porque el motor no los soporta.
**No se disimulan con tags: se sacan.** Cuando exista el obstáculo `capturable`, entran así — y
conviene que entren **como una segunda tanda de torre**, no metidos a la fuerza en los 10:

- **Capture the first enemy** — un enemigo en la fila; capturarlo es el objetivo.
- **The enemy stops your rook** — un enemigo *antes* del objetivo: hay que capturarlo o rodearlo.
- **You cannot capture behind** — dos enemigos alineados; sólo el primero es alcanzable.

---

## 6. Copy visible recomendado

Los títulos y prompts de §5 son la propuesta. Reglas de estilo:

- **Título**: imperativo o afirmación corta, sin jerga (`Move along the rank`, no `Rank traversal`).
- **Prompt**: una frase, segunda persona, **dice el principio, no la solución**.
  ✅ *"You cannot jump over your own piece. Go around it."*
  ❌ *"Move to b1, then b3, then c3."*
- **Nunca** `Exercise N` como texto visible. Es el fallback de un dato faltante, no una decisión.
- El **título** entra en la fila del drawer; el **prompt** aparece al abrir el ejercicio.
- Idioma: **English** (`lib/content/editorial.ts`), como todo el UI.

---

## 7. Propuesta de esquema de datos

### El principio debe ser un campo curado, NO derivado de los tags

**Los tags no pueden ser la fuente del texto pedagógico.** Ya se demostró por qué: tres de ellos
mienten. Un texto generado desde un tag falso produce una lección falsa **con apariencia de sistema**.
El texto se cura a mano; los tags se degradan a taxonomía interna **y pasan a estar validados**.

```json
{
  "id": "rook-6",
  "piece": "rook",
  "fen": "8/8/8/8/8/N7/8/R1N5 w - - 0 1",
  "mover": "a1",
  "target": "c3",

  "principle": "friendly-blocker",
  "title": "Your own piece blocks the way",
  "playerPrompt": "You cannot jump over your own piece. Go around it.",
  "learningObjective": "The player learns that a friendly piece stops the rook's ray and cannot be captured.",

  "tier": "medium",
  "tags": ["detour", "blocked-file"],
  "order": 5
}
```

### Quién manda sobre qué

| Campo | Naturaleza | Regla |
| --- | --- | --- |
| `fen`, `mover`, `target` | **FUENTE DE VERDAD** | El tablero es la realidad. Todo lo demás se valida contra él. |
| `principle` | **Editorial, curado** | Un enum cerrado (`rank-movement`, `no-diagonal`, `friendly-blocker`…). Uno por ejercicio. |
| `title`, `playerPrompt`, `learningObjective` | **Editorial, curado** | Escritos a mano. **Nunca generados desde tags.** |
| `optimalMoves`, `solutionLength`, `decisionCount`, `optimalSolutions` | **CALCULADOS** | Los emite el BFS en `pnpm import-puzzles`. **Nunca se escriben a mano.** Hoy ya se calcula `optimalMoves`; los otros tres son la extensión natural. |
| `tier` | **Derivado + revisado** | Propuesto por el score de §3, confirmado por una persona. |
| `tags` | **Interno** | Organización y variedad de rotación. **No es copy.** |

### Cómo se evita la divergencia (la parte que hoy falta)

**Un linter de contenido en `import-puzzles` que FALLE el build cuando el dato contradice al tablero:**

1. **`capture` sin nada capturable → error.** *(Hoy: 3 ejercicios de torre pasarían a rojo. Ése es
   exactamente el punto.)*
2. **`blocked-file` / `blocked-rank` sin obstáculo en la línea inicial → error.**
3. **`principle` faltante, o `title` / `playerPrompt` vacíos → error.** Mata el fallback "Exercise N"
   de raíz: si no hay texto, no compila.
4. **`principle` que no coincide con la geometría → error.** Ej. `no-diagonal` exige que el objetivo
   esté en diagonal respecto del origen; `variable-distance`, que el óptimo sea 1.
5. **Objetivo inalcanzable, u objetivo sobre un obstáculo → error.** *(Hoy los 14 tableros de torre
   pasan este chequeo — está bien tenerlo igual.)*

**El principio de diseño:** el tablero es la verdad, el texto es una promesa, **y el linter es el que
verifica que la promesa se cumpla.** Sin ese chequeo, la divergencia vuelve — porque ya volvió.

---

## 8. Objetivos visuales

**No todos los ejercicios deberían usar una estrella.** Hoy la estrella hace de "casilla objetivo" en
los 10, y eso **oculta el aprendizaje**: la lección de `rook-8` no es *"llegá a la estrella"*, es
*"la torre no cruza en diagonal"*, y el tablero no lo dice en ningún lado.

| Objetivo | Cuándo usarlo | Ejercicios |
| --- | --- | --- |
| ⭐ **Estrella** | "Llegá a esta casilla". El caso base de reconocer y ejecutar. | 1, 2, 3, 5 |
| 🚫 **Casilla prohibida / diagonal tachada** | Cuando la lección es lo que la pieza **no** puede hacer. Marcar la diagonal directa como no-camino hace visible el punto 3. | 4, 8 |
| 🪨 **Bloqueador propio (roca/cajón, o pieza en color propio)** | **Sustituir los caballos actuales.** Un caballo dice "capturame"; el motor dice que no. La forma debe decir *"soy tuyo y no me muevo"*. | 6, 7, 9, 10 |
| ♟️ **Enemigo** | **Sólo cuando exista la captura.** Un enemigo en pantalla es una promesa de captura: si no se puede capturar, es una mentira visual. | (bloque diferido §5.1) |
| 🚪 **Puerta** | Cuando la lección sea "pasá por acá" — útil para *Rook Rails*, no para los ejercicios. | (Rook Rails) |

**La estrella sigue siendo la recompensa. Deja de ser la única explicación.**

---

## 9. Evaluación de los laberintos actuales de torre

| ID | Inicio → Fin | Obst. | Óptimo | Soluciones óptimas | Opciones 1er mov. | Legal | ¿Obliga a planificar? | ¿Decisiones reales? | Veredicto |
| --- | --- | --: | --: | --: | --: | :-: | :-: | :-: | --- |
| `rook-gen-00q06dtn` | a1 → h8 | 24 | 5 | **1** | 2 | ✅ | ✅ | ⚠️ pasillo forzado | `MODIFY` |
| `rook-lab-1` | c2 → e3 | 19 | 6 | 4 | 3 | ✅ | ✅ | ✅ | **`KEEP`** |
| `rook-lab-2` | d8 → d1 | **34** | 6 | **1** | 3 | ✅ | ❌ | ❌ **sólo distancia** | `REPLACE` |
| `rook-lab-3` | b3 → d4 | 20 | 7 | 4 | 5 | ✅ | ✅ | ✅ | **`KEEP`** |

**Los cuatro son legales y todos los objetivos son alcanzables.** El problema es otro:

- **`rook-lab-2` tiene 34 obstáculos — más de la mitad del tablero — y UNA sola solución.** Eso no es un
  laberinto: es un **pasillo**. El jugador no decide, camina. Añade distancia, no pensamiento. **Es el
  peor de los cuatro y el que más caro se ve.**
- **`rook-gen-00q06dtn` es generado proceduralmente** (lo dice su id) y tiene el mismo defecto en menor
  grado: solución única, 24 obstáculos de sopa.
- **`rook-lab-1` y `rook-lab-3` sí son buenos**: varias rutas, óptimo apretado, decisiones reales.
- **Ninguno integra el principio de captura** (no puede: el motor no lo soporta).
- **Ninguno plantea "dos rutas, una más eficiente" de forma legible** — que es justo el nivel 5 pedido.
- **Ninguno tiene `tier`, `title` ni texto.** Los laberintos entran en la misma deuda de comunicación
  que los ejercicios.

**Conclusión: la mecánica de laberinto SÍ encaja con la torre** — es la pieza donde mejor funciona,
porque rodear bloqueos por filas y columnas *es* su identidad. **Lo que está mal es la ejecución: se
confundió "muchos obstáculos" con "buen laberinto".**

---

## 10. Diseño de `Rook Rails`

> **Rook Rails** — *Navigate ranks and files, avoid the blocks, and reach the exit in the fewest moves.*

**La mecánica se conserva** (es la correcta para la torre). Lo que cambia es la **regla de diseño**:

> **Un nivel de Rook Rails se juzga por sus DECISIONES, no por sus obstáculos.**
> Si sacar la mitad de los bloqueadores no cambia la solución, esa mitad es decoración — y hay que
> sacarla.

### Progresión de 5 niveles

| Nivel | Nombre | Principio que integra | Diseño | Obst. objetivo | Óptimo | Rutas óptimas | Fuente |
| --: | --- | --- | --- | --: | --: | --: | --- |
| 1 | **One turn** | Cambio de dirección | Un solo giro entre inicio y salida. El camino recto está tapado. | 3–5 | 2 | 1–2 | **Nuevo** |
| 2 | **Two turns** | Encadenar giros | Dos giros obligados. Aparece la primera bifurcación falsa. | 5–7 | 3 | 2 | **Nuevo** |
| 3 | **Dead end** | Rutas que no llevan a nada | Un corredor tentador que no sale. Hay que **retroceder o descartarlo antes de entrar**. | 8–10 | 4 | 1–2 | `MODIFY` ← `rook-gen-00q06dtn` (recortar la sopa, conservar el pasillo forzado como el callejón) |
| 4 | **Break through** | 🔴 **Captura que abre el camino** | El único paso está tapado por un **enemigo capturable**. Capturarlo *es* la llave. | 8–10 | 4–5 | 1 | **Nuevo — BLOQUEADO por el motor (§4 P0)** |
| 5 | **Two roads** | Planificación eficiente | **Dos rutas completas hasta la salida**: una de N movimientos, otra de N+2. **Ambas llegan.** Las estrellas separan al que planificó del que caminó. | 10–14 | 5–6 | 1 (la corta) | `KEEP` ← `rook-lab-1` o `rook-lab-3` (ya tienen varias rutas; hay que **desbalancearlas a propósito**) |

**El nivel 5 es el corazón del minijuego** y hoy no existe en ninguna forma: es el único donde
`labyrinthStars` (`exercises.ts:107-112`, que puntúa por cercanía al óptimo) **significa algo de
verdad**. Hoy, con rutas óptimas equivalentes, las estrellas premian caminar sin perderse. Con dos
rutas desbalanceadas, **premian pensar** — que es exactamente lo que el sistema de estrellas ya sabe
medir y nadie está usando.

**El nivel 4 depende de la deuda de motor.** Hasta que exista el obstáculo capturable, *Rook Rails*
sale con **4 niveles**, no 5. **No lo disfrazamos con un tag.**

---

## 11. Lista de cambios por prioridad

### P0 — Sin esto, nada de lo demás importa

1. **Escribir el texto pedagógico de los 10 ejercicios de torre** (`principle`, `title`, `playerPrompt`,
   `learningObjective`). Es *el* cambio de mayor impacto: hoy el jugador no lee absolutamente nada.
   Barato, no toca el motor.
2. **Quitar los tags `capture` falsos** de `rook-4`, `rook-5`, `rook-9`. Mienten.
3. **Cablear el texto a la UI**: llenar el mapa de descripciones para que
   `resolveExerciseDescription` **no caiga nunca** al fallback `Exercise {n}`.

### P1 — La curva y la verdad del dato

4. **Reordenar** según §5 (`rook-9` sube al 6.º puesto; `rook-8` baja al 8.º; `rook-7` cierra).
   ⚠️ El progreso está keyed **por `id`, no por posición** (`types.ts:96-102`), así que **reordenar es
   seguro**: no rompe el progreso de nadie.
5. **Recortar los obstáculos decorativos** de `rook-6` (21 → ~6) y `rook-7` (14 → ~8). La dificultad
   debe venir de la decisión.
6. **Reemplazar `rook-5`** (duplicado) por el nuevo *"The rook is not a bishop"*, y **ajustar `rook-3`**
   a un movimiento de una casilla (temario 4).
7. **Añadir el linter de contenido** a `import-puzzles` (§7). **Es el único cambio que impide que esta
   auditoría haya que volver a hacerla.**

### P2 — Lo visual y el minijuego

8. **Cambiar el sprite de los bloqueadores**: que una pieza propia **parezca** propia, no un caballo
   enemigo incapturable. *(Regla del repo: pedir el arte en resolución correcta, nunca upscalear.)*
9. **`rook-lab-2` → reemplazar** (34 obstáculos, 1 solución: es un pasillo, no un puzzle).
10. **Construir el nivel 5 de Rook Rails** (*Two roads*), que es el que le da sentido al sistema de
    estrellas.

### P3 — Deuda de motor (habilita 3 principios + 1 nivel)

11. **Obstáculo `capturable`**: detiene el rayo **pero acepta el aterrizaje**. Toca `rules/rook.ts` y
    `board.ts`, y abre el bloque de captura del temario (puntos 6, 7, 8) y el nivel 4 de *Rook Rails*.
    **Es la única pieza de este documento que necesita trabajo de motor real.**

---

## 12. Preguntas abiertas para el founder

1. **¿La captura de torre entra o no?** Es la decisión más grande. Sin ella, el temario de torre sale
   con 7 de 10 puntos y *Rook Rails* con 4 de 5 niveles — **lo cual es perfectamente enviable**. Con
   ella, hay trabajo de motor que además **beneficia a alfil y dama** (misma mecánica de rayo).
2. **¿10 ejercicios es el número correcto?** El temario completo pide ~13. Se puede: (a) apretar a 10 y
   diferir la captura, (b) ir a 13 con la captura incluida, o (c) partir en **Rook I (10)** y
   **Rook II (3, captura)** como contenido posterior.
3. **¿El bloqueador se vuelve arte nuevo o se recolorea la pieza existente?** Afecta al cuello de
   botella conocido, que es el arte.
