# Diagnóstico — smoke run del harness Privy × Celo (2026-07-24)

Corrida del founder, **navegador en incognito** (sin extensiones → `Detected injected
providers: Array(0)`, o sea se ejercitó el camino embedded puro: evidencia limpia).

## Veredicto: **NO es NO-GO.** Privy × Celo se comportó bien; lo que falló es el *entorno del harness*.

---

## 1. Lo que SÍ funcionó (evidencia a favor del GO)

| Check | Resultado |
|---|---|
| Login (email) | ✅ `authenticated: true` |
| Embedded wallet creada | ✅ `wallet type: embedded (privy)`, `creation status: created` |
| Address EVM | ✅ `0x95e3785925A8Ae548BCBa1Be4336CF6527519479` |
| Chain conectado | ✅ `11142220` (celoSepolia), `chain matches: true` |
| Lectura de balance vía RPC | ✅ `0.3 S-CELO`, `RPC status: ok` (el faucet funcionó) |
| `wallet_switchEthereumChain` a Celo Sepolia | ✅ ejecutado sin error |
| Modal de aprobación de tx de Privy | ✅ renderizó con **`Network: Celo Sepolia Testnet`** y **`Estimated fee <0.001 S-CELO`** |

> El modal de Privy estimó fee en Celo Sepolia correctamente. Eso significa que **la
> configuración de chain, el switch de red y la estimación de gas contra Celo funcionan**.
> La falla ocurre recién en el paso final de criptografía/serialización.

---

## 2. Falla A (BLOQUEANTE) — `Buffer is not defined`

Rompe **firma Y envío**, ambos dentro del SDK de Privy.

### Evidencia

```
[vite] Module "buffer" has been externalized for browser compatibility.
       Cannot access "buffer.Buffer" in client code.

ReferenceError: Buffer is not defined
    at i (esm-…:20727)  at r$3 (esm-…:20735)  at m$20 (esm-…:92782)
    at async onSign (esm-…:88692)
```

Mismo error en el envío: `{transaction: {…}, error: ReferenceError: Buffer is not defined}`.

### Causa raíz (confirmada, no inferida)

1. `@privy-io/react-auth` usa el global `Buffer` de Node en su ruta de embedded wallet.
   **Verificado por grep** en `node_modules/@privy-io/react-auth/dist/esm/`:
   `privy-provider-BG8GtKO6.mjs` contiene `Buffer.from` / `Buffer(`.
2. El paquete npm `buffer` **no está instalado** en el harness
   (`node_modules/buffer` no existe).
3. **Vite no polyfillea globals de Node en el browser** (a diferencia de webpack 4 / CRA).
   Externaliza `buffer` a un stub que lanza al acceder → `ReferenceError`.

**Es un hueco del bundler del harness, no una incompatibilidad Privy × Celo.**
El app productivo (Next.js/webpack) nunca lo pegó porque no usa este SDK todavía.

### Fix propuesto

- Agregar el paquete `buffer` como dependencia del harness.
- `src/polyfills.ts`: `import { Buffer } from "buffer"; globalThis.Buffer ??= Buffer;`
  importado **primero** en `main.tsx` (antes de `providers.tsx`).
- Probablemente también `define: { global: "globalThis" }` en `vite.config.ts`
  (patrón estándar de Privy/web3 sobre Vite).

---

## 3. Falla B (secundaria) — Forno `403 Forbidden`

```
POST https://forno.celo-sepolia.celo-testnet.org/ 403 (Forbidden)   ×4
    … fillTransaction → prepareTransactionRequest
```

### Causa raíz (parcial — es ambiental)

`providers.tsx:14` usa `http()` **sin URL** → viem cae al RPC default de `celoSepolia`
= Forno.

Probado desde acá con `curl`, **todos los métodos que usa `prepareTransactionRequest`
devuelven 200**, con y sin header `Origin: http://localhost:5173`:

| Método | curl |
|---|---|
| `eth_chainId` | 200 |
| `eth_maxPriorityFeePerGas` | 200 |
| `eth_feeHistory` | 200 |
| `eth_estimateGas` | 200 |
| `eth_getTransactionCount` | 200 |

→ **No es bloqueo por Origin ni por método.** Y en el browser la lectura de balance
**sí funcionó** antes de los 403. El patrón (éxito inicial → ráfaga → 403 ×4) apunta a
**rate limiting de Forno**, amplificado por el `withRetry` de viem y por React
`StrictMode` (doble invocación de efectos en dev).

> ⚠️ **Hallazgo con valor para el proyecto**, no solo para el harness: producción usa
> `http()` igual (`apps/web/src/components/wallet-provider.tsx:22-24`), pero **corre dentro
> de MiniPay**, que inyecta su propio RPC — por eso este 403 nunca apareció. **El slice web
> con Privy va a necesitar un RPC explícito**; el default de Forno no alcanza.

### Fix propuesto

Transport explícito con `fallback([...])` en vez de `http()` pelado. Falta elegir el/los
endpoints de Celo Sepolia (a confirmar contra docs, no de memoria).

---

## 4. Ruido descartado (no son fallas)

| Mensaje | Por qué se descarta |
|---|---|
| `The configured chains are not supported by Coinbase Smart Wallet: 11142220, 42220` | Privy carga el connector de Coinbase por default; el harness no lo usa |
| CORS en `auth.privy.io/api/v1/analytics_events` | El propio SDK loguea `Unable to submit event. This is not an issue.` |
| `validateDOMNesting: <div> cannot appear as descendant of <p>` | Markup interno de los modales de Privy |
| `chain: undefined (id: 11142220)` en el error de viem | Es el formateador de errores mostrando el *nombre* del chain; el id es correcto |
| `Wallet did not respond to eth_accounts` / `Detected injected providers: Array(0)` | Esperado en incognito sin extensiones |

---

## 5. Resolución (segunda corrida, mismo día)

Con el polyfill aplicado (`src/polyfills.ts`, importado primero en `main.tsx`):

- [x] **Firma** → `0xbc0c57e2…9f88721b`
- [x] **Tx de 0 CELO en testnet** → `0x265763120c…eecda9d141`, `receipt: success`
- [x] Chain `11142220`, `chain matches: true`
- [ ] **Persistencia en logout → login** ← sigue sin confirmarse explícitamente

> La address fue **idéntica en ambas corridas** (sesiones separadas, bundle nuevo,
> re-login), lo que respalda la persistencia — pero no reemplaza la prueba directa del
> paso 12.

### Falla A: confirmada y cerrada

La hipótesis se validó por partida doble: el founder verificó en consola que `Buffer`
era `undefined` (en incognito y fuera de incognito), y tras el fix firma y tx pasaron.
Regresión cubierta por `src/__tests__/browser-globals.test.ts` (3 tests, incluido el
**orden de import** en `main.tsx`).

### Falla B: caracterizada, NO bloqueante

Los 403 de Forno **siguieron apareciendo** en la corrida exitosa. La tx salió igual
porque el envío va por `Embedded1193Provider` (**el RPC interno de Privy**), no por
nuestro transport. O sea: nuestro `http()` está efectivamente roto bajo rate limit y
Privy lo compensa **solo en el camino de envío** — las lecturas vía wagmi (`useBalance`,
`useWaitForTransactionReceipt`) sí dependen de él. Requisito registrado en §10.7 del doc
de validación.

## 6. Ruido nuevo de la segunda corrida (todo cosmético)

| Mensaje | Por qué se descarta |
|---|---|
| `token_price?chainId=11142220&tokenSymbol=S-CELO 404` + `Unable to fetch token price` | Privy no tiene precio USD para CELO de testnet. Solo afecta el label de fiat en su modal |
| `analytics_events` CORS / 422 | El propio SDK: `Unable to submit event. This is not an issue.` |
| `styled-components: unknown prop "isActive"` / `React does not recognize the isActive prop` | Markup interno de los modales de Privy |
