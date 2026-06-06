# Chesscito — Training Economy Alpha · Decisiones cerradas + Plan de ejecución

**Fecha:** 2026-06-05
**Autor:** John (Tech Lead / Product Engineer, dirigido por Wolfcito)
**Estado:** Decisiones cerradas. Plan de Sprint 1 listo para implementación.
**Doc padre:** `docs/product/chesscito-training-engagement-direction-2026-06-05.md`

---

## Resumen ejecutivo

**Training Economy Alpha** es el milestone que valida el loop económico-pedagógico de Chesscito antes de cualquier inversión en features sociales (PvP, Visor, Gifting). Son 4 sprints de 1 semana, secuenciales, con dependencia clara:

1. **Sprint 1 — King Senda 5→10 + telemetría base.** Contenido y eventos; cero economía.
2. **Sprint 2 — Daily Tactic Evolution.** Evolucionar el sistema EXISTENTE (`apps/web/src/components/daily/*`), no crear paralelo. Pool 14→30, incluir King, tags de dificultad, recompensa en Peones.
3. **Sprint 3 — Peones=Estrellas + ledger off-chain.** Unificar moneda, persistir en Supabase, attestation hash por movimiento.
4. **Sprint 4 — Compendio TX.** Coach/hints/retries vía Peones. PRO evita costo Peones. Save partida vía Peones. Badge claim + VictoryNFT mantienen TX visible.

**Fuera de Alpha (Milestones B y C):** Founder Badge reactivation, theme packs, gifting PRO, PvP, visor con tip-de-piezas. Existen en roadmap visible, no compiten por bandwidth.

**Principio operativo central:** TX visible solo cuando hay persistencia pública on-chain. Todo lo consumible se paga con Peones off-chain. La Senda es pedagogía curada, no randomización. Daily Tactic es el reason-to-return.

---

## 1. Qué es Training Economy Alpha

Es la versión más pequeña del producto que permite validar las 3 hipótesis económicas centrales:

| Hipótesis | Cómo se valida |
|---|---|
| H1: Jugar más allá de los 5 ejercicios actuales aumenta retention | Sprint 1 ship Senda 10 para King + medir D1/D7 entre usuarios que completan 5 vs 10 |
| H2: Una recompensa material en Daily Tactic aumenta DAU 7d rolling | Sprint 2 ship recompensa Peones + comparar DAU pre/post |
| H3: Peones como moneda unificada que reduce fricción TX aumenta conversion guest→connected y reduce paywall friction | Sprints 3-4 ship ledger off-chain + Compendio TX, medir conversion |

Si las 3 hipótesis se validan, **monetización identitaria (Milestone B) y social (Milestone C) tienen base económica real para extender.** Si fallan, ajustamos antes de invertir en B/C.

---

## 2. Decisiones cerradas — las 7 open questions

| # | Pregunta | Decisión oficial | Justificación |
|:--:|---|---|---|
| 1 | PRO Daily Lab extras | **2/week** (Friday Premium Lab + Sunday Showdown) | Evita exceso de authoring weekly. Subir a 3 solo si métricas piden. |
| 2 | Peones cap diario | **10 Peones/día** combinado fuentes Daily | Número simple, ajustable con datos en Sprint 4 retrospective. |
| 3 | Founder pricing | **$9.99 USD lifetime** | Posicionamiento "Founder Support" — narrativa de identidad, no precio. |
| 4 | Theme packs policy | **Venta estándar + Founders gratis + PRO 20% descuento** | Founders comparten valor; PRO premia recurrencia; público general paga precio nominal. |
| 5 | Tip-de-piezas inicial | **5 Peones "solo-tip" por usuario** (segregados, no gastables en otras cosas) | Roadmap futuro Milestone C — design captured, not built. |
| 6 | Badge "Devoto" 30-day streak | **Off-chain / visual primero** | No crear contrato nuevo. Migrable a soulbound si retention valida. |
| 7 | Gifting PRO refund | **80% a 90 días** códigos no redimidos | MVP manual/operativo, automatizar cuando volumen justifique. |

Estas decisiones son **defaults oficiales** — no se vuelven a discutir sin nueva data. Cambios requieren retrospective post-Sprint 4.

---

## 3. Qué entra en los primeros 4 sprints

### Sprint 1 — King Senda 5→10 + telemetría base

