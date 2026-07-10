# Handoff — receipt-status + MiniPay probe (2026-07-10)

**`main` = `339e0383`** · Suite **4848 passing / 401 test files** · `tsc` y `lint` limpios
· VR **52 passed** · E2E minipay **130 passed / 0 failed**
**9 PRs**: #196 → #204. Modo: cierre y estabilización.

---

## Qué se cerró

### 1. Un rojo de VR que no era de VR (#196)

El baseline `hub-shop-sheet-open` estaba rojo. El triage lo atribuía a 3 SKUs
retirados. **Eran dos fallos apilados.** El test moría antes del screenshot, en la
aserción de precio, con todas las píldoras en "Coming soon".

Causa: un `NEXT_PUBLIC_CHAIN_ID=11142220` **exportado en el shell**, que gana sobre
`.env.local` en Next. `getShopAddress()` devolvía `null`, la query quedaba
`enabled: false`, y no salía un solo request RPC.

Refrescar el baseline con ese env habría **congelado "Coming soon" en el PNG**.

### 2. El `"400"` que no era un status code (#197)

`classifyTxErrorKind` chequeaba el substring `"400"` para detectar un 4xx de
`/api/sign-*`, **antes** de la rama de revert. viem imprime los args de la llamada
en el mensaje. Un revert con `score = 2400` salía como *"Signing service
unavailable. Try again in a moment."* — el "Try again" que reportaba el smoke.

Esa rama **nunca sirvió para lo que fue escrita**: `requestSignature` lanza el
string `error` del servidor, no el status.

### 3. El bug de fondo: éxito declarado sobre el hash (#199, #200)

`viem@2.46.3`'s `waitForTransactionReceipt` **resuelve con el receipt y nunca mira
`status`**. Por lo tanto `useWaitForTransactionReceipt().isSuccess` significa "la
query resolvió", no "la tx tuvo éxito".

- Un claim de badge revertido mostraba la celebración y seteaba `justClaimed`.
- Un save de score revertido **persistía en localStorage y escribía en el
  leaderboard de Supabase**.

Ahora `waitForReceiptWithTimeout` es fail-closed, y los handlers de LEARN liquidan
sobre un receipt verificado vía `useOnChainWrite`.

`TransactionRevertedError` (la cadena dio veredicto) es un **tipo distinto** de
`TransactionReceiptUnverifiableError` (no hubo veredicto). Colapsarlos haría que la
telemetría dijera "la cadena rechazó esto" cuando la verdad es "no pude leerlo".

### 4. El probe de MiniPay (#201, #202)

Ejecutado en device: iPhone / iOS 18.7 / mainnet / `learn-preview`.

**MiniPay rechaza una tx que revierte en `eth_estimateGas`.** No abre la hoja de
confirmación, no devuelve hash, no gasta gas.

La revert data **sí llega**, pero dentro de `message` como blob JSON-RPC.
`error.data`, `.raw` y `.signature` vienen **los tres null**: viem leyó el blob como
el *reason* textual. `0xfafe7970` = `BadgeAlreadyClaimed`.

Mis dos defectos en el probe tapaban la respuesta: `findRevertData` buscaba en
`error.data`, y el redactor cortaba el selector a 3 bytes de 4. Ambos corregidos.

**Veredicto: GO** para el decoder, con un cambio de diseño — hace falta un extractor
delante de `decodeErrorResult`, porque `error.data` es `null`.

### 5. El único bloqueante del smoke (#204)

`STEP 2 of 2 — Confirming…` quedaba pegado arriba del dock tras un save exitoso.

`deriveTxToastState` devolvía `wait` para cualquier `txHash` no vacío, y el hash
sobrevive a `settled`. Al expirar el done-hold de 1500 ms, caía de vuelta en `wait`.
Para siempre.

**Las dos suites aisladas estaban verdes.** Ninguna manejaba el hook y la derivación
juntos, que es donde vivía el bug. `tx-toast-lifecycle.test.tsx` ahora los compone.

---

## Próximos pasos

1. **▶️ Smoke del flujo crítico en MiniPay** — bloque activo, requiere device.
   Matriz: `docs/testing/2026-07-10-minipay-critical-flow-smoke.md`.
   El paso que importa: **cerrar el overlay de éxito y esperar 2 s**. El toast está
   suprimido mientras el overlay está montado, por eso el label pegado solo se ve
   después de cerrarlo, y por eso ningún test lo vio.
2. **Checkpoint de estabilidad** — solo con la matriz llena.
3. **Decoder de custom errors** — `docs/backlog/2026-07-10-custom-errors-decoder.md`.
   GO con evidencia. **No bloquea estabilidad**: los reverts ya se interceptan, no
   producen éxito falso, y hay fallback genérico. Mejora la copy, no la corrección.

---

## Riesgos diferidos (registrados, no abiertos)

| Riesgo | Nota |
| --- | --- |
| Extracción de revert data desde `message` | No es contractual. Una actualización de MiniPay la rompe **en silencio**. El fallback debe ser `revert`, nunca una excepción. |
| Una sola captura de device | iPhone / iOS 18.7. Android sin evidencia. |
| Cancelación llega como `ContractFunctionRevertedError` de viem | Un decoder ingenuo la reportaría como fallo on-chain. |
| `confirming` puede durar hasta 120 s | El WebView puede pausar timers en background. Umbral de UI diferido. |
| Divergencia asimétrica al cerrar en `confirming` | El badge se auto-cura leyendo la cadena; el score no. |
| `/api/cache-score` fire-and-forget con `.catch(() => {})` | Corre después del receipt: un fallo = score real ausente del leaderboard. |
| `Invalid player address` → `unknown` | Debería ser `signingUnavailable`. |
| Telemetría | `stage:"success"` pasó de "broadcast aceptado" a "minada exitosamente". Las tasas caen por definición, no por regresión. |

---

## Lo que esta sesión enseñó

- **El entorno miente antes que el código.** Dos veces: el `NEXT_PUBLIC_CHAIN_ID` del
  shell, y un dev server viejo en el puerto 3000 que produjo **45 fallos fantasma**
  en E2E. Ante un rojo masivo, sospechar del entorno primero.
- **Dos suites aisladas verdes no prueban su composición.** Tercer y cuarto caso del
  mismo patrón en esta sesión.
- **Si sabés qué es el error, no le preguntes al texto.** Los errores tipados se
  clasifican antes que cualquier heurística de string, incluida la de cancelación.
- **Un fallo puede esconder otro.** Leer el mensaje real antes de creerle al handoff
  sobre la causa.
- **Un instrumento puede tapar lo que vino a medir.** El redactor del probe censuró
  el selector, y el detector buscaba en el campo equivocado.

## Preguntas abiertas

1. ¿El toast `failed` debe seguir siendo sticky, o desaparecer como los demás?
2. ¿Se reconcilia el score al montar (leyendo el Scoreboard), o se acepta la
   divergencia y se confía en el cron?
3. `CooldownActive` y `DailyLimitReached` se asumen iguales a `BadgeAlreadyClaimed`.
   Nadie los midió.
