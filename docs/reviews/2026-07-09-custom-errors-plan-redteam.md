# Red-team del plan "decodificar custom errors" — 2026-07-09

Auditado contra el código y contra Celo Mainnet, no contra el backlog.
**Veredicto: el plan resuelve un problema real, pero no el que produce el síntoma
reportado, y su valor depende de un supuesto que nadie verificó.**

---

## F1 🔴 El síntoma "Try again" no lo causa la falta de decodificación

`classifyTxErrorKind` (`lib/errors.ts:57`) evalúa la rama `signingUnavailable`
**antes** que la rama `revert`, y esa rama incluye:

```ts
lower.includes("400")
```

`"400"` es un substring, no un status code. El mensaje de viem para un revert
incluye los args de la llamada. Probado contra el Scoreboard de mainnet
(`0x1681aAA1…`), con `score = 2400`:

```
The contract function "submitScoreSigned" reverted with the following signature:
0xcd21db4f
  args: (1, 2400, 18000, 7, 1783000000, 0x1111…)
```

Branches evaluadas sobre ese mensaje real:

| rama | resultado |
| --- | --- |
| insufficientFunds | false |
| network | false |
| badgeAlreadyClaimed | false |
| **signingUnavailable** (`includes("400")`) | **true** ← gana |
| revert | true (nunca se alcanza) |

Copy resultante: **"Signing service unavailable. Try again in a moment."**
Ese es el "Try again" del smoke. No es un revert genérico: es una
**misclasificación**.

Cualquier `score`, `timeMs`, `deadline`, `nonce`, `txHash` o dirección que
contenga la subcadena `400` cae acá. Un deadline unix de 10 dígitos la contiene
con frecuencia alta. La clasificación es efectivamente aleatoria.

`isUserCancellation` tiene la misma clase de defecto: `lower.includes("cancelled")`
matchea cualquier mensaje que mencione la palabra.

**Implicación:** se puede arreglar el síntoma **hoy**, sin generador, sin ABIs y
sin decodificar nada. Es un cambio de una línea con test. El plan lo daba por
sentado y lo enterraba bajo 1-2h de infra.

---

## F2 🔴 Ni el claim de badge ni el save de score esperan el receipt

`exercises-screen.tsx:1581` y `:1840` llaman `writeContractAsync` y declaran
éxito **sobre el hash**, no sobre el receipt:

```ts
const txHash = await writeWithOptionalFeeCurrency(writeBadgeAsync, {...});
track("badge_claim_tx", { stage: "success", ... });
setResultOverlay({ variant: "badge", txHash });
```

Nadie chequea `receipt.status` en ninguna superficie de jugador (los únicos
`status !== "success"` viven en rutas de API y en `dev/`).

Dos consecuencias:

1. **Bug independiente, más grave que el que vinimos a arreglar:** si la tx se
   mina y revierte, el jugador ve la celebración del badge y `justClaimed` queda
   en `true`. El error nunca se muestra porque nunca se lanza.
2. Los custom errors **solo** pueden llegar si la wallet rechaza en estimación,
   antes de firmar. Es decir: el camino que el plan quiere decorar es el único
   camino donde el plan sirve, y no es el único camino que falla.

---

## F3 🟠 Nadie verificó que MiniPay devuelva la revert data

Todo el plan asume que el error que llega al `catch` contiene
`ContractFunctionRevertedError` con `raw`. Eso está **probado con
`publicClient.simulateContract`** (probe local, Forno), no con la wallet.

La app no simula: `writeContract` va directo a `eth_sendTransaction` del
provider inyectado. Si MiniPay estima internamente y devuelve un `Error` con
texto plano, `raw` es `undefined` y **el decoder muere silenciosamente**,
cayendo al mismo fallback de strings.

**No se puede resolver desde este repo.** Necesita un probe en device: un
`console.warn` del `raw` en el catch, corrido contra preview.
Construir el generador antes de responder esto es apostar 1-2h a una moneda.

---

