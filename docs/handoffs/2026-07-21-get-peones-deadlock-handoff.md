# Handoff — El 409 era real; el "Permission denied" era el dominio

**Fecha:** 2026-07-21
**Estado:** ✅ Bug real arreglado y desplegado · ✅ Falso bug explicado · 🔶 Falta una confirmación de MiniPay
**Área:** `apps/web` · rail de pagos · `/api/payment-intents/get-peones` · Victory mint · MiniPay
**Diagnóstico:** `docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md`
**Reporte MiniPay:** `docs/audits/2026-07-21-minipay-send-transaction-permission-denied-report.md`

---

## 1. Qué pasó, en una línea

Había **dos problemas superpuestos**: un deadlock real en la creación de intents, y un
`Permission denied` de MiniPay que **no era un bug nuestro** sino consecuencia de que
`chesscito.com` quedó reclamado como Mini App mientras lo testeábamos por *Load Test Page*.

---

## 2. Problema A — Deadlock del 409 ✅ RESUELTO

### Causa

La creación de intents bloqueaba por **lifecycle** sin mirar **`expires_at`**. Un fallo
transitorio dejaba un intent en `SUBMITTING` y esa wallet **no podía volver a comprar nunca**.
La UI lo mostraba como *"Something went wrong"*, indistinguible de un error de wallet.

El candado tenía **tres puertas**, y sólo cerrar una no servía de nada:

1. El lookup previo en la ruta.
2. La fila que el RPC devuelve por idempotencia.
3. **`create_get_peones_intent` en Postgres**, que seleccionaba cualquier fila
   `CREATED/SUBMITTING/SUBMITTED` sin cota de tiempo — la causa de fondo.

### La regla, ahora compartida

> Un intent bloquea sólo si sigue sin resolver **y** (tiene `tx_hash` **o** no venció).

- Vencido **con** hash → bloquea a cualquier edad: puede haber plata on-chain, lo resuelve el verifier.
- Vencido **sin** hash → libera: nunca broadcasteó nada.
- `expires_at` ilegible → **falla cerrado**.

Vive en `blocksNewIntent()` y la replica la migración, con comentarios que dicen explícitamente
que no pueden divergir.

### Impacto real

**Tres wallets** estaban bloqueadas, una desde el **1 de julio** — 20 días sin poder comprar,
viendo sólo *"Something went wrong"*. Tras la migración: **0 bloqueadas**.

---

## 3. Problema B — `Permission denied` ✅ EXPLICADO, no era bug

`eth_sendTransaction` devolvía `-32604 Permission denied` mientras **todo lo demás funcionaba**:
`eth_call`, `eth_estimateGas`, `eth_gasPrice` con feeCurrency, `eth_signTypedData_v4` y
`eth_requestAccounts`. Una denegación quirúrgica de un solo método.

### La prueba que lo partió al medio

**Mismo build, distinto dominio** (la hizo el founder):

| Host | Build | Resultado |
|---|---|---|
| `chesscito-…-goodwolf.vercel.app` | actual | ✅ compra y minteo funcionan |
| `preview` / `play` / `learn`.chesscito.com | actual | ❌ `-32604` |

Headers HTTP **byte-idénticos** entre esos hosts. Nada que servimos varía por hostname.

### Por qué

`chesscito.com` estaba **en revisión de Mini App el 17 de julio** — el mismo día de la última
transacción exitosa (06:21:16 UTC) — y el 21/07 MiniPay confirmó que la listaría ese día.
El dominio quedó **reclamado**: abrirlo por *Load Test Page* es lo que hace que MiniPay
rechace el envío. Un origen sin reclamar (`vercel.app`) envía sin problema.

**Los usuarios reales nunca estuvieron afectados.** Entran desde el listado, donde el permiso
está concedido. Lo que estaba roto era el **método de prueba**.

---

## 4. Lo que sí quedó arreglado además

**Observabilidad del claim.** `useMintVictory` emitía el error crudo pero `arena/page.tsx` lo
descartaba, así que todo fallo llegaba a `analytics_events` como `error_kind:"unknown"`. Al
reenviarlo lo trunqué a 300 chars **por la cabeza** — y viem pone los argumentos del request
primero y el mensaje del provider al final, así que capturé 300 caracteres de relleno.
`describeClaimError` ahora lee `shortMessage` y `details`, que es lo que viem ya parseó.

Sin esos dos arreglos nunca habríamos visto `Permission denied` ni el `-32604`.

---

## 5. Commits (todos en `origin/main`)

| Commit | Qué |
|---|---|
| `640c140` | El lock del intent expira cuando no hubo broadcast (puerta 1) |
| `c294c58` | Reenvía el mensaje crudo del provider |
| `0e96fcf` | Reporta el detalle del provider, no el volcado de argumentos |
| `9396461` | Regla compartida + migración (puertas 2 y 3) |
| `0f878b9` | Migración fuera del timestamp colisionado |
| `47ca328` · `dab8db8` · `1b4b0b5` | Sonda de envío crudo, botón de copiar, permisos EIP-2255 |
| `e16673d` · `fd544ca` · `193b68e` · `90c65e6` · `49f62fd` | Audits y reporte |
| `458c1ab` · `5dc5fe4` · `c4da237` · `54a1291` | Docs pendientes + índice de handoffs |

**Verificación:** 178/178 rail de pagos · 272/272 coach lib · `tsc --noEmit` limpio salvo el
error **preexistente** en `use-coach-analysis.test.ts:139`.

**Migración aplicada** a Supabase producción con aprobación explícita. Verificado después:
0 wallets bloqueadas.

