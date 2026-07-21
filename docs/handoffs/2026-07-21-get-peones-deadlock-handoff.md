# Handoff — Get Peones desbloqueado; el minteo sigue abierto

**Fecha:** 2026-07-21
**Estado:** ✅ Problema A cerrado y desplegado · 🔶 Problema B abierto, esperando un smoke
**Área:** `apps/web` · rail de pagos · `/api/payment-intents/get-peones` · Victory mint
**Diagnóstico completo:** `docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md`

---

## 1. Punto de partida

El founder reportó que en `{preview, learn-preview, play, learn}.chesscito.com` no se podía
**ni comprar peones ni mintear partidas**, y sospechaba que un refactor reciente (theme builder /
PRO) había roto la capa de pagos. Venía de una sesión con Codex que dejó observabilidad
instrumentada (`485f5f7c`) y un smoke pendiente.

**Resultó ser dos problemas independientes, y el refactor no era culpable de ninguno.**

---

## 2. Problema A — Deadlock del 409 ✅ CERRADO

### Causa raíz

`POST /api/payment-intents/get-peones` devolvía **409** y la compra **nunca llegaba a MiniPay**.
La UI traducía ese 409 al genérico *"Something went wrong. Please try again"*, que es lo que hacía
parecer un fallo de wallet.

El lookup de intents sin resolver filtraba por `lifecycle_status` y `retry_safe`, **pero nunca por
`expires_at`**. Sin TTL ni barrido, un intent vencido seguía bloqueando para siempre: **un fallo
transitorio convertía la compra en denegación permanente para esa wallet**.

El fix anti-doble-submit (`81d0e87e`) protegía contra cobrar dos veces, pero al no acotar la
ventana se volvió un candado sin llave.

### Qué se hizo

1. **Desbloqueo manual** (autorizado por el founder): 5 intents vencidos de su wallet pasados a
   `EXPIRED`. Guarda previa verificó `tx_hash = null` en los 5, y on-chain se confirmó que **no
   existe ninguna transferencia al Treasury por 500000** → cero riesgo de doble cobro, no hubo
   primer cobro.
2. **Fix en TDD** (`640c140`). La regla implementada **no** es "filtrar por `expires_at`" a secas:

   > Un intent bloquea solo si sigue sin resolver **y** (tiene `tx_hash` **o** no venció).

   - Vencido **con** hash → **sigue bloqueando** a cualquier edad: puede haber plata on-chain,
     lo resuelve el verifier.
   - Vencido **sin** hash → libera: nunca broadcasteó nada.
   - `expires_at` ilegible → **falla cerrado**: una ventana que no puedo probar cerrada puede
     tener un prompt de wallet abierto.

   Test rojo verificado antes del fix (`expected 409 to be 200`). Hay test para las dos mitades.

### Efecto colateral resuelto solo

Había **2 wallets más** atrapadas por el mismo deadlock, una desde el **1 de julio** (20 días sin
poder comprar, viendo solo *"Something went wrong"*). Con el fix desplegado se liberan **sin tocar
la base** — por eso no se barrieron a mano.

---

## 3. Problema B — Victory mint 🔶 ABIERTO

### Lo que se sabe

```
04:38:52.749  victory_claim_tx  {stage:"start", moves:7, elapsed_ms:8591}
04:38:57.158  victory_claim_tx  {stage:"error", error_kind:"unknown"}
```

- Falla en **4.4 s**, **sin transacción en la cadena**.
- `POST /api/sign-victory` → **200**: la firma server-side está sana.
- `save-score` en el mismo instante → `outcome:"success"`.
- `error_kind:"unknown"` ⇒ no fue cancelación, timeout, fondos, red ni revert conocido.

### Por qué no se pudo cerrar

`useMintVictory` **sí** emitía el mensaje crudo del provider, pero `arena/page.tsx` reenviaba solo
`error_kind` y lo descartaba. Cada fallo real aterrizaba en `analytics_events` como
`error_kind:"unknown"` sin forma de saber **cuál** unknown.

**Arreglado** en `c294c58`, con truncado a 300 chars: `/api/telemetry` descarta el objeto de props
**entero** si pasa 4KB, y un error crudo de viem lo pasa solo — reenviarlo sin cortar habría hecho
perder también `stage`, `moves` y `error_kind`.

### 👉 Próximo paso concreto

1. Con el deploy vivo, **un solo** intento de mintear una partida.
2. Correr `node apps/web/scripts/query-telemetry-readonly.mjs` y leer el campo `error` del evento
   `victory_claim_tx` con `stage:"error"`.
3. Ese mensaje es la causa raíz. **No deducir antes de leerlo** (ver §5).

---

## 4. Hipótesis descartadas con evidencia

