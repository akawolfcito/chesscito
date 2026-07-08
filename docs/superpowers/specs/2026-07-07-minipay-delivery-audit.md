# Auditoría producto + ingeniería — Cierre entregable MiniPay (2026-07-07)

> Rol: auditor senior. Objetivo: reducir ambigüedad, CTAs innecesarios y
> monetización artificial SIN abrir features nuevas. Priorizar ocultar / renombrar
> / flags antes que lógica nueva.
> Confianza: ALTA salvo donde se marca (M) medio / requiere confirmación on-device.

---

## Decisión de producto — Shields (founder, 2026-07-07)

Para la entrega MiniPay, **Shield = COMBO Shield**:
- Protege la continuidad **intra-sesión (S1)** cuando fallas un ejercicio.
- **NO** se comunica como rescate del Daily Streak (S2).
- Copy obligado: **"Use a Shield to keep your COMBO going"**. Prohibido cualquier
  copy que diga que el Shield salva la racha diaria.
- Daily Streak (S2) no se toca; recuperación de día perdido = **backlog nuevo
  cluster ("Daily Recovery Shield")**, no en esta entrega.
- Consecuencia: **B3 NO bloquea entrega** (comportamiento actual es el intencional);
  **B10** queda solo como hallazgo de naming/conflation.

---

## A. Inventario actual

### LEARN (`/exercises` → `exercises-screen.tsx`, `mission-detail-sheet.tsx`)
Acciones y disparadores:
| Acción | Botón / trigger | Qué dispara | Costo |
|---|---|---|---|
| Guardar score OFF-chain | Verde `SAVE · {score}` (`mission-detail-sheet.tsx:337`) + overlays PieceComplete/BadgeEarned | `handleSubmitScore()` → `postScoreSave()` → `POST /api/scores/save` | **3 gratis/wallet, luego 1 Peón** (`save_game`) |
| Guardar score ON-chain | Dorado `Save` bajo "Yours for life" (`mission-detail-sheet.tsx:363`) | `handleSaveScoreOnChain()` → `/api/sign-score` (EIP-712) → `submitScoreSigned` (Scoreboard) → `/api/cache-score` | **Solo gas** (nonpayable) |
| Reintentar ejercicio | `handleRetryApplied` (ContextualActionSlot) | Reset del tablero | **Gratis** (retry sink DEPRECADO, nunca cobra) |
| Hint | Hint surface | `spend hint` | 1 Peón (PRO bypass 20/día) |
| Rescatar racha (fallo) | FailRescueModal "Use Shield" | `/api/shields/spend`; si 0 shields → fallback `attemptShieldSpendWithPeones` | 1 Shield, o **2 Peones** si sin shields |
| Daily Tactic reward | Daily flow | Acredita Peones (`+{n} Peones`, con cap diario) | gana Peones |
| Leaderboard | Dock tab "leaderboard" | `LeaderboardSheet` (puzzles semana) | — |

- **On-chain tx en LEARN**: `submitScoreSigned` (Scoreboard `0x1681aAA1…`, mainnet, gas-only). Único write on-chain de LEARN.
- **Off-chain (DB Supabase)**: `score_saves` (vía `/api/scores/save`); daily progress; shields ledger; peones ledger.
- **localStorage**: `chesscito:save:{piece}`, `chesscito:daily-progress`, `chesscito:badge-earned:*`, `chesscito:score-pending:*` (huérfano, ver B7), `chesscito:rescue_seen`, credited-shields cache.

### PLAY (`/arena` → `arena/page.tsx`, `arena-end-state.tsx`)
| Acción | CTA | Qué dispara | Costo |
|---|---|---|---|
| Jugar otra | `Play Again` (`arena-end-state.tsx:684`) | Reset partida | Gratis |
| Coach Review | Coach section | `useCoachAnalysis` | 1 Peón si no PRO |
| Compartir | Share (OG card) | Genera OG | Gratis |
| Guardar victoria | Save Victory | Victory NFT permit-mint (LIVE) | Gas + precio NFT ($0.01–0.03) |
| Leaderboard | Dock tab "leaderboard" (`arena/page.tsx:1154,1273`) | `LeaderboardSheet` (tab "Arena wins") | — |

- **On-chain tx en PLAY**: Victory NFT mint (Save Victory). NO existe "save score on-chain" separado en PLAY — eso vive solo en LEARN.
- **Resultado básico de partida**: se refleja en stats (`arenaWins`), off-chain.

### Peones — todos los sinks
`coach:1`, `hint:1`, `save_game:1`, `shield:2`, `retry:2` (DEPRECADO, nunca cobra).
Fuente única server: `spend-service.ts:54`. PRO bypass: `pro-bypass.ts`.

### Streak — taxonomía (¡tres conceptos, dos comparten el nombre `streak`!)
Verificado 2026-07-07 tras duda del founder. Son mecánicas distintas:

