# Spec — savescore-offchain-peones

**Date**: 2026-06-09
**Status**: draft (P0 closed, ready for red-team re-run)
**Source audit**: `docs/product/chesscito-payment-economy-and-coach-flow-audit-2026-06-09.md` §0, §2, §6, §7
**Founder decisions**: tabla nueva `score_saves` (no alterar `scores`); free quota 5 + 1 Peón;
quota por wallet; operación transaccional (RPC); proof on-chain = placeholder futuro.

## Problem

El **Save Score básico** mete una firma EIP-712 rate-limited (`/api/sign-score`, 5 req/60s por IP +
3/60s por wallet) **más** una tx on-chain (`submitScoreSigned` al `Scoreboard`) en la continuidad
natural del juego. El síntoma observable es un **429 en loop**: "Try again" re-dispara
`handleSubmitScore()` sin backoff (audit §2). Viola el principio §0 (gameplay fluido = baja
fricción, sin tx/approve en el flujo base).

El leaderboard **ya** lee de la DB (`leaderboard_v`), no de la cadena → la escritura on-chain es
**redundante para el ranking**. Mover el save básico a off-chain es bajo riesgo.

## Goal

El Save Score básico guarda off-chain en una tabla nueva `score_saves` sin firma ni tx (matando el
429), aparece en el leaderboard normal como `is_verified=false`, da 5 saves gratis por wallet y
luego cuesta 1 Peón por save, todo en **una operación transaccional** anti-doble-cobro. El path
on-chain se conserva intacto como base de un futuro Leaderboard Proof.

## Non-goals

- **NO** implementar el On-chain Score Proof / Trophy (solo tipos placeholder marcados `future`).
- **NO** alterar `scores` ni `leaderboard_v` en este bloque (salvo lectura combinada — ver §
  Leaderboard). No hay ALTER a `scores`.
- **NO** borrar `/api/sign-score`, la firma EIP-712, `submitScoreSigned` ni los helpers del
  `Scoreboard` — se conservan, se desconectan del flujo base.
- **NO** poner el path on-chain detrás de PRO ni como fallback automático del básico.
- **NO** tocar Victory NFT, contratos, Labyrinths ni el payment rail (Get Peones).
- **NO** decidir contrato/NFT/pricing del proof on-chain (audit §6).
- **NO** agregar más packs de Peones ni más sinks en este spec.

## Contracts (SDD)

Módulo puro nuevo `apps/web/src/lib/scores/save-service.ts` (sin Supabase/HTTP/UI — patrón de
`peones/spend-service.ts`). El endpoint `POST /api/scores/save` orquesta validación + RPC
transaccional. Reusa el spend target **`save_game`** ya existente (`SPEND_COST_BY_TARGET.save_game
= 1`, idempotency `spend:save_game:`).

```ts
// apps/web/src/lib/scores/save-service.ts

/** Free basic saves per wallet (lifetime, MVP). Calibrable. Founder 2026-06-09. */
export const FREE_SCORE_SAVE_LIMIT = 5;

/** Peones cost per basic save beyond the free quota. Single source of truth;
 *  a lockstep test asserts === SPEND_COST_BY_TARGET.save_game. */
export const SCORE_SAVE_COST_PEONES = 1;

/** Base flow is off-chain only. On-chain proof is a separate future lane. */
export type ScoreSaveMode = "free" | "peones";

/** Deterministic dedup / idempotency seed for one submission. Built from
 *  exercise context; server RE-DERIVES and rejects a mismatch. NO tx_hash.
 *  Format: `${player}:${levelId}:${gameId}` lowercased. */
export type ScoreSaveId = string;

export type BasicScoreSaveRequest = {
  player: `0x${string}`;
  levelId: number;          // 1..6
  score: number;            // > 0
  timeMs: number;           // > 0
  gameId: string;           // drives saveId; quota counts per WALLET, not gameId
  saveId: ScoreSaveId;
};

/** Snapshot of where a wallet sits against the free quota. */
export type ScoreSaveQuota = {
  wallet: string;           // lowercase 0x
  freeLimit: number;        // = FREE_SCORE_SAVE_LIMIT
  freeUsed: number;         // count(score_saves WHERE wallet) — per wallet, monotonic
  freeRemaining: number;    // max(0, freeLimit - freeUsed)
  requiresPeones: boolean;  // freeRemaining === 0
  costPeones: number;       // SCORE_SAVE_COST_PEONES when requiresPeones, else 0
};

/** Discriminated result of POST /api/scores/save → mirrors the RPC return. */
export type BasicScoreSaveResult =
  | { status: "saved"; mode: "free"; quota: ScoreSaveQuota }
  | { status: "saved"; mode: "peones"; spent: number; quota: ScoreSaveQuota }
  | { status: "duplicate"; quota: ScoreSaveQuota }                 // idempotent replay
  | { status: "insufficient_peones"; required: number; balance: number; quota: ScoreSaveQuota }
  | { status: "invalid"; reason: string }                          // 400-class
  | { status: "rate_limited"; retryAfterMs: number }               // soft limit
  | { status: "error"; reason: string };                          // 5xx-class

/** Pure quota math — no IO. `proActive` reserved for a future PRO bump; MVP ignores. */
export function computeScoreSaveQuota(
  wallet: string, freeUsed: number, proActive?: boolean,
): ScoreSaveQuota;

/** Pure: canonical saveId. Endpoint recomputes + rejects forgery of a cheaper key. */
export function deriveScoreSaveId(player: string, levelId: number, gameId: string): ScoreSaveId;
```

