# /api/founder-status Timeout Audit

**Fecha:** 2026-06-03
**Síntoma:** `eth_getLogs` unbounded contra Forno timeoutea ~40s; warning persistente `SHOP_DEPLOY_BLOCK_CELO is not set`; route puede devolver 500 a usuarios PRO/Founder.
**Modo:** Read-only audit. Patch propuesto en §3; no aplicado.

---

## 1. Causa exacta

Cadena de fallo (paso a paso, con citas `file:line`):

1. **`apps/web/src/app/api/founder-status/route.ts:51-53`** lee `process.env.SHOP_DEPLOY_BLOCK_CELO`. Si la env var no existe, `SHOP_DEPLOY_BLOCK = null`.
2. **`route.ts:55-66`** emite el warning de cold-start (`console.warn`) cuando `NODE_ENV === "production"` y la env var no está. Es informativo, no bloquea.
3. **`route.ts:126`** usa `fromBlock: SHOP_DEPLOY_BLOCK ?? "earliest"` en la query `eth_getLogs`.
4. **Forno (Celo public RPC)** rechaza ranges unbounded `earliest → latest` sobre ~37M bloques. Comportamiento observado: truncado silencioso O error tras ~40s.
5. **`route.ts:150-160`** captura el error y devuelve `500 { error: "Chain read failed" }`.
6. **Consumer `apps/web/src/lib/founder/use-founder-status.ts:74-83`** tolera el 500 silenciosamente — el hook mantiene el estado de `localStorage` o `false`. No hay error visible en UI.

### Verificación con archivos:

- `apps/web/.env.template` → no contiene `SHOP_DEPLOY_BLOCK_CELO` (verificado vía `sed | grep`).
- `apps/web/.env.mainnet` → no contiene `SHOP_DEPLOY_BLOCK_CELO`.
- `apps/contracts/deployments/celo.json` → tiene `shopDeployedAt: "2026-03-12T16:47:12.872Z"` y `shopProxy: "0x24846C77..."`, pero **NO tiene `shopDeployBlock` numérico**.
- El comment en `route.ts:64` documenta el valor: `~37800000 for the 2026-03-12 deploy`.

**Conclusión:** la env var nunca fue configurada en ningún entorno (template, mainnet, preview, prod). El fallback `"earliest"` corre en TODOS los entornos de prod desde el día 1 del deploy de la ruta.

---

## 2. Archivos relevantes

| Archivo | Rol |
|---|---|
| `apps/web/src/app/api/founder-status/route.ts:51-66,118-160` | Route. fromBlock fallback + warning + getLogs + error handling |
| `apps/web/src/lib/founder/use-founder-status.ts:56-91` | Hook consumer. Tolera 500 silenciosamente, mantiene cache localStorage |
| `apps/web/src/components/exercises/exercises-screen.tsx:209` | Único callsite del hook (`/exercises` route) |
| `apps/web/src/app/api/founder-status/__tests__/route.test.ts` | 7 tests; ninguno verifica el path del fallback `"earliest"` ni la presencia de env var |
| `apps/contracts/deployments/celo.json` | Tiene `shopProxy` y `shopDeployedAt` pero NO `shopDeployBlock` |
| `apps/web/.env.template` | Sin `SHOP_DEPLOY_BLOCK_CELO` documentado |

### Caching y revalidate

- `route.ts:31` declara `export const dynamic = "force-dynamic"` → la ruta NO se cachea en CDN.
- Cache propia en Redis con TTL 24h (`route.ts:38,103-116,163-171`). Si Redis tiene la respuesta, no se llega a `getLogs`. Mitiga el problema PARCIALMENTE: solo el primer hit por wallet por 24h paga el 500.
- Cuando `getLogs` falla, **NO se cachea nada** (route.ts:148 solo cachea cuando hay éxito). El próximo hit del mismo wallet vuelve a intentar y vuelve a fallar.
- Consumer cache: `localStorage["chesscito:founder-active:<wallet>"]` con TTL 24h (`use-founder-status.ts:6-43`). Suprime el flash inactive→owned en cold load para founders conocidos. El 500 del servidor no invalida esta cache.

### Frecuencia de llamado

`useFounderStatus()` se llama desde **1 componente**: `exercises-screen.tsx:209`. La hook hace `fetch` cada vez que `wallet` cambia en `useAccount`. Por sesión de usuario en `/exercises`, típicamente 1-2 hits (mount + posibles reconects). No es un hot path tipo /hub.

---

## 3. Patch propuesto — fix combinado mínimo

Estrategia: env var en prod (curado operacional) + fallback hardcoded en código (red de seguridad). Cada uno cubre el otro.