- Autoría de 5 nuevos ejercicios King (`king-6` a `king-10`) con pedagogía progresiva
- BFS verifier para `optimalMoves` (test util reusable para todos los pieces futuros)
- Refactor mínimo de `EXERCISES_PER_PIECE` constant → per-piece dynamic (`EXERCISES[piece].length`)
- Migración localStorage compatible (`stars[5]` → `stars[10]` preservando primeros 5)
- Instrumentación de eventos training mínimos (ver §6)
- VR refresh si baselines de exercises shift

**No incluye:** economía Peones, Daily Tactic changes, Founder Badge, themes.

### Sprint 2 — Daily Tactic Evolution

- Pool de puzzles 14 → 30 (autoría +16, incluir King)
- Tags `difficulty: "easy" | "medium" | "hard"` en `DailyTacticData` shape
- Recompensa al completar Daily Tactic: **3 Peones** (depositar en ledger Supabase — stubs si Sprint 3 no listo aún) + **+2 Peones** por 3★
- Bonus racha 7d: **+1 Peón** depositado al cumplir 7 días consecutivos
- Cap diario combinado de 10 Peones earnable (enforced en endpoint de deposit)
- PRO extras: 2 puzzles adicionales/week visibles solo a PRO subs (Friday + Sunday)
- **NO crear sistema paralelo** — evolución de `apps/web/src/components/daily/*` + `apps/web/src/lib/daily/*`

**No incluye:** unificación Peones=Estrellas en exercise rewards (solo Daily Tactic da Peones en Sprint 2), Compendio TX para gastar Peones.

### Sprint 3 — Peones=Estrellas + ledger off-chain

- Tabla Supabase `peones_ledger` con shape:
  - `wallet`, `event_type` (`earn` / `spend` / `adjustment` / `rollback`), `amount`, `source` (`daily_tactic` / `daily_lab` / `exercise_completion` / `coach_payment` / `hint` / etc.), `attestation_hash`, `created_at`, `idempotency_key`
- Endpoint `/api/peones/earn` y `/api/peones/spend` (server-side validation + rate limiting + cap enforcement)
- Reward exercise completion: depositar Peones = Estrellas ganadas en cada completion de ejercicio Senda (sin cap, hasta máximo natural 30 Peones/pieza)
- HUD básico: chip de saldo Peones visible en `/exercises`, `/arena`, `/coach`, `/hub`
- Migration plan: usuarios con stars[] preexistente NO retroactivan Peones (solo earn forward). Documentar en copy de release.

**No incluye:** Compendio TX para gastar Peones (Sprint 4).

### Sprint 4 — Compendio TX

- Coach analysis paga con Peones (1 Peón = 1 Coach analysis) — PRO bypass (siempre gratis)
- Hint en laberinto: 1 Peón (PRO bypass)
- Retry sin perder racha: 2 Peones (PRO bypass)
- Save partida: 1 Peón si no PRO, bypass si PRO
- Llaves futuras T4 laberintos preparadas (stub que respeta el modelo, no requiere T4 implementado todavía)
- Badge claim y VictoryNFT mantienen TX visible — NO se mueven a Peones
- Attestation hash por cada spend, persistido en ledger

**No incluye:** Founder Badge reactivation, theme packs, gifting PRO, PvP, visor.

---

## 4. Qué queda explícitamente fuera de Alpha

| Out of scope | Por qué | Cuándo |
|---|---|---|
| Founder Badge reactivation | Necesita validación de economía base primero | Milestone B, sprint 6 |
| Theme packs (Halloween, Christmas) | Necesita ledger Peones estable + Founder + PRO discount activos | Milestone B, sprint 6-7 |
| Theme `founder-gold-leaf` | Depende de Founder Badge | Milestone B |
| PvP MVP | Cluster grande, no compete con Alpha bandwidth | Milestone C, sprint 8 |
| Gifting PRO | Necesita PRO economy validada | Milestone C, sprint 9 |
| Visor con tip-de-piezas | Requiere PvP + spectator infra + ledger Peones maduro | Milestone C, sprint 10 |
| Laberintos T2-T5 (Collect/Hazard/Key) | Depende de attackedSquares modeling + economía intra-laberinto | Milestone B/C, sprint 7-8 |
| Senda extensiva otras 5 piezas (Rook/Bishop/Knight/Pawn/Queen) | Depende de éxito King — extender solo si H1 valida | Post-Sprint 4 retrospective |
| Generador procedural ejercicios | Pool autorado es suficiente 6-12 meses | v0.3+ |
| On-chain training leaderboard | Esperar volumen real de usuarios | v0.3+ |

---

## 5. Principios operativos (regla dura para todo Alpha)

