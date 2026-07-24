# WebAccessGate — contrato técnico (paso 3, sin implementar aún)

> **Fecha:** 2026-07-24 · **Estado:** propuesta de contrato, **pendiente de OK**.
> Deriva de "Product decision override" en
> `docs/handoffs/2026-07-24-privy-web-infrastructure-handoff.md`.
> No implementa nada, no toca prod.

## 1. Punto de gateo (auditado)

- `WalletProviderBoundary` (`components/wallet-provider-boundary.tsx`) envuelve
  **todo** el layout (`app/[locale]/layout.tsx:145`).
- La rama web (`WebWalletProvider`) solo monta cuando
  `privyEnabled && hydrated && !isMiniPay` (`lib/wallet/wallet-branch.ts:44`).
- ⇒ El gate vive **dentro de `WebWalletProvider`**, envolviendo sus `children`,
  **dentro** de `PrivyProvider + WagmiProvider` (necesita hooks de Privy).
- **MiniPay nunca llega**: el resolver lo manda a `injected`, que no contiene el
  gate. La bypass es estructural, no una condición runtime.

```text
WebWalletProvider
  PrivyProvider
    QueryClientProvider
      WagmiProvider
        WebAccessGate            ← NUEVO
          → shell | gate | prep | children
```

## 2. SDD — tipos primero (máquina de estados pura)

Archivo nuevo `lib/wallet/web-access-state.ts` (pura, testeable sin montar Privy,
mismo patrón que `resolveWalletBranch`):

```ts
export type WebAccessState =
  | "environment-loading"   // privy.ready === false        → shell
  | "unauthenticated"       // !authenticated               → WebAccessGate CTA
  | "authenticating"        // login en vuelo               → estado de acceso
  | "wallet-pending"        // authed, embedded no listo     → "Preparing…"
  | "wallet-ready"          // authed + wallet lista         → children
  | "error";                // fallo de login/entorno        → retry + salidas

export type WebAccessInput = {
  ready: boolean;          // usePrivy().ready
  authenticated: boolean;  // usePrivy().authenticated
  walletReady: boolean;    // embedded wallet provista + address
  authenticating: boolean; // login() en curso
  error: boolean;
};

export function deriveWebAccessState(input: WebAccessInput): WebAccessState;
```

Precedencia de derivación (orden fijo): `error` → `!ready` (loading) →
`!authenticated` (unauth; `authenticating` si login en vuelo) → `!walletReady`
(pending) → `wallet-ready`.

## 3. Componente `WebAccessGate`

`components/web-access-gate.tsx`, `"use client"`.

```ts
type WebAccessSurface = "learn" | "play";
function WebAccessGate(props: {
  children: ReactNode;
  surface?: WebAccessSurface; // SOLO cambia el copy; default = base
}): JSX.Element;
```

- Lee Privy vía `usePrivy()` → `{ ready, authenticated, user, login, logout }`
  y la readiness de la embedded wallet vía `useWallets()` (wallet con
  `walletClientType === "privy"` **y** address). ⚠️ **Firmas exactas del SDK
  `@privy-io/react-auth 2.25.0` se verifican contra docs antes de GREEN** — el
  contrato asume la superficie estable, no la fija.
- CTA principal `ENTER CHESSCITO` → `login()` (abre el modal **nativo** de Privy;
  métodos ya configurados en `WebWalletProvider`: `["email","google"]`). **No** se
  construyen flujos propios de Google/email.
- Copy (una sola mecánica, solo varía el texto):

```text
base:  "Every journey needs a key."
       "Sign in and your Chesscito wallet will be created automatically."
nota:  "No wallet setup required."
learn: "Unlock your learning journey"
play:  "Enter the Chesscito arena"
```

- `error` renderiza: `Try again` (retry) · `Open in MiniPay` · `Back to
  chesscito.com`.
- `wallet-pending` renderiza: `Preparing your Chesscito wallet…`.
- Los copys van a `lib/content/editorial.ts` (⚠️ techo 0 em-dashes) o su módulo
  de contenido; **no** hardcodear en el componente.

