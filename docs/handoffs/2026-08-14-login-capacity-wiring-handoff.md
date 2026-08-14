# Handoff — El tope de logins quedó cableado (2026-08-14)

**Branch:** `main` (local) · **Commits nuevos:** 4 · **Sin pushear:** 32 en total
**Suite:** 657 archivos / 8030 tests verde · `tsc --noEmit` exit 0
**Baseline medida en `main` limpio al abrir:** 654 / 7996 — el conteo de archivos **subió**
en exactamente los 3 archivos de test nuevos, así que la corrida vale.

---

## 0. Lo primero, porque cambió el plan del día

**El builder de ejercicios ya estaba hecho.** El `docs/backlog/2026-08-13-next-three-initiatives.md`
§3 lo listaba como pendiente, pero se cerró entero el 2026-08-13 — los seis ítems del mockup
más cinco mejoras que salieron de autorar de verdad. Verificado en código, no en el doc
(`page.tsx:1369` el badge de TIER, `:1399` el `Editing`, `:1294` el `Unsaved changes`,
`library.ts:40` el orden por tier). El §3 quedó corregido en el commit `b549bc4`.

⚠️ **La regla que esto deja**: el backlog de iniciativas envejece más rápido que el código
que describe, porque lo escribe la sesión que *propone* y lo cierra la sesión que *construye*.
Antes de arrancar un ítem de ese doc, comprobarlo contra el handoff del día.

---

## 1. La medición que decidió el tamaño del trabajo

Consulta read-only contra prod (`account_first_seen`, count exact, cero filas transferidas):

| | |
| --- | --: |
| cuentas totales | **5.856** |
| `first_container = browser` ← lo que factura Privy | **5** |
| `first_container = minipay` | 5.851 |
| headroom al tope de 460 | **455** |

⛔ **Eso responde la open question #3 del spec** (*"¿y si el pozo ya está alto?"*): **no lo
está.** El spec decía *"medir primero, instalar después"*, y la medición dice que esto es
prevención pura. Por eso se construyó chico y no se sobrediseñó.

⚠️ **Y explica por qué el filtro por `browser` es media corrección**: contar las 5.856 pondría
al pozo 12× por encima del tope y cerraría la app entera sin que nadie estuviera empujando.

---

## 2. Lo construido

Cuatro commits, de adentro hacia afuera:

| commit | qué |
| --- | --- |
| `8425ade` | `lib/access/browser-accounts.ts` — el conteo · `resolveCapacityEnabled` |
| `df37a1e` | `GET /api/access/capacity` + su bucket de rate limit |
| `71e73b9` | `lib/access/capacity-client.ts` + el chequeo en `startLogin()` |
| `b549bc4` | las dos perillas en `.env.example` + el §3 del backlog |

### Lo que hay que saber antes de tocarlo

- ⛔ **El chequeo va ARRIBA de `login()`, y ese orden ES el feature.** Privy cuenta el MAU al
  refrescar la sesión: un tope consultado después ya gastó lo que venía a proteger.
  **Por eso los tests asiertan sobre el hook de Privy, nunca sobre la pantalla** — un chequeo
  que sólo cambiara la UI pasaría un screenshot y pagaría la factura igual.
- ✅ **Estar lleno NO estrena pantalla ni copy.** El visitante cae en el `EarlyAccessRequest`
  que ya existía, cuya copia dice literalmente *"opening gradually to small groups of
  players"* — que es la verdad en este caso. **Cero strings nuevos.**
- ⚠️ **`setAuthenticating(false)` ANTES de abrir el intake.** La waitlist sólo se renderiza
  desde `unauthenticated`; un gate que quedara en `authenticating` dejaría al visitante
  frente a un botón deshabilitado sin nada en vuelo. Hay un test que lo fija.
- ⛔ **Sólo un `open: false` explícito cierra.** Red caída, 429, 500, un body con otra forma,
  algo que no es JSON: todo eso abre. El fail-open no es descuido — el costo de errar hacia
  abierto es un login contra 39 lugares de margen; el de errar hacia cerrado es que nadie
  entra.
- ⚠️ **El `webServer.env` del VR no lo toca y no hace falta**: sin ruta que responder, el
  cliente cae en fail-open. Los tres tests viejos del gate corren así a propósito, y de paso
  dejan el fail-open probado desde afuera.

### El hallazgo que salió de un test rojo

`decideLoginCapacity` **cierra** ante una config rota, pero por esta ruta esa rama es
**inalcanzable**: `resolveCapacityLimit` repara `0` / `-5` / `"muchos"` al default **antes**
de que llegue. Escribí el test afirmando la doctrina y se puso rojo contra el comportamiento.

