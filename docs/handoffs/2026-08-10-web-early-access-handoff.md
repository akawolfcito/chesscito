# Handoff — Web Early Access (intake) · 2026-08-10

**Branch:** `docs/2026-08-10-audit-and-experiment-design`
**Diseño:** `docs/specs/2026-08-10-web-early-access-design.md` (v2)
**Estado:** implementado y verificado en local. **Sin deploy. Sin allowlist prendido en prod.
Sin usuarios aprobados. E0 intacto.**

---

## 1. QUÉ EXISTÍA ANTES

Chesscito Web ya tenía un gate obligatorio, y ninguna forma de decidir quién pasa.

- `WalletProviderBoundary` (`components/wallet-provider-boundary.tsx:50-61`) elige el árbol de
  wallet en el cliente: `resolveWalletBranch()` manda MiniPay a `injected` y a todo lo demás
  a `privy` (`lib/wallet/wallet-branch.ts:53-67`).
- La rama `privy` monta `WebWalletProvider` → `PrivyProvider` → **`WebAccessGate`**
  (`components/web-wallet-provider.tsx:130`). **MiniPay nunca monta ese componente.**
- `WebAccessGate` deriva su estado con una función pura (`lib/wallet/web-access-state.ts:68-92`)
  y renderiza los children **sólo** en `wallet-ready`.
- **No había filtro de identidad.** Cualquiera que lograra loguearse entraba: cero allowlists,
  cero bypasses, cero middleware (`apps/web` no tiene `middleware.ts`), cero verificación
  server-side de sesiones de Privy (`web-wallet-provider.tsx:41-42` lo dice explícito).

---

## 2. CICLO DE VIDA DEL RECURSO PRIVY

```
AUTH START          web-access-gate.tsx:106 startLogin() → login()
   ↓
IDENTITY KNOWN      el modal de Privy resuelve email / Google
   ↓
PRIVY USER CREATED  ✅ y con él la SESIÓN. 💸 acá se consume el MAU
   ↓
WALLET PROVISIONED  ✅ automático — createOnLogin: "users-without-wallets"
                    (web-wallet-provider.tsx:112-116). La app nunca llama createWallet()
   ↓
APP
```

**El punto de no retorno es el login.** Privy define MAU como *"a user who has had their
session refreshed by Privy in the past thirty days"*, y el plan **Core es gratis 0–499 MAU**
($299/mes a partir de 500). Un visitante curioso que toca ENTER una vez cuesta un slot.

Consecuencia que ordenó todo el diseño: **cualquier gate propio que viva después de `login()`
llega tarde por construcción.** Por eso el intake vive *delante* del gate y no toca Privy.

Corolario útil: MAU es ventana móvil de 30 días, no acumulado — los usuarios legacy que no
vuelven **no cuentan**.

---

## 3. ARQUITECTURA FINAL

Dos piezas, deliberadamente separadas:

| Pieza | Quién la opera | Qué hace |
|---|---|---|
| **Allowlist nativo de Privy** | Founder, en el dashboard | **OTORGA.** Es lo único que decide quién puede loguearse |
| **`public.web_early_access`** | Esta implementación | **REGISTRA.** Cola ordenada de solicitudes + primer escalón del funnel |

```
ENTER (intacto)
  └─ enlace secundario bajo el CTA: "No key yet? Request access"
        ↓
     Pantalla Early Access — UN campo email + REQUEST MY KEY
        ↓
     POST /api/early-access/request → fila status='waiting' (idempotente)
        ↓
     "You're on the list! 🔑"
```

Cero Privy en todo ese camino → **una solicitud no consume MAU**.

---

## 4. PRESERVACIÓN DE MINIPAY

MiniPay **no puede** llegar a nada de esto, y es estructural:

1. `resolveWalletBranch({ isMiniPay: true })` → `"injected"`. Verificado en test.
2. `WebAccessGate` —única puerta al intake— sólo se referencia desde
   `components/web-wallet-provider.tsx`. Un test lee los dos archivos y afirma que
   `wallet-provider.tsx` (la rama injected) **no contiene** `WebAccessGate`,
   `EarlyAccessRequest` ni `early-access`.