---

## 6. Pendientes

> **Próxima sesión:** errores en el CI/CD de GitHub.

- [x] **Avisado a MiniPay** — mensaje enviado a Vinay antes del listing, con el código `-32604`,
      la asimetría (todo funciona menos enviar) y los dos hashes como control positivo.
      Falta su respuesta sobre si *Load Test Page* rechaza envíos en un dominio ya reclamado y
      cuál es la forma soportada de testear el dominio oficial.
- [ ] **Probar desde el listado** cuando publiquen la app.
- [ ] **Testear siempre en la URL `*.vercel.app`** del deploy, no en `chesscito.com`.
- [x] **Auditoría del desbloqueo** — registrada. Los 5 intents que expiré con un `PATCH` directo
      quedaron en `treasury_payment_intent_resolutions` (#7–#11) como
      `RETROACTIVE_DIRECT_PATCH_UNBLOCK`, con actor y evidencia. El RPC
      `resolve_get_peones_legacy_intent` **no servía**: exige `CREATED`/`SUBMITTING` y las filas
      ya estaban `EXPIRED` — registra transiciones, no las rellena hacia atrás. Por eso la
      inserción es directa y el código lo dice, para que el rastro no finja un proceso que no
      ocurrió.
- [ ] Defecto secundario sin arreglar: `use-payment-rail.ts:371-392`, la rama `intent` manda
      `feeCurrency` sin el fallback que sí tiene la legacy.
- [ ] El permit cae al approve **en silencio** (`use-mint-victory.ts:503-509`): el `catch`
      descarta el error sin log. Las `permitVersion` están **correctas** (verificado contra el
      `DOMAIN_SEPARATOR` on-chain), así que la causa del fallback sigue sin conocerse.
- [ ] Arreglar el error de tipos preexistente en `use-coach-analysis.test.ts:139`.

---

## 6b. ¿Puede volver a pasar? — runbook

**Estado al cierre (verificado):** `STILL BLOCKING: 0 (0 wallets)`.

| Caso | ¿Se auto-resuelve? | Qué hacer |
|---|---|---|
| Intent vencido **sin** `tx_hash` | ✅ **Sí.** El barrido de `create_get_peones_intent` lo pasa a `EXPIRED` en la siguiente creación y la ruta no lo mira. | Nada. |
| Intent con `tx_hash` en `SUBMITTING`/`SUBMITTED` | ❌ **No, y es deliberado.** Puede haber una transferencia real en la cadena. | Revisión humana → `resolve_get_peones_legacy_intent`. |

**No escribir un script genérico de desbloqueo.** El RPC ya es la herramienta correcta: valida
que no haya hash ni consumo asociado y deja el rastro en `treasury_payment_intent_resolutions`.
Un script que saltee eso repite el `PATCH` directo que hubo que auditar a posteriori (§6).

**Para monitorear:** `node apps/web/scripts/query-blocked-wallets-readonly.mjs` — implementa la
regla desplegada y responde quién está bloqueado. Correrlo si alguien reporta
*"Something went wrong"* al comprar.

---

## 7. Herramientas que quedaron (útiles, no borrar sin pensar)

| Script | Para qué |
|---|---|
| `apps/web/scripts/query-blocked-wallets-readonly.mjs` | **El más valioso.** Implementa la regla desplegada y dice quién está bloqueado. Operacional. |
| `apps/web/scripts/query-intents-readonly.mjs` | Estado de los últimos intents. |
| `apps/web/scripts/query-telemetry-readonly.mjs` | Lee `analytics_events` — así capturamos el error del minteo. |
| `apps/web/scripts/verify-permit-domain-readonly.mjs` | Valida `permitVersion` contra el `DOMAIN_SEPARATOR` on-chain. Si un token se actualiza, el permit rompe en silencio. |
| `apps/web/src/app/dev/minipay-raw-send/` | Sonda de envío crudo. Fue lo que aisló el problema. |

Todos leen `.env` y **no imprimen credenciales**.

---

## 8. La lección de método (la parte cara)

**Siete hipótesis mías murieron**: gas/0 CELO, refactor de themes, `enforceOrigin`, toggle de
testnet, dominio (mal testeado la primera vez), payload de viem, EIP-2255. Tres las tumbó el
founder con datos o pruebas que yo no había hecho.

Dos errores propios que costaron ciclos enteros:

1. Declaré causa raíz "0 CELO ⇒ no puede pagar gas" **sin consultar si salían transacciones**.
   El nonce (474 vs 470) lo desmintió en una consulta. Ver
   [[feedback_check_if_it_is_happening_before_explaining_why_it_cant]].
2. Rompí mi propia sonda con `Number()` sobre un objeto y **le afirmé al founder que su env var
   no llegaba**. Sí llegaba.

Y el error estructural, que es el que importa:

> **La sonda cruda probó que ningún código nuestro podía cambiar el resultado. Yo leí eso como
> "la causa está fuera de nuestro control". No es lo mismo.** El *origen* también es nuestro
> —qué URL servimos y testeamos— y variarlo era gratis: cada deployment de Vercel tiene su
> `*.vercel.app`. Fijé el dominio y varié el código durante horas, cuando la prueba barata era
> al revés.

**Cuando el fallo es ambiental, enumerar los ejes del ambiente** —build, origen, wallet, red,
cuenta— **y mover uno solo a la vez.** La asimetría ya lo gritaba: `eth_call` OK y
`eth_sendTransaction` denegado es la firma de una **política**, no de un defecto técnico. Un
payload malformado falla en la validación; una política deniega sólo la acción privilegiada.
