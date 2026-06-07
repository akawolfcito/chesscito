# Sprint 3 — Peones Ledger · Calibración

**Fecha:** 2026-06-07
**Autor:** John (Tech Lead, dirigido por Wolfcito)
**Estado:** Calibración pre-implementación. NO ejecuta código. Contrato para los commits de Sprint 3.
**Doc padre:** `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md` §3 Sprint 3.
**Doc hermano:** `docs/product/chesscito-sprint-2-daily-tactic-calibration-2026-06-06.md`.
**Preview Sprint 2 verificado:** `https://chesscito-jssijbcnw-goodwolf.vercel.app` ✅ (200, 9 King ejercicios SSR).

---

## 1. Estado actual de Peones

### 1.1 Superficies que ya hablan de "Peones"

| Superficie | Status | Archivo | Notas |
|---|---|---|---|
| Daily Tactic reward preview (Sprint 2 commit E) | **Preview** | `daily-tactic-sheet.tsx`, `editorial.ts:344-346`, `messages/es.ts:1290-1292` | "+3 Peones preview" solo visual, gateado por `isConnected`. NO crea saldo. |
| Daily Tactic telemetry fields | **Stub** | `lib/daily/telemetry.ts` | `peonesEarned: 0` + `bonusPeonesEarned: 0` + `rewardPreviewPeones: 3|0`. Schema reservado. |
| Coach credits (legacy, sistema separado) | **REAL en Redis** | `lib/coach/use-coach-credits.ts`, `lib/coach/redis-keys.ts:23`, `app/api/coach/credits/route.ts` | `coach:credits:{wallet}` en Redis. Pre-existing M1. **NO es Peones, es créditos Coach.** Conviven, no se mezclan en Sprint 3. |
| Coach credits purchase | **REAL** | `lib/coach/use-coach-credits-purchase.ts` | Compra approve→buyItem→verify-purchase. Mantener intacto. |
| Shop tiles | **REAL** | Shop existente (M1) | Vende coach credit packs, PRO, Welcome Pack. No vende Peones todavía. |
| Share previews / OG | **N/A** | `lib/og/*` | No mencionan Peones. |
| HUD chip de Peones | **NO EXISTE** | — | Sprint 3 lo crea (commit G). |

### 1.2 Telemetría actual de Peones

| Evento | Field | Sprint 2 status |
|---|---|---|
| `daily_tactic_completed` | `peonesEarned` | `0` siempre (stub) |
| `daily_tactic_completed` | `rewardPreviewPeones` | `3` connected / `0` guest |
| `daily_streak_updated` | `bonusPeonesEarned` | `0` siempre (stub) |
| `peones_earned` | (evento) | **NO EXISTE** en Sprint 2; reservado para Sprint 3 |
| `peones_spent` | (evento) | **NO EXISTE**; Sprint 4 |
| `peones_balance_viewed` | (evento) | **NO EXISTE**; Sprint 3 commit G |
| `peones_cap_reached` | (evento) | **NO EXISTE**; Sprint 3 commit D |

### 1.3 Qué es REAL / PREVIEW / NO-SALDO hoy

- **Real:** Coach credits en Redis (`coach:credits:{wallet}`). PRO sub. Founder badge (oculto). VictoryNFT mints. Stars de senda en localStorage (`chesscito:progress:*`). Daily Tactic streak en localStorage (`chesscito:daily-progress`).
- **Preview:** "+3 Peones preview" copy en sheet. `rewardPreviewPeones` field en telemetry. NO suma a nada.
- **NO saldo:** Cero entidad "balance de Peones" en disco, Redis o Supabase. Cero localStorage key `chesscito:peones-*`. Cero endpoint `/api/peones/*`.

---

## 2. Decisiones base Sprint 3

Defaults oficiales — usar salvo bloqueo real:

| # | Decisión | Default |
|:--:|---|---|
| 1 | Saldo Peones existe SOLO para connected wallets | ✅ |
| 2 | NO saldo guest en Sprint 3 | ✅ |
| 3 | Guest ve CTA "connect to earn", NO acumula | ✅ |
| 4 | Cap diario de 10 = `(wallet, UTC day, Daily sources combined)` | ✅ |
| 5 | Rewards de Senda NO tienen cap diario; solo earn por delta positivo | ✅ |
| 6 | Ledger es append-only | ✅ |
| 7 | NO mutar balance como fuente primaria de verdad | ✅ |
| 8 | Balance = `SUM(amount) WHERE wallet AND valid` | ✅ derivado |
| 9 | Idempotency key obligatoria en cada earn/spend | ✅ |
| 10 | Sprint 3 prioriza **earn + balance read** | ✅ |
| 11 | Sprint 4 entrega **spend / Compendio TX** | ✅ |
| 12 | Reconciliation cron se diseña Sprint 3, implementa Sprint 4 si no bloquea | ✅ |

