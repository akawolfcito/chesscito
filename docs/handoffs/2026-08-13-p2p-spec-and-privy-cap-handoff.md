# Handoff — Spec del P2P y tope de Privy (2026-08-13, segunda mitad)

**Branch:** `main` (local) · **Sin pushear:** 28 commits
**Sesión anterior de este día:** `2026-08-13-exercise-builder-layout-handoff.md` (el builder)

---

## Lo que se hizo

### 1. Spec del duelo, en tres documentos

| archivo | qué es |
| --- | --- |
| `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md` | el spec, **versión mínima** (310 líneas) |
| `docs/specs/2026-08-13-p2p-chess-duel-by-link-redteam.md` | red-team, 3 pasadas |
| `docs/specs/2026-08-13-login-capacity-cap-spec.md` | el tope, aparte |

**Alcance final, en una frase:** dos personas que **ya están dentro** se pasan un enlace y juegan
una partida de ajedrez completa. Sin waitlist, sin tope, sin embudo, sin espectadores, sin apuesta.

⚠️ **Por qué tan chico:** es el **tercer spec** del mismo feature. La v2 y la v3 eran técnicamente
correctas y **ninguna se construyó** — demasiado grandes para caber en una sesión. La pregunta que
ninguna contestó es *"¿cuál es la versión más chica que puedo poner frente a dos personas esta
semana?"*.

**Veredicto: READY para `/tdd`**, con **una condición**: resolver *"el enlace sobrevive al login"*
como parte del trabajo. Es el único P0 vivo — sin eso, todo invitado web sin sesión cae en el hub
sin saber a qué lo invitaron y el duelo queda `awaiting-opponent` para siempre.

#### Lo que hay que saber antes de tocarlo

- ⛔ **La regla dura, intacta**: ningún `walletAddress` ni identificador del cliente autoriza un
  asiento. La wallet **se vincula**, nunca autoriza. Es lo que mató a la v2 — y **sigue vivo en
  producción**: `api/games/route.ts:21` valida `isAddress()`, o sea **el formato, no la propiedad**.
- ✅ `chess.js@1.4.0` **ya es dependencia**. El árbitro tiene base.
- ✅ El árbitro **no reconstruye la partida en cada jugada**: el `fen` se guarda junto a `moves` y se
  valida contra él. Las movidas quedan para repetición triple y para mostrar la partida.
- ⚠️ **La cookie no es el camino principal en móvil**: abrir el enlace en el navegador in-app de
  WhatsApp y después "abrir en Chrome" es otro contexto y la cookie no viaja. El token vuelve **una
  vez en el body** y el cliente lo guarda.
- ⚠️ **Expirar un duelo en curso SÍ inventa un ganador** (comportamiento 15) y expirar uno sin
  empezar **no** (14). La incoherencia está **aceptada a sabiendas**, con su razón — y con un
  disparador: **si algún día cuelga valor del resultado, se re-decide antes**.
- ⛔ **Nada cuelga del resultado, y es una decisión.** `sign-badge` y `sign-score` firman sin
  verificar lo ganado, y ese riesgo está aceptado *precisamente porque* nada de valor cuelga de un
  score. Un duelo con premio activa el disparador del backlog §4 y exige server-verified progress.

### 2. Los 499 de Privy — análisis y primera capa construida

`docs/product/2026-08-13-privy-capacity-and-exit.md` y el commit `2ca5ff80`.

**Decisión del founder:** el tope va **duro en código**, para no repetir el costo inesperado de la
infra. Y salir de Privy **no le preocupa**: con re-minteo de insignias es manejable — eso desactiva
el riesgo de lock-in que yo había marcado.

**Lo construido** (`lib/access/login-capacity.ts`, 15 tests): la lógica pura de decidir si se admite
un login más.

✅ **El conteo NO necesita migración**: `account_first_seen` ya existe y guarda `first_container`,
que es literalmente `"minipay" | "browser"`. La población que factura Privy es la de browser.