3. Ningún archivo de la rama `injected` fue modificado.
4. `lib/minipay.ts`, `use-minipay.ts` y el flujo de conexión de wallet: sin tocar.

---

## 5. PRESERVACIÓN DE E0

**Riesgo: LOW** (poblacional, no lógico). Evidencia:

- Cero archivos de E0 modificados: `lib/onboarding/first-activity-experiment.ts`,
  `lib/onboarding/telemetry.ts`, `components/hub/learn-hub-client.tsx`.
- Tests estructurales nuevos: cada archivo de Early Access se lee en disco y se afirma que no
  contiene `lib/onboarding`, `first-activity` ni `onboarding_variant`; y a la inversa, que el
  módulo del experimento no menciona `early-access`.
- Ningún nombre de evento de Early Access aparece en `lib/onboarding/telemetry.ts` (test que
  extrae los `web_early_access_*` del módulo de analytics y los busca allá).
- `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` no se leyó ni se tocó.
- Suite de E0 corrida: `lib/onboarding/__tests__/first-activity-experiment.test.ts` +
  `components/hub/__tests__/learn-hub-client-onboarding-experiment.test.tsx` → verde.

⚠️ **Lo que SÍ cambia cuando el allowlist se prenda** (no ahora): un usuario web no aprobado
dejará de llegar al hub, así que sale del denominador de E0. Mitigación ya existente:
**todo análisis de E0 debe filtrar `container = 'minipay'`** (`client-dimensions.ts:50`) —
como corresponde desde antes de esta tarea, porque las cohortes nunca fueron comparables.

---

## 6. USUARIOS EXISTENTES

**No se toca a nadie, y no hizo falta código.** El allowlist de Privy dice textualmente:
*"All existing users will still be permitted to login to your app."*

Eso hizo desaparecer del diseño el grandfathering por `created_at`, `PRIVY_APP_SECRET`, la
columna de DID, la verificación de JWT y el kill switch de v1. La tabla nace vacía y los
legacy nunca la tocan.

Clasificación final del acceso web previo: **LEGACY AUTHORIZED** = todos los usuarios Privy ya
creados (censo sólo visible en el dashboard de Privy). **DEVELOPMENT/ADMIN BYPASS**: ninguno
existía. **PUBLIC/UNAUTHORIZED**: todo el mundo, hasta que el allowlist se prenda.

---

## 7. MODELO DE DATOS

`public.web_early_access` — PK `email`, `status text not null default 'waiting' check (status
in ('waiting','allowlisted'))`, `surface`, `source`, `note`, `requested_at`,
`allowlisted_at`, `allowlisted_by`, `updated_at`. Índice parcial
`web_early_access_waiting_idx (requested_at) where status = 'waiting'`.

**Por qué `allowlisted` y no `approved`** (refinamiento pedido por el founder): `approved` se
lee como una decisión que tomó *este* sistema, y convertiría a la tabla en una segunda fuente
de verdad sobre un hecho que no le pertenece. `allowlisted` nombra el hecho real: *este email
fue dado de alta en el allowlist de Privy*. Para que sea cierto, alguien tuvo que hacer el
paso en Privy primero. **Ningún código de la app lee este `status` para decidir nada** — es
grepeable, y el test de la ruta afirma que el handler nunca escribe un `status`.

**Por qué el email es la PK y no es "el identificador de seguridad":** el allowlist de Privy
también se llavea por email, así que la tabla habla el mismo idioma que el sistema que
otorga, y las dos listas se concilian mirándolas. La seguridad la da Privy.

---

## 8. ARCHIVOS

