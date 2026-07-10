# Resultados — probe del raw de MiniPay

**Fecha**: 2026-07-10 · **Ejecutado en device**
**Dispositivo**: iPhone, iOS 18.7, WebKit 605.1.15 · `isMiniPay: true`
**Entorno**: `learn-preview.chesscito.com` · Celo Mainnet (42220)
**Wallet**: `0xCc4179…c2dD` · **Veredicto: GO, con una condición**

---

## Tabla comparativa

| # | Escenario | `txHash` | `receipt.status` | Error top | `error.data` / `.raw` / `.signature` | Revert data |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cancelación | `null` | — | `ContractFunctionExecutionError` | los tres `null` | ninguna |
| 2 | Fallo pre-broadcast | `null` | — | `Error` (`Invalid player address`) | los tres `null` | ninguna |
| 3 | **Revert** | **`null`** | — | `ContractFunctionExecutionError` | **los tres `null`** | **`0xfafe79…` en `message`** |
| 4 | Éxito (control) | `0x5527eb32…5092` | `success` | — | — | — |

---

## Los tres hechos

### 1. MiniPay rechaza en estimación. Nunca transmite una tx que revierte.

En el escenario 3 la hoja de confirmación **no apareció**, no hubo hash y no se
gastó gas. El mensaje lo dice literal:

```
Remote method 'eth_estimateGas' failed with an error:
{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted","data":"0xfafe79…"}}
```

Esto es una **buena noticia** y responde una pregunta abierta desde
`receipt-status-verification`: en MiniPay, un revert es interceptado antes de
firmar. El chequeo de `receipt.status` que shipeamos en #199/#200 sigue siendo
correcto (protege contra otras wallets y contra reverts que sí se minan), pero
**no es el camino que MiniPay recorre**.

### 2. La revert data existe, pero viem no la ve.

`ContractFunctionRevertedError` trae las keys `data`, `raw` y `signature` —
**las tres nulas**. viem interpretó el blob JSON-RPC completo como el *reason*
textual del revert, no como revert data estructurada.

El único portador es el string de `message`.

Por eso `findRevertData()` devolvía `null` en la primera captura: buscaba en
`error.data`. La corrección está en este mismo commit: se extrae del mensaje
**antes** de redactar, con `extractRevertDataFromMessage()`.

### 3. El selector es `0xfafe7970` = `BadgeAlreadyClaimed(address,uint256)`.

La captura mostró `0xfafe79…[redacted 138 chars]` — mi propio redactor cortó el
selector a 3 bytes de 4. Ya está arreglado (preserva 4 bytes).

La identificación es concluyente aun con la captura truncada:

- prefijo `0xfafe79` coincide con `0xfafe7970`, derivado de artifacts;
- 138 chars = `0x` + 136 hex = **68 bytes** = 4 de selector + 2 args de 32 bytes,
  exactamente la aridad de `BadgeAlreadyClaimed(address player, uint256 levelId)`;
- la llamada fue `claimBadgeSigned` sobre un badge que la wallet ya posee.

---

## Conclusión

**Sí existe revert data decodificable.** Llega íntegra al dapp, embebida como
texto dentro de `message`, no en los campos estructurados de viem.

## Recomendación: **GO**, con un cambio de diseño

El plan original (una ABI generada + `decodeErrorResult` sobre `error.data`)
**no habría funcionado**: `error.data` es `null`. El decoder necesita dos piezas:

1. **Un extractor**: regex sobre la cadena de `message`, ya escrito y con tests
   (`extractRevertDataFromMessage`). Devuelve `0xfafe7970…`.
2. **Un decodificador**: `decodeErrorResult` contra la ABI de errores generada
   desde artifacts. Esa parte del plan original sigue en pie.

Costo estimado: se mantiene en 1-2h. El extractor ya existe.

---

## Riesgos e incertidumbres

1. 🔴 **El formato del mensaje no es una API.** Es el error del provider,
   stringificado. Una actualización de MiniPay puede cambiarlo y el extractor
   deja de matchear **en silencio**. Mitigación: el fallback debe ser el
   `revert` genérico actual, nunca una excepción; y el extractor necesita un
   test con el fixture real (ya está).
2. 🟠 **Un solo dispositivo, un solo OS.** iPhone / iOS 18.7. Android puede
   serializar distinto. Sin evidencia.
3. 🟠 **Una cancelación llega como `ContractFunctionRevertedError`** con
   `reason: "User rejected transaction"`. Un decoder ingenuo que trate esa clase
   como "revert on-chain" reportaría cancelaciones como fallos. Nuestro
   clasificador está a salvo porque `isUserCancellation` corre sobre el mensaje y
   nuestro tipo `TransactionRevertedError` es propio, no el de viem. **No perder
   esa distinción al agregar el decoder.**
4. 🟡 Solo se observó `BadgeAlreadyClaimed`. `CooldownActive` y
   `DailyLimitReached` se asumen iguales por venir del mismo camino de
   estimación, pero no se midieron.

---

## Diferidos (no bloquean, registrados)

- `Invalid player address` (escenario 2) clasifica hoy como `unknown` →
  *"Something went wrong"*. Es un fallo del endpoint de firma y debería ser
  `signingUnavailable`. `classifyTxErrorKind` no lo matchea.
- El probe (`app/dev/tx-error-probe/`, `lib/debug/`) queda en el repo hasta que
  el decoder esté shipeado; sirve para validar el extractor contra otro device.
