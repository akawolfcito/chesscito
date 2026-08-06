# Handoff — SaveScore off-chain/Peones (Slices 1-3)

> 2026-06-09. Cluster en progreso sobre `main`. Spec → red-team → TDD por
> slices. Slices 1-3 verdes y commiteados. **Reanudar en Slice 4** (o 5).

## Resumen del cluster

Mover el **Save Score básico** de on-chain (firma EIP-712 `/api/sign-score`
rate-limited + tx `submitScoreSigned` al `Scoreboard`) a **off-chain/Peones**,
matando el **429** del rate-limiter. Split en dos planos (audit 2026-06-09 §0/§2):

- **Save básico** → off-chain, DB, leaderboard normal, baja fricción. 5 saves
  gratis por wallet, luego 1 Peón. `is_verified=false`.
- **On-chain proof/trophy** → futuro, prestige, reusa el path on-chain retenido.
  Solo tipos placeholder en este cluster.

Docs: spec `docs/specs/savescore-offchain-peones.md` + red-team
`...-redteam.md` (verdict READY for /tdd). Audit `docs/product/
chesscito-payment-economy-and-coach-flow-audit-2026-06-09.md`.

## Decisiones founder (cerradas)

- Tabla **nueva `score_saves`** (NO alterar `scores`). Dedup por `save_id` UNIQUE.
- Quota **por wallet**: `freeUsed = count(score_saves WHERE wallet)`.
  `FREE_SCORE_SAVE_LIMIT=5`, `SCORE_SAVE_COST_PEONES=1`.
- Atomicidad: RPC `save_basic_score` **reusa `peones_spend`** (no insert crudo);
  insufficient (`P0001`) → no fila, no debit.
- Path on-chain (`/api/sign-score`, `submitScoreSigned`, Scoreboard) **se conserva**,
  desconectado del base, reservado para Leaderboard Proof futuro.
- **Supabase null en el endpoint → 503 error** (NO optimista): el server no afirma
  "saved" sin persistir. El degrade optimista-local es del CLIENTE (Slice 5).

## Slices completados (commits en `main`)

| Slice | Commit | Qué |
|---|---|---|
| Spec | `366efd87` | spec + red-team (P0 cerrados) |
| 1 — DB | `b6391815` | `score_saves` + RPC `save_basic_score` + schema-guard (23) + smoke SQL |
| 2 — helpers | `40e88375` | `lib/scores/save-service.ts` puro (15 tests) + lockstep |
| 3 — endpoint | `e38a21c1` | `POST /api/scores/save` (17 tests) + bucket rate-limit dedicado |

### Slice 1 — `apps/web/supabase/migrations/20260609000000_score_saves_init.sql`
- Tabla `score_saves(id, save_id UNIQUE, wallet+regex, level_id 1-6, score>0,
  time_ms>0, game_id, mode free|peones, peones_spent 0|1, metadata, created_at)`
  + índices wallet / wallet+created_at + RLS server-only.
- RPC `save_basic_score(p_save_id, p_wallet, p_level_id, p_score, p_time_ms,
  p_game_id, p_attestation_hash, p_metadata default null) returns jsonb`:
  `pg_advisory_xact_lock(hashtext(lower(wallet)))` → dedup → count → free(<5) /
  paid(≥5 vía `peones_spend`).
- **Validado en Postgres 15 real** (Docker efímero): migración aplica limpio +
  smoke 6 casos PASS + inspección de ledger (1 fila spend/save_game, idempotency
  `spend:save_game:{saveId}`, attestation pasa, replay no duplica).
- Smoke: `apps/web/supabase/tests/score_saves_smoke.sql` (rollback-safe).
- **Nota DB local**: el repo NO tiene `config.toml` (CLI linkeado a hosted, no
  dev local). La `scores` table NO está versionada → no existe en DB local; el
  smoke lo maneja con `undefined_table`. Receta para correr el smoke en vivo:
  `docker run --rm -d --name pg-smoke postgres:15` → crear roles `anon/authenticated/
  service_role/authenticator` → aplicar las 4 migraciones versionadas en orden →
  `psql -f supabase/tests/score_saves_smoke.sql` → `docker rm -f pg-smoke`.
  🧯 **Corregido el 2026-08-06**: la receta original decía `docker run -d --name pg`
  **sin `--rm`**, y cada corrida dejaba el contenedor y su volumen anónimo colgados.
  Es la convención de `CLAUDE.md` § Command hygiene.