1. **TX visible solo cuando hay persistencia pública on-chain.** Badge claim, VictoryNFT mint, PRO sub renewal — sí TX. Coach individual, hints, retries, llaves — NO TX, paga con Peones.
2. **Consumibles se pagan con Peones off-chain.** Una sola TX onchain por recarga de Peones cuando el usuario quiere comprar pack. Todo lo demás es decrement de ledger.
3. **La Senda es pedagogía curada, no randomización.** Todos los usuarios ven los mismos 10 ejercicios King en el mismo orden. Variabilidad cross-wallet ≠ engagement. La Senda enseña; el Daily Tactic da reason-to-return.
4. **Daily Tactic es el reason-to-return.** Reward material + racha + scarcity (hoy o mañana se va) = hábito real.
5. **Peones NO deben sentirse como monetización predatoria.** Earn rate generoso (30-40/week para active user), cap diario protege economy, spend opcional (PRO siempre bypass). El usuario casual gana suficiente Peones para 2 Coach gratis cada 2 semanas.
6. **No sistemas paralelos cuando ya existe base.** Daily Tactic existe → evolucionar. Theme system foundation existe → consumir, no inventar.
7. **No tocar contracts sin necesidad imprescindible.** Badge, VictoryNFT, Scoreboard, Shop intactos en Alpha. Cambios en Milestone B+ si métrica valida.
8. **Migration backward-compatible.** localStorage stars[5] sigue funcionando post-Sprint 1. Usuarios preexistentes NO pierden progreso ni Peones retroactivos (solo earn forward).
9. **No randomización en Senda.** El orden de ejercicios king-1..10 es fijo y curado.
10. **Telemetría antes de economía.** Sprint 1 ya tiene eventos; Sprints 2-4 sumen eventos económicos pero no se construye economía sin baseline medible.

---

## 6. Eventos mínimos de telemetría

Tabla canónica para todo Alpha. Cada evento define: nombre, when, properties, scope (guest/connected/both), priority.

### 6.1 Eventos de training (Sprint 1 lanza estos)

| Evento | Cuándo dispara | Propiedades | Scope | P |
|---|---|---|---|:--:|
| `training_exercise_started` | Usuario abre un ejercicio (cualquier piece, cualquier slot) | `piece`, `exerciseId`, `slotIndex`, `isReplay` | both | **P0** |
| `training_exercise_completed` | Usuario llega al targetPos válido | `piece`, `exerciseId`, `slotIndex`, `movesUsed`, `optimalMoves`, `starsEarned`, `isReplay`, `bestStarsBefore`, `bestStarsAfter` | both | **P0** |
| `training_stars_earned` | Estrellas net positivo (excluye replays sin mejora) | `piece`, `exerciseId`, `delta`, `newPieceTotal` | both | **P0** |
| `training_piece_badge_threshold_reached` | `totalStars[piece] >= 10` por primera vez | `piece`, `totalStars`, `exercisesCompleted` | connected | **P0** |
| `training_senda_completed` | Usuario completa los 10 ejercicios de una pieza con ≥1★ cada uno | `piece`, `totalStars`, `timeFromFirstCompletion` | both | P1 |

### 6.2 Eventos de Daily Tactic (Sprint 2 lanza estos)

| Evento | Cuándo dispara | Propiedades | Scope | P |
|---|---|---|---|:--:|
| `daily_tactic_started` | Usuario abre el sheet del Daily Tactic | `puzzleId`, `puzzleDate`, `difficulty`, `pieceShown`, `currentStreak`, `isPro` | both | **P0** |
| `daily_tactic_completed` | Usuario resuelve correctamente | `puzzleId`, `puzzleDate`, `difficulty`, `pieceShown`, `movesUsed`, `optimalMoves`, `starsEarned`, `newStreak`, `peonesEarned`, `isPro` | both | **P0** |
| `daily_streak_updated` | Cambio en racha (subió, reset, primer día) | `newStreak`, `streakType` (`first`/`extended`/`reset`), `bonusPeonesEarned` | both | **P0** |
| `daily_lab_started` | PRO abre Daily Lab Friday/Sunday | `labId`, `labDate`, `difficulty`, `dayOfWeek` | connected (PRO) | P1 |
| `daily_lab_completed` | PRO resuelve Daily Lab | `labId`, `labDate`, `difficulty`, `movesUsed`, `optimalMoves`, `starsEarned`, `peonesEarned` | connected (PRO) | P1 |

### 6.3 Eventos de Peones (Sprints 3-4 lanzan estos)

