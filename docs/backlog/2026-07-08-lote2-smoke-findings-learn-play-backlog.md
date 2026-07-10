# Lote 2 — smoke manual + backlog LEARN/PLAY (2026-07-08)

> ⚠️ **PARCIALMENTE SUPERADO.** Índice vigente:
> `docs/backlog/2026-07-10-backlog-index.md`. Ya cerrados y descritos abajo como
> abiertos: el **CTA dorado "Save proof"** (#183), **LEARN #4 Post-Focus Free
> Practice** (#191) y **PLAY #7 Coach HUB icon** (#207). No trabajarlos.

> Lote 2 se mantiene CERRADO. Nada de esto se implementa ahora. Solo
> confirmación/documentación + backlog priorizable. Item 3 vive en
> `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`.

## Smoke manual — resultados (confirmados)

| Ítem | Resultado |
|------|-----------|
| Save off-chain gratis | ✅ confirmado, no descontó Peones |
| Botón verde SAVE (happy path) | ✅ no apareció |
| Fallback manual `Retry save` | ⚠️ no apareció en smoke (auto-save no falló) → no validado visualmente. Es esperado: solo aparece si el auto-save falla. Safety net, no bloqueante. |
| PLAY Save Victory | ✅ funcionando |
| PLAY Leaderboard | ✅ ya no aparece (B5) |

## 🔴 Hallazgo evidente — el CTA dorado "Save proof" quedó casi inalcanzable

### Condición EXACTA donde aparece hoy (código, read-only)

"Save proof" (`saveOnChainCta` / promise `saveOnChainPromise` = "Save today's
training proof") se renderiza **SOLO en el mission sheet**
(`mission-detail-sheet.tsx`, `showSaveOnChain`), gated por:

```
canSaveOnChain = scorePendingNew && scoreboardAddress != null      (exercises-screen.tsx:2308)
scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore  (:1051)
canSaveScore    = address && isConnected && isCorrectChain && levelId > 0            (:1028)
```

Es decir aparece cuando: **wallet conectada + chain Celo correcta + Scoreboard
configurado + ≥1 estrella + score NUEVO no gugardado off-chain**, y **solo dentro
del mission sheet** (que el usuario debe abrir desde la peek card).

### El problema (regresión de B2)

El auto-save de B2 corre en `scorePendingNew` (efecto `:1757`) y al persistir
llama `recordSaveFor(...)` (`:1674`) → `lastSavedScore = localScore` →
**`scorePendingNew` pasa a false** → `canSaveOnChain` = false → **el CTA dorado
desaparece**.

Resultado: el "Save proof" solo es visible en la ventana de carrera entre lograr
un score nuevo y que el POST del auto-save resuelva (≈latencia del POST), y solo
si el usuario ya tenía abierto el mission sheet. En el happy path es
prácticamente inalcanzable. Esto contradice el objetivo de Lote 2 ("on-chain
proof = único CTA de valor accionable"): el auto-save comparte el mismo gate
`scorePendingNew` que habilita el dorado y lo cierra.

Se agrava con el hallazgo del founder: "sesión muy corta (~5 ejercicios)" +
"no llegué a ver el CTA dorado".

### Cómo validarlo manualmente HOY

- Reliable solo si el off-chain auto-save NO tiene éxito: en modo offline / con
  `/api/scores/save` fallando, `scorePendingNew` se queda true → el dorado
  (y el neutro `Retry save`) persisten en el mission sheet.
- En online normal: abrir el mission sheet inmediatamente al lograr un score
  nuevo, dentro de la ventana del POST.

### Recomendación (NO implementar ahora — Lote 2 cerrado)

Desacoplar el gate del on-chain proof del `scorePendingNew` que consume el
auto-save. Opciones a evaluar como fix chico dedicado:
- Gate del dorado por `isSavedAtParity || scorePendingNew` (mostrarlo también
  cuando el score ya se auto-guardó off-chain pero NO on-chain), o
- un flag separado `hasOnchainProof` (leaderboard `has_onchain`) para decidir
  visibilidad, independiente del off-chain save state.

Decisión del founder: ¿fix chico dedicado (reabre lógica) o se agenda? Marcado
como **P1 follow-up**, no dentro de Lote 2.

## Dock PLAY — ¿ajuste 4-slot es fix chico o follow-up?

**Evaluación (código):** `.chesscito-dock` (globals.css:3785) es
`display:flex; justify-content:space-around` con `background-image` = textura
`menu-wall` estirada `background-size:100% 100%`. **NO hay arte de base con
divisores horneados para 5 slots** (comment 3822-3826: justamente migraron de la
panel-art de 4 slots a esta textura genérica para que sirva a cualquier conteo).
El Leaderboard se oculta por filtro render-time en `persistent-dock.tsx:233-239`.

La percepción "parece de 5 slots" es de **espaciado/simetría**, no de asset: al
quitar leaderboard, `SIDE_RIGHT` pierde un ítem → la composición
`SIDE_LEFT(2) · center(1) · SIDE_RIGHT(1)` queda asimétrica y el center deja de
verse centrado.

**Veredicto:** NO es un one-liner obvio ni un swap de asset; es un juicio de
layout/espaciado que requiere ojo en device + refrescar baseline VR. → **Follow-up
inmediato (item 11)**, NO meter en el cierre de Lote 2.

---

## Backlog LEARN (no implementar ahora)

### 1. Investigar "Claim 3 Shields"
- ¿Pertenece a Welcome Pack, Season Pass bonus o rescue gift?
- ¿Duplica los 3 Shields iniciales por firma/onboarding?
- ¿Por qué al tocarlo lanza el 21-Day Mind Challenge?
- ¿Copy "Claim 3 Shields" correcto, o "Activate Pass"/"Open gift"/"Get Shields"?
- No cambiar lógica.

### 2. Post-Claim Gift Overlay
- Tras reclamar gift/welcome package, mostrar QUÉ ganó y para qué sirve
  (ej. +3 Shields, +X Peones). Feedback emocional/educativo, evitar claim sin cierre.

### 3. Tactical Day Gift + Proof of Consistency
- Ver `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`.
- Great Focus Day desbloquea el gift; resolverlo = cierre de sesión → CTA opcional
  "Save today's training proof"; el fuego del día como fallback de la proof; el
  gift no expuesto suelto en el HUB header si permite saltarse la experiencia.

### 4. Post-Focus Free Practice
- Tras completar focus, permitir repasar ejercicios completados/desbloqueados de
  la sesión. No limitar a repetir el último ni esperar cooldown.

### 5. Shop Active State
- Con Season Pass activo, evitar que el Shop solo muestre modal "Pass Active".
- Evaluar mostrar Peones/PRO/Shields/status del pass, o simplificar.
- ¿El Shop merece slot principal en el dock cuando el pass ya está activo?

## Backlog PLAY (no implementar ahora)

### 6. Coach Review Flow
- Sin PRO, el diario/review no debe quedar enterrado. Valor mínimo visible para
  free; PRO desbloquea profundidad/memoria/análisis extendido, no esconde toda
  la capa de aprendizaje.

### 7. Coach HUB icon
- Usar asset `art/new-icons-chesscito/training`; el icono actual se siente
  desconectado.

### 8. Remove redundant LUZ confirmation
- Al tocar Coach Review, lanzar análisis directo. Quitar la pantalla intermedia
  donde LUZ pregunta si quiere analizar. Mantener personalidad de LUZ en el
  loading/resultado.

### 9. Coach Analysis Loading Overlay
- Loading overlay claro mientras se genera el análisis; al terminar, llevar
  automáticamente al resultado. Evitar que el usuario deba descubrir el scroll.

### 10. Save Match Success Celebration
- Tras tx exitosa de Save Match/Victory, celebración: explicar que la victoria
  quedó guardada + dónde verla (Trophies/Gallery/Match Trophy). Idealmente card,
  badge o imagen del trofeo.

### 11. PLAY Dock 4 slots (ver evaluación arriba)
- Leaderboard ya oculto; falta el ajuste de simetría/espaciado del dock para que
  se sienta diseñado para 4 slots. No reintroducir Leaderboard hasta ELO/ranking
  real. Requiere ojo en device + baseline VR → follow-up inmediato.
