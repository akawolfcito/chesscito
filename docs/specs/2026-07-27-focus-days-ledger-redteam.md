# Red Team Review — focus-days-ledger (Spec A)

**Fecha**: 2026-07-27 · **Ronda**: v2, contra el spec revisado
**Reviewer mindset**: QA hostil + ingeniero senior
**Spec**: `docs/specs/2026-07-27-focus-days-ledger.md` (v2)

## Estado de los hallazgos de la ronda 1

| # | Hallazgo v1 | Estado |
|---|---|---|
| P0-1 | Clave `wallet` vs `account_ref` | **CERRADO** — firmado por el founder: `wallet` lowercase, sin HMAC nuevo, sin PII extra en la tabla |
| P0-2 | Backfill le cree al cliente | **CERRADO por encuadre** — se acepta a sabiendas: preserva continuidad de UX y **no concede valor económico**. Marcado `backfill_streak` y declarado "dato inferido, no evidencia verificada" |
| P0-3 | No se decía qué se gana al completar 21 | **CERRADO** — guardrail explícito: sin rewards, sin derecho ni expectativa; el ledger es señal de actividad, no prueba de elegibilidad |
| P1-rollback | `loading` permanente | **CERRADO** — estado `degraded` discriminado |
| P1-flag | Sin kill switch | **PARCIALMENTE** — ver P1-1 abajo |
| P1-cheat | `date` regala un día | **CERRADO** — 5 reglas de validación + `daily_retry` como fuente propia |
| P1-season | `seasonId` disperso | **CERRADO en la UI, ABIERTO en el servidor** — ver P0-1 abajo |
| P1-monotonía | AC falso entre temporadas | **CERRADO** — acotado a `(wallet, season_id)` |
| P1-host | Ningún test monta el host | **CERRADO** — AC20 |
| P2 (×6) | churn, i18n, copy, CHECK, dead-code, logging | **CERRADOS** los seis |

## Findings nuevos

### P0 — Bloqueantes

**[fast-path] El `seasonId` diverge entre las dos ramas del `/status`, y hoy ya es un bug en producción.**
`route.ts:65` (rama Redis) sirve `configuredPass.seasonId` — el literal de la
config. `route.ts:122` (rama Supabase) sirve `data.season_id` — el congelado en la
compra. **Son la misma wallet con dos temporadas distintas según qué rama la
atendió.** Hoy nadie lo nota porque nada consume el `seasonId`; con el ledger
adentro, la temporada bajo la que se escribe una fila pasa a depender de si Redis
tenía cache. El día que la config rolee con pases vivos, el progreso se parte en
dos temporadas.

El spec v2 ya lo resuelve para las escrituras (regla: el `seasonId` sale **siempre**
de `lite_season_passes`), y AC25 lo fija. **Lo que queda abierto es el bug
preexistente**: la respuesta del `/status` sigue emitiendo el `seasonId` erróneo
en la rama Redis para cualquier otro consumidor futuro. Arreglarlo de verdad exige
cambiar lo que se guarda en Redis en la compra (`verify-payment`), que es
territorio adyacente a Spec B.
**Recomendación**: Spec A **no** cambia el payload de Redis; sí deja de leer
`seasonId` de ahí, y el bug se archiva como issue propio.

**[fast-path] Colgar la inicialización del `/status` cuesta el fast path de Redis.**
`route.ts:57-72` **retorna antes de tocar Supabase**. Un
`ensureFocusLedgerInitialized` dentro del `/status` o bien no corre nunca para los
jugadores servidos desde Redis (la mayoría), o bien fuerza una consulta a Supabase
en cada carga del Hub y el fast path deja de ser un fast path.
El spec v2 elige lo segundo de forma explícita y acota el daño (si la DB cae, el
**acceso** se sigue sirviendo desde Redis y sólo el **progreso** se degrada). Es la
decisión correcta, pero hay que decirla en voz alta: **el `/status` pasa a pegarle
a Supabase en cada carga del Hub para los jugadores con entitlement activo.**
**Por qué bloquea**: es un cambio de perfil de carga en la ruta más caliente del
producto, y merece firma, no descubrirse en la factura.
**Mitigación disponible si molesta**: cachear el contador en Redis con
invalidación en cada `POST` exitoso. Agrega una segunda fuente de verdad, así que
sólo vale la pena si la latencia duele de verdad.

