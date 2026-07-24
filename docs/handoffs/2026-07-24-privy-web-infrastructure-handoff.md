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

## Product decision override — mandatory web access gate

> **Decisión de producto cerrada (founder, 2026-07-24).** **Reemplaza** el plan
> de "UI mínima de login opcional en Account" descrito abajo — ese bloque queda
> **SUPERSEDED**. El login web con Privy **no es opcional ni contextual**.

### Regla de acceso

```text
MiniPay → entra directo con la wallet MiniPay (bypass del gate)
Web     → requiere login Privy antes de entrar a Learn o Play
```

**No hay guest mode permanente** dentro de `learn.chesscito.com` ni
`play.chesscito.com`. Una vez dentro del producto, Learn y Play **asumen** que
existe una address EVM válida. Motivos para eliminar el guest permanente:
no más cadena guest→login→migración→wallet-ready; sin prompts repartidos por
feature; sin gates tardíos antes de pagos; un solo estado de identidad; sin
mantenimiento duplicado por feature.

### Responsabilidad por dominio

**`chesscito.com`** — superficie de descubrimiento y elección. **No monta Privy,
no muestra login, no pone login en el último slide.**

```text
Primera visita:  4 slides → Choose your path → Learn o Play
Visita posterior: pantalla de entrada → Learn o Play
CTA: Learn → learn.chesscito.com · Play → play.chesscito.com
```

**`learn.chesscito.com` / `play.chesscito.com`** — superficies responsables del
acceso:

```text
MiniPay                                   → bypass → Hub
Web + sesión Privy restaurada + wallet ok → bypass → Hub
Web + sin sesión → WebAccessGate → login Privy → embedded wallet ready → Hub
```

El gate solo aparece en web sin sesión válida. Si Privy restaura sesión y la
embedded wallet está lista, entra directo **sin volver a ver el gate**.

### Reemplazo del siguiente bloque

```text
ELIMINADO:  WebAccountAccess opcional · Continue as Guest ·
            soft prompt post-ejercicio · login contextual antes de comprar
NUEVO:      WebAccessGate obligatorio para web no autenticada
```

Infraestructura existente **se conserva**:

```text
WalletProviderBoundary
├─ MiniPay → WalletProvider
└─ Web     → WebWalletProvider  ← el gate vive AQUÍ dentro, envolviendo children
```

Dentro de la rama web, antes de renderizar children productivos:

```text
Privy loading                  → shell
unauthenticated                → WebAccessGate
authenticating                 → estado de acceso
authenticated + wallet pending → "Preparing your Chesscito wallet…"
authenticated + wallet ready   → children
error                          → retry + Open in MiniPay + Back to chesscito.com
```

### UX del gate — componente compartido `WebAccessGate`

Reutilizado en Learn y Play; **solo varía el copy**.

```text
Copy base:  Every journey needs a key.
            Sign in and your Chesscito wallet will be created automatically.
CTA:        ENTER CHESSCITO   (abre el modal nativo de Privy: Google + email)
Nota:       No wallet setup required.
Copy Learn: Unlock your learning journey
Copy Play:  Enter the Chesscito arena
```

No construir dos flujos propios separados salvo que la API del SDK lo exija.

### Estados mínimos

```text
environment loading · unauthenticated · authenticating ·
authenticated + wallet pending · authenticated + wallet ready · error · MiniPay bypass
```

### Reglas duras

- MiniPay nunca monta ni ve el gate.
- Web no autenticada **no renderiza children productivos**.
- Web autenticada no vuelve a ver el gate.
- **No existe `Continue as Guest`.**
- No montar Privy en `chesscito.com`.
- No duplicar el gate entre Learn y Play (un solo componente).
- No tocar pagos ni entitlements · no account linking · no export wallet ·
  no server-auth · no producción.

### Compatibilidad con usuarios web previos

El flujo `guest→wallet` existente se conserva **solo** como mecanismo de
transición del progreso local previo — **no** como modo permanente. Tras login:
`progreso local previo → migración existente a la wallet activa`. **No** crear un
sistema de migración nuevo.

### Analytics

```text
Registrar:    web_access_gate_viewed · web_login_started · web_login_succeeded ·
              web_wallet_ready · web_login_failed
NUNCA loguear: email · nombre social · address completa · tokens · errores crudos
```

### Tests RED→GREEN (13)

1. MiniPay bypassa el gate.
2. Web no autenticada ve el gate.
3. Web no autenticada no renderiza children.
4. Sesión restaurada + wallet ready entra directo.
5. Autenticada sin wallet muestra preparación.
6. Error permite retry.
7. Error ofrece volver a `chesscito.com`.
8. Error ofrece abrir MiniPay.
9. No existe guest CTA.
10. Learn y Play usan el mismo componente.
11. `chesscito.com` no monta Privy.
12. Ningún evento contiene PII.
13. Pagos y entitlements permanecen intactos.

### Proceso (detenerse tras `WebAccessGate`)

1. ✅ Actualizar handoff (esta sección).
2. Auditar el punto exacto de gateo de la rama web.
3. Proponer el contrato técnico.
4. Tests RED.
5. Implementación GREEN.
6. Typecheck.
7. Suite focalizada.
8. Suite completa.
9. Commit atómico.

**No avanzar** a landing final · Account · export · linking · pagos · producción.

---

## ~~Siguiente bloque — UI mínima de autenticación Privy (web)~~ · SUPERSEDED

> ⛔ **SUPERSEDED por "Product decision override" (arriba).** El login web ya no
> es opcional ni vive en Account: es un gate obligatorio (`WebAccessGate`). Se
> conserva abajo solo como registro histórico del plan previo.

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
