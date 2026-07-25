# Privy Web Access — release final

> **Fecha:** 2026-07-25 · **Estado:** listo para merge + deploy. **Producción NO tocada.**
> El merge y el deploy los hace el founder.
> Rama: `feat/privy-shared-session-disconnect` (2 commits sobre `main`).

Camino elegido, justificado por el tráfico actual (founder + pocos dispositivos +
rollback en minutos):

```text
merge → producción directamente con Privy ON → smoke inmediato → rollback con flag OFF si falla
```

La sesión cross-subdominio **solo puede validarse en producción**: las HttpOnly
cookies están configuradas en la app Privy Production con base domain
`chesscito.com`, y ese App ID por diseño **no funciona fuera de producción**.

---

## 1. Qué contiene la rama

| Pieza | Estado | Dónde |
|---|---|---|
| Infraestructura Privy | ✅ ya en `main` | `web-wallet-provider.tsx`, `wallet-provider-boundary.tsx`, `wallet-branch.ts`, `web-transports.ts` |
| `WebAccessGate` | ✅ ya en `main` | `web-access-gate.tsx`, `web-access-state.ts` |
| Disconnect con logout Privy | ✅ **`de528ac`** (esta rama) | `lib/wallet/wallet-session.tsx`, `PrivyWalletSession` |
| Provider parity | ✅ **`38e39f9`** (esta rama) | `components/product-context-providers.tsx` |

```text
38e39f9  refactor(wallet): share the product contexts across both wallet branches
de528ac  feat(wallet): end the real Privy session from Disconnect
```

Diff contra `main`: 14 archivos, +1246 / −24. Working tree limpio salvo dos
archivos ajenos al slice (`SESSION.md`, `docs/audits/2026-07-18-theme-runtime-inventory.json`,
que regeneran los tests) — **no van en el merge**.

### Árbol que se despliega

```text
injected (MiniPay)                web (Privy)
──────────────────                ───────────
WagmiProvider                     PrivyProvider
└ QueryClientProvider             └ QueryClientProvider
  └ WalletProviderInner             └ WagmiProvider
    └ ProductContextProviders         └ PrivyWalletSession
      └ children                        └ WebAccessGate
                                          └ ProductContextProviders
                                            └ children
```

---

## 2. Suites y build

Corridos sobre el árbol exacto que se mergea:

```text
typecheck (tsc --noEmit)      limpio
tests focalizados             29/29  (5 archivos del slice)
suite completa apps/web       5822 passing / 519 files · exit 0
next build                    exit 0 · 110/110 páginas · 89.1 kB shared
```

> El exit code está verificado, no inferido del conteo: una suite 100 % verde
> puede salir non-zero por `Unhandled Errors`. Acá salió **0**.

---

## 3. App ID — Learn y Play deben usar exactamente el mismo

**Confirmado en código:** hay **una sola** lectura de cada variable, y ninguna en
`apps/landing`:

```text
NEXT_PUBLIC_PRIVY_APP_ID   → web-wallet-provider.tsx:38   (única)
NEXT_PUBLIC_PRIVY_ENABLED  → wallet-provider-boundary.tsx:14 (única)
apps/landing               → no lee ninguna de las dos
```

Learn y Play son **el mismo build** de `apps/web`, desplegado dos veces; difieren
solo en `NEXT_PUBLIC_CHESSCITO_MODE`. Por lo tanto:

- **mismo App ID ⇒ misma base de usuarios ⇒ misma embedded wallet ⇒ misma sesión**
  (la cookie de `.chesscito.com` cubre ambos subdominios);
- **App IDs distintos ⇒ dos cuentas y dos wallets para la misma persona.** No es
  un detalle de configuración: es pérdida de identidad del usuario.

La config de la embedded wallet (`loginMethods`, `defaultChain`,
`supportedChains`, `createOnLogin`) está **hardcodeada** en un único componente
que ambos deploys compilan, así que no puede divergir por env.

### Pre-deploy — leer los valores, no recordarlos

```text
[ ] learn → NEXT_PUBLIC_PRIVY_APP_ID   = <Production App ID>
[ ] play  → NEXT_PUBLIC_PRIVY_APP_ID   = <el MISMO, carácter por carácter>
[ ] learn → NEXT_PUBLIC_PRIVY_ENABLED  = true
[ ] play  → NEXT_PUBLIC_PRIVY_ENABLED  = true
[ ] redeploy de AMBOS (NEXT_PUBLIC_* se inlinea en build: sin redeploy no existe)
```

⛔ **Los dos subdominios o ninguno.** Con el flag prendido en uno solo, el otro
sigue en la rama `injected` y, en un browser sin wallet inyectada, queda sin
address: producto roto en el subdominio rezagado.

