# Handoff — Privy Web Access, infrastructure slice

> Sesión del **2026-07-24**. Cierra el slice de **infraestructura** de Privy Web
> Access. La próxima sesión implementa **solo la UI mínima de login**.

## Estado

| | |
|---|---|
| Rama | `feat/web-wallet-provider` |
| Base | `main` local (harness Privy mergeado + assets) |
| Delta | 4 commits de infraestructura, todos del slice |
| Working tree | limpio salvo archivos ajenos (ver "No incluir") |
| Producción | **no tocada**. Nada mergeado a `main`. Flag off por default. |

Commits relevantes:

```text
bbf9448  wallet branch resolver
6e11e6a  web RPC fallback transports
57d8dee  WebWalletProvider + Privy deps
6665ca4  client boundary + feature flag
```

El merge/push de `main` lo hace el founder; el agente solo pushea ramas si se le pide.

---

## Infraestructura completada

### 1. Branch resolution — `src/lib/wallet/wallet-branch.ts`

`resolveWalletBranch({ privyEnabled, hydrated, isMiniPay })`:

```text
flag OFF                → injected
flag ON + pre-hydration → undecided
flag ON + MiniPay       → injected
flag ON + web           → privy
```

Privy es **inalcanzable desde MiniPay** (test de propiedad sobre todas las
combinaciones). Con el flag apagado devuelve `injected` incluso antes de
hidratar → el árbol renderiza igual que hoy, sin shell ni remount.

### 2. Web transports — `src/lib/wallet/web-transports.ts`

`createWebTransports()` → `fallback([...])` **solo** para Celo Mainnet `42220`:

```text
https://celo.drpc.org
→ https://public.1rpc.io/celo
→ https://forno.celo.org   (best-effort, rate-limited, fue el 403)
```

- Endpoints públicos **sin API key**, confirmados contra docs de proveedores el
  2026-07-24 (Ankr **excluido**: documenta `YOUR_ANKR_API_KEY`).
- `rank: false` conserva el orden declarado; `timeout: 10_000`, `retryCount: 1`.
- MiniPay **no importa ni comparte** esta config (su `wagmiConfig` sigue con
  `http()` pelado, byte-idéntico).
- Motivo: Forno da **403 bajo ráfaga en browser** (validación §10.7). Las
  lecturas web vía wagmi (`useBalance`, `useWaitForTransactionReceipt`) pegan a
  *nuestro* transport; MiniPay lo enmascaraba inyectando su RPC.

### 3. WebWalletProvider — `src/components/web-wallet-provider.tsx`

`@privy-io/react-auth 2.25.0` + `@privy-io/wagmi 1.0.6` (mismas versiones que el
harness). Árbol: `PrivyProvider → QueryClientProvider → WagmiProvider`.

- `createWebWagmiConfig()`: **solo** Celo Mainnet, **sin** connector `injected`,
  transports de `createWebTransports()`. Instancia estable a nivel módulo.
- `requirePrivyAppId()`: lee `NEXT_PUBLIC_PRIVY_APP_ID`, **throw solo al montar**
  (el import nunca throwea). **Nunca** lee `PRIVY_APP_SECRET` — el backend ancla
  entitlements a tx on-chain keyed por address EVM, no verifica sesiones Privy.
- Guest (sin login) **renderiza children**: Privy no gatea acá.
- Privy config: `loginMethods: ["email","google"]`, `defaultChain: celo`,
  `supportedChains: [celo]`, `embeddedWallets.ethereum.createOnLogin:
  "users-without-wallets"`.

### 4. Client boundary — `src/components/wallet-provider-boundary.tsx`

Sustituye el montaje directo de `WalletProvider` en el layout.

- Espera hidratación (`useState` + `useEffect`).
- Llama `isMiniPayEnv()` **solo en cliente** (`hydrated ? isMiniPayEnv() : false`).
- Consume `resolveWalletBranch` y monta **exactamente uno**: `WalletProvider` /
  `WebWalletProvider` / shell `undecided` (`<div data-wallet-shell="undecided" />`,
  **sin children ni hooks wagmi** — mismo markup en SSR y primer render cliente).