## F4 🟠 `BadgeAlreadyClaimed` probablemente no es alcanzable

Es el primero de la lista del backlog, pero la UI ya gatea el claim con la
lectura `hasClaimed`, y los badges son one-per-(piece, wallet). Para llegar al
revert hace falta una carrera (dos taps, dos tabs, o un estado stale).
Antes de gastar copy en él conviene confirmar que alguna vez dispara.

Costo de equivocarse: bajo. Pero encabeza la lista y no debería.

---

## F5 🟡 Mi propia afirmación sobre `signatureExpired` era falsa

Dije que la copy existía pero era inalcanzable por no tener `TxErrorKind`.
Es alcanzable: `use-mint-victory.ts:711` la usa vía `/expired/i.test(raw)`.

Lo cierto es **peor y más sutil**: ese regex está muerto para el caso on-chain.
Con la ABI actual (sin errors) el mensaje de viem contiene el selector
`0xcd21db4f`, nunca la palabra "expired" — lo verifiqué arriba. Así que ese
branch solo matchea texto de respuestas 4xx del servidor. La copy existe, el
camino existe, y aun así el `SignatureExpired` on-chain no la alcanza.

---

## F6 🟡 El plan proponía editar `messages/en.ts` a mano

`messages/en.ts` es **derivado** de `editorial.ts` (`import * as editorial`), y
su header lo prohíbe explícitamente. La paridad i18n acá es
`editorial.ts` + `messages/es.ts`. El plan citaba la regla de memoria correcta y
la aplicaba mal a este repo.

---

## F7 🟡 Decodificar contra una ABI unión puede misatribuir el error

Un selector de 4 bytes es un espacio chico. Un revert de un ERC20 (`approve`),
de un proxy, o de cualquier contrato ajeno puede decodificar por coincidencia
como un error de Chesscito y mostrar copy falsa con confianza total.

Mitigación: decodificar **con la ABI del contrato que se llamó**, no con la
unión, o exigir que el nombre esté en un allowlist explícito y que los args
decodifiquen con la aridad esperada.

Aparte: existen `Shop.sol` **y** `ShopUpgradeable.sol` en artifacts. El
desplegado es `ShopUpgradeable`. Un generador que barra el directorio los toma
a los dos.

---

## F8 🟡 La estrategia de test repetía el pecado de la casa

Proponía construir `new ContractFunctionRevertedError({ abi, data })` a mano.
Eso afirma **la forma que yo creo** que viem produce, y pasa en verde aunque la
realidad sea otra. Es literalmente `feedback_tests_green_against_dead_shape`.

Alternativa honesta y barata: manejar la stack real de viem con un transport
`custom()` que lance un error RPC canónico (`{ code: 3, data: "0xc1ab61a1…" }`)
y dejar que viem arme la cadena de errores. El test entonces verifica el
contrato con viem, no con mi memoria de viem.

---

## F9 🟢 Nota de telemetría

`error_kind` cambia de cardinalidad y, sobre todo, **arreglar F1 re-bucketea el
histórico**: parte de lo que hoy cuenta como `signingUnavailable` era revert.
Cualquier comparación antes/después de este PR es inválida.

---

## Orden revisado

| # | Acción | Costo | Depende de |
| --- | --- | --- | --- |
| 0 | Probe en device: loguear `raw` del revert en el catch, correr contra preview | 20 min | — |
| 1 | **Arreglar F1**: sacar `includes("400")`, endurecer las ramas de substring | 30 min | — |
| 2 | Decidir F2: chequear `receipt.status` en claim y save | spec aparte | producto |
| 3 | Generador de error-ABIs + decoder + copy | 1-2h | **0** |

**Recomendación:** hacer **1** ahora — es barato, está probado, y por sí solo
convierte "Signing service unavailable" en un mensaje honesto. Correr **0** en
el próximo device test. **No** construir el generador hasta que 0 responda.

**F2 es el hallazgo más caro de esta revisión y no estaba en el backlog.**