### 3.1 Patch operacional (no código) — set env var en Vercel

Setear en Vercel Project Settings → Environment Variables:

| Key | Value | Scope |
|---|---|---|
| `SHOP_DEPLOY_BLOCK_CELO` | `37800000` | Production + Preview |

Justificación del valor: `route.ts:64` lo documenta como `~37800000 for the 2026-03-12 deploy per apps/contracts/deployments/celo.json`. El timestamp `shopDeployedAt: 2026-03-12T16:47:12.872Z` corresponde a ese rango de bloques en Celo mainnet.

Esta acción sola elimina el 500 sin tocar código.

### 3.2 Patch código — fallback hardcoded + propagar al .env template (3 cambios chicos)

#### a) `apps/web/src/app/api/founder-status/route.ts:51-66`

```diff
+/** Hardcoded fallback when `SHOP_DEPLOY_BLOCK_CELO` env var is unset.
+ * Mirrors `shopDeployedAt: 2026-03-12T16:47:12.872Z` from
+ * `apps/contracts/deployments/celo.json`. Update if Shop is redeployed.
+ * Env var still wins when present (e.g. preview deploys against a
+ * fresh Shop fixture). */
+const SHOP_DEPLOY_BLOCK_FALLBACK = 37_800_000n;
+
 const SHOP_DEPLOY_BLOCK = process.env.SHOP_DEPLOY_BLOCK_CELO
   ? BigInt(process.env.SHOP_DEPLOY_BLOCK_CELO)
-  : null;
-
-if (!SHOP_DEPLOY_BLOCK && process.env.NODE_ENV === "production") {
-  // Module-load side-effect — fires once per cold start, not per
-  // request, so log volume stays bounded.
-  // eslint-disable-next-line no-console
-  console.warn(
-    "[founder-status] SHOP_DEPLOY_BLOCK_CELO is not set. " +
-      "Falling back to fromBlock=earliest. Public Celo RPC providers " +
-      "will likely reject the unbounded range and the route will 500. " +
-      "Set this env var to the Shop deploy block (~37800000 for the " +
-      "2026-03-12 deploy per apps/contracts/deployments/celo.json).",
-  );
-}
+  : SHOP_DEPLOY_BLOCK_FALLBACK;
```

Y en el `getLogs` (`route.ts:126`):

```diff
-      fromBlock: SHOP_DEPLOY_BLOCK ?? "earliest",
+      fromBlock: SHOP_DEPLOY_BLOCK,
```

#### b) `apps/web/.env.template` — agregar la key documentada (sin valor leak)

```diff
 NEXT_PUBLIC_SHOP_ADDRESS=...
+# Shop deploy block on Celo mainnet. Used by /api/founder-status to bound
+# eth_getLogs scans (Forno rejects unbounded "earliest" ranges).
+# Match `shopDeployedAt` in apps/contracts/deployments/celo.json.
+# Current value: 37800000 (2026-03-12 Shop proxy deploy).
+SHOP_DEPLOY_BLOCK_CELO=37800000
```

#### c) `apps/web/src/app/api/founder-status/__tests__/route.test.ts` — agregar test cubriendo el fallback path

```ts
it("uses the hardcoded fallback block when SHOP_DEPLOY_BLOCK_CELO is unset", async () => {
  clientMock.getLogs.mockResolvedValueOnce([]);
  await GET(makeRequest(VALID_WALLET));
  // The route must NOT pass "earliest" to getLogs — Forno rejects
  // unbounded ranges. Hardcoded fallback or env override only.
  const call = clientMock.getLogs.mock.calls[0][0];
  expect(call.fromBlock).not.toBe("earliest");
  expect(typeof call.fromBlock).toBe("bigint");
});
```

(Nota: el test corre con `process.env.SHOP_DEPLOY_BLOCK_CELO` undefined por default en vitest; el módulo de route lo lee al cargar. Hay que verificar que el reset del módulo entre tests no rompa esta aserción — si rompe, usar `vi.resetModules()` o `vi.stubEnv`.)

### Por qué este shape y no otro

- **Eliminar el `console.warn`** post-fix: el warning era una señal de bug ahora corregido. Dejarlo confunde futuras lecturas.
- **No paginar `getLogs`** en chunks: sobre-complejidad. El fallback de un bloque concreto (37.8M) es suficiente — Forno acepta ranges hasta 10k bloques pero también acepta queries con `fromBlock` específico sobre rangos más largos si están filtrados por `address` y `topics` (que es nuestro caso).
- **No mover el valor a `celo.json`** todavía: futuro `chore(contracts): add shopDeployBlock to deployments` puede hacerlo cuando se haga el próximo Shop redeploy. Hoy: hardcoded en route + env override.
- **No agregar stale-tolerant cache**: si la query ahora va a tener éxito, el path de fallo se vuelve raro. Reservado para un patch propio si vemos timeouts en producción tras este fix.
- **No tocar el consumer hook** (`use-founder-status.ts`): su tolerancia al 500 ya es correcta — defense in depth.

