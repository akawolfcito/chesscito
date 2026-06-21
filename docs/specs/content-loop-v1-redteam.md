# Red Team Review — Content Loop v1

**Date**: 2026-06-21
**Reviewer mindset**: hostile QA + senior engineer

---

## Findings

### P0 — Debe resolverse antes de implementar

**[Hydration race]** `deriveContentLoopAction` es puro pero el caller en `hub-scaffold-client.tsx` necesita hidratar 3 fuentes de localStorage (`daily`, `welcome-package`, `progress:{piece}`) antes de llamarla. Si `NextStepCard` renderiza en SSR o antes de que los efectos corran, el variant puede ser incorrecto (ej. `continue-path` cuando debería ser `come-back-tomorrow`).
— **Por qué bloquea**: causa un flash de contenido incorrecto visible al usuario en cada carga. El patrón existe en `use-exercise-progress.ts` (`isHydrated` flag) pero el spec no lo codifica como requisito explícito en el caller.
— **Fix**: el spec debe requerir que `NextStepCard` solo renderice cuando los tres inputs estén hidratados. Agregar `isHydrated: boolean` a `ContentLoopInput` o que el componente reciba un `isHydrated` prop y retorne `null` hasta entonces.

**[Pieza primaria hardcodeada sin contrato]** El spec dice "primaryPiece = rook always" pero no define quién provee este valor ni dónde vive la constante. Si mañana el founder activa una segunda pieza en Lite, el caller necesita saber cuál es la "primaria".
— **Por qué bloquea**: sin un contrato explícito, el caller probablemente hardcodea `"rook"` inline, lo que crea deuda de mantenimiento inmediata.
— **Fix**: definir `LITE_PRIMARY_PIECE = "rook" as const` en `lib/hub/content-loop.ts` como parte del contrato del módulo, no como comentario del spec.

---

### P1 — Debería resolverse

**[labyrinthBests no está en ContentLoopInput]** El spec dice que `primaryPath` es un `TrainingNode[]` ya construido por el caller con `buildTrainingPath()`. Pero `buildTrainingPath` necesita `labyrinthBests: Record<string, number | null>`. El spec no especifica cómo el caller obtiene este valor en el Hub.
— **Riesgo si se ignora**: el caller puede pasar un path construido sin labyrinthBests (todos los laberintos quedan "locked"), causando que `labyrinth-ready` nunca dispare aunque el laberinto esté desbloqueado. Bug silencioso.
— **Fix**: el spec debe indicar explícitamente que el caller lee `chesscito:labyrinth-best:{piece}` y lo pasa a `buildTrainingPath`. Documentar la clave y estructura esperada.

**[`view-progress` variant tiene `destination: null` — ¿adónde va?]** El spec dice que `view-progress` es el fallback y no renderiza card (`NextStepCard` retorna null). Pero si el usuario llega aquí genuinamente (todo completo, no hay daily, no hay reward), no hay nada en pantalla. El Focus Passport estará en estado "semana completa" pero no hay ningún CTA.
— **Riesgo si se ignora**: UX dead-end si el usuario usa Lite con 7-day streak + everything complete un día en que ya hizo el daily.
— **Fix**: en lugar de renderizar `null`, considerar mostrar una micro-card "View your progress →" apuntando a `/trophies`. El spec dice que `view-progress` es el fallback pero luego dice "no renderiza" — esto es contradictorio. Resolver antes de implementar.

**[`improve-stars` variant puede ser engañoso si solo quedan 2★ y el usuario no puede mejorar]** La función `hasImprovableExercise` retorna true si algún ejercicio tiene stars < 3, pero no verifica si el usuario tiene la capacidad o retry disponibles para mejorar. En práctica esto no bloquea nada porque los ejercicios siempre son reintentables, pero el criterio exacto de "jugado pero < 3★" incluiría ejercicios con 2★ que el usuario intentó muchas veces y no puede mejorar.
— **Riesgo si se ignora**: frustración de usuario si siempre le sugerimos mejorar lo que ya intentó y no puede. En v1 es aceptable, pero el spec debería aclarar que esto es un known limitation.