---

## 3. Schema target Supabase

### 3.1 Tabla principal `peones_ledger`

```sql
create table public.peones_ledger (
  id                bigserial primary key,
  wallet            text        not null,
  event_type        text        not null check (event_type in ('earn', 'spend', 'adjustment', 'rollback')),
  amount            integer     not null check (amount <> 0),
  source            text        not null,
  source_id         text,
  idempotency_key   text        not null,
  attestation_hash  text        not null,
  metadata          jsonb,
  day_utc           date        not null,
  created_at        timestamptz not null default now()
);
```

**Reglas:**
- `wallet` se normaliza a **lowercase** en la app antes de write (evita conflictos checksum/EIP-55). Validador SQL extra opcional `check (wallet ~ '^0x[0-9a-f]{40}$')`.
- `amount` para `earn` y `spend` es **positivo** (signo lo da `event_type`). `adjustment` y `rollback` permiten cualquier signo no-cero.
- `source` enum lógico: `daily_tactic`, `daily_streak_bonus`, `daily_lab`, `exercise_completion`, `senda_milestone`, `pack_purchase`, `coach`, `hint`, `retry`, `save_game`, `labyrinth_key`, `admin_grant`.
- `day_utc` se computa en el server al insert; necesario para cap diario.

### 3.2 Índices

```sql
create unique index peones_ledger_idempotency_uq on public.peones_ledger (idempotency_key);
create index peones_ledger_wallet_idx           on public.peones_ledger (wallet);
create index peones_ledger_wallet_day_idx       on public.peones_ledger (wallet, day_utc);
create index peones_ledger_wallet_source_idx    on public.peones_ledger (wallet, source);
create index peones_ledger_attestation_idx      on public.peones_ledger (attestation_hash);
create index peones_ledger_wallet_created_idx   on public.peones_ledger (wallet, created_at desc);
```

### 3.3 View de balance derivado

```sql
create view public.peones_balances as
select
  wallet,
  coalesce(sum(case
    when event_type in ('earn', 'adjustment') then amount
    when event_type in ('spend', 'rollback')  then -amount
  end), 0) as balance,
  max(created_at) as last_event_at
from public.peones_ledger
group by wallet;
```

**Alternativa con función SQL** para incluir el cap diario consumido:

```sql
create function public.peones_balance_with_caps(p_wallet text, p_day_utc date)
returns table (balance bigint, daily_earned_capped bigint, daily_cap integer)
language sql stable as $$
  select
    coalesce(sum(case
      when event_type in ('earn','adjustment') then amount
      when event_type in ('spend','rollback')  then -amount
    end), 0)::bigint as balance,
    coalesce(sum(case
      when event_type = 'earn'
        and source in ('daily_tactic','daily_streak_bonus','daily_lab')
        and day_utc = p_day_utc
      then amount
    end), 0)::bigint as daily_earned_capped,
    10::integer as daily_cap
  from public.peones_ledger
  where wallet = p_wallet;
$$;
```

### 3.4 Migration shape sugerida

`apps/web/supabase/migrations/2026-06-XX-peones-ledger.sql` — commit A monta esta migration completa.

---

## 4. RLS / seguridad

### 4.1 Política de acceso

| Acción | Cliente | Server (service role) |
|---|:--:|:--:|
| SELECT propio balance | ✅ por wallet | ✅ |
| SELECT ledger histórico propio | ✅ por wallet | ✅ |
| INSERT ledger entry | **❌ NUNCA** | ✅ |
| UPDATE/DELETE ledger | ❌ NUNCA | ❌ NUNCA (append-only) |

### 4.2 RLS draft

```sql
alter table public.peones_ledger enable row level security;

-- Server-only writes
create policy peones_ledger_no_client_writes
  on public.peones_ledger
  for insert
  to authenticated, anon
  with check (false);

-- Wallet-bound reads
create policy peones_ledger_own_reads
  on public.peones_ledger
  for select
  to authenticated, anon
  using (
    wallet = lower(coalesce(
      current_setting('request.jwt.claims', true)::json->>'wallet',
      ''
    ))
  );
```

