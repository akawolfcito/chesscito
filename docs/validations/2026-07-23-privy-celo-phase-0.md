# Privy × Celo — Validación Fase 0

> **Fecha de consulta:** 2026-07-23 · **Gate de:** `docs/specs/2026-07-23-privy-web-access-audit.md`
> **Alcance:** resolver el único blocker (¿Privy puede usar Celo 42220 para el caso Chesscito?).
> **Restricciones respetadas:** no se implementó provider split, no se tocó `main`, prod, MiniPay,
> pagos, entitlements ni migraciones. No se commitearon secretos. No se ejecutaron tx económicas.

---

> **Actualización 2026-07-23 (harness):** se construyó el harness empírico aislado
> (`tools/privy-celo-harness/`). Capa automática **verde** (typecheck + 26/26 tests + build).
> La condición para **GO pleno** se reduce ahora a **una sola corrida manual en vivo** del
> founder (login real + firma + tx testnet + persistencia). Ver **§10**.

## 0. Resumen del veredicto

**GO con condición.** La evidencia **documental oficial es concluyente y favorable**: Celo 42220 es
una red soportada de fábrica por Privy, embedded wallets EVM con auto-creación, integración wagmi
drop-in, y **sin RPC propio requerido** para MVP. La **condición** es puramente operativa y humana:
el founder debe (a) crear la app de desarrollo en el dashboard, (b) allowlistear dominios, (c) habilitar
Google + email, y (d) opcionalmente correr el harness aislado de §4. **No se detectó ninguna
restricción bloqueante de plan ni incompatibilidad de stack.**

> Por qué "con condición" y no "GO" pleno: las secciones de **dashboard (§3)** y **prueba de login en
> vivo (§4)** requieren credenciales humanas (app-id real + navegador) que el agente no posee. La parte
> verificable sin credenciales (documental + stack) es **GO**. El cierre a GO pleno depende de esos 4
> pasos manuales, ninguno de los cuales tiene riesgo conocido de fallar.

---

## 1. Configuración evaluada

| Ítem | Valor objetivo |
|---|---|
| Chain | Celo Mainnet, `42220` (viem `celo`) |
| `defaultChain` | `celo` |
| `supportedChains` | `[celo]` (MVP; se puede añadir `celoAlfajores`/`celoSepolia` para testnet) |
| Embedded wallet | EVM, auto-creada al login |
| `createOnLogin` | `'users-without-wallets'` |
| Login | Google + Email |
| Integración | `@privy-io/wagmi` `createConfig` (drop-in de wagmi) |
| Firma / envío | mensaje + `ERC20.transfer` en Celo (paridad con `usePaymentRail`) |
| RPC | Default de Privy (override opcional a futuro) |

---

## 2. Evidencia documental (consultada 2026-07-23)