**[`hasImprovableExercise` puede solapar con `labyrinth-ready` en casos de pieza parcialmente jugada]** Si el usuario tiene ejercicios con 1★ Y un laberinto desbloqueado, la prioridad del spec dice `labyrinth-ready` gana. Esto es correcto en teoría, pero en práctica el laberinto requiere el threshold de 6 estrellas, y el usuario con 1★ en algunos ejercicios puede ser que aún no lo haya desbloqueado. La lógica de `hasReadyLabyrinth` correctamente verifica `status === "available"`, así que esto está cubierto — pero no está documentado explícitamente en el spec.
— **Fix**: agregar una nota en §6 explicando por qué `labyrinth-ready` precede a `improve-stars` y que `hasReadyLabyrinth` ya checa el threshold via TrainingNode status.

**[Datos de Welcome Package en Hub Lite: ¿está montado el provider?]** `useWelcomePackage()` hook necesita estar disponible en el Hub Lite. El spec asume que el caller puede leer `welcomePackage.unlocked` pero no verifica si el provider/hook está montado en el layout del Hub Lite.
— **Riesgo**: si el Welcome Package provider no está en el layout de Hub Lite, el caller obtendrá `undefined` y romperá. Verificar antes de implementar consultando `hub-scaffold.tsx` o el layout de Lite.

---

### P2 — Bueno clarificar

**[`nextAvailablePiece` — quién lo calcula]** El spec dice que el caller pasa `nextAvailablePiece: string | null`. Pero no hay función existente que determine cuál es la siguiente pieza disponible en Lite. El caller tendrá que derivarlo. ¿Desde el `REWARD_TILE_ORDER` del hub? ¿Desde el catálogo de ejercicios? Esto no está especificado.

**[Copy: "Come back tomorrow" puede aparecer hoy si ya se hizo todo]** El mensaje "Come back tomorrow" tiene implicación temporal. Si el usuario lo ve a las 11pm y vuelve a las 11:30pm (siguiente día UTC), el Daily Focus pending ya habrá disparado. El wording es correcto pero puede confundir a usuarios con timezone ≠ UTC. Considerar "See you next time" como alternativa más neutral (P2, no bloqueante).

**[`NextStepCard` — ¿componente o sección inline en hub-scaffold?]** El spec recomienda un componente nuevo `next-step-card.tsx`. Dado que el Hub Lite tiene el `hub-scaffold-center-stack` y ya tiene `focus-passport.tsx`, la implementación podría ser simplemente una sección inline en el scaffold. La indirección de componente es buena para testabilidad pero el spec debería confirmar que el componente acepta `ContentLoopAction | null` como prop y renderiza nulo cuando es null (no cuando variant es `view-progress` — son dos condiciones distintas).

**[No hay telemetría de Content Loop]** El spec no menciona tracking de qué variant se muestra ni cuándo el usuario pulsa el CTA. En v1 es aceptable pero existe `track()` disponible. Si el founder quiere saber qué variante es más común, no habrá datos.

---

## Categorías auditadas

### Contract gaps

- **`ContentLoopInput.primaryPath`** asume que el caller pasará un `TrainingNode[]` válido. Si el caller pasa un array vacío (catálogo no cargado), la función debe manejar esto con gracia — el spec cubre este edge case en §10 pero no en el contrato TypeScript.
- **Nullable `destination`**: está documentado como "null = no navegar" pero el spec dice `come-back-tomorrow` y `view-progress` tienen `destination: null`. ¿El CTA se renderiza pero está deshabilitado? ¿No se renderiza? Inconsistencia.
- **No hay `error` o `loading` state**: si el caller no puede hidratar (ej. localStorage unavailable), `deriveContentLoopAction` recibirá defaults — esto es aceptable porque `getDailyProgress()` ya maneja fallback, pero no está documentado.

### Behavioral ambiguity

