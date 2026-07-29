# Handoff — maestría rota + divergencia del overlay de celebración

**Fecha:** 2026-07-29 (noche, segunda sesión)
**Branch:** `main` local, 3 commits **SIN PUSHEAR** (`7cebb26a`, `50e98221`, `50898ba8`)
**Suite:** 6582 passing / 558 files, **EXIT=0**. `tsc` limpio.
**Base:** `17036af3` (cierre del rediseño de slides del landing)

---

## Qué se arregló

Los dos bugs que el handoff anterior dejó abiertos sin agenda. Los dos resultaron
ser el mismo patrón: **una cosa definida en dos lugares, y los lugares se
separaron.**

### 1. `fix(training): project the Special Training lane once, for both surfaces` — `7cebb26a`

El bug reportado como "adicional" era el que hacía falta arreglar primero.

`exercises-screen.tsx` proyectaba los juegos firma sobre los laberintos crudos
**inline**, mientras `use-hub-data.ts:374` construía sus paths directo con
`LABYRINTHS`. Las dos superficies no coincidían en **qué contenía el carril**: el
hub razonaba sobre nodos `queen-lab-*` que la pantalla ya había reemplazado por
`queens-*`, así que Start Focus recomendaba niveles que no están en el carril.

**Fix:** `lib/training/special-training-lane.ts`, función pura, llamada desde los
dos. Incluye `coverageLaneIds` / `starlessLaneIds` — que el hub **no estaba
pasando en absoluto**, así que sus estrellas de carril salían por el grader
equivocado. La precedencia entre pools ahora es una lista explícita, no una
cadena `if/else`.

### 2. `fix(training): a crown is earned, never revoked by an id change` — `50e98221`

**Decisión del founder:** mapa de ids retirados, con la maestría preservada.

`lib/training/retired-lane.ts` — registro **congelado y literal** de qué tenía cada
carril antes del reemplazo, más un check todo-o-nada. Se consulta en **exactamente
un lugar**: el nodo de maestría (`path.ts`).

Condiciones que impone el módulo, todas pedidas explícitamente:

- Los niveles retirados **no** se muestran, desbloquean, recomiendan ni navegan.
- **No** dan estrellas ni cuentan para completion.
- Un carril retirado **parcial** no es maestría. Una **mezcla** de ids viejos y
  nuevos incompleta tampoco.
- Una pieza sin carril retirado (la torre) devuelve `false`, **nunca**
  vacuously-true: "sin evidencia" no puede ser argumento para una corona.
- El guest (`badgeClaimed: false`) sigue sin llegar a `complete`. La corona sigue
  detrás del claim on-chain.

**El mapa es transcrito, no derivado de `LABYRINTHS`.** El punto es qué shippeó
*entonces*; derivarlo lo haría driftear en cuanto el builder edite contenido. Se
puede borrar cuando ya no queden jugadores con bests pre-juegos-firma.

⚠️ **Corrección al handoff anterior**: los labs del peón son `pawn-lab-1, 3, 4, 5`.
**No existe `pawn-lab-2`** → [[feedback_exercise_ids_are_not_sequential]] otra vez.

### 3. `refactor(ui): extract CelebrationStack so the Daily stops drifting` — `50898ba8`

El Daily tenía una **copia congelada** del bloque de ejercicios, anterior a tus dos
correcciones del 2026-07-29:

| | ejercicios (aprobado) | Daily (lo que shippeaba) |
|---|---|---|
| margen del headline | ninguno | negativo |
| `overlay-lesson` | siempre montado | **ausente** |
| lobo / halo | `13.5rem` / `12.5rem` | `20rem` / `18rem` |

O sea: **la colisión del arco que arreglaste en ejercicios seguía viva en el
Daily**, y encima sin la caja de dos líneas contra la que el headline se posiciona.

`components/ui/celebration-stack.tsx` es dueño de la geometría. Los callers pasan
contenido y efectos, **nunca medidas**.

---

## Dos cosas que cambiaron y conviene mirar con el ojo

1. **El overlay del Daily ahora se ve distinto** — lobo más chico, headline sin
   margen negativo, caja de lección reservada. Es la geometría que ya aprobaste en
   ejercicios, pero **nadie la vio renderizada en el Daily**. Vale un vistazo en
   390px, en ES (que es donde el headline es más largo).

2. **El avatar de ejercicios pasó de `/art/avatar-*` crudo a los slots de tema.**
   Los dos slots (`exercises.avatar-fun`, `exercises.avatar-try-again`) tienen como
   `default` exactamente esos archivos → el tema por defecto es idéntico pixel a
   pixel. El efecto secundario es bueno: un tema PRO ahora **llega a ese overlay**,
   cosa que no podía mientras la superficie salteaba el resolver. **No se agregaron
   slots nuevos**, así que los 3 baselines pineados + la unión de `tsc` quedan
   intactos. El `theme-runtime-inventory.json` lo regeneró la suite sola (esperado).

---

## Guardián nuevo, y por qué no es un test cualquiera

`celebration-stack.test.tsx` incluye un **source guard**: lee los dos consumidores
y falla si alguno vuelve a declarar las medidas inline.

Existe porque un consumidor que las redeclara **igual renderiza y igual pasa todos
los tests de comportamiento** — que es exactamente cómo esto divergió la primera
vez. Nada observable lo delata.

⚠️ **Ojo con la prosa**: el guard hace match sobre el archivo entero, así que un
**comentario** que deletree `-mb-6` lo rompe. Ya me pasó al escribirlo. Los
comentarios de esos dos archivos describen las clases retiradas en palabras, a
propósito. Mismo patrón que
[[feedback_grep_audit_misses_composed_paths]], al revés.

---

## Estado y próximos pasos

### Sin agenda propia
Los dos bugs están cerrados. Nada de esto bloquea nada.

### Lo que sigue abierto de antes
1. **Theme Builder** — sigue siendo el frente grande elegido. Arranca con `/spec`.
2. **Slice 2 (ventana weekly en Leaders)** — desbloqueada (`score_attempts` vive en
   prod), pero el spec de 2026-07-27 está en NEEDS REVISION: hay que reescribirlo
   sobre `score_attempts`.
3. **P2**: `offerBenefitTrainings` sin traducir en ES.
4. **Limpieza diferida del landing**: arte huérfano (`bg-slides`, `bg-slides-web`,
   los cuatro `avatar-*` del landing, títulos viejos).
5. **`/classic` sigue sin ningún enlace en la UI** (aceptado).

### Open questions
- ¿El carril retirado debería also cubrir el caso de un jugador que completó
  **parte** del viejo y **parte** del nuevo hasta sumar un carril entero? Hoy no
  (decisión explícita: todo-o-nada por carril). Es la lectura conservadora; si
  aparece un reporte real, se revisa.
- El push de `main` es tuyo — los 3 commits están locales.