### Tabla `score_saves` (migración nueva, versionada en `apps/web/supabase/migrations/`)

```sql
create table public.score_saves (
  id           bigint generated always as identity primary key,
  save_id      text        not null unique,          -- dedup + idempotency anchor
  wallet       text        not null,                 -- lowercase 0x, indexed
  level_id     int         not null check (level_id between 1 and 6),
  score        int         not null check (score > 0),
  time_ms      int         not null check (time_ms > 0),
  game_id      text        not null,
  mode         text        not null check (mode in ('free','peones')),
  peones_spent int         not null default 0 check (peones_spent in (0,1)),
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index score_saves_wallet_idx on public.score_saves (wallet);
```

```ts
// FUTURE LANE — placeholder types only. NO behavior, NO acceptance, NO impl.
// Lives under Leaderboard, NOT gameplay. Reuses the RETAINED /api/sign-score +
// submitScoreSigned + Scoreboard helpers. Pricing/contract/NFT undecided (audit §6).
export type LeaderboardProofKindFuture =
  | "weekly_rank" | "top10_weekly" | "top3_weekly" | "immortalize_game";

export type LeaderboardProofRequestFuture = {
  player: `0x${string}`;
  kind: LeaderboardProofKindFuture;  // signed via retained Scoreboard path; sets is_verified=true
};
```

## Behavior — operación transaccional (RPC `save_basic_score`)

El save NO se parte en "insert + luego spend". Una sola RPC server-side hace todo
atómicamente; el endpoint solo valida transporte y llama la RPC.

1. **Validar request**: `player` con `isAddress` + lowercase; `levelId` 1..6; `score>0`; `timeMs>0`.
   Falla → `invalid`.
2. **Derivar `save_id`** con `deriveScoreSaveId`; si difiere del enviado → `invalid` (anti-forgery).
3. **Dedup**: si `save_id` ya existe en `score_saves` → `duplicate` (sin segunda fila, sin cobro).
4. **Contar quota**: `freeUsed = count(score_saves WHERE wallet = lower(player))` — por **wallet**,
   no por gameId/saveId.
5. **`freeUsed < 5`** → insertar `score_saves(mode='free', peones_spent=0)` → `saved / free`.
6. **`freeUsed >= 5`** → en la MISMA transacción: verificar balance Peones; si alcanza →
   insertar el debit en `peones_ledger` (source `save_game`, idempotency `spend:save_game:${saveId}`)
   **y** insertar `score_saves(mode='peones', peones_spent=1)` → `saved / peones / spent:1`.
7. **`freeUsed >= 5` y saldo insuficiente** → la transacción **no** inserta nada (ni save ni debit)
   → `insufficient_peones` con `required`/`balance`; la UI ofrece **Get Peones**.
8. Ningún path dispara firma EIP-712 ni tx on-chain → elimina la causa del 429.

Atomicidad: insert de `score_saves` + insert del ledger debit ocurren dentro de la misma RPC
(transacción Postgres). O ambos commitean o ninguno → cero "cobro sin save" / "save sin cobro".
La idempotency `spend:save_game:${saveId}` + el UNIQUE en `save_id` blindan el replay concurrente.

## Edge cases

- **Replay concurrente** (mismo `save_id` en paralelo): el UNIQUE de `save_id` hace fallar el 2.º
  insert dentro de la RPC → se resuelve como `duplicate`, 1 fila, 1 cobro.
- **`gameId` forjado** para evadir cuota: inútil — `freeUsed` cuenta filas **por wallet**; cada
  save nuevo consume slot igual.
- **Spend parcial**: imposible por diseño (transacción única); no hay ventana save↔charge.
- **Wallet desconectada**: el básico requiere `player`; sin wallet, mantener quick-save local o
  pedir conexión (UI, no bloquear gameplay).
- **Supabase no configurado** (`getSupabaseServer()` → null): degradar a éxito optimista local
  **sin** cobrar Peón ni escribir ledger.
