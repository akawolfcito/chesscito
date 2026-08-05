# B0 — Descubrimiento, Sesión B (2026-08-05)

**Hash inicial verificado:** `origin/main` = `HEAD` = **`743c14977527fa85e2c2e12f9b008c44510355c4`**.
Árbol sin commits locales por delante.

## Discrepancia documental — resuelta

| Fuente | Hash | Veredicto |
|---|---|---|
| Mensaje previo | `743c1497` | **Correcto** |
| Handoff Sesión A, "Estado final" | `5c03d581` | Estaba en lo cierto **cuando se escribió** |

No hay conflicto real: `5c03d581` es el padre de `743c1497`, y `743c1497` es
**el commit del propio apéndice** (`docs(handoff): record the production rollout of both P0s`,
1 archivo, sólo `docs/handoffs/2026-08-05-session-a-p0-handoff.md`). El doc no podía
citar su propio hash. **El hash verdadero es `743c1497`.**

## Migraciones

- `20260805010000_close_public_access_to_privileged_views.sql` — **presente**.
- Prefijos duplicados: **ninguno** (`ls | cut -c1-14 | sort | uniq -d` → vacío).
  El guard que se agregó en `5c03d581` cubre esto en la suite.

---

# 1. Consumidores del funnel analítico

`ACTIVATION_FUNNEL` se declara en `apps/web/src/lib/analytics/canonical-events.ts:36`.
Cinco pasos, lineales:

```
app_opened → hub_viewed → exercise_started → exercise_completed → daily_focus_completed
```

## Consumidores reales (código, no docs)

| # | Archivo | Qué depende del **orden** |
|---|---|---|
| 1 | `src/lib/stats/funnels.ts:29,37` (`computeActivation`) | Sólo itera. Cuenta cada paso **independientemente** — el orden es presentación, no semántica. |
| 2 | `src/lib/stats/public-aggregator.ts:874` | Pasa filas a `computeActivation`. Indiferente al orden. |
| 3 | `src/components/stats/stats-page.tsx:273,908` (`ActivationFunnelChart`) | **Renderiza el array en orden como embudo.** Acá es donde la mentira se ve. |
| 4 | **`supabase/migrations/20260805000000_stats_aggregation_rpcs.sql:173-233`** | ⛔ **El orden es la lógica.** Ver abajo. |
| 5 | `src/lib/analytics/__tests__/canonical-events.test.ts:36` | Pin literal de los 5 pasos en ese orden. |
| 6 | `supabase/migrations/__tests__/stats-rpc-privileges.test.ts:197` | Exige que cada paso del array aparezca en el SQL. |

## El consumidor duro: la RPC ya viva en producción

`stats_activation_funnel` **no** cuenta pasos independientes. Es **prefix-nested por
construcción** (líneas 226-231):

```sql
select 5, 'daily_focus_completed',
       (select count(*) from cohort c where c.s2 and c.s3 and c.s4 and c.s5)
```

Es decir: para que una instalación cuente en Daily Focus **tiene que haber completado
un ejercicio de training antes** (`s4`). Eso es **exactamente el subconjunto falso**
que el handoff de la Sesión A reportó. La cabecera de la migración lo declara como
virtud ("monotone BY CONSTRUCTION"), y para los pasos 1-4 lo es. **Para el paso 5 no:
`daily_tactic_completed` y `exercise_complete` salen de caminos de código disjuntos**
(handoff Sesión A, §"426 vs 415"). Terminar el Daily no emite completación de ejercicio.

**Consecuencia medida:** la RPC hoy reporta `daily_focus_completed` como el subconjunto
`daily ∩ training`, no como "gente que completó el Daily". El número que imprime es
**real pero mal nombrado** — es el peor modo de falla: no hay síntoma.

## ¿Es viable separar Daily y Training en funnels hermanos?

**Sí, y el repo ya tiene el patrón.** `ACCESS_FUNNEL` (`canonical-events.ts:71`) es un
segundo funnel independiente, con su propio vocabulario (`ACCESS_EVENTS`), su propio
`accessStepFor()`, su propia RPC (`stats_access_funnel`) y su propio bloque en
`stats-page.tsx`. Un tercer funnel hermano no inventa arquitectura: **copia la que ya
existe**.

## Corrección mínima semánticamente honesta

1. `ACTIVATION_FUNNEL` pasa a **4 pasos** (`app_opened → hub_viewed → exercise_started →
   exercise_completed`). Es el funnel de **Training**, y con 4 pasos el prefix-nesting
   de la RPC es **verdadero**.
2. `daily_focus_completed` sale a un funnel hermano
   `DAILY_FOCUS_ACTIVATION_FUNNEL` (`app_opened → hub_viewed → daily_focus_started →
   daily_focus_completed`), con su propio alias `daily_tactic_started`.
3. La RPC se corrige en **una migración nueva** (no se edita la vieja: ya está aplicada
   en prod y Supabase trackea por versión).