**Nuevos**
- `apps/web/src/lib/early-access/request.ts` — vocabulario de estados + normalización de email
- `apps/web/src/lib/early-access/__tests__/request.test.ts`
- `apps/web/src/lib/server/early-access-store.ts` — único escritor de la tabla
- `apps/web/src/lib/server/early-access-origin.ts` — política de origin (más estricta)
- `apps/web/src/lib/server/__tests__/early-access-origin.test.ts`
- `apps/web/src/app/api/early-access/request/route.ts`
- `apps/web/src/app/api/early-access/__tests__/route.test.ts`
- `apps/web/src/components/early-access-request.tsx` — la pantalla
- `apps/web/src/components/__tests__/early-access-request.test.tsx`
- `apps/web/src/components/__tests__/web-access-gate-early-access.test.tsx` — integración + no-interferencia
- `apps/web/supabase/migrations/20260810000000_web_early_access.sql`
- `docs/specs/2026-08-10-web-early-access-design.md`

**Modificados**
- `apps/web/src/components/web-access-gate.tsx` — enlace secundario + un `useState` de vista
- `apps/web/src/lib/wallet/web-access-copy.ts` — `EARLY_ACCESS_COPY`
- `apps/web/src/lib/wallet/web-access-analytics.ts` — 2 eventos + `trackEarlyAccess`
- `apps/web/src/lib/analytics/dimensions.ts` — `web_early_access` en `SOURCES` + aliases
- `apps/web/src/lib/server/demo-signing.ts` — bucket de rate limit dedicado
- `apps/web/src/app/globals.css` — `.web-access-input/-label/-error` + reset de `button.web-access-link`

---

## 9. MIGRACIONES

Una: **`20260810000000_web_early_access.sql`**. ✅ **APLICADA en local y en hosted.**

⚠️ **Cómo se aplicó a hosted, y por qué NO con `supabase db push`.** El ledger hospedado
estaba en 40 migraciones (última `20260805020000`): faltaban **tres**, no una. Las otras dos
son backfills de drift del 2026-08-06 cuyo efecto ya estaba en prod desde abril — verificado
objeto por objeto, no leyendo sus comentarios: RLS en `analytics_events`/`passport_cache`/
`scores` (21/21 tablas), `victories` y `sync_state` con su RLS, policy e índice.

Lo único que esas dos habrían EJECUTADO sobre hosted es un `drop policy` + `create policy`
sobre `scores_select_public` y `victories_select_public` — las dos tablas de lectura pública
(leaderboard y hall of fame). Se comprobó que las policies vivas son idénticas a lo que
declaran (`cmd=SELECT`, `permissive`, `roles=public`, `qual=true`, `with_check=null`), así que
recrearlas no cambia nada; pero si el CLI no envolviera cada archivo en una transacción
—**no se verificó**— habría una ventana de milisegundos con RLS activo y sin policy de
lectura, y esas dos superficies devolverían vacío.

Como esas dos migraciones **no aportan nada en hosted**, se evitó el riesgo por completo:
se ejecutó SOLO el SQL de `20260810000000` y se registraron las **tres** versiones en
`supabase_migrations.schema_migrations`, todo en UNA transacción
(`BEGIN / CREATE TABLE / CREATE INDEX / ALTER TABLE / REVOKE / COMMENT ×2 / INSERT 0 3 /
COMMIT`). Marcar las del 08-06 como aplicadas registra la realidad de la base; su efecto ya
estaba ahí y el ledger nunca lo dijo.

**Verificación posterior en hosted** (siembra dentro de una transacción cerrada con
`ROLLBACK`, para no escribir producción): tabla ✅, índice ✅, RLS ✅, cero policies ✅, cero
grants para `anon`/`authenticated` ✅, `anon` SELECT e INSERT → `permission denied` ✅,
`authenticated` SELECT → `permission denied` ✅, `service_role` ve la fila ✅, ledger 3/3 ✅,
tabla vacía en prod ✅.

Crea la tabla y el índice parcial, activa RLS **sin policies** (deny total para `anon` y
`authenticated`; sólo `service_role` escribe, igual que `analytics_events` y `passport_cache`)
y agrega `revoke all ... from anon, authenticated` como defensa en profundidad sobre los
default privileges de Supabase.

