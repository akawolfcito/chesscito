# Chesscito — Sprint 4 Calibration: Peones Spend + Compendio TX

**Owner**: John (PM) · **Stakeholders**: Wolfcito (founder), eng
**Date**: 2026-06-08 · **Status**: Calibration — no code, awaiting founder sign-off on §12

> **Tesis Sprint 4**: Peones son el rail principal para consumibles. Stablecoin compra saldo, suscripción o assets públicos. PRO suaviza o elimina costos de consumibles.

## 1. Estado actual post-Sprint 3

- ✅ Peones ledger real en Supabase (`peones_ledger` + `peones_balances` + `peones_balance_with_caps`).
- ✅ Earn real desde Daily Tactic (`POST /api/peones/earn`, source `daily_tactic`, +3 con cap 10/UTC-day).
- ✅ Earn real desde Training delta (source `exercise_completion`, sin cap, delta de estrellas).
- ✅ HUD chip `/hub` (pawn sprite + label "N Peones", oculto en guest).
- ✅ Telemetry live: `peones_earned`, `peones_cap_reached`, `peones_balance_viewed`.
- ❌ NO spend endpoint.
- ❌ NO top-up / packs.
- ❌ NO payment rails Peones-side.
- 🟡 Coach credits siguen en Redis (separados de Peones).
- 🟡 PRO sigue como rail aparte (suscripción + extras plumbing).

## 2. Principio de producto Sprint 4

| Rail | Para qué | Cuándo |
|---|---|---|
| **Peones** | Consumibles, micro-acciones, hints, retries, coach analysis, save game, labyrinth keys | Loop de engagement diario |
| **Stablecoin (USDm/USDC/USDT)** | Saldo (Peones packs), suscripción PRO, assets públicos (VictoryNFT, themes) | Compra deliberada |
| **PRO** | Suaviza o elimina costo de consumibles + desbloquea hard/bonus content | Recurrencia mensual |

**Regla dura**: Stablecoin nunca paga micro-acciones directamente. Compra Peones primero, Peones gastan. Esto evita microcobros que matan UX en Celo (gas + signing por cada hint sería tóxico).

## 3. Compendio TX matrix

| Acción | Rail principal | Rail secundario | Peones | Stablecoin | On-chain TX | PRO bypass | Sprint |
|---|---|---|---|---|---|---|---|
| Coach analysis | Coach credits → Peones | PRO bypass | Sí (1 Peón) | No directo | No | Sí, cuota diaria | **4** |
| Hint | Peones | PRO bypass | Sí (1 Peón) | No | No | Sí, cuota diaria | **4** |
| Retry | Peones | PRO bypass | Sí (2 Peones) | No | No | Sí, cuota diaria | **4** |
| Save game | Peones | PRO bypass | Sí (1 Peón) | No | No (UI only) | Sí, ilimitado | **4** |
| Labyrinth key | Peones | PRO bypass | Sí (1 Peón) | No | No | Sí, cuota diaria | 5 |
| VictoryNFT mint | Stablecoin | — | No | Sí (USDm/USDC/USDT) | Sí | No (NFT no se regala) | Live |
| Badge claim | Gas only | — | No | No (gas Celo) | Sí | No | Live |
| Founder claim | Stablecoin | — | No | Sí | Sí | No | Live |
| PRO subscription | Stablecoin | — | No | Sí | Sí | — | Live |
| Peones pack | Stablecoin | — | No (cobra) Sí (acredita) | Sí | Sí (transfer) | No | 5 |
| Theme pack | Stablecoin | PRO unlock | No | Sí | Sí | Algunos sí | 6+ |

**Sprint 4 scope = Coach + Hint + Retry + Save game.** Labyrinth key se mueve a Sprint 5 porque depende de Daily Labyrinth Challenge (rotation doc v0.1). Packs Peones tampoco son Sprint 4 — el endpoint spend ship sin top-up, los earns existentes alcanzan para validación.

## 4. Spend endpoint contract

`POST /api/peones/spend`

**Input** (JSON body):

```ts
type SpendRequest = {
  wallet: string;          // 0x-prefixed, validated vía normalizeWallet
  amount: number;          // > 0, entero. Server valida vs costo conocido del target
  target: PeonesSpendTarget;  // "coach" | "hint" | "retry" | "save_game"
  targetId: string;        // gameId | "{piece}:{exerciseId}:{attemptN}" | gameId | gameId
  idempotencyKey: string;  // formato canónico §9
  metadata?: Record<string, string | number>;  // contexto opcional, NO sensible
};
```

**Output** (200 OK):