**Gana el comportamiento, y el test dice ahora la verdad.** Reparar es mejor que cerrar
*precisamente porque el default ya es seguro* (460 < 499): cuida la plata **y** deja la puerta
abierta, mientras que cerrar el producto entero por un typo en un env var es el mismo
fail-closed que el spec rechaza para la base caída. La rama fail-closed sigue viva para
cualquier otro origen de config (una fila con `NaN`, el día que exista).

---

## 3. La perilla en vivo — resuelto (segunda mitad de la sesión)

**Decisión del founder: la fila en Supabase**, con el pico de MiniPay de los primeros días
como evidencia — *"un redeploy tardó entre 8-10 minutos, en ese tiempo se subió, pasamos el
pico y la gente que entró ya nos rompió el arnés"*. Durante un pico, una perilla que exige
redeploy no es una perilla.

`51ad179` — migración `20260814000000_login_capacity_config.sql` + `lib/access/capacity-config.ts`.

- ⛔ **La fila le GANA al env var.** Si no ganara, la perilla en vivo no serviría de nada en
  cualquier entorno donde el env var esté seteado — que es justo producción. Los dos env vars
  quedan como **fallback**.
- ⛔ **El lector nunca devuelve "no sé"**: fila ilegible → env var → default seguro. Un lector
  de config que puede contestar `null` obliga a cada llamador a inventar qué hacer con eso, y
  ahí nacen los fail-closed accidentales — que acá significan "nadie entra a la app".
- ⚠️ **Singleton por construcción** (`boolean primary key check (id)`). Una tabla de config con
  dos filas es una tabla de config sin respuesta, y el bug se descubre el día del pico.
- ⚠️ **El check es `seat_limit > 0`, NO `< 499`.** El techo del plan es un hecho de Privy que
  puede cambiar con su pricing; hornearlo en un constraint haría que la migración mienta el día
  que lo suban.

### Y el bug que salió de explicárselo al founder

`6433703` — **el caché va ANTES del limitador.**

⛔ El limitador corta a **60 req/min por IP**, y detrás de CGNAT —el caso normal en móvil—
mucha gente comparte una sola IP de salida. El visitante 61 de un minuto recibía 429 y el
cliente **falla abierto**: el tope **se apagaba solo exactamente en el escenario para el que
existe**.

El arreglo no es subir el límite: un veredicto fresco **no hace trabajo de base**, así que no
hay nada que proteger. Cobrarle cuota a una respuesta gratis era lo que convertía al limitador
en el interruptor de apagado. Con el caché delante (10 s en memoria + `s-maxage=10` para que el
CDN absorba), una instancia toca la base como mucho una vez cada 10 s.

⚠️ **Precio: la perilla tarda hasta ~20 s** en surtir efecto (10 de memoria + 10 de CDN).
Contra los 8-10 minutos de un redeploy, es el intercambio que se quiso hacer.

## 4. El interruptor — `/admin/access`

**Lo que el founder pidió, textual:** *"mi botón de apagado o encendido del waitlist desde
cualquier lugar sin estresarme por queries, permisos, etc"*. No un dashboard: un botón.

`31a66f8` (la ruta) + `2453a7d` (la página).

- ✅ **La auth ya existía**: `ADMIN_TOKEN` + header `x-admin-token`, el patrón de
  `/api/admin/lite-stats`. **Verificado que está seteado en producción sin pedir credenciales**:
  esa ruta contesta **403** (configurado) y no 503 (ausente) en learn y en play. Cero secretos
  nuevos.
- ⛔ **El radio de daño acotado es lo que permite esta ceremonia.** Con el token, lo peor que se
  logra es apagar el tope (pagamos Privy) o ponerlo en 1 (nadie nuevo entra): **ningún dato se
  expone y las dos cosas se revierten en un tap.** ⚠️ **El día que esta página crezca hacia
  otras operaciones ese techo se cae, y la autenticación se rehace ANTES, no después.**
- ⛔ **`/admin` NO lleva `isDevSurfaceEnabled()`.** `/dev` es 404 en producción a propósito;
  esto tiene que andar justamente ahí. Lo protege el token, no la ausencia.
- ⚠️ **Acá el conteo SÍ viaja al cliente**, y es la diferencia con `/api/access/capacity`: esa
  la lee un visitante, ésta el founder detrás de un token. Sin el número, el botón no avisa nada
  hasta que ya cerró — **por eso esta página es también el aviso temprano, y no hizo falta
  construirlo aparte ni meterlo en `ops:health`.**
- ⚠️ El token viaja **por header**, nunca por la URL (historial, logs del CDN, Referer).
- ⚠️ Un tope por encima de 499 **se acepta y se avisa**, no se bloquea: el techo es un hecho del
  pricing de Privy y hornearlo haría que el botón mienta el día que lo suban.