⚠️ Es la **única tabla de `public` con un dato personal directo y no seudonimizado** — en todo
el resto la identidad viaja como `account_ref` (HMAC irreversible). Un `select` de anon acá
sería una fuga de una lista de correos. **Verificar con `set role anon; select * from
public.web_early_access;` (debe dar `permission denied`), no leyendo el comentario del
archivo** — la migración `20260806010000` existe justamente porque otra migración *afirmaba*
tener RLS sin haberlo ejecutado nunca.

---

## 10. TESTS

Nuevos: **5 archivos, 55 tests**. Cobertura contra la lista requerida:

| Requisito | Dónde |
|---|---|
| MiniPay nunca ve Early Access | `web-access-gate-early-access.test.tsx` › MiniPay non-interference (resolver + lectura de fuentes) |
| Flujo MiniPay igual que antes | ningún archivo de la rama `injected` modificado + `wallet-branch` verde |
| E0 sin cambios | `web-access-gate-early-access.test.tsx` › E0 non-interference + suite de E0 verde |
| Web sin autenticar sigue el flujo ENTER | `web-access-gate-early-access.test.tsx` › ENTER intacto, sin textbox permanente |
| Usuario con acceso entra | `› an authenticated player with a ready wallet gets the app` |
| Legacy sigue autorizado | garantizado por Privy, no por código (§6) |
| Ve REQUEST MY KEY | `› opens the intake without calling login()` |
| Una sola fila persistida | `route.test.ts` › `upsert` una vez, sin `status` |
| Request idempotente | `route.test.ts` › duplicado → `already-requested`, `ignoreDuplicates: true` |
| Waiting sin CTA duplicado | `early-access-request.test.tsx` › confirmación sin CTA |
| Aprobado no ve el gate | `› gets the app, never the intake` |
| Cliente no puede auto-aprobarse | `route.test.ts` › ignora `status` del body; la ruta nunca escribe `allowlisted` |
| Cliente no puede pedir por otra identidad | no aplica: pedir no otorga nada (§ Seguridad del diseño) |
| Navegación directa no bypassea | no hay nada detrás de la pantalla; el muro es Privy |
| Malformadas fallan seguro | `route.test.ts` › 400 sin escribir; `request.test.ts` › 20 casos |
| RLS/ACL según el modelo | migración + verificación manual con `set role anon` (pendiente, §15) |
| Eventos sólo en web | la pantalla sólo existe en la rama privy |
| No alteran E0 | test de nombres de evento |
| Atribución separada | `route.test.ts` › `web_early_access` canónico, basura → `unknown` |

**Resultados**
- Suite completa: **622 archivos / 7658 tests passing**, exit 0, 172,95 s.
- `tsc --noEmit`: limpio.
- `next lint` sobre los 8 archivos tocados: `✔ No ESLint warnings or errors`.

⚠️ **Honestidad sobre el conteo:** no medí un baseline en `main` limpio antes de empezar (la
regla de CLAUDE.md). Lo que sí puedo afirmar: el conteo de archivos **subió** (614 documentado
→ 622, y agregué 5 archivos de test), la duración fue normal (173 s, en línea con los 142 s
del baseline sano y lejos de los 506 s del caso degradado) y no había dev server ni túnel
arriba — verificado con `lsof` en 3000/3002 antes de correr. No hubo `Unhandled Errors` en la
cola del log.

**VR: NO se corrió.** El intake es una pantalla nueva sin baseline, y correr Playwright sin
`--update-snapshots=none` la grabaría y la daría por pasada. Queda como tarea explícita
(§15).

---

## 11. OPERACIÓN MANUAL

Conexión: docker + `psql` contra el pooler **`aws-1`** en session mode (patrón ya documentado
en el proyecto). Nada de esto se ejecutó contra producción.

> ⛔ **EL ORDEN ES FIJO Y EN UN SOLO SENTIDO.**
> Aprobar: **1) Privy → 2) DB.** Revocar: **1) Privy → 2) DB.**
> El paso de Privy es siempre el que otorga o quita; el de la DB sólo registra. Invertirlos
> deja una fila que afirma un acceso que no existe (o al revés).