```ts
type SpendResponse = {
  debited: number;         // monto real debitado (puede ser 0 si PRO bypass)
  newBalance: number;      // balance post-spend, derivado del ledger
  attestationHash: string; // sha256:<hex> server-side
  ledgerId: string;        // uuid de la fila insertada (o existente en idempotency hit)
  proBypassApplied: boolean;
};
```

**Errores** (status code + body `{ error: code, hint?: string }`):

| Code | HTTP | Causa |
|---|---|---|
| `invalid_input` | 400 | Shape o tipos fuera de spec |
| `invalid_wallet` | 400 | Regex falla |
| `insufficient_balance` | 409 | `balance < amount` y NO PRO bypass |
| `duplicate_idempotency_key` | 200 (idempotent hit) o 409 (conflict real) | Per §9 |
| `rate_limited` | 429 | Más de N spends/min por wallet (proxy anti-abuse) |
| `ledger_write_failed` | 500 | RPC SQL falló (no race; falla real) |
| `unknown_target` | 400 | Target fuera de enum |
| `pro_quota_exhausted` | 409 | PRO bypass usado pero ya superó cuota diaria de ese target |

**Decisión arquitectural**: el endpoint NUNCA hace "GET balance → INSERT" en pasos separados. Llama a una **SQL function atómica** (§9).

## 5. Costos M1 default

| Target | Costo | Razón |
|---|---|---|
| coach | 1 Peón | Acción cara reputacionalmente (necesita Engine+LLM), pero queremos volumen para entrenar Coach |
| hint | 1 Peón | Microacción frecuente, debe sentirse barata |
| retry | 2 Peones | Carga doble: tienta a usarse, pero penaliza farming de estrellas |
| save_game | 1 Peón | Action one-shot al final de partida, barata para no romper flow |
| labyrinth_key (Sprint 5) | 1 Peón | Acceso a contenido premium del día |

**Estos son M1 defaults.** Reevaluar tras 4 semanas con métricas reales (target: ≥40% de wallets activos gastan al menos 1 Peón/semana).

## 6. PRO bypass matrix

PRO bypass es **gratis con cuota diaria**, NO ilimitado. Razones:
- Ilimitado degrada el incentivo a ganar Peones jugando Daily.
- Cuota diaria preserva el "free user puede pagar lo mismo si gana suficientes Peones" — PRO compra conveniencia, no exclusividad.
- Anti-abuse: cuota cierra el blast radius si una sesión PRO se compromete.

| Target | Free user | PRO user |
|---|---|---|
| Coach analysis | 1 Peón / call | Gratis hasta 5/UTC-day, luego 1 Peón |
| Hint | 1 Peón / call | Gratis hasta 20/UTC-day, luego 1 Peón |
| Retry | 2 Peones / call | Gratis hasta 10/UTC-day, luego 2 Peones |
| Save game | 1 Peón / call | Gratis ilimitado (acción de baja explotación) |
| Labyrinth key | 1 Peón / call | Gratis hasta 3/UTC-day, luego 1 Peón |

**Resolución de `isPro`**: server-side, NO cliente.
- Endpoint llama a helper `resolveProStatus(wallet)` que consulta on-chain o caché.
- Cliente puede enviar hint `isPro: true` para evitar UI flicker, pero el server lo verifica antes de aplicar bypass.
- Si server determina free pero cliente dijo PRO → bypass NO aplica, debit normal.

## 7. Coach credits vs Peones — decisión

**Recomendación: Opción C (transición puente).**

Orden de consumo cuando usuario solicita Coach analysis (**ajuste founder 2026-06-08: PRO antes que Peones**):

1. **Coach credits Redis** (si saldo > 0): consume Redis, NO toca Peones. Path legacy preservado — créditos comprados se respetan.
2. **PRO bypass** (si Redis = 0 y PRO activo dentro de cuota diaria): bypass aplica, debited = 0.
3. **Peones balance** (si Redis = 0 y PRO ausente o fuera de cuota y Peones ≥ 1): debit 1 Peón vía `/api/peones/spend` con target `coach`.
4. **Upsell** (si todo lo anterior falla): mostrar paywall "Gana Peones jugando Daily" → "Activa PRO" → (later) "Compra pack".

**Motivo del swap**: PRO debe sentirse como "todo más suave inmediatamente" desde el primer call del día. Si Peones consume primero, PRO solo aparece cuando el usuario ya quemó su saldo — invertida la promesa de valor.