| Evento | Cuándo dispara | Propiedades | Scope | P |
|---|---|---|---|:--:|
| `peones_earned` | Cada earn al ledger (Daily Tactic, exercise, racha bonus) | `source` (`daily_tactic`/`exercise_completion`/`streak_bonus`/`daily_lab`), `amount`, `newBalance`, `attestationHash` | connected | **P0** |
| `peones_spent` | Cada spend del ledger | `target` (`coach`/`hint`/`retry`/`key`/`save_game`), `amount`, `newBalance`, `attestationHash`, `wasFreeBecausePro` | connected | **P0** |
| `peones_balance_viewed` | HUD chip de Peones renderizado | `balance`, `surface` (`exercises`/`arena`/`coach`/`hub`) | connected | P1 |
| `peones_cap_reached` | Usuario topa cap diario de 10 | `dailyAmount`, `dayUtc` | connected | **P0** |
| `peones_attempt_blocked_insufficient` | Usuario intenta spend sin saldo | `target`, `requiredAmount`, `currentBalance` | connected | **P0** |

### 6.4 Eventos de Coach + consumibles (Sprint 4 lanza estos)

| Evento | Cuándo dispara | Propiedades | Scope | P |
|---|---|---|---|:--:|
| `coach_analysis_requested` | Usuario inicia request de Coach | `surface`, `paymentMode` (`pro_bypass`/`peones`/`cusd`), `costPeones`, `currentBalance` | connected | **P0** |
| `coach_analysis_paid_with_peones` | Spend de Peones completado para Coach | `costPeones`, `newBalance`, `attestationHash`, `analysisId` | connected | **P0** |
| `coach_analysis_paywall_shown` | Usuario sin saldo + sin PRO ve paywall | `currentBalance`, `recommendedPack` | connected | **P0** |
| `hint_used_in_labyrinth` | Hint consumido | `labyrinthId`, `costPeones`, `paymentMode`, `newBalance` | connected | P1 |

### 6.5 Eventos de funnel guest→connected

| Evento | Cuándo dispara | Propiedades | Scope | P |
|---|---|---|---|:--:|
| `guest_connect_cta_seen` | CTA de conexión renderizado en `/exercises` (ejercicio 3, 4, 5) | `surface`, `ctaVariant` (`soft`/`counter`/`strong`), `potentialPeonesShown` | guest | **P0** |
| `guest_connect_cta_clicked` | Usuario clickea el CTA | `surface`, `ctaVariant`, `potentialPeonesShown` | guest | **P0** |
| `guest_connected` | Wallet connect successful desde flow guest | `triggeredBySurface`, `exercisesCompletedAsGuest`, `starsEarnedAsGuest` | guest→connected | **P0** |
| `wallet_connected_after_training` | Wallet connect desde cualquier surface tras al menos 1 ejercicio completo | `triggeredBySurface`, `totalGuestSessionMinutes`, `exercisesCompletedAsGuest` | guest→connected | **P0** |

### 6.6 Implementación de telemetría

- **Stack actual:** ya existe `apps/web/src/lib/telemetry/*` (per memory `m1-monetization-cluster-complete`, 16 eventos `monetization.*` instrumentados). Reusar el mismo emitter.
- **No crear stack paralelo.** Extender el módulo existente con los namespaces `training.*`, `daily.*`, `peones.*`, `coach.*`, `funnel.*`.
- **Persistencia inicial:** localStorage debounced + endpoint POST a `/api/telemetry/event` (si existe) o stub que loggee a console hasta que el backend esté listo. **Decisión:** validar que existe endpoint hoy antes de Sprint 1 ship.

---

## 7. Riesgos principales y mitigaciones