- **`gameId` repetido entre niveles**: `saveId` incluye `levelId` → no colisiona.
- **Score client-asserted**: el básico off-chain NO es anti-cheat (ver § Score integrity).

## Leaderboard integration

El leaderboard normal debe incluir `score_saves`. Sin baseline DDL de `leaderboard_v`, **no** se
altera la view existente. Decisión MVP: **nueva view `leaderboard_combined_v`** (o ampliar el RPC
`get_leaderboard`) que une `scores` (legacy, `is_verified` real) + `score_saves`
(`is_verified=false` constante), agregando por `player`/`wallet`. La fuente de verdad del ranking
sigue siendo la DB.

- SaveScore básico aparece en el leaderboard normal.
- `is_verified=false` para todas las filas de `score_saves`.
- Proof/on-chain futuro marca/verifica posiciones especiales (`is_verified=true`), fuera de scope.

## Score integrity (declarado explícito)

- El SaveScore básico off-chain **no** es proof anti-cheat fuerte: `score`/`timeMs` son
  client-asserted (sin firma server).
- Es leaderboard normal/unverified (`is_verified=false`).
- La integridad fuerte vive en el **Leaderboard Proof futuro** (path on-chain retenido).
- La UI del leaderboard debe distinguir verified vs unverified (badge), sin mezclar planos.

## Rate-limit

`/api/scores/save` lleva protección **suave** (no recrear el 429 agresivo de sign-score):

- `enforceOrigin` (igual que `cache-score`).
- Rate-limit suave por wallet/IP calibrado para uso normal (límite alto, ventana corta).
- Si se rate-limita → `rate_limited` con `retryAfterMs`; la UI muestra backoff claro (countdown),
  **nunca** "Try again" inmediato en loop.

## Telemetry

Eventos nuevos para medir el sink (audit §6):

- `score_save_free` — save gratis dentro de la cuota.
- `score_save_paid` — save con 1 Peón gastado.
- `score_save_duplicate` — replay idempotente.
- `score_save_insufficient` — saldo insuficiente, save bloqueado.
- `score_save_failed` — error de validación/servidor.

## Acceptance criteria

- [ ] `POST /api/scores/save` guarda en `score_saves` sin llamar `/api/sign-score` ni
      `submitScoreSigned` (test afirma que ninguno se invoca).
- [ ] `freeUsed < 5` → save gratis; `freeRemaining` decrementa por wallet.
- [ ] El 5.º save deja `freeRemaining = 0` / `requiresPeones = true`.
- [ ] El 6.º save cobra exactamente 1 Peón (`save_game`) y responde `saved / mode:"peones"`.
- [ ] Saldo insuficiente en el 6.º → `insufficient_peones`, **sin** fila y **sin** debit (atomicidad).
- [ ] Replay del mismo `saveId` → `duplicate`, sin segunda fila ni segundo cobro (incl. concurrente).
- [ ] `gameId` forjado no resetea la cuota (conteo por wallet).
- [ ] `computeScoreSaveQuota` y `deriveScoreSaveId` son puras con tests unitarios.
- [ ] `SCORE_SAVE_COST_PEONES === SPEND_COST_BY_TARGET.save_game` (test de lockstep).
- [ ] Supabase null → éxito optimista sin cobro ni ledger.
- [ ] El leaderboard combinado incluye filas `score_saves` con `is_verified=false`.
- [ ] Rate-limit suave responde `rate_limited` + `retryAfterMs`; no hay loop de "Try again".
- [ ] Los 5 eventos de telemetría emiten en sus paths correspondientes.

## Out of scope / future

- On-chain Leaderboard Proof / Trophy (`LeaderboardProofKindFuture`): tipos placeholder; behavior,
  contrato, pricing, NFT y endpoint en spec futuro.
- Reset/limpieza semanal del leaderboard y elegibilidad Top 10/Top 3.
- PRO quota bump / bypass (hook `proActive` reservado).
- Migrar approve+transferFrom de Victory al rail directo.
- Materializar el DDL baseline de `scores`/`leaderboard_v` (solo necesario si se altera la view;
  el MVP usa view combinada nueva para no tocarla).

## Open questions (P0 cerrados)

- ~~dedup-schema~~ → **cerrado**: tabla nueva `score_saves`, `save_id` UNIQUE. `scores` intacto.
- ~~quota-source~~ → **cerrado**: `freeUsed = count(score_saves WHERE wallet)`, por wallet.
- ~~double-charge~~ → **cerrado**: RPC transaccional `save_basic_score` (save + debit atómicos).
- Pendiente menor (TDD): forma exacta de la view/RPC del leaderboard combinado (`leaderboard_combined_v`
  vs ampliar `get_leaderboard`); decidir sin alterar `leaderboard_v`.