**Por qué C y no B (migración inmediata)**:
- Migración requiere mapping `Redis credit ↔ Peones`. Tipo de cambio = decisión política (¿1 credit = 1 Peón? ¿2?).
- Usuarios con créditos comprados esperan consumirlos. Migración forzada = mala UX.
- C les permite quemar credits naturalmente; cuando Redis llega a 0, transitan a Peones sin fricción.

**Migración B se ejecuta en Sprint 6+** con conversion rate fijo + opt-in.

## 8. Stablecoin packs (NO Sprint 4)

Diseño documentado para Sprint 5+. NO se implementa.

| Pack | Peones | Precio sugerido (USDm) |
|---|---|---|
| Starter | 50 | 0.99 |
| Standard | 120 | 1.99 |
| Premium | 300 | 3.99 |
| Whale | 500 | 5.99 |

- Default rail MiniPay: USDm transfer (CIP-64 fee abstraction).
- NUNCA cobrar stablecoin por microacción (Coach, hint, retry). Solo por saldo.
- Si usuario no tiene Peones, prioridad UI:
  1. **Jugar Daily** para ganar (gratis, recurrente).
  2. **Comprar pack** (one-shot).
  3. **Activar PRO** (recurrente, bypass + extras).
  4. (Later, NO Sprint 4) fallback stablecoin directo solo en casos donde el usuario insiste.

## 9. Seguridad / idempotency

### 9.1 Spend idempotency keys (formato canónico)

| Target | Formato |
|---|---|
| coach | `spend:coach:{wallet}:{gameId}` |
| hint | `spend:hint:{wallet}:{piece}:{exerciseId}:{attemptSeq}` |
| retry | `spend:retry:{wallet}:{piece}:{exerciseId}:{attemptSeq}` |
| save_game | `spend:save_game:{wallet}:{gameId}` |
| labyrinth_key | `spend:labyrinth_key:{wallet}:{labyrinthId}:{day_utc}` |

`{attemptSeq}` lo asigna el cliente como contador monotónico por sesión. Garantiza que hints repetidos del MISMO ejercicio en el MISMO intento sean idempotentes, pero hints en intentos sucesivos sean distintos.

### 9.2 Atomic spend SQL function

**Decisión: SÍ usar SQL function atómica.** Razón: `GET balance → INSERT` separados crean race condition trivial (dos requests concurrentes pueden ambas ver balance=1, ambas debitar, balance final = -1). Esto rompe el invariant `balance >= 0`.

**Orden de ejecución dentro del RPC** (ajuste founder 2026-06-08):

1. **Idempotency check** primero. Si `idempotency_key` ya existe → retorna la fila existente como `duplicate = true`. **Retornar success aunque el balance ACTUAL ya no alcance**: el spend original ya ocurrió y es immutable; el cliente debe ver el mismo resultado que la primera vez.
2. **PRO bypass / quota evaluation** si el caller envía `p_apply_pro_bypass = true`. Si aplica: `debited = 0`, se salta el balance check, la fila se inserta con marca `pro_bypass = true`.
3. **Balance check ÚNICAMENTE cuando `debited > 0`**. Lock `FOR UPDATE` por wallet; si `balance < amount` → `RAISE 'insufficient_balance'`.
4. **Insert append-only row** con `event_type = 'spend'`, `amount > 0`, `pro_bypass` flag, attestation hash + metadata.

Diseño propuesto:

```sql
CREATE FUNCTION peones_spend(
  p_wallet text,
  p_amount integer,
  p_target text,
  p_target_id text,
  p_idempotency_key text,
  p_attestation_hash text,
  p_metadata jsonb
) RETURNS TABLE(ledger_id uuid, new_balance integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_current_balance integer;
  v_existing_row peones_ledger;
BEGIN
  -- 1. Idempotency check
  SELECT * INTO v_existing_row FROM peones_ledger
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    -- Return existing as idempotent hit
    RETURN QUERY SELECT v_existing_row.id, (SELECT balance FROM peones_balances WHERE wallet = p_wallet);
    RETURN;
  END IF;

  -- 2. Balance check con LOCK (FOR UPDATE en peones_ledger por wallet)
  PERFORM 1 FROM peones_ledger WHERE wallet = p_wallet FOR UPDATE;
  SELECT balance INTO v_current_balance FROM peones_balances WHERE wallet = p_wallet;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Insert atómico
  INSERT INTO peones_ledger (
    wallet, event_type, amount, source, source_id,
    day_utc, idempotency_key, attestation_hash, metadata
  ) VALUES (
    p_wallet, 'spend', p_amount, p_target, p_target_id,
    (CURRENT_DATE AT TIME ZONE 'UTC')::date, p_idempotency_key,
    p_attestation_hash, p_metadata
  )
  RETURNING id INTO ledger_id;

  new_balance := v_current_balance - p_amount;
  RETURN NEXT;
END;
$$;
```

