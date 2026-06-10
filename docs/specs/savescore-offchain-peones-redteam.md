# Red Team Review — savescore-offchain-peones (round 2)

**Date**: 2026-06-09
**Reviewer mindset**: hostile QA + senior engineer
**Spec under review**: `docs/specs/savescore-offchain-peones.md` (P0-closed revision)
**Round 1 verdict**: NEEDS REVISION (3 P0). This round re-audits after founder decisions.

## P0 status from round 1

- **[dedup-schema]** → **CLOSED.** Tabla nueva `score_saves` con `save_id` UNIQUE NOT NULL.
  `scores` queda intacto. El replay del mismo `save_id` falla el 2.º insert → `duplicate`. Resuelve
  la inflación del leaderboard y el doble-row. Sin ALTER riesgoso a `scores`.
- **[quota-source]** → **CLOSED.** `freeUsed = count(score_saves WHERE wallet = lower(player))`,
  por **wallet**, monotónico. Forjar `gameId` no evade (cada save crea fila para esa wallet).
- **[double-charge-window]** → **CLOSED.** RPC transaccional `save_basic_score`: insert de
  `score_saves` + debit en `peones_ledger` en una sola transacción Postgres. Elimina la ventana
  save↔charge por completo.

## Findings (round 2)

### P0 — Must address before implementation

- **(ninguno)** — los tres P0 de round 1 están cerrados con decisión de diseño concreta. No
  aparecen P0 nuevos. Quedan P1 a resolver durante TDD, no bloqueantes del arranque.

### P1 — Should address (en TDD, no bloquean el inicio)

- **[ledger-rpc-coupling] El debit dentro de la RPC debe respetar la idempotency del ledger
  existente.** Hoy el spend pasa por `/api/peones/spend` (helpers en `spend-service.ts` +
  `spend-rpc` migración `20260608000000_peones_spend_rpc.sql`). La nueva RPC `save_basic_score`
  inserta el debit directamente, **bypasseando** el endpoint y sus validaciones (cost table,
  metadata whitelist, prefix check). **Risk:** divergencia — dos caminos que escriben `save_game`
  con reglas distintas. Mitigar: la RPC debe reusar la MISMA función SQL de spend (o replicar su
  unique-key + cost check), no insertar crudo en `peones_ledger`. Verificar el contrato de
  `peones_spend_rpc` antes de codificar.

- **[balance-read-in-tx] Verificar balance dentro de la transacción debe ser consistente.** El
  paso 6 "verificar balance Peones" y luego insertar el debit pueden correr sobre una vista
  (`peones_balances`) que agrega el ledger. Bajo concurrencia (dos saves de pago en paralelo de la
  misma wallet con saldo para solo uno), ambos pueden leer balance suficiente antes de insertar.
  **Risk:** balance negativo. Mitigar: el check de balance debe ser parte atómica del debit (la
  función de spend existente probablemente ya lo hace con un guard — confirmar), no un SELECT
  previo seguido de INSERT.

- **[leaderboard-view-undefined] La forma del leaderboard combinado sigue abierta.** El spec deja
  `leaderboard_combined_v` vs ampliar `get_leaderboard` para TDD. **Risk:** si `get_leaderboard`
  (RPC) y la fallback view `leaderboard_v` (queries.ts:113-116) divergen, el leaderboard muestra
  datos distintos según el path. Decidir UNA fuente y que el fallback lea lo mismo. Además: unir
  `scores` + `score_saves` por `player` requiere que ambas usen la misma normalización (lowercase) —
  ya cubierto, pero testear el JOIN/UNION agregado.

- **[rate-limit-shared-bucket] El rate-limit suave no debe colisionar con el del spend.** Si
  `/api/scores/save` y `/api/peones/spend` comparten infraestructura de rate-limit por wallet, un
  save de pago consume cuota de ambos. **Risk:** falsos `rate_limited`. Usar un bucket dedicado para
  el save.

### P2 — Nice to clarify

- **[saveId-branded] `ScoreSaveId = string`** sigue siendo laxo; un branded type evitaría pasar un
  string arbitrario. Cosmético.
- **[metadata-shape] `score_saves.metadata jsonb`** sin whitelist declarada.** Si se acepta
  metadata del cliente, aplicar un sanitizer como el de `spend-service.ts`. Si no se usa en MVP,
  dejar siempre `null`.
- **[free-quota-no-pro] `proActive` reservado pero el conteo es lifetime.** Cuando PRO active el
  bump, "lifetime 5" puede sentirse mezquino para un usuario PRO que ya gastó sus 5 como free. No es
  problema ahora; anotar que el bump PRO podría necesitar un offset, no solo un límite mayor.
- **[is-verified-constant] `score_saves` sin columna `is_verified`** — el spec la trata como
  constante `false` en la view. Bien (evita columna muerta), pero documentar que el día que un save
  off-chain se "promueva" a verified, eso ocurre por una fila en `scores`, no mutando `score_saves`.

## Categories audited (deltas vs round 1)

### Contract gaps
- Result union ahora cubre `rate_limited`. ✅ `ScoreSaveMode` reducido a `free|peones` (coherente).
- DDL de `score_saves` explícito con CHECKs. ✅ Falta declarar el contrato de la RPC `save_basic_score`
  (input/output SQL) — añadir en el spec o como primer test del TDD.

### Behavioral ambiguity
- "verificar balance" (paso 6) — ver P1 balance-read-in-tx. Único punto no-determinista restante.
- Resto de transiciones determinista y testeable. ✅

### Hidden assumptions
- Asume que existe una función SQL de spend reusable dentro de la RPC (P1 ledger-rpc-coupling).
- Asume que `peones_ledger` permite insert directo desde otra RPC con la misma idempotency key — verificar
  el unique constraint del ledger (`idempotency_key`).

### Backward compatibility
- `scores` intacto → cero riesgo para el path legacy/on-chain y para `handleSubmitScore` mientras se
  migra el flujo base. ✅ Confirmar que ningún caller del básico rompe al cambiar a `/api/scores/save`.
- Leaderboard combinado debe no romper consumidores actuales de `get_leaderboard`.

### Security & data
- Score client-asserted: declarado explícito (§ Score integrity). ✅
- Rate-limit suave + `enforceOrigin`. ✅ (afinar bucket — P1).
- `player` validado/lowercased. ✅

### Test coverage gaps
- Todos los acceptance criteria testables, incluido el caso atómico (insufficient → 0 filas) y el
  concurrente (replay → 1 fila). ✅
- Añadir test del contrato de la RPC (input inválido, balance negativo imposible).

### Operational readiness
- Telemetría: 5 eventos definidos. ✅
- Rollback: el path on-chain sigue vivo; si el endpoint nuevo falla, se puede reactivar
  `handleSubmitScore` on-chain detrás de un flag — recomendado declarar ese flag en TDD.

## Verdict

**READY for /tdd** — los 3 P0 están cerrados con decisiones de diseño concretas y verificables. Los
P1 restantes (reuso de la función de spend en la RPC, balance-check atómico, forma del leaderboard
combinado, bucket de rate-limit) son detalles de implementación que se resuelven **dentro** del
ciclo TDD con tests que los fuerzan, no requieren otra ronda de spec. Recomendación de orden para
`/tdd`: (1) tabla + RPC `save_basic_score` con su test de contrato → (2) `save-service.ts` puro →
(3) endpoint + rate-limit → (4) leaderboard combinado → (5) wireup UI reemplazando el path on-chain
→ (6) telemetría. Verificar el contrato de `peones_spend_rpc` ANTES del paso 1.
