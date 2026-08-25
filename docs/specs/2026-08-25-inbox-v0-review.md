# Inbox V0 — revisión del spec antes de implementar

> **Read-only.** Nada implementado todavía. Esta es la revisión que pediste.

---

## Resumen

El spec es bueno y está bien acotado, pero **tres de sus decisiones chocan con código
que ya existe**, y una cuarta contradice tu propio pedido de "1 botón, 1 pantalla y
punto". Ninguna es difícil de resolver — pero las cuatro son más baratas de arreglar
ahora que después.

---

## ⛔ 1. El icono de regalo YA está ocupado

El spec dice *"el icono de regalo existente en el header debe convertirse en el acceso
principal al Inbox"*.

**Ese icono es el claim del Welcome Package.** Cuelga de `useLiteWelcomeGiftClaim`, y lo
consumen tres superficies: `welcome-package-stamp.tsx`, `daily-tactic-slot.tsx` y
`exercises-screen.tsx`.

No es un adorno reciclable: `welcome_pack` tiene **7.101 filas** en `peones_ledger` — es
de lejos la fuente de Peones más usada del producto, y es **la primera interacción de
todo jugador nuevo**. Reutilizar ese icono para el Inbox le quita al recién llegado su
regalo de bienvenida para mostrarle una bandeja vacía.

**Recomendación: un icono propio para el Inbox, al lado del de regalo.** El header ya
tiene fila de chips (trofeos, idioma, Connect/PRO). Un sobre o campana ahí no compite
con nada y no toca un flujo con 7.101 usos.

⚠️ Si preferís igual el de regalo, es una decisión de producto legítima —
pero hay que decidir **qué pasa con el claim del welcome pack**, no dejarlo
implícito.

---

## ⛔ 2. `account_ref` no puede ser el destinatario

El spec pide `recipient_ref` y dice, con razón, no revertir la separación de privacidad
de `account_ref`. Pero **usar `account_ref` como destinatario es imposible**, no solo
indeseable:

`account_ref = HMAC-SHA256(wallet, TELEMETRY_ACCOUNT_SECRET)` se deriva **en el servidor
de telemetría** (`api/telemetry/route.ts:248`). **El cliente nunca lo conoce.** Un
navegador no puede pedir "mis mensajes" con un identificador que no tiene.

**Recomendación: el Inbox usa `wallet`, exactamente como el resto del producto.**

| Tabla | Identidad |
| --- | --- |
| `peones_ledger`, `peones_balances` | `wallet` |
| `focus_day_ledger` | `wallet` |
| `lite_season_passes`, `pro_subscriptions` | `wallet` |
| `analytics_events` | **`account_ref`** ← el único, y así debe seguir |

La separación que hay que preservar no es "no guardes wallets" — el producto entero se
apoya en la wallet. Es **que analytics no pueda unirse con producto**. Un `inbox_messages`
con `wallet` respeta esa línea; uno con `account_ref` la cruzaría, porque obligaría a
exponer el HMAC al cliente.

**Esto simplifica el spec en vez de complicarlo.** Y las APIs ya funcionan así
(`GET /api/peones/balance?wallet=0x…`).

---

## ⚠️ 3. Dos tablas es más de lo que V0 necesita

El spec propone `inbox_messages` + `inbox_message_state`. Esa separación existe para
**broadcast**: un mensaje, N destinatarios.

Con **18 wallets activas**, insertar N filas cuesta nada y ahorra un join en el camino
caliente (el `unread_count` del Hub, que el spec pide que sea ligero).

**Recomendación: una tabla.**

```sql
inbox_messages (
  id           uuid primary key,
  wallet       text not null,
  type         text not null check (type in
                 ('announcement','achievement','gift','milestone')),
  title        text not null,
  body         text not null,
  cta_label    text,
  cta_href     text,
  read_at      timestamptz,          -- null = no leído
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);
create index on inbox_messages (wallet, read_at);
```

**Lo que dejo fuera a propósito, y por qué:**

| Campo del spec | Veredicto |
| --- | --- |
| `image_key` | Sin uso en V0; el renderer es uno solo |
| `reward_type` / `reward_payload` | ⛔ **El claim está explícitamente fuera de este ciclo.** Un campo que nada escribe ni lee es deuda que parece feature |
| `claimed_at` | Ídem — vuelve cuando exista el claim |

Cuando llegue el broadcast real, `inbox_message_state` se agrega sin migrar lo viejo.

---

## ⚠️ 4. El spec es más grande que "1 botón, 1 pantalla"

Vos pediste algo *"tan pequeño y útil como el icono de compra de Peones"*. El spec pide
badge + teaser + pantalla + detalle + 4 tipos + seeds + 4 eventos.

**Mi recomendación de recorte, para llegar antes a algo que se pueda leer:**