`FOR UPDATE` serializa requests concurrentes del mismo wallet. Sin esto, la race es trivial.

### 9.3 Rate limiting

- Bucket por wallet: máx 30 spends / 60 segundos (cubre Coach hint-spam y retry-spam).
- Backed by Supabase + IP fallback. Sprint 4 puede ship con in-memory (perfectible Sprint 5).

### 9.4 No negative balance

Garantizado por §9.2 + CHECK constraint `amount > 0`. Imposible insertar spend que rompa el invariant.

## 10. Plan de commits Sprint 4

| Slice | Scope | Acceptance |
|---|---|---|
| **A** | Spend calibration doc (este archivo) | Founder approves §12 |
| **B** | SQL migration: `peones_spend` RPC function + `peones_ledger.source` enum extension | Migration applies en staging + unit tests del RPC |
| **C** | `POST /api/peones/spend` endpoint + service helper + tests | 200/409/400/429/500 paths covered |
| **D** | Spend client helper (`submitSpend(target, ...)`) + telemetry hooks | `peones_spent` + `peones_spend_blocked` events |
| **E** | **First surface: Hint** en piece exercises. UI button "Hint (1 Peón)" + cooldown | Manual smoke: hint resta 1 Peón, idempotente en mismo intento |
| **F** | Coach integration: order Redis → Peones → PRO bypass → upsell | Smoke con 3 wallets (credit, peones, PRO) |
| **G** | PRO bypass server resolver + daily quota tracking | `resolveProStatus(wallet)` + `quota_used` tracking en ledger metadata |
| **H** | UX smoke + handoff Sprint 4 | Full path: earn Daily → spend Hint → spend Retry → spend Coach |

Sprint 4 = 8 commits. Más estimable, menos chunky que Sprint 3.

## 11. Qué queda fuera de Sprint 4

- ❌ Stablecoin pack purchase implementation (Sprint 5).
- ❌ Founder payment migration (no se toca, anda live).
- ❌ VictoryNFT migration (Arena untouched).
- ❌ Coach credits → Peones migration completa (opción B, Sprint 6+).
- ❌ SIWC (Sign-In With Celo) — no bloquea, queda backlog.
- ❌ Daily Practice rotation implementation (post-Sprint 4 Engagement Expansion per rotation doc v0.1).
- ❌ Labyrinth key (slice movida a Sprint 5).
- ❌ Hard/Bonus Labyrinth PRO (rotation doc, post-Sprint 4).

## 12. Preguntas bloqueantes (founder sign-off)

1. **¿Coach credits conviven, se migran o se consumen antes que Peones?**
   PM recomienda: **C — consumir Coach credits Redis PRIMERO, luego Peones, luego PRO bypass, luego upsell.** Migración B parqueada para Sprint 6+.

2. **¿PRO bypass es gratis ilimitado o con cuota diaria?**
   PM recomienda: **cuota diaria.** Cuotas iniciales: Coach 5, Hint 20, Retry 10, Save game ilimitado, Labyrinth key 3. Ilimitado degrada el Peones loop.

3. **¿Spend se implementa con SQL RPC atómica?**
   PM recomienda: **SÍ, sin alternativa.** `GET balance → INSERT` separado crea race trivial. SQL function con `FOR UPDATE` lock por wallet es la única defensa correcta.

4. **¿Cuál es la primera superficie de spend para ship seguro?**
   PM recomienda: **Hint en piece exercises.** Razones: bajo riesgo (no on-chain), alto volumen (valida la mecánica con muchas transacciones), UX simple (1 botón → 1 efecto), reversible (si spend falla, hint no aparece, sin daño).

5. **¿Costo de Coach analysis es 1 Peón o más caro?**
   PM recomienda: **1 Peón inicial.** Queremos volumen para entrenar Coach. Subir a 2 Peones si métrica muestra abuse, NO antes.

6. **¿Daily quota PRO debe ser visible en UI o silenciosa?**
   PM recomienda: **silenciosa hasta que se acerque el límite.** Al 80% del límite, banner "Te quedan X Coach calls hoy". Al límite, copy "Quota daily reached — sigue gratis mañana o usa Peones". Evita el feel de "limite escondido".

7. **¿`metadata` del spend endpoint requiere validation server-side?**
   PM recomienda: **whitelist de keys.** Solo keys conocidas (`difficulty`, `attemptSeq`, `gameId`) se persisten. Resto se descarta. Evita SQL injection vía JSONB pollution.