| # | Concepto | Fuente | Definición | Etiqueta UI | Reset |
|---|---|---|---|---|---|
| S1 | **Exercise COMBO** | `lib/exercises/use-streak.ts` (`chesscito:streak`) | Ejercicios FRESH consecutivos sin fallo no-rescatado (replays NO suman) | **"×N COMBO"** (`mission-panel-candy.tsx:377`, si ≥2) | Fallo + skip → 0; fallo + Shield → preservado |
| S2 | **Daily Streak** | `lib/daily/progress.ts` (`DailyProgress.streak`) | **Días** consecutivos completando el daily | "Streak: N days" / "Daily Streak" / Focus Passport flamas (`editorial.ts:2877,3035`) | Ayer→+1; más viejo→1 |
| S3 | **Arena Win streak** | `editorial.ts:1507,1637` | Victorias PLAY consecutivas | "Current streak: N wins" / "Win streak" | — (PLAY) |

**Colisión crítica**: S1 se llama `streak`/`streakCount` en código (archivo, props,
eventos) PERO la UI lo muestra como **COMBO**; S2 también se llama `streak`. Mismo
nombre en código, mecánicas distintas → riesgo alto de conflación al desarrollar.

**Implicación para Shields (corrige supuesto del audit)**: el Shield protege **S1
(el COMBO de ejercicios)**, NO la sesión/streak diario S2. La fila D
("finish today's session to keep your streak") y el modelo de producto asumían
que el Shield rescata el **día**; hoy rescata el **combo intra-práctica**. Ver B10.

### Shields
- **Máximo**: `MAX_SHIELDS = 30` (`shield-storage.ts:16`).
- **Qué protege**: el **Exercise COMBO (S1)**, no el Daily Streak (S2). (Corrección clave.)
- **Inicial**: Welcome Pack otorga `WELCOME_PACK_SHIELDS = 3` (once-per-wallet).
- **Cómo se ganan**: Welcome Pack (3) + bonus del Season Pass (`shieldsBonus "+{count}"`).
- **Cómo se compran**: no hay SKU "comprar shields" directo (M); al agotarse, el rescue paga **2 Peones** (fallback). Variant D del rescue = upsell a pack pago / Get Peones.
- **Qué pasa al usar uno**: `onUseShield` → `/api/shields/spend` → `onRescued()` **restaura la racha inmediatamente, sin exigir completar la sesión** (`use-fail-rescue.ts:200`).

