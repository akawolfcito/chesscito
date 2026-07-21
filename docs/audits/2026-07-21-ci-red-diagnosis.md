# CI en rojo — diagnóstico (2026-07-21)

Run: [29814478786](https://github.com/akawolfcito/chesscito/actions/runs/29814478786) · HEAD `16273345`
Reproducido local: **sí** (mismos fallos, salvo `asset-triplet`, ver §4).

**Por qué la app funciona igual:** ninguno de estos fallos es un bug de runtime.
Cuatro de los cinco son *pins de test* que quedaron viejos frente a cambios de
contenido/registro que vos hiciste a propósito. El quinto (§5) sí es señal real,
pero es pedagógica, no funcional: el juego corre, la curva de dificultad cambió.

**Antigüedad:** el workflow `Tests` viene en rojo en `main` desde al menos el
**2026-07-19** (24 runs consecutivos en `failure`). No lo rompió el deploy de hoy.

---

## 1. Type-check — `use-coach-analysis.test.ts:139` ✅ trivial

```
TS2345: Type 'string' is not assignable to type '`0x${string}`'
```

El fixture `makeInput` (línea 123) declara `walletAddress: "0x1111…"` sin `as const`
ni anotación, así que TS lo ensancha a `string`. `CoachAnalysisInput` pide
`` `0x${string}` ``. **Es solo el fixture** — el hook y el tipo están bien.

**Fix:** anotar el literal. 1 línea, sin riesgo.

---

## 2. `responsive-asset-profiles.test.ts` — pin viejo del registry ✅ actualizar

```
expected '/art/theme-builder/candy-forest/brand/title/pro'
      to be '/art/title-chesscito'
```

El commit **`b6a6e507` — "feat: update theme assets and registry for Candy Forest
theme"** (2026-07-20) repuntó `brand.title` variante `pro` a la ruta del
theme-builder (`theme-registry.ts:456`). El test se llama *"does not change
registry paths"*: era un pin defensivo de un refactor pasado, y el cambio de ruta
fue **intencional** (es exactamente lo que hace el theme-builder al guardar).

**Fix:** actualizar el valor esperado. El resto del test (variants, clasificación
de slot) sigue siendo el guardrail útil y pasa.

---

## 3. `hub-scaffold-client.test.tsx` ×2 — el estado inicial de PRO cambió ⚠️ confirmar

```
Unable to find a label with the text of: /PRO inactive: tap to learn more/
```

El badge **sí se renderiza**, pero en el primer paint sale con
`data-pro-status="unknown"` (no `"inactive"`), así que `hub-scaffold.tsx:167-173`
elige `proUnavailableAriaLabel` en lugar de `proInactiveAriaLabel`.

Esto es un **cambio de comportamiento real**: antes el badge asumía "inactive"
antes de saber; ahora arranca en "unknown" hasta que el transporte responde.
Como default es el correcto (nunca afirmar un estado de suscripción que no
verificaste), pero los dos tests estaban escritos contra el default viejo.

**Fix propuesto:** los tests apuntan a `proUnavailableAriaLabel` para el primer
paint, y se agrega uno que verifique la transición a `inactive` tras resolver.

---

## 4. `asset-triplet.test.ts` — lento, no roto 🟡 flake

```
Error: Test timed out in 5000ms
 ❯ asset-triplet.test.ts:130  "rolls back public files and the prior family undo…"
```

**Local pasa** (7/7). Pero el archivo entero corre 9.84s de tests para 7 casos, y
ese caso concreto está pegado al techo de 5000ms. El runner de GitHub es más lento
que tu máquina → cruza el límite. Es un test de I/O real (escribe y revierte
archivos en `public/`), no un test de lógica pura.

**Fix:** timeout explícito en ese caso. Es honesto: el test *hace* trabajo de disco.

---

## 5. `rook-pedagogy` ×2 + `bishop-pedagogy` ×1 — ⚠️ SEÑAL REAL, decisión tuya

Esto **no** lo toco sin que decidas. Los boards se regeneraron en la tanda de
commits `feat(exercises): update {king,queen,pawn,knight,bishop} exercises with new
optimal moves and positions`, y `rook-6` pasó de `optimalMoves: 3` a `6`
(`puzzles.generated.ts:311`).

El test se llama **"ramps difficulty without a spike"** y su trabajo es exactamente
cachar esto:

| pieza  | esperado (curva pineada)  | real hoy                    |
|--------|---------------------------|-----------------------------|
| rook   | `1,1,1,2,2,3,4,4,3,4`     | `1,1,1,2,2,**5,4,5,6,9**`   |
| bishop | `1,1,1,2,2,3,3,4,5`       | `1,1,1,2,2,**5,4,8,7**`     |

Dos problemas distintos en el dato nuevo:

1. **El salto.** El ejercicio 6 pasa de 2 movimientos óptimos a 5 (rook) y a 5
   (bishop). Eso es el "spike" literal que el test existe para prohibir.
2. **La no-monotonía.** `5 → 4 → 5 → 6 → 9` (rook) y `5 → 4 → 8 → 7` (bishop):
   la curva sube y baja. El jugador no percibe progresión, percibe ruido.

Y el tercer fallo, `"keeps the trimmed exercises' decision intact (A5)"`, pinea la
*decisión* de diseño de `rook-6`/`rook-7` (mismo óptimo, mismas rutas óptimas,
mismo ancho de primera jugada que los boards que reemplazaron). Con `optimalMoves`
en 6, ese board ya no es la misma lección que se aceptó.

**Re-pinear los números haría verde el CI y borraría el guardrail.** Es la única
opción que no recomiendo.

### Opciones

- **(A) Rediseñar los boards** de rook-6/7 y bishop-6..9 para respetar la curva.
  Manual, a mano — las métricas son filtro, no generador. Es lo correcto, y es el
  trabajo más caro.
- **(B) Reordenar el currículum.** Los boards nuevos quizá estén bien, solo mal
  ordenados. Ordenar por `optimalMoves` ascendente puede recuperar la monotonía
  sin tocar ningún board. Barato — vale medirlo antes de decidir.
- **(C) Aceptar la curva nueva y re-pinear.** Verde ya, guardrail muerto.
  Solo si decidís explícitamente que la curva vieja ya no es la meta.

---

## Plan de ejecución propuesto

Dos commits atómicos, separados a propósito:

1. `fix(ci): unstick the type-check and the stale test pins` → §1, §2, §3, §4.
   Riesgo bajo, deja el CI mostrando **solo** el fallo pedagógico.
2. Lo de §5, según lo que decidas.

Después del paso 1, el CI queda rojo *a propósito* y por una sola razón legítima.
Eso ya es mejor que rojo por cinco razones mezcladas.
