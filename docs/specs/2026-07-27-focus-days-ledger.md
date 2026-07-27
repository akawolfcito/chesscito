# Spec — focus-days-ledger (Spec A)

**Fecha**: 2026-07-27 · **Revisión**: v3
**Status**: ✅ **APPROVED** — listo para `/tdd` (firmas del founder al pie)
**Alcance**: Spec A. **NO** toca precio, SKU, `durationDays`, `expires_at`, TTL de
Redis ni la duración comercial de 21 días. La ventana de 30 días es **Spec B**.

## Problem

La `ChallengeCard` muestra **"Day N of 21"** donde `N = min(streak, 21)`
(`challenge-card.tsx:128,215`). Como `streak` **se resetea a 1 al saltear un día**
(`progress.ts:75`), ese número **retrocede**: fallás el día 12 y la próxima
completación dice "Day 1 of 21". El pase vence por reloj, así que tras el primer
salteo el desafío es **incompletable** y la tarjeta no lo dice.

Además hay **código muerto que preserva la semántica equivocada**:
`challengeDayFromExpiry` se calcula en `use-hub-data.ts:418` y viaja en el prop
`dayOfChallenge`, y **ningún componente lo lee**. Es una trampa para el próximo
que toque la tarjeta.

Un solo número intenta responder tres preguntas y responde mal las tres: cuánto
hice, cuánto tiempo me queda, y qué tan constante soy.

## Goal

Separar progreso, vigencia y consistencia en tres métricas con tres fuentes, y
hacer que el progreso del desafío sea **acumulado, monótono y durable**:
server-side por temporada, sobrevive un cambio de device, nunca retrocede dentro
de una misma season.

## Guardrail de recompensas

> **Spec A no define, promete, calcula, reserva ni distribuye recompensas
> económicas.** Alcanzar 21 Focus Days únicamente cambia el estado de finalización
> dentro del producto y puede habilitar un logro conmemorativo o compartible.
> Cualquier campaña futura de recompensas deberá especificarse por separado y
> evaluarse mediante un sistema anti-sybil independiente. El ledger de Focus Days
> es una **señal de actividad**, no una prueba autoritativa de elegibilidad.
>
> **Este spec no crea derecho, expectativa ni garantía de recompensa futura.**

Al alcanzar 21, Spec A **no**: acredita Peones, Shields ni Coach credits · extiende
el entitlement · emite NFTs · mintea · reserva fondos · calcula rewards · garantiza
elegibilidad futura.

## Non-goals

- **Spec B**: ventana de 30 días, backfill de `expires_at`, re-set del TTL de
  Redis, destino del SKU `lite_season_pass_21` y del `seasonId`.
- Definir o anunciar rewards futuros; fórmulas, montos, snapshots o fechas de corte.
- Usar `completed === 21` como criterio **suficiente** de elegibilidad.
- Convertir el ledger en motor de rewards o en sistema anti-sybil.
- Garantizar que toda fila histórica será considerada por campañas futuras.
- Prueba criptográfica de que una sesión fue jugada (sigue abierto, otro spec).
- Tocar `DailyProgress` (localStorage) ni sus **nueve lectores**. `streak` sigue
  siendo el único dueño de las llamas.
- Cambiar qué enciende el día: el Daily sigue siendo lo único
  ([[project_daily_streak_invariants]]).
- Crear una tabla de enrollment de PRO.
- Crear un HMAC propio ni otra abstracción de identidad.

## Contracts (SDD)

### Migración

```sql
-- 20260728000000_focus_day_ledger.sql
CREATE TABLE IF NOT EXISTS focus_day_ledger (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet     text        NOT NULL,          -- lowercase, igual que lite_season_passes
  season_id  text        NOT NULL,
  date_utc   date        NOT NULL,          -- resuelta POR EL SERVIDOR
  source     text        NOT NULL
             CHECK (source IN ('daily', 'daily_retry', 'backfill_streak')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, season_id, date_utc)
);

CREATE INDEX IF NOT EXISTS idx_fdl_wallet_season
  ON focus_day_ledger(wallet, season_id);

-- Latch del backfill. SEPARADO del ledger porque un sembrado legítimo de 0 filas
-- es indistinguible de "todavía no corrió" si el latch fuese "existen filas".
CREATE TABLE IF NOT EXISTS focus_ledger_init (
  wallet         text        NOT NULL,
  season_id      text        NOT NULL,
  seeded_rows    int         NOT NULL,
  initialized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet, season_id)
);

ALTER TABLE focus_day_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_ledger_init ENABLE ROW LEVEL SECURITY;
-- service role only. Sin policies para anon/authenticated.
```

