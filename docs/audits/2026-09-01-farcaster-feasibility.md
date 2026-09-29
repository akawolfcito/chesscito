# Farcaster: qué necesitaríamos — spike de viabilidad

**Fecha:** 2026-09-01 · **Tipo:** spike (la salida es una respuesta, no código)
**Preguntas:** (P1) ¿se puede habilitar Farcaster con esfuerzo mínimo sobre lo que ya
existe, mismo producto? Si no, ¿alcanza con una parte — el P2P con pool? (P2) ¿cuál da
menor esfuerzo y cuál mayor retorno?

---

## Respuesta corta

**P1 — Sí, estructuralmente.** Chesscito ya es exactamente la forma que Farcaster pide:
una web app Next.js, mobile-first a 390px, con wagmi. Celo está soportado por el conector
oficial de Mini Apps. **No hay que reescribir el juego.**

Pero "mismo producto completo" **no** es el camino barato, y no por lo técnico: por lo
económico. El producto que monetiza (Peones, Season Pass, Shop) cobra en stablecoins de
Celo, y un usuario de Farcaster tiene su plata en Base. Portar todo arrastra el rail de
pagos, la rama Privy y 181 archivos acoplados a MiniPay hacia una plataforma donde nada de
eso convierte.

**El P2P sí es la parte correcta a llevar, y por una razón que no esperaba encontrar: el
duelo NO necesita wallet.** La autoridad sobre un asiento es un token de servidor
(`lib/duel/seat-token.ts`), no una dirección. Un duelo se juega entero sin conectar nada.

**Pero "con pool" no existe.** Cero código de apuesta/escrow/payout en el repo. Es un
subsistema nuevo con dinero real, no una extensión.

**P2 — Menor esfuerzo y mayor retorno son el mismo camino:** el duelo como Mini App,
sin pool en la v1. Detalle abajo.

---

## Lo que ya tenemos a favor (medido, no supuesto)

| Requisito de Mini App | Estado en Chesscito |
|---|---|
| Web app hosteada, no nativa | ✅ Next.js 14.2.35 en Vercel |
| Viewport móvil angosto | ✅ `--app-max-width: 390px`, mobile-first por diseño |
| wagmi 2.x + viem | ✅ wagmi 2.19.5 / viem 2.46.3 — compatibles con `@farcaster/miniapp-wagmi-connector` |
| Cadena soportada por el wallet de Farcaster | ✅ Celo y Celo Sepolia están en el conector oficial |
| Config de wagmi ya en `chains: [celo, celoSepolia]` | ✅ `lib/wallet/wagmi-config.ts` — es literalmente la config que muestran los docs de Celo |
| Imagen OG por partida para el embed | ✅ `/api/og/victory/[id]` ya existe |
| Mecánica de "link que alguien guarda" | ✅ `lib/duel/link.ts` — es la forma nativa de un cast |
| Arquitectura de ramas de wallet ya abstraída | ✅ `resolveWalletBranch` + carga lazy + `data-wallet-branch` |

Esa última fila es la más importante para el costo: **ya existe la maquinaria para montar
un árbol de wallet distinto según el entorno.** Agregar Farcaster es extender un patrón,
no inventarlo.

---

## Los gaps reales, en orden de dureza

### 1. `X-Frame-Options: SAMEORIGIN` bloquea el cliente web de Farcaster ⛔

`apps/web/next.config.js` lo pone sobre `/(.*)`. Los Mini Apps corren en un `postMessage`
channel dentro de **iframe (web) o WebView (móvil)**. Con `SAMEORIGIN`, `farcaster.xyz` no
puede renderizar la app: HTTP 200, iframe en blanco, sin error visible del lado nuestro.

Arreglo: reemplazar por `Content-Security-Policy: frame-ancestors` con los hosts de
Farcaster. **Es una decisión de seguridad, no un one-liner cosmético** — hoy la app es
inembebible a propósito, y esa es una defensa real contra clickjacking sobre una superficie
que firma transacciones.

### 2. El manifest fija la identidad de la app para siempre

`/.well-known/farcaster.json` requiere `version`, `name` (≤32), `homeUrl`, `iconUrl`
(1024×1024 PNG **sin alpha**), más un `accountAssociation` (`header`/`payload`/`signature`)
firmado desde el FID dueño del dominio, generado con la herramienta de Farcaster.

⛔ **El dominio ES el identificador y no se puede cambiar después.** Y `www.x.com` y
`x.com` cuentan como apps distintas, con notificaciones y datos separados. Tenemos split de
hosts (`learn.chesscito.com` / `play.chesscito.com`, más los preview), así que hay que
elegir a conciencia — y el middleware de `mode-routing` rebota `/arena` a PLAY, con lo cual
el `homeUrl` tiene que apuntar al host que no rebota.

