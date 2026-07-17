# Red Team Review — builder-kind-aware

**Date**: 2026-07-17
**Reviewer mindset**: hostile QA + senior engineer
**Spec bajo revisión**: `docs/specs/2026-07-17-builder-kind-aware.md`

---

## Findings

### P0 — Must address before implementation

- **[AC-2] El criterio "byte-idéntico" es imposible de cumplir y va a fallar por una razón
  que no es el bug.** `writeBaselineRecord` escribe `JSON.stringify(next, null, 2)` sobre el
  array ENTERO, y `upsertRecord` reemplaza el record **con el orden de claves del objeto que
  le llega** — que es el orden en que el builder arma el POST (`...editExtras` primero,
  después los explícitos), NO el del archivo. Un round-trip fiel en CONTENIDO produce un
  diff en ORDEN DE CLAVES. **Why blocking:** AC-2 se escribió como el criterio que prueba la
  raíz, y va a dar rojo con el fix correcto puesto. Un criterio que falla cuando el código
  está bien entrena a ignorarlo. Reformular a igualdad **semántica** (deep-equal del record
  parseado), y si se quiere estabilidad de diff en git, que sea un criterio aparte y
  explícito (serializar con orden de claves canónico).

- **[Etapa 3 / AC-1] La etapa 1 mide, la etapa 3 arregla — y entre las dos el rojo de AC-1
  queda "esperado" durante dos etapas.** El spec dice "el rojo ES el dato" y después lo deja
  vivo hasta la etapa 3. **Why blocking:** un test rojo que se tolera N etapas es un test que
  alguien va a marcar `.skip` y nadie va a volver a mirar; y contamina el gate "suite verde
  antes del merge local" (CLAUDE.md), que es el único gate del proyecto. Decidir YA: o la
  etapa 1 escribe el test como **snapshot de la pérdida** (verde, documentando el bug real:
  "hoy la torre se convierte en peón") y la etapa 3 lo invierte; o las etapas 1 y 3 se
  fusionan. No dejar rojo colgado entre merges.

- **[Non-goal vs Etapa 7] "No tocar los tableros que shippean más que consumirlos" choca de
  frente con Preview.** `SafePathBoard` tiene `onBandChange`, `onCaught`, `resetKey`, y una
  máquina de fases (`playing|caught|done`) cuyo host decide el castigo. El builder **es un
  host nuevo** de un componente de producción. **Why blocking:** el spec no dice qué hace el
  builder cuando el borrador **se pierde** en Preview (`onCaught`). Si no lo define, quien
  implemente va a cablear algo — probablemente el overlay de TRY AGAIN del juego, o nada — y
  cualquiera de las dos es una decisión de producto tomada por accidente en una PR de
  herramienta. Y si `SafePathBoard` necesita UN prop nuevo para servir de preview, el
  non-goal ya se rompió y hay que decirlo antes, no después.

- **[Edge cases] "Preview deshabilitado si el borrador es inválido" es circular en los kinds
  que más lo necesitan.** Para `usesOwnSolver`, el spec (behavior 6) dice que el validador NO
  corre el BFS genérico — o sea que la validez del borrador de un queens/safe-path la
  determina **su propio solver**, que hoy vive dentro de `buildCatalog`, no en
  `validateBuilder`. **Why blocking:** sin definir de dónde sale "válido" para esos kinds,
  Preview o queda siempre habilitado (y monta tableros rotos, justo lo que el edge case
  quería evitar) o siempre deshabilitado. El spec necesita nombrar el solver por kind y
  dónde vive, o aceptar que `validateBuilder` llame a `buildCatalog` para uno solo.

### P1 — Should address

- **[Contracts] `deriveStateFromFen(fen, piece, mover, kind)` recibe `kind` pero el spec no
  dice qué cambia con él.** Presumiblemente: en un kind con enemigos, los negros → `enemies`;
  en un laberinto, los negros → ¿error? ¿muros? Hoy la firma sin `kind` mapea "blacks →
  captures" siempre y el peón es el único que las soporta. **Risk:** el parámetro entra
  como decoración y la ramificación real se improvisa en el call site.

- **[Compat] Retirar `ContentKind` no es gratis y el spec lo trata como pregunta abierta a
  resolver "en la etapa 2".** `ContentKind` lo importan al menos `baseline-write.ts`,
  `api/dev/publish/route.ts` y `api/admin/content` (el overlay). El de admin/content valida
  **input de red con token**. **Risk:** un rename que cruza un borde de seguridad se mete de
  contrabando en una PR de herramienta dev. Medir el blast radius ANTES de la etapa 2, y si
  toca la ruta admin, sacarlo a su propio commit.

