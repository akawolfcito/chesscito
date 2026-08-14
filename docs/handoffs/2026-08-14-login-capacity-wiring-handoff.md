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

## 3. Lo que NO quedó cubierto, y por qué

Dos acceptance criteria del spec siguen abiertos, **los dos por la misma decisión pendiente**:

- [ ] *"Cambiar `limit` cambia el comportamiento sin redeploy"*
- [ ] *"`enabled: false` reabre por completo"* — funciona, pero también cuesta un deploy

El spec quería la perilla en **una fila**, no en un env var. Salió con **perilla estática**
porque la decisión es tuya y no bloqueaba lo demás:

1. **Tabla chica de config en Supabase** — es una migración, y por regla del repo necesita tu
   confirmación de entorno antes de aplicarla.
2. **Vercel Edge Config** — sin migración, agrega una dependencia de plataforma.

⚠️ **El cableado no cambia con ninguna de las dos**: sólo se reemplaza el `resolveCapacity*`
de `route.ts` por la lectura de la fila. El trabajo de hoy no se tira.

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

## Preguntas abiertas

1. **¿Cuál es tu número?** Sigue en 460 por default. Con 5 cuentas en el pozo, no urge — pero
   el día que urja ya es tarde para pensarlo.
2. **¿La perilla va a fila o a Edge Config?** Ver §3.
3. **¿Privy exporta la clave del usuario?** Sigue sin verificar. La más barata y de mayor
   impacto de todas las que arrastramos.
4. **¿Se le avisa a quien quedó en la waitlist cuando se reabre?** Sin eso, cerrar es perderlos
   igual — que es justo lo que querías evitar. Hoy nadie está en esa situación (el tope no
   cerró nunca), así que es una decisión que se puede tomar tranquila.
