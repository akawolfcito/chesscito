# Red Team Review — p2p-chess-duel-by-link

**Date**: 2026-08-13
**Reviewer mindset**: QA hostil + ingeniero senior que ya vio morir dos veces este mismo spec

> Este duelo se especificó en julio (v2 y v3) y **ninguna se construyó**. La v2 murió por un
> defecto de autorización; la v3 por poner la wallet como barrera. Un tercer spec que no explique
> por qué **este** sí se construye es un cuarto artefacto histórico.

---

## Findings

### P0 — Bloqueantes

- ~~**[Identidad] ¿el invitado se loguea?**~~ **RESUELTO** (founder, 2026-08-13): sí, pasa por el
  gate; MiniPay por defecto, el resto por waitlist, más un tope por código. **Pero el finding se
  transforma, no desaparece** — ver el siguiente.

- **[Producto] El enlace ya no es un canal de juego: es un embudo de waitlist, y el gate del frente
  no puede medir eso.** Con el gate obligatorio, un invitado frío fuera de MiniPay aterriza en un
  formulario. El gate declarado del frente es **"uso real del duelo"**
  (`direction-where-we-are.md` §10) y §14 dice que los umbrales se fijan **antes** del experimento.
  **Why blocking:** si el invitado promedio no puede jugar, la métrica mide el gate de acceso y no
  el duelo — y el frente se declara fracasado por una razón que no tiene nada que ver con el duelo.
  Hay que decidir **antes de construir** qué población se mide (propuesta: sólo duelos donde
  **ambos** asientos ya estaban dentro) y qué número cuenta como éxito.

- **[Seguridad] El tope por código es un presupuesto disfrazado de candado, y el spec lo dice pero
  el nombre no.** Vive en nuestro cliente (`web-access-gate.tsx:116-121`): protege el gasto de MAU,
  **no** concede ni niega acceso — eso lo hace el allowlist de Privy, server-side. **Why blocking:**
  si alguien lo lee como control de acceso, se apaga el allowlist "porque ya tenemos el tope" y el
  acceso queda abierto de par en par. El spec debe nombrarlo **presupuesto**, nunca gate.

- **[Estado] El enlace tiene que sobrevivir al login, y eso no es gratis.** El invitado abre
  `/arena?duel=<id>`, lo manda el gate a Privy, vuelve… ¿a dónde? Si el parámetro se pierde,
  aterriza en el hub sin saber a qué lo invitaron, y el duelo queda `awaiting-opponent` para
  siempre. **Why blocking:** es el camino principal del feature para todo invitado web, y el
  comportamiento 2 lo menciona en una advertencia sin especificar el mecanismo.