---

## 4. ¿Requiere env var?

**Sí, pero opcional con el fallback en código.**

- Producción Vercel: recomendado setear `SHOP_DEPLOY_BLOCK_CELO=37800000` para que sea explícito y trackeable.
- Preview Vercel: idem.
- Local (dev): no requerido — el código tiene fallback. Si un dev quiere apuntar a un Shop deploy diferente (fixture, testnet), setea la env localmente.
- Tests vitest: no requerido — el fallback corre por default.

---

## 5. Estrategia segura de fallback

Tres capas, en orden de prioridad:

1. **Env var `SHOP_DEPLOY_BLOCK_CELO`** — explícito, override por entorno.
2. **Constante hardcoded `SHOP_DEPLOY_BLOCK_FALLBACK = 37_800_000n`** — red de seguridad si la env var falta.
3. **`localStorage` del cliente** — suprime flash UX en cold load (ya existe en el hook, intacto).

Eliminado:

- `"earliest"` — nunca más se va a pasar a `getLogs`.

Si el RPC sigue fallando con el block bounded (e.g., Forno outage), la ruta devuelve 500 pero el hook UX no se rompe: muestra el último estado conocido vía localStorage o `false`. Esto era el comportamiento previo y se mantiene.

---

## 6. Tests propuestos

Adicionales sobre los 7 ya existentes:

1. **Fallback path** (descrito en §3.2.c): assert que `fromBlock` es bigint y no `"earliest"`.
2. **Env var override** (opcional): `vi.stubEnv("SHOP_DEPLOY_BLOCK_CELO", "12345")`; assert que `fromBlock === 12345n`. Riesgo: requiere `vi.resetModules()` para re-evaluar la lectura de env del módulo. Si añade complejidad, omitir.

Comando para correr:

```bash
pnpm test founder-status
```

Esperado: 8 tests passing (los 7 actuales + el nuevo de fallback).

---

## 7. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Hardcoded `37_800_000n` envejece si Shop se redeploya | Cierta cuando suceda (no en este sprint) | Override por env var; comment señala dónde actualizar; futuro chore en celo.json |
| Forno rechaza el range bounded de 37.8M → latest (~40k bloques actualmente, crece) | Baja al principio, sube con el tiempo | Si crece a millones, pasar a pagination o usar un RPC con mayor cap. Patch propio cuando ocurra; hoy seguro |
| Cambiar el módulo de side-effect (eliminar el `console.warn`) afecta tests que assert sobre stderr | Baja | Tests actuales no chequean stderr; los nuevos tampoco |
| Env var en Vercel apunta a un bloque incorrecto por typo | Baja, detectable | Fallback en código atrapa typo si parsing falla; aunque BigInt(typo) puede tirar — agregar try/catch alrededor de `BigInt(process.env...)` en patch follow-up si vemos riesgo |
| Tests vitest leen `process.env.SHOP_DEPLOY_BLOCK_CELO` por accidente desde el shell del dev | Baja | `vi.stubEnv` aisla si es necesario; el test del fallback puede ser frágil sin ello |

**Cero riesgo MiniPay** (no toca wallet/auth/chains/network detection).

---

## 8. Decisión

**Patch combinado: operacional (env Vercel) + código (fallback) + docs (.env.template) + test.**

Por orden de aplicación recomendado:

1. **3.2.a** (código fallback) — elimina el path `"earliest"` para siempre; commit `perf(api): hardcode founder-status shop deploy block fallback`.
2. **3.2.b** (`.env.template` doc) — futuro dev sabe del var; mismo commit o follow-up `chore(env): document SHOP_DEPLOY_BLOCK_CELO`.
3. **3.2.c** (test) — locks en el comportamiento; mismo commit que el fallback.
4. **3.1** (Vercel env) — operacional, manual en el dashboard. Hacelo vos. Opcional si confiás en el fallback; recomendado para override visible.

Riesgo end-to-end mínimo, no afecta features productivas, blast radius cero fuera de `/api/founder-status` y su test.

### Si el patch funciona

Cerrar el sprint de follow-ups funcionales (i18n + founder-status). Backlog perf y refactor quedan documentados.

### Si el patch no funciona (timeouts siguen)

