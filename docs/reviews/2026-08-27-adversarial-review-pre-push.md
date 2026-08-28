# Revisión adversarial — los 38 commits antes del push

**Fecha:** 2026-08-27 · **Alcance:** `origin/main..main`, 109 archivos, ~6.845 inserciones
**Método:** lectura del diff y del código vivo. Cada hallazgo dice **dónde** y **qué escenario
lo rompe**. Lo que no pude confirmar leyendo código está marcado como tal.

> Postura deliberadamente cínica: se asume que hay problemas. Que la suite esté verde
> (9191 + 271) y el VR en 68/68 **no es evidencia** contra ninguno de estos hallazgos —
> varios son precisamente cosas que ninguna prueba actual mira.

---

## 🔴 Bloqueantes — decidir antes del push

### 1. La pausa del Season Pass es SÓLO de UI: la API sigue otorgando el pase

`apps/web/src/app/api/verify-payment/route.ts:149-165, 231-310`

La ruta valida `isLiteModeServer()` pero **nunca** consulta `isSeasonPassSalesEnabled()`.
Todo el camino de otorgamiento (`consume_lite_season_pass_payment`, el insert en
`lite_season_passes`, el `SET` en Redis) está intacto y activo.

**Escenario de fallo, y no es hipotético:** un jugador con la app abierta durante el
deploy conserva el bundle JS viejo, que todavía muestra la sheet de compra. Paga, la
transacción se confirma, el cliente llama a `verify-payment`, y **el servidor cobra y
acredita un pase que el producto decidió no vender**. Lo mismo aplica a una pestaña
dormida, a un bundle cacheado o a cualquiera que repita la llamada a mano.

El handoff declara como resultado esperado *"Compras nuevas de Season Pass: **cero**"*.
Tal como está el código, eso no está garantizado: sólo es improbable.

⛔ Es exactamente la invariante que el repo ya aprendió y escribió:
**el candado va en quien OTORGA la capacidad, no en los llamadores**. Acá está en los
llamadores. `isSeasonPassSalesEnabled()` es un simple `process.env`, así que funciona
server-side: el arreglo es una guarda de tres líneas antes de la rama del pase, devolviendo
`season_pass_unavailable` como ya hace el caso de Full mode.

⚠️ Al agregarla, la guarda debe rechazar **antes** de mover dinero, y hay que decidir
explícitamente qué pasa con un pago que ya está en la cadena (¿reembolso manual?, ¿acreditar
igual y loguear?). Rechazar después de cobrar es peor que no rechazar.

### 2. Despausar la venta requiere DOS acciones desacopladas, y nada las vincula

`apps/web/src/lib/feature-flags.ts:138` (env var) vs
`apps/landing/src/lib/onboarding/sales.ts:18` (constante hardcodeada)

La app se reactiva con `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED=true` + redeploy. El landing
se reactiva editando código y desplegando otro proyecto. **El landing no lee esa variable**
(verificado: cero referencias).

**Escenario:** se decide volver a vender, se prende la env var en Vercel. La app vende; el
carrusel del landing sigue mudo, para siempre, hasta que alguien recuerde que hay un segundo
lugar. Es **la misma brecha que este ciclo acaba de arreglar en la otra dirección** — la
pausa no había llegado al landing — reintroducida en el camino de vuelta.

El test `paused-pass-is-not-advertised.test.ts` no lo protege: lee la constante local, así
que con la app vendiendo y el landing pausado, sigue verde. Ninguna de las dos suites puede
ver la desincronización, porque la verdad vive en el entorno de Vercel.

---

## 🟠 Importantes

### 3. El comprador ve su pase como "no disponible" en cada carga en frío

`apps/web/src/lib/season-pass/challenge-card-view.ts:100-101`

```ts
if (entitlement.status === "loading") {
  return salesPaused ? { state: "unavailable" } : { state: "loading" };
}
```

Correcto que la pausa no revoca nada — verificado, un entitlement activo cae a su card
normal. Pero **mientras resuelve**, quien pagó ve el panel de hábito sin su pase, y recién
después aparece la card real.

El parpadeo del invitado se arregló **mudándolo al comprador**. Son menos personas (17),
pero son las que pagaron, y para ellas el síntoma se parece a "perdí lo que compré". El
comentario del código lo asume ("the card comes back a beat later"); lo que no consta es
que se haya elegido a sabiendas de a quién le toca ahora.

### 4. `unreadCount` puede mentirle al badge, y los mensajes viejos desaparecen sin aviso

`apps/web/src/app/api/inbox/route.ts:108, 115-122`

`.limit(50)` sin paginación, y `unreadCount` se calcula **sólo sobre lo que volvió**.

**Escenario:** una wallet con 60 mensajes, de los cuales 15 sin leer están entre los 10 más
viejos. La API devuelve 50, el badge cuenta los no leídos de esos 50, y los otros 15 **no
existen para el jugador ni para el contador**. No hay error, no hay log, no hay forma de
notarlo desde afuera. Hoy el volumen es 1 mensaje por wallet, así que no muerde — pero el
día que muerda, lo hace en silencio.

### 5. Un tipo de mensaje desconocido se descarta sin dejar rastro

`apps/web/src/app/api/inbox/route.ts:71-72, 115-117`