**Clave = `wallet` lowercase.** Razones: `lite_season_passes` ya está keyeada así
(`20260625120000_*.sql:16`) y permite JOIN directo con el entitlement;
`deriveAccountRef` pertenece a telemetría, puede devolver `null` sin
`TELEMETRY_ACCOUNT_SECRET`, y **rotar ese secreto orfana filas a propósito**
(`account-ref.ts:12`) — aceptable para analytics, no para progreso asociado a una
compra.

**La tabla no guarda** email, IP, device id, username ni nombre. Sólo wallet,
season, fecha y procedencia.

> **Las filas `backfill_streak` son datos inferidos para continuidad de UX. No
> representan evidencia histórica verificada.** Cualquier sistema futuro de
> rewards debe poder excluirlas, tratarlas con menor confianza, cruzarlas con
> otras señales y aplicar sus propios snapshots y controles anti-sybil.

### Semántica de `source`

| valor | significado |
|---|---|
| `daily` | escritura normal al completar el Daily de hoy |
| `daily_retry` | reconciliación de ayer o de una escritura perdida |
| `backfill_streak` | historia **inferida** durante la migración |

Ninguna fuente constituye por sí sola prueba suficiente para una recompensa
económica futura.

### Tipos

```ts
// lib/season-pass/focus-days.ts

/** Progreso = fechas UTC distintas dentro de la temporada activa. Monótono
 *  dentro de un mismo (wallet, seasonId). */
export type FocusDaysProgress = { completed: number; goal: number };

/** `unbounded` = acceso sin ventana (PRO): no hay countdown que mostrar. */
export type FocusWindow =
  | { kind: "expiring"; daysRemaining: number }
  | { kind: "unbounded" };

export type ChallengeProgressView =
  | { state: "loading" }                       // sólo la request inicial pendiente
  | { state: "offer" }
  | { state: "disabled"; window: FocusWindow; streak: number }   // flag apagado
  | { state: "degraded"; window: FocusWindow; streak: number }   // ledger caído
  | {
      state: "active";
      progress: FocusDaysProgress;
      window: FocusWindow;
      streak: number;
      /** `goal - completed > daysRemaining`. Siempre false si `unbounded`. */
      unreachable: boolean;
    }
  | {
      state: "completed";
      progress: FocusDaysProgress;
      window: FocusWindow;
      streak: number;
    };
```

```ts
// lib/entitlements/effective-training-pass.ts  — SE EXTIENDE
export type EffectiveTrainingPass = {
  active: boolean;
  source: "pro" | "season_pass" | null;
  seasonPassExpiresAt: string | null;
  proExpiresAt: number | null;
  /** NUEVO. Season a la que imputar el progreso. Para `season_pass` sale de la
   *  fila (congelado en la compra); para `pro`, de la config. `null` si no hay
   *  entitlement activo. Único punto donde la UI puede leerlo. */
  seasonId: string | null;
};
```

Para PRO, la season actual es `21day-mind-challenge-2026-q3`. **Cambiar ese valor
es un season rollover intencional**, no una edición inocente de config.

### API

```ts
// GET /api/season-pass/status  — SE EXTIENDE (no hay endpoint GET nuevo)
type FocusDaysSlice =
  | { status: "disabled" }                                  // flag apagado
  | { status: "unavailable" }                               // ledger caído
  | { status: "ok"; completed: number; goal: number; seasonId: string };
// la respuesta activa gana: focusDays: FocusDaysSlice

// POST /api/focus-day  — registra una finalización
type FocusDayRequest = {
  wallet: string;                 // 0x…, validado con ADDRESS_RE
  /** SOLO para reconciliación. Ausente en la completación normal. */
  date?: string;                  // "YYYY-MM-DD"
};

type FocusDayResponse =
  | { ok: true; progress: FocusDaysProgress }
  | { ok: false; error:
      | "invalid_wallet" | "invalid_date" | "no_entitlement"
      | "ledger_unavailable" | "rate_limited" | "disabled" };
```

