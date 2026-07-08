# Mini-spec — MiniPay Delivery Lote 2: Off-chain save gratis + colapsar CTA verde

> Fecha: 2026-07-08 · Branch objetivo: `chore/minipay-delivery-lote2-offchain-free-save`
> Precede a Lote 2.5 (Tactical Day Gift + Proof of Consistency, ver
> `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`).

## Objetivo

- Off-chain save = **gratis** (nunca cobra Peones, funciona con 0 Peones).
- Peones **no** se usan para persistencia básica.
- On-chain proof = **única** acción explícita de valor.
- PLAY **Save Victory** intacto. MAX_SHIELDS intacto. COMBO Shield intacto.

## Estado actual (as-is)

- **Gate de cobro vive en el RPC Postgres** `save_basic_score`
  (`supabase/migrations/20260610020000_savescore_quota_recalibration.sql`):
  3 saves gratis por wallet (lifetime), luego **1 Peón** vía `peones_spend`
  con sink `save_game`. Devuelve `insufficient_peones` si no alcanza.
- `route.ts` (`/api/scores/save`) construye la attestation `save_game` +
  idempotency `spend:save_game:{saveId}` y mapea el jsonb del RPC.
- `save-service.ts`: `FREE_SCORE_SAVE_LIMIT = 3`, `SCORE_SAVE_COST_PEONES = 1`,
  `computeScoreSaveQuota()` marca `requiresPeones` cuando se agotan los free.
- UI: `mission-detail-sheet.tsx:337` → botón **verde** `Save score · {score}`
  (`shop-item-tile-buy-pill--green`) + botón **dorado** on-chain
  `Save proof` (`--gold`). `result-overlay.tsx:362` muestra pill
  `{freeSavesLeft} free saves left`.

---

## B1 — Save off-chain gratis (server/DB) · commit 1

### Contrato (to-be)

- El save off-chain SIEMPRE persiste `mode='free', peones_spent=0`.
- Nunca invoca `peones_spend` → sink `save_game` **nunca** se ejecuta como cobro.
- Nunca devuelve `insufficient_peones`. Funciona con balance 0.
- `duplicate` sigue existiendo (dedup por `save_id`).
- Retry → nuevo intento → sigue gratis.
- Coach / hint / shield **no se tocan** (siguen cobrando por su propia lógica).

### Cambios

1. **Nueva migración** `2026xxxx_savescore_always_free.sql` —
   `CREATE OR REPLACE FUNCTION public.save_basic_score(...)` (misma firma):
   - Elimina la rama PAID: sin `peones_spend`, sin `P0001`, sin
     `insufficient_peones`.
   - Siempre inserta `mode='free', peones_spent=0` y devuelve `saved/free`.
   - `duplicate` conservado. Advisory lock conservado.
   - `p_attestation_hash` permanece en la firma (compat) pero no se usa.
   - Comentario nuevo explicando "always-free, off-chain persistence".
2. `save-service.ts`:
   - `computeScoreSaveQuota()` → `requiresPeones` siempre `false`,
     `costPeones` siempre `0`. `freeRemaining` deja de ser presión (B2 lo
     retira de la UI).
   - Documentar que la persistencia básica ya no consume el sink `save_game`.
   - `SCORE_SAVE_COST_PEONES` / `FREE_SCORE_SAVE_LIMIT`: mantener export si algún
     test/lockstep lo referencia; re-anotar semántica (ya no gatilla cobro).
3. `route.ts`:
   - La rama `insufficient_peones` (409) queda inalcanzable → removerla o
     dejarla como defensa muerta documentada (preferido: removerla para no
     mentir el contrato). La construcción de la attestation `save_game`
     pasa a ser innecesaria → simplificar.

### Tests (primero) — B1

- Route: 4º, 5º… save → `saved/free` (nunca `peones`, nunca 409).
- Route: balance 0 → `saved/free`.
- Route: nunca se llama `peones_spend` (ya cubierto por
  "only ever calls save_basic_score RPC"; reforzar que no hay 409).
- Retry (nuevo saveId) → gratis.
- Schema test (`save-basic-score-schema.test.ts`): nuevas aserciones sobre la
  migración always-free (no `peones_spend`, no `insufficient_peones` en el
  cuerpo vigente). Ajustar/segregar las aserciones legacy que leen el init.