Significa que el rango `37.8M → latest` ya es demasiado grande para Forno. Patch siguiente: pagination en chunks de 10k bloques, o switch a un RPC con mayor cap (público Quicknode, Alchemy, etc).

---

## Outcome (post-deploy) — patch parcial, bug funcional NO cerrado

**Fecha promote:** 2026-06-03
**Commit code:** `0bc34d24` (`perf(api): hardcode founder-status shop deploy block fallback`)
**Commit doc:** `6b3715f2` (`docs(audits): record founder-status timeout audit`)
**HEAD `origin/production` final:** `6b3715f2`
**HEAD `origin/main` final:** alineado

### Smoke real-world contra prod

3 requests consecutivos contra `https://www.chesscito.com/api/founder-status` tras el deploy:

| Wallet | Tiempo | Status | Cuerpo |
|---|---|---|---|
| `0x0924d1afc2ecbd5257ee3b1302d978c3ffa7eba4` (provided) | 42.5 s | 500 | `{"error":"Chain read failed"}` |
| `0x0924...eba4` (retry) | 41.8 s | 500 | idem |
| `0x1111111111111111111111111111111111111111` (cold cache distinto) | 41.7 s | 500 | idem |

Consistente, no transient. El fallback `37_800_000n` previene el "earliest disaster" original, pero **Forno también rechaza el range `37.8M → latest`** (~5M bloques al momento del deploy). El riesgo §7 del audit se materializó tal como estaba descripto.

### Lo que cerró este patch

- ✓ `route.ts` no puede enviar `fromBlock: "earliest"` jamás.
- ✓ Parse seguro del env var (typo o invalid input ya no rompe).
- ✓ `console.warn` cold-start removido (signal de bug ya corregido).
- ✓ 3 tests nuevos: fallback unset / fallback invalid / env override — locks contra regresión.
- ✓ Documentación de la env var key en el template.

### Lo que NO cerró

- ✗ El endpoint sigue devolviendo `500 Chain read failed` en producción.
- ✗ Cada cold-cache hit consume ~42 s de Function execution time.
- ✗ UX salvado solo por el `localStorage` cache del hook + tolerancia silenciosa al 500 en `use-founder-status.ts:74-83`. Founders cold-load sin cache local siguen viendo `false`.

### Próxima sesión — Patch 2 (Opción D: RPC configurable + stale-on-error defensivo)

Plan registrado para implementar en cluster propio (NO en este sprint):

1. **Soportar `CELO_RPC_URL` como provider configurable** en `route.ts:71`:
   ```ts
   transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org")
   ```
2. **Setear en Vercel Production + Preview** una URL de RPC con mayor capacidad histórica (dRPC, Alchemy, QuickNode tier free son candidatos válidos para el volumen actual).
3. **Mantener Forno como fallback** (default cuando la env var no está).
4. **Stale-on-error defensivo**: si el `getLogs` falla pese al nuevo RPC, cachear `{ ownsFounder: false, since: null, stale: true }` por TTL corto (e.g. 5 min) para evitar que cada cold-cache hit consuma 40 s. UX trade-off documentado: founders cold-load sin localStorage cache verán `false` durante esos 5 min — aceptable porque `use-founder-status.ts` re-fetcha en el siguiente mount y eventualmente convergirá al estado correcto.
5. **Test de end-to-end**: verificar que la ruta no devuelve 500 lento.

### Por qué NO se implementaron Opción A (pagination) ni Opción C (stale-on-error sola)

- **A (pagination)** genera ~500 requests al RPC público por wallet cold-load. Sobrecarga Forno; rate-limit-fail probable bajo volumen. Sobre-engineering vs Opción B.
- **C (stale-on-error sola)** tapa el síntoma pero deja la causa raíz (Forno over-capacity) intacta. Cada cold-cache hit sigue costando 40 s de Function time hasta que cae el TTL. Solo se justifica COMBINADA con el RPC fix (= Opción D).

### Estado regulatorio del cluster founder-status

**Cerrado parcialmente.** Mitigación del crash mode original aceptada. Bug funcional re-clasificado como follow-up `perf(api): switch founder-status RPC + defensive caching` (Opción D), próxima sesión.

### Riesgo de no implementar Patch 2 ahora

- Endpoint sigue tirando 500 silenciosos en logs server (volumen acotado: 1 callsite, 1-2 hits por sesión PRO/Founder).
- Vercel Function execution time se acumula (~42s × volumen). Para Hobby plan podría chocar con quotas; para Pro el costo es marginal.
- UX intacto por defense in depth del cache cliente.

Aceptable como estado interino hasta Patch 2.