### 4.3 Validación de wallet ownership

Hoy NO existe un flujo de autenticación server-side que pruebe ownership de la wallet (no hay SIWE/SIWC, ni session token con wallet claim verificada). Las opciones realistas para Sprint 3:

**Opción A — Trust-but-rate-limit (Sprint 3 inicial):**
- Cliente envía `wallet` en el body del POST.
- Server valida formato + rate-limit agresivo por IP + cap diario por wallet.
- Acepta el riesgo de spoofing porque (a) los earns son chicos, (b) cap diario lo limita.
- Origin check estricto (`enforceOrigin` que ya existe en otras rutas).

**Opción B — SIWC mínimo (Sprint 3.1 si valida):**
- Sign-In With Celo: cliente firma mensaje, server verifica firma y emite session token con wallet claim.
- Más seguro pero requiere infra nueva.

**Recomendación:** **Opción A para Sprint 3 inicial.** Sprint 4 evalúa SIWC si el cap diario no contiene el riesgo en preview metrics. Documentar como riesgo R7 abajo.

---

## 5. Endpoints propuestos

### 5.1 `GET /api/peones/balance`

```ts
// Input
{ wallet: string } // query param, lowercase

// Output 200
{
  balance: number,
  dailyEarnedCapped: number,
  dailyCap: number,
  lastEventAt: string | null  // ISO timestamp
}

// Errors
400 { error: "invalid_wallet" }       // bad format
429 { error: "rate_limited" }
500 { error: "ledger_unavailable" }
```

- **Validaciones:** wallet regex `^0x[0-9a-fA-F]{40}$`, lowercase normalize antes del query.
- **Idempotency:** N/A (read).
- **Rate limit:** 60 req/min por wallet (UI puede pollear, no spam).
- **Eventos:** `peones_balance_viewed` cuando el cliente reporta render del chip (no en el endpoint mismo).

### 5.2 `POST /api/peones/earn`

```ts
// Input (body JSON)
{
  wallet: string,
  amount: number,       // positivo
  source: "daily_tactic" | "daily_streak_bonus" | "exercise_completion" | "senda_milestone",
  sourceId: string,     // e.g. "dt-queen-2" o "rook-4:3->3"
  idempotencyKey: string,
  metadata?: Record<string, unknown>
}

// Output 200
{
  credited: number,           // amount realmente acreditado (puede ser < input si cap)
  capReached: boolean,
  newBalance: number,
  attestationHash: string,
  ledgerId: number
}

// Errors
400 { error: "invalid_input" }
409 { error: "duplicate_idempotency_key", ledgerId, credited }  // ya existía
429 { error: "rate_limited" }
500 { error: "ledger_write_failed" }
```

- **Validaciones:**
  - amount ∈ [1, 50] (single-event cap defensive).
  - source ∈ enum.
  - idempotencyKey formato §9.
  - Cap diario: si la fuente es Daily-family, computar `daily_earned_capped + amount > 10` y truncar al `daily_cap - daily_earned_capped` o devolver `credited: 0, capReached: true`.
- **Idempotency:** unique constraint en DB. Si key duplicada, devolver 409 con el `ledgerId` original (idempotent re-try succeeds silently from client perspective).
- **Rate limit:** 30 earns/min por wallet.
- **Eventos:** `peones_earned` con `{ source, sourceId, amount, credited, capReached, newBalance, attestationHash }`. Si capReached, `peones_cap_reached` adicional.

### 5.3 `POST /api/peones/spend` (Sprint 4 implementation; Sprint 3 contract solo)

```ts
// Input
{
  wallet: string,
  amount: number,       // positivo
  target: "coach" | "hint" | "retry" | "save_game" | "labyrinth_key",
  targetId: string,     // e.g. coachAnalysisId o labyrinthId
  idempotencyKey: string,
  metadata?: Record<string, unknown>
}

// Output 200
{
  debited: number,
  newBalance: number,
  attestationHash: string,
  ledgerId: number
}

// Errors
400 { error: "invalid_input" }
402 { error: "insufficient_balance", currentBalance }
409 { error: "duplicate_idempotency_key", ledgerId, debited }
429 { error: "rate_limited" }
500 { error: "ledger_write_failed" }
```