### LIST WAITING (la cola, en orden)

```sql
select email, surface, source, requested_at
from public.web_early_access
where status = 'waiting'
order by requested_at asc;
```

### VER UN USUARIO

```sql
select email, status, surface, source, note,
       requested_at, allowlisted_at, allowlisted_by
from public.web_early_access
where email = 'ana@example.com';
```

### APROBAR UNO

1. Dashboard de Privy → **Users → Access Control → Allowlist** → agregar `ana@example.com`.
2. Recién entonces:

```sql
update public.web_early_access
set status = 'allowlisted',
    allowlisted_at = now(),
    allowlisted_by = 'founder',
    updated_at = now()
where email = 'ana@example.com'
  and status = 'waiting';
```

### APROBAR LOS PRIMEROS N

Primero **leer** los N que tocan, y cargar esos emails en el allowlist de Privy:

```sql
select email
from public.web_early_access
where status = 'waiting'
order by requested_at asc
limit 10;
```

Con los N ya cargados en Privy, registrarlos:

```sql
with next_up as (
  select email
  from public.web_early_access
  where status = 'waiting'
  order by requested_at asc
  limit 10
)
update public.web_early_access w
set status = 'allowlisted',
    allowlisted_at = now(),
    allowlisted_by = 'founder',
    updated_at = now()
from next_up
where w.email = next_up.email
returning w.email;
```

⚠️ El `limit` del segundo query debe ser el MISMO número y no deben haber entrado
solicitudes nuevas en el medio — por eso se lee primero y se compara la lista devuelta por el
`returning` contra la que se cargó en Privy.

### REVOCAR (allowlisted → waiting)

1. Dashboard de Privy → quitar el email del allowlist. **Esto es lo que revoca.**
2. Registrar:

```sql
update public.web_early_access
set status = 'waiting',
    allowlisted_at = null,
    allowlisted_by = null,
    updated_at = now()
where email = 'ana@example.com';
```

⚠️ Revocar no cierra una sesión ya abierta: Privy deja de permitir *nuevos* logins. El
jugador sigue adentro hasta que su sesión expire.

### NOTAS DE INVESTIGACIÓN

```sql
update public.web_early_access
set note = 'volvió el día 3, no entendió el Daily', updated_at = now()
where email = 'ana@example.com';
```

---

## 12. FLUJO DE USUARIO

**Con key (o legacy):** ENTER → modal de Privy → wallet → app. **Idéntico a hoy, byte por
byte.**

**Sin key:** ENTER → toca *"No key yet? Request access"* → escribe su email → REQUEST MY KEY
→ *"You're on the list! 🔑"*. Nunca vio un modal de Privy, nunca costó un MAU.

**Después de ser aprobado:** vuelve, toca ENTER, entra. No hay código que copiar, ni link
mágico, ni segundo paso.

**Si el allowlist ya está prendido y toca ENTER sin key:** Privy le muestra su propio mensaje
de rechazo (personalizable desde `allowlist_config`). Mapear ese error a la pantalla de
intake quedó **fuera de scope** a pedido del founder: requiere capturar empíricamente el
código de error de Privy, y el enlace bajo ENTER ya cubre el caso sin depender de él.

---

## 13. TELEMETRÍA

Dos eventos, ambos demostrables desde datos reales:

- `web_early_access_request_viewed` — `{ surface }`. Nuestra propia pantalla renderizó.
- `web_early_access_requested` — `{ surface, outcome: "created" | "already-requested" }`.
  El servidor respondió 200.

**El email nunca viaja**, y lo garantiza la firma de `trackEarlyAccess`: sólo acepta el
surface y una unión cerrada de outcomes, sin bolsa de props libre. Hay un test que serializa
todas las llamadas y afirma que el address no aparece.