- **[Alcance] Ajedrez completo asume que el jugador sabe jugar ajedrez, y el producto enseña a mover
  piezas.** El founder lo decidió explícitamente ("en este momento el p2p es para PLAY, una partida
  de ajedrez completa") y eso zanja la pregunta de producto. Pero el spec **no dice qué pasa cuando
  el invitado no sabe jugar** — que es el caso mayoritario de la base actual, formada en LEARN.
  **Why blocking:** el primer duelo de la mayoría termina en abandono o en una partida de 80 movidas
  sin sentido, y la métrica del gate ("uso real del duelo") va a medir eso sin poder distinguirlo
  de "no le interesa".

- **[Árbitro] `applyMove` recibe `moves` y reconstruye la partida entera EN CADA JUGADA.** A la
  movida 60 eso son 60 aplicaciones de chess.js por request, y el CAS obliga a repetirlo en cada
  reintento por conflicto. **Why blocking:** es la ruta caliente del feature y el spec no fija ni un
  presupuesto ni una alternativa (guardar el FEN junto a las movidas y validar contra él, usando la
  lista sólo para repetición triple). Decidirlo después es rediseñar el esquema.

- **[Estado] El comportamiento 13 inventa un ganador donde el 12 se niega a inventarlo, y la
  diferencia no está justificada.** Si `awaiting-opponent` vencido no tiene ganador porque "nadie
  perdió una partida que nunca empezó", entonces un `active` vencido tampoco es obviamente una
  derrota: puede ser un rival sin batería, sin datos o de vacaciones — el mismo escenario que el
  spec descarta como injusto en la otra rama. **Why blocking:** decide si el duelo produce derrotas
  registradas por inactividad, y eso cambia qué se puede colgar del resultado después.

### P1 — Deberían resolverse

- **[Seguridad] El token vuelve en el body además de la cookie, y el spec justifica el porqué pero
  no el después.** Un token en `localStorage` es legible por cualquier XSS, y el spec no dice
  cuánto vive, si rota, ni si se puede revocar. Un asiento robado permite jugar por el otro para
  siempre. *Riesgo:* el modelo de credencial es lo ÚNICO que sostiene la autorización de este spec.

- **[Concurrencia] El CAS protege las jugadas pero el spec no dice qué hace el CLIENTE con
  `version-conflict`.** ¿Reintenta solo? ¿Cuántas veces? Un reintento automático sobre una jugada de
  ajedrez puede aplicar una movida que ya no tiene sentido en la posición nueva. *Riesgo:* la
  partida se corrompe de una forma que parece un bug del árbitro.

- **[Estado] "Jaque mate y expiración en la misma lectura" está listado como edge case y resuelto en
  una frase, pero implica un orden de evaluación global que el spec no fija.** ¿Se evalúa expiración
  antes o después de aplicar la jugada entrante? Las dos son defendibles y dan resultados distintos
  para la misma secuencia. *Riesgo:* dos implementaciones que pasan los mismos tests y difieren.

- **[Producto] El gate del frente es "uso real del duelo" y el spec no define ni una métrica.**
  §14 de la directriz dice que los umbrales se definen antes del experimento. Sin eso, el duelo se
  construye y después se discute si funcionó. *Riesgo:* se repite el patrón que dejó dos specs sin
  construir.

- **[Backward compat] El spec agrega `/api/duel/*` y deja `api/games/route.ts:21` roto.** Está
  marcado como prerrequisito de D2, lo cual es correcto, pero **conviven**: durante D1 hay una ruta
  que escribe partidas a nombre de cualquier wallet y otra que hace las cosas bien. *Riesgo:* alguien
  cablea el duelo a `/api/games` "porque ya existe" y hereda el agujero.

### P2 — Vale aclarar

- **[Contratos] `displayName` es "cosmético y no autoriza nada", pero es texto libre de un
  desconocido renderizado a otro jugador.** Necesita límite de longitud y saneamiento, o es un vector
  de suplantación (*"Sistema: has perdido"*) y de XSS si algo lo interpola sin escapar.
- **[Contratos] `SeatToken` es `string & { __brand }`, pero el tipo no impide loguearlo.** Vale un
  `toJSON` que devuelva `"[redacted]"`.
- **[UX] El spec no dice cómo se entera un jugador de que le tocó el turno.** Sin notificación, un
  duelo asincrónico depende de que abras la app por casualidad, y la ventana de 48 h vence sola.
- **[Ops] No hay una sola línea sobre observabilidad.** ¿Cuántos duelos se crean, cuántos se
  contestan, cuántos expiran sin jugarse? Es exactamente lo que el gate necesita medir.
- **[i18n] Los `code` de error son legibles en inglés y el bundle ES existe con guard de traducción.**
  Definir dónde vive la copia antes de escribirla suelta.

---

## Categorías auditadas

### Huecos de contrato
Sin `any` ni `Record<string, any>`. Los modos de fallo están tipados en `ApplyMoveResult`, que es
correcto. **Falta**: el tipo de error de `join` (asiento ya ocupado, duelo vencido, duelo
inexistente) — hoy sólo `move` tiene errores tipados. Y `link-wallet` no tiene tipo de resultado.

### Ambigüedad de comportamiento
El punto 11 ("se materializa como `expired` en ese mismo read") es un **write dentro de un GET**.
Es la técnica correcta y viene del v3, pero el spec no dice qué pasa si ese write falla ni si el GET
debe seguir siendo cacheable. Un GET que escribe y puede fallar necesita decirlo.

### Supuestos ocultos
- Que `chess.js@1.4.0` detecta triple repetición y 50 movidas **sobre una lista de SAN
  reconstruida**. Es cierto para una instancia que jugó las movidas; conviene verificarlo, no
  asumirlo.
- Que el jugador que crea el duelo está autenticado en PLAY. El spec no lo dice y `/api/duel` POST
  figura sin credencial: **cualquiera puede crear duelos infinitos**. Falta rate limit; existe
  `enforceRateLimit` en el repo.
- Que la cookie con `Path=/api/duel/<id>` sobrevive el salto de navegador in-app → navegador del
  sistema. El spec ya admite que no, pero entonces el camino principal es el token del body y la
  cookie es el respaldo — está escrito al revés.

### Compatibilidad hacia atrás
No rompe tipos existentes. `ArenaOpponentKind` del v3 (`"ai" | "private-duel"`) probablemente haya
que reintroducirlo; el spec no menciona **cómo entra el duelo a la Arena**, que es la superficie
donde vive. Falta la matriz de estados de la Arena que el propio spec dice reusar del v3.

### Seguridad y datos
Bien: ids no enumerables, tokens hasheados, `DuelPublic` sin `tokenHash`, la wallet fuera del camino
de autorización, y una aserción sobre el **serializado** y no sobre el tipo.
**Falta**: rate limit en create y join; longitud/saneamiento de `displayName`; rotación o expiración
del token; y qué se loguea (un token en un log de acceso es un asiento regalado).

### Cobertura de tests
Los criterios son observables y casi todos mapean a un test. **Tres no son testeables como están**:
"el enlace abre y permite jugar desde un navegador móvil común" (¿cuál?, ¿con qué prueba?), "los ids
no son adivinables" (se verifica la fuente de entropía, no el resultado), y "ninguna se pierde en
silencio" (necesita definir qué observa el test).

### Preparación operativa
Nada sobre logging, métricas ni rollback. Un duelo a medio construir en producción deja partidas
colgadas; el spec no dice si se pueden purgar ni cómo.

---

## 3ª pasada — 2026-08-13, contra la versión MÍNIMA

El spec se recortó a *"dos personas que ya están dentro se pasan un enlace y juegan"*, y eso
**cierra o saca de alcance cuatro de los seis P0**:

| P0 anterior | estado |
| --- | --- |
| Login del invitado | ✅ resuelto (gate existente, sin cambios) |
| Métrica que mide el gate y no el duelo | ✅ disuelto — la versión mínima **sólo** admite a los que ya están dentro, así que la métrica mide el duelo |
| Tope llamado candado | ➡️ movido a `2026-08-13-login-capacity-cap-spec.md`, donde se llama **presupuesto** |
| Árbitro reconstruyendo la partida | ✅ resuelto — `fen` se guarda junto a `moves` y `applyMove` valida contra él |
| Incoherencia 12 vs 13 | ✅ resuelto — se acepta a sabiendas, con la razón escrita y un disparador para re-decidir |
| Enlace a través del login | ⬜ **sigue P0**, y ahora es lo único de acceso que hay que construir |

### Lo que el recorte NO arregla

- **[Alcance] Sigue siendo ajedrez completo, y la base se formó en LEARN.** El recorte lo hace menos
  grave (los dos ya están dentro, o sea que son usuarios reales, no curiosos) pero no lo elimina.
  *Riesgo:* el duelo se mide contra gente que no sabe jugar y el resultado se lee como desinterés.
- **[Producto] "Sin guardar la partida" es una decisión fuerte y no está justificada en el spec.**
  Dos personas juegan 40 movidas y al terminar no queda nada. Que sea D2 explica el orden, no la
  experiencia. *Riesgo:* la versión mínima se siente descartable y nadie la usa dos veces — lo que
  haría fracasar el gate por una razón que no es el duelo.
- **[UX] Sin notificación de turno, la ventana de 48 h es optimista.** Está en Open questions, pero
  para un duelo asincrónico es el mecanismo que lo hace funcionar, no un extra.

## Verdict

**READY para `/tdd`** (3ª pasada, contra la versión mínima) — **con una condición**: resolver
*"el enlace sobrevive al login"* como parte del trabajo, no después. Es el único P0 vivo y sin él
todo invitado web sin sesión cae en el hub sin saber a qué lo invitaron.

Los tres findings que quedan (ajedrez completo, no guardar la partida, notificación de turno) son
**riesgos de producto asumidos**, no defectos del spec: cada uno está escrito con su razón y su
disparador. Se pueden construir sabiendo que existen.

---

### Veredicto anterior — 2ª pasada, tras la decisión sobre el acceso

**NEEDS REVISION.**

La pregunta que bloqueaba está resuelta y **la mitad del camino ya está construido**: MiniPay entra
por defecto sin tocar Privy, la waitlist existe y vive **delante** del `login()`, y el tope tiene un
lugar obvio donde ir. Eso baja el costo de la capa de acceso a casi cero.

Lo que queda son **seis P0**, y ninguno es de implementación:

1. La métrica del gate del frente, que hoy mediría el gate de acceso y no el duelo.
2. Que el tope se llame **presupuesto** y no candado, para que nadie apague el allowlist por él.
3. La preservación del enlace a través del login.
4. Qué pasa cuando el invitado **no sabe jugar ajedrez** — la base actual se formó en LEARN.
5. El costo del árbitro reconstruyendo la partida entera en cada jugada.
6. La incoherencia entre los comportamientos 12 y 13 sobre inventar un ganador por inactividad.

⚠️ Y la observación que sigue en pie, porque es la que más ha costado: **es el tercer spec de este
feature**. Los dos anteriores eran técnicamente correctos y no se construyeron. La pregunta que
ninguno de los tres contesta es **cuál es la versión más chica que se puede poner frente a dos
jugadores esta semana** — y con el acceso resuelto, esa versión probablemente sea *"dos personas que
ya están dentro se pasan un enlace y juegan"*, sin waitlist, sin tope y sin embudo. Eso se puede
construir y medir antes de decidir nada sobre contactos fríos.

⚠️ Y una observación que no es un finding pero condiciona todo: **es el tercer spec de este mismo
feature**. Los dos anteriores eran técnicamente correctos y no se construyeron. Antes de resolver
los P0 vale contestar por qué éste sí, y qué tamaño tiene la primera versión que se pueda poner
frente a un jugador esta semana.