- El layout (`src/app/[locale]/layout.tsx`) es Server Component y **no bifurca**
  con `isMiniPayEnv()`; solo monta el boundary.

### 5. Feature flag — `apps/web/.env.template`

```env
NEXT_PUBLIC_PRIVY_ENABLED=false
```

Off por default. Con el flag apagado, el comportamiento anterior queda activo
(rama `injected` siempre, sin shell extra).

---

## Verificación (registrada esta sesión)

- **Typecheck**: limpio (`pnpm exec tsc --noEmit`).
- Resolver: 6/6 · Transports: 8/8 · WebWalletProvider: 9/9 · Boundary: 12/12.
  (49/49 en los 6 archivos de test del slice.)
- **Suite `apps/web`: 5784 passing / 1 failing.**
- Único fallo: `src/lib/themes/__tests__/landing-assets.test.ts` → "shared asset
  byte-identical across the two apps". **Drift de assets preexistente y ajeno al
  slice** (converge con `pnpm art:sync-landing`). **No corregido a propósito.**
- Regresión propia ya resuelta: `provider-tree-invariant.test.ts` se actualizó
  al boundary como único punto de montaje (WalletProvider interno intacto).

---

## Siguiente bloque — UI mínima de autenticación Privy (web)

Implementar **solo** esto. La UI existe únicamente cuando:

```text
NEXT_PUBLIC_PRIVY_ENABLED=true && !isMiniPayEnv()
```

Objetivo UX:

```text
guest puede jugar
login visible pero no obligatorio
Google + Email
logout
wallet lista después de login
```

### Alcance sugerido

1. Auditar los puntos actuales de Account y entrada web (dónde inyectar el CTA).
2. Componente pequeño: `WebAccountAccess` (o nombre equivalente).
3. Estados mínimos:

   ```text
   Privy loading
   guest
   authenticating
   authenticated + wallet ready
   authenticated + wallet pending
   error
   ```

4. Acciones:

   ```text
   Continue with Google
   Continue with Email
   Continue as Guest
   Sign out
   ```

5. Mostrar únicamente: nick de Chesscito · estado sincronizado · address
   truncada · logout.

**No mostrar todavía**: export wallet · account linking · external wallets ·
balances · seed/private key · purchase gates · server-auth.

### Fuera de alcance

landing final · soft prompt post-ejercicio · gates de compra · Account completo ·
export wallet · account linking · pagos · entitlements · producción.

### No incluir en commits

- `docs/audits/2026-07-18-theme-runtime-inventory.json` (lo regeneran tests).
- Documentos untracked previos ajenos al slice
  (`docs/specs/2026-07-23-privy-web-access-audit.md`).
- Arreglo de `landing-assets.test.ts`.

---

## Riesgos vigentes

| Riesgo | Estado |
|---|---|
| Hydration mismatch / doble mount de wagmi | Resuelto por diseño (`undecided` + shell). Vuelve si se mueve la decisión al render. |
| Regresión en MiniPay (camino que factura) | Rama byte-idéntica; no comparte transports; cubierto por tests. |
| Forno 403 cuelga lecturas web | Mitigado por el transport `fallback`. |
| `Buffer is not defined` sobre Vite | El app es Next/webpack; **verificar, no asumir** cuando la UI Privy se ejercite en browser. El harness lo sufrió (`tools/privy-celo-harness/src/polyfills.ts`). |
| Bundle de Privy/wagmi en first load | Medir cuando la UI se monte tras el flag. |
| `NEXT_PUBLIC_PRIVY_ENABLED` on por error en prod | Off por default; test verifica off = árbol actual. |

## Restricciones

No tocar producción · No mergear a `main` · No modificar pagos/entitlements/
economía · No account linking · No montar Privy dentro de MiniPay · No compartir
transports entre ramas · No decidir identidad desde estado no hidratado.
