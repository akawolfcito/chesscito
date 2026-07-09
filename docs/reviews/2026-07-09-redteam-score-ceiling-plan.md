# Red-team del plan "techo por pieza desde el catálogo merged" (2026-07-09)

Auto-crítica del plan que propuse para cerrar la clase de bug del cap de `/api/sign-score`
cuando los ejercicios se agreguen desde el builder (db-content overlay).

**Veredicto: matar los pasos 1 y 2. Conservar el 3. Reemplazar por un invariante explícito.**

---

## Hallazgo 1 (fatal) — el cap no es una defensa anti-cheat, y yo dije que sí

Escribí en `score.ts` y en el mensaje del commit `6b93469`:

> "El cap sigue siendo una cota anti-cheat real: rechaza cualquier score que el catálogo no
> pueda producir."

Es falso. **Nada ata el `score` del body al progreso real del jugador.** El progreso vive en
`localStorage`; el servidor no lo ve. Un tramposo hace POST a `/api/sign-score` con
`{levelId: 1, score: 3000}` sobre una pieza que jamás tocó, y el route lo firma. Siempre pudo.

Entonces, ¿qué compra estrechar el techo de 3000 global a "3000 para torre, 1500 para peón"?
Impide que el tramposo pida 3300 en vez de 3000. Nada. El bound solo sirve como validación de
entrada (evitar valores absurdos antes de `signTypedData`), y para eso una cota generosa alcanza.

Corolario: **toda la precisión que perseguía el plan no defiende nada.** Y la corrección de la
doc/commit es obligatoria: el texto actual le miente al próximo lector.

## Hallazgo 2 (fatal) — mi argumento de "ambos lados degradan juntos" es falso

Se lo vendí al founder como la razón por la que el techo estricto era seguro:

> "Si el overlay se cae, el cliente también sirve baseline, y `calculateTotalStarsFromIdMap`
> descarta los ids desconocidos. Los dos lados degradan juntos."

Correlacionado ≠ sincronizado. Son **dos requests distintos**:

- `page.tsx:89` resuelve el catálogo al renderizar.
- `/api/sign-score` lo resolvería al guardar, minutos después.
- `getMergedCatalog` es `unstable_cache` con `revalidate: 60s` (`merged-catalog.ts:237`) y el
  fetch del overlay tiene `OVERLAY_TIMEOUT_MS = 2000` (`:39`), con fallback silencioso a baseline.

O sea: el cliente puede tener el catálogo con overlay en mano (11 ejercicios → 3300 pts) mientras
el route, un minuto más tarde o durante un timeout de 2s, resuelve baseline y topa en 3000. **400.**

Es exactamente el bug que estamos cerrando, reintroducido en versión rara e intermitente. Y "raro"
aquí es *peor*, no mejor: el bug original lo cazó un smoke porque era determinista. Este no
aparecería en ningún smoke; aparecería en el teléfono de un jugador, una vez, sin repro.

## Hallazgo 3 (serio) — mete Supabase en la ruta de firma, a cambio de nada

Hoy `/api/sign-score` depende solo de Upstash (rate limit). El plan le agregaría una lectura del
catálogo respaldada por Supabase, con timeout de 2s, en el camino crítico de una operación de
firma. Un hipo del content-DB pasaría a rechazar guardados on-chain.

Se paga blast radius y latencia en un endpoint sensible, para comprar el bound del Hallazgo 1,
que no defiende nada.

---

## Lo que sí sobrevive

**Paso 3 (arreglar `exercises-screen.tsx:828`) se mantiene.** `getMaxPossibleStars(selectedPiece)`
ignora el catálogo merged mientras `totalStars` lo usa. Con un ejercicio agregado por overlay, la
UI mostraría "33/30". Es un bug de display real (`maxPossibleStars` solo alimenta un prop del
mission sheet, `:2312`, sin gates), barato y sin acoplamiento nuevo.

---

## Contra-propuesta

Un invariante de producto explícito, generoso, y testeado — sin DB en la ruta de firma:

```
MAX_EXERCISES_PER_PIECE = 30        // decisión de producto, no un dato derivado
ceiling = MAX_EXERCISES_PER_PIECE * 3 * POINTS_PER_STAR   // 9000
```

- El route sigue **puro y síncrono**. Cero deps nuevas.
- Agregar ejercicios por el builder O por `content/exercises.json` funciona sin tocar nada,
  hasta 30 por pieza.
- Un test afirma que **ningún pool del baseline excede el invariante**. Si algún día lo excedes,
  CI falla y te obliga a subir la constante a conciencia. El número nunca se queda viejo en
  silencio, que es la falla original.
- Pools desiguales: irrelevante, el techo es uno solo y holgado.

Costo honesto: el bound queda flojo. Dado el Hallazgo 1, flojo no cuesta nada.

## Si de verdad quieres anti-cheat

No es un cap. Es progreso verificable en el servidor (Supabase), y el score se deriva ahí, no se
recibe del body. Es una feature, no un número. Fuera de alcance hoy; vale un backlog item.

## Acciones

1. ✅ Claim anti-cheat corregido en `score.ts` (el commit `6b93469` queda impreciso en el
   historial; el código y la doc ya no lo repiten).
2. ✅ Contra-propuesta implementada con TDD: `MAX_EXERCISES_PER_PIECE = 30` → techo 9000,
   route puro y síncrono. El test guardián falla si un pool baseline supera el invariante.
3. ✅ `exercises-screen.tsx` pasa el catálogo merged a `getMaxPossibleStars`. Sin seam
   aislable (no hay harness de `ExercisesScreen`): cubierto por tsc + los tests de catálogo
   del adapter, no por un test propio. Si se quiere cobertura, hay que extraer el seam.
4. ⏳ Backlog: progreso verificable server-side (el único anti-cheat real).

Suite 4728/4728, tsc limpio.