| Hipótesis | Por qué cayó |
|---|---|
| El refactor de themes rompió el wallet provider | `wallet-provider.tsx` sí fue tocado, pero solo se agregaron wrappers. `WagmiProvider`, `createConfig`, connector y transports idénticos. |
| `enforceOrigin` reescrito rompió los endpoints | Migrado a `classifyProOriginHost` en `11a16982`; auditado línea por línea, equivalente. Además `/api/sign-victory` da 200. |
| `NEXT_PUBLIC_APP_URL=localhost:3002` filtrado a prod | En Vercel tiene 63 días y valor propio por ambiente; `NEXT_PUBLIC_PREVIEW_URL` no existe allí. Quedó solo en el `.env` local del experimento con ngrok. |
| **Falta de gas / 0 CELO** | **Era mi hipótesis y era falsa.** Ver §5. |
| Payload del transfer / wagmi-viem / saldo | Sin cambios; 526.57 `USD₮` disponibles. |
| `use-mint-victory.ts` lo rompió el refactor | No fue modificado desde el 17 de julio. |

---

## 5. Lección de método (la parte cara de la sesión)

Afirmé como causa raíz que la wallet no podía pagar gas por tener **0 CELO nativo**. Era falso.

Lo que lo desmintió fue **una sola consulta**: el nonce de la wallet estaba en 474 y tras la última
tx conocida quedaba en 470 — **había 4 transacciones saliendo**. Una de ellas, del 21/07 03:28,
salió CIP-64 con `feeCurrency` inyectado por MiniPay y **funcionó**, minutos antes de los fallos.

> **Invariante:** consultar el estado real **antes** de razonar desde una premisa. Deduje
> "0 CELO ⇒ no puede pagar gas" sin verificar si de hecho salían transacciones. El founder
> además ya había dicho que MiniPay permite tx sin gas; su corrección era la correcta.

El diagnóstico erróneo quedó **escrito a propósito** en el audit (§5.1, marcado como RETIRADO) en
vez de borrado.

### Correcciones al reporte de Codex

1. Investigó **solo** Get Peones; el minteo también fallaba y su hipótesis (payload ERC-20) no
   podía explicarlo.
2. Afirmó que el refactor no tocó `wallet-provider.tsx`. Sí lo tocó; lo correcto es que no tocó la
   config de wagmi.
3. Los códigos `MINIPAY_PERMISSION_DENIED_PRE_BROADCAST` y `MINIPAY_PROVIDER_NO_HASH` aparecen en
   filas de la tabla pero **no existen en el código del repo** — probablemente anotación manual.
   **No tratarlos como generados por el sistema sin verificar.**
4. Su observabilidad es correcta y útil; se conservó.

---

## 6. Commits (todos en `origin/main`)

| Commit | Qué |
|---|---|
| `640c140` | fix(payments): el lock del intent expira cuando no hubo broadcast |
| `c294c58` | fix(coach): reenvía el mensaje crudo del provider, truncado |
| `e16673d` | docs(audits): diagnóstico + la teoría del gas retirada |
| `458c1ab` | docs(audits): 4 audits pendientes del 18–19/07 (1.268 líneas) |
| `5dc5fe4` | docs(handoffs): handoff de theme-builder + runtime PRO |
| `c4da237` | docs(specs): spec en pausa del landing section |
| `54a1291` | docs(handoffs): índice generado de los 183 handoffs |

**Verificación:** 16/16 route · 175/175 rail de pagos · 267/267 coach lib · 4/4 telemetría nueva.
`tsc --noEmit` limpio salvo el error **preexistente** en `use-coach-analysis.test.ts:139`
(`walletAddress: string` vs `` `0x${string}` ``), ajeno a esta sesión.

---

## 7. Pendientes

- [ ] **Smoke del minteo** y lectura del `error` crudo (§3). Único bloqueante para cerrar B.
- [ ] Confirmar que las 2 wallets bloqueadas quedaron liberadas tras el deploy
      (`node apps/web/scripts/query-blocked-wallets-readonly.mjs` → debería dar 0).
- [ ] **Borrar los 3 scripts read-only** de `apps/web/scripts/` al cerrar la investigación:
      `query-telemetry-readonly.mjs`, `query-intents-readonly.mjs`,
      `query-blocked-wallets-readonly.mjs`. Leen `.env`, no imprimen credenciales.
- [ ] Defecto secundario ya identificado, sin arreglar: `use-payment-rail.ts:371-392`, la rama
      `intent` manda `feeCurrency` sin el fallback que sí tiene la rama legacy. Asimetría no
      intencional.
- [ ] Arreglar el error de tipos preexistente en `use-coach-analysis.test.ts:139`.

---

## 8. Preguntas abiertas

1. **¿Por qué falla el minteo?** Muere antes del broadcast con un error que ningún clasificador
   reconoce, mientras otras escrituras on-chain de la misma wallet funcionan. Sin el mensaje crudo
   no hay respuesta honesta.
2. **¿Influye correr dentro de "Mini App Test" de MiniPay?** Visible en la barra del screenshot.
   Podría restringir permisos de transacción. **Sin confirmar** — puede ser irrelevante.
3. **¿De dónde salieron los códigos `MINIPAY_*`** que están en la base y no en el código?
4. **¿El deadlock afectó a usuarios reales además del founder?** `0x693e0e…d6d4` estuvo bloqueada
   20 días. Vale revisar si hay que compensar o avisar.