### P1 — Deberían resolverse

**[flag] El kill switch real no es el env var, y eso cambia la decisión 8.**
Los env vars de Vercel se snapshotean en el deployment: cambiarlos **exige
redeploy**. `FOCUS_DAYS_LEDGER_ENABLED` a secas apaga la feature, pero **no en
caliente**, que es lo que pedía la decisión. El spec v2 propone leer primero una
key de Redis con fallback al env var.
**Riesgo si se ignora**: se cree tener un kill switch que en realidad tarda un
build. **Riesgo de la solución**: una key de Redis es estado operativo sin
historial; alguien la apaga a mano y nadie sabe por qué. Necesita quedar en un
runbook, no sólo en el código.

**[GET-escribe] El `GET` que muta sigue siendo una excepción, y ahora con dos params del cliente.**
`ensureFocusLedgerInitialized` recibe `streak` y `lastCompletedDate` **por query
params**, o sea que un `GET` cacheable transporta datos que siembran progreso. El
spec lo acota (latch, idempotencia, `ON CONFLICT`, clamp por
`elapsedEligibleDays`), pero conviene declarar `no-store` explícito en esa ruta:
un `GET` con params que escribe y que alguna capa decida cachear es exactamente el
tipo de cosa que después nadie puede reproducir.

**[hidratación] La regla "ausente ≠ cero" es correcta y frágil a la vez.**
El spec distingue `streak` ausente (no sembrar, no latchear) de `streak=0`
(sembrar cero, latchear). Es la corrección correcta al bug de estado no hidratado
que ya nos mordió tres veces. Pero depende de que **todo** call site del cliente
respete la distinción, y `?streak=0` vs `?streak=` vs sin param se colapsan solos
en cualquier constructor de query string descuidado. **Debe haber un test de
contrato sobre el parseo del param**, no sólo sobre el comportamiento del backfill
(AC13 cubre la conducta, no el parseo).

**[carga] El backfill puede sembrar 21 filas en la primera carga del Hub.**
Con `min(streak, elapsed, goal)` y un jugador de racha alta, la inicialización
hace un INSERT de hasta 21 filas dentro de un `GET`. Es una sola vez por
`(wallet, season_id)` y entra con `ON CONFLICT`, así que es seguro; pero conviene
que sea **un solo INSERT multi-row**, no 21 round-trips, y que el spec lo diga
antes de que la implementación lo resuelva en un `for`.

**[test-negativo] AC18 prueba una ausencia y esas se pudren en silencio.**
"Ningún camino de acreditación se invoca" pasa en verde para siempre — incluso el
día que alguien agregue un quinto camino que el test no espía. El AC nombra los
cuatro conocidos, que es lo mejor que se puede hacer, pero el valor real de esta
garantía no está en el test: está en el guardrail escrito. Que nadie confunda AC18
con una prueba de que Spec A no puede pagar nada.

### P2 — Vale aclarar

**[`seeded_rows`] Se escribe y nadie lo lee.** Está bien como dato forense del
día que alguien pregunte "¿cuánto de esto es inferido?", pero si no hay consumidor
declarado, el próximo refactor lo borra por "columna muerta". Que el comentario de
la migración diga para qué existe.

**[`unreachable`] Reintroduce el reloj de pared, a propósito.** El spec saca el
reloj del **progreso** y lo deja mandando en la **vigencia**, que es correcto:
`daysRemaining` es tiempo y debe medir tiempo. Vale dejarlo dicho para que la
próxima lectura del spec no lea una contradicción donde hay una separación.

**[copy] `unreachable` y Spec B se contradicen por diseño.**
"Complete more Focus Days before this pass ends" es honesto hoy, y el día que
Spec B abra la ventana a 30 días el estado `unreachable` se vuelve casi
inalcanzable. No es deuda: es la señal de que Spec A está describiendo un producto
que Spec B va a cambiar. Sólo hay que acordarse de revisar el copy ahí.

