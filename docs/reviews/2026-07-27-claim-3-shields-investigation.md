# Investigación — "Claim 3 Shields" (LEARN #1)

**Fecha**: 2026-07-27 · **Origen**: `docs/backlog/2026-07-10-backlog-index.md` §1, el único
pendiente marcado como "comportamiento inexplicado — no cambiar lógica hasta entenderlo".

**Resultado**: las tres preguntas quedan respondidas. **Dos de las tres describían un bug que
ya se arregló**; la tercera (¿duplica?) es un **no** verificable. Queda **un** defecto vivo, y
es el opuesto del que se temía: no duplica escudos, los **pierde**.

---

## Las tres preguntas del backlog

### 1. ¿Pertenece al Welcome Pack, al Season Pass o al rescue gift?

**Al Welcome Pack.** Es gratis y no tiene nada que ver con el Season Pass.

- `fail-rescue-modal.tsx:72` — `const WELCOME_PACK_GIFT_COUNT = 3`.
- `fail-rescue-modal.tsx:146-148` — el label `cta.claimShields` existe **solo** en la
  variante **C** (sin escudos, pre-claim). Las otras tres variantes muestran "Use Shield" (A/B)
  o "Use Peones" (D).
- El `+3 Shields` que muestra la ChallengeCard en estado `offer` es **otra cosa**: es
  `challenge.shieldBonus`, el bono de compra del Season Pass. Comparten el número 3 y nada más.
  Esa coincidencia es probablemente lo que hizo que el ítem se leyera como ambiguo.

### 2. ¿Por qué al tocarlo lanza el 21-Day Mind Challenge / manda a la tienda?

**Ya no lo hace. Era un bug de tipos, arreglado el 2026-07-13.**

El handler era `onOpenShop("welcome-pack")`. El caller implementaba `() => void` contra un
contrato `(focus: "welcome-pack") => void` — **TypeScript acepta esa asignación**, así que el
argumento se descartaba en silencio y el Shop abría sin foco. El jugador tocaba "Claim 3
Shields" y aterrizaba en un catálogo de SKUs pagos para recoger un regalo que no cuesta nada.
La causa está documentada en `use-fail-rescue.ts:107-113`.

Verificado contra el código de hoy, no contra el comentario:

- `exercises-screen.tsx:1473-1479` — el handler llama `welcomePack.onClaim()`, no una apertura
  de Shop.
- `use-welcome-pack-claim.ts:167-231` — `onClaim` firma un mensaje y hace POST a
  `/api/welcome-pack/claim`. **No navega a ningún lado.**
- No existe ningún opener de la hoja del Season Pass en `exercises-screen.tsx`.

Hubo además un segundo bug en la misma superficie, arreglado antes (2026-07-02): el hook
llamaba `useWelcomePackClaim()` por su cuenta, creando una segunda instancia cuyo `claimed`
nunca se enteraba de un claim hecho por la instancia del Shop. Eso dejaba al jugador en un
**loop** ("Claim 3 Shields" → el Shop dice ya reclamado → nada pasa → vuelve el mismo modal")
sin salida salvo abandonar el rescate y perder la racha (`use-fail-rescue.ts:121-131`).

> Ambos arreglos son anteriores al triage del backlog del 2026-07-10 sólo en parte: el del
> loop sí, el del deep-link **no** (13/07 > 10/07). El ítem se escribió describiendo un bug
> que se arregló tres días después y nadie volvió a cerrar la entrada.

### 3. ¿Duplica los 3 shields de onboarding?

**No.** El claim es idempotente **en la base**, no en el cliente:

- `welcome-pack/claim/route.ts:100-110` — inserta en `welcome_pack_claims` con
  `wallet_address` único.
- `:112-129` — violación de unicidad (SQLSTATE `23505`) ⇒ responde
  `{ ok: true, already_claimed: true }` **sin acreditar nada**.
- `:138-149` — rama defensiva: insert sin error y sin fila ⇒ también se trata como
  already-claimed, "so we never double-credit on retries that race a deletion path".
- El `INCRBY` de Redis (`:153-168`) corre **sólo** después de un INSERT exitoso.

Para duplicar habría que borrar la fila de `welcome_pack_claims`.

---

## El defecto que SÍ queda vivo

**Un claim puede marcarse como usado sin acreditar nada, y no hay reintento.**

Secuencia (`route.ts:151-168`): el INSERT entra ✅ → el `INCRBY` de Redis falla ❌ → la ruta
devuelve `500 credit_failed`. La fila ya existe, así que **todo intento posterior cae en la
rama 23505** y responde `already_claimed: true` sin acreditar. El jugador pierde sus 3 escudos
de forma permanente; sólo se recupera tocando Redis o borrando la fila a mano.

El propio código lo nombra como riesgo asumido de v1: *"See §7 red-team item #8 for the known
v1 edge case (INSERT succeeded, INCRBY fails — row exists, balance unchanged)"*.

**Por qué importa más ahora que cuando se aceptó**: el jugador que llega a este modal es, por
definición, uno que **acaba de fallar un ejercicio y no tiene escudos**. Es el peor momento
posible para tragarse un regalo en silencio.

**Costo de cerrarlo**: bajo. La rama 23505 puede distinguir "fila existe **y** ya se acreditó"
de "fila existe y el crédito nunca ocurrió" — hoy trata ambos casos igual porque no hay nada
que registre si el `INCRBY` corrió. Un flag `shields_credited_at` en la fila (o leer el
contador antes de decidir) convierte el caso perdido en reintentable.

---

## Recomendación

1. **Cerrar el ítem del backlog** — el comportamiento inexplicado ya no existe. Reemplazarlo
   por el defecto real de arriba, que es concreto y acotado.
2. **No tocar la lógica del claim** más allá de eso: es idempotente y está bien construida.
3. El bug de tipos de #2 deja una lección reutilizable: **una función que ignora un parámetro
   es asignable a un contrato que lo exige**, y TypeScript no dice nada. Si el foco importa,
   el tipo tiene que ser algo que el caller no pueda descartar sin que el compilador lo vea.