| # | Riesgo | Prob | Impacto | Mitigación |
|:--:|---|:--:|:--:|---|
| R1 | `EXERCISES_PER_PIECE = 5` hardcoded en 4 archivos rompe display al pasar a 10 | Alta | Alto | Sprint 1 refactor a per-piece dynamic (`EXERCISES[piece].length`). Tests cubren los 4 callsites. |
| R2 | Usuarios con `stars[5]` localStorage pierden progreso al pasar a `stars[10]` | Alta | Alto | Sprint 1 incluye migration en `loadProgress` — detect old shape + expand preservando valores. Test explícito de migration. |
| R3 | Authoring de 5 nuevos King exercises produce contenido repetitivo (King combinatoric depth limitada) | Media | Medio | Aprovechar `attackedSquares` framing-only para "avoid danger" semánticamente. Si saturamos King, sprint 1 ships solo 3 nuevos (8 total) + retrospectiva. |
| R4 | BFS verifier rompe optimalMoves de ejercicios actuales (Pawn/Bishop) por edge cases de captura | Media | Medio | Verifier corre como warning en CI primer sprint, no hard fail. Si encuentra mismatch en ejercicio existente, abrir issue y NO romper Sprint 1. |
| R5 | Ledger off-chain Supabase puede tener latencia/disponibilidad inconsistente | Media | Alto | Sprint 3 incluye optimistic UI + reconciliation diaria + backups Supabase. Idempotency key obligatorio en cada movimiento. |
| R6 | Recompensa Peones en Daily Tactic genera abuse (replays, multi-account) | Media | Medio | Cap diario 10 Peones + rate limiting + 1 Daily Tactic completion único por (wallet, day_utc). Server-side validation. |
| R7 | Usuario con PRO espera bypass total pero algunas surfaces siguen pidiendo Peones | Media | Medio | Sprint 4 audit completo de surfaces consumibles + matriz PRO bypass documentada. Tests explícitos. |
| R8 | Cap diario combinado de 10 Peones siente injusto si usuario hace muchas actividades en un día | Baja | Bajo | Copy explícito: "Has ganado tu máximo diario. Vuelve mañana para más." Mostrar contador. |
| R9 | Telemetría rompe rendering si endpoint POST está caído | Baja | Bajo | Eventos persisten localStorage + flush async. Errores swallowed (no romper UI). |
| R10 | VR baselines `hub-clean.png` shift por chip de Peones en HUD | Media | Bajo | Esperado. Refresh en mismo PR donde se introduzca chip (Sprint 3). |
| R11 | Migration de Daily Tactic data (14 puzzles) al nuevo shape con `difficulty` tag rompe streaks existentes | Media | Medio | Sprint 2 mantiene shape backward-compatible — `difficulty` opcional, default a "medium" si missing. |
| R12 | Founders existentes pierden sentido cuando Founder Badge se oculta (M1 ya lo ocultó) | Baja | Medio | Founders no se desean fuera del shop hoy — pero su badge soulbound persiste. Sprint 6 (Milestone B) reactivation honra a quienes ya tienen Founder. |

---

## 8. Criterios de éxito al final del Sprint 4

| KPI | Baseline (estimar pre-Sprint 1) | Meta post-Sprint 4 (60d después) |
|---|---|---|
| DAU 7d rolling | medir | +20% |
| D1 retention | ~30% | +5pp |
| D7 retention | ~10% | +10pp |
| % connected wallets con ≥1 piece a 10★ | medir | 25% |
| Daily Tactic completion rate | medir Sprint 2 baseline | 40% de DAU |
| Peones earned/active user/week | nuevo | 30-40 promedio |
| Peones cap reach rate (% de DAU connected que topan cap) | nuevo | <25% (si >25%, cap muy bajo) |
| Coach analyses pagados con Peones / total Coach requests | nuevo | >40% |
| Conversion guest→connected | medir | +15% |
| Streak ≥7d Daily Tactic | nuevo | 15% de DAU connected |

**Decisión binaria al final de Sprint 4:**

- **Si H1+H2+H3 validan** → arrancar Milestone B (Founder + Themes) en Sprint 5.
- **Si parcialmente validan** → retrospectiva, ajustar caps/pricing/contenido, repetir Sprint 4 con cambios.
- **Si no validan** → re-evaluar tesis del loop económico; considerar pivot a modelo más utility-driven (más PRO benefits) vs identity-driven.

---

## 9. Roadmap completo separado por milestones

### Milestone A — Training Economy Alpha (Sprints 1-4)

| Sprint | Cluster | Status |
|:--:|---|:--:|
| 1 | King Senda 5→10 + BFS verifier + telemetría base | 🟡 next |
| 2 | Daily Tactic Evolution (pool 14→30, King, tags, recompensa Peones, racha bonus, PRO extras) | 🔴 |
| 3 | Peones=Estrellas + ledger off-chain Supabase + HUD chip Peones | 🔴 |
| 4 | Compendio TX (Coach/hints/retries vía Peones, PRO bypass, save partida) | 🔴 |

### Milestone B — Monetización identitaria + contenido (Sprints 5-7)

| Sprint | Cluster | Status |
|:--:|---|:--:|
| 5 | Laberintos T2 (Collect) — recolectables en ruta, 2 labs piloto (Knight + Rook) | 🔴 |
| 6 | Founder Badge reactivation + Theme `founder-gold-leaf` + Halloween Pack pilot | 🔴 |
| 7 | Laberintos T3+T4 (Hazard + Key/Door) — attackedSquares modeling + economía intra-laberinto | 🔴 |