- ⚠️ El limitador de esta ruta falla **abierto**, igual que el de la pública pero por otra razón:
  es el botón de emergencia y un Redis caído no puede dejar al founder sin él.

### El panel de ops que NO se construyó, y por qué

El founder preguntó por un `apps/ops` visual. **Se descartó por ahora**, y no por pereza: el día
que ese panel se deploya deja de ser un reporte y pasa a ser una superficie que guarda el
service role de producción — eso obliga a autenticación real, y la auth es la parte cara, no los
gráficos. El health en terminal se queda como está (el founder dijo que así está bien).
⚠️ **Y "operaciones" no es "el health con CSS"**: un panel que *ejecuta* necesita auditoría de
quién tocó qué. Es otro producto y merece su spec.

### ⛔ Lo que falta antes de aplicar

✅ **RESUELTO — la migración está aplicada en producción** (2026-08-14). Probe en Postgres
desechable primero (los cinco checks verdes), y después la aplicación real en **una
transacción**, con verificación en la misma corrida: tabla creada (no existía), fila
`460 / true`, RLS activo, `anon`/`authenticated` sin privilegios, `20260814000000` en el ledger.

⛔ **Deliberadamente NO se usó `supabase db push`.** El ledger de hosted estaba en
`20260810000000` y el repo tiene además **`20260811150000_content_overlay_sweeps` pendiente**;
un push habría corrido las dos. Se aplicó **sólo** el archivo autorizado, por psql.

⚠️ **Queda pendiente entonces `content_overlay_sweeps`** — también aditiva (dos columnas
nullable, pensada para deployarse antes de la ruta que las escribe). Es la que la memoria marca
como *"falta aplicar, o TODO guardado es 500"*. **Resolverla en su propio momento, no de
arrastre.**

### El riesgo que documenté y no arreglé

⛔ **El contador depende de `/api/telemetry`, que es best-effort por diseño** (traga sus
propios errores para no romper flujos del jugador). Un login cuya telemetría se perdió **no se
cuenta**, así que el número es un **SUB-conteo**: el tope cierra **más tarde** de lo que cree,
no antes. Está anotado en `browser-accounts.ts`. Hoy lo cubre el margen de 39; si el pozo se
acerca al tope, esto se mide antes de confiar en el número.

---

## 4. Dónde retomar

**P2P** — es lo que sigue en el orden recomendado ahora que el builder cerró. El spec está
READY con red-team hecho, y arranca resolviendo su único P0: *"el enlace sobrevive al login"*.

⚠️ **Y ahora hay una razón extra de secuencia**: el duelo es una máquina de repartir enlaces
que salen de la app. El spec asume dos personas que ya están dentro, pero un enlace se
reenvía, y cada invitado nuevo por web es un login. **El presupuesto ya existe antes de que
empecemos a repartirlos.**

---

## 4.b El build roto, y el hueco de verificación que lo dejó pasar

El primer deploy a producción **falló en el build** (`4fecb95`, 12:00 UTC). Nada llegó a
publicarse — Vercel corta antes.

```
Type error: Route "src/app/api/access/capacity/route.ts" does not match the
required types of a Next.js Route.
  "__resetCapacityCache" is not a valid Route export field.
```

Next valida los exports de un route handler contra una lista cerrada. Yo exporté un hook de
test. Fix (`9790ff9`): el estado del caché se muda a `lib/access/verdict-cache.ts`, donde el
hook cabe. **Cero cambio de comportamiento.**

⛔ **Lo que importa es por qué no lo vi, y es una invariante del repo, no un descuido puntual:**
la suite entera pasaba (**8.077 tests**) y `tsc --noEmit` daba **exit 0**. Esta validación **no
es de TypeScript**: la hace `next build`, que genera tipos por ruta y los compara. El único
comando del repo que la corre es `pnpm type-check` (`next build && tsc --noEmit`) — **no** el
`tsc` suelto que recomienda la higiene de comandos de CLAUDE.md, que es el que usé.

⚠️ **Regla que deja: en este repo, un cambio que toca `app/` no queda verificado con
`tsc --noEmit`.** Hace falta el build, o el guard.

✅ **Y el guard existe desde este incidente**: `src/app/api/__tests__/route-exports-guard.test.ts`
recorre los **55** `route.ts` del repo y falla ante cualquier export fuera de la lista de Next.
Compra en 40 ms lo que costaba un build de 2 minutos, en la corrida que uno sí hace siempre.

---

## 4.c El interruptor deployado que redirigía a `/`

Segundo incidente del deploy, reportado por el founder al abrirlo:
`/control-tower/access` iba a parar a la raíz.

**La página estaba bien y su ruta también.** Faltaba **una palabra** en el matcher del
middleware (`middleware.ts`): excluía `api|_next|_vercel|dev|lite-debug` y no `control-tower`.
Todo path no excluido pasa por el routing de locale, que lee el primer segmento como un idioma
y redirige. Fix: `7021909`.