**Rate limit**: 10 requests por wallet por 10 minutos, contador en Redis (Upstash
ya está cableado en la ruta de status). La idempotencia **no** depende del rate
limit: la garantiza el UNIQUE. Precedente de forma: `save-service.ts:76`
(`{ status: "rate_limited"; retryAfterMs }`).

### El fast path de Redis NO sirve al ledger

`GET /api/season-pass/status` tiene un **fast path de Redis que retorna antes de
tocar Supabase** (`route.ts:57-72`), y en esa rama el `seasonId` sale de la
**config** (`route.ts:65`), no de la fila del comprador (`route.ts:122`). Dos
consecuencias, ambas bloqueantes si se ignoran:

1. Un `ensureFocusLedgerInitialized` colgado del `/status` **nunca correría** para
   la mayoría de jugadores, que se sirven desde Redis.
2. Si la config rolea de season mientras un pase sigue vivo, la misma wallet
   recibe **dos `seasonId` distintos** según qué rama la atendió. Escribir el
   ledger con eso corrompe la imputación de temporada.

**Regla (firmada)**: el `seasonId` se resuelve **una sola vez, en un punto
canónico, ANTES de entrar al fast path** — no en cada rama. Redis puede cachear el
**entitlement**; no puede inventar una season distinta de la fila comprada. Para
`season_pass` la fuente es `lite_season_passes.season_id`; para `pro`, la config.
La rama Redis deja de emitir `configuredPass.seasonId` para compradores.

El fast path sigue sirviendo **acceso**; la slice `focusDays` y la inicialización
exigen la fila de DB. Si la DB no está disponible, la slice es
`{ status: "unavailable" }` y el entitlement se sirve igual desde Redis: **se
degrada el progreso, nunca el acceso pago.**

> La divergencia de `seasonId` entre las dos ramas **ya existe hoy en producción**
> y es independiente de este spec (hoy es inocua porque nadie consume el campo).
> Spec A la cierra por el lado de la resolución canónica y **no** cambia el payload
> que `verify-payment` escribe en Redis.

### Perfil de carga firmado

```text
Redis / entitlement:
- fuente primaria para autorizar acceso;
- mantiene el fast path;
- si Supabase falla, el acceso no se pierde.

Supabase / Focus Days:
- consulta en cada carga del Hub con entitlement activo;
- usa el índice (wallet, season_id);
- devuelve progreso o degraded;
- nunca bloquea el CTA ni el Daily.
```

La ruta declara `no-store`: es un `GET` con params del cliente que puede
inicializar el ledger, y una capa que lo cachee produce un bug irreproducible.

**Sin caché del contador todavía.** Agregar invalidación justo cuando estamos
estableciendo una fuente de verdad única es prematuro. Antes de optimizar, medir:
latencia p50/p95 · hit rate de Redis · frecuencia del estado `degraded` · lecturas
de Supabase por usuario activo · errores por ruta.

### Reglas del parámetro `date`

Se acepta **una sola** fecha por request, y sólo si **todas** se cumplen:

1. es hoy o ayer en UTC **server-side**;
2. no es futura;
3. no es anterior al inicio del pase (`expires_at - durationDays`);
4. no es posterior a `expires_at`;
5. el entitlement estaba activo **en esa fecha**.

Para `source: "pro"` la regla 5 se evalúa distinto: no hay fecha de inicio de
season, sólo `proExpiresAt`. Un PRO cuyo entitlement vence **hoy** pudo estar
activo ayer, así que para PRO la regla 5 se reduce a "el PRO no había vencido
antes de esa fecha" y las reglas 3 y 4 no aplican. Escribirlo explícito evita que
la implementación invente un inicio de pase que PRO no tiene.

