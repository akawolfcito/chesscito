# Red Team Review — welcome-package-lite

**Date**: 2026-06-20 (v2 — post founder decisions)
**Reviewer mindset**: hostile QA + senior engineer

---

## v1 Findings — Status update

### P0 (todos resueltos)

| Finding | Status |
|---------|--------|
| `WelcomePackageState` incompleto | RESOLVED — contrato expandido con `dismissed`, `dismissCount`, `autoShowCount`, `unlocked`, `unlockedAt` |
| Mecanismo de trigger no definido | RESOLVED — orquestador explícito con `onContinue` callback; `handleFirstFocusDayUnlocked()` documentado |
| Flow retroactivo ambiguo | RESOLVED — `autoShowCount=2` en init retroactivo, no overlay, pending en Trophies |

### P1 (todos resueltos o degradados con justificación)

| Finding | Status |
|---------|--------|
| localStorage no garantiza permanencia | RESOLVED — lenguaje cambiado a "saved on this device"; riesgo documentado + P2 sync |
| Doble-popup agresivo | RESOLVED — achievement con "Continue" → Package; alternativa delay 600ms documentada |
| Full mode guard vago | RESOLVED — guard explícito en `useWelcomePackage()` con early return + noop |
| ES copy nice-to-have | RESOLVED — ES copy obligatorio en MVP |
| Asset fallback sin AC | RESOLVED — AC explícito: fallback textual "Focus Stamp: Day 1" si asset no carga |
| Trophies surface vaga | RESOLVED — reutiliza surface existente de Lite Achievements; sin nueva ruta |

### P2 (no bloqueantes, documentados)

| Finding | Status |
|---------|--------|
| `version` sin migration strategy | DOCUMENTED — `getWelcomePackageState()` tiene migration guard explícito |
| `package_unlocked` redundante con achievement event | ACCEPTED — se añade `retroactive: boolean` para diferenciar; no es redundante |
| `WelcomePackageReward` en storage | RESOLVED — reward es constante `WELCOME_PACKAGE_REWARD` en código, no en storage |

---

## Nuevos hallazgos en v2

### P1 — Should address before TDD

**[Orquestador: archivo no identificado]** El spec dice "el componente o hook que hoy maneja la secuencia post-Daily Focus en Hub Lite" pero no nombra el archivo concreto. Es un open question al inicio del TDD. Si ese archivo no existe o la secuencia está dispersa, el TDD Fase 4 puede requerir más arquitectura de la estimada. Mitigación: la primera tarea del TDD debe ser identificar ese archivo antes de escribir tests. Bajo riesgo de bloqueo, alto riesgo de estimación.

**[autoShowCount=2 retroactivo: edge case de re-claim]** Si el usuario limpia el localStorage y vuelve a abrir la app, el retroactive path inicializa `autoShowCount=2` → pending, sin overlay. Pero si el usuario limpia el storage muchas veces, puede re-claimarlo múltiples veces (no tiene consecuencias económicas, pero es inconsistente). El spec acepta este riesgo explícitamente (reward cosmético sin valor económico). Documentado como ACCEPTED.

### P2 — Nice to clarify

**[`dismissedAt` es el último dismiss, no historial]** El campo `dismissedAt` trackea solo el dismiss más reciente. Si se quiere analytics de "cuánto tardó en reclamar", necesitaría `firstDismissedAt`. En MVP no hay analytics, así que es aceptable. Documentar como limitación conocida si se añade telemetría.

**[`onContinue` prop en achievement: contrato no definido]** El spec propone añadir `onContinue` como prop al componente de achievement si no existe. Pero no define la interface del componente de achievement. El TDD deberá definirla. No es bloqueante para escribir el contrato de `useWelcomePackage`, pero puede ser sorpresa en Fase 4.

---

## Categories audited (v2)

### Contract gaps
- `WelcomePackageState`: completo. Todos los campos necesarios presentes.
- `WELCOME_PACKAGE_REWARD`: constante en código, no en storage. Correcto.
- `UseWelcomePackageReturn`: interfaz definida con todos los métodos.
- Error types para `localStorage.getItem` failure: no definidos — aceptable para MVP, `try/catch` retorna DEFAULT_STATE.

### Behavioral ambiguity
- Orquestador: documentado como patrón, archivo pendiente de identificar (P1 nuevo).
- `autoShowCount=2` retroactivo: comportamiento claro y justificado.
- Dismiss → re-show → dismiss → no más auto-show: transiciones completas y sin ambigüedad.
- Re-claim post-storage-clear: ACCEPTED como comportamiento cosmético sin consecuencias.

### Hidden assumptions
- Asume que `CHESSCITO_LITE_MODE` es accesible en runtime desde el hook. Si es solo build-time env var, el guard puede no funcionar en desarrollo. Verificar en TDD.
- Asume que la surface de Lite Achievements existe y puede recibir un nuevo item. Confirmar ruta al iniciar TDD.
- Asume que el achievement "First Focus Day" está implementado y tiene estado persistente. Confirmado por contexto del proyecto.

### Backward compatibility
- No rompe types existentes (módulo nuevo).
- Full mode no afectado por guard en hook.
- Usuarios existentes con achievement: retroactive path los trata correctamente.

### Security & data
- Sin PII. Sin wallet. Sin firma. Sin valor económico. Riesgo mínimo.
- localStorage: no cifrado, pero el dato (cosmético/gamificación) no es sensible.

### Test coverage gaps (post v2)
- Todos los ACs son testeables.
- Fase 4 (orquestador) requiere identificar el archivo antes de escribir tests — no bloqueante si se documenta como primera tarea.
- Retroactive init con achievement existente: AC presente, testeable con mock de localStorage + estado de achievements.

### Operational readiness
- Sin observabilidad en MVP — aceptable.
- Rollback: si el overlay molesta, un feature flag `NEXT_PUBLIC_WELCOME_PACKAGE_ENABLED` puede desactivarlo sin deploy de emergencia. No está en el spec — considerar añadir si el riesgo de "overlay molesto" se materializa en QA.

---

## Verdict

**READY FOR TDD**

P0 findings: 0 (todos resueltos)
P1 findings: 1 nuevo (orquestador sin archivo identificado — se resuelve como primera tarea del TDD)
P2 findings: 2 (no bloqueantes)

El spec está implementable sin ambigüedad en los contratos, flows y acceptance criteria. La única incertidumbre es el archivo del orquestador — el TDD Fase 4 empieza por identificarlo. No es bloqueante para las Fases 1-3.

**Próximo paso**: `/tdd welcome-package-lite` con el TDD checklist del spec como punto de partida.