⚠️ **Si `NEXT_PUBLIC_PRIVY_APP_ID` falta o tiene un typo** con el flag en `true`,
`requirePrivyAppId()` lanza **al montar**: pantalla rota para todo usuario web de
ese deploy. MiniPay no se ve afectado (nunca monta esa rama). Síntoma: el error
aparece de entrada, no tras el login.

---

## 4. Smoke productivo

Inmediatamente después del redeploy, con los dispositivos disponibles.

### A — Sesión compartida (el corazón del release)

| # | Paso | Esperado |
|---|---|---|
| A1 | Perfil limpio → `learn.chesscito.com` | `WebAccessGate` |
| A2 | Login (Google o email) | Entra al Hub |
| A3 | Anotar address + Chesscito ID en Learn | — |
| A4 | Abrir `play.chesscito.com`, misma sesión de browser | Entra directo, **sin gate** |
| A5 | **Misma address** en Play | Idéntica a A3 |
| A6 | **Misma identidad** (Chesscito ID / avatar) | Idéntico a A3 |
| A7 | DevTools → Application → Cookies | Cookie con domain `.chesscito.com` |

🔴 **A5 es gate rojo.** Dos addresses distintas = wallet duplicada por usuario →
**rollback inmediato**, sin diagnosticar en vivo.

### B — Contextos de producto (lo que arregló el parity)

| # | Paso | Esperado |
|---|---|---|
| B1 | **Theme** en Learn y en Play | El tier se resuelve; ningún asset cae a placeholder |
| B2 | **Training Pass** en Learn y en Play | El estado del pass se lee igual en ambas |

⚠️ Antes de `38e39f9` la rama Privy no montaba estos contextos. Son el punto más
probable de falla si algo salió mal: **verificarlos explícitamente**, no asumirlos.

### C — Rails on-chain con embedded wallet

| # | Paso | Esperado |
|---|---|---|
| C1 | **Welcome Pack** | Reclamable (Privy firma) |
| C2 | **Peones** | El balance carga (lectura vía los transports web, no Forno solo) |

### D — Cierre de sesión

| # | Paso | Esperado |
|---|---|---|
| D1 | Account Sheet en Learn → **Disconnect** | `WebAccessGate` en Learn |
| D2 | Cookie de `.chesscito.com` | Ya no está |
| D3 | **Refresh de Play** | `WebAccessGate` |
| D4 | Volver a entrar | Progreso local y nick intactos |

ℹ️ Una pestaña de Play **ya abierta** no se entera del logout en vivo: no hay
canal cross-origin. Se entera al refrescar o reabrir (D3). Es el comportamiento
esperado, no un bug.

### E — MiniPay intacto (el camino que factura)

| # | Paso | Esperado |
|---|---|---|
| E1 | `learn.` dentro de MiniPay | Entra directo con la wallet MiniPay, **sin gate** |
| E2 | `play.` dentro de MiniPay | Igual |
| E3 | Account Sheet en MiniPay | **Sin** botón Disconnect |
| E4 | Un pago en MiniPay | Idéntico a antes |
| E5 | `chesscito.com` | Sin Privy, sin login |

---

## 5. Rollback

```env
NEXT_PUBLIC_PRIVY_ENABLED=false
```

en **Learn y Play**, seguido de **redeploy de ambos**.

Con el flag apagado `resolveWalletBranch` devuelve `injected` **incluso antes de
hidratar**: el árbol vuelve exactamente al de hoy — sin shell extra, sin remount,
`useWalletSignOut()` cae al `disconnect()` de wagmi y `ProductContextProviders`
se monta donde siempre estuvo. MiniPay nunca dependió de nada de esto.

Si el flag no alcanzara:

```text
nivel 2 → NEXT_PUBLIC_PRIVY_APP_ID = <App ID de desarrollo> + redeploy
          (Privy sigue, vuelve a localStorage, sesiones separadas por subdominio)
nivel 3 → HttpOnly cookies OFF en el dashboard de Privy
```

**Costo para el usuario:** volver a loguear. **No se pierde ninguna wallet** — la
embedded wallet vive en Privy atada al user ID, no en el navegador. Progreso local
y nick no se tocan en ningún nivel.

**DNS:** se quedan puestos. Sin la app apuntando a ellos son inertes, y sacarlos
obliga a re-esperar propagación si se reintenta. Única excepción: un CAA mal
cargado que rompa emisión de certificados — eso sí se revierte ya.

---

## 6. Deuda menor que deja este release

Dos comentarios quedan desactualizados en cuanto el flag se prenda —
**solo comentarios, cero efecto en runtime**, por eso no los toqué acá:

- `lib/wallet/wallet-branch.ts:12` — *"Off in production"*
- `components/web-wallet-provider.tsx` — *"the feature flag is meant to keep this
  tree off in production"*

Corregirlos en el primer commit posterior al release.
