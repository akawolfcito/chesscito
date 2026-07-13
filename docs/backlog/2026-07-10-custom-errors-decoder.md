# Decoder de custom errors — ✅ HECHO (2026-07-13)

**Estado**: implementado y mergeado. **Evidencia original**:
`docs/testing/2026-07-10-minipay-raw-error-probe-results.md`

## Qué se construyó

1. ✅ **Extractor** — `extractRevertDataFromMessage()` + `findRevertDataInError()`.
   **Promovido** de `lib/debug/serialize-tx-error.ts` (que muere con el probe) a
   `lib/contracts/revert-data.ts`. Una sola copia de la regex en el repo.
2. ✅ **Generador** — `apps/contracts/scripts/generate-error-abis.mjs`, hermano de
   `generate-event-abis.mjs`. 53 errores de los 4 contratos que el jugador toca →
   `lib/contracts/generated/contract-errors.ts`. `pnpm --filter hardhat generate:error-abis`,
   y corre solo dentro de `build`.
3. ✅ **Mapa** nombre → `TxErrorKind` → copy, en `lib/errors.ts` (`CUSTOM_ERROR_KINDS`).

**5 de los 53 errores tienen copy propia.** El resto son fallas de operador o de
configuración (`ItemDisabled`, `InvalidSigner`, `LengthMismatch`) con las que el jugador
no puede hacer nada: se decodifican y caen igual al `revert` genérico. Un error entra al
mapa solo si saber su nombre **cambia lo que el jugador haría después**.

| Custom error | `TxErrorKind` |
| --- | --- |
| `BadgeAlreadyClaimed` | `badgeAlreadyClaimed` (ya existía) |
| `CooldownActive` (Scoreboard) | `cooldownActive` **(nuevo)** |
| `MintCooldown` (VictoryNFT) | `cooldownActive` — dos nombres, una experiencia |
| `DailyLimitReached` | `dailyLimitReached` **(nuevo)** |
| `SignatureExpired` | `signatureExpired` (la copy existía; ahora es un kind) |

## Cómo se atendió cada riesgo

1. 🔴 **La extracción desde `message` no es contractual.** Cada paso degrada a `null`, y
   `null` significa "seguí como antes": selector desconocido, data truncada, o un MiniPay
   que cambia el formato → el jugador cae en la copy de `revert` que ya veía. Hay test.
   **El decoder puede mejorar un mensaje; nunca puede ser la razón de que algo se rompa.**
2. 🟠 **Otros dispositivos / providers.** `findRevertDataInError()` acepta también las formas
   estructuradas (`.data`, `.data.data` anidado, el `.signature` de 4 bytes de viem) y camina
   la cadena de `cause`. Sin evidencia de campo todavía — es seguro barato.
3. 🟠 **La cancelación llega con forma de revert.** `isUserCancellation` e `isTransactionTimeout`
   se resuelven **antes** de que el decoder tenga voto. Son hechos sobre la **wallet**; la revert
   data es un hecho sobre la **cadena**, y la cadena solo habla si el jugador la dejó hablar.
   Hay un test que lo fija con una cancelación que además trae revert data.
4. 🟡 **Solo `BadgeAlreadyClaimed` tiene evidencia real de device.** Sigue siendo cierto:
   `CooldownActive` y `DailyLimitReached` se asumen por venir del mismo camino de estimación.
   **Por eso el probe `/dev/tx-error-probe` se queda** — es el instrumento para medirlos.

## La trampa que casi tira la evidencia a la basura

Los tres selectores registrados en los docs (`0xfafe7970` / `0xc1ab61a1` / `0xeba8fe8a`)
**son correctos**. Durante esta sesión los "refuté" con esto:

```ts
toFunctionSelector("error BadgeAlreadyClaimed(address,uint256)")  // 0xa02cd012 ❌
```

**viem hashea el string que le das, literal** — con la palabra `error` adentro. Solidity
hashea la firma pelada. Lo correcto:

```ts
toFunctionSelector("BadgeAlreadyClaimed(address,uint256)")        // 0xfafe7970 ✅
```

Llegué a acusar al probe de haber "confirmado un número inventado". Lo que salvó la
situación fue el test: le pedí a `decodeErrorResult` que decodificara y viem contradijo mi
aritmética. **Cuando un valor calculado contradice una medición registrada, sospechá primero
de tu derivación.** Los selectores no se escriben a mano en ningún lado del código nuevo:
se derivan de la firma, incluso en los tests.

## Sigue abierto (no bloquea)

- `Invalid player address` (escenario 2 del probe) clasifica como `unknown` → *"Something went
  wrong"*. Es una falla del endpoint de firma y debería ser `signingUnavailable`.
- Los args del error (`nextAllowedAt`, `nextWindowStart`) **se decodifican pero no se muestran**.
  La copy es estática a propósito: mostrar "esperá hasta las 14:32" es zona horaria, formato y
  probablemente una cuenta regresiva viva. `decodeErrorResult` ya devuelve los args, así que
  hacerlo después no cuesta más que hacerlo ahora.