Con `date` presente → `source = 'daily_retry'`. Sin `date` → `source = 'daily'`.
**Este endpoint no es un registrador arbitrario de fechas históricas.**

### Feature flag

Un env var de Vercel se snapshotea en el deployment: es el **default de
deployment**, no un control inmediato. Jerarquía firmada, de mayor a menor
precedencia:

```text
1. Redis override, si existe   →  focus-days-ledger:enabled = "true" | "false"
2. FOCUS_DAYS_LEDGER_ENABLED   →  server-side, NUNCA NEXT_PUBLIC_* (build-time)
3. Default seguro en código    →  off
```

| situación | resultado |
|---|---|
| key de Redis presente | manda Redis |
| key ausente | manda el env var |
| Redis caído | manda el env var |
| valor inválido | **loguear** y usar el default seguro |

**Default inicial: `off`** hasta completar migración y smoke. Después se enciende
por Redis, sin redeploy. Booleano `on`/`off` únicamente: **sin porcentajes ni
cohortes** — no hay infraestructura reutilizable para eso y un booleano remoto
alcanza para este cambio.

Apagado ⇒ no lee el ledger, no escribe, no hace backfill, y **nunca revive
`Day N of 21`**.

**Con el flag apagado** la tarjeta muestra la variante neutral: título, countdown
(o `Included with PRO`), combo y CTA. **Nunca** vuelve a mostrar `Day N of 21`.
La tabla puede quedar creada.

```text
21-Day Mind Challenge
9 days left
🔥 4-day combo
```

### Lo que se BORRA

`lib/season-pass/challenge-day.ts` · su test · el campo `dayOfChallenge` de
`ChallengeCardSeasonPass` (`challenge-card.tsx:59`) · su cálculo e import
(`use-hub-data.ts:45,418-421`) · las 11 referencias en tests.

> En el commit: la suite pierde tests porque **se elimina un módulo sin
> consumidores runtime**, no porque se haya perdido cobertura de comportamiento.

## Behavior

1. Con entitlement activo y flag encendido, al completar el Daily el cliente hace
   `POST /api/focus-day` **sin `date`**; el servidor inserta
   `(wallet, seasonId, hoy_utc, 'daily')` con `ON CONFLICT DO NOTHING`.
2. Repetir el POST el mismo día no inserta nada y devuelve el mismo progreso.
   Idempotencia por **constraint de DB**, no por chequeo previo.
3. Sin entitlement → `no_entitlement` y **no se escribe nada**.
4. Con el flag apagado → `disabled`, sin lectura, escritura ni backfill.
5. Con pase activo, la tarjeta muestra `{completed} of {goal} Focus Days` leído
   del server. **Nunca** deriva `completed` de `streak`.
6. `window.kind === "expiring"` → `{daysRemaining} days left`, métrica separada.
7. `window.kind === "unbounded"` (PRO) → `Included with PRO`, sin countdown; el
   progreso igual se cuenta.
8. `streak > 0` → combo (`🔥 {streak}-day combo`) en zona secundaria. Las 7 llamas
   se siguen pintando desde `focusWeek(...)` **sin cambios**.
9. `goal - completed > daysRemaining` → `unreachable`. La tarjeta **conserva**
   progreso y countdown, **retira** mensajes tipo `Only X more to complete`, **no**
   presenta la meta como alcanzable, y muestra copy de continuidad del hábito.
   Nunca copy derrotista ni "ya perdiste".
10. `completed >= goal` → `completed`, con estado celebratorio, aunque queden días
    de acceso. Sin ninguna acreditación económica (ver Guardrail).
11. Al abrir el Hub, `GET /api/season-pass/status` llama a
    `ensureFocusLedgerInitialized(...)`: si no hay fila en `focus_ledger_init` para
    `(wallet, seasonId)` **y** el cliente reportó su estado local, siembra
    `min(reportedStreak, elapsedEligibleDays, goal)` fechas consecutivas hacia
    atrás desde `lastCompletedDate`, recortadas a la ventana del pase, todas con
    `source = 'backfill_streak'`, y escribe el latch.

    `elapsedEligibleDays = díasUtc(hoy) - díasUtc(expires_at - durationDays) + 1`,
    clampeado a `[0, goal]`. Es la cantidad de días del pase ya transcurridos: nadie
    puede haber entrenado más días de los que su pase lleva vivo.