- **Validaciones:** balance >= amount antes del write; transactional check-and-insert.
- **Eventos:** `peones_spent`. Si `insufficient`, `peones_attempt_blocked_insufficient`.
- **Sprint 3 status:** types + endpoint stub que devuelve `501 not_implemented` hasta Sprint 4. Tests pinean el contrato.

---

## 6. Fuentes de earn Sprint 3

| Source | Trigger | Amount | Notas |
|---|---|:--:|---|
| `daily_tactic` | Completar Daily Tactic | **3** | Sólo connected. Cap diario aplica. Idempotency: una vez por (wallet, day, puzzleId). |
| `daily_streak_bonus` | Racha cumple 7 días consecutivos | **+1 bonus** | Solo connected. NO se repite hasta romper + alcanzar 14d (siguiente milestone). |
| `exercise_completion` | Completar ejercicio de Senda con delta positivo de estrellas | **delta** (1-3) | Solo connected. Sin cap diario. Replay sin mejora = 0. |

**Reglas explícitas:**
- **NO retroactive Peones** para progreso senda viejo. Solo earn forward — un usuario con stars[5] preexistente no recibe Peones por esas estrellas viejas.
- **Daily Tactic Sprint 3 mapping:** `peonesEarned` deja de ser `0` y pasa a ser `credited` (lo que el endpoint devolvió, 0-3 según cap). `rewardPreviewPeones` puede deprecarse o mantenerse como redundancia con el nuevo valor.
- **Daily Lab (PRO Friday/Sunday):** Sprint 3 NO lo conecta — depende de que el UI consumer monte `getProDailyExtras()`. Documentado como Sprint 2.1 o post-Sprint-4.
- **`senda_milestone` PARQUEADO (decisión Wolfcito 2026-06-07):** el bonus +5 por pieza completa NO entra en Sprint 3. Razón: evitar inflar la economía y evitar agregar una reward nueva antes de tener ledger estable. Re-evaluación post-Sprint 4 retrospective o en Milestone B. El enum del schema (§3.1) preserva `senda_milestone` como source válido para evitar migration cuando se active.

---

## 7. Fuentes de spend (Sprint 3 declara, Sprint 4 implementa)

| Target | Costo | Notas |
|---|:--:|---|
| `coach` | **1 Peón** = 1 Coach analysis | PRO bypass (gratis). Coexiste con `coach:credits:{wallet}` existente — Sprint 4 decide convivencia o migración. |
| `hint` | **1 Peón** = mostrar siguiente óptimo en laberinto | PRO bypass. |
| `retry` | **2 Peones** = retry sin perder racha | PRO bypass. |
| `save_game` | **1 Peón** | PRO bypass. |
| `labyrinth_key` | **1 Peón** = abrir puerta T4 | PRO bypass. Requiere T4 implementado (Milestone B). |

**Sprint 3 entrega:** types + endpoint stub `501`. Tests del contract.
**Sprint 4 entrega:** implementación + balance gate + UI wireup + `peones_spent` event.

---

## 8. Cap diario

### 8.1 Reglas

- **Cap:** 10 Peones / wallet / UTC day, sumando solo fuentes Daily-family:
  - `daily_tactic`
  - `daily_streak_bonus`
  - `daily_lab` (cuando el UI consumer lo conecte)
- **NO aplica a:** `exercise_completion`, `senda_milestone`, `pack_purchase`, `admin_grant`.

### 8.2 Comportamiento al alcanzar cap

| Situación | Acción |
|---|---|
| Usuario completa Daily Tactic con cap ya alcanzado | Endpoint devuelve `credited: 0, capReached: true, newBalance: <unchanged>`. Sheet muestra "Daily reward earned today — back tomorrow" copy alternativo (Sprint 3 commit E define el wording). |
| Usuario completa Daily Tactic con cap parcial (e.g. ya tiene 8 hoy, +3 lo llevaría a 11) | Endpoint trunca: `credited: 2, capReached: true, newBalance: 10`. UI muestra "+2 Peones (daily cap reached)". |
| Daily Tactic completion sigue siendo válida | ✅ El user completa el puzzle, streak avanza, telemetry dispara — solo el Peones earn está capeado. |

### 8.3 Telemetría cap

- `peones_cap_reached` con `{ wallet, day_utc, dailyAmount: 10, attemptedAmount: 3 }` cuando el cap se alcanza por primera vez en el día.
- NO se re-emite en subsequent attempts del mismo día (dedup por (wallet, day_utc) en client o server).

