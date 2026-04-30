# `/api/verify-pro` — Shape Proposal (Commit 3 pre-review)

Anexo de `2026-04-29-pro-phase-0.md`. Reviewed before coding.

## Mini-review del patrón actual (`verify-purchase/route.ts`)

| # | Aspecto | Implementación actual | Reusable as-is? |
|---|---------|------------------------|-----------------|
| 1 | **enforceOrigin/rate-limit** | `enforceOrigin(req)` valida host vs `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` (MiniPay-safe: permite null Origin). `enforceRateLimit(ip)` por IP, sliding window 5 req/60s. | ✅ Idéntico |
| 2 | **txHash validation** | `TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/` + `walletAddress` con `isAddress()`. | ✅ Idéntico |
| 3 | **decodeEventLog** | Mini-ABI con `ItemPurchased(buyer indexed, itemId indexed, quantity, unitPriceUsd6, totalAmount, token, treasury)`. Topic: `keccak256("ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)")`. | ✅ Idéntico (sólo cambia el itemId esperado) |
| 4 | **buyer === wallet** | `buyer.toLowerCase() !== wallet.toLowerCase()` → `continue`. | ✅ Idéntico |
| 5 | **Token allowlist** | `STABLECOIN_ADDRESSES_LOWER.includes(token.toLowerCase())` desde `lib/contracts/tokens.ts`. Refuerza el caso "compré con CELO al precio mal-normalizado". | ✅ Idéntico |
| 6 | **Dedupe** | `coach:processed-tx:<txHash>` set con `ex: 90 * 24 * 60 * 60`. Short-circuit antes de cualquier RPC call. | ✅ Mismo patrón, namespace dedicado |
| 7 | **Write** | `redis.incrby(coach:credits:<wallet>, n)` + `redis.set(processed-tx, "1", { ex: 90d })` en `Promise.all`. | ⚠️ **Cambia**: PRO no es contador, es timestamp con extensión |
| 8 | **Errores** | Public errors específicos (400 con motivo) cuando falla validación; `catch{}` global → 500 "Internal server error" sin leak. | ✅ Idéntico |
| 9 | **Tests** | 13 casos en `__tests__/route.test.ts` con mocks hoisted de Redis + viem. Helpers: `encodeAddressTopic`, `encodeUint256Topic`, `encodeItemPurchasedData`. | ✅ Reusable casi 1:1 |

## Shape propuesto: `/api/verify-pro/route.ts`

### Archivos a tocar
1. **NEW** `apps/web/src/app/api/verify-pro/route.ts` — endpoint
2. **NEW** `apps/web/src/app/api/verify-pro/__tests__/route.test.ts` — tests (espejo de verify-purchase)
3. **MOD** `apps/web/src/lib/coach/redis-keys.ts` — agregar:
   - `pro: (wallet) => 'coach:pro:' + wallet`
   - `proProcessedTx: (txHash) => 'coach:pro:processed-tx:' + txHash`

### Pseudo-flujo

```
POST /api/verify-pro { walletAddress, txHash }

1.  enforceOrigin(req)                      // 500 si throw
2.  enforceRateLimit(getRequestIp(req))     // 500 si throw
3.  parse body → { txHash, walletAddress }
4.  if !txHash || !walletAddress || !client || !SHOP_ADDRESS  → 400 "Missing params"
5.  if !isAddress(walletAddress)            → 400 "Invalid wallet address"
6.  if !TX_HASH_RE.test(txHash)             → 400 "Invalid transaction hash"
7.  wallet = walletAddress.toLowerCase()
8.  if redis.get(REDIS_KEYS.proProcessedTx(txHash))   → return { active: true, expiresAt: <current> }   // idempotente
9.  receipt = client.getTransactionReceipt({ hash })
10. if receipt.status !== 'success'         → 400 "Transaction failed on-chain"
11. logs = receipt.logs
        .filter(addr === SHOP_ADDRESS && topic[0] === ITEM_PURCHASED_TOPIC)
12. found = false
    for log in logs:
       decoded = decodeEventLog(...)
       if buyer.lower() !== wallet            → continue
       if itemId !== PRO_ITEM_ID              → continue
       if !STABLECOIN_ADDRESSES_LOWER.includes(token.lower()) → continue
       found = true; break
13. if !found                              → 400 "No PRO purchase found in transaction"
14. expiresAt = atomicExtendPro(wallet, PRO_DURATION_DAYS)    // Lua, ver abajo
15. redis.set(REDIS_KEYS.proProcessedTx(txHash), '1', { ex: 90 * 24 * 60 * 60 })
16. return { active: true, expiresAt }
```

### Atomic extension — ¿realmente necesitamos Lua?

**Recomendación: sí, Lua.**

Sin Lua (read-then-write):
```
cur = await redis.get(key)               // T0
new = max(now, cur ?? 0) + 30d
await redis.set(key, new, ex: ttl)       // T1
```

Race window entre T0 y T1: dos verify-pro concurrentes (dos txs distintas, mismo wallet) leen `cur=E`, ambas escriben `E + 30d`. Resultado: usuario paga 2 meses, recibe 1. **Cliente perdido**.

Probabilidad real: muy baja (requiere dos buy txs en flight casi simultáneas). Pero el costo de fix es 8 líneas de Lua y el patrón ya existe en `coach/credits/route.ts:24-30`.