12. **El reporte del cliente es explícito, no inferido.** El `GET` acepta
    `streak` y `lastCompletedDate` como params. Ausentes = "todavía no sé"
    (localStorage sin hidratar): el backfill **no corre y el latch NO se escribe**,
    y se reintenta en la próxima llamada. `streak=0` presente = "sé que es cero":
    siembra 0 filas y **sí** escribe el latch. Un jugador con `streak` legítimo
    nunca pierde su sembrado por una carrera de hidratación
    ([[feedback_never_decide_from_unhydrated_state]]).
13. Con el latch presente, el backfill **no vuelve a correr jamás** para ese
    `(wallet, season_id)`.
14. Si Supabase o el ledger fallan, la tarjeta entra en `degraded`: **sin número de
    progreso**, **sin usar `streak` como fallback**, con vigencia, combo y CTA del
    Daily intactos, y retry posterior habilitado.
15. Si el `POST` falla (offline, 503, rate limit), el Daily **se completa igual**
    localmente. El ledger nunca bloquea el juego.
16. En el próximo mount del Hub, si `lastCompletedDate` local no está en el ledger
    y cae en [ayer, hoy] UTC server, el cliente reintenta con
    `date = lastCompletedDate` → `source = 'daily_retry'`.
17. Al cambiar el `seasonId`, el progreso visible arranca en cero, el ledger
    anterior **queda intacto**, y la UI deja claro que es **otra temporada**. El
    cero no se presenta como pérdida de progreso.

## Edge cases

- **Sin red al completar**: el día se pierde salvo que el reintento (16) lo alcance
  dentro de la ventana de un día. Consecuencia aceptada de que el servidor sea
  dueño de la fecha.
- **Cruce de medianoche UTC**: cubierto por `date` acotado a [ayer, hoy].
- **Reloj del device adelantado**: irrelevante, la fecha la resuelve el servidor.
- **Daily jugado sin wallet**: no se intenta el POST. No hay desafío sin compra.
- **Dos devices el mismo día**: una fila (UNIQUE). Sin doble conteo.
- **Backfill concurrente (dos pestañas)**: seguro. El sembrado es determinista
  sobre los mismos inputs y entra con `ON CONFLICT DO NOTHING`; el latch tiene PK.
- **`streak` mayor que los días transcurridos** (racha previa a la compra): el
  `min(...)` la recorta. Nadie arranca en "10 of 21" por una racha anterior al pago.
- **Renovación dentro de la misma season**: las filas sobreviven, el progreso
  **continúa**. Si algún día se quiere reiniciar, el discriminante debe ser el `id`
  del pase, no la season.
- **PRO que además compró el pase**: una fila por fecha; `window` la decide
  `resolveEffectiveTrainingPass`.
- **PRO + rollover de season**: el ledger viejo queda intacto y el progreso visible
  arranca en cero (behavior 17), con cobertura de tests propia.
- **`LOG_SALT` ausente**: `hashWallet` devuelve `"unsalted"` y avisa una vez
  (`logger.ts:143`). No rompe la ruta.

## Logging

Estructurado con `createLogger({ route })`, y **la wallet siempre pasa por
`hashWallet()`** (`logger.ts:141`) — nunca completa en un log line.

`focus_day_written` · `focus_day_duplicate` · `focus_day_backfilled` (con
`seeded_rows`) · `focus_day_invalid_date` · `focus_day_no_entitlement` ·
`focus_day_rate_limited` · `focus_day_ledger_unavailable` · `focus_day_disabled`.

## Acceptance criteria

- [ ] AC1 — `challenge-day.ts` y su test no existen; `dayOfChallenge` no aparece
      en ningún `.ts`/`.tsx`.
- [ ] AC2 — La tarjeta activa renderiza `{n} of {goal} Focus Days` con `streak`
      **distinto** de `completed` en el fixture.