⛔ **`web_early_access_approved_entry` NO EXISTE, y es una decisión** (founder, 2026-08-10). En
el momento en que alguien entra, el cliente sólo sabe *"un usuario de browser se autenticó"*:
no puede distinguir un jugador de Early Access de uno de los legacy que Privy sigue admitiendo
por diseño, porque el allowlist vive en Privy y la app nunca se entera de por qué el login
funcionó. Ese evento habría etiquetado legacy como Early Access y el funnel habría
sobrecontado su propio éxito. El funnel instrumentado termina donde termina la evidencia; el
resto se responde cruzando `web_early_access` contra las métricas existentes, offline, a mano,
para ~25 personas.

**Atribución:** `web_early_access` agregado a `SOURCES` + aliases (`early_access`,
`web_early_access`) en `lib/analytics/dimensions.ts`. Puramente aditivo: ningún valor
existente cambia de significado y una fuente desconocida sigue colapsando a `unknown`. El
separador primario ya existía y no se tocó: **`container` = `browser` | `minipay`**.

---

## 14. DELIBERADAMENTE FUERA DE SCOPE

| Cosa | Por qué |
|---|---|
| **Notificación por email o a Slack** | ✅ **Decidido explícitamente: se queda manual** (founder, 2026-08-10). No hay proveedor en el repo y agregarlo era infra nueva. El jugador descubre su acceso en el próximo login, que alcanza para n≈25. Si algún día hace falta: (a) avisar AL FOUNDER de una solicitud nueva es un **Database Webhook** de Supabase sobre `insert` en la tabla, cero código en el repo; (b) avisar AL JUGADOR de que su key está lista sí necesita proveedor de email |
| **Admin UI** | 25 filas se operan con 4 queries. Un dashboard es más código que la feature |
| **Automatizar el allowlist de Privy** | Existe la API (`POST /api/v1/apps/<id>/allowlist`, Basic auth) y requiere `PRIVY_APP_SECRET`. No hace falta para 25 personas, y meter el secret para eso agranda la superficie |
| **`PRIVY_APP_SECRET`** | Innecesario: el allowlist nativo preserva legacy solo, así que no hay grandfathering que verificar server-side |
| **Límite automático de cohorte** | El número es una decisión operativa. El sistema sólo sabe `waiting` / `allowlisted` |
| **Referrals / códigos / invitaciones** | Excluido por el brief; el acceso es estado del servidor, no un código compartible |
| **Aprobaciones masivas** | No se ejecutó ninguna. Las queries están arriba |
| **Cambios de auth** | `createOnLogin: "users-without-wallets"` sigue igual. La palanca de costo (`createOnLogin: "off"` + `useCreateWallet()` post-aprobación, `web-wallet-provider.tsx:112-116`) queda identificada y sin tocar |
| **Mapeo del error de rechazo de Privy** | Requiere capturar el código empíricamente; el enlace bajo ENTER cubre el caso sin él |
| **Waitlist a escala** | Optimizado para ~25. No hay paginación, ni dedupe difuso, ni verificación de email |

---

## 15. RIESGOS PENDIENTES

**✅ CERRADO — comportamiento de Privy al bloquear nuevos usuarios.** El founder confirmó
(2026-08-10) que ya se validó cuando se cerró Web para proteger el límite de MAU. La premisa
del diseño se sostiene.

**✅ CERRADO — LEARN y PLAY comparten la MISMA app de Privy** (login transversal, founder
2026-08-10). No hay dos allowlists que coordinar: se prende una sola vez.

**✅ CERRADO — RLS verificada con `set role`,** en local y en hosted. `anon` y `authenticated`
reciben `permission denied` en SELECT e INSERT; `service_role` opera. Ver §9.

**✅ CERRADO — VR corrido** con `--project=minipay --update-snapshots=none`: 67 passed, cero
snapshots nuevos (diff de la lista de baselines vacío, 81 = 81). Las pantallas nuevas NO están
cubiertas por esa suite y no pueden estarlo sin agregar casos: el VR corre como MiniPay, que
resuelve a la rama `injected` y nunca renderiza el gate. Se validaron aparte con sonda propia a
390×844 (22/22 checks + revisión de las capturas), sin grabar baselines.

