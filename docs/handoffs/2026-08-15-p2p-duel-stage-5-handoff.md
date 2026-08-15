# Handoff — El duelo p2p está construido entero, y nadie lo abrió todavía

**Fecha:** 2026-08-15
**Spec:** `docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md`
**Spec de UI:** `docs/specs/2026-08-15-duel-arena-ui-states-spec.md` (los 8 estados)
**Plan:** `docs/plans/2026-08-14-p2p-duel-tdd-plan.md` ← **las cinco etapas en ✅**
**Handoff anterior:** `docs/handoffs/2026-08-15-p2p-duel-stage-3-handoff.md`

---

## 1. ⛔ Dónde retomar: ABRIRLO

**Las cinco etapas están construidas. Ninguna se abrió en un navegador.**

Eso no es una formalidad. La suite prueba que las nueve pantallas montan, que el tablero sólo se
puede jugar en un estado y que el enlace sale limpio, pero
[[feedback_a_new_surface_is_not_verified_until_you_open_it]] costó dos deploys rotos el mismo día
con todo en verde. **Lo que falta es un duelo real entre dos teléfonos.**

El camino a probar, en orden:

1. PLAY → selector de rival → **la cuarta tarjeta, "A friend"**
2. La escalera `−`/`+` → **Create and share**
3. El enlace se comparte (⛔ verificar que **no** contiene `privy_oauth_code`)
4. El segundo teléfono lo abre → **JOIN** → los dos relojes arrancan
5. Jugar. Mirar sobre todo: promoción de peón, y qué pasa cuando un reloj llega a 0

⚠️ **Para probarlo en el teléfono**: el enlace conserva el origen del túnel a propósito. Si
reescribiera a `play.chesscito.com` te daría un enlace a **producción** cada vez.

---

## 2. Qué se construyó hoy (Etapas 3 y 5 enteras)

| capa | archivos | tests |
| --- | --- | --- |
| datos | `row`, `repository` | 26 |
| reglas | `lifecycle`, `operations` | 50 |
| HTTP | `http`, `service`, las **5 rutas** | 50 |
| cliente | `api`, `seat-store`, `reaction`, `use-duel` | 24 |
| pantalla | `arena-state`, `link`, `outcome-copy`, `DuelArena`, `DuelClock`, `DuelSetupSheet` | 36 |

**Suite completa: 680 archivos / 8399 tests, `EXIT=0`, 0 errores de worker, 145 s. `tsc` limpio.**
**Mutación: 18 mutantes, todos muertos.**

---

## 3. Las reglas que quedaron escritas, y por qué cada una

⛔ **El orden vive en UN portón compartido** (`openWriteGate`): asiento → reloj → versión →
tablero. Un cuarto camino de escritura lo hereda gratis. La bandera ANTES de la jugada es la
decisión que el spec fijó: un mate entregado justo al vaciarse el banco **pierde por tiempo**.

⛔ **Ni la credencial ni el ID DEL DUELO se loguean.** El id *es* el enlace de invitación: un log
drain lleno de ids es un drain lleno de duelos donde alguien se puede sentar.

⛔ **La credencial no se lee ni se manda por query string**, en el servidor y en el cliente.

⛔ **Un `version-conflict` se adopta, nunca se reintenta.** Y **una red muerta se re-LEE, nunca
se re-POSTea**: el request pudo haber aplicado, y un reintento juega la movida dos veces.

⛔ **El reloj del cliente es un RENDERIZADO.** Llegar a cero dispara una lectura, jamás una
derrota.

⛔ **La credencial se estaciona ANTES de navegar** — un token perdido en esa carrera deja al
creador mirando su propio duelo sin poder mover.

⛔ **Los eventos llevan el `session_id` real del cliente**, no uno sintético: inventarlo inflaría
`events/session` y el conteo de sesiones de `/stats`.

---

## 4. ⛔ Lo que el spec pidió y NO se pudo honrar

**`invitedBy` se escribe `null` en todos los duelos.** Esta app **no tiene identidad verificable
server-side**: Privy se valida en el browser y no existe `@privy-io/server-auth` en el repo
(verificado por grep). Tomarlo del body y llamarlo *server-written* sería el defecto que mató a
la v2 con otro nombre. Hoy no se pierde nada; el dato estará **vacío** el día que se quiera
premiar a quien invita.

---

## 5. Hallazgos que dejó construir esto

1. ⚠️ **`ArenaBoard` no deshabilita sus casillas cuando está bloqueado** — sólo ignora el click.
   Un tablero bloqueado **no tiene ninguna señal que un lector de pantalla pueda leer**: 64
   botones habilitados en un tablero que no se puede jugar. **Es preexistente y también lo tiene
   la arena de la IA.** Queda reportado, no parchado de contrabando.
2. ⚠️ **La mutación encontró defectos en MIS TESTS tres veces**, no en el código: un guard
   redundante que enmascaraba la regla que duplicaba; un test que asertaba sobre `seats.w` cuando
   el color del creador **se sortea** (pasaba una de cada dos); y un test que asertaba sobre
   `button[disabled]`, que no existe.
3. ⚠️ **El pooler de Supabase se come los `NOTICE`**: una verificación que imprime sólo `DO` no
   prueba nada. Devolver un VALOR sí.
4. ⚠️ **`initial_minutes` llega como `number` por PostgREST**, no como string. Lo había afirmado
   al revés por la reputación general de los `numeric`; el probe lo corrigió.

---

## 6. Estado del repo

| | |
| --- | --- |
| `main` local | limpio, **13 commits** por delante de `origin/main` (el founder pushea) |
| Suite | 680 archivos / 8399 tests, `EXIT=0`, 145 s |
| `tsc` | limpio |
| Tabla `duels` | ✅ aplicada a producción, ledger 46, RLS deny-total verificada corriéndola |
| VR | ⚠️ **no se corrió** — ver abajo |

⚠️ **El VR no se corrió, y hay una razón para correrlo antes de deployar**: la cuarta tarjeta
cambia el layout del selector de rival. `arena-select-scaffold` no tiene baseline propio, pero
`vr17-play-hub-*` fotografía `/dev/play-hub` y podría incluirlo. Si alguna se pone roja **es
correcta** y se regraba a propósito, nunca con un `--update-snapshots` a ciegas. Correr con
`--project=minipay --update-snapshots=none` y **con el dev server bajado**.

---

## Preguntas abiertas

1. **¿Cuándo se juega el primer duelo real?** Es lo único que falta y no lo puede hacer la suite.
2. **¿Se arregla la señal de tablero bloqueado?** Toca también la arena de la IA, así que es su
   propio cambio con su propio alcance.
3. **¿Quién dispara `purge_duels`?** Sigue sin dueño. Ahora hay tabla, así que el reloj corre.
4. **¿Se arregla el callejón del invitado sin allowlist?** Heredado y sin tocar: Privy dice *"You
   don't have access to this app"* y detrás nuestra pantalla ofrece un **Try again** que no va a
   funcionar nunca. **Es el camino que este feature va a estrenar.**
5. **¿Cuándo se llena `invitedBy`?** Requiere verificación de sesión server-side (§4).