---

## 9. Idempotency

### 9.1 Formato de claves

Determinístico, computado en el cliente, validado en server:

| Source | Formato | Ejemplo |
|---|---|---|
| Daily Tactic | `daily_tactic:{wallet}:{day_utc}:{puzzle_id}` | `daily_tactic:0xabc:2026-06-07:dt-queen-2` |
| Daily streak bonus | `daily_streak_bonus:{wallet}:{day_utc}:{streak_milestone}` | `daily_streak_bonus:0xabc:2026-06-07:7` |
| Daily Lab | `daily_lab:{wallet}:{day_utc}:{slot}` | `daily_lab:0xabc:2026-06-07:friday_premium` |
| Exercise completion | `training:{wallet}:{piece}:{exerciseId}:{before}->{after}` | `training:0xabc:rook:rook-4:1->3` |
| Senda milestone | `senda_milestone:{wallet}:{piece}` | `senda_milestone:0xabc:king` |

### 9.2 Casos cubiertos

- **Doble click en "Solve":** mismo idempotency_key → 409 → cliente trata como success.
- **Re-render con mismo state:** mismo key → 409 → ignorar.
- **Network retry:** mismo key → server devuelve el ledger entry original.
- **Replay del mismo Daily mañana:** key incluye `day_utc`, nuevo key → nuevo earn.
- **Replay del mismo ejercicio sin mejora:** key incluye `before->after`; si before==after sin nuevo registro, cliente NO llama al endpoint (gate en hook). Si llama, key existente → 409 trivial.

---

## 10. Attestation hash

### 10.1 Construcción

Server-generated, determinístico desde el payload:

```ts
attestation_hash = sha256(
  `${wallet}|${event_type}|${amount}|${source}|${source_id ?? ''}|${day_utc}|${idempotency_key}|${created_at_iso}`
)
```

**Por qué cada componente:**
- `wallet`: bind a la wallet específica (no transferible).
- `event_type`, `amount`, `source`: payload económico canónico.
- `source_id`: distingue dos earns idénticos en monto pero distinta fuente real.
- `day_utc`: bind al día.
- `idempotency_key`: garantía de uniqueness server-side.
- `created_at_iso`: rompe colisiones cuando otras col coincidan (jamás dos rows con el mismo created_at exact).

### 10.2 Determinismo vs server-generated

- **Server-generated** — el hash se calcula durante el INSERT, persistido en la row. Cliente recibe el hash en el response.
- **Determinístico sobre el payload server-known.** Cliente NO computa attestation hash (no necesita). Sirve para auditoría server-side + future on-chain anclaje opcional.

### 10.3 Uso

- Audit log: dashboard interno puede reconstruir hash desde la row y comparar.
- Telemetría: `peones_earned` lleva el `attestation_hash` como reference id.
- Future: opcional batched commit a un contract `PeonesAttestation` (Milestone D), no Sprint 3.

---

## 11. Mapping Sprint 2 stub → Sprint 3 real

| Field / Copy | Sprint 2 | Sprint 3 |
|---|---|---|
| `daily_tactic_completed.peonesEarned` | Siempre `0` | `credited` real del endpoint (0-3 según cap) |
| `daily_tactic_completed.rewardPreviewPeones` | `3` connected, `0` guest | **Deprecar** o mantener como redundancia. Recomendación: **deprecar** — colapsar en `peonesEarned` ya real. Telemetry consumers se actualizan en el commit que conecta el endpoint. |
| `daily_streak_updated.bonusPeonesEarned` | Siempre `0` | `credited` del bonus call (0 o 1 según milestone alcanzado) |
| Copy `+3 Peones preview` (connected) | Preview literal | `+3 Peones` (sin "preview") cuando cap permite; `+0 Peones — daily cap reached` cuando cap topa |
| Copy `Daily rewards unlock in the next economy sprint.` | Visible | **Eliminar** — economy ya activa. Reemplazar por "Saved to your Peones balance." |
| Copy guest `Connect to earn Peones when rewards go live.` | Visible | **Reemplazar** por "Connect your wallet to save Peones rewards." (rewards already live; only connection blocks them) |
| `chesscito:peones-balance` localStorage | No existe | **Sigue NO existiendo** — el balance vive en Supabase. localStorage solo guarda un cached `last_known_balance` para UI optimistic, NUNCA fuente de verdad. |
| HUD chip Peones | No existe | **Aparece en commit G** — pulls balance del endpoint cada N segundos + cuando se completa una acción. |