## 4. Cambio en `WebWalletProvider`

```diff
-        <WagmiProvider config={webWagmiConfig}>{children}</WagmiProvider>
+        <WagmiProvider config={webWagmiConfig}>
+          <WebAccessGate>{children}</WebAccessGate>
+        </WagmiProvider>
```

`WalletProvider` (MiniPay) queda **byte-idéntico**.

## 5. Analytics

Vía `track()` de `lib/telemetry.ts` (anónimo, sin PII por construcción — solo
`session_id` anónimo + nombre de evento). Se emiten en transiciones:

```text
web_access_gate_viewed  → al entrar a "unauthenticated"
web_login_started       → al invocar login()
web_login_succeeded     → transición authenticated=false→true
web_wallet_ready        → transición walletReady=false→true
web_login_failed        → al entrar a "error"
```

Props: como mucho `{ surface }`. **Nunca** email · nombre social · address ·
tokens · errores crudos.

## 6. Migración de progreso previo (sin sistema nuevo)

Tras login, el progreso local previo migra a la wallet activa con el mecanismo
**existente** (`use-exercise-progress` / `lib/exercises/guest-session`, regla
"connected wallet always wins"). El gate **no** crea migración; solo garantiza
que al llegar a children ya hay address. Guest deja de ser modo permanente.

## 7. Plan de tests RED→GREEN

Unitarios sobre `deriveWebAccessState` (1–9 sin montar Privy) + de componente
(mock de `usePrivy`/`useWallets`) para render:

| # | Test | Nivel |
|---|---|---|
| 1 | MiniPay bypassa el gate (resolver→injected, sin WebAccessGate) | resolver/árbol |
| 2 | web no autenticada ve el gate | componente |
| 3 | web no autenticada no renderiza children | componente |
| 4 | sesión restaurada + wallet ready entra directo | derive + componente |
| 5 | authed sin wallet muestra preparación | derive + componente |
| 6 | error permite retry | componente |
| 7 | error ofrece volver a chesscito.com | componente |
| 8 | error ofrece abrir MiniPay | componente |
| 9 | no existe guest CTA (ninguna variante lo renderiza) | componente |
| 10 | Learn y Play usan el MISMO componente (solo cambia copy) | componente |
| 11 | chesscito.com no monta Privy | ver §8 (pendiente de topología) |
| 12 | ningún evento contiene PII | analytics |
| 13 | pagos/entitlements intactos | regresión (rail sin tocar) |

## 8. Topología de dominios (DECIDIDA — founder 2026-07-24)

Deploys/apps **separados** por subdominio. **No** hay routing por hostname; **no**
se deriva `surface` desde `window.location`.

```text
chesscito.com     → apps/landing  → descubrimiento y elección → SIN Privy
learn.chesscito.com → apps/web (deploy con CHESSCITO_MODE=learn) → WebAccessGate
play.chesscito.com  → apps/web (deploy con CHESSCITO_MODE=play)  → WebAccessGate
```

### `surface` desde el build-mode existente (no crear variable nueva)

Fuente de verdad canónica: `CHESSCITO_MODE` (`lib/feature-flags.ts:34`,
`isLearnMode()`/`isPlayMode()`). El boundary/provider deriva `surface` del modo
y lo pasa como prop; el componente **no** lee env ni host:

```ts
type ProductSurface = "learn" | "play";
// learn → "learn" · play → "play" · full (interno) → copy base (default)
```

### Test #11 — separación estructural (target: `apps/landing`)

En vez de "no monta Privy en runtime", se valida por **imports**:

1. `apps/landing` no importa `@privy-io/react-auth`.
2. `apps/landing` no importa `@privy-io/wagmi`.
3. `apps/landing` no importa `WebWalletProvider`.
4. `apps/landing` no importa `WebAccessGate`.
5. `apps/landing` no lee variables Privy (`NEXT_PUBLIC_PRIVY_*`).
6. Los CTA de landing apuntan a Learn y Play (`learn.` / `play.` chesscito.com).

**No** cambiar la arquitectura de deployments ni añadir routing por hostname.