- [ ] AC3 — Tras un salteo (`streak` vuelve a 1) el número mostrado **no baja**,
      dentro del **mismo** `(wallet, season_id)`.
- [ ] AC4 — Con `season_id` nuevo el progreso arranca en cero y el ledger anterior
      sigue en la tabla.
- [ ] AC5 — Pase activo → `{d} days left`. PRO → `Included with PRO` y **ningún**
      countdown.
- [ ] AC6 — El combo se renderiza en su propio nodo, distinguible por `data-testid`.
- [ ] AC7 — `POST` dos veces el mismo día deja **una** fila.
- [ ] AC8 — `POST` sin entitlement → `no_entitlement`, tabla **vacía**.
- [ ] AC9 — `POST` con `date` fuera de [ayer, hoy], futura, previa al inicio del
      pase o posterior a `expires_at` → `invalid_date`, sin escribir.
- [ ] AC10 — `POST` con `date` válida escribe `source = 'daily_retry'`.
- [ ] AC11 — Un INSERT con `source` fuera del CHECK **falla** (test de migración).
- [ ] AC12 — El backfill siembra `min(streak, elapsed, goal)` filas
      `backfill_streak`; correrlo dos veces no agrega ninguna.
- [ ] AC13 — Sin `streak` reportado, el backfill **no** siembra **y no** escribe el
      latch; la llamada siguiente **sí** siembra.
- [ ] AC14 — Con el ledger caído la tarjeta entra en `degraded`: sin número, con
      countdown, con combo, con CTA operativo.
- [ ] AC15 — Con el flag apagado la tarjeta muestra la variante neutral y **no**
      aparece la cadena `Day` seguida de `of 21` en ningún nodo.
- [ ] AC16 — `goal - completed > daysRemaining` → estado `unreachable` con copy de
      continuidad, sin `Only X more to complete`.
- [ ] AC17 — `completed >= goal` → CTA de completado aunque `daysRemaining > 0`.
- [ ] AC18 — Alcanzar 21 **no** invoca ninguna acreditación. El test espía los
      cuatro caminos por nombre: el RPC de spend/credit de Peones, el contador de
      shields, los créditos de Coach y cualquier escritura de `expires_at`.
      Los cuatro quedan en cero.
- [ ] AC25 — El `seasonId` usado para escribir sale de `lite_season_passes`, no de
      la config: con Redis sirviendo el entitlement y una config de season
      **distinta** a la de la fila, la escritura usa la de la fila.
- [ ] AC26 — Con Supabase caído y Redis vivo, el entitlement se sirve igual
      (acceso intacto) y la slice es `unavailable` (progreso degradado).
- [ ] AC27 — Jerarquía del gate: key de Redis presente manda sobre el env var ·
      key ausente cae al env var · Redis caído cae al env var · **valor inválido
      loguea y cae al default seguro (`off`)** · sin ninguno de los tres, `off`.
- [ ] AC28 — Contrato de parseo del param: `?streak=0` siembra y latchea;
      `?streak=` y el param ausente **no** latchean. Test sobre el parseo, no
      sobre la conducta del backfill (AC13 cubre la conducta).
- [ ] AC29 — El backfill entra como **un solo INSERT multi-row**, no N
      round-trips.
- [ ] AC30 — El `seasonId` se resuelve en un punto canónico previo al fast path:
      un test con Redis sirviendo el entitlement y la config **rolada** obtiene el
      `season_id` de la fila, no el de la config.
- [ ] AC19 — Un `POST` en 503 **no impide** completar el Daily localmente.
- [ ] AC20 — **Camino real** (no props inyectadas a mano): un test que va de la
      respuesta de `/status` → `resolveEffectiveTrainingPass` → `use-hub-data` →
      `ChallengeCard`, cubriendo pase expirable, PRO unbounded y `degraded`.
- [ ] AC21 — Ambas migraciones con RLS habilitada y sin policies para
      anon/authenticated.
- [ ] AC22 — Ningún log line contiene una wallet completa (test sobre el sink).
- [ ] AC23 — `editorial.ts` y `es.ts` tienen las claves nuevas, con **cero
      em-dashes** nuevos (`anti-ai-prose.test.ts`).