- **[AC-2/AC-7] Los tests que escriben van contra `content/*.json` REAL.** `baseline-write.ts`
  resuelve rutas desde `process.cwd()` (constantes de módulo, no inyectables) y advierte
  "NEVER import from a non-dev surface: it touches the working tree". AC-2 dice "tmpdir,
  jamás el working tree" pero **el módulo no acepta un root**. **Risk:** o el test corrompe
  el contenido real del repo al correr la suite, o hay que refactorizar las constantes a
  parámetros — que es trabajo real no listado en ninguna etapa.

- **[AC-7] El E2E de queens choca con la caché del catálogo.** Regenerar
  `puzzles.generated.ts` NO invalida el `unstable_cache` tag "content"
  (`project_catalog_cache_staleness`): un e2e puede dar **verde falso** leyendo el catálogo
  viejo. **Risk:** el test que prueba el fix principal es justo el más propenso a mentir.

- **[Behavior 8] `diagonal-run` con muro no-caballo: el spec dice "warning", `catalog.ts:212`
  lo empuja a `errors`.** Divergencia entre el validador en vivo y el que gatea el guardado
  → el builder te deja pintar algo que Save rechaza. **Risk:** la clase exacta de bug que
  este spec existe para matar, reintroducida en el validador nuevo.

- **[Etapa 8] Safe Path es la última etapa y la única que necesita UI nueva de verdad.** Es
  también la que motivó todo el rediseño del lienzo. **Risk:** las etapas 1-7 mergean, el
  founder pasa a otro frente, y safe-path queda `editable:false` para siempre — con el
  agravante de que ahora hay una tabla `KIND_CAPABILITY` que hace que eso se vea intencional
  en vez de pendiente.

### P2 — Nice to clarify

- **[Open question] "5 piezas sin rey"** — `attack-map` tiene un `KING_DELTAS`/rama de rey
  (el módulo describe el caso "king: filters blockers out"). Verificar si un rey negro
  enemigo ya computa bien antes de excluirlo por spec; puede ser gratis.
- **[Behavior 2] "byte-idéntico"** también depende del `+ "\n"` final y de `null, 2`. Si se
  mantiene el criterio (ver P0), fijarlo explícito.
- **[Non-goal]** "Desktop: se usa donde se usa" es simpático pero no es un criterio. El
  builder se usa en desktop; si el lienzo Paint/Preview asume 390px va a doler.
- **[KIND_CAPABILITY]** `showsThreatMap` y `enemyPieces:[]` son derivables uno del otro
  (`isThreatKind` ya existe). Dos campos que codifican el mismo hecho pueden divergir
  → `feedback_same_shape_number_wrong_meaning`. Derivar uno.

---

## Categories audited

### Contract gaps
`BuilderState.kind` como `PuzzleKind` es correcto y la restricción de diseño (gate en UI, no
en el modelo) está bien fijada — es lo mejor del spec. Pero `KindCapability` mezcla hechos
derivables con decisiones (`editable`), y `AuthoredEnemy` vs `TypedEnemy` deja la conversión
sin dueño nombrado (dice "vive en toPuzzleInput"; `deriveStateFromFen` necesita la inversa y
nadie la nombra).

### Behavioral ambiguity
"Preview monta el tablero real" no dice **quién es el host** de sus callbacks (P0). "El
último gana" para pinceles superpuestos está bien. Behavior 12 ("dice por qué") no define el
texto ni dónde vive (¿`editorial.ts`? la UI del builder es dev, no i18n).

### Hidden assumptions
- Que `buildCatalog` es la única fuente de verdad de validez — pero `validateBuilder` es la
  que gatea Save. **Dos validadores, y el spec solo arregla uno.** Ver P0.
- Que los 15 records reales son el universo. Un record escrito a mano con un kind nuevo ya
  está contemplado (edge case), bien.
- Que `deriveStateFromFen` es extraíble sin arrastrar estado de React. Probable, no verificado.

### Backward compatibility
`?? "labyrinth"` para los 19 laberintos sin kind: correcto y explícito (AC-10). El rename de
`ContentKind` es el único riesgo real (P1).

### Security & data
Superficie dev, `NODE_ENV`/`VERCEL_ENV` gateada, sin PII. **Salvo** el roce con
`api/admin/content` vía el rename (P1). El overlay escribe `draft`, que no llega al jugador
sin Promote — bien. Ningún finding de secretos.

### Test coverage gaps
AC-1 es el mejor criterio del spec (mide antes de afirmar, y nombra la falla esperada).
Faltan: un test del edge case "kind desconocido no se abre"; un test de que Preview NO monta
con borrador inválido; y **ningún AC cubre behavior 9** (el overlay de amenazas pinta lo que
`attackedSquares` dice) — que es la mitad del valor del lienzo.