### Tesoro
- No existe superficie "Tesoro/cofre/lotería/payout". "Treasury" = dirección destino de pagos de Get Peones (canary **disabled-by-default en Prod**, PR #159). **Nada que ocultar**: es un address, no una mecánica de premio.

### NFT
- PLAY: Victory NFT (mint LIVE, permit). Sin flujo loss/withdraw activo hallado (M).
- LEARN: **no existe NFT**. El disclaimer legal ya está (`editorial.ts:1890`: "no guaranteed value… not financial instruments").

---

## B. Tabla de inconsistencias

| # | Pantalla / componente | Comportamiento actual | Por qué genera ruido | Recomendación mínima |
|---|---|---|---|---|
| B1 | LEARN save (verde) `mission-detail-sheet.tsx:337` + `save_game:1` | Guardar score básico off-chain cobra 1 Peón tras 3 gratis | Viola principio "off-chain gratis"; se siente como compra por persistencia básica | **Volver gratis** el `save_game` (no cobrar, como `retry`). Reconvertir, no cobrar |
| B2 | LEARN mission-detail-sheet | **Dos botones "Save"** (verde off-chain pago + dorado on-chain gas) | Usuario nuevo no distingue cuál usar; el reviewer pidió flujo más simple | Off-chain = automático/silencioso; dejar **un solo** botón explícito = el on-chain |
| B3 | Shield rescue `use-fail-rescue.ts:200` | Usar shield preserva el **COMBO (S1)** sin completar sesión | **RESUELTO por decisión de producto (2026-07-07): comportamiento INTENCIONAL.** El Shield es un **COMBO Shield** — protege continuidad intra-sesión, no rescata el día. NO bloquea entrega | **Sin cambio de lógica.** Solo copy: "Use a Shield to keep your COMBO going". "Daily Recovery Shield" (rescatar S2) = backlog nuevo cluster |
| B4 | `shield-storage.ts:16` `MAX_SHIELDS=30` | Máximo 30 shields | Muy por encima del máximo sano (3); inventario inflado | Bajar a **3** (constante); validar bonus Season Pass no rebalse |
| B5 | Leaderboard en PLAY `arena/page.tsx:1154` | Dock tab "leaderboard" (tab "Arena wins") visible en arena | No hay ELO/ranking real aún; promete competición inexistente | **Ocultar** el tab en PLAY (visibility/flag) |
| B6 | On-chain LEARN copy `saveOnChainCta:"Save"` / `saveOnChainPromise:"Yours for life"` | Guarda **un score de ejercicio**, copy dice "para siempre" | No es una "prueba diaria de entrenamiento"; copy sobre-promete permanencia de un score puntual | Renombrar → **"Save today's training proof"** (copy) |
| B7 | `claims/sources.ts` + `claims/actions.ts` | Sistema de claim de score = **scaffold sin cablear** (`performClaim("score")` lanza; lee key `chesscito:score-pending:` que nada escribe) | Código muerto; puede confundir en revisión | **No tocar ahora** (backlog merkle); documentado |
| B8 | `trophiesPendingHint:"Tap to claim your reward"` (editorial:3517) (M) | Copy "Claim your reward" | "Claim" sin recompensa/NFT claro se lee como promesa | Revisar si hay overlay real; si no, **suavizar copy** |
| B9 | Season Pass copy `editorial.ts:1044-1048` (M) | "Entry passes tied to future Celo community events", "Scheduled brackets" | Ambiguo/promisorio si no existe el evento | Ajustar a "may qualify for community prizes" (sin garantía) |
| B10 | Streak vs COMBO — `use-streak.ts` + `daily/progress.ts` + `mission-panel-candy.tsx:377` | S1 (combo de ejercicios) se llama `streak` en código pero "COMBO" en UI; S2 (daily) también se llama `streak`; el Shield protege S1, no S2 | Conflación de 3 conceptos con nombre solapado (riesgo al desarrollar) | **RESUELTO (producto 2026-07-07): Shield = COMBO Shield (S1).** UI mantiene "COMBO". Prohibido copy que diga que el Shield salva la racha diaria. Naming interno `streak`→`combo` = refactor opcional (no bloquea) |

---

## C. Plan de cambios mínimo

### C1. Seguros para hacer ahora (bajo riesgo)
- **B5** Ocultar dock tab "leaderboard" en `/arena` (PLAY) — flag/condición de render.
- **B6** Renombrar copy on-chain LEARN → "Save today's training proof" (`editorial.ts` + `messages/es.ts` + `messages/en.ts`, i18n parity).
- **B8/B9** Suavizar copy "Claim your reward" y Season Pass a lenguaje no financiero.

### C2. Solo copy / visibility / flags
- Todo C1 es copy/visibility.
- **B2** (parte visible): ocultar el botón verde off-chain en el sheet, dejando el guardado como comportamiento pasivo (requiere C3 para el auto-save real).

### C3. Requieren lógica
- **B1** Volver **gratis** el save off-chain: dejar de cobrar `save_game` (endpoint `/api/scores/save`; patrón idéntico al `retry` deprecado). Pequeño, server-side.
- **B2** (parte completa): auto-guardar score a DB al completar, sin tap → colapsa los dos botones en uno.
- **B4** `MAX_SHIELDS` 30 → 3 (+ revisar interacción con bonus Season Pass).
- ~~**B3** Shield exige completar sesión~~ → **DESCARTADO para esta entrega** (decisión de producto: Shield = COMBO Shield, sin cambio de lógica).

### C4. Ocultar para la entrega MiniPay
- Leaderboard PLAY (B5).
- Botón verde "SAVE · {score}" pago (B2) — al menos quitar el costo (B1) para que no se lea como compra.
- (Ya oculto) Treasury canary de Get Peones en Prod.

---

## D. Recomendación final de CTAs

| Momento | CTA recomendado | Nota |
|---|---|---|
| Completar ejercicio | *(sin CTA de guardar)* progreso se guarda solo | Off-chain automático, gratis |
| Completar rutina diaria | "Save today's training proof" (opcional, on-chain gas-only) | Voluntario, no dominante |
| Completar día del 21-Day | "Day {n} complete · {done}/21 focus days" | Refuerza hábito, sin promesa financiera |
| Perder COMBO / usar Shield | "Use a Shield to keep your COMBO going" *(hoy protege el combo S1, no el día)* | Si producto decide que Shield rescate el **día** (S2), cambiar copy + lógica (B3/B10) |
| Terminar partida PLAY | Primario "Play Again"; secundarios "Coach Review", "Share" | Sin leaderboard |
| Coach Review | "Coach Review" (1 Peón si no PRO) | Sin cambios |
| Save Victory PLAY | "Save Victory" (trofeo on-chain) | **No tocar** — narrativa clara |
| Finalización reto 21 días | "Challenge complete — you may qualify for community prizes" | Elegibilidad, no pago garantizado; NFT = backlog |

---

## E. NO implementar todavía (evitar scope creep)
1. Merkle claim de scores (B7) — dejar scaffold intacto.
2. NFT de LEARN (finalización 21 días) — solo backlog.
3. ELO / ranking real.
4. Nuevo leaderboard para PLAY.
5. Rediseño de overlays completos.
6. Rediseño de Save Victory / NFT trophy en PLAY.
7. Reforma completa de economía de Peones.
8. **Daily Streak recovery** (rescatar un día perdido de S2).
9. **Daily Recovery Shield** (Shield que rescate el día del 21-Day Challenge) — nuevo cluster/backlog, separado del COMBO Shield actual.

---

## Notas de confianza
- (M) = requiere confirmación: SKU de compra de shields (B4), copy exacto trophies/claim (B8), flujos NFT loss/withdraw en PLAY.
- Todo lo demás verificado en código a nivel file:line.