### Milestone C — Social / B2B / Spectator (Sprints 8-10)

| Sprint | Cluster | Status |
|:--:|---|:--:|
| 8 | PvP MVP — matchmaking, game state sync, anti-cheat básico | 🔴 |
| 9 | Gifting PRO — página `/gift/pro`, redention codes, B2B onboarding | 🔴 |
| 10 | Visor con tip-de-piezas — spectator UI, gifting visual, economía piezas-como-tip | 🔴 |

---

## 10. Plan técnico Sprint 1 — King Senda 5→10

### 10.1 Goal

Extender `KING_EXERCISES` de 5 a 10 ejercicios pedagógicamente curados, refactorizar el hardcoded `EXERCISES_PER_PIECE = 5` a per-piece dinámico, migrar localStorage backward-compatible, agregar BFS verifier, instrumentar eventos training (§6.1).

**Cero cambios económicos.** Solo contenido + infra + telemetría.

### 10.2 Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `apps/web/src/lib/game/exercises.ts` | Agregar `king-6..10` (5 nuevos). Reemplazar `EXERCISES_PER_PIECE = 5` constant por helper `getExerciseCount(piece): number = EXERCISES[piece].length`. |
| `apps/web/src/lib/game/__tests__/exercises-bfs-verifier.test.ts` | **NEW** — BFS verifier valida `optimalMoves` para los 35 ejercicios actuales (incluye Pawn diagonal capture rule de v0.1) + 5 nuevos King. Si falla en exercise preexistente, log warning + skip (NO romper Sprint 1). |
| `apps/web/src/hooks/use-exercise-progress.ts` | Reemplazar 7 callsites de `EXERCISES_PER_PIECE` por `getExerciseCount(piece)`. Migration en `loadProgress`: detect old shape (`stars.length === 5` AND `EXERCISES[piece].length === 10`) → expand a `[...old5, 0, 0, 0, 0, 0]` + persist. |
| `apps/web/src/components/exercises/result-overlay.tsx` | Reemplazar 4 callsites por per-piece dinámico (requiere `piece` prop, ya disponible). |
| `apps/web/src/components/exercises/exercise-drawer.tsx` | Reemplazar 1 callsite por per-piece dinámico. |
| `apps/web/src/lib/telemetry/training-events.ts` | **NEW** — emitters para los 5 eventos de §6.1 (`training_exercise_started`, `training_exercise_completed`, `training_stars_earned`, `training_piece_badge_threshold_reached`, `training_senda_completed`). Usar emitter existente del cluster M1. |
| `apps/web/src/hooks/use-exercise-progress.ts` (telemetría) | Emit `training_exercise_completed` en `completeExercise`. Emit `training_stars_earned` cuando delta > 0. Emit `training_piece_badge_threshold_reached` cuando crosses 10★. |
| `apps/web/src/components/exercises/exercises-screen.tsx` | Emit `training_exercise_started` en mount del board. |
| `apps/web/src/hooks/__tests__/use-exercise-progress.test.ts` | **NEW** o extender — covering: (a) migration old5 → new10 preserva valores, (b) per-piece dinámico (King 10 vs Rook 5), (c) eventos emitidos correctamente. |
| `docs/superpowers/specs/2026-06-02-training-content-v0.1.md` | §15 add — nota de "v0.1.1: King senda extendida 5→10, ver decisions doc". |
| `docs/product/chesscito-training-engagement-direction-2026-06-05.md` | Update §13 roadmap status (Sprint 1 🟡→ 🟢 al final). |

**Archivos que NO se tocan:**

- `apps/web/src/lib/daily/*` (Sprint 2)
- `apps/web/src/lib/game/labyrinths*` (Sprints 5-7)
- Contracts (`apps/contracts/*`)
- Shop, PRO, Peones existing UI (Sprints 3-4 lo expanden)
- VR fixtures de Daily Tactic, Arena

### 10.3 Autoría de 5 nuevos King exercises (king-6..10)

Pedagogía progresiva post-shelter (king-5 ya cubre "reach corner"):

