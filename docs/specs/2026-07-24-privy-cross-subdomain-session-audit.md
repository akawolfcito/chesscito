# Privy — sesión compartida entre `learn.` y `play.chesscito.com` · Auditoría Fase 1

> **Fecha:** 2026-07-24 · **Estado:** auditoría. **No toca producción, no habilita cookies.**
> **Objetivo:** una sola autenticación para todo Chesscito web. MiniPay intacto.
> **Fuentes Privy consultadas el 2026-07-24:** [Configure cookies](https://docs.privy.io/recipes/react/cookies) ·
> [Configuring cookies (guide)](https://docs.privy.io/guide/react/configuration/cookies) ·
> [Configure allowed URLs](https://docs.privy.io/recipes/dashboard/allowed-domains) ·
> [Security checklist](https://docs.privy.io/security/implementation-guide/security-checklist)

---

## 1. Diagnóstico de la sesión actual

### 1.1 Topología real (mejor de lo esperado)

**Learn y Play son el MISMO app** (`apps/web`), desplegado dos veces. Difieren en
`NEXT_PUBLIC_CHESSCITO_MODE`, no en código.

```text
apps/web  ──deploy A (mode=learn)──→ learn.chesscito.com
          ──deploy B (mode=play)───→ play.chesscito.com
apps/landing ────────────────────→ chesscito.com   (sin Privy, test lo verifica)
```

Consecuencias directas sobre los puntos 1–3 del pedido:

| # | Pregunta | Respuesta | Evidencia |
|---|---|---|---|
| 1 | App ID de Learn | `NEXT_PUBLIC_PRIVY_APP_ID` (una sola var) | `web-wallet-provider.tsx:36` |
| 2 | App ID de Play | La misma var, mismo valor | Confirmado por el founder: **mismo App ID, hoy en preview** |
| 3 | Misma config de embedded wallet | **Sí, por construcción** — la config es literal en el código, no por deploy | `web-wallet-provider.tsx:64-73` |

El punto 3 no depende de disciplina de dashboard: `loginMethods`, `defaultChain`,
`supportedChains` y `embeddedWallets.ethereum.createOnLogin` están hardcodeados en
**un único componente** que ambos deploys compilan. No pueden divergir.

Además, `WebAccessGate` deriva su copy de `resolveWebAccessSurface()` (build mode),
**nunca del hostname** (`web-access-gate.tsx:32`). No hay acoplamiento a dominio en
ninguna parte del árbol Privy.

### 1.2 Causa raíz confirmada

El código **no configura storage**: usa el default de Privy (access token en
`localStorage`), que está aislado por origen. `learn.` y `play.` son orígenes
distintos → dos sesiones independientes. No hay bug propio; es el modo por defecto.

### 1.3 Punto 4 — App Clients que sobrescriban orígenes

- El SDK recibe **solo `appId`** — no hay `clientId` en el código.
- La doc de allowed domains no documenta override de orígenes por app client:
  la config es a nivel app.
- **Riesgo residual:** que exista un segundo app/client creado a mano en el
  dashboard. → verificación manual del founder (§8).

### 1.4 Puntos 5 y 6 — configuración del SDK

- **Punto 5 (`PrivyProvider` para HttpOnly cookies): no requiere configuración adicional.**
  Ninguna de las cuatro páginas oficiales menciona `config.cookies`, `sameSite` ni
  ningún flag del provider. Las cookies se activan **en el dashboard**, y el cliente
  las hereda del App ID.
- **Punto 6 (`apiUrl`): NO configurar.** La doc no menciona `apiUrl` ni un subdominio
  Privy personalizado como parte del flujo de cookies. El mecanismo documentado es
  verificación de dominio por DNS, no un proxy en `auth.chesscito.com`. Configurar
  `apiUrl` a ciegas es riesgo neto sin beneficio documentado.

### 1.5 Punto 10 — MiniPay

**Impacto cero, garantizado por el resolver.**

```text
resolveWalletBranch: flag ON + isMiniPay → "injected"
```

MiniPay nunca monta `PrivyProvider` (`wallet-provider-boundary.tsx:45-51`), por lo
tanto nunca emite la request de sesión que lee la cookie. Que la cookie exista en
`.chesscito.com` es inerte para MiniPay: la cookie es de Privy y solo la consume el
cliente de Privy. El `wagmiConfig` de MiniPay sigue byte-idéntico y no comparte
transports.

### 1.6 ⚠️ Hallazgo bloqueante de alcance — no existe logout

```bash
grep -rn "logout" apps/web/src   # → 0 matches
```

**No hay `useLogout`, ni CTA de logout, ni ninguna ruta de código que cierre sesión.**
La segunda mitad del contrato esperado —

```text
logout en Learn → abrir/refrescar Play → sesión cerrada → WebAccessGate visible
```

— **no es verificable hoy**, porque el evento que la dispara no existe todavía.
Compartir la sesión es config; cerrarla requiere código nuevo (§3).

---

## 2. Configuración exacta del dashboard

**Se necesitan DOS apps Privy.** Esta es la restricción dura de la doc:

> *"Once you enable cookies, your production app ID will **only** work in your
> production environment, and will error in all other environments."*

Como el App ID actual **se usa hoy en preview**, activar cookies sobre él **rompe
preview**. No es opcional separar.

### App A — `Chesscito Production` (nueva, a crear)

```text
Configuration > App settings > Domains
  HttpOnly cookies:   ON
  Base domain:        chesscito.com          ← sin protocolo, sin www, sin subdominio

Allowed origins
  https://learn.chesscito.com
  https://play.chesscito.com
```

- `chesscito.com` es el **base domain de la cookie**, pero **no** se lista como
  allowed origin: la landing no monta Privy (invariante de producto).
- Un app = **un** cookie domain. No se puede tener dos.
- Lifetime de la cookie en producción: **30 días**.
- No listar dominios que no sean de producción.

### App B — `Chesscito Development` (la actual, la de preview)

```text
  HttpOnly cookies:   OFF        ← queda en localStorage, como hoy
  Allowed origins:    http://localhost:3000  (el puerto es obligatorio)
                      https://<subdominio-estable-de-preview>.chesscito.com
```

- ⚠️ **`*.vercel.app` está bloqueado deliberadamente** como allowed origin. Si preview
  hoy corre sobre una URL `*.vercel.app`, hay que mapearla a un subdominio estable de
  `chesscito.com` **antes** de que preview siga funcionando bajo reglas estrictas.
- Wildcards: solo `*.chesscito.com` (subdominio completo). `*-preview.chesscito.com`
  está prohibido.
- Lifetime en dev: 7 días. El App ID de dev setea cookie en cualquier dominio,
  incluido localhost.

### Mapeo de variables (Vercel)

| Deploy | `NEXT_PUBLIC_PRIVY_APP_ID` | `NEXT_PUBLIC_PRIVY_ENABLED` |
|---|---|---|
| Production Learn | App A | `true` (solo al ejecutar, no ahora) |
| Production Play | App A (**mismo valor**) | `true` (solo al ejecutar, no ahora) |
| Preview / dev | App B | `true` |

El nombre de la variable no cambia; cambia **el valor por entorno**. Cero código.

---

## 3. Cambios de código necesarios

### 3.1 Para compartir la sesión: **ninguno**

`web-wallet-provider.tsx` queda **intacto**. No se agrega `apiUrl`, no se agrega
`config.cookies`, no se toca `createWebWagmiConfig`, ni transports, ni el gate, ni
analytics. La sesión compartida es **100 % configuración de dashboard + DNS**.

Esto también significa: **el cambio es indistinguible del estado actual en el diff**.
No hay PR que revisar para la mitad "restore" del contrato.

### 3.2 Para cerrar la sesión: sí hace falta código (fuera de esta fase)

Para cumplir la segunda mitad del contrato hace falta, como slice aparte:

1. `useLogout()` de `@privy-io/react-auth` conectado a un CTA visible.
2. Decidir dónde vive (Account chip / gate error state).
3. Tests: post-logout el gate vuelve a aparecer.

**No lo implemento en esta fase** — el pedido es auditar y detenerse.

### 3.3 Comportamiento esperado de logout una vez exista (punto 8)

```text
logout() en Learn
  → Privy invalida la sesión server-side y limpia la cookie de .chesscito.com
  → Learn: gate inmediato (el estado de React reacciona)
  → Play, pestaña ya abierta:  ⚠️ NO se entera al instante
     (no hay canal cross-origin; localStorage events no cruzan subdominios)
  → Play, al refrescar / abrir de nuevo: sin cookie → unauthenticated → gate ✅
```

El contrato pedido dice *"abrir o refrescar Play"*, así que **se cumple tal como está
escrito**. Lo que NO ocurre es la expulsión en vivo de una pestaña ya abierta. Vale la
pena que el founder sepa que esa es la semántica real antes de escribir el test.

### 3.4 Comportamiento de refresh / sesión restaurada (punto 9)

Con cookies ON, al abrir `play.chesscito.com` sin `localStorage`:

```text
PrivyProvider monta → ready=false
  → el cliente presenta la cookie de .chesscito.com
  → sesión válida → authenticated=true, mismo user ID
  → embedded wallet ya existe → createOnLogin "users-without-wallets" NO crea otra
  → wagmi expone la misma address → deriveWebAccessState → "wallet-ready"
  → WebAccessGate renderiza children directo, sin mostrarse
```

La no-duplicación de wallet está garantizada por `createOnLogin:
"users-without-wallets"` (`web-wallet-provider.tsx:69`) + mismo user ID.

> ⚠️ Esto es la lectura de la doc, no una medición. La doc afirma que la cookie se
> setea *"only on the domain you have verified and any subdomains"*, pero **no
> documenta explícitamente el restore cross-subdominio paso a paso**. Se valida
> empíricamente en staging (§5) antes de declarar GO definitivo.

---

## 4. DNS y pasos manuales del founder

### 4.1 Lo que hay que hacer

1. Crear la app `Chesscito Production` en el dashboard.
2. `Configuration > App settings > Domains` → toggle HttpOnly cookies + ingresar
   `chesscito.com`.
3. **Privy muestra ahí los records exactos.** No los invento: el tipo y el nombre
   dependen de lo que el dashboard emita en ese momento.
4. Cargarlos en el registrar. Volver al dashboard → **Refresh**.
5. Esperar propagación (la doc dice que puede tomar **horas**).

### 4.2 Restricciones conocidas por doc

- **CAA en el root `chesscito.com`** (no en subdominios), incluyendo las autoridades
  **Let's Encrypt** y **Google Trust Services**.
  ⚠️ Si ya existen registros CAA, la operación es **aditiva** — reemplazarlos puede
  romper la emisión de certificados de los dominios actuales.
- **Cloudflare:** los records deben quedar en **"DNS Only"**, no Proxied, hasta que la
  verificación complete.

### 4.3 ⚠️ Riesgo a verificar antes de tocar DNS

`chesscito.com` (apex) **sirve la landing en Vercel**, así que su apex ya tiene records
activos. Si el record que pide Privy fuera un CNAME en el apex, colisiona con la
landing. **No asumir**: leer el tipo y el nombre exactos que muestre el dashboard y, si
cae sobre el apex, parar y reevaluar antes de aplicar.

---

## 5. Plan de prueba cross-subdomain

Ejecutar **con App A pero antes de exponerlo a usuarios**, en navegador real. Nada de
sondas que salteen la UI: el flujo tiene que pasar por el `WebAccessGate` real, porque
una sonda que se saltea lo que la UI exige mide un flujo imposible.

### Contrato A — sesión restaurada

| # | Paso | Esperado | Evidencia a capturar |
|---|---|---|---|
| A1 | Perfil limpio, abrir `learn.` | `WebAccessGate` visible | screenshot |
| A2 | Login (Google o email) | Entra al Hub | — |
| A3 | Anotar identidad en Learn | — | user ID Privy + address (truncada en el doc) |
| A4 | Abrir `play.` en la **misma sesión de navegador** | Entra directo, **sin gate** | screenshot |
| A5 | Comparar identidad en Play | **Mismo** user ID, **misma** address | comparación explícita |
| A6 | DevTools → Application → Cookies | Cookie con domain `.chesscito.com` | screenshot |
| A7 | Hard refresh en Play | Sigue dentro, sin gate | screenshot |

**Falla el contrato si:** aparece el gate en A4, o si la address difiere en A5 (eso
sería wallet duplicada — incidente, no bug menor).

### Contrato B — logout compartido (solo tras implementar §3.2)

| # | Paso | Esperado |
|---|---|---|
| B1 | Logout en Learn | Gate en Learn |
| B2 | Cookie en DevTools | Ya no está |
| B3 | **Refrescar** Play | Gate visible |
| B4 | Abrir Play de cero | Gate visible |

### Contrato C — no-regresión (obligatorio, es el camino que factura)

| # | Paso | Esperado |
|---|---|---|
| C1 | Abrir `learn.` **dentro de MiniPay** | Entra directo, wallet MiniPay, **sin gate** |
| C2 | Abrir `play.` dentro de MiniPay | Igual |
| C3 | `chesscito.com` | Sin Privy, sin login, sin cookie de sesión |
| C4 | Un pago en MiniPay | Idéntico a hoy |

### Contrato D — aislamiento de entornos

| # | Paso | Esperado |
|---|---|---|
| D1 | Preview con App B | Login funciona (localStorage) |
| D2 | `localhost:3000` con App A | **Debe fallar** — confirma que prod está encapsulado |

---

## 6. Rollback

Tres niveles, del más rápido al más lento. Ninguno toca MiniPay.

| Nivel | Acción | Tiempo | Efecto |
|---|---|---|---|
| **1** | `NEXT_PUBLIC_PRIVY_ENABLED=false` + redeploy | minutos | Vuelve al árbol `injected` completo; Privy deja de montarse. Es el rollback total. |
| **2** | `NEXT_PUBLIC_PRIVY_APP_ID` → App B + redeploy | minutos | Privy sigue, vuelve a `localStorage`. Sesiones separadas otra vez, pero web funciona. |
| **3** | Toggle HttpOnly cookies OFF en App A | minutos | Revierte el mecanismo en el origen. |

**Los records DNS pueden quedar puestos**: sin la app apuntando a ellos son inertes, y
quitarlos obliga a re-esperar propagación si se reintenta. La única excepción es el CAA
— si se agregó mal y rompe emisión de certificados, revertir **ese** sí es urgente.

**Costo para el usuario en un rollback:** las sesiones abiertas sobre cookie se
invalidan y hay que volver a loguear. No se pierde ninguna wallet: la embedded wallet
vive en Privy atada al user ID, no en el navegador.

---

## 7. Go / No-Go

### 🟡 GO condicional — con dos bloqueantes previos y un gap de alcance

**A favor (fuerte):**

- La arquitectura ya está bien: un solo app, un solo componente Privy, config
  hardcodeada → Learn y Play **no pueden** divergir.
- Compartir la sesión es **cero código**. Nada que romper en el diff.
- MiniPay está aislado por el resolver, con test de propiedad. Riesgo cero.
- El rollback nivel 1 es una env var. Barato de deshacer.
- La landing no monta Privy y hay un test que lo custodia.

**Bloqueantes antes de ejecutar:**

1. **Crear una app Privy de producción nueva.** Activar cookies sobre el App ID actual
   **rompe preview** — es explícito en la doc, no es una precaución.
2. **Resolver el origen de preview.** `*.vercel.app` está bloqueado; si preview vive
   ahí, necesita un subdominio estable de `chesscito.com` primero.

**Gap de alcance:**

3. La mitad "logout" del contrato **no existe en el código**. Se puede shippear el
   restore sin ella, pero el contrato solo queda cerrado cuando `useLogout` exista.

### No-Go si

- El record que pide Privy cae sobre el apex `chesscito.com` y colisiona con la landing.
- El paso A5 muestra **dos addresses distintas** — eso sería wallet duplicada y frena todo.
- No se puede separar prod de preview (rompería el entorno de desarrollo).

---

## 8. Verificaciones que corresponden al founder

No las hice porque exceden lo auditable desde el repo:

- [ ] ¿Existe algún **segundo app o app client** en el dashboard de Privy, además del actual? (§1.3)
- [ ] ¿Qué **dominios sirven los previews** hoy? ¿`*.vercel.app` o subdominio propio? (§2)
- [ ] ¿`NEXT_PUBLIC_PRIVY_ENABLED` está efectivamente en `false` en producción hoy?
- [ ] ¿`chesscito.com` ya tiene **registros CAA**? (§4.2 — la operación debe ser aditiva)
- [ ] ¿El DNS de `chesscito.com` está en Cloudflare? (§4.2 — modo DNS Only)

---

## Restricciones respetadas

✅ No monta Privy en `apps/landing` · ✅ No cambia topología de deployments ·
✅ Una sola app Privy para Learn y Play (dos entornos, no dos productos) ·
✅ No toca pagos ni entitlements · ✅ No modifica MiniPay ·
✅ **No activa cookies en producción** · ✅ No expone App Secret (el código nunca lo lee) ·
✅ Se detiene antes de cambiar producción.