### Slice 2 — `apps/web/src/lib/scores/save-service.ts`
- `computeScoreSaveQuota(wallet, freeUsed, proActive?)` (clamp NaN/neg/frac,
  lowercase, proActive no-op MVP), `deriveScoreSaveId(player, levelId, gameId)`
  (`${player}:${levelId}:${gameId}` lowercased, determinístico, sin tx/time/random).
- `FREE_SCORE_SAVE_LIMIT=5`, `SCORE_SAVE_COST_PEONES=1` + lockstep test vs
  `SPEND_COST_BY_TARGET.save_game`. Tipos `BasicScoreSaveResult` (union),
  `LeaderboardProofKindFuture`/`RequestFuture` (placeholder future).

### Slice 3 — `apps/web/src/app/api/scores/save/route.ts`
- Valida transporte + re-deriva saveId; `enforceOrigin` (403) + bucket dedicado
  `enforceScoreSaveRateLimit` (`rl:score:ip`, 30/min) en `demo-signing.ts`.
- Construye attestation `save_game` y llama RPC; mapea jsonb → `BasicScoreSaveResult`.
- Status: saved 200 · duplicate 200 · insufficient 409 · invalid 400 · forbidden
  403 · rate_limited 429 · rpc error 500 · supabase null 503.
- Cero on-chain (fetch spy + rpc-arg asserts lo prueban).

## Estado

- **Branch**: `main` (working tree limpio, todo commiteado).
- **Tests**: suite completa **3421/3421**; `tsc --noEmit` CLEAN; eslint CLEAN.
- **No tocado**: `scores`, `leaderboard_v`, `/api/sign-score`, `submitScoreSigned`,
  Scoreboard, Victory, Get Peones, Coach, contracts, UI, `handleSubmitScore`.
- **NO promovido a production** (todo en `main`).

## REANUDAR — Slice 4 (siguiente)

**Leaderboard combinado** que incluya `score_saves`:
- Decisión MVP del spec: **nueva view `leaderboard_combined_v`** (o ampliar el RPC
  `get_leaderboard`) que une `scores` (legacy, `is_verified` real) + `score_saves`
  (`is_verified=false` constante), agregando por `player`/`wallet`. **NO alterar
  `leaderboard_v`** (sin DDL baseline). 
- P1 abierto (red-team round 2): `leaderboard-view-undefined` — `get_leaderboard`
  (RPC) y la fallback view `leaderboard_v` (queries.ts:113-116) no deben divergir;
  una sola fuente. Testear el UNION/JOIN agregado + normalización lowercase.
- Migración nueva versionada + schema-guard text-based + smoke SQL en vivo.

**Luego Slice 5** — rewire del client: `handleSubmitScore()` en
`src/components/exercises/exercises-screen.tsx` (~1632) deja de llamar
`/api/sign-score` + `submitScoreSigned`; llama `POST /api/scores/save` con
`deriveScoreSaveId`. Aquí vive el **degrade optimista-local** (supabase null /
offline) + el manejo de `insufficient_peones` → Get Peones + el backoff del
`rate_limited` (sin loop "Try again"). Es donde entra UI → correr VR.

P1 pendientes para TDD (no bloquean): `ledger-rpc-coupling` ya resuelto (reusa
`peones_spend`); `balance-read-in-tx` resuelto (atómico vía RPC); falta telemetría
(5 eventos `score_save_*`) — sumar en Slice 5/6.

## Open questions

- Slice 4: ¿view nueva `leaderboard_combined_v` vs ampliar `get_leaderboard`?
  (decidir sin tocar `leaderboard_v`). Recomendación: view combinada nueva + que
  `get_leaderboard` lea de ella, manteniendo la firma de respuesta actual.
- ¿`scores` legacy se materializa como migración baseline algún día? Solo necesario
  si se altera la view; el MVP evita tocarla.