**🟡 P2 — Emails sin verificar en la cola.** Alguien puede pedir con el email de otro. No es
un agujero (pedir no otorga nada, aprobar es manual y el founder ve el address), pero sí
ruido operativo posible. Mitigado con rate limit de 5/hora/IP y `on conflict do nothing`.

**🟠 P1 — Estabilidad de identidad, y ya apareció en la primera prueba real.** La primera
solicitud registrada es `guffenix+chess@gmail.com`. El `+chess` se conserva en la
normalización (correcto: es parte de la dirección), así que **en el allowlist de Privy hay
que cargar ese string exacto** — para Privy `guffenix+chess@gmail.com` y `guffenix@gmail.com`
son identidades distintas aunque Gmail entregue las dos al mismo buzón. Lo mismo con los
puntos en Gmail (`ana.p@` vs `anap@`) y con pedir por email pero entrar con Google. Con 25
personas se resuelve mirando; a escala habría que pedir el mismo método de login.

**🟡 P2 — Diferencias Web/MiniPay de estado.** Ya existían (runtime, auth, device) y no
cambian. Sólo importa para no comparar las cohortes: ver §16.

---

## 16. INTERPRETACIÓN DE LA INVESTIGACIÓN

Con ~25 usuarios web admitidos **PODEMOS** legítimamente:

- Describir si jugadores con intención declarada llegan a su primer valor, y dónde se frenan.
- Ver qué intentaron, qué los confundió, si entendieron qué es Chesscito.
- Ver si el auth web en sí agrega fricción (una pregunta que MiniPay no puede responder).
- Ver si alguien pagó, y qué hizo antes.
- Observar si jugadores de intención conocida igual desaparecen tras un Día 0 fuerte —
  y eso sí actualiza nuestras creencias sobre si el problema es adquisición o retención.

**NO PODEMOS**, y esto es lo importante:

- Afirmar **"Web retiene mejor que MiniPay"**. No es una comparación causal: las cohortes no
  están randomizadas, se autoseleccionaron por pedir acceso, y corren en runtimes, auth y
  devices distintos. Cualquier diferencia de D1 confunde el canal con la intención.
- Tratar esto como un brazo de E0. **No lo es.** E0 vive en MiniPay/LEARN con asignación
  randomizada; esto es un canal cualitativo separado, con su propia telemetría, y sus eventos
  no deben entrar jamás en un análisis de activación de E0.
- Sacar conclusiones de retención con n≈25. No hay potencia estadística para eso y no la va a
  haber. Lo que hay es **evidencia cualitativa** que puede sugerir hipótesis para después
  probar donde sí hay volumen.

---

## PRÓXIMOS PASOS

| # | Quién | Qué | Estado |
|---|---|---|---|
| 1 | Founder | Comportamiento de Privy al bloquear nuevos usuarios | ✅ ya validado |
| 2 | Founder | LEARN y PLAY comparten app de Privy | ✅ confirmado: una sola |
| 3 | — | Aplicar la migración y verificar la RLS con `set role` | ✅ local y hosted |
| 4 | — | VR sin actualizar snapshots | ✅ 67 passed, 0 nuevos |
| 5 | — | Intake probado end-to-end en preview | ✅ 1 fila `waiting` |
| 6 | **Founder** | Prender el allowlist en Privy (una sola app) | ⏳ pendiente |
| 7 | **Founder** | Aprobar la primera cohorte, **en el orden Privy → DB** | ⏳ pendiente |

**Estado al cierre de la sesión (2026-08-10):** el intake está vivo en preview y escribe en la
base compartida con producción. La cola tiene **1 fila en `waiting`** (la prueba del founder).
**El allowlist de Privy sigue APAGADO**, así que Web sigue abierta como siempre: hasta que se
prenda, el intake recoge solicitudes pero no protege el límite de MAU. Ese es el único paso
que falta para que la feature cumpla su propósito.

**No se deployó a producción. Nadie fue aprobado. E0 no se tocó.**