Falta también arte que no tenemos en esas medidas exactas: splash 200×200, screenshots
1284×2778 (máx. 3), hero 1200×630. ⚠️ Regla del repo: **no upscalear** — hay que pedirlos
en resolución.

### 3. `sdk.actions.ready()` o pantalla de carga infinita

`@farcaster/miniapp-sdk` exige llamar `await sdk.actions.ready()` cuando la app terminó de
cargar. Si no, el usuario ve un splash eterno. Tenemos `hooks/use-splash-loader.ts` — ahí
va el enganche.

### 4. La rama de wallet es binaria y hay que hacerla ternaria

`resolveWalletBranch` devuelve `injected | privy | undecided`. Farcaster necesita una
cuarta: montar `@farcaster/miniapp-wagmi-connector` en vez de `injected()` o Privy.

⚠️ El costo escondido: `WALLET_BRANCH_ATTR` es **load-bearing en dos sentidos** — los tests
unitarios afirman que hay exactamente una rama montada, y el bundle guard usa ese literal
para probar que el chunk no llegó al root layout. Tocar el resolver toca tests, guard y el
spec `2026-08-07-wallet-branch-lazy-load`. No es difícil; es que ripplea.

### 5. El gate de Privy es el problema… y desaparece solo

Hoy: no-MiniPay ⟶ rama Privy ⟶ **allowlist de 5 cuentas**. Un usuario de Farcaster que caiga
ahí ve un callejón sin salida.

Pero un Mini App **trae su propio wallet y su propia identidad** (fid, username, pfp) del
host. La rama Farcaster no pasa por Privy. Eso no es trabajo extra: **es lo que hace viable
Farcaster**, porque el allowlist es hoy el techo duro de la web.

⚠️ Y es exactamente el argumento que desbloquea el duelo. `lib/duel/duel-flag.ts` documenta
por qué el duelo está congelado: *"cada invitado web que acepta una invitación es un LOGIN
contra un presupuesto de capacidad que es pequeño"*. **En Farcaster ese costo es cero.** La
razón por la que el duelo está apagado no aplica en esta plataforma.

### 6. Los 181 archivos que preguntan `isMiniPayEnv()`

No son 181 refactors. La mayoría decide tres cosas: `feeCurrency`, el CTA de "add cash", y
la forma de compartir. El rail de pagos **ya está escrito platform-agnostic** —
`use-payment-rail.ts` dice explícito *"feeCurrency-optional so MiniPay AND MetaMask-on-Celo
both work"*. Farcaster entra por la puerta de MetaMask-on-Celo.

⚠️ Pero el booleano `isMiniPay` va a necesitar una tercera respuesta en las superficies que
hoy asumen "o MiniPay o web". Es trabajo mecánico y aburrido, y es la mayor parte del costo
si se porta el producto completo.

### 7. El gas, que es el verdadero muro económico

Farcaster **no tiene paymaster** y las transacciones batch *"execute sequentially, not
atomically"*. En MiniPay el gas se paga en cUSD y el usuario nunca lo ve. En Farcaster, un
usuario tiene que tener **CELO nativo** para firmar.

Un usuario de Farcaster típico tiene fondos en Base. Para comprar un Peón tiene que
puentear a Celo primero. **Eso no es fricción, es una pared.** Conversión esperada ≈ 0.

⛔ Consecuencia directa: **cualquier superficie que cobre no debe ir en la v1 de Farcaster.**

### 8. `pool` no existe

Grep completo sobre `lib/duel` y `components/duel`: cero `stake`, `wager`, `pool`, `escrow`.
Los tres specs del duelo (`2026-07-13`, `2026-08-13`, `2026-08-15`) son de juego, no de
dinero. Agregarlo significa: contrato de escrow, depósito de ambos lados, payout contra el
veredicto de `referee.ts`, y — la parte cara — **qué pasa cuando alguien abandona, el reloj
expira o el servidor se cae con plata adentro**. Es un spec nuevo con dinero real y
auditoría, no una feature.

---

## Los tres caminos, con costo y retorno

### Tier 1 — Mini App del duelo, sin pool ✅ **recomendado**

**Qué es:** una Mini App cuyo `homeUrl` es la Arena. Invitás por cast, tu contrincante
toca, juega. Identidad y avatares los pone Farcaster. Sin wallet, sin login, sin pagos.

**Qué hay que construir:** headers de frame · manifest + `accountAssociation` + arte ·
`sdk.actions.ready()` · `composeCast` para la invitación · embed `fc:miniapp` reusando la OG
que ya existe · desactivar el gate Privy en esta rama · levantar `NEXT_PUBLIC_ENABLE_DUEL`.

**Lo que NO hay que construir:** rama de wallet (el duelo no la usa), rail de pagos, shop,
i18n nuevo, tablero, reglas, reloj, árbitro — todo eso ya está y es agnóstico de plataforma.

