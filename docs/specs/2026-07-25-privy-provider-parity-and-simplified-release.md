# Provider parity + release simplificado — Privy Web Access

> **Fecha:** 2026-07-25 · **Estado:** parity cerrado en código. **Producción NO tocada.**
> La activación final la hace el founder.
> Sustituye el flujo por etapas de `2026-07-25-privy-shared-session-release-checklist.md`
> por el camino simplificado que corresponde al tráfico actual (founder + pocos
> dispositivos + rollback rápido). Los contratos de validación no se relajan.

---

## 1. Resultado de provider parity

### 1.1 Árbol anterior

```text
injected                          web (Privy)
────────                          ──────────
WagmiProvider                     PrivyProvider
└ QueryClientProvider             └ QueryClientProvider
  └ WalletProviderInner             └ WagmiProvider
    └ EffectiveTrainingPassProvider   └ PrivyWalletSession
      └ ThemeVariantProvider            └ WebAccessGate
        ├ ProOriginWarning                 └ children   ← sin contextos
        └ children
```

### 1.2 Qué existía solo en la rama injected

| Componente | ¿Depende de `useAccount().address`? | Clasificación |
|---|---|---|
| `EffectiveTrainingPassProvider` | **Sí** — `use-season-pass-status.ts:284` | contexto funcional |
| `ThemeVariantProvider` | **Sí**, indirecto — `useEffectiveThemeTier` → `useEffectiveThemePresentation` → `useAccount()` (`use-effective-theme-tier.ts:84`) | contexto funcional |
| `ProOriginWarning` | No | **dev-only** — retorna `null` salvo `NODE_ENV === "development"` |

**No falta ningún otro.** El layout (`app/[locale]/layout.tsx`) monta
`NextIntlClientProvider` y el boundary por fuera de las dos ramas, así que i18n ya
era común. `QueryClientProvider` existía en ambas ramas (instancias separadas, una
por rama — correcto, cada árbol tiene su ciclo de vida).

`ProOriginWarning` no es un provider, pero viajaba dentro del mismo bloque. Lo
moví con ellos para que la extracción sea fiel: en producción renderiza `null`,
así que su único efecto es dar paridad también en dev local.

### 1.3 ¿Deben montar solo con la wallet lista?

**Sí, en la rama Privy.** Los dos son wallet-scoped. Montarlos fuera del gate los
haría correr para un visitante sin sesión ni address — justo el estado que el gate
existe para no dejar pasar. Por eso el wrapper va **dentro** de `WebAccessGate`,
que solo renderiza children en `authenticated + wallet ready`.

En la rama injected no aplica: ahí no hay gate y la address llega cuando el
connector resuelve, igual que siempre.

### 1.4 Árbol resultante

```text
injected                          web (Privy)
────────                          ──────────
WagmiProvider                     PrivyProvider
└ QueryClientProvider             └ QueryClientProvider
  └ WalletProviderInner             └ WagmiProvider
    └ ProductContextProviders         └ PrivyWalletSession
      └ children                        └ WebAccessGate
                                          └ ProductContextProviders
                                            └ children
```

`ProductContextProviders` (`src/components/product-context-providers.tsx`) es una
**extracción literal**, no una reescritura: mismo orden, misma lógica interna,
cero providers nuevos. El orden es load-bearing — el tier visual se deriva del
pass, así que `ThemeVariantProvider` va adentro.

---

## 2. Commit

```text
rama:   feat/privy-shared-session-disconnect
commits: de528ac  Disconnect termina la sesión Privy real
         <parity> provider parity entre las dos ramas
```

Archivos del slice de parity:

| Archivo | Cambio |
|---|---|
| `src/components/product-context-providers.tsx` | **nuevo** — el wrapper compartido |
| `src/components/wallet-provider.tsx` | usa el wrapper (árbol renderizado idéntico) |
| `src/components/web-wallet-provider.tsx` | monta el wrapper dentro del gate |
| `src/components/__tests__/product-context-parity.test.tsx` | **nuevo** — 9 tests |
| `src/lib/themes/__tests__/provider-tree-invariant.test.ts` | el invariante sigue al wrapper |
| `src/components/__tests__/web-wallet-provider.test.tsx` | stub del wrapper |

---

## 3. Suites

```text
typecheck                     limpio
tests focalizados             29/29 (5 archivos)
suite completa apps/web       5822 passing / 519 files · exit 0
build de producción           next build exit 0 · 110/110 páginas · 89.1 kB shared
```

**Smoke local:** el build de producción es lo verificable sin credenciales. El
smoke interactivo (login, sesión cross-subdominio, misma wallet) exige un App ID
real y un browser con sesión — es el §4, y lo corre el founder en preview.

Cobertura de los 8 tests pedidos:

| # | Pedido | Dónde |
|---|---|---|
| 1 | MiniPay sigue montando ambos | `branch parity` → wrapper 1× en `wallet-provider` |
| 2 | Privy wallet-ready monta ambos | `unauthenticated web` → "mounts them once the wallet is ready" |
| 3 | Privy no autenticada no monta contextos | `unauthenticated web` → primer test |
| 4 | Theme igual en ambas ramas | por construcción: **el mismo componente** en las dos ramas + probe de `useThemeVariant()` |
| 5 | Training Pass igual en ambas ramas | idem |
| 6 | Una sola instancia de cada provider | `ProductContextProviders` → conteo + orden |
| 7 | Flag OFF conserva legacy | `wallet-branch.test.ts` (existente) + `wallet-session.test.tsx` |
| 8 | Payment rail y entitlements intactos | `blast radius` + `touches no payment or entitlement logic` |

> **Honestidad sobre 4 y 5:** no re-testeo la lógica interna de los providers —
> las reglas lo prohíben explícitamente y ya tienen sus propias suites. Lo que
> pruebo es que **ambas ramas montan el mismo componente**, que es lo que hace
> que no puedan divergir.

---

## 4. Checklist de preview

Con `NEXT_PUBLIC_PRIVY_ENABLED=true` y el App ID de **desarrollo** en los previews
de Learn y Play.

| # | Qué | Esperado |
|---|---|---|
| P1 | Abrir preview de Learn, perfil limpio | `WebAccessGate` |
| P2 | Login (Google / email) | Entra al Hub |
| P3 | Anotar user ID + address | — |
| P4 | Abrir preview de Play, misma sesión | Entra directo, **sin gate** |
| P5 | Comparar identidad | **Misma** address, mismo Chesscito ID |
| P6 | **Theme** en ambas | El tier se resuelve; ningún asset cae a placeholder |
| P7 | **Training Pass** en ambas | El estado del pass se lee igual en las dos |
| P8 | **Welcome Pack** | Reclamable con la embedded wallet (firma) |
| P9 | **Peones** | El balance carga (lectura on-chain vía transports web) |
| P10 | **Disconnect** en Learn | Gate en Learn; refrescar Play → gate |
| P11 | **MiniPay** sobre el preview | Entra directo, sin gate, **sin** botón Disconnect |
| P12 | `chesscito.com` | Sin Privy, sin login |

🔴 **P5 es gate rojo.** Dos addresses distintas = wallet duplicada por usuario.
No avanzar a producción.

⚠️ **P6 y P7 son los que este slice acaba de arreglar.** Antes del parity, la rama
Privy no montaba esos contextos: eran exactamente los que iban a fallar en
producción sin que ningún test lo dijera.

---

## 5. Checklist de producción (simplificado)

Justificado por el contexto operativo: founder + pocos dispositivos + rollback en
minutos. **No** se hace el paso intermedio de deploy con flag OFF.

```text
1. Confirmar en Vercel, LEYENDO los dos valores:
     learn → NEXT_PUBLIC_PRIVY_APP_ID = <Production App ID>
     play  → NEXT_PUBLIC_PRIVY_APP_ID = <el MISMO valor, carácter por carácter>
     learn → NEXT_PUBLIC_PRIVY_ENABLED = true
     play  → NEXT_PUBLIC_PRIVY_ENABLED = true

2. Redeploy coordinado de Learn y Play.
   (NEXT_PUBLIC_* se inlinea en build: sin redeploy, el cambio no existe.)

3. Smoke inmediato con los dispositivos disponibles:
     login en Learn
     → abrir Play → sesión restaurada, sin gate
     → misma address en las dos
     → Theme y Training Pass resuelven
     → Disconnect en Learn → refrescar Play → gate
     → MiniPay entra directo, sin gate y sin Disconnect
     → chesscito.com sin login
```

**Reglas duras del release:**

- ⛔ No activar un solo subdominio. Los dos, o ninguno.
- ⛔ No usar App IDs distintos entre Learn y Play.
- 🔴 Si las addresses difieren → **rollback inmediato**, sin diagnosticar en vivo.
- ⛔ No tocar `chesscito.com`.

---

## 6. Rollback exacto

```text
learn → NEXT_PUBLIC_PRIVY_ENABLED=false
play  → NEXT_PUBLIC_PRIVY_ENABLED=false
+ redeploy de ambos
```

Con el flag apagado `resolveWalletBranch` devuelve `injected` **incluso antes de
hidratar**, así que el árbol vuelve exactamente al de hoy: sin shell extra, sin
remount, `useWalletSignOut()` cae al `disconnect()` de wagmi y
`ProductContextProviders` se monta donde siempre estuvo.

Si el flag no alcanzara:

```text
nivel 2 → NEXT_PUBLIC_PRIVY_APP_ID = <App ID de desarrollo> + redeploy
          (Privy sigue, vuelve a localStorage, sesiones separadas)
nivel 3 → HttpOnly cookies OFF en el dashboard de Privy
```

**Costo para el usuario:** volver a loguear. **No se pierde ninguna wallet** — la
embedded wallet vive en Privy atada al user ID, no en el navegador. Progreso local
y nick tampoco se tocan.

**DNS:** se quedan. Sin la app apuntando a ellos son inertes, y sacarlos obliga a
re-esperar propagación. Única excepción: un CAA mal cargado que rompa emisión de
certificados — eso sí se revierte ya.
