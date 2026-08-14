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

### ⛔ Lo que falta antes de aplicar

**La migración NO se aplicó a ningún entorno, y su SQL no se ejecutó en ninguna parte** —
Docker no estaba levantado para el probe. El probe está escrito
(`scratchpad/capacity-probe.sql`: verifica que parsee, que el singleton sea singleton, que
`seat_limit = 0` se rechace, que re-aplicarla no pise una perilla ya movida, y que `anon` reciba
permission denied). **Correrlo antes de tocar producción.**

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

## 5. El orden para abrir la web, que es lo que el founder preguntó

⛔ **Apagar el allowlist de Privy NO transfiere el control a nuestro código.** El tope es un
presupuesto que vive en nuestro cliente; el candado sigue siendo el allowlist. Lo que nuestro
código sí controla es el pico orgánico a través de nuestra UI, que es el riesgo real — hay
**un solo `login()` en toda la app** (`web-access-gate.tsx:145`) y está guardado.

Cada paso es reversible, y el 2 existe porque el modo de fallar es **silencioso**: si el conteo
no llega a la base, la ruta contesta `open: true` para siempre y se ve idéntica a una que
funciona.

1. Aplicar la migración (probe primero) y deployar. **Nada visible cambia** — 5 de 460.
2. **Smoke**: poner `seat_limit = 1` en la fila y pegarle a `/api/access/capacity`.
   `{"open":false}` → el tope cuenta y cierra. `{"open":true}` → el conteo **no llegó a la
   base** y el tope está inerte: mirar `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de ese
   entorno antes de seguir. ⚠️ Esperar ~20 s por el caché.
3. Devolver `seat_limit` a su valor real.
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
