# Runbook — probe del raw de MiniPay (custom errors go/no-go)

**Fecha**: 2026-07-10
**Estado**: instrumentación lista, **datos pendientes de captura en device**
**Superficie**: `/dev/tx-error-probe` (404 en producción)

---

## Por qué existe

`apps/web/src` no decodifica revert data en ningún lado. Construir el decoder +
el generador de ABIs son 1-2h. **Ese trabajo vale cero si MiniPay no nos entrega
la revert data.**

Todo lo que sabemos hoy se midió con `publicClient.simulateContract` contra
Forno, no con la wallet. La app **no simula**: va directo a `eth_sendTransaction`
del provider inyectado. Si MiniPay estima adentro y devuelve un `Error` de texto
plano, `raw` es `undefined` y el decoder muere en silencio.

Este probe no decodifica nada. Solo reporta.

---

## Lo que el probe captura

Por escenario: `txHash` (si existe), `receipt.status` (si hubo tx), y del error
`name`, `message`, `code`, `data`, `signature`, las **keys propias**, y la cadena
completa de `cause` hasta profundidad 8 (con guarda de ciclos).

Más el contexto: `origin`, `chainId`, `userAgent`, `window.ethereum.isMiniPay`.

**Redacción**: `serialize-tx-error.ts` reemplaza toda corrida de hex de ≥100
caracteres **dentro de `message`** por `0xabcdef…[redacted N chars]`. Eso tapa la
firma EIP-712 de 132 chars que viem imprime en `args:`. El campo estructurado
`data` **no se redacta**: es revert data, no es un secreto, y es justamente lo
que venimos a leer.

---

## Antes de correr

1. **Deploy a preview** con este branch. Las `/dev` pages 404 en producción.
2. La wallet de MiniPay necesita un saldo chico de un stable (USDC/USDT/cUSD):
   el probe usa `feeCurrency`, y MiniPay no tiene CELO.
3. **Escenario 3 gasta gas real.** Es una tx que se transmite y revierte.
4. Anotá: modelo de teléfono, versión de MiniPay (Settings → About), y que el
   entorno es `preview.chesscito.com`.

---

## Los cuatro escenarios

Abrí `https://preview.chesscito.com/dev/tx-error-probe` **dentro de MiniPay**.

| # | Botón | Acción exacta | Qué se espera aprender |
| --- | --- | --- | --- |
| 1 | Cancel | `approve(shop, 0)` sobre USDC, y **rechazás** en la wallet | Forma de la cancelación. ¿`code: 4001`? ¿hay hash? |
| 2 | Fail before broadcast | POST malformado a `/api/sign-badge` | Un fallo que nunca toca la wallet. Control negativo. |
| 3 | **Revert** | Re-clamar un badge que la wallet **ya tiene** (torre = `levelId 1`) | **La pregunta.** ¿Llega `0xfafe7970` (`BadgeAlreadyClaimed`)? ¿Hay hash, o la wallet rechaza en estimación? |
| 4 | Success control | `approve(shop, 0)`, y **aceptás** | Confirma que el camino feliz funciona y que el receipt se lee. |

`approve(shop, 0)` es una escritura real, con receipt real, y **efecto económico
cero**. Es el control honesto.

El escenario 3 funciona porque `/api/sign-badge` firma cualquier `levelId` sin
mirar propiedad (`route.ts:23`). La firma es válida; el que dice que no es el
contrato. Es la única forma de producir revert data real sin pelearse con los
gates de la UI.

Al terminar: **Copy all reports as JSON** y pegalo en el issue.

---

## Cómo se lee el resultado

La distinción que decide todo está en el escenario 3:

- **Hay `txHash` y `receiptStatus: "reverted"`** → la wallet transmitió y la tx
  se minó revertida. **No hay revert data que decodificar**: un receipt revertido
  no la trae. El decoder no sirve para este caso; lo que sirve es el chequeo de
  `receipt.status`, que ya shipeamos en #199 / #200.
- **No hay `txHash`, y `revertData` es un `0x…` de 10 caracteres** → MiniPay
  rechazó en estimación y **conservó la revert data**. **GO**: el decoder tiene
  material y `BadgeAlreadyClaimed` / `CooldownActive` / `DailyLimitReached` se
  pueden distinguir.
- **No hay `txHash`, y `revertData` es `null`** → MiniPay rechazó en estimación y
  **tiró la revert data**. **NO-GO**: no hay nada que decodificar del lado del
  cliente, y la salida sería server-side (`eth_call` de replay contra Forno con
  los mismos args) o directamente no hacerlo.

`findRevertData()` ya resuelve las tres formas conocidas en que un provider la
adjunta: `error.data`, `error.data.data`, y el campo `signature` que viem deja
cuando la ABI no tenía el error.

---

## Al terminar

Borrar, en un solo commit:

- `apps/web/src/app/dev/tx-error-probe/`
- `apps/web/src/lib/debug/serialize-tx-error.ts` (+ su test)

No hay código de producción que revertir: el probe no toca ninguno.

---

## Incertidumbres conocidas

1. **El escenario 3 puede no revertir** si la wallet ya no tiene el badge de la
   torre, o si `levelId 1` no es el correcto. Verificar propiedad antes
   (`/hub` → Badges) y ajustar el campo `levelId`.
2. **MiniPay podría no estimar** y transmitir siempre. En ese caso el escenario 3
   cuesta gas y devuelve `reverted`, que ya es una respuesta: NO-GO para el
   decoder por esa vía.
3. `approve` con `feeCurrency` puede fallar si la wallet no tiene el stable que
   `getMiniPayFeeCurrency` devuelve. El helper reintenta sin `feeCurrency`, pero
   en MiniPay eso falla por falta de CELO. Si el escenario 4 no arranca, es esto.
4. El probe corre contra **mainnet** (chain 42220), porque es donde está el badge
   minteado. No hay versión testnet de este experimento.
