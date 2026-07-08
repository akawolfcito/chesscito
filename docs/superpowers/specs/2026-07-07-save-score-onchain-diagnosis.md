# Save Score On-Chain — Diagnóstico de estado actual (2026-07-07)

> Pre-spec. Objetivo: responder "¿qué tenemos hoy, cómo se presenta, cuánto
> esfuerzo falta, y qué está de más?" antes de decidir el diseño.
> Contexto: MiniPay listing feedback thread #2 ("validar save-score-onchain gas-only").

## TL;DR

- El **save on-chain gas-only YA existe, está implementado y está LIVE en mainnet.**
  No falta plumbing para guardar el score on-chain. `submitScoreSigned` es
  `nonpayable` → solo cuesta gas (sin Peones, sin approve/transfer de token).
- Hoy conviven **dos** saves en el mismo sheet: off-chain (default, DB + Peones)
  y on-chain ("Tuyo para siempre", gas-only). Riesgo UX: dos botones "Save".
- El objetivo de negocio que describiste — que los scores **cuenten en los merkle
  de claim** para trazabilidad/monetización — **NO está conectado** a ninguno de
  los dos saves. El sistema de claims de score es un **scaffold sin cablear**.

## 1. Qué existe hoy (dos caminos, ambos en `exercises-screen.tsx`)

### A) Save OFF-CHAIN — el default primario
- Handler: `handleSubmitScore()` (línea ~1600) → `postScoreSave()` → `POST /api/scores/save`.
- Costo: **3 saves gratis por wallet, luego 1 Peón** (`FREE_SCORE_SAVE_LIMIT=3`,
  `SCORE_SAVE_COST_PEONES=1` en `save-service.ts`).
- Sin tx, sin gas, sin firma. Solo DB (Supabase `score_saves`).
- UI: botón verde `SAVE · {score}` (`mission-detail-sheet.tsx:337`).
- Alimenta el leaderboard combinado por defecto.

### B) Save ON-CHAIN — "revived" 2026-06-11, gas-only
- Handler: `handleSaveScoreOnChain()` (línea ~1740).
- Flujo: `/api/sign-score` (firma EIP-712 server-side) → `writeContract`
  `submitScoreSigned(levelId, score, timeMs, nonce, deadline, signature)`
  sobre Scoreboard → write-through a Supabase vía `/api/cache-score`.
- **Gas-only confirmado**: ABI `submitScoreSigned` es `stateMutability: nonpayable`.
  No hay `value`, no hay approve/transfer de ERC20, no descuenta Peones.
  El único costo para el usuario es el gas de la tx.
- UI: botón dorado "Save" bajo la promesa **"Yours for life" / "Tuyo para siempre"**
  (`saveOnChainPromise`, `mission-detail-sheet.tsx:363`).
- Gate: `canSaveOnChain = scorePendingNew && scoreboardAddress != null`.
- El leaderboard marca estas filas con `has_onchain=true` y muestra un badge
  (`leaderboard-sheet.tsx:348`). Es la única señal visible de "on-chain".

### Contrato / infra
- Scoreboard **desplegado en Celo Mainnet**: `0x1681aAA176d5f46e45789A8b18C8E990f663959a`
  (`.env.mainnet:7`, `NEXT_PUBLIC_SCOREBOARD_ADDRESS`). Público, no secreto.
- Signer server-side firma el typed-data (`/api/sign-score`).
- Es exactamente "como lo hacíamos antes": el path original, revivido como
  segunda acción explícita.

## 2. El gap real: scores on-chain ↔ merkle de claim

Tu narrativa: guardar score on-chain para que **cuente en listas / merkle de claim**
y afiance que los scores se consumieron con items que interesan a MiniPay
(trazabilidad + generar tx = señales de app viva).

Estado actual del sistema de claims (`lib/claims/`):
- `sources.ts` lee scores pendientes de localStorage key `chesscito:score-pending:{key}`.
  **Nada en el codebase escribe esa key hoy** (ni el save off-chain ni el on-chain
  la escriben — el on-chain usa `pendingSubmitRef` + `chesscito:save:`).
- `actions.ts::performClaim("score")` es un **STUB que lanza**:
  `"performClaim score: wire to existing scoreboard.save flow in Task 4.2"`.
- No existe contrato merkle de score-claim ni endpoint que genere pruebas.

Conclusión: el "merkle de claim para scores" **nunca se cableó** (quedó en Task 4.2
sin ejecutar). El save on-chain actual escribe a Scoreboard + leaderboard, pero eso
NO es lo mismo que un claim merkle consumible.

## 3. ¿Necesitamos implementación? — respuesta por objetivo

| Objetivo | ¿Falta código? | Esfuerzo |
|---|---|---|
| Guardar score on-chain gas-only | **No.** Ya live en mainnet. | 0 — solo validar on-device |
| Que on-chain se distinga en leaderboard | **No.** `has_onchain` badge ya existe. | 0 |
| UX: evitar dos "Save" confusos | Sí, decisión de producto | Bajo (S) — reordenar/renombrar |
| Scores → elegibilidad merkle de claim | **Sí, no existe.** Stub. | Alto (L) — contrato + pruebas + endpoint |
| "Consumo de score con items" (traza monetización) | Sí, no diseñado | Alto (L) — requiere diseño económico |

## 4. Qué está de más / a decidir

- **Peones en el save off-chain**: hoy el save base cuesta Peones tras 3 gratis.
  Si el objetivo es *maximizar tx on-chain* (señal de app viva para MiniPay),
  el Peón-por-save reduce fricción PERO también evita la tx. Tensión a resolver:
  ¿queremos menos fricción (Peones/DB) o más tx (on-chain)? Los dos objetivos
  empujan en direcciones opuestas.
- **Dos botones "Save"** en el mismo sheet probablemente confunden al usuario nuevo
  (el reviewer pidió flujo más simple). Candidato a colapsar en una sola acción
  con jerarquía clara.

## 5. Preguntas abiertas para el diseño (siguiente paso)

1. ¿El save PRIMARIO para el usuario nuevo debe ser on-chain (tx = señal viva) o
   off-chain (menos fricción)? ¿O on-chain como upgrade opt-in "para siempre"?
2. ¿Queremos realmente cablear el merkle de claim de scores ahora, o el Scoreboard
   on-chain actual ya cubre la trazabilidad que MiniPay quiere?
3. ¿El costo en Peones del save off-chain se mantiene, se elimina, o se reserva
   solo para el path on-chain (subsidiar gas / gasless)?
