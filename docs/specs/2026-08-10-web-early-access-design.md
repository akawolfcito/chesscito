# Web Early Access — audit + design (Phase 0 → 3) · **v2**

**Fecha:** 2026-08-10 · **Branch base:** `docs/2026-08-10-audit-and-experiment-design`
**Estado:** diseño corregido. NADA implementado.
**Regla de oro:** el experimento E0 (MiniPay/LEARN) no se toca.

> **v2 corrige una premisa load-bearing de v1.** v1 puso el gate DESPUÉS del login de Privy.
> El founder señaló que el recurso a proteger es el **límite gratuito de MAU de Privy**, y
> que el login ya lo consume — así que un gate post-login **no resuelve el objetivo**.
> v2 mueve la aplicación del gate a **antes** de Privy y, con eso, encuentra un mecanismo
> nativo que reduce el código a escribir en lugar de aumentarlo.

---

## 0. El número, confirmado

La página de precios de Privy da la razón al founder: el plan **Core es gratis de 0 a 499
MAU**; a partir de 500 el escalón es **$299/mes** (Scale 0–2.499). Y Privy define MAU como
**"a user who has had their session refreshed by Privy in the past thirty days"**.

Dos consecuencias que ordenan todo el diseño:

1. **Un login exitoso = una sesión = un MAU de ese mes.** Un visitante curioso que toca
   ENTER una sola vez cuesta un slot de 499. v1 estaba mal.
2. **MAU es una ventana móvil de 30 días, no un contador acumulado.** Los usuarios que
   existen pero no vuelven **dejan de contar**. Preservar a los legacy no cuesta MAU salvo
   los meses en que efectivamente juegan — que es exactamente lo que queremos que pase.