| ID | Theme | Start → Target | Optimal | isCapture |
|---|---|---|:--:|:--:|
| `king-6` | Diagonal opuesta de regreso | h8 → a1 | 7 | — |
| `king-7` | Centro con obstáculo lateral | e4 → e8 obs (e6) | 4 (via f5,f6,e7,e8) | — |
| `king-8` | **PENDIENTE REVISIÓN** — captureTargets debe apuntar a enemigo real, NO a obstacle. Re-spec antes de autoría. | TBD | TBD | ✅ |
| `king-9` | Esquina a esquina largo | a8 → h1 | 7 | — |
| `king-10` | Centro con 2 obstáculos | e4 → e1 obs (e3, d2) | 4 (via f3, f2, e1 — el shorter path) | — |

**Decisión Wolfcito 2026-06-05:** `king-8` queda **pendiente de revisión** hasta confirmar el modelo real de `captureTargets` vs `obstacles`. **NO usar `obstacle` como pieza capturable** — los obstacles son friendly blockers, no enemigos. Re-spec antes de autoría: probablemente `a1 → c3` con captureTargets en `c3` (king captura enemigo en destino), sin obstacles, optimal 2.

**Pendiente confirmar en code review:** BFS verifier valida que cada `optimalMoves` es alcanzable y mínimo dado `blockers`. Si BFS calcula distinto, ajustar el ejercicio o el `optimalMoves` field.

### 10.3.1 Nota futura parqueada — Laberintos T2/T3/T4 (NO Sprint 1)

Cuando lleguemos a Laberintos T2/T3/T4 (Milestone B, sprints 5-7), revisar la representación visual de obstáculos. Hoy algunas pantallas muestran piezas con candado como bloqueos, lo cual puede confundirse con:

- Piezas reales del jugador
- Piezas capturables (enemigos)
- Estados de lock (premium gating, threshold no alcanzado)

**Preferencia futura:** representar obstáculos/bloqueos como **casillas plomas, rocas, muros o tiles bloqueados**, no como piezas con candado. Esto separa visualmente las tres semánticas (friendly blocker, enemy capturable, premium lock) y reduce ambigüedad pedagógica.

**Scope:** parqueado para milestone de laberintos enriquecidos. NO afecta Sprint 1.

### 10.4 Refactor de `EXERCISES_PER_PIECE`

```ts
// Antes (exercises.ts:102)
export const EXERCISES_PER_PIECE = 5;

// Después (exercises.ts)
/** Pieza-dinámico: count actual del pool de ejercicios. */
export function getExerciseCount(piece: PieceId): number {
  return EXERCISES[piece].length;
}

/** @deprecated Usar getExerciseCount(piece). Mantener para back-compat tests durante 1 sprint. */
export const EXERCISES_PER_PIECE = 5;
```

Mantener `EXERCISES_PER_PIECE = 5` como deprecated 1 sprint para no romper consumers que aún no migran. Sprint 2 elimina el export.

Refactor en `use-exercise-progress.ts`:

```ts
// Antes
const safeIndex = Math.min(Math.max(0, progress.exerciseIndex), EXERCISES_PER_PIECE - 1);

// Después
const count = getExerciseCount(piece);
const safeIndex = Math.min(Math.max(0, progress.exerciseIndex), count - 1);
```

Y la validación de localStorage:

```ts
// Antes
parsed.stars.length === EXERCISES_PER_PIECE

// Después
parsed.stars.length === getExerciseCount(piece) || canMigrate(parsed.stars, piece)

// Donde canMigrate detecta old shape:
function canMigrate(stars: number[], piece: PieceId): boolean {
  const current = getExerciseCount(piece);
  return stars.length < current && stars.every(s => s >= 0 && s <= 3);
}

// Y la migration:
function migrate(stars: number[], piece: PieceId): PieceProgress["stars"] {
  const current = getExerciseCount(piece);
  return [...stars, ...new Array(current - stars.length).fill(0)] as PieceProgress["stars"];
}
```

### 10.5 BFS verifier

```ts
// apps/web/src/lib/game/__tests__/exercises-bfs-verifier.test.ts
function bfsOptimal(
  start: Position,
  target: Position,
  piece: PieceId,
  blockers: Position[]
): number | null {
  // Standard BFS using getValidTargets as expansion function
  // Returns shortest path length or null if unreachable
}

describe("Exercise optimalMoves verification (BFS)", () => {
  for (const piece of PLAYABLE_PIECES) {
    describe(`${piece}`, () => {
      EXERCISES[piece].forEach((ex, idx) => {
        it(`${ex.id} optimalMoves matches BFS`, () => {
          const bfs = bfsOptimal(ex.startPos, ex.targetPos, piece, ex.obstacles ?? []);
          if (bfs === null) {
            console.warn(`${ex.id} unreachable per BFS`);
            return;
          }
          if (bfs !== ex.optimalMoves) {
            console.warn(`${ex.id}: declared ${ex.optimalMoves}, BFS ${bfs}`);
            // NO fail this sprint — log only
          }
          expect(bfs).toBeDefined();
        });
      });
    });
  }
});
```

