# Handoff — SaveScore off-chain/Peones cluster COMPLETE (Slices 1-6)

> 2026-06-10. Cluster cerrado sobre `main`. Spec → red-team → TDD por slices.
> Slices 1-6 verdes y commiteados. **NO promovido a production.**

## 1. Resumen ejecutivo

El **Save Score básico** se migró de un flujo on-chain (firma EIP-712
`/api/sign-score` rate-limited + tx `submitScoreSigned` al contrato `Scoreboard`)
a un flujo **off-chain DB-backed** (`POST /api/scores/save` → tabla `score_saves`).

- El nuevo flujo **mata el 429** del signer (no hay rate-limiter agresivo de firma):
  el save básico es de baja fricción, sin firma, sin tx, sin approve.
- **Primeros 5 saves gratis por wallet** (lifetime, MVP). A partir del 6.º, el save
  **cuesta 1 Peón** (debitado atómicamente vía `peones_spend`).
- El **path on-chain `Scoreboard` se conserva intacto** (sign-score +
  `submitScoreSigned` + helpers de contrato) reservado para el futuro
  **Leaderboard Proof / Trophy** (prestige, on-chain verificable). Solo tipos
  placeholder en este cluster (`LeaderboardProofKindFuture` en `save-service.ts`).
- La tabla `scores` **legacy** (one-row-per-ScoreSubmitted on-chain) queda
  **intacta**: el cluster nunca la altera. La nueva `score_saves` es exclusiva del
  gameplay fluido off-chain.
- El **leaderboard normal incluye ambos planos**: una view combinada une `scores`
  (verificación real vía passport) + `score_saves` (`is_verified=false`).

Spec: `docs/specs/savescore-offchain-peones.md` + red-team `...-redteam.md`.
Audit base: `docs/product/chesscito-payment-economy-and-coach-flow-audit-2026-06-09.md` §0/§2/§6.

## 2. Commits incluidos (todos en `main`)

| Etapa | Commit | Qué |
|---|---|---|
| Spec + red-team | `366efd87` | spec + red-team (P0 cerrados) |
| Slice 1 — DB/RPC | `b6391815` | `score_saves` + RPC atómico `save_basic_score` + schema-guard (23) + smoke SQL |
| Slice 2 — service puro | `40e88375` | `lib/scores/save-service.ts` (`computeScoreSaveQuota`, `deriveScoreSaveId`) + lockstep (15) |
| Slice 3 — endpoint | `e38a21c1` | `POST /api/scores/save` (17) + bucket rate-limit suave dedicado |
| Slice 4 — leaderboard combinado | `5585e486` | `leaderboard_combined_v` + `get_leaderboard()` re-apuntado + schema-guard (17) + smoke |
| Slice 5 — UI rewire | `43d1188c` | `save-client.ts` `postScoreSave` (14) + `handleSubmitScore` off-chain + overlay `spentPeones` + copy EN/ES + VR |
| Slice 6 — telemetry | `08994a74` | `save-telemetry.ts` (5 eventos `score_save_*`) (10) + wire 1-evento-por-response |

Handoff intermedio: `docs/handoffs/2026-06-09-savescore-offchain-slices-1-3-handoff.md`.

## 3. Arquitectura final