- [ ] AC24 — Ningún copy nuevo dice "on-chain", NFT ni mint (`pnpm content:audit`).

## i18n

| English | Español |
|---|---|
| `12 of 21 Focus Days` | `12 de 21 días completados` |
| `9 days left` | `Quedan 9 días` |
| `Included with PRO` | `Incluido con PRO` |
| `4-day combo` | `Combo de 4 días` |
| `Focus progress is temporarily unavailable` | `El progreso no está disponible por ahora` |
| `Keep building your habit` | `Sigue construyendo el hábito` |
| `Complete more Focus Days before this pass ends.` | `Completa más días antes de que termine el pase.` |

No traducir `Focus Days` literal como "Días de Enfoque".

## Archivos a tocar

**Nuevos**: `supabase/migrations/20260728000000_focus_day_ledger.sql` ·
`lib/season-pass/focus-days.ts` · `lib/season-pass/focus-ledger-init.ts` ·
`app/api/focus-day/route.ts` · sus tests.

**Modificados**: `lib/entitlements/effective-training-pass.ts` (+`seasonId`) ·
`app/api/season-pass/status/route.ts` (+`focusDays`, +init lazy) ·
`components/hub/use-hub-data.ts` · `components/hub/challenge-card.tsx` ·
`lib/content/editorial.ts` · `lib/content/messages/es.ts` · `lib/feature-flags.ts`.

**Borrados**: `lib/season-pass/challenge-day.ts` + su test.

**Tests que se rompen y hay que tocar**: `challenge-card.test.tsx` (×9 props, y
las aserciones de texto en 167/646/710/819) · `hub-lite-scaffold.test.tsx` (×2) ·
`hub-scaffold-client.test.tsx:884,895` (espera "Day 0 of 21").

## Out of scope / future

- Spec B (ventana 21-en-30 + migración de pases vivos).
- Shields protegiendo la **racha** (hoy salvan un ejercicio, no un día).
- Cobertura VR del estado `unreachable` y del `degraded`.
- Cola persistente de días pendientes (reconciliación fuerte offline).
- Tabla de enrollment de PRO.
- Estrategia de rewards y anti-sybil: **otro repo o directorio**.

## `unreachable`: convive con el CTA, no lo reemplaza

Decidido (founder, 2026-07-27). El mensaje **explica el estado**; el CTA **mantiene
la acción**. Jerarquía en la tarjeta:

```text
12 of 21 Focus Days
Quedan 4 días

Sigue construyendo el hábito
Completa más días antes de que termine el pase.

[ START TODAY'S FOCUS ]
```

Reemplazar el CTA convertiría una advertencia en un callejón sin salida. El Daily
sigue teniendo valor aunque 21 ya no se alcance, y el hábito es el producto. El
copy de `unreachable` reemplaza **únicamente** los mensajes de progreso optimistas
tipo `Only X more`.

→ AC16 se lee con esto: el CTA sigue presente y operativo en estado `unreachable`.

## Open questions

Ninguna. El spec está firmado y cerrado.

## Firma founder — 2026-07-27

```text
APPROVED

1. Se acepta que /api/season-pass/status consulte Supabase en cada carga del Hub
para usuarios con entitlement activo. Redis sigue siendo la fuente de acceso;
Supabase enriquece con progreso. Una falla del ledger produce estado degraded y
nunca revoca ni bloquea acceso pagado.

2. Se aprueba un kill switch remoto en Redis, con
FOCUS_DAYS_LEDGER_ENABLED como fallback/default de deployment. El override de
Redis tiene precedencia y permite apagar lectura, escritura y backfill sin
redeploy.
```

Condición operativa de la firma 1: la consulta del ledger debe ser **pequeña,
indexada y degradable**. La propiedad que protege es una sola — **una caída del
ledger nunca quita acceso pagado.**

`ensureFocusLedgerInitialized` es una **excepción consciente**: un `GET` que
realiza una inicialización idempotente por migración, no una mutación ordinaria
del usuario. Queda aislada en su propia función con nombre explícito.