**[i18n] El español pierde la marca "Focus".** `12 de 21 días completados` es
mejor castellano que "Días de Enfoque", pero deja al español sin el nombre propio
de la métrica que el inglés sí tiene. Es una decisión de marca tomada, no un
defecto; queda anotada porque un futuro glosario la va a cuestionar.

## Categories audited

**Contract gaps** — Sin `any`/`unknown`. `ChallengeProgressView` tiene cinco
estados discriminados y `FocusWindow` hace **irrepresentable** el countdown de
PRO. `FocusDaysSlice` separa `disabled` de `unavailable`, que era la confusión
esperable. `EffectiveTrainingPass.seasonId` es `string | null` explícito. ✅
**Ambigüedad conductual** — Los 17 behaviors tienen disparador. La distinción
ausente/cero del param quedó escrita. Queda tibio **cuándo** ocurre el retry
(behavior 16 dice "el próximo mount del Hub"): un mount es observable, alcanza. ✅
**Supuestos ocultos** — El caso "Daily sin wallet" está cubierto. El caso PRO sin
fecha de inicio quedó resuelto explícitamente en las reglas de `date`. ✅
**Compatibilidad** — Tabla nueva; `/status` gana un campo opcional que un cliente
viejo ignora; `EffectiveTrainingPass` gana un campo (los consumidores existentes
compilan). `DailyProgress` y sus 9 lectores, intactos. ✅
**Seguridad y datos** — RLS service-role-only en ambas tablas (AC21), sin PII más
allá de la wallet, wallet hasheada en logs con `hashWallet()` (AC22), rate limit
con política concreta. El agujero que queda es de **autorización de progreso** (el
endpoint no prueba que el Daily se jugó), declarado y acotado por el guardrail. ⚠️
**Cobertura de tests** — 26 AC. Cubren los 12 casos pedidos por el founder. AC20
cierra el hueco del host. Falta el test de parseo del param (ver P1-hidratación).
**Operatividad** — Logging enumerado y hasheado. Falta el runbook del kill switch
de Redis.

## Verdict

✅ **APPROVED para `/tdd`** (2026-07-27). Las dos firmas que lo condicionaban están
dadas, y ambas **endurecieron** el spec en vez de sólo aceptarlo:

1. **Perfil de carga firmado**, con una condición operativa que no estaba en mi
   propuesta: la consulta debe ser *pequeña, indexada y degradable*, y la propiedad
   protegida se escribió como invariante — **una caída del ledger nunca quita
   acceso pagado**. Además se difiere el caché del contador **a propósito** ("no
   agregar invalidación mientras estamos estableciendo la fuente de verdad") con
   una lista de métricas a medir antes de optimizar. Eso convierte una decisión de
   performance en una decisión con criterio de revisión.
2. **Gate de tres niveles** (Redis → env var → default seguro en código), con
   `off` inicial hasta migración y smoke, valor inválido → log + default seguro, y
   booleano sin cohortes. Mi propuesta tenía dos niveles y no definía el
   comportamiento ante un valor corrupto.

**Corrección al P0 de `seasonId`**: la firma va más lejos que el spec v2. Yo había
escrito "no leer `seasonId` del fast path"; la instrucción es **resolverlo en un
punto canónico único ANTES de entrar al fast path**. Es la versión correcta: la
mía dejaba dos resoluciones y sólo prohibía usar una.

Los tres menores quedaron incorporados como AC: `no-store` en la ruta,
INSERT multi-row (AC29) y test de contrato del parseo (AC28). AC27 y AC30 cubren
la jerarquía del gate y la resolución canónica.

**Riesgo residual aceptado y declarado**: el backfill confía en un `streak` de
localStorage manipulable. Es deliberado — preserva continuidad de UX y no concede
valor económico — y las filas quedan marcadas `backfill_streak` para que cualquier
sistema futuro pueda excluirlas.

**Riesgo residual heredado**: la divergencia de `seasonId` en el payload que
`verify-payment` escribe en Redis sigue viva; Spec A la neutraliza por
resolución canónica pero no toca el payload. Issue aparte.

**Riesgo residual aceptado y declarado**: el backfill confía en un `streak` de
localStorage manipulable. Es deliberado — preserva continuidad de UX y no concede
valor económico — y las filas quedan marcadas `backfill_streak` para que cualquier
sistema futuro pueda excluirlas.