---

## 12. Plan de commits Sprint 3

| # | Commit | Scope | Riesgo |
|:--:|---|---|:--:|
| A | `feat(supabase): peones_ledger schema + RLS + views` | Migration SQL + tipos TS generados. NO endpoints, NO UI. | 🟢 |
| B | `feat(peones): ledger service pure functions + tests` | `lib/peones/ledger-service.ts`: pure `computeBalance`, `applyCap`, `buildAttestationHash`, idempotency check helpers. Tests focalizados. | 🟢 |
| C | `feat(peones): GET /api/peones/balance` | Read-only endpoint + rate limit. NO writes. Tests focalizados. | 🟢 |
| D | `feat(peones): POST /api/peones/earn with idempotency + cap` | Write endpoint. Cap diario enforcement. peones_earned + peones_cap_reached telemetry. | 🟡 |
| E | `feat(peones): wire Daily Tactic earn real` | `handleSolve` llama al endpoint earn. `peonesEarned` pasa a ser non-zero. Copy actualizado (eliminar "preview"). | 🟡 |
| F | `feat(peones): wire Training stars delta earn real` | `useExerciseProgress.completeExercise` llama earn cuando delta > 0. Idempotency key `training:...`. | 🟡 |
| G | `feat(peones): HUD balance chip minimal` | Chip en `/hub`, `/exercises`, `/coach`, `/arena`. Polling cached. `peones_balance_viewed` event. | 🟡 |
| H | `feat(telemetry): peones_earned + peones_cap_reached events live` | Actualizar event catalog. Deprecar `rewardPreviewPeones` field. Update tests. | 🟢 |
| I | `chore(qa): smoke + handoff Sprint 3` | Manual smoke + doc. | 🟢 |

**Sequencing recomendado:** A → B → C → D → smoke earn focalizado → E → F → G → H → I → push.

**Spend (Sprint 4):** types + endpoint stub `501` puede entrar en commit C como prep, o esperar Sprint 4 inicial. Recomendación: prep en commit C → Sprint 4 solo wire-up.

---

## 13. Riesgos y mitigaciones

| # | Riesgo | Prob | Impacto | Mitigación |
|:--:|---|:--:|:--:|---|
| R1 | **Doble earn por race condition** (click rápido, retry mid-flight, dual mount) | Alta | Alto | Idempotency unique constraint en DB. 409 silencioso desde el cliente. Tests explícitos de doble POST. |
| R2 | **Race condition entre cap check y insert** (dos requests concurrentes pasan ambos el cap check, ambos insertan, balance excede 10) | Media | Alto | Transactional check-and-insert con SELECT FOR UPDATE de las rows del día, O simplemente confiar en idempotency + reconciliation cron Sprint 4. Recomendación inicial: aceptar overshoot máximo +2 (dos requests in-flight), trigger reconciliation diaria. |
| R3 | **Ledger con `amount` negativo accidental** | Media | Crítico | `check (amount <> 0)`. Server normaliza a positivo y aplica signo via event_type. Tests con cases negativos. |
| R4 | **Cap mal aplicado** (otra zona horaria, día no UTC, sum incluye spends) | Media | Alto | `day_utc` se computa en server (no cliente). Sum del cap incluye SOLO `event_type = 'earn'` AND `source IN (daily-family)`. Tests con UTC boundary edge cases. |
| R5 | **Guest confusion** (guest ve copy de "earn", siente que pierde) | Media | Medio | Sprint 3 commit E actualiza copy guest a "Connect your wallet to save Peones rewards." Telemetría `funnel.guest_connect_cta_seen` ya en Sprint 1. |
| R6 | **Preview copy desactualizado** (Sprint 2 "preview" + Sprint 3 "real" conviven en el mismo deploy) | Alta | Bajo | Commit E elimina "preview" en mismo commit que conecta endpoint. Tests visuales de sheet asegurando que después de Sprint 3 commit E el copy NO dice "preview". |
| R7 | **Wallet spoofing sin SIWC** (cliente envía wallet de otro usuario) | Media | Alto | Trust-but-rate-limit Sprint 3 (Opción A §4.3). Cap diario contiene el daño. Origin enforce. Sprint 4 evalúa SIWC. Documentar como deuda. |
| R8 | **Balance lento por SUM ledger** cuando wallet tiene miles de rows | Baja | Medio | Index `wallet_created_idx`. View materializada opcional si crece. Sprint 3 no necesita: baseline esperada < 100 rows/wallet/mes. |
| R9 | **Wallet casing/checksum** (mezclar 0xABC vs 0xabc en ledger) | Alta | Alto | Lowercase normalize antes de TODO write y read. Validador SQL `~ '^0x[0-9a-f]{40}$'`. Tests de mixed-case input. |
| R10 | **Reconciliation pendiente** (descubrir overshoot del cap o duplicates días después sin proceso de cleanup) | Media | Medio | Diseñar reconciliation cron en Sprint 3 (job spec en SQL/edge function). Implementación puede ir a Sprint 4. |
| R11 | **Supabase / RLS mal configurado** (cliente puede insertar directamente) | Media | Crítico | RLS draft §4.2 bloquea inserts cliente. Test E2E con anon key intentando INSERT (debe fallar). |
| R12 | **Coach credits vs Peones confusión de moneda** | Media | Medio | Sprint 3 NO mezcla: `coach:credits:{wallet}` sigue intacto. Peones existen como moneda nueva. UI debe mostrar ambos balances distintos o reemplazar coach credits con Peones (Sprint 4 decision). |
| R13 | **`rewardPreviewPeones` deprecation rompe dashboards downstream** | Baja | Bajo | Telemetry consumer info en commit H. Período de overlap: ambos fields presentes en Sprint 3 inicial, deprecar `rewardPreviewPeones` en Sprint 4 una vez dashboards migrados. |
| R14 | **Migration en producción rompe deploy** (RLS mal escrita, view falla en data legacy) | Baja | Crítico | Aplicar migration en staging Supabase primero. Verificar con `supabase db diff`. Smoke en preview deploy antes de promote. |