### Operational readiness
Rollback trivial: es dev-only y el contenido está en git. Sin logging nuevo necesario. El
gate real (suite verde + tsc antes del merge local) está en AC-9. Bien.

---

## Verdict

**NEEDS REVISION** — 4 P0.

Los P0 no tumban el diseño: la tesis central (el builder es la última capa que no sabe; la
capa de juego ya sabe) se sostiene y es la parte fuerte. Lo que falla es el **plan de
verificación** — AC-2 falla con el código correcto, AC-1 deja rojo entre merges, y el
validador de Save (`buildCatalog`) queda fuera del spec aunque es el que decide.

A arreglar en el spec antes de `/tdd`:

1. AC-2 → igualdad semántica; el orden de claves es criterio aparte si se quiere.
2. Fusionar etapas 1+3, o volver AC-1 un snapshot de la pérdida que la 3 invierte.
3. Definir el contrato de host de Preview (`onCaught`/`onBandChange`) y admitir si toca los
   tableros de producción.
4. Nombrar de dónde sale "válido" para los kinds con solver propio, y reconciliar los DOS
   validadores (`validateBuilder` vs `buildCatalog`).

Y antes de la etapa 2, medir el blast radius de retirar `ContentKind` (P1) — si toca
`api/admin/content`, va en su propio commit.

---

# Resolución — spec v2 (2026-07-17)

Los 4 P0 se cerraron en `2026-07-17-builder-kind-aware.md` (Status: revised).

| P0 | Resolución |
|----|-----------|
| **AC-2 byte-idéntico** | → **deep-equal semántico**. La estabilidad byte pasa a Non-goal explícito: `upsertRecord` reemplaza con el orden de claves del POST, así que un round-trip fiel en contenido difiere en orden. El criterio viejo daba rojo **con el código correcto**. |
| **Rojo colgado 2 etapas** | → **etapas 1 y 3 fusionadas** ("Medir + enemigo tipado"). El rojo de AC-1 nace y muere dentro de la etapa; ninguna mergea con la suite en rojo. |
| **Host de Preview sin contrato** | → **behavior 13**, explícito: `onCaught` → línea de estado + Reset; **nunca** TRY AGAIN, escudos ni rachas. `onBandChange` al chrome del builder. Y: si un tablero necesita un prop nuevo, **el non-goal se rompió** → commit propio, nombrado, antes de la etapa que lo pide. |
| **Dos validadores** | → **uno**. `validateBuilder` **delega en `buildCatalog`** sobre un array de un record. La validación en vivo ES la del guardado por construcción; AC-5 es un test de equivalencia que impide que vuelvan a divergir. Cierra de paso el P1 de diagonal-run (warning vs error) sin código propio. |

**P1 medidos / absorbidos:**

- **Blast radius de `ContentKind`** — medido, y distinto de lo que este review supuso.
  Hay **dos declaraciones separadas** de la misma forma: `overlay-types.ts:12` y
  `session-quota.ts:48`. **No es un import**: renombrar la del overlay **no toca el camino de
  jugador**. Quedan 6 archivos, 2 de ellos rutas admin → **etapa 2a, commit propio** (por el
  borde de seguridad, no por alcance). Unificar los dos queda fuera de alcance, anotado.
- **`root` no inyectable en `baseline-write`** → agregado al contrato; sin esto AC-2 escribía
  sobre el working tree real.
- **Caché del catálogo en AC-7** → advertencia explícita (limpiar `.next`).
- **`KIND_CAPABILITY` con campos derivables** → `showsThreatMap`/`needsGoal`/`needsPromoteTo`
  eliminados de la tabla; se derivan de `isThreatKind`/`isTargetlessKind`/`kind`.
- **Riesgo de etapa 7 (safe-path last)** → **aceptado y mitigado**: `editable:false` lleva
  comentario apuntando al spec, y la etapa entra al backlog al mergear la 6.

**Nuevo, no visto por este review** (input del founder 2026-07-17 + medición):
la **regla de entornos**. Hoy está al revés de lo pedido: las páginas `/dev/*` gatean por
`NODE_ENV` → **404ean en preview**, mientras `/api/dev/publish:76` gatea por `VERCEL_ENV` →
**el endpoint que escribe está vivo en preview y su UI no**. Spec v2 §Regla de entornos +
etapa 0. Y el límite físico: **Save no puede andar en preview** (fs read-only en Vercel) →
se muestra deshabilitado con motivo, no tira 500.

## Verdict v2

**READY for /tdd.** Ninguna revisión abre un P0 nuevo. Las dos Open questions restantes
(piezas del pincel; costo de delegar en `buildCatalog`) son **medibles dentro de su etapa** y
ninguna bloquea la etapa 0.
