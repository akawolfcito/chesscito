# D2.1 — el GET de balance deja de escribir en cada lectura

**Fecha:** 2026-08-03/04 · **Base:** `03452db7` (Fase 1, en producción)

---

## Root cause

`GET /api/peones/balance` llamaba `ensurePeonesWelcomePack()` en **cada** lectura. Para
toda wallet recurrente ese INSERT sólo podía terminar en `23505`: toma lock, escribe WAL,
golpea el índice único y hace rollback. **~5.9K escrituras inútiles cada 12 h** contra una
base agotando su Disk IO budget — y visible en la evidencia del incidente como
`POST /rest/v1/peones_ledger` con 522.

---

## Solución: Opción A (sin migración)

Sonda de existencia sobre `idempotency_key`, y seed **sólo** si falta.

Por qué es barata, verificado en la migración `20260607000000_peones_ledger_init.sql`:

```sql
create unique index peones_ledger_idempotency_uq
  on public.peones_ledger (idempotency_key);
```

Es un **btree único** → la sonda es un index probe que devuelve a lo sumo una fila.

### Alternativas rechazadas

- **B — RPC con `INSERT … ON CONFLICT DO NOTHING`.** Requiere migración. La sonda ya
  logra el objetivo sin tocar el esquema.
- **C — Redis como caché positiva.** Para ahorrar la sonda, Redis tendría que autorizar
  el *salto* de un otorgamiento; eso es usarlo como garantía de otorgamiento previo, que
  es justo lo prohibido. Un falso positivo negaría en silencio un Welcome Pack legítimo.
  La sonda ya es un index probe: el intercambio no compensa. **Nada en este camino
  consulta Redis**, y hay un test que lo fija.

---

## Confirmaciones pedidas antes del commit

### 1. Si la sonda falla (522 / timeout / conexión)

`hasPeonesWelcomePack` devuelve **`"unknown"`**, un tercer valor que **no** se pliega a
`false`. La ruta sólo siembra con `alreadySeeded === false`:

```ts
const alreadySeeded = await hasPeonesWelcomePack(supabase, wallet);
if (alreadySeeded === false) {           // "unknown" NO entra acá
  const seeded = await ensurePeonesWelcomePack(supabase, wallet);
}
```

- ✅ no se llama `ensurePeonesWelcomePack`;
- ✅ no se intenta ningún INSERT — disparar una escritura contra una base que acaba de
  fallar una lectura es exactamente lo que D2.1 elimina;
- ✅ no existe retry: una llamada, un resultado, sin bucle (test: la sonda se ejecuta
  **exactamente una vez** por request aun fallando);
- ✅ el siguiente GET vuelve a intentarlo — no hay estado persistido que lo impida.

### 2. Forma de la sonda

```ts
supabase.from("peones_ledger")
  .select("idempotency_key")               // una columna, la mínima
  .eq("idempotency_key", idempotencyKey)   // el índice único
  .limit(1)                                // cota explícita
  .maybeSingle();
```

- ✅ usa el índice único existente, por igualdad exacta sobre la clave;
- ✅ una sola columna — y es la propia clave, así que el índice alcanza para responder;
- ✅ **`.limit(1)` agregado en esta revisión.** Verifiqué en el postgrest-js instalado
  (2.100.1) que `maybeSingle()` **no agrega LIMIT** a la query: sólo post-procesa el
  array en cliente (`if (isMaybeSingle && Array.isArray(data))`). Sin `.limit(1)` la cota
  descansaría sólo en el índice; con él, se cumple también a nivel de query;
- ✅ nunca `select("*")` — esta tabla lleva wallets, metadata y attestation hashes que no
  tienen por qué cruzar el cable para un chequeo de existencia.

### 3. El índice único sigue siendo la ÚNICA garantía final

La sonda es una optimización y puede equivocarse en las dos direcciones sin consecuencia:

| La sonda dice | La realidad | Qué pasa |
|---|---|---|
| "sembrada" | no lo está | la próxima lectura la siembra |
| "no sembrada" | ya lo está | el INSERT choca con `23505` y no-opera |
| `"unknown"` | cualquiera | no se escribe; una lectura futura resuelve |

Hay un test dedicado a esto: `"does not make the index redundant: a stale 'false' still
cannot double-grant"`.

### 4. Logs de `/api/peones/balance`

Los cinco call sites del archivo, auditados uno por uno:

| Log | Payload |
|---|---|
| `guard_failed` | `reason` — proviene sólo de `enforceOrigin`, que lanza el literal fijo `"Forbidden"` (verificado en `demo-signing.ts:165`) |
| `supabase_unavailable` | `wallet_hash` |
| `peones_welcome_pack_seeded` | `wallet_hash` |
| `peones_welcome_pack_threw` | `wallet_hash`, `error_class` |
| `rpc_failed` | `wallet_hash`, `operation`, `code`, `error_class`, `deployment`, `mode` |

- ✅ sin wallet completa — sólo digest salado de 16 hex;
- ✅ sin `capError.message`. Entra al clasificador y **no sale**: `classifyDbError`
  devuelve uno de cinco literales fijos (`html_gateway_error`, `timeout`,
  `connection_failed`, `db_error`, `unknown`);
- ✅ sin HTML de Supabase — ese es precisamente el caso `html_gateway_error`, y el test
  verifica que la cadena `<!DOCTYPE html>` no aparece en ninguna línea;
- ✅ sin URL ni query string: `req.url` y `searchParams` no aparecen en ningún log;
- ✅ sin payload externo.

---

## Presupuesto de operaciones

| | Antes | Después |
|---|---|---|
| **Wallet recurrente** | 1 INSERT + 1 RPC + 1 SELECT | **0 INSERT** + 1 RPC + 2 SELECT |
| **Wallet nueva** | 1 INSERT + 1 RPC + 1 SELECT | 1 INSERT + 1 RPC + 2 SELECT *(una vez en su vida)* |

El caso dominante convierte **una escritura en un index probe**. Fijado por el test
`"the write happens on the FIRST read and never again"`, que mide 5 lecturas seguidas y
espera `[1, 0, 0, 0, 0]`.

---

## Concurrencia

Dos primeras lecturas simultáneas: ambas sondean ausente, ambas hacen INSERT, el índice
deja pasar **una**. Idéntico al mecanismo anterior — la sonda no lo debilita, sólo evita
llegar hasta ahí en el caso recurrente. Cubierto por
`"two simultaneous first reads produce at most ONE ledger row"`.

---

## Tests

**28 nuevos.** `welcome-pack-gate.test.ts` (20) **no mockea** `welcome-pack-server`: corre
la lógica real contra un ledger falso que implementa el `23505` del índice único y
**cuenta operaciones por tabla**. Eso convierte el titular ("cero INSERTs para una wallet
recurrente") en una medición, no en una afirmación sobre un mock. `welcome-pack-server.test.ts`
suma 8 sobre la sonda.

Cubren los 10 requisitos, incluidos: balance 0 tras gastar **no** re-otorga; sonda fallida
no dispara INSERT; Redis caído no puede duplicar el pack; `23505` no produce 500; el
contrato HTTP y el cap diario no cambian.

---

## Riesgo pendiente (fuera de alcance de este commit)

El barrido de `app/api` encontró **7 sitios más que loguean la wallet cruda**:
`peones/earn:203`, `peones/spend:172,241`, `verify-payment:234,289,326,400`. No los toqué:
son rutas de escritura y pago, con otro radio de impacto. Merecen su propio commit.

---

## Nota de implementación

Agregar `select` al tipo estructural existente disparó `TS2589` (profundidad de
instanciación) contra el `SupabaseClient` real. Resuelto derivando el tipo de
`getSupabaseServer`, que es la convención que el repo ya usa para helpers de lectura
(`season-pass/focus-ledger-init.ts`) — sin casts en los call sites.