| Elemento | Veredicto |
| --- | --- |
| Icono + badge en el header | ✅ **Núcleo** |
| Pantalla `/inbox` con la lista | ✅ **Núcleo** |
| Estado read/unread persistente | ✅ **Núcleo** |
| Detalle del mensaje | ✅ **Expandir la card en la lista**, no pantalla aparte. Los mensajes son cortos; una segunda pantalla es un tap extra sin contenido que lo justifique |
| **Teaser en el slot del Season Pass** | ⚠️ **Segundo paso.** Es la pieza más cara (toca el Hub, el layout y el VR) y la menos necesaria: el badge del header ya avisa. Sale sola después, cuando el Inbox exista |
| 4 tipos de mensaje | ✅ Barato — es un `check` y un icono por tipo |
| Seeds dev-only | ✅ Vía `/dev`, con el catálogo que ya tenemos |

**Eso es "1 botón y 1 pantalla".** El teaser es V0.1.

---

## ⚠️ 5. El idioma de los mensajes

Los ejemplos del spec están en español ("10 Días de Focus!"). **La UI del producto es
inglés**, con override ES en `messages/es.ts`.

**Recomendación:** el contenido de los mensajes vive **en la fila**, no en `editorial.ts`
— es contenido operativo, no copy de producto. Para V0, escribir el mensaje en el idioma
del destinatario al insertarlo. Los rótulos de la pantalla (Buzón, Nuevo, Anterior) sí
van por el sistema de traducción.

⚠️ Y aplica el brief de puntuación que acabamos de fijar: sin em-dash, ellipsis `…`, un
`!` por pantalla.

---

## Identidad y RLS

Mismo patrón que `focus_day_ledger`, que ya está en producción y auditado:

- **RLS deny-total** para `anon` y `authenticated`. Nadie llega directo desde el cliente.
- El acceso va por **API route con service role**, que recibe `?wallet=0x…` y filtra.
- `PATCH /api/inbox/:id/read` valida que el mensaje **pertenezca** a esa wallet antes de
  marcarlo.

⚠️ **Sinceridad sobre el modelo:** esto no es autenticación — cualquiera que conozca una
wallet podría pedir su inbox, igual que hoy puede pedir su balance de Peones. Es el
modelo que el producto ya tiene. **Mientras el Inbox no lleve nada sensible ni valor
reclamable, es aceptable.** El día que lleve un claim de dinero, necesita el mismo
tratamiento que el asiento del duelo: una credencial no adivinable emitida por el
servidor. Lo dejo escrito para que esa decisión no se tome por omisión.

---

## El primer mensaje real

La wallet elegible ya tiene su evidencia en `private/`. El mensaje se crea con un
**script operativo que lee de ahí**, nunca con una migración ni un fixture versionado.
El repo es público.

Texto: usar **"10 Focus Days"** y jamás "racha" ni "streak" — fueron 10 días en 6 tramos
separados, con un máximo de 4 seguidos. Llamarlo racha sería falso y el jugador lo sabe.

⚠️ Y como el claim no existe en este ciclo, el CTA no puede prometer una mecánica: cierra
en "Tu regalo estará disponible muy pronto", nunca en un monto.

---

## Analytics

Los cuatro eventos propuestos están bien. Dos precisiones:

- `inbox_teaser_viewed` **no existe todavía** si el teaser se pospone.
- ⛔ **`inbox_opened` desde un `useEffect` es la trampa de `peones_balance_viewed`**, que
  hoy emite 26.979 eventos sin que nadie lo haya pedido y es el evento más ruidoso del
  producto. El Inbox emite **en el tap**, nunca en el render.
- `message_id` va tal cual (es un uuid nuestro, no un identificador de persona). **Nunca**
  el `body` ni la wallet.

---

## Lo que propongo construir, en orden

1. Migración `inbox_messages` + RLS deny-total (mismo patrón que `focus_day_ledger`)
2. `GET /api/inbox?wallet=` y `PATCH /api/inbox/:id/read`
3. Hook de `unread_count` — una query de conteo, sin cuerpos
4. Icono + badge en el header
5. Pantalla `/inbox` con lista y card expandible
6. Seeds en `/dev/inbox`, dev-only
7. Los 4 eventos, en el tap
8. Script operativo privado para el mensaje real

**Fuera de este ciclo, confirmado:** claim, rewards, collection, badges persistentes,
$0.33 on-chain, push, campañas, y **el teaser del Hub** (que pasa a V0.1).

---

## Preguntas que necesito que decidas

1. **¿Icono propio o el de regalo?** Si es el de regalo, qué pasa con el claim del
   welcome pack.
2. **¿Confirmás el recorte del teaser a V0.1?** Es lo que separa "1 botón 1 pantalla" de
   un batch bastante más grande.
3. **¿Detalle como card expandible** (mi recomendación) **o pantalla aparte?**