| Afirmación | Estado | Fuente |
|---|---|---|
| **Celo 42220 soportado** (tabla de redes por defecto, marcado como Supported) | ✅ Confirmado | [Configuring EVM networks](https://docs.privy.io/basics/react/advanced/configuring-evm-networks) |
| Cualquier chain EVM-compatible es configurable | ✅ | idem |
| `defaultChain` (chain único) + `supportedChains` (array) con objetos viem | ✅ | idem |
| Error si `supportedChains: []` o si `defaultChain` no está en `supportedChains` | ✅ (nota de config) | idem |
| **RPC propio NO requerido**; Privy trae RPC default (límites "generosos" para dev y uso moderado); override vía `addRpcUrlOverrideToChain` de `@privy-io/chains` | ✅ | idem |
| Embedded wallets auto-creadas: `embeddedWallets.ethereum.createOnLogin: 'users-without-wallets'` | ✅ | [Automatic wallet creation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation) |
| **wagmi/viem oficial** — `createConfig` de `@privy-io/wagmi` es drop-in de wagmi; Privy patrocina wagmi | ✅ | [Integrating with wagmi](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi) |
| Server-side verification — `@privy-io/server-auth` `verifyAuthToken` (access tokens) | ✅ | [Verifying the access token](https://docs.privy.io/guide/server/authorization/verification) |
| **Plan:** free < 499 MAU; core $299/mo hasta 2.5k MAU; incluye 50k firmas + $1M volumen/mes; embedded wallets NO gated por plan | ✅ | [Privy pricing](https://www.privy.io/pricing) |

**Conclusión documental:** todos los requisitos del objetivo están cubiertos por documentación oficial
vigente. Ninguna afirmación quedó sin fuente. Celo es de primera clase, no un caso "custom" frágil.

> Nota de firma en Celo: la doc no publica una página específica "embedded wallet firma en Celo", pero
> (a) la embedded wallet expone una address EVM estándar y firma/envía en cualquier chain soportada, y
> (b) Celo está en la lista soportada. El **único** ítem que conviene cerrar con evidencia empírica es la
> firma+envío real en 42220 (o testnet Celo) — de ahí el harness de §4.

---

## 3. Evidencia del dashboard — ⏳ PENDIENTE (requiere founder)

No ejecutado por el agente: requiere login humano al dashboard de Privy. Checklist para el founder:

- [ ] Crear/seleccionar app **de desarrollo** "Chesscito Dev" (no usar credenciales de prod).
- [ ] Confirmar que **Celo Mainnet** puede añadirse a supported chains (o dejar el default que ya lo incluye).
- [ ] Habilitar **Google** login.
- [ ] Habilitar **Email** login.
- [ ] Política de embedded wallet = crear para usuarios sin wallet (`users-without-wallets`).
- [ ] **Allowed domains / callback URLs**: `localhost:3000` (dev) + dominio de preview cuando aplique.
      Sin esto, el SDK rechaza el origin. (Alinea con el gate de Origin ya conocido de MiniPay/PRO.)
- [ ] Revisar **recovery** (email/social) y **export wallet** habilitados.
- [ ] Anotar límites del plan free (< 499 MAU) — suficiente para dev/MVP.
- [ ] Guardar `NEXT_PUBLIC_PRIVY_APP_ID` **solo en `.env` local** (gitignored). Nunca en Git/docs/logs.

> El `appId` de Privy es un identificador público client-side (va en `NEXT_PUBLIC_`), NO un secreto de
> servidor. El secreto real es el **Privy app secret** (server-auth) — ese jamás sale del `.env` server-side.

---

## 4. Prueba mínima aislada — ⏳ PENDIENTE (harness listo, requiere app-id)

No ejecutada: requiere `appId` real + navegador con login. **No se agregó código al repo** (respeta
"detente después del documento y el issue" + "no modificar código productivo"). Harness reproducible,
**fuera del provider tree productivo** (proyecto scratch separado o carpeta throwaway, no `apps/web`):

**Flujo objetivo:**
```
login Google/email → embedded wallet creada → address EVM disponible
→ chain 42220 seleccionada → firma de mensaje → tx de prueba en testnet Celo
```

**Setup (scratch, NO en apps/web):**
- Deps: `@privy-io/react-auth`, `@privy-io/wagmi`, `wagmi`, `viem`, `@tanstack/react-query`.
- Provider (aislado):
  ```tsx
  <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={{
    defaultChain: celoAlfajores,               // testnet para la prueba
    supportedChains: [celoAlfajores, celo],
    loginMethods: ['google', 'email'],
    embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
  }}>
    <WagmiProvider config={createConfig({        // @privy-io/wagmi
      chains: [celoAlfajores, celo],
      transports: { [celoAlfajores.id]: http(), [celo.id]: http() },
    })}>…</WagmiProvider>
  </PrivyProvider>
  ```
- Pasos a verificar: `useWallets()` expone address 0x…; `useSignMessage()` firma; una tx trivial en
  **testnet Celo** (self-transfer de 0 value, o faucet CELO) confirma envío.

**Prohibido en la prueba:** compras reales, claims, Welcome Pack, PRO, Peones, transferencias al treasury,
mainnet con valor. Preferir **testnet Celo (Alfajores/Sepolia)**.

**No debe tocar:** `WalletProvider` actual, rama MiniPay, pagos, entitlements, prod, migraciones, tablas.

---

## 5. Limitaciones detectadas

- **Firma en Celo sin evidencia empírica propia** — cubierta por doc + naturaleza EVM estándar; se cierra
  con §4. Bajo riesgo.
- **Dashboard no auto-verificable** — depende de acción humana (§3). Sin riesgo técnico, solo operativo.
- **Origin/domain allowlist** — Privy rechaza orígenes no listados; hay que mantener la lista por entorno
  (dev/preview/prod), igual que ya se hace con otros gates de Origin del proyecto.
- **RPC default con rate limits** — suficiente para dev y "uso moderado"; a escala conviene override con
  RPC propio (Forno/Ankr/dRPC). No bloquea el MVP.

---

## 6. Costos / restricciones

| Concepto | Detalle |
|---|---|
| Plan free | < 499 MAU — cubre dev + primeros usuarios del MVP. |
| Core | $299/mo hasta 2.5k MAU; incluye 50k firmas + $1M volumen/mes. |
| Usage-based | Sobre 10k MAU / 50k firmas / $1M volumen → facturación por uso. |
| Embedded wallets | Incluidas en core features, **no gated por plan**. |
| RPC propio | Opcional; costo solo si se contrata proveedor a escala. |
| Bloqueantes | **Ninguno** detectado para el caso Chesscito. |

---

## 7. Resultado del gate

### ✅ GO con condición

**Confirmado (documental + stack):** Celo 42220 soportado · embedded wallet EVM con auto-creación ·
address expuesta · integración wagmi/viem drop-in · sin RPC propio requerido · sin restricción de plan
bloqueante.

**Condición para GO pleno (4 pasos manuales, sin riesgo técnico conocido):**
1. Crear app dev en dashboard (§3).
2. Habilitar Google + Email + allowlist de dominios.
3. Confirmar embedded wallet policy.
4. (Recomendado) correr harness §4 en testnet Celo → evidencia empírica de firma+envío.

**NO-GO** solo si al ejecutar §3–§4 aparece: Celo no configurable en la app real, la embedded wallet no
firma en Celo, o el plan bloquea el caso. **Ninguno es esperable según la doc.**

---

## 8. Requisitos para el primer PR (slice `WebWalletProvider`)

Se habilita **solo tras cerrar la condición de §7**. El PR debe:
1. Añadir deps: `@privy-io/react-auth`, `@privy-io/wagmi` (y `@privy-io/chains` si se usa RPC override).
2. Crear `WebWalletProvider` (Privy + `@privy-io/wagmi` `createConfig`, mismos chains/transports que hoy),
   **paralelo** a `WalletProvider`; rama MiniPay **byte-idéntica**.
3. Bifurcación root: `isMiniPayEnv() ? <WalletProvider> : <WebWalletProvider>`.
4. Feature flag **`NEXT_PUBLIC_PRIVY_ENABLED`** (off en prod). Con flag off, comportamiento actual intacto.
5. **Cero cambios** en features (consumen `useAccount()`/wagmi igual), pagos, entitlements, migraciones.
6. Tests: (a) MiniPay sin regresión; (b) web branch expone address de Privy a `usePaymentRail`;
   (c) guest sin login progresa local; (d) flag off = árbol actual.
7. Env nuevas documentadas en `.env.template`: `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_ENABLED`,
   y (server) `PRIVY_APP_SECRET` si se agrega `verifyAuthToken`.

---

## 9. Secretos / acciones manuales del founder

- [ ] **Dashboard §3** completo (crear app dev, Google+email, dominios, embedded policy, recovery/export).
- [ ] Colocar `NEXT_PUBLIC_PRIVY_APP_ID` en `.env` local (gitignored). **Es público (client-side), pero
      igual va solo en `.env`**, nunca en Git/docs/logs.
- [ ] **`PRIVY_APP_SECRET`** (server-auth) — secreto real, solo server-side, jamás `NEXT_PUBLIC_`, jamás en Git.
- [ ] (Opcional) correr harness §4 en testnet Celo y pegar el resultado (address + txHash testnet) acá.
- [ ] Confirmar dominios de preview/prod cuando el slice llegue a esos entornos.

> El agente NO puede ejecutar §3 ni §4 (requieren credenciales humanas). Todo lo verificable sin
> credenciales quedó cerrado y es favorable.

---

## 10. Prueba empírica — harness aislado (`tools/privy-celo-harness/`)

**Fecha:** 2026-07-23 · **Entorno:** local dev (Vite + rolldown-vite), macOS, Node v20.19.5, pnpm 8.10.0.
**Ubicación:** `tools/privy-celo-harness/` — **fuera** de `apps/web/` y fuera del pnpm workspace
(`pnpm-workspace.yaml` globa `apps/*`). No importa ni modifica código productivo.

### 10.1 Stack resuelto (instalado)

`@privy-io/react-auth@2.25.0` · `@privy-io/wagmi@1.0.6` · `wagmi@2.19.5` · `viem@2.46.3` ·
`@tanstack/react-query@5.90.21` · React 18.3.1 · Vite 7 (alias `rolldown-vite`, para compat con
`@vitejs/plugin-react@6`) · Vitest 4.1.4. Chains = `celo` / `celoSepolia` de `wagmi/chains` (no
declaradas a mano). Config Privy: `loginMethods: ["google","email"]`, `defaultChain: celoSepolia`,
`supportedChains: [celoSepolia, celo]`, `embeddedWallets.ethereum.createOnLogin: "users-without-wallets"`.

### 10.2 Evidencia AUTOMÁTICA (✅ ejecutada por el agente)

| Check | Resultado |
|---|---|
| `pnpm run typecheck` (`tsc --noEmit`) | ✅ limpio |
| `pnpm run test` (Vitest) | ✅ **26/26** en 3 archivos |
| `pnpm run build` (`tsc --noEmit && vite build`) | ✅ build OK (warning cosmético de chunk-size del bundle Privy/wagmi) |
| Aislamiento — sin imports de `apps/web` / alias `@/` | ✅ enforced por `guards.test.ts` |
| Sin lectura de `PRIVY_APP_SECRET` | ✅ enforced por `guards.test.ts` (única env var: `VITE_PRIVY_APP_ID`) |
| Guard anti-mainnet (`assertTestnetForSend` throw en 42220) | ✅ test dedicado |
| Gating de firma/envío (sólo con wallet lista) | ✅ tests de estado |

Los 7 casos de prueba pedidos están cubiertos: (1) sin App ID → error claro; (2) no autenticado → sin
address ni botones activos; (3) autenticado sin wallet → loading; (4) wallet lista → address visible;
(5) nunca envía en mainnet (guard + botón deshabilitado si chain ≠ testnet); (6) ninguna var
`PRIVY_APP_SECRET` leída; (7) ninguna ruta/feature productiva importada.

### 10.3 Evidencia EMPÍRICA (⏳ pendiente — requiere corrida en vivo del founder)

Rellenar tras correr el checklist §10.4. No pegar tokens de sesión, private keys, OTP ni cookies.

| Campo | Valor |
|---|---|
| App ID (enmascarado, p.ej. `clab…7890`) | `________` |
| Login probado (google/email) | `________` |
| Address embedded (testnet) | `0x________` |
| Firma (truncada, `0x… …`) | `________` |
| Tx hash (testnet) | `0x________` |
| Chain ID conectado | esperado `11142220` (celoSepolia) |
| Persistencia (misma cuenta → misma address) | `sí / NO (blocker)` |
| Errores encontrados | `________` |

### 10.4 Checklist de validación manual (founder)

1. `cp .env.example .env.local` y setear `VITE_PRIVY_APP_ID=<App ID dev>`.
2. `pnpm install --ignore-workspace` (o `npm install`).
3. `pnpm run dev`.
4. Abrir la URL `localhost` impresa.
5. **Login** con Google (o email).
6. Confirmar **address** y wallet type `embedded (privy)`.
7. **Sign test message** → firma sin error.
8. **Ensure Celo testnet** → chain conectado == `11142220`.
9. Si falta gas, fondear desde el **faucet oficial** https://faucet.celo.org (red Celo Sepolia). No
   automatizar faucets; nunca fondos mainnet.
10. **Send 0 CELO to self (testnet)** → aparece tx hash; receipt resuelve.
11. Copiar address, signature y tx hash a §10.3.
12. **Logout → Login** con la misma cuenta Google → confirmar **misma address**. Si cambia → **blocker**, detener.

### 10.5 MiniPay / producción intactos (✅ evidencia)

- Harness vive en `tools/privy-celo-harness/`; `git status` sólo muestra cambios en `tools/` y este doc.
- `WalletProvider`, root providers, rama MiniPay, pagos, entitlements, Season Pass, PRO, Peones,
  Welcome Pack, rewards, migraciones y prod **no fueron tocados**.
- El aislamiento está **machine-checked** (`guards.test.ts`), no sólo por convención.

### 10.6 Veredicto provisional

**GO con condición** — condición reducida a **una corrida manual en vivo** (§10.4). La capa automática
del harness es concluyente: el stack Privy + `@privy-io/wagmi` + wagmi/viem compila, instala y opera con
`celo`/`celoSepolia` sin incompatibilidad. Al completar §10.3 con éxito (wallet creada, address persiste,
firma OK, tx testnet enviada) → **GO pleno**. Si la address cambia entre sesiones o no puede firmar/operar
en Celo → **NO-GO** (no esperable según la doc y el harness verde).