Fuentes: [Privy – Pricing](https://www.privy.io/pricing) ·
[Privy Docs — Users](https://docs.privy.io/guide/dashboard/users)

---

## PHASE 0 — AUDIT (sin cambios respecto de v1; sigue siendo la base)

### 1. Pantalla ENTER actual
`apps/web/src/components/web-access-gate.tsx:192-227` — el bloque final (`unauthenticated` /
`authenticating`). Copy en `apps/web/src/lib/wallet/web-access-copy.ts:21-34`:
`"Unlock your Chesscito journey"`, `"Every journey begins with a key."`,
`["Sign in to enter.", "Your wallet will be created automatically."]`, `cta: "ENTER"`.

### 2. Flujo de autenticación web
`web-access-gate.tsx:50-62` — `useLogin()` de `@privy-io/react-auth` con `onComplete`/
`onError`; `startLogin()` (`:106-111`) abre el modal nativo. Estados: función pura en
`apps/web/src/lib/wallet/web-access-state.ts:68-92`. Children productivos **sólo** en
`wallet-ready` (`web-access-gate.tsx:113-115`).

### 3. Integración Privy
`apps/web/src/components/web-wallet-provider.tsx:89-141`.
`loginMethods: ["email", "google"]` (`:109`) — ambos cubiertos por el allowlist nativo (ver §A4).
`embeddedWallets.ethereum.createOnLogin: "users-without-wallets"` (`:112-116`).
`requirePrivyAppId()` lee `NEXT_PUBLIC_PRIVY_APP_ID` (`:44-52`).
`:41-42` documenta que **`PRIVY_APP_SECRET` nunca se lee**: el backend ancla entitlements a
tx on-chain por dirección EVM y no verifica sesiones de Privy.

### 4. Identidad estable post-auth
Sólo se consume `useAccount().address` (`web-access-gate.tsx:46,64`). El DID de Privy
(`usePrivy().user.id`) existe en el cliente y **no se usa ni se persiste** en ninguna parte.

### 5. Email
Vive en Privy. **Nunca cruza a nuestro backend.** Cero columnas de email en las 43
migraciones de `apps/web/supabase/migrations/`.

### 6. Provisión de wallet
Automática, fuera de nuestro código (`web-wallet-provider.tsx:112-116`). La app sólo observa
`useAccount().address`. No hay `createWallet()` en el repo.

### 7. Detección de MiniPay
`apps/web/src/lib/minipay.ts` → `isMiniPayEnv()` (lee `window`; `false` en SSR).

### 8. Bypass actual de MiniPay
`apps/web/src/lib/wallet/wallet-branch.ts:53-67` — `isMiniPay ? "injected" : "privy"`.
Montaje en `apps/web/src/components/wallet-provider-boundary.tsx:50-61`.
**`WebAccessGate` sólo existe dentro de `WebWalletProvider`** (`web-wallet-provider.tsx:130`),
la rama `privy`. MiniPay va a `injected` y **jamás lo monta**. Con
`NEXT_PUBLIC_PRIVY_ENABLED !== "true"` todos van a `injected` (`wallet-branch.ts:58-60`).

### 9. Gate web actual
Cualquier sesión Privy autenticada con wallet lista entra. Sin allowlist, sin "Continue as
Guest" (`web-access-gate.tsx:223`).

### 10-11. Allowlists / bypasses existentes
**Ninguno de identidad de usuario.** El grep sólo devuelve allowlists de stablecoins
(`payments/*`, `contracts/tokens.ts`) y de Origin (`lib/pro/pro-origin.ts`,
`lib/server/score-save-origin.ts`).

### 12. Flags de entorno
`NEXT_PUBLIC_PRIVY_ENABLED` (`wallet-provider-boundary.tsx:17-19`, ON en prod en los dos
proyectos, verificado 2026-08-06) · `NEXT_PUBLIC_PRIVY_APP_ID` · `CHESSCITO_MODE` →
`resolveWebAccessSurface()` · `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` (**E0, no se toca**).

### 13. Middleware / server-side
**No hay `middleware.ts` en `apps/web`.** El acceso web es 100% client-side hoy. El patrón de
trust boundary del repo es `api/scores/session/challenge` → `/authorize` (todos los términos
se deciden server-side; `:73-76`: *"The surface is NOT read from the body"*).

### 14. Supabase
`apps/web/src/lib/supabase/server.ts:12-23` — `getSupabaseServer()` con service role, `null`
si falta env. Convención RLS: `20260806010000_baseline_rls_parity.sql` —
`enable row level security` + cero policies = deny total salvo `service_role`. Y su lección:
*"Un comentario no es un control"* (`:24`).

### 15. Telemetría
`apps/web/src/lib/telemetry.ts` (`track()`, batch 20 / 5 s, drop-never-retry).
Dimensiones: `lib/analytics/client-dimensions.ts:42-59` — **`container: isMiniPayEnv() ?
"minipay" : "browser"`**. Allowlist de `source`: `lib/analytics/dimensions.ts:28-52`.
Eventos del gate ya existentes, PII-free por construcción:
`lib/wallet/web-access-analytics.ts:11-28`.

### 16. Tests de auth/access
`components/__tests__/{web-access-gate,web-wallet-provider,web-wallet-session,wallet-provider-boundary,wallet-branch-lazy,wallet-branch-attribute}.test.tsx`,
`lib/wallet/__tests__/{web-access-state,wallet-branch,web-access-appearance,wallet-session}.test.*`,
más el guard de bundle `lib/bundle/minipay-graph-guard.ts`.

### 17. Usuarios web autorizados hoy
Todo el que haya logueado alguna vez. El censo real vive **sólo en el dashboard de Privy**;
su sombra en DB (`analytics_events` con `container='browser'`) está llaveada por `account_ref`,
un HMAC irreversible (`lib/analytics/account-ref.ts:28-38`), no enlazable a un DID.

---

## CRITICAL COST QUESTION — ciclo de vida, corregido

```
AUTH START            web-access-gate.tsx:106 startLogin() → login()
   ↓
IDENTITY KNOWN        el modal de Privy resuelve email / Google
   ↓
PRIVY USER CREATED    ✅ SÍ — y con él la sesión. 💸 AQUÍ SE CONSUME EL MAU.
                      Fuera de nuestro código. No hay hook entre esto y el paso siguiente.
   ↓
WALLET PROVISIONED    ✅ AUTOMÁTICO — createOnLogin: "users-without-wallets"
   ↓
ACCESS CHECK          ❌ no existe hoy — y v1 lo ponía ACÁ, que es tarde.
   ↓
APP
```

**El punto de no retorno es el login.** Cualquier gate propio que viva después de
`login()` llega tarde por construcción: el slot ya se gastó. Por lo tanto **el gate tiene que
aplicarse en el propio Privy, o antes de que Privy vea al usuario.**

---

## A. ALTERNATIVAS COMPARADAS

### A1 — Allowlist/invitación pre-auth por email, aplicada por NUESTRO cliente

Nuestra UI pide el email antes de ENTER, consulta nuestra API y sólo llama `login()` si está
aprobado.

| Dimensión | Respuesta |
|---|---|
| MAU consumido | En el login — que sólo disparamos para aprobados |
| Wallet creada | Junto con el login |
| Dato pedido | Email, antes de Privy |
| Bypass | **Alto.** Es una decisión de cliente: parchear el bundle o llamar `login()` desde la consola salta el gate y quema un MAU. Y el email declarado puede no ser el que use en el modal |
| UX | Un paso extra antes de ENTER |
| Complejidad | Media (pantalla + ruta + tabla) |
| Legacy | Hay que reconstruir la lista de aprobados a mano; no la tenemos |
| Infra nueva | Tabla nueva |

**Veredicto: insuficiente sola.** Protege por convención, no por control — el mismo error que
`REVOKE FROM PUBLIC` en Supabase.

### A2 — Key/invite individual antes de Privy

Igual que A1 pero con un código que el usuario copia y pega.
Mismo perfil de bypass (la validación sigue siendo nuestra y el login lo dispara el cliente),
peor UX, y choca de frente con dos restricciones explícitas del brief: *no generar códigos de
invitación* y *no obligar a copiar/pegar un código*. **Descartada.**

### A3 — Un identificador que ya conozcamos sin crear usuario Privy

No existe. Antes del login sólo tenemos el `install id` de localStorage
(`lib/analytics/identity.ts`) — anónimo, borrable, no es una identidad de persona — y el
`account_ref`, que es HMAC irreversible y además requiere una wallet, que en web sólo existe
DESPUÉS de Privy. **Descartada por ausencia de sujeto**, no por complejidad.

### A4 — ✅ Allowlist NATIVO de Privy (la primitiva que sí existe)

Privy trae control de acceso propio: **Dashboard → Users → Access Control → toggle
allowlists**. Documentación textual:

> *"With Privy, you can enable an allowlist for your application to gate access to specific
> email addresses, phone numbers, and/or wallet addresses."*
> *"All existing users will still be permitted to login to your app."*
> *"New users who have not been added to your allowlist will not be permitted to login."*
> *"Allowlists apply to email, SMS, wallet, and OAuth methods with verified emails only."*

| Dimensión | Respuesta |
|---|---|
| MAU consumido | **Sólo por quien logra loguearse**, es decir sólo allowlisted. Un rechazado no obtiene sesión, y MAU se define como *sesión refrescada* ⚠️ ver la verificación empírica abajo |
| Wallet creada | Sólo tras un login permitido |
| Dato pedido | Ninguno en el camino de enforcement. El email hace falta sólo para **pedir** acceso |
| Bypass | **Ninguno del lado cliente.** Lo aplica el servidor de Privy. Parchear nuestro bundle no ayuda: el modal rechaza igual |
| UX | ENTER sigue idéntico para los aprobados. El rechazado ve el mensaje de Privy — personalizable vía `allowlist_config` |
| Complejidad | **Cero código.** Un toggle |
| Legacy | ✅ **Nativo y gratis:** *"All existing users will still be permitted to login"*. Sin grandfather, sin `PRIVY_APP_SECRET`, sin cutover, sin migración de datos |
| Infra nueva | Ninguna. Opcional: `POST/GET/DELETE https://auth.privy.io/api/v1/apps/<app-id>/allowlist` (Basic auth `app_id:app_secret`) para automatizar más adelante |

`loginMethods` del repo es `["email", "google"]` (`web-wallet-provider.tsx:109`): email está
cubierto y Google es OAuth con email verificado, también cubierto. **Nada que cambiar.**

Fuente: [Privy Docs — Allowlist](https://docs.privy.io/user-management/users/managing-users/allowlist)

### A5 — Mantener el gate post-login

**Refutada por la evidencia.** MAU = *"a user who has had their session refreshed by Privy in
the past thirty days"*; el login crea la sesión. No hay forma de demostrar lo contrario, así
que la condición que el founder puso para aceptar esta opción no se cumple.

---

## B. DISEÑO CORREGIDO — A4 (enforcement) + A1 mínimo (intake)

El cambio más pequeño que **realmente** protege el límite son dos piezas separadas, y esa
separación es la propiedad más importante del diseño:

- **Quien OTORGA la capacidad es el allowlist de Privy.** Es el único lugar donde "puede
  entrar" se vuelve verdad, y no lo controla nuestro cliente ni nuestra DB.
- **Nuestra tabla es una cola de solicitudes, no un permiso.** Aunque alguien escribiera
  `approved` en nuestra base, no entraría: falta estar en el allowlist de Privy.

Esto aplica la invariante del repo `feedback_guard_the_grantor_not_the_callers`: se blinda a
quien otorga, no a los llamadores.

### B1. Enforcement — operación, no código
Prender el allowlist en el dashboard de Privy. **En los DOS proyectos** si LEARN y PLAY usan
apps de Privy distintas — verificar `NEXT_PUBLIC_PRIVY_APP_ID` en ambos entornos antes de
tocar nada. Es una acción de producción sobre un sistema vivo: **la ejecuta el founder**, yo
no.

### B2. Intake — el único código nuevo del MVP

Ruta nueva `/[locale]/early-access` (o pantalla del gate, ver B4), fuera de todo árbol
autenticado:

```
ENTER (intacto)
  └─ enlace secundario, bajo el CTA: "Don't have a key yet? Request access"
        ↓
     Pantalla Early Access — UN campo email + REQUEST MY KEY
        ↓
     POST /api/early-access/request  → fila status='waiting'  (idempotente)
        ↓
     Confirmación: "You're on the list! 🔑"
```

Cero Privy en todo ese camino. **Cero MAU consumido por una solicitud.**

El input de email deja de estar prohibido por decisión del founder (2026-08-10) y con un
motivo concreto: obtener la identidad vía Privy consume exactamente el recurso que queremos
proteger. Igual **no** va debajo de ENTER como campo permanente — va detrás de un enlace
secundario, para que el aprobado siga viendo la pantalla de siempre.

### B3. Máquina de estados

```
MINIPAY                        → injected → WalletProvider   (SIN CAMBIOS)

WEB + !ready                   → environment-loading          (existente)
WEB + !authenticated           → unauthenticated | authenticating  (ENTER, existente
                                  + un enlace nuevo)
WEB + login rechazado por allowlist → early-access-request     ← NUEVO
WEB + solicitud enviada        → early-access-waiting          ← NUEVO
WEB + authenticated + !wallet  → wallet-pending                (existente)
WEB + authenticated + wallet   → wallet-ready → app            (existente)
WEB + error real               → error                         (existente)
```

Dos estados nuevos. Nada más. El camino del aprobado no cambia en un solo byte.

### B4. El rechazo no debe verse como un error
Hoy cualquier `onError` que no sea una salida voluntaria pinta *"Something interrupted your
sign in."* (`web-access-gate.tsx:60,153-189`) — que es justo el tono que el brief prohíbe.
Cuando el allowlist esté prendido, un rechazo tiene que llevar a `early-access-request`, no a
la pantalla de error.

⚠️ **El código de error exacto de Privy para el rechazo por allowlist no está documentado en
la página pública.** Se captura empíricamente en preview (log de `onError`) y se agrega a un
`ALLOWLIST_REJECTED_CODES` junto a `isUserDismissedLogin`. **Esto no bloquea el MVP:** el
enlace "Request access" bajo ENTER es un camino independiente que funciona sin conocer el
código. El mapeo del código es un refinamiento de UX, no el mecanismo.

### B5. Datos

```sql
create table public.web_early_access (
  email          text primary key,            -- normalizado: trim + lowercase
  status         text not null default 'waiting'
                 check (status in ('waiting','approved')),
  surface        text check (surface in ('learn','play')),
  source         text,                        -- dimensión de atribución normalizada
  note           text,                        -- notas del founder para la investigación
  requested_at   timestamptz not null default now(),
  approved_at    timestamptz,
  approved_by    text,
  updated_at     timestamptz not null default now()
);

alter table public.web_early_access enable row level security;
-- Cero policies ⇒ deny total para anon/authenticated. Sólo service_role.
-- Se auditará con `set role anon`, no leyendo este comentario.
```

**El email es identificador legítimo acá, y no es "el identificador de seguridad":** el
allowlist de Privy también se llavea por email, así que nuestra tabla habla el mismo idioma
que el sistema que efectivamente otorga. La seguridad la da Privy; esta tabla es la cola de
la investigación. Se cae la necesidad de persistir el DID, de verificar JWTs y de
`PRIVY_APP_SECRET` en el MVP.

**Legacy:** no se toca. Privy los deja entrar por definición. Esta tabla nace vacía.

### B6. Seguridad de la ruta de intake

Es deliberadamente **no autenticada** — ese es el punto: pedir acceso no puede costar un MAU.
Defensas, todas con patrones que ya existen en el repo:

| Riesgo | Defensa |
|---|---|
| Spam / inundar la cola | `enforceScoreSaveRateLimit(getRequestIp(req))` (`lib/server/demo-signing.ts`) |
| Llamadas desde fuera del sitio | `classifyScoreSaveOrigin(origin, referer)` (`lib/server/score-save-origin.ts`) |
| Solicitudes duplicadas | `insert … on conflict (email) do nothing` — idempotente, no mueve `requested_at` |
| Auto-aprobación | Imposible: la ruta **sólo** escribe `waiting`, y aunque escribiera `approved`, entrar exige el allowlist de Privy |
| Pedir por otro | Puede pasar (email no verificado) y **no importa**: pedir no otorga nada; aprobar es manual y el founder ve el email |
| Email malformado | Validación + normalización server-side; 400 |
| Enumerar quién está aprobado | La respuesta es siempre la misma forma, no revela estado ajeno |
| Bypass navegando directo | No hay nada detrás de esta pantalla: el muro real es Privy |

**Límite honesto:** un email no verificado puede ensuciar la cola. Con n≈25 y aprobación
manual, eso es ruido operativo, no un agujero de seguridad — la capacidad la sigue otorgando
un sistema que el atacante no toca.

### B7. Telemetría (canal separado, nunca E0)

Cuatro eventos nuevos en `lib/wallet/web-access-analytics.ts`, mismo `trackWebAccess()`
PII-free (**el email nunca viaja en un evento**):

- `web_early_access_gate_viewed`
- `web_early_access_requested`
- `web_early_access_waiting_viewed`
- `web_early_access_approved_entry`

Atribución: agregar `web_early_access` a `SOURCES` + su alias en `dimensions.ts:28-52`
(aditivo — no cambia el valor de nadie que no traiga ese utm). El separador primario ya
existe y no se toca: `container` = `browser` vs `minipay`.

### B8. Operación manual (n≈25, sin dashboard)

Aprobar es **dos pasos, en este orden**:

1. Agregar el email al allowlist de Privy (dashboard, o
   `POST https://auth.privy.io/api/v1/apps/<app-id>/allowlist` con Basic auth). **Este paso
   es el que otorga.**
2. Marcar la fila como `approved` en nuestra tabla. **Este paso sólo registra**, para poder
   seguir el funnel.

Invertir el orden deja una fila que dice `approved` sobre alguien que no puede entrar. Las
queries literales (LIST WAITING / APPROVE ONE / APPROVE FIRST N / REVOKE) van en el handoff,
contra el pooler `aws-1` en session mode.

---

## C. NO-INTERFERENCIA

### MiniPay
`resolveWalletBranch()` manda MiniPay a `injected`; `WebAccessGate` sólo existe dentro de
`WebWalletProvider`. **Ningún archivo de la rama `injected` se modifica.** El allowlist de
Privy no puede alcanzar a MiniPay porque MiniPay nunca instancia Privy. El guard de bundle
sigue probando que el chunk de Privy no llega al layout raíz.

### E0 — riesgo: **LOW** (no NONE, y la diferencia importa)
Cero código de E0 modificado (`lib/onboarding/*`, `learn-hub-client.tsx`, sus eventos, el
`account_ref`, el routing de primera sesión). El único efecto es **poblacional**: un usuario
web no aprobado que hoy llegaría al hub mañana no llega. Mitigación ya existente y sin
cambios: **todo análisis de E0 debe filtrar `container = 'minipay'`**
(`client-dimensions.ts:50`) — como corresponde desde antes de esta tarea, porque las cohortes
nunca fueron comparables.

---

## D. VERIFICACIÓN PENDIENTE — una sola, y es barata

> **¿Un intento de login rechazado por allowlist crea usuario / consume MAU?**

La evidencia disponible dice que no —Privy niega el login, y MAU se define como *sesión
refrescada*, que un rechazo no produce— pero la doc pública **no lo afirma textualmente**, y
esta es la premisa entera del diseño. No la doy por buena por deducción: ya está anotado en
la memoria del proyecto que si mi cálculo contradice una medición, el equivocado suelo ser yo.

**Prueba (≈5 minutos, la hace el founder en su dashboard):**
1. Prender el allowlist en un app de Privy de dev/preview.
2. Anotar el conteo de usuarios.
3. Intentar login con un email NO allowlisted.
4. Releer el conteo y la lista de usuarios.

Si el conteo sube, A4 no protege el límite y hay que volver a las alternativas — pero
entonces **ninguna** opción cliente-side sirve tampoco (A1/A2 quedan igual de expuestas), y la
conversación pasa a ser con el soporte de Privy.

---

# ✅ VERDICT: READY TO IMPLEMENT — con una acción del founder por delante

**Lo que cambia respecto de v1:** el gate se mueve a antes de Privy; desaparecen la
verificación de JWT, el `PRIVY_APP_SECRET`, el grandfathering por `created_at`, la columna de
DID y el flag de kill switch. El diseño se achica.

**Secuencia propuesta:**

| # | Quién | Qué | Bloquea implementación |
|---|---|---|---|
| 1 | Founder | Verificar D (rechazo ≠ MAU) en un app de dev | No |
| 2 | Founder | Confirmar si LEARN y PLAY comparten `NEXT_PUBLIC_PRIVY_APP_ID` | No |
| 3 | Yo | Implementar B2/B5/B6/B7 (pantalla + ruta + migración + telemetría) | — |
| 4 | Founder | Prender el allowlist en producción | No |
| 5 | Founder | Aprobar la primera cohorte (~25), en el orden de B8 | No |

Nada de esto bloquea el paso 3: el intake es útil y seguro exista o no el allowlist, y no
consume MAU en ningún caso.

**No implemento hasta tu OK.**