⚠️ El punto 3 es un **cambio de producción** y por lo tanto queda **escrito pero NO
aplicado** hasta el GO. Sin él, los pasos 1-2 arreglan el vocabulario de TypeScript
mientras la base sigue devolviendo el número anidado — hay que hacer los tres o el
arreglo es cosmético.

---

# 2. Flujo actual del tour

| Pregunta | Respuesta, con archivo |
|---|---|
| Condición para mostrarlo | `use-hub-tour.ts:38-45`: `enabled && ready && !decidedRef && isHubTourLaunchable(document, mode)`. `isHubTourLaunchable` (`lib/hub/hub-tour.ts:150`) exige `!hasSeenHubTour(mode)` **y** cero `[aria-modal="true"]` en el DOM. |
| Persistencia | `localStorage`, una clave por hub: `chesscito:hub-tour:learn:v2` / `chesscito:hub-tour:play:v1` (`hub-tour.ts:13-16`). Valor = el outcome (`"completed"` \| `"skipped"`). Más `chesscito:hub-tour:daily:v1`, que sólo LEARN escribe. |
| Evento final | `track("hub_tour_finish", { mode, outcome })` (`use-hub-tour.ts:57`). El replay manual emite el mismo con `replay: true` y **no** persiste. |
| Destino posterior | **Ninguno.** `finish()` hace `setOpen(false)` y el jugador queda en el hub, exactamente donde ya estaba. El tour es un overlay, no una ruta. |
| Refresh | Idempotente: la clave ya está escrita, `hasSeenHubTour` → `true`, no reabre. |
| Back navigation | No aplica: no hay entrada de historial. |
| Reinstalación / borrar storage | El tour **vuelve a salir** (y `session_id` se re-acuña — handoff Sesión A, §identidad). |
| Usuarios existentes | Ya tienen la clave escrita → **nunca ven el tour**. Es el discriminador natural de elegibilidad, gratis. |
| Learn / Play / Lite | LEARN: `learn-hub-client.tsx:435`, `enabled: CHESSCITO_LITE_MODE`, 3 pasos, incluye Daily. PLAY: `play-hub-client.tsx:73`, 3 pasos, **sin** paso Daily (spec 2026-07-28). FULL no lo monta. |
| MiniPay vs web | Idéntico: el tour es puro cliente + localStorage. No toca wallet, red ni API. |
| Catch de storage | `hasSeenHubTour` devuelve `true` si `localStorage` tira (`hub-tour.ts:123`) — **falla cerrado**: un WebView con storage deshabilitado nunca ve el tour. Correcto y hay que preservarlo. |

## Punto exacto donde cambiar el destino sin duplicar estado

**`use-hub-tour.ts:47-60`, dentro de `finish()`, después de `markHubTourSeen`.**

Es el único lugar que ya sabe (a) que el tour terminó, (b) si fue replay, y (c) que el
estado quedó persistido. Cualquier otro punto —el hub, el componente del tour, un
efecto— tendría que re-derivar esas tres cosas y las tres ya viven acá.

**No hace falta estado nuevo para "ya lo mandamos a la actividad":** la clave
`chesscito:hub-tour:<mode>` **ya es** ese latch. Se escribe en el mismo `finish()`, así
que un refresh posterior no puede volver a disparar la redirección — `decidedRef` +
`hasSeenHubTour` la matan antes.

---

# 3. Daily Focus vs Training — decisión por evidencia

## Hallazgo que cambia la pregunta

`/challenge/daily` **no es la superficie de juego del Daily**: es la landing de un link
compartido (`challenge-daily-client.tsx`). Emite `challenge_*`, pasa
`isConnected={false}` hardcodeado y **no acredita Peones**. Usarla como destino del tour
haría que la variante **pierda la recompensa** que el control sí cobra.

**La superficie real del Daily es `HubDailyTile`** (`components/hub/hub-daily-tile.tsx`),
montada dentro del hub — y **ya acepta `open` controlado** (`:76-86`).
`learn-hub-client.tsx:184,495-499` ya tiene `const [dailyOpen, setDailyOpen] = useState(false)`
cableado, porque el Focus Passport lo abre con `onPassportTap={() => setDailyOpen(true)}`.

## Comparación

