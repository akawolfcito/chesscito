# Cómo dan wallet MiniPay y Farcaster, y por qué Privy nos hace ruido

**Fecha:** 2026-09-02 · **Tipo:** spike (la salida es una respuesta, no código)
**Pregunta:** ¿cómo hacen MiniPay y Farcaster para dar/usar wallets en sus plataformas, y
es realmente ineludible nuestra dependencia de Privy?
**Antecedente:** [`2026-09-01-farcaster-feasibility.md`](./2026-09-01-farcaster-feasibility.md)

---

## Respuesta corta

**Los tres hacen exactamente lo mismo hacia afuera: le entregan a la app un proveedor
EIP-1193 y nada más.** La app nunca ve una clave en ninguno de los tres casos. Lo que
cambia es **por dónde llega ese proveedor** y **dónde vive la clave**.

MiniPay y Farcaster pueden hacerlo porque **son el host**: uno es un navegador dentro de una
app Android, el otro es un cliente que embebe la nuestra en un iframe/WebView. Nosotros no
somos un host, somos una página. **Una página no tiene keystore.** Ese es el motivo
estructural de que necesitemos a alguien como Privy — y no se arregla cambiando de
proveedor.

Pero — y esto es lo que encontré leyendo el código nuestro — **Privy no es la dependencia
de fondo.** La dependencia de fondo es una decisión nuestra: **el servidor acepta como
prueba de autoridad una firma EIP-191 de una dirección.** Eso es lo que obliga a que todo
usuario web tenga una wallet que firme secp256k1 *antes de tocar el producto*, aunque nunca
vaya a pagar nada.

Es eludible. Pero se elude cambiando qué acepta el servidor, no cambiando de vendor.

---

## Parte 1 — Los tres modelos, lado a lado

|  | **MiniPay** | **Farcaster Mini App** | **Privy (nuestro caso web)** |
|---|---|---|---|
| Quién es el host | La app Android de Opera, con navegador propio | El cliente de Farcaster (iOS/Android/web) | **Nadie. El host somos nosotros.** |
| Cómo llega el proveedor | **Inyección**: `window.ethereum` con `isMiniPay: true` | **`postMessage`**: `sdk.wallet.getEthereumProvider()` sobre el canal iframe/WebView | **SDK de React montado dentro de nuestro bundle** |
| Quién crea la clave | MiniPay, al registrarse con Google/teléfono | El cliente de Farcaster | Privy, al hacer login social |
| Dónde vive la clave | **Android Keystore**, en el dispositivo | En el cliente de Farcaster, fuera de nuestra página | Repartida en shards; una parte en infraestructura que Privy opera |
| Recuperación | Backup cifrado **en el Google Drive del propio usuario** | La cuenta de Farcaster del usuario | Privy |
| Quién elige la wallet | Nadie: es la del entorno | El host — *"your Mini App won't need to show a wallet selection dialog"* | Nosotros, por contrato |
| Qué ve nuestra app | Un EIP-1193 | Un EIP-1193 | Un EIP-1193 |
| Qué nos cuesta | **0** | **0** | Un plan, un techo de MAU y un allowlist |

### Lo que hay que ver en esa tabla

Las tres columnas terminan igual: **un EIP-1193**. Nuestro código ya trata a los tres del
mismo modo — `lib/minipay/provider.ts` no hace nada más exótico que
`provider.request({ method: "eth_accounts" })`.

Lo que cambia está *arriba* de esa fila, no abajo. Y el patrón que comparten MiniPay y
Farcaster, que Privy no puede tener, es este:

> **La clave vive en un lugar que la app no opera, y la app sólo recibe el proveedor.**

En MiniPay la clave está en el Keystore de Android y el respaldo está en el Google **del
usuario** — Opera no la tiene. En Farcaster está en el cliente, del otro lado de un
`postMessage`, y nosotros ni siquiera podemos tocarla.