**Retorno:** es el único camino donde la plataforma *aporta* algo que hoy nos falta y
cuesta caro — distribución en el feed, e identidad gratis en lugar del allowlist de Privy.
Y la mecánica ya coincide: *"the whole product is a link somebody keeps"*.

**Riesgo:** el duelo está congelado en V0 desde el 2026-08-16. Descongelarlo es una decisión
de producto, no técnica. Pero **la razón escrita para congelarlo — el presupuesto de logins
Privy — no existe en Farcaster.**

### Tier 2 — producto completo (LEARN + PLAY + Shop) en Farcaster

Suma sobre Tier 1: rama de wallet Farcaster (con el ripple de tests + bundle guard), tercera
respuesta en las superficies `isMiniPay`, y el muro del gas de la sección 7.

**Retorno esperado: bajo, y no por el juego.** El juego portaría bien. Lo que no portaría es
la caja: cobrar en Celo a un público con fondos en Base. Se paga el costo completo del port
para obtener la mitad no-monetizable del producto.

⚠️ Si algún día se hace, el orden correcto es Tier 1 primero igual — comparte el 100% de la
infraestructura de plataforma (manifest, headers, SDK, embeds).

### Tier 3 — duelo con pool

Subsistema nuevo: escrow, depósitos, payouts, resolución de abandonos y timeouts con plata
adentro. Dinero real ⟶ red-team obligatorio ⟶ probablemente auditoría.

⛔ Y acá la pregunta de la cadena deja de ser opcional: un pool en Celo, con un jugador que
tiene que puentear antes de aceptar el duelo, **no se llena nunca**. Un pool en Farcaster
quiere el activo que el usuario ya tiene.

**Esto no es un tier, es un proyecto.** Merece su propio spec. No debería tocar la v1.

---

## Sobre la pregunta de la cadena (P2)

Tu premisa — *"si nadie lo usa por estar en Celo, mejor que lo usen pocos a que no lo use
nadie"* — es correcta, pero se puede afinar, porque **separa limpio en dos**:

- **Jugar no cuesta gas.** El duelo no toca la cadena. En Celo, en Base o en ninguna, se
  juega igual. Acá Celo no cuesta usuarios: **cuesta cero**.
- **Cobrar sí cuesta gas, y en Celo cuesta casi todos los usuarios de Farcaster.**

Por eso Tier 1 no te obliga a elegir cadena: **no hay cadena en Tier 1.** Podés medir
demanda real en Farcaster sin migrar nada ni contradecir la tesis Celo/MiniPay. Si el duelo
tracciona ahí, *después* la decisión de dónde vive el pool se toma con datos en vez de con
hipótesis — y esa decisión es reversible, mientras que el dominio del manifest no lo es.

---

## Lo que este spike NO verificó

- No probé la app dentro de un cliente Farcaster real. Todo lo de arriba es lectura de
  código nuestro + docs de Farcaster, no una medición.
- Los docs de Farcaster **no documentan explícitamente** el requisito de `frame-ancestors`.
  Lo deduje del hecho de que el canal es `postMessage` en iframe/WebView + el
  `SAMEORIGIN` que tenemos. **Hay que confirmarlo empíricamente** antes de estimar.
- No medí el peso que agregaría `@farcaster/miniapp-sdk` al bundle (importa por el
  bundle guard y por el criterio de performance de MiniPay).
- No revisé si `@farcaster/miniapp-sdk` exige Node ≥ 22.11 en runtime o sólo en su CLI de
  scaffolding. Nuestro `engines` dice `>=18`.

---

## Recomendación

**Tier 1: la Mini App del duelo, sin pool, sin cadena.** Es el menor esfuerzo y el mayor
retorno a la vez, porque es el único punto donde Farcaster nos da algo que hoy nos falta
(distribución + identidad sin allowlist) en vez de pedirnos que portemos algo que allá no
convierte.

**Próximo paso propuesto:** antes de escribir un spec, un probe de 30 minutos que confirme
el punto ciego más caro — desplegar un preview con `frame-ancestors` abierto y un
`farcaster.json` mínimo, y ver si la Arena carga adentro de un cliente Farcaster real. Si
carga, el spec de Tier 1 se escribe sobre terreno medido. Si no carga, cambia todo.

---

*Fuentes consultadas:*
[Farcaster Mini Apps — getting started](https://miniapps.farcaster.xyz/docs/getting-started) ·
[publishing / manifest](https://miniapps.farcaster.xyz/docs/guides/publishing) ·
[specification](https://miniapps.farcaster.xyz/docs/specification) ·
[Celo — Build with Farcaster](https://docs.celo.org/build-on-celo/build-with-farcaster) ·
[@farcaster/miniapp-wagmi-connector](https://www.npmjs.com/package/@farcaster/miniapp-wagmi-connector) ·
[MDN — X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