`toMessage` devuelve `null` si `isInboxMessageType` no reconoce el tipo, y el `.filter()`
lo elimina. Sin log, sin métrica.

**Escenario:** se inserta un tipo nuevo desde el script de ops (o desde una versión más
nueva) antes de desplegar el cliente que lo entiende. El mensaje **se envía, se guarda, y es
invisible** — además de no contar para el badge. El operador ve "sent. message id: …" y
concluye que llegó.

### 6. Se renombró el evento para poder medir, y nada mide el nombre nuevo

`apps/web/src/lib/scores/save-telemetry.ts:151`

`score_save_deferred` no aparece en un solo consumidor: ni en `scripts/ops/`, ni en
`ops:health`, ni en ningún dashboard o query del repo (verificado por grep).

El handoff espera *"`score_save_deferred` aparece, absorbiendo ese volumen"*. Nadie lo va a
ver aparecer. Lo que se va a observar es `score_save_failed` cayendo ~96% y **ningún lugar
donde el volumen reaparezca**, que es indistinguible de haber perdido la telemetría.

⚠️ No hay allowlist de nombres de evento (verificado), así que el evento sí se emite y se
guarda. El problema es de observabilidad, no de pérdida de datos.

---

## 🟡 Menores, pero reales

### 7. `formatUsd6` trunca en vez de redondear

`apps/landing/src/lib/pricing/plans.ts:20-23`

`Number(value / 10_000n) / 100` hace división entera **primero**. Un precio de `1_995_000n`
($1,995) se publica como **$1.99**: la página anuncia menos de lo que cobra, que es
literalmente el fallo que el guard de precios existe para evitar. El guard no lo atraparía —
compara las constantes `bigint`, no la cadena renderizada, y el único assert de string está
hardcodeado a `"$0.05+"`. Hoy los tres precios son céntimos exactos, así que no muerde.

### 8. El canonical está hardcodeado y el sitemap es dinámico

`apps/landing/src/app/pricing/page.tsx:39` vs `apps/landing/src/app/sitemap.ts:3`

El canonical dice literalmente `https://www.chesscito.com/pricing`; el sitemap usa
`process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com"`.

Pueden divergir sin que nada avise: si `NEXT_PUBLIC_APP_URL` alguna vez apunta a otro host
(preview, o un dominio sin `www`), el sitemap publica una URL y la página declara otra. En
una página cuyo propósito es **ser encontrada por un directorio**, ese par inconsistente es
justo el detalle que un evaluador revisa.

✅ Verificado que `/pricing` **sí** está en el sitemap y que `robots.ts` permite todo — la
afirmación del comentario es cierta.

### 9. Una wallet enmascarada sigue siendo identificable en una cadena pública

`scripts/ops/send-inbox-message.ts:48-49`

`maskWallet` muestra 6 + 4 caracteres. Sobre datos on-chain públicos, prefijo + sufijo suele
bastar para reidentificar la dirección exacta. Es salida de terminal para el operador, así
que el riesgo es bajo — pero **no debe tratarse como anonimizada** si alguna vez se pega en
un issue, un doc o un canal compartido.

✅ Por lo demás el manejo de secretos está limpio: cero wallets nuevas en el diff, cero
`NEXT_PUBLIC_` con claves, y `private/` sólo aparece como *ruta*, nunca con contenido.

### 10. Deriva de documentación en el contrato de eventos

`docs/specs/savescore-offchain-peones.md:208` sigue enumerando `score_save_failed` como el
evento de error sin mencionar `score_save_deferred`. Es el doc que alguien va a leer para
saber qué eventos existen.

### 11. El fixture del VR no monta lo que el ciclo agregó

`apps/web/src/app/dev/learn-hub/fixture.tsx` no monta ni el chip del Inbox ni el panel del
hábito reformado. Sus 68 baselines verdes **no son evidencia** sobre ninguno de los dos.
Ya está anotado como follow-up; se repite acá porque es la razón por la que varios de los
hallazgos de arriba no los podía atrapar ninguna prueba existente.

---

## Lo que se auditó y salió limpio

- **La pausa no revoca acceso.** Verificado en `challenge-card-view.ts`: `salesPaused` sólo
  afecta `loading` y `none`. Un entitlement activo cae a la card normal (ver #3 por el matiz).
- **PATCH del Inbox**: filtra por `id` **y** `wallet`, e `is("read_at", null)` lo hace
  idempotente. Un uuid adivinado no alcanza para marcar el mensaje de otro.
- **Wallet malformada**: `safeWallet` envuelve el `normalizeWallet` que tira, y devuelve 400.
- **RLS**: la tabla niega `anon` y `authenticated`; el service role vive sólo en la ruta.
- **Índices** `(wallet, unread)` y `(wallet, created_at)` presentes en la migración.
- **`LearnShopSheet`** delega en `SeasonPassSheet`, que se auto-gatea: no es una segunda puerta.
- **Secretos**: limpio (ver #9).

---

## Recomendación

**#1 y #2 antes del push.** El resto puede ir después sin riesgo: #1 es la única que puede
cobrarle a alguien por algo que decidimos no vender, y #2 es la que hace que revertir la
decisión quede a medias sin que nadie se entere.
