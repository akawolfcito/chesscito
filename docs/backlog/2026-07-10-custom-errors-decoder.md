# Siguiente mejora priorizada — decoder de custom errors

**Fecha**: 2026-07-10 · **Estado**: GO aceptado, **no implementar todavía**
**Evidencia**: `docs/testing/2026-07-10-minipay-raw-error-probe-results.md`

## Por qué no bloquea estabilidad

Los reverts ya se interceptan (MiniPay rechaza en `eth_estimateGas`), no producen
éxito falso (#199 / #200), y existe fallback genérico (`error.revert`). El
decoder mejora la **copy**, no la corrección.

## Qué hay que construir

1. ✅ **Extractor** — `extractRevertDataFromMessage()`, ya escrito y con el
   mensaje real del device como fixture (`lib/debug/serialize-tx-error.ts`).
2. ⬜ **Generador de error-ABIs** desde `apps/contracts/artifacts/**`, hermano de
   `generate-event-abis.mjs`. Nunca a mano ([[feedback_verifier_abi_lesson]]).
3. ⬜ **Mapa** selector/nombre → `TxErrorKind` → copy, con claves nuevas en
   `editorial.ts` + `messages/es.ts` (`en.ts` es derivado).

## Riesgos, todos registrados

1. 🔴 **La extracción desde `message` no es contractual.** Es el error del
   provider, stringificado. Una actualización de MiniPay cambia el formato y el
   extractor deja de matchear **en silencio**.
   → El fallback debe ser el `revert` genérico actual. **Nunca una excepción.**
2. 🟠 **Diferencias entre dispositivos y providers.** La única captura es
   iPhone / iOS 18.7 / MiniPay. Android, y cualquier wallet web, pueden
   serializar distinto — o entregar `error.data` estructurado, que el decoder
   también debe aceptar.
3. 🟠 **Una cancelación llega como `ContractFunctionRevertedError`** de viem, con
   `reason: "User rejected transaction"`. Un decoder que trate esa clase como
   revert on-chain convertiría cancelaciones en fallos.
   → `isUserCancellation` debe seguir corriendo antes. Nuestro
   `TransactionRevertedError` es propio, no el de viem: no confundirlos.
4. 🟡 **Solo hay evidencia real de `BadgeAlreadyClaimed`** (`0xfafe7970`).
   `CooldownActive` (`0xc1ab61a1`) y `DailyLimitReached` (`0xeba8fe8a`) se
   asumen iguales por venir del mismo camino de estimación. Sin medir.

## Costo

1-2h. El extractor ya está hecho.