Sprint 1: BFS warns. Sprint 2 promueve a hard fail si todo verde.

### 10.6 Migration test crítico

```ts
it("migrates legacy stars[5] to current piece count without data loss", () => {
  // Setup: old stars[5] in localStorage for king (now 10 exercises)
  localStorage.setItem("chesscito:progress:king", JSON.stringify({
    piece: "king",
    exerciseIndex: 4,
    stars: [3, 3, 2, 1, 0],
  }));

  const { result } = renderHook(() => useExerciseProgress("king"));

  // Hidratación post-mount
  act(() => {});

  expect(result.current.progress.stars).toEqual([3, 3, 2, 1, 0, 0, 0, 0, 0, 0]);
  expect(result.current.progress.exerciseIndex).toBe(4);
  expect(result.current.totalStars).toBe(9); // Sigue contando como antes
});

it("preserves rook (no migration needed, still 5)", () => {
  localStorage.setItem("chesscito:progress:rook", JSON.stringify({
    piece: "rook",
    exerciseIndex: 4,
    stars: [3, 3, 3, 3, 3],
  }));

  const { result } = renderHook(() => useExerciseProgress("rook"));
  act(() => {});

  expect(result.current.progress.stars).toEqual([3, 3, 3, 3, 3]);
  expect(result.current.progress.exerciseIndex).toBe(4);
  expect(result.current.totalStars).toBe(15);
});
```

### 10.7 Smoke checklist pre-merge Sprint 1

- [ ] `/exercises?piece=king` muestra 10 ejercicios en el rail/drawer si UI lo soporta (revisar `exercise-drawer.tsx`)
- [ ] `result-overlay.tsx` shows `X/30` instead of `X/15` para King
- [ ] `result-overlay.tsx` mantiene `X/15` para otras 5 piezas
- [ ] Usuario con stars antiguo `[3,3,2,1,0]` en King → ve `[3,3,2,1,0,0,0,0,0,0]` post-migration
- [ ] Vitest full suite green (incluye nuevos tests de migration + BFS verifier warnings)
- [ ] VR `hub-clean.png` no shift (King badge tile no debe cambiar visualmente)
- [ ] Eventos `training_*` emiten correctamente en network tab o console
- [ ] **Badge claim flow King no cambia: threshold 10★; ejercicios 6-10 son progresión extendida** (post-badge), NO un nuevo requisito para reclamar el badge.

### 10.8 Commits sugeridos (granular)

1. `feat(exercises): add getExerciseCount helper + per-piece dynamic count` (refactor only)
2. `feat(exercises): migrate use-exercise-progress to dynamic count + localStorage migration` (with migration test)
3. `feat(exercises): migrate result-overlay + exercise-drawer to dynamic count`
4. `feat(exercises): add 5 new King exercises (king-6..10)`
5. `test(exercises): add BFS verifier as warning-mode regression guard`
6. `feat(telemetry): add training_* event emitters for Sprint 1 scope`
7. `feat(exercises): wire training_* events from progress hook + screen mount`
8. `docs(spec): mark v0.1.1 King senda extension in training-content-v0.1 §15`

### 10.9 Estimación

- Refactor (commits 1-3): 2-3h
- 5 King exercises autoría + verificación BFS: 3-4h
- BFS verifier (commit 5): 1-2h
- Telemetry wiring (commits 6-7): 2h
- Tests + smoke (commit 8): 1-2h
- **Total Sprint 1: ~10-13h, fits 1 sesión larga o 2 medianas.**

---

## 11. Cross-references

- **Doc padre:** `docs/product/chesscito-training-engagement-direction-2026-06-05.md`
- **Monetization tesis:** `docs/product/chesscito-monetization-direction-2026-06-01.md`
- **Telemetry M1 actual:** `docs/monetization/telemetry-events-m1.md`
- **Training content v0.1:** `docs/superpowers/specs/2026-06-02-training-content-v0.1.md`
- **Daily Tactic código actual:** `apps/web/src/components/daily/*` + `apps/web/src/lib/daily/*`
- **Theme system foundation:** `docs/superpowers/specs/2026-05-26-theme-system-foundation.md`
- **Red-team de plan técnico previo:** `docs/specs/2026-06-05-exercise-catalog-refactor-redteam.md`
