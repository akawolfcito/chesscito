# Pre-flight del duelo — qué cerrar antes de repartir links

**Fecha:** 2026-09-02 · **Tipo:** verificación read-only. Nada tocado, nada desplegado.
**Motivo:** antes de exponer el duelo a gente real, saber qué está roto o sin cerrar.
**Método:** sondas HTTP contra producción y preview · suite de tests · lectura de los dos
red-teams · verificación en código de cada hallazgo del barrido.

---

## ✅ Lo que está sano (verificado, no supuesto)

### El link de i18n NO está roto

Era la sospecha principal. Medido en vivo:

| Sonda | Resultado |
|---|---|
| `play.chesscito.com/en/arena?duel=X` | 307 → `/arena?duel=X` · **200, 1 salto, `duel` intacto** |
| `preview.chesscito.com/en/arena?duel=X` | ídem · 200, 1 salto |
| `/en/en/arena?duel=X` (duplicación literal) | se auto-corrige → `/arena?duel=X` · 200 |
| `/es/arena?duel=X` | **200, 0 saltos** |

**El parámetro `duel` sobrevive el redirect en los cuatro casos.** El bug que se recordaba
en preview no está presente hoy.

🔎 **Descubrimiento colateral:** que `/es/arena` responda 200 **sin redirect** significa que
`NEXT_PUBLIC_I18N_ES_READY` está **prendido en producción**. El código lo declara default OFF
y el inventario de flags lo daba por apagado. No rompe nada — es otro caso de estado real que
no vive en el repo y sólo se ve desde afuera.

### Lo demás que pasó

- **296 tests / 25 archivos, todos verdes** (`lib/duel`, `components/duel`, `api/duel`,
  `mode-routing`).
- **Errores de API limpios:** id inexistente y malformado → `{"ok":false,"error":"not_found"}`
  con HTTP 404. No filtra nada.
- **Los 6 P0 del red-team vigente están cerrados**, y verificados contra el código: el árbitro
  valida contra `fen` sin reconstruir, el orden bandera→jugada está pineado
  (`operations.ts:9-19`), y el P0 del enlace a través del login se cerró con medición + test
  de regresión.
- **Cero `TODO`/`FIXME`/`HACK`** en las tres carpetas del duelo.
- El red-team de julio (`2026-07-13`) **es histórico**: describe el modelo asincrónico
  descartado el 2026-08-14. Sus P0/P1 de plataforma los mató el seat token.
- ⚠️ `2026-08-15-duel-arena-ui-states-spec.md` dice *"borrador — pendiente de aprobación"* con
  los 9 criterios sin tildar. **El documento está desactualizado, no el código**: 8 de los 9
  están implementados.

---

## ⛔ Lo que hay que cerrar antes de repartir links

### (a) Rompe el plan de distribución

**1 · La invitación muere en 60 minutos**
`lib/duel/clock.ts:41` — `INVITATION_TTL_MS = 60 * 60 * 1000`.

No es un bug: es el diseño coherente con la partida de una sentada. Pero **cambia la
naturaleza de la prueba**: quien abre el link dos horas después ve *"This invitation ran
out"*. No es "mandá 20 links y mirá qué pasa" — es **agendar 20 sesiones**, cada una con los
dos presentes dentro de la misma hora.

⚠️ **No figura como limitación en ningún documento.** Es la primera cosa que sorprende.

**2 · Rate limit de 5 req/min por IP, compartido con toda la app**
`lib/server/demo-signing.ts:10` — `MAX_REQUESTS_PER_IP = 5`, ventana deslizante de 60 s,
prefijo `rl:ip`. Lo usan crear (`api/duel/route.ts:66`) y unirse
(`api/duel/[id]/join/route.ts:54`).

**Varias personas en el mismo WiFi o detrás del mismo NAT comparten el presupuesto.** Y el 429
le llega al invitado como el aviso genérico *"Something went wrong. Try again."*, con el botón
JOIN intacto y sin decirle que espere. En una prueba presencial —una mesa, un router— es
exactamente el escenario que lo dispara.