- Lockstep TS↔SQL revisado para no romper.

---

## B2 — Colapsar/reducir botón verde (UI/copy) · commit 2

### Objetivo

- El verde off-chain **no** comunica compra ni compite con el dorado on-chain.
- Único CTA explícito de valor = **on-chain proof** (dorado, sin cambios).
- Off-chain = guardado gratuito automático / estado informativo.

### Enfoque (preferido)

1. **Auto-guardar off-chain** una vez al alcanzar el estado listo con score
   pendiente (`phase === "ready" && scorePendingNew && address`), disparando
   `handleSubmitScore()` de forma idempotente:
   - Guardas: `submittingScoreRef` (una sola vez) + dedup server por `saveId`
     (`duplicate` es no-op) → sin doble guardado.
2. Reemplazar el **botón verde** por un **estado informativo** no accionable:
   `✓ Score saved` (chip/pill tipo texto, no botón, sin costo, sin Peones).
3. **Fallback de recuperación**: si el auto-save falla (network/503), mostrar
   un botón manual `Save score` (gratis, sin paywall, estilo neutro que NO
   compite con el dorado) para que el usuario no quede bloqueado.
4. `result-overlay.tsx`: **retirar** el pill `{freeSavesLeft} free saves left`
   y el plumbing `freeSavesLeft` asociado (ya sin sentido).
5. Copy i18n paridad ES/EN en `editorial.ts` + `messages/es.ts`
   (`scoreSaved` / `savedAutomatically`).

### Estados UI (enumeración, requisito CLAUDE.md)

| Estado | Verde off-chain | Dorado on-chain |
|--------|-----------------|-----------------|
| score pendiente, auto-save en curso | spinner breve o nada | visible (proof) |
| auto-save OK | `✓ Score saved` (informativo) | visible (proof) |
| auto-save falló | botón `Save score` (gratis, neutro) | visible (proof) |
| ya guardado (duplicate) | `✓ Score saved` | visible/estado guardado |
| sin score pendiente | oculto | oculto |

### No cambiar (B2)

- Lógica on-chain / dorado `Save proof`.
- PLAY Save Victory / NFT trophy.
- Flujo GREAT FOCUS, Tactical Day Gift, fuego del día.
- Overlays completos (solo el bloque de save CTA).

---

## Restricciones globales

- No crear NFT de LEARN. No ELO/ranking. No Daily Streak recovery.
- No tocar MAX_SHIELDS. No reabrir Lote 1 salvo bug directo.
- i18n parity ES/EN. Commits atómicos. Tests afectados → suite → lint → typecheck.

## Commits

1. `feat(scores): off-chain save is always free (no Peones sink)` — B1 DB+server+tests.
2. `feat(learn): collapse off-chain save CTA into informative state` — B2 UI/copy+tests.
3. (opcional) `docs: Lote 2 spec + Lote 2.5 backlog + delivery audit`.

## Riesgos

- **Migración hosted**: la always-free `save_basic_score` se aplica en
  deploy/CI (no dashboard). Verificar que el CREATE OR REPLACE no rompa el
  contrato de `score_saves` (mode check sigue `in ('free','peones')`; solo
  dejamos de escribir `'peones'` desde saves, filas históricas intactas).
- **Auto-save timing (B2)**: el efecto debe correr exactamente una vez; guardas
  ref + dedup server. Fallback manual cubre fallos.
- **Peones acumulados**: usuarios que ya gastaron Peones en saves previos no se
  reembolsan (fuera de alcance; nota QA).
- **Lockstep TS↔SQL**: cambiar el modelo de cobro sin romper el guard que pinea
  constantes; revisar `save-basic-score-schema.test.ts`.

## QA manual esperado

- LEARN: completar ejercicio con 0 Peones → score se guarda (off-chain) sin
  prompt de compra; aparece `✓ Score saved`; dorado `Save proof` sigue como
  único CTA accionable.
- Repetir 4+ veces → nunca pide Peones.
- Coach/hint/shield siguen cobrando.
- PLAY: Save Victory intacto.