- **¿Cuándo re-deriva el caller?** El spec no especifica si `deriveContentLoopAction` se llama en cada render o en un `useEffect`. Si se llama en render, puede causar renders infinitos si el resultado cambia el estado que lo alimenta. El patrón correcto es `useMemo` — no está especificado.
- **¿La card cambia en tiempo real?** Si el usuario completa el Daily Focus en otra tab y vuelve al Hub, ¿se actualiza la card? Depende de si el caller usa `useState` + storage event listener. No especificado, pero el patrón existente en el hub no usa storage events — la card requeriría reload o navegación.

### Hidden assumptions

- El spec asume que Lite solo tiene rook como pieza primaria, pero el middleware de Lite en `middleware.ts` no lista qué piezas están disponibles — usa `isFullOnlyPath` para bloquear rutas Full. Si el founder habilita bishop en Lite, `primaryPiece = "rook"` podría no ser el camino más relevante para el usuario.
- El spec asume que `buildTrainingPath` ya existe y funciona — VERIFICADO: sí existe en `lib/training/path.ts` y es puro.
- El spec asume que `getNextChallenge` equivale a `hasReadyLabyrinth` — VERIFICADO: sí es equivalente (`status === "available"` en nodo labyrinth).

### Backward compatibility

- **`hero-cta.ts` intacto**: el spec confirma que no se modifica. `deriveContentLoopAction` es additive. Sin riesgo de regresión en HeroContextState/HeroCTA.
- **No hay migrations**: no nuevas claves localStorage → no hay usuarios con estado inválido.
- **No hay cambios de tipos en PieceProgress ni DailyProgress**: puro lectura.

### Security & data

- Sin PII nuevo. Sin llamadas a red. Sin env vars. Sin API keys. Riesgo = 0.

### Test coverage gaps

- El spec lista 13 test cases para `deriveContentLoopAction` pero no especifica tests para `NextStepCard` (componente React). Agregar al menos: render sin crash para cada variant + no-render cuando variant = `view-progress`.
- No hay test que verifique que `daily-pending` siempre gana aunque `welcomePackage.unlocked = true`. Debería estar en la lista.

### Operational readiness

- No hay logging específico de Content Loop. El `track()` existente podría registrar cuando el variant cambia, pero no está en scope.
- Rollback: como es additive (no modifica código existente), rollback = revertir los 4 commits del plan. Sin riesgo de romper Lite existente.

---

## Condiciones previas — Estado de resolución

| # | Prioridad | Condición | Estado |
|---|---|---|---|
| 1 | P0 | `NextStepCard` no renderiza hasta `isHydrated === true` | ✅ Resuelto — §7 spec + `isContentLoopHydrated` en caller, tests en §12 |
| 2 | P0 | Exportar `LITE_PRIMARY_PIECE = "rook" as const` | ✅ Resuelto — §5 contrato, AC en §11 |
| 3 | P1 | `view-progress` contradicción render/null | ✅ Resuelto — renderiza micro-card → `/trophies`, nunca pantalla muerta |
| 4 | P1 | `labyrinthBests` desde `chesscito:labyrinth-best:{piece}` | ✅ Resuelto — §9 incluye código ejemplo del caller con clave explícita |
| 5 | P1 | `useWelcomePackage()` disponible en Hub Lite | ✅ Documentado — §11 AC exige verificación pre-implementación; no crear nueva fuente |

## Veredicto

**READY FOR TDD — sin condiciones bloqueantes.**

Las 5 condiciones previas están cerradas en el spec v2. Los hallazgos P2 son mejoras para v2 y no bloquean la implementación.

**Riesgos residuales (todos P2, no bloqueantes):**

- `nextAvailablePiece` — quién lo calcula en el caller no está especificado (puede derivarse de `REWARD_TILE_ORDER` del hub; el implementador decide en el momento)
- `come-back-tomorrow` wording puede confundir con timezones distintas de UTC (mejorable en v2 con "See you next time")
- Sin telemetría de qué variant se muestra (añadir `track()` es fácil pero fuera de scope v1)
- `NextStepCard` podría ser inline en scaffold vs componente separado (el spec recomienda componente separado para testabilidad)

**P0 resueltos: 2 | P1 resueltos: 5 | P2 residuales: 4 (no bloqueantes)**