| Criterio | **Daily Focus** (`HubDailyTile`) | **Training** (`/exercises`) |
|---|---|---|
| Tiempo hasta actividad lista | Inmediato — `getDailyTactic(today)` es puro, sin red | Navegación de ruta + `getMergedCatalog()` si hay `CONTENT_STAGE` |
| Pantallas | **0** (sheet sobre el hub donde ya estás) | ≥1 (cambio de ruta) |
| Decisiones del jugador | **0** — el puzzle del día es único y está elegido | Pieza + carril + ejercicio (`piece`/`slot`/`content` en `page.tsx:13-28`) |
| Duración mínima | Un puzzle, `optimalMoves` de un dígito | Un ejercicio, comparable — pero elegido por el jugador |
| Claridad de instrucción | Alta: "el puzzle de hoy" | Requiere que la UI nombre la pieza ([[project_content_loop]]) |
| Estabilidad | Vive en el hub desde Sprint 2; `exercises-screen.tsx` tiene **4.455 líneas** | El componente más grande del repo |
| Mobile | Sheet, ya mobile-first | Pantalla completa, ya mobile-first |
| Traducciones | `HUB_ACTION_RAIL_COPY` completo (EN+ES) | Completo |
| Wallet | **No requerida para jugar.** `useAccount()` sólo para acreditar; guest resuelve `peonesEarned: 0` | No requerida |
| Pago / on-chain | **Ninguno** | Ninguno para jugar, pero `/exercises?sheet=shop\|pro` existe y el banner de cuota Lite vive ahí |
| Reanudación | `recordDailyCompletion` latchea el día; `isCompletedToday` suprime replay | Progreso por ejercicio |
| Emite primera acción | `daily_tactic_started` (`hub-daily-tile.tsx:154`) — ya es alias de `exercise_started` | `exercise_complete` / `training_exercise_started` |
| Muestra cierre | **Sí, y es real:** `FirstFocusDayOverlay` (`:328`) + `WelcomePackageModal` (`:340`) + racha | Overlays de celebración ([[project_celebration_overlay_system]]) |
| Riesgo de duplicar recompensa | **Bajo y ya resuelto**: `earnFiredRef` (`:191`) + `idempotency_key` server-side + `startedFiredRef` | Sin ledger diario que duplicar, pero sin latch tampoco |
| Tests existentes | Vecindario `daily` + `hub` cubierto | Cubierto |

## Decisión: **Daily Focus**, siguiendo la preferencia 1 del brief

Es "una sesión breve, gratuita y estable" literal. Y el costo de implementación es el
argumento decisivo:

> **La variante en LEARN es `setDailyOpen(true)` al terminar el tour.** El estado
> controlado, el sheet, la instrucción, el cierre, la recompensa idempotente y el
> "hub alcanzado" (está debajo del sheet) **ya existen y ya están testeados**.

Training exigiría navegar fuera del hub, elegir pieza por nosotros, y volver — tres
cosas que hoy no existen, contra cero.

**En PLAY** el tile se monta **sin controlar** (`play-hub-client.tsx:110`:
`<HubDailyTile variant="corner-icon" />`). Llevarlo a controlado es el mismo patrón que
LEARN ya usa — pero es trabajo adicional real y decisión de alcance (ver Open questions).

---

# 4. Caller alternativo de PRO (`pro-sheet.tsx:453-456`)

```tsx
onClick={() => { track("pro_extend_tap", { source }); props.onPurchase(); }}
```

| Chequeo | Resultado |
|---|---|
| ¿Termina en el `pay()` con mutex? | **Sí.** `onPurchase` es `handlePurchase` (`use-pro-sheet-state.ts:264`), cuya última línea es `await rail.pay()` — el `pay()` con `payInFlightRef` que cerró la Sesión A. **El dinero está protegido.** |
| Estado visual | ⚠️ **No lo tiene.** Es un `<button>` desnudo: no consulta `resolveCta` (`:82-85`), así que **no se deshabilita** durante `purchasing`/`verifying` ni muestra spinner. El jugador ve un link que no responde. |
| Telemetría | ⚠️ **Duplica dos eventos**, no uno: `pro_extend_tap` **y** `pro_purchase_started` (`:271`), porque ambos se emiten **antes** del mutex. |
| ¿Amplía el riesgo? | **De dinero, no.** De medición, sí — y es el mismo defecto que el brief manda arreglar en B1. |

**Conclusión:** no hay riesgo adicional que justifique ampliar el arreglo del P0. El
arreglo correcto es el de B1 (mover `pro_purchase_started` a "intento aceptado por el
rail"), y **cubre este caller gratis** por estar aguas abajo del mismo `pay()`.

## Por qué `pro_purchase_started` se duplica hoy

`use-pro-sheet-state.ts:271` lo emite en `handlePurchase`, **antes** de `await rail.pay()`.
El mutex vive **dentro** de `pay()`. Dos taps en el mismo tick → dos `handlePurchase` →
**dos eventos**, una sola transferencia. El evento mide **taps físicos**, no intentos
aceptados. Infla el denominador de conversión de PRO.

**Corrección mínima:** que `pay()` devuelva si aceptó el intento (o exponga el estado del
mutex) y emitir el evento **sólo en la rama aceptada**. Un error posterior libera el
mutex en el `finally` que la Sesión A ya escribió → un reintento **sí** emite uno nuevo,
que es la semántica pedida.

---

# Open questions — bloquean alcance, no la implementación

1. **¿La variante entra en LEARN solamente, o también en PLAY?** LEARN es ~10 líneas
   (estado controlado ya existe). PLAY exige levantar el tile a controlado primero.
2. **¿Entra la migración que corrige `stats_activation_funnel`?** Es un cambio de
   producción; queda **escrita y no aplicada** salvo GO. Sin ella el arreglo del funnel
   es sólo de TypeScript y la base sigue devolviendo el número anidado.

## Deliberadamente NO tocado en B0

- No se editó una sola línea de código.
- No se tocó producción.
- No se reabrieron los P0 de la Sesión A.
