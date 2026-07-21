# Handoff — sacar los pins de contenido del camino del builder (2026-07-21)

## Estado

**CI verde.** `main` estuvo rojo desde el **2026-07-19** (≥24 runs seguidos).
Suite: **5459 passing / 491 files**, `tsc --noEmit` limpio.

> El baseline viejo en memoria (5003 / 420 files) quedó obsoleto — actualizar.

### Commits

| SHA | Qué |
|---|---|
| `e8b2dc4` | `fix(ci)` — type-check + 3 pins viejos + 1 test lento |
| `5fa3453` | `feat(lint)` — la curva de dificultad vive en `lint.ts` como warning |
| `1194750` | `fix(builder)` — los warnings del Save dejan de tirarse a la basura |

---

## Qué se hizo

### 1. Los cinco fallos del CI, separados por causa

Estaban mezclados, y cinco razones distintas en rojo se leen igual que ninguna.

- **Type-check** — el fixture del coach ensanchaba los literales de wallet a
  `string`. Anotados los dos (el segundo solo apareció al arreglar el primero).
- **`asset-triplet`** — no roto, **lento**: 3.2s locales, 64% del default de 5s
  de vitest, y el runner lo cruzó. `describe` con budget explícito de 20s.
- **Badge PRO ×2** — los tests afirmaban `"inactive"` para un guest, que el hook
  **nunca** devuelve: `useIsProActive` corta en `if (!wallet)` con
  `status: "unknown"`. Guest y connected-sin-PRO son dos estados → ahora dos
  tests, más uno que fija que el badge sigue siendo tappable para un guest.
- **`responsive-asset-profiles`** — pin de rutas literales bajo el nombre
  *"does not change registry paths"*. Garantía de un PR, muerta desde que el
  theme-builder repunta slots (`b6a6e507`). Ahora verifica que cada slot
  responsive resuelva a **algo** real en ambas variantes.

### 2. La curva de dificultad se mudó a `lint.ts`

`lintPieceSequence()` — dos reglas, **solo warnings** (decisión del founder):
la curva baja, o salta más de 2 movimientos. Corre por pieza curada después del
sort, porque la curva solo existe una vez que el bucket está en orden.

Los tests de la regla usan **secuencias inventadas**, nunca `EXERCISES`. Lo que
los tests de pedagogía siguen exigiendo es la mitad que no puede romperse:
`lintPieceSequence` **nunca devuelve errors**. Si alguien los promueve a error,
un rebalanceo en el builder traba el repo, y ese test se pone rojo primero.

### 3. Los warnings del Save ya no se pierden

Investigando el "aparece un warning pero la pantalla se refresca" apareció algo
peor que un toast corto: **los warnings del Save nunca se renderizaban**.
`api/dev/publish` los manda desde siempre (`route.ts:144`); `PublishResultLike`
no declaraba el campo, así que `formatPublishResult` los tiraba. Lo que
alcanzabas a ver era el panel de validación **por board**, otro canal.

Ahora viajan como array propio, hay un panel que los retiene hasta el próximo
Save o hasta que los descartes a mano, y dice explícitamente que no bloquean.

---

## ⚠️ Lo que la prueba de fuego encontró — ABIERTO

El plan cerraba con: agregar contenido a mano y confirmar que la suite sobrevive.
**No sobrevive.**

Agregué **un** ejercicio de torre válido (board legítimo, pedagogía completa,
entrada en el mapa de descripciones):

> **33 tests fallan en 15 archivos.**

Los de pedagogía **sí** quedaron verdes — el trabajo de hoy funcionó. Pero el
conteo del catálogo está horneado en mucho más que esos dos archivos:

```
src/components/error/__tests__/primitive-boundary.test.tsx
src/components/exercises/__tests__/badge-sheet.test.tsx
src/components/exercises/__tests__/exercise-drawer.test.tsx
src/components/hub/__tests__/hub-scaffold-client.test.tsx
src/hooks/__tests__/use-exercise-progress-attempt-seq.test.ts
src/hooks/__tests__/use-exercise-progress-rotation-smoke.test.ts
src/hooks/__tests__/use-exercise-progress-rotation.test.ts
src/hooks/__tests__/use-exercise-progress-telemetry.test.ts
src/lib/exercises/__tests__/badge-progress.test.ts
src/lib/game/__tests__/progress-adapter.test.ts
src/lib/game/__tests__/rotation-integration.test.ts
src/lib/game/__tests__/rotation.test.ts
src/lib/hub/__tests__/derive-reward-tiles.test.ts
src/lib/progression/__tests__/migration-integration.test.tsx
src/lib/progression/__tests__/seed-milestones.test.ts
src/lib/training/__tests__/content-access.test.ts
```

Los síntomas ("count = 10", "the canonical 5", cruces de badge al 80%, seeds de
milestones, índices de rotación) dicen que el patrón es el mismo de hoy — **el
tamaño del pool congelado** — pero en la maquinaria de progresión, no en la de
pedagogía. Ahí el riesgo es distinto: la matemática de badges y rotación **sí**
depende del conteo real, así que no todos esos pins son ilegítimos. Hay que
separar caso por caso "esto deriva del pool" de "esto congeló el pool".

**No lo toqué.** Es un frente propio y merece su decisión.

### Un hallazgo que NO hay que arreglar

El primer intento de la prueba de fuego bajó `rook-6` de 6 a 2 movimientos.
Falló — correctamente: dos tests verifican `optimalMoves` contra el BFS del
board. Esa clase de pin **debe quedarse**. No congela contenido: verifica que el
número no le mienta al tablero, y el builder lo calcula, así que un Save real
nunca lo rompe.

---

## Reproducir la prueba de fuego

1. En `puzzles.generated.ts`, duplicar el objeto `rook-1` con id nuevo
   (`rook-fire-probe`), `principle` único y `optimalMoves` coherente con el board.
2. Agregar `"rook-fire-probe": "Fire probe"` a `GENERATED_EXERCISE_DESCRIPTIONS`.
3. `pnpm -C apps/web exec vitest run`
4. `git checkout -- apps/web/src/lib/game/generated/puzzles.generated.ts`

---

## Próximos pasos

1. **Decidir el frente de progresión** (los 15 archivos). Auditar cuáles derivan
   del pool y cuáles lo congelaron.
2. **Verificar el panel de warnings en el builder real.** El camino está testeado
   en unidad, pero nadie lo vio en pantalla todavía. Verificación visual tuya.
3. La UI del builder vive en `app/dev/labyrinth-builder/` — nombre viejo para el
   builder de juegos lúdicos. Renombrar cuando toque tocar esa carpeta.

## Preguntas abiertas

- El umbral de salto (`MAX_DIFFICULTY_STEP = 2`) es mi juicio, no tuyo. Cuando
  veas los warnings reales al guardar, decime si 2 avisa demasiado o muy poco.
- Un guest ve **"PRO status unavailable: try again shortly"**, copy de fallo de
  transporte para alguien que simplemente no conectó wallet. No lo cambié: es
  decisión editorial tuya, no un fix de CI.