```ts
// Atomic Lua: SET key = max(GET key, now) + 30d, EX = (new - now) / 1000
const PRO_EXTEND_LUA = `
  local cur = redis.call('GET', KEYS[1])
  local now = tonumber(ARGV[1])
  local addMs = tonumber(ARGV[2])
  local base = (cur and tonumber(cur) > now) and tonumber(cur) or now
  local newExpiresAt = base + addMs
  local ttlSec = math.ceil((newExpiresAt - now) / 1000)
  redis.call('SET', KEYS[1], tostring(newExpiresAt), 'EX', ttlSec)
  return tostring(newExpiresAt)
`;

const result = await redis.eval(
  PRO_EXTEND_LUA,
  [REDIS_KEYS.pro(wallet)],
  [Date.now(), PRO_DURATION_DAYS * 24 * 60 * 60 * 1000],
);
const expiresAt = Number(result);
```

**Trade-off explícito**:
- Pro: correcto bajo concurrencia, 8 líneas, patrón ya validado.
- Con: una abstracción extra para mantener.
- Veredicto: la corrección **paga por sí sola** porque el caso afecta a paying customers.

Si el reviewer prefiere simple-first, fallback aceptable: read-then-write con un `SETNX` lock corto (`coach:pro:lock:<wallet>` ex 5s) — pero eso es **más** complejo que el Lua. Lua es la opción más simple y correcta.

### Riesgos identificados

| # | Riesgo | Mitigación |
|---|--------|-----------|
| R1 | **Race en extensión PRO** (dos txs simultáneas) | Lua atómico (arriba) |
| R2 | **Replay del mismo txHash** | Dedupe key `coach:pro:processed-tx:<txHash>` ex 90d (idéntico al patrón coach) |
| R3 | **Tx ajena (alguien verifica con un txHash de otra wallet)** | Filtro `buyer === wallet` ya en el flujo |
| R4 | **Pago en CELO al precio mal-normalizado** | `STABLECOIN_ADDRESSES_LOWER` allowlist (idéntico) |
| R5 | **Setear PRO expirado por clock skew** | Comparación `cur > now` dentro de Lua usa `now` del server; cliente nunca ve `now` |
| R6 | **TTL Redis se desalinea con expiresAt** | TTL calculado dentro de Lua = `(newExpiresAt - now) / 1000`; auto-purga al expirar |
| R7 | **Returning expiresAt al cliente leak privacy?** | No es PII; usuario sabe cuándo expira su PRO. Aceptable |
| R8 | **Tx revertido pero log emitido (imposible en EVM)** | No aplica; check `receipt.status === 'success'` antes de iterar logs |
| R9 | **`itemId 6` aún no `setItem(...)` en mainnet** | Buy tx revertirá; verify-pro retornará 400 "No PRO purchase found". Documentado release-blocker |
| R10 | **Idempotente call con tx ya procesada NO retorna current expiresAt** | Step 8 hace `redis.get(REDIS_KEYS.pro(wallet))` y retorna; cliente que reintenta verify recibe `{ active: true, expiresAt }` consistente |

### Tests propuestos (10–11 casos)

Espejo de `verify-purchase` test, helpers reusables 1:1:

1. ✅ `set expiresAt = now + 30d on a fresh PRO purchase`
2. ✅ `extends from current expiresAt when PRO already active`
3. ✅ `extends from now when current PRO is expired`
4. ✅ `refuses PRO when payment was made in CELO (defense-in-depth)`
5. ✅ `short-circuits when txHash already processed (returns current expiresAt)`
6. ✅ `400 when tx status is not success`
7. ✅ `400 when no PRO item is purchased in tx (e.g. only Coach pack)`
8. ✅ `ignores logs whose buyer is a different wallet`
9. ✅ `ignores logs emitted by a different contract address`
10. ✅ `400 when txHash missing/malformed, walletAddress malformed`
11. ✅ `500 when enforceOrigin throws`

**Race test**: opcional para v1. Mockear `redis.eval` y verificar que la llamada usa los KEYS/ARGV correctos. No simular concurrencia real (vitest no es ideal). Suficiente para Fase 0.

### Decisiones cerradas en este review

- Endpoint: **`/api/verify-pro`** (top-level, no anidado bajo `/api/coach`). PRO es comercial, conceptualmente más amplio que coach.
- Redis key namespace: **`coach:pro:<wallet>`** (alineado con `coach:credits:<wallet>` para coexistir en mismo Redis). Mismo prefix `coach:pro:processed-tx:` para dedupe.
- Response body: **`{ active: true, expiresAt: number }`** (ms desde epoch, UTC). Cliente compara con `Date.now()`.
- Errors: **público** mensaje genérico ("Could not verify purchase") + **interno** específico al log del server. (Decisión: por ahora, mantener 1:1 con verify-purchase y exponer mensajes específicos. Endurecer en hardening sprint.)
- Lua atómico: **sí**, para no perder dinero del paying customer en race.

### Decisiones que requieren confirmación

1. **¿Lua o read-then-write?** → propuesta: Lua. Si prefieres simple-first para Fase 0, lo hago read-then-write con TODO de Lua para Fase 0.1.
2. **¿Errores públicos genéricos o específicos?** → propuesta: específicos (mismo patrón que verify-purchase). Si prefieres genéricos por seguridad, cambio a "Could not verify purchase" en todos los 400.

Una vez confirmadas, codeo el endpoint + tests en un solo commit `feat(api): add /api/verify-pro endpoint`.