```
[Exercises SaveScore CTA]
        │  handleSubmitScore() (exercises-screen.tsx)
        ▼
postScoreSave()  ── lib/scores/save-client.ts
        │  deriva gameId=String(score) + saveId=deriveScoreSaveId(player,levelId,gameId)
        ▼
POST /api/scores/save  ── app/api/scores/save/route.ts
        │  enforceOrigin (403) + enforceScoreSaveRateLimit (429 suave)
        │  parse + re-derive saveId + build attestation
        ▼
RPC save_basic_score(...)  ── migrations/20260609000000_score_saves_init.sql
        │  advisory-lock por wallet → dedup save_id → quota count
        │  free(<5)  → insert mode='free'  (peones_spent=0)
        │  paid(>=5) → peones_spend('save_game',1) + insert mode='peones'
        ▼
TABLE public.score_saves   (save_id UNIQUE, wallet, level_id, score, time_ms, game_id, mode, peones_spent)

[Leaderboard read]
get_leaderboard()  ──► VIEW leaderboard_combined_v  ── migrations/20260610000000_leaderboard_combined_view.sql
        UNION ALL: public.scores (legacy on-chain) + public.score_saves (off-chain)
        MAX por (player,level) → SUM por player → rank → LIMIT 10
        is_verified = COALESCE(passport_cache.is_verified, false)
queries.ts fallback (.from) → MISMA view (sin divergencia RPC/fallback)

[Telemetry]
emitScoreSaveTelemetry(result, ctx)  ── lib/scores/save-telemetry.ts
        result → score_save_{free|paid|duplicate|insufficient|failed} (track 1x)
```

Piezas clave:
- **Tabla**: `public.score_saves` (separada de `scores`; dedup por `save_id` UNIQUE, no `tx_hash`).
- **RPC**: `public.save_basic_score(...)` — una transacción; reusa `peones_spend` en el paid path.
- **Endpoint**: `POST /api/scores/save` — transporte + re-derivación saveId + rate-limit suave; cero on-chain.
- **Service puro**: `lib/scores/save-service.ts` — quota math + `deriveScoreSaveId` (sin DB/HTTP/UI).
- **Client**: `lib/scores/save-client.ts` — `postScoreSave` mapea HTTP → `BasicScoreSaveResult`; degrade controlado.
- **View**: `leaderboard_combined_v` (+ baseline IF NOT EXISTS de `scores`/`passport_cache`; `leaderboard_v` intacto).
- **RPC leaderboard**: `get_leaderboard()` lee del combinado (firma de respuesta 4-col preservada).
- **UI**: `handleSubmitScore` usa el endpoint off-chain; `result-overlay` con `spentPeones` (pill 1 Peón).
- **Telemetry**: `lib/scores/save-telemetry.ts` (5 eventos).

## 4. Garantías (verificadas)

- ❌ **No** `/api/sign-score` en el flujo base (solo lo usa claim-badge vía `requestSignature`).
- ❌ **No** `submitScoreSigned` en el flujo base.
- ❌ **No** wallet tx, **no** approve, **no** prompt de firma.
- ❌ **No** 429 del signer (rate-limit del save es suave, 30/min, con `retryAfterMs`).
- ✅ **Dedup** por `save_id` UNIQUE (replay del mismo save_id → `duplicate`).
- ✅ **Quota por wallet** (`freeUsed = count(score_saves WHERE wallet)`, 5 free + 1 Peón).
- ✅ **Paid save atómico** vía `peones_spend` en la misma transacción (save + debit, todo o nada).
- ✅ **Insufficient** (`P0001`) → **no fila, no debit** (rollback del subtxn del spend).
- ✅ **Duplicate** → no segunda fila ni segundo cobro (incl. concurrente, advisory-lock).
- ✅ **Leaderboard** incluye filas `score_saves` como `is_verified=false` (off-chain-only sin passport).

## 5. Telemetry

5 eventos client-side vía el stack `track`, uno por response (dispatcher único,
`emitScoreSaveTelemetry`):

| Evento | Cuándo | Props clave |
|---|---|---|
| `score_save_free` | saved/free | mode, spent:0, freeRemaining, requiresPeones |
| `score_save_paid` | saved/peones | spent, freeRemaining, requiresPeones |
| `score_save_duplicate` | duplicate | freeRemaining, requiresPeones |
| `score_save_insufficient` | insufficient_peones | required, balance, requiresPeones |
| `score_save_failed` | rate_limited / invalid / error / fetch fail | reason, retryAfterMs \| detail |

Base payload (todos): `piece, levelId, score, timeMs, saveId, source:"exercises"`.
**Sin wallet / PII** (telemetría anónima session-scoped).