### (b) Deja al invitado varado

**3 · 🔴 El estado `watching` no tiene NINGUNA salida** ← *el más grave para tu plan*
`components/duel/duel-arena.tsx:288-321`. Verificado leyendo el archivo: hay `<footer>` para
`invited`, para `your-turn`/`their-turn`, y para `finished`/`expired`. **No hay ninguna rama
para `watching`.**

Quien pierde la carrera por el asiento —o abre un link reenviado— queda en un tablero de
**sólo lectura, sin un solo botón**, sin manera de salir que no sea cerrar la app.

⛔ **Y repartir links convierte esto en el estado mayoritario**: mandás a un grupo de 3, entra
1, y **2 quedan varados**. El spec lo declara así a propósito para dos personas coordinadas,
pero el plan de distribución lo vuelve el caso común en vez del raro.

**4 · Nadie tiene nombre en ningún duelo**
`DuelSetupSheet` se monta con `sessionId` y `onCancel`, **sin `displayName`**
(`app/[locale]/arena/page.tsx:1290-1292`), y el join se llama sin argumentos —
`onPress={() => void join()}` (`duel-arena.tsx:291`).

Los dos asientos quedan en `null`. El invitado lee *"You have been invited to play"* y el
intro dice *"Your rival"*. **El nombre custom existe en localStorage y no está cableado.**

⚠️ Para una prueba cuya pregunta entera es *"¿cambia algo jugar contra una persona?"*, que el
rival sea un anónimo llamado "Your rival" le saca justamente lo que se quiere medir. Es un
prop.

**5 · Callejón del invitado web sin allowlist** — **deuda ACEPTADA y documentada**
`lib/duel/duel-flag.ts:16`, handoff `2026-08-16-p2p-duel-v0-frozen.md:134`. Ve *"You don't
have access to this app"* con un *Try again* que nunca va a funcionar.
✅ **Mitigación sin código: probar en MiniPay**, donde `WebAccessGate` no se monta y el
invitado juega sin login alguno.

---

## Abierto pero que no corroe esta prueba

- **`/api/games` acepta `walletAddress` del body** (`api/games/route.ts:20-27`) — P1 vivo desde
  julio. **El duelo no escribe GameRecords**, así que no lo toca hoy. Sigue siendo deuda real
  del producto.
- **El seat token no tiene rotación ni revocación** — abierto, impacto bajo para dos personas
  que se conocen.
- **Aviso de turno** — deuda aceptada; el spec argumenta que con los dos presentes no hace
  falta.

---

## Recomendación

**Antes de repartir nada, dos arreglos chicos:**

| # | Qué | Por qué |
|---|---|---|
| 3 | Un footer con salida para `watching` | Sin esto, cada link reenviado produce una persona varada. Es el estado que tu propio plan vuelve mayoritario. |
| 4 | Cablear el nombre que ya está en localStorage | Sin esto, medís "jugar contra un anónimo", no "jugar contra una persona". |

**Y dos cosas que se manejan sin código, coordinando:**

- Mandá el link y jugá **dentro de la hora** (TTL de 60 min).
- **Todos por MiniPay**, y si es una prueba presencial, ojo con el rate limit de 5/min por IP:
  no creen cinco duelos seguidos desde el mismo WiFi.

⛔ **No hace falta prender `NEXT_PUBLIC_ENABLE_DUEL` ni desplegar nada** para la prueba: las
rutas no leen el flag y un link ya repartido se juega hoy. El flag sólo agrega la tarjeta al
selector — eso se decide después, con los resultados.

---

*Verificaciones reproducibles: `curl` a los hosts públicos y
`pnpm -C apps/web exec vitest run src/lib/duel src/components/duel src/app/api/duel src/lib/mode-routing`.*