---

## 14. Preguntas bloqueantes — RESUELTAS

Las dos preguntas que requerían input de Wolfcito antes del commit A quedaron cerradas el 2026-06-07:

1. **Backend del ledger:** ✅ **Supabase confirmado.** Motivo: queryability, auditabilidad, cap diario, reconciliation y ledger append-only. Redis NO se usa para Peones en Sprint 3.

2. **`senda_milestone` +5 bonus por pieza completa:** ❌ **Fuera de scope Sprint 3.** Parqueado para post-Sprint 4 retrospective o Milestone B. Sprint 3 solo acredita Peones por delta positivo de estrellas en ejercicios, no por bonus de pieza completa.

Defaults menores ya confirmados implícitamente:
- Trust-but-rate-limit sin SIWC en Sprint 3 (R7 mitigado por cap diario).
- `rewardPreviewPeones` se mantiene un sprint adicional como overlap para downstream consumers; se deprecará en Sprint 4 commit final.
- Coach credits (`coach:credits:{wallet}` en Redis) conviven con Peones — NO se unifica en Sprint 3. Sprint 4 evalúa migración como decisión de producto.

Cero preguntas bloqueantes vivas. **Commit A es safe to start.**

---

## Resumen ejecutivo

**Sprint 3 = ledger Peones append-only en Supabase + earn endpoint + UI básica de saldo.** Cero coordinación con on-chain. Spend real se difiere a Sprint 4.

**Backend confirmado: Supabase** (Wolfcito 2026-06-07). **`senda_milestone` parqueado** para post-Sprint 4 retrospective. Estas dos decisiones cierran las preguntas bloqueantes; el resto de defaults documentados quedan firmes.

Las 12 decisiones default (§2) están listas para arrancar. Las 14 mitigaciones de riesgos (§13) cubren los modos de falla conocidos (race, double earn, casing, RLS). El schema (§3) es estándar append-only ledger con view derivada para balance + función SQL para cap diario.

**Commit A safe to start.**

---

## Cross-references

- **Doc padre:** `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md`
- **Sprint 2 calibración:** `docs/product/chesscito-sprint-2-daily-tactic-calibration-2026-06-06.md`
- **Sprint 2 smoke:** `docs/handoffs/2026-06-06-sprint-2-daily-tactic-smoke.md`
- **Coach credits existing (no Peones):** `apps/web/src/lib/coach/use-coach-credits.ts`, `redis-keys.ts:23`
- **Daily Tactic telemetry stub:** `apps/web/src/lib/daily/telemetry.ts`
- **Sprint 2 commits Range:** `21fb30ac..261970be` (live on `origin/main`)