En nuestra rama web, en cambio, **no hay ningún lugar así**. Un `<iframe>` que servimos
nosotros, un `localStorage` que servimos nosotros: todo lo que una página web controla, lo
controla la página. Por eso hay un tercero: **alguien tiene que ser el lugar que nosotros
no podemos ser.**

⚠️ **Corolario incómodo:** no existe una versión de "hacerlo nosotros mismos" que sea
igual de segura y no involucre a alguien más. La pregunta correcta no es *cómo sacamos al
tercero*, es *qué tercero, y para cuántos usuarios*.

---

## Parte 2 — Por qué nos duele más de lo que debería

Acá está el hallazgo del spike, y no estaba donde yo lo buscaba.

Grepeando qué consume la wallet en el producto, aparecen dos usos muy distintos:

**(a) La dirección como CLAVE DE SCOPING** — `inbox-chip`, `trophies-data-provider`,
`leaderboard-sheet`, `coach/history`, `hub-daily-tile`, `telemetry-account-bridge`,
`daily-tactic-slot`. Todos leen `useAccount().address` para preguntar *"¿qué le
corresponde a este usuario?"*. Para eso **una sesión de servidor alcanza**. No hace falta
que nada firme.

**(b) La dirección como FIRMANTE** — `exercises-screen` (sesión de escritura de score),
`use-lite-welcome-gift-claim`, `peones-hint-button`, `coach-history-delete-panel`. Todos
hacen `personal_sign`, y el servidor lo verifica de verdad:

> *"Verifies the EIP-191 signature over a challenge […] the SIGNATURE proves the wallet
> agreed"* — `api/scores/session/authorize/route.ts`

Ese modelo es bueno y está bien construido — dos controles independientes, el token guardado
sólo como SHA-256. **No lo estoy criticando.** Pero tiene una consecuencia que no se decidió
explícitamente:

