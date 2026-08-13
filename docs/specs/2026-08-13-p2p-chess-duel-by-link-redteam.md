# Red Team Review — p2p-chess-duel-by-link

**Date**: 2026-08-13
**Reviewer mindset**: QA hostil + ingeniero senior que ya vio morir dos veces este mismo spec

> Este duelo se especificó en julio (v2 y v3) y **ninguna se construyó**. La v2 murió por un
> defecto de autorización; la v3 por poner la wallet como barrera. Un tercer spec que no explique
> por qué **este** sí se construye es un cuarto artefacto histórico.

---

## Findings

### P0 — Bloqueantes

- **[Identidad] El spec asume que el invitado juega sin login, y eso contradice lo que el founder
  dijo.** El founder cerró la aclaración con *"lo de wallet ahora ya se puede… el ingreso al app
  está dado por el social login, ya estaría cubierto"*. El spec hace lo contrario: `JOIN` sin login
  (comportamientos 2–3). **No es una desobediencia, es una colisión real** —
  `project_web_early_access_is_privy_allowlist` dice que el acceso web lo concede el **allowlist
  nativo de Privy**, así que un desconocido con el enlace **no puede loguearse**, y si pudiera,
  quemaría un MAU del cupo gratis de 499. **Why blocking:** las dos lecturas producen specs
  distintos, y una de ellas hace que el enlace sólo funcione entre gente ya habilitada — es decir,
  que no sirva para lo único que un enlace sirve.

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

## Verdict

**NEEDS REVISION.**

Los P0 no son de implementación: son **cuatro decisiones de producto y de arquitectura** que cambian
el spec, no el código. Escribir tests contra este documento hoy sería fijar en tests una pregunta
sin responder — el login del invitado.

⚠️ Y una observación que no es un finding pero condiciona todo: **es el tercer spec de este mismo
feature**. Los dos anteriores eran técnicamente correctos y no se construyeron. Antes de resolver
los P0 vale contestar por qué éste sí, y qué tamaño tiene la primera versión que se pueda poner
frente a un jugador esta semana.