⚠️ **Contamos cuentas TOTALES, no MAU, y está bien**: el MAU nunca puede superar la cantidad de
cuentas que existen, así que topear el total **garantiza** el MAU. Cierra antes de lo necesario,
jamás después. **El corolario incómodo**: el número **sólo sube**, así que con el tiempo el tope se
vuelve más conservador de lo necesario. Si algún día estorba, la respuesta es **contar sesiones en
30 días**, no subir el tope a ciegas.

⛔ **Las dos ramas de "ante la duda" van para lados OPUESTOS, a propósito:**

| duda | qué hace | por qué |
| --- | --- | --- |
| config rota (tope 0, negativo, NaN, Infinity) | **cierra** | es error nuestro; se ve y se arregla antes de perder a nadie |
| conteo imposible (DB caída) | **abre** | una DB caída no puede dejar a todos afuera; el allowlist de Privy sigue debajo como red real |

⛔ **El default es 460, no 499**, y no es un redondeo: son 39 lugares de margen porque el chequeo
**no puede ser transaccional** con el contador de Privy. Diez personas que tocan ENTER a la vez
cerca del umbral entran las diez.

⛔ **Y es un PRESUPUESTO, no un candado.** Vive en nuestro cliente. Quien **concede** el acceso
sigue siendo el allowlist nativo de Privy, server-side. Si alguien lo lee como control de acceso y
apaga el allowlist *"porque ya tenemos el tope"*, el acceso queda abierto de par en par.

---

## Dónde retomar

### Bloqueado por una decisión tuya

⚠️ **La perilla sin redeploy.** Hoy el tope sale de config estática, y en Vercel **cambiar un env
var exige redeploy** — justo lo que querías evitar. Dos salidas:

1. **Tabla chica de config en Supabase.** Es una migración, y por regla del repo necesita tu
   confirmación de entorno antes de aplicarla.
2. **Vercel Edge Config.** Sin migración, pero agrega una dependencia de plataforma.

**Sin esa decisión, el tope queda con perilla estática** — funciona, pero mover el número cuesta un
deploy.

### Lo que sigue sin bloqueo

1. **Cablear el tope**: la ruta que cuenta (`GET /api/access/capacity`) y el chequeo en
   `startLogin()` — ⛔ **antes** de la llamada a `login()` de `web-access-gate.tsx:120`. Un tope
   posterior llega tarde por construcción: Privy cuenta el MAU al refrescar sesión, así que el login
   **ya gastó** lo que el tope quería proteger.
2. **`/tdd` del duelo**, con la condición del enlace-a-través-del-login.
3. **Monetización** — el frente que el founder quiere abrir: que más gente mintee la partida o
   consuma comprables. ⚠️ **Es un frente propio y merece cabeza fresca**, no colgarse del final de
   otra cosa. MiniPay es la palanca porque **no gasta MAU**: el crecimiento por ahí ya es gratis e
   ilimitado, y la web es el canal *medido*, no el de crecimiento.

---

## Preguntas abiertas

1. **¿Privy permite exportar la clave del usuario?** **No lo verifiqué.** Es la pregunta más barata
   y de mayor impacto: si sí, el problema de las insignias soulbound desaparece para siempre y el
   plan B se puede elegir por precio en vez de por lock-in.
2. **¿Cuál es tu número de tope?** El default es 460. Depende de cuánta factura estás dispuesto a
   pagar; lo único cierto es que **debe ser menor que 499**.
3. **De las cuentas que ya entran, ¿cuántas generan alguna transacción?** Es una consulta, no un
   feature, y decide si crecer por web se paga solo o pierde plata.
4. **¿Se le avisa a quien quedó en la waitlist cuando se reabre?** Sin eso, cerrar es perderlos —
   que es justo lo que el founder quiere evitar.
5. **Del duelo**: duración de la ventana (propuesta 48 h), dónde vive el duelo, notificación de
   turno, y qué métrica declara que funcionó (propuesta: **duelos con al menos una jugada de cada
   asiento**, no duelos creados).