> **`WebAccessGate` no deja pasar a nadie sin una dirección** (*"renders productive
> `children` ONLY once Privy reports an authenticated session AND wagmi exposes an
> embedded-wallet address […] there is no `Continue as Guest`"*).

Es decir: **un usuario web2 que sólo quiere resolver un ejercicio necesita una wallet
provisionada antes de ver la primera pantalla.** No porque el ejercicio la necesite —
porque la puerta la pide.

Y eso tiene precio medido, en el código: `DEFAULT_CAPACITY_LIMIT = 460`, con el comentario
*"⚠️ Debe ir POR DEBAJO de 499"*. **Nuestro techo de usuarios web es el plan de Privy**, y
encima corre el allowlist. Estamos pagando infraestructura de wallets — con su techo de
MAU — para resolver, en la mayoría de las superficies, un problema de **identidad**.

⚠️ Dato de contexto que cambia el cálculo de riesgo: **Privy fue adquirida por Stripe.**
La dependencia ya no es de una startup, y su roadmap de precios ahora responde a Stripe.

---

## Parte 3 — Las salidas, de la más barata a la más cara

### A. Cambiar qué acepta el servidor ✅ la única que quita la dependencia de verdad

Separar los dos usos que hoy están fundidos:

- **Scoping** (inbox, trofeos, leaderboard, daily, coach history) → sesión de servidor. Sin
  wallet, sin firma, sin vendor.
- **Firma** (claim de Peones, sesión de score, borrado, pagos) → seguir exigiendo EIP-191,
  y sólo ahí.

Así la wallet deja de ser **un requisito de entrada** y pasa a ser **un requisito de la
plata**. El techo de 460 deja de aplicarle a todo el mundo y le aplica sólo a quien
compra — que es exactamente la población que ya trae wallet en MiniPay y en Farcaster.

⚠️ No es gratis: hay que decidir qué pasa cuando un usuario con sesión *después* conecta
wallet (¿se fusionan los progresos? ¿quién gana?), y eso es un spec, no un refactor. Pero
**es el único camino donde el tercero se vuelve opcional en vez de reemplazado.**

### B. Passkeys — el modelo de MiniPay, sin Opera

Una passkey (WebAuthn) vive en el enclave seguro del dispositivo y se respalda en el iCloud
Keychain o el Google Password Manager **del usuario**. Es, estructuralmente, **la misma
arquitectura que MiniPay**: clave en el keystore del sistema operativo, recuperación en la
nube del propio usuario, nadie en el medio.

⛔ Pero no encaja tal cual con nuestro modelo de auth: una passkey firma **WebAuthn/P-256**,
no **secp256k1/EIP-191**. Para que el servidor pueda verificarla hacen falta una de dos:
una smart account que valide por ERC-1271, o enseñarle al servidor a verificar WebAuthn
directo. La primera arrastra bundler/paymaster (**otro vendor**, salvo self-host) y hay que
confirmar el soporte en Celo. La segunda es código nuestro, y toca la parte del sistema que
menos conviene tocar a la ligera.

⚠️ Y hay una trampa de producto: una smart account **no es una EOA**, y el rail de pagos
hace `ERC20.transfer` desde una EOA. Cambia el camino de la transacción.

### C. Cambiar de proveedor — Dynamic, Turnkey, Openfort, Thirdweb, Para, Coinbase CDP

Misma dependencia, otro logo. **Sólo vale la pena por precio o por techo de MAU**, nunca por
soberanía: el modelo de confianza no cambia. Si el problema real es el 499, esto lo mueve;
si el problema real es *depender de alguien*, no lo toca.

### D. Farcaster — el caso donde el problema simplemente no existe

En una Mini App el proveedor lo pone el host, gratis, y la identidad (fid, username, pfp)
viene incluida. **Ni Privy, ni allowlist, ni techo de 460.**

Y sumado a lo del spike anterior — que el duelo **no usa wallet en absoluto**, porque la
autoridad sobre el asiento es un token de servidor (`lib/duel/seat-token.ts`) — la rama
Farcaster es la **más barata de las tres** que tenemos o querríamos tener.

---

## Lo que este spike NO verificó

- No confirmé si MiniPay usa EOA o smart account. Los docs públicos no lo dicen y la
  distinción importa si algún día firmamos con ERC-1271.
- No confirmé el soporte de ERC-4337 / EIP-7702 en Celo mainnet, ni qué bundler habría.
  Sin eso, la opción B es una idea, no un plan.
- No medí cuántas de las superficies de scoping romperían si la dirección dejara de estar
  garantizada. Enumeré las que leen `useAccount()`, no las que **asumen** que hay una.
- El límite exacto del plan de Privy lo inferí del comentario `"debe ir POR DEBAJO de 499"`,
  no de la factura.

---

## Recomendación

**El orden barato es D → A, y B sólo si A no alcanza.**

1. **D (Farcaster)** valida el modelo *"el host pone la wallet"* **sin construir nada**, y
   de paso mide si hay demanda afuera de MiniPay. Es el spike anterior.
2. **A (separar scoping de firma)** es lo único que baja el techo de 460 de encima de todo
   el producto web. Es un spec de tamaño medio, sin vendor nuevo, y sirve igual aunque
   Farcaster no funcione.
3. **B (passkeys)** es la respuesta correcta a largo plazo y la copia honesta de lo que hace
   MiniPay, pero cuesta un rediseño del camino de firma y probablemente un bundler. No antes
   de que A esté hecho.

⛔ **C (cambiar de vendor) no resuelve lo que te hace ruido.** Sólo cambia a quién le
pagamos.

---

*Fuentes:*
[MiniPay — overview](https://docs.minipay.xyz/getting-started/overview.html) ·
[Opera — MiniPay FAQ](https://blogs.opera.com/africa/2023/09/minipay-frequently-asked-questions/) ·
[Farcaster — Interacting with Ethereum wallets](https://miniapps.farcaster.xyz/docs/guides/wallets) ·
[Farcaster — specification](https://miniapps.farcaster.xyz/docs/specification) ·
[Openfort — Top embedded wallets 2026](https://www.openfort.io/blog/top-10-embedded-wallets) ·
[Crossmint — Privy alternatives](https://www.crossmint.com/learn/privy-alternatives-for-programmable-wallets)