⛔ **Es la MISMA FAMILIA que el build roto de arriba, y por eso van juntos acá: código correcto
que la plataforma descarta en silencio.** En los dos casos no hubo error, ni log, ni test rojo —
con la app entera en verde, la superficie simplemente no existía desde afuera.

⚠️ **La regla que dejan las dos, y es una sola:** *un cambio que agrega una superficie no se
verifica con la suite.* Hay que **abrirla**. Vitest y `tsc` prueban que el código hace lo que
dice; ninguno de los dos prueba que Next se lo entregue a alguien.

✅ Guard: el bloque `matcher del middleware` en `src/__tests__/middleware.test.ts` corre contra
el `config` **real** (una lista duplicada en el test pasaría en verde con el middleware
equivocado) y cubre las dos direcciones — que las seis superficies no-producto queden fuera, y
que `/`, `/hub` y `/en/exercises` sigan ruteando, porque un matcher que excluya de más deja al
producto sin i18n.

---

## 4.d Simulacro en producción — PASADO (2026-08-14)

El founder lo corrió entero, y probó más de lo que el guión pedía:

| paso | resultado |
| --- | --- |
| El botón lee el pozo en prod | ✅ `6 / 460` leído de Supabase — **descarta el fallo silencioso** (si el conteo no llegara, diría "No se pudo contar") |
| Tope en `1` → gate | ✅ rebota a la waitlist, Privy no se entera |
| Tope en `6` con pozo `6` | ✅ cierra — confirma que el límite es el número **al que se corta**, no cuántos entran |
| Vuelta a `460` | ✅ reabre, y en **bastante menos de 20 s** |
| Login real con correo nuevo | ✅ entra, y el pozo pasa de **5 → 6** |

⛔ **Ese último es el que no se podía simular: valida la cadena entera de punta a punta** —
login real → fila en `account_first_seen` con `first_container='browser'` → el contador la ve.
**El riesgo de sub-conteo documentado en `browser-accounts.ts` no se materializó**: la
telemetría, que es best-effort por diseño, registró el alta.

⚠️ Y también confirmó que el allowlist de Privy sigue haciendo su trabajo: un correo no
allowlisted fue **rechazado por Privy**, no por nuestro tope. Los dos controles conviven y son
distinguibles.

📌 Sobre los ~20 s: era un **techo** (10 de memoria + 10 de CDN en el peor caso), no una
estimación. Casi nunca se acumulan — el caché de memoria es por instancia y el del CDN sólo
existe si alguien ya pidió esa ruta en ese PoP.

---

## 5. El orden para abrir la web, que es lo que el founder preguntó

⛔ **Apagar el allowlist de Privy NO transfiere el control a nuestro código.** El tope es un
presupuesto que vive en nuestro cliente; el candado sigue siendo el allowlist. Lo que nuestro
código sí controla es el pico orgánico a través de nuestra UI, que es el riesgo real — hay
**un solo `login()` en toda la app** (`web-access-gate.tsx:145`) y está guardado.

Cada paso es reversible, y el 2 existe porque el modo de fallar es **silencioso**: si el conteo
no llega a la base, la ruta contesta `open: true` para siempre y se ve idéntica a una que
funciona.

1. ✅ **Migración aplicada.** Falta **deployar** el código (36+ commits sin pushear).
   Nada visible cambia — 5 de 460.
2. **Smoke**: abrir `/admin/access`, pegar el `ADMIN_TOKEN` una vez, poner el tope en **1** y
   pegarle a `/api/access/capacity`. `{"open":false}` → el tope cuenta y cierra.
   `{"open":true}` → el conteo **no llegó a la base** y el tope está inerte: mirar
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de ese entorno antes de seguir.
   ⚠️ Esperar ~20 s por el caché.
3. Devolver el tope a su valor real **desde el mismo botón**.
4. **Recién ahí** sacar el allowlist en Privy. Ese es el momento en que la web se abre.
5. Si algo sale mal: volver a prender el allowlist. Es un toggle y **no echa a los que ya
   entraron** (*"All existing users will still be permitted to login"*).

---

## Preguntas abiertas

1. **¿Cuál es tu número?** La fila arranca en 460. Con 5 cuentas en el pozo no urge — pero el
   día que urja ya es tarde para pensarlo.
2. **¿Privy exporta la clave del usuario?** Sigue sin verificar. La más barata y de mayor
   impacto de todas las que arrastramos.
3. **¿Se le avisa a quien quedó en la waitlist cuando se reabre?** Sin eso, cerrar es perderlos
   igual — que es justo lo que querías evitar. Hoy nadie está en esa situación (el tope no
   cerró nunca), así que es una decisión que se puede tomar tranquila.