## 6. Tests / QA

- **Smoke SQL runtime Slice 1** (`score_saves_smoke.sql`): PASS en Postgres 15 (Docker efímero), 6 casos.
- **Smoke leaderboard combinado** (`leaderboard_combined_smoke.sql`): PASS, 6 casos (ranking 3 players, MAX cross-source, verified/unverified, RPC===view). Smoke Slice 1 re-verificado verde tras baseline.
- **VR focalizado** result overlay: `vr13-score-saved` regenerado (off-chain, sin chip CeloScan) + nuevo `vr13-score-saved-peones` (pill 1 Peón). Ambos green.
- **Full suite**: **3462/3462** (`pnpm vitest run --max-workers=2`).
- **TypeScript**: clean (`tsc --noEmit`).
- **Eslint**: clean (1 warning pre-existente en `result-overlay.tsx:570`, no introducido por el cluster).

## 7. Qué falta antes de production

1. **Push** del branch `main` al remoto si falta (verificar `git log origin/main..main`).
2. **Preview deploy** (Vercel) del estado actual.
3. **Smoke interactivo en MiniPay / mobile (390px)**:
   - Save free dentro de cuota (1.º al 5.º) → "Score Saved!" sin chip CeloScan.
   - 6.º save cobra 1 Peón → overlay con pill "1 Peón spent".
   - Insufficient Peones → estado correcto (copy "Not enough...", sin loop "Try again"); ruta a Get Peones vía el chip.
   - Leaderboard refleja el save (combinado, unverified).
   - **Confirmar no wallet tx / no approve** en todo el flujo base.
4. **Hosted migration apply** con cuidado según `docs/release/release-process.md`:
   - Aplicar `20260609000000_score_saves_init.sql` y `20260610000000_leaderboard_combined_view.sql` en el entorno correcto (hosted), **verificando contexto prod vs local** antes.
   - La baseline `IF NOT EXISTS` de `scores`/`passport_cache` es no-op en hosted (ya existen vía `schema.sql`); confirmar que no choca.

## 8. Riesgos / notas

- **Migración nueva**: `score_saves` + `save_basic_score` + `leaderboard_combined_v` son DDL no aplicado en hosted aún. **No promover sin aplicar/validar la migración** en el entorno correcto (release process). Repo sin `config.toml` local (CLI linkeado a hosted); para smoke local usar Docker `postgres:15` + roles supabase + migraciones en orden (receta en handoff Slices 1-3).
- **On-chain Leaderboard Proof** queda futuro: tipos placeholder presentes, sin behavior/contrato/pricing. Reusa el path on-chain retenido.
- **Score off-chain NO es anti-cheat fuerte**: `score`/`timeMs` son client-asserted (sin firma server). Aparece en el leaderboard como **unverified** (`is_verified=false`). La integridad fuerte vive en el Proof futuro.
- **PRO quota bump / bypass** queda futuro (hook `proActive` reservado en `computeScoreSaveQuota`, no-op MVP).
- **Victory NFT** intacto (path on-chain de victorias no tocado). Get Peones / Coach / contracts / payment rail / Labyrinths tampoco.
- **Maquinaria on-chain de score-tx dormida** en `exercises-screen` (submitTxHash/receipt effects/txToast): inerte tras el rewire (auto-referencial, cero huérfanos). Chore opcional de limpieza, no bloquea nada.

## 9. Próximo paso recomendado

1. **Smoke preview + plan de migración hosted** (§7).
2. **Promote `main → production`** (FF flow de `release-process.md`) si todo verde.
3. Después, elegir el siguiente bloque entre:
   - **Leaderboard Proof on-chain** (prestige lane, reusa el path retenido).
   - **Deep Hint / nuevos sinks** de Peones.
   - **Labyrinths integrados** (continuar el roadmap de labyrinths).

---

_Cluster cerrado por sesión 2026-06-10. Working tree limpio, todo en `main`,
no promovido a production._
