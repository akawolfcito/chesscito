# Handoff — Sesión B: experimento Tour → primera actividad (2026-08-05)

> **⚠️ EL CUERPO DE ESTE DOC SE ESCRIBIÓ ANTES DE DESPLEGAR. Manda el apéndice
> "Ejecución" del final.** Desde entonces: `origin/main` = `2666a499`,
> `origin/production` = `b3281c5c` (con el P0 del mutex, que **nunca había llegado a
> producción**), y la migración `20260805020000` está **aplicada**.
>
> **⛔ PARADA VIGENTE:** la variante sigue **apagada** (flag ausente → 0 % → control).
> La Etapa 3 (rollout al 10 %) no arrancó y necesita un **GO nuevo**.

**Documento madre del descubrimiento:** `docs/audits/2026-08-05-session-b-b0-discovery.md`.
Este handoff no lo repite: sólo lo que hace falta para retomar o desplegar.

---

## Hashes

| | Hash |
|---|---|
| Inicial (`origin/main` = `HEAD`) | **`743c1497`** |
| Final (`main` local) | **`990b527c`** |

`origin/main` sigue en `743c1497` — **tres commits sin pushear**.

### Discrepancia documental, resuelta

El handoff de la Sesión A declaraba `origin/main = 5c03d581`; un mensaje decía
`743c1497`. **Ganó `743c1497`**, y no había conflicto real: `5c03d581` es su padre, y
`743c1497` es el commit del propio apéndice (`docs(handoff): record the production
rollout of both P0s`, un archivo, sólo el handoff). El doc no podía citar su propio hash.

### Migraciones

- `20260805010000_close_public_access_to_privileged_views.sql` — **presente**.
- Prefijos duplicados: **ninguno**. El guard de `privileged-views-schema.test.ts:112`
  cubre automáticamente la migración nueva.

---

## Commits

| # | Commit | Qué cierra |
|---|---|---|
| 1 | `20016cbd` `fix(analytics): separate daily and training activation funnels` | B1 funnel |
| 2 | `3157900c` `fix(analytics): dedupe accepted pro purchase attempts` | B1 telemetría PRO |
| 3 | `990b527c` `feat(onboarding): start first activity after tour, instrumented` | B3 + B4 |

**Los commits 4 y 5 del plan se unificaron.** Separarlos habría producido un
intermedio que despliega una variante **sin medición**, que es peor que un diff más
grande. El commit 3 del plan (BalanceReadHealth) **no se hizo** — ver más abajo.

---

# Decisión: Daily Focus, no Training

## Evidencia del repo, no intuición

| Criterio | **Daily Focus** | Training (`/exercises`) |
|---|---|---|
| Decisiones del jugador | **0** — el puzzle del día es único | pieza + carril + ejercicio (`page.tsx:13-28`) |
| Pantallas hasta jugar | **0** (sheet sobre el hub) | ≥1 (cambio de ruta) |
| Wallet para actuar | **No** — `useAccount()` sólo acredita; guest da `peonesEarned: 0` | No |
| Pago / on-chain | **Ninguno** | Ninguno para jugar, pero la superficie hospeda `?sheet=shop\|pro` |
| Cierre real | `FirstFocusDayOverlay` (`hub-daily-tile.tsx:328`) + racha | Overlays de celebración |
| Duplicar recompensa | Ya resuelto: `earnFiredRef` + `idempotency_key` server-side | Sin ledger diario |
| Tamaño del componente | 390 líneas | **4.455 líneas** |

## El argumento decisivo

`learn-hub-client.tsx:184` ya tenía `const [dailyOpen, setDailyOpen] = useState(false)`,
porque el Focus Passport abre esa misma instancia (`onPassportTap`). **La variante es
`setDailyOpen(true)`.** El sheet, la instrucción, el cierre, la recompensa idempotente y
el "hub alcanzado" (está debajo) ya existían y ya estaban testeados. Training habría
exigido navegar fuera del hub, elegir pieza por el jugador, y volver.

## Trampa evitada

`/challenge/daily` **no es la superficie de juego del Daily**: es la landing de un link
compartido. Emite `challenge_*`, pasa `isConnected={false}` hardcodeado y **no acredita
Peones**. Usarla como destino habría hecho que la variante **pierda la recompensa** que
el control sí cobra — un experimento que compara dos cosas distintas.

---

# B1 — Higiene analítica

## Funnel: consumidores y qué cambió

| Consumidor | Dependía del orden | Estado |
|---|---|---|
| `lib/stats/funnels.ts` `computeActivation` | No (sólo itera) | Actualizado a 4 pasos + `computeDailyFocusFunnel` |
| `lib/stats/public-aggregator.ts:874` | No | Campo nuevo `dailyFocusFunnel` |
| `components/stats/stats-page.tsx:273,908` | **Sí — lo renderiza** | Dos ramas etiquetadas + prosa |
| `supabase/migrations/20260805000000_...sql:173` | **Sí — el orden ES la lógica** | Corregido en migración nueva, **sin aplicar** |
| `lib/analytics/__tests__/canonical-events.test.ts:36` | Pin literal | Reescrito |
| `supabase/migrations/__tests__/stats-rpc-privileges.test.ts:197` | Pin contra el array | Split: histórico pinneado a literales, nuevo pinneado al vocabulario vivo |

### 🔎 Hallazgo que cambió el alcance

**`stats_activation_funnel` tiene CERO call sites.** Verificado por grep sobre `src/` y
`scripts/`: `/stats` calcula el funnel en TypeScript (`computeActivation`). La RPC vive
en prod desde 2026-08-04 pero nadie la llama. Son **dos mentiras distintas**:

- **SQL (latente):** anida Daily dentro de Training (`where c.s2 and c.s3 and c.s4 and c.s5`).
- **TypeScript (viva en pantalla):** conteos independientes rotulados como embudo.

### Cambio de semántica

**Antes:** un array lineal de 5 pasos.
**Ahora:** dos funnels hermanos que comparten `app_opened → hub_viewed`:

```
app_opened → hub_viewed ─┬→ exercise_started      → exercise_completed
                         └→ daily_focus_started   → daily_focus_completed
```

Además `daily_tactic_started` **salió** de `exercise_started`. Era la mitad espejo del
defecto: metía a todo el que empieza el Daily en el funnel de Training y lo dejaba caer
en el paso 4, deprimiendo la finalización de Training con gente que nunca entrenó.

⚠️ **Ruptura de serie esperada** el día que se aplique la migración:
`exercise_started` y `exercise_completed` **bajan**. Es la corrección, no una caída de
tráfico.

⚠️ **Deuda preexistente NO tocada:** `computeActivation` sigue contando pasos de forma
independiente, así que el array no está garantizado monótono (prod mostró una vez
`app_opened 37 < hub_viewed 41`). Anidarlo mueve números vivos y es un cambio aparte;
la RPC ya implementa la forma anidada para quien la cablee.

## Telemetría PRO

`pro_purchase_started` contaba **taps**. `resolveCta` deshabilita el CTA durante
`purchasing`/`verifying`, pero ese gate sólo actúa **después de un re-render**: dos taps
en el mismo tick llegan los dos a `handlePurchase`. El mutex de la Sesión A frenó la
segunda **transferencia**, nunca el segundo **evento**.

`useProRail.pay()` ahora acepta `{ onAccepted }`, invocado una vez justo después de
tomar el mutex y **antes de cualquier await**.

| Validación | Resultado |
|---|---|
| Doble tap sincrónico | **1 evento**, 1 transferencia (antes: 2 eventos) |
| Caller alternativo `pro-extend-link` (`pro-sheet.tsx:453`) | Tampoco duplica — llega al mismo `pay()` |
| Error → reintento | Cuenta **dos veces**, correcto: el mutex se libera en el `finally` |
| Orden | `started` sigue precediendo a `confirmed` |
| Compras históricas | Mismo nombre, mismo payload, misma atribución. **Sólo se movió el punto de emisión** |

`pro_extend_tap` sigue disparando por tap — es lo que dice su nombre.

### `pro-sheet.tsx:453-456` — respuesta a la open question heredada

**No amplía el riesgo de dinero:** `onPurchase` → `handlePurchase` → `rail.pay()`, el
mismo `pay()` con mutex. **Sí tiene dos defectos menores, uno ya cerrado:**

- ✅ Telemetría duplicada — cerrada por este commit.
- ⚠️ **Abierto:** es un `<button>` desnudo que no consulta `resolveCta`, así que **no se
  deshabilita** durante `purchasing`/`verifying` ni muestra spinner. El jugador ve un
  link que no responde. Es cosmético (el mutex protege la plata) y queda como deuda.

---

# B2 — BalanceReadHealth: **NO implementado**

El brief lo autoriza explícitamente: *"Si este slice supera el alcance mínimo, dejalo
como commit o sesión independiente y continuá con el experimento."*

**Supera el alcance mínimo.** Toca el camino de lectura de balance
(`use-get-peones-token-selection.ts`), la clasificación de errores de viem con una
invariante de privacidad dura (los errores embeben la URL del RPC y el calldata del
`balanceOf`, o sea la wallet), tres ramas nuevas en `use-pro-sheet-state.ts:264-270`, y
copy nueva en **dos** bundles (`editorial.ts` **y** `messages/es.ts`, porque el guard de
traducción cubre el bundle entero). No cabe en "pequeño y aislado".

**No bloquea el experimento:** el primer flujo de onboarding no lee saldo, no paga y no
firma. El diseño completo sigue vivo en
`docs/handoffs/2026-08-05-prod-audit-p0-verification-handoff.md` §"Próxima acción".

---

# B3 — El experimento

## Control

`tour → hub`, **byte por byte**. Con el rollout en 0 % no se abre nada y no se pide nada.

## Variante

`tour → Daily Focus abierto → primera jugada → cierre visible → hub`

**Sin superficie nueva.** Reutiliza el `HubDailyTile` controlado que el hub ya monta.
Sin paywall, sin PRO, sin Add Cash, sin tienda, sin selección de modo, sin transacción,
sin wallet para actuar. La primera acción es un movimiento de ajedrez.

## Elegibilidad

| Condición | Cómo se resuelve |
|---|---|
| Instalación nueva / tour no completado | El propio gate del tour: quien ya lo vio tiene la clave `chesscito:hub-tour:learn:v2` escrita y **nunca lo ve de nuevo** |
| Sin progreso relevante | `dailyAlreadyDone` (`liteFocusPassport.todayDone`) |
| Superficie | `CHESSCITO_LITE_MODE` — **LEARN únicamente**. PLAY ni se asigna |
| No es replay manual | `onFinished({ replay })` |
| Variante asignada | Hash FNV-1a del install id vs. el porcentaje |

## Asignación estable

Función **pura** del install id (`getAnonymousId()`, persistente en localStorage). Nada
se persiste aparte. Refresh, reentrada y navegación atrás **no pueden mover a nadie**,
porque no hay estado que se pueda desincronizar.

**Un install sin id** (WebView con storage deshabilitado) queda **fuera del experimento**,
no en control: un install que no se puede atribuir tampoco se puede contar, y meterlo en
control infla ese brazo.

## Idempotencia

**Un solo latch, el del tour**, escrito por `markHubTourSeen` **antes** de que corra
`onFinished`. El tour se completa una vez por instalación → la actividad se abre una vez
por instalación. La recompensa la latchea `recordDailyCompletion`, exactamente igual que
para control. Un segundo latch habría creado dos fuentes de verdad para un mismo hecho.

## Fallbacks — todos aterrizan en el hub y **todos se reportan**

| Caso | Evento |
|---|---|
| Daily de hoy ya hecho | `activity_failed{reason:already-done}` + `fallback_to_hub` |
| El puzzle de hoy no resuelve | `activity_failed{reason:no-puzzle}` + `fallback_to_hub` |
| Replay manual del tour | Sin asignación, hub intacto |
| Sin install id | Fuera del experimento |

La lectura de "listo" se hace contra **la misma fuente que renderiza el tile**
(`getDailyTactic(todayUtc())`), así que "ready" no es una suposición. El fallback es *no
hacer nada*, que es el único fallback que no puede fallar él mismo.

---

# B4 — Eventos

Los que describen el **experimento** son nuevos. Los que describen la **actividad** NO:
la primera acción, la finalización y la racha siguen saliendo de `hub-daily-tile.tsx`
con sus nombres de siempre. Duplicarlos bajo nombres de onboarding habría **doble-contado
las finalizaciones del Daily** para el brazo variante y hecho incomparables los dos
grupos justo en la métrica que juzga el experimento.

| Momento | Evento | Payload |
|---|---|---|
| Tour terminado | `hub_tour_finish` *(existente)* | `mode`, `outcome` |
| Variante asignada | `onboarding_variant_assigned` | `variant`, `surface`, `outcome` |
| Redirección solicitada | `onboarding_activity_requested` | `variant`, `surface`, `activity` |
| Actividad lista | `onboarding_activity_ready` | idem |
| Falló al cargar | `onboarding_activity_failed` | + `reason` (enum cerrado) |
| Fallback al hub | `onboarding_fallback_to_hub` | + `reason` |
| Primera acción | `daily_tactic_started` *(existente)* | — |
| Completada | `daily_tactic_completed` *(existente)* | — |
| Cierre visible | `onboarding_closure_shown` | `variant`, `surface`, `closure` |
| Hub posterior | `onboarding_hub_reached` | + `completed_activity` |

**El cierre NO es `daily_streak_updated`.** Ese se emite del mismo bloque que la
completación (`lib/daily/telemetry.ts:118`), así que mediría la completación una segunda
vez bajo otro nombre. `onboarding_closure_shown` se dispara cuando el Daily pasa a hecho
**con el sheet abierto** — o sea, el jugador vio la pantalla terminada con su progreso.

🔒 **Sin PII.** Ningún payload lleva wallet, email, nombre custom ni texto libre; los
`reason` son enums cerrados. Hay un test que serializa cada payload de onboarding y falla
si aparece algo con forma de dirección o de email.

---

# Pruebas

| Qué | Resultado |
|---|---|
| `canonical-events.test.ts` | **14/14** (9 fallaban antes) |
| `funnels.test.ts` + `stats-page.test.tsx` | **241/241** en el vecindario de stats |
| `stats-rpc-privileges` + `privileged-views-schema` | **58/58** |
| `use-pro-rail.test.ts` | **19/19** (4 nuevos fallaban antes) |
| `use-pro-sheet-state.test.tsx` + vecindario PRO | **307/307** |
| `first-activity-experiment.test.ts` | **24/24** (nuevo) |
| `use-hub-tour.test.tsx` | **14/14** (5 nuevos) |
| `learn-hub-client-onboarding-experiment.test.tsx` | **16/16** (nuevo) |
| **Suite completa `apps/web`** | **7384/7384 · 595/595 archivos** |
| `tsc --noEmit` | `No errors found` |
| `pnpm build` | **exit 0** |

Sin sección `Unhandled Errors`. Los stack traces del final son los de siempre
(`primitive-boundary.test.tsx` lanza `Error: boom` a propósito) más avisos de jsdom
sobre navegación.

**RED verificado explícitamente** en los dos arreglos, no asumido:
- Funnel: 9 tests en rojo antes del cambio.
- PRO: se revirtió el implementador a mano y los tests dieron
  `AssertionError: expected 2 to be 1` en los dos casos de doble tap; después se
  restauró.

**VR / Playwright: NO se corrió.** CI tampoco lo corre y no lo pedía la orden.

---

# QA mobile — qué se verificó y qué no

**El experimento no agrega ni un pixel.** La variante abre un sheet que ya existía y que
ya se probó en móvil; el control no cambia. `use-hub-tour.ts` gana un callback y
`learn-hub-client.tsx` gana lógica sin render.

**El único markup nuevo está en `/stats`**: la sección 2 pasa de una columna a
`grid-cols-1 md:grid-cols-2`, o sea **apilada en móvil** — un bloque debajo del otro, sin
cambio de ancho. Las barras siguen usando anchos en `%` dentro del mismo `flex
items-center gap-2` de antes, así que no hay overflow horizontal nuevo. `/stats` es
además una superficie de pantalla grande por decisión previa.

⚠️ **Honestidad sobre el alcance:** esto es revisión del markup, **no una prueba en
dispositivo**. No se levantó dev server ni se fotografió nada.

---

# Riesgos

1. **El flag es de build.** `NEXT_PUBLIC_*` se inlinea en el build, así que cambiar el
   porcentaje **exige redeploy**. Es el mecanismo que ya usan `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`
   y compañía; no se creó una plataforma nueva porque el brief lo prohíbe. Mitigante
   real: la asignación ocurre **una sola vez, al terminar el tour**, así que nadie queda
   "a mitad de camino" — poner 0 % + redeploy corta toda asignación nueva de inmediato.
2. **Volumen.** Con ~2.700 instalaciones/día y D1 ≈1,3 % (≈36 personas), **un solo día no
   decide nada**. Cualquier diferencia entre brazos va a estar dentro del ruido.
3. **`session_id` se re-acuña** al borrar storage o reinstalar. Un jugador que vuelve
   cuenta como instalación nueva **y puede caer en el otro brazo**. Deprime D1 en los dos
   brazos por igual, así que sesga poco la comparación, pero infla el denominador.
4. **La migración sin aplicar deja la RPC mintiendo.** Hoy no importa (cero call sites),
   pero si alguien cablea Fase C antes de aplicarla, `/stats` empieza a mostrar el número
   anidado.
5. **Ruptura de serie** en `exercise_started`/`exercise_completed` al aplicar la
   migración. Documentada arriba; hay que anunciarla o se lee como caída de tráfico.
6. **Daily ya hecho.** Un jugador que instala, hace el Daily desde el gift, y recién
   después termina el tour cae en `already-done`. Está reportado, pero diluye el brazo
   variante. Debería ser raro: el tour sale al primer mount del hub.

---

# Rollout recomendado

**Nada de esto está hecho. Requiere GO.**

1. **Push del código** (`743c1497..990b527c`). Los tres commits son seguros juntos: con
   el flag ausente el rollout es 0 % y el experimento no existe en runtime.
2. **Aplicar la migración analítica** — opcional y desacoplada del experimento:
   ```
   supabase db push --dry-run     # debe resolver EXACTAMENTE a 20260805020000
   supabase db push
   ```
   Se autoverifica: si `anon` conserva EXECUTE, **aborta con excepción**.
3. **Probe post-deploy** (sección 5 de la migración). ⚠️ `supabase db query` apunta a la
   base **LOCAL** por defecto — pasar **`--linked`**.
4. **Encender la variante gradualmente**, con redeploy en cada paso:
   `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` = **10 → 25 → 50**.
   **⛔ NO ir a 100 automáticamente.**
5. Entre escalón y escalón: confirmar que `onboarding_variant_assigned` llega con los dos
   valores de `variant` y que `onboarding_activity_failed` no domina.

## Rollback

| Qué | Cómo |
|---|---|
| Experimento | `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT=0` + redeploy. **Sin revert de código.** Corta toda asignación nueva; nadie queda a mitad de camino |
| Commit `990b527c` | `git revert 990b527c`. Sólo si el flag no alcanza |
| Commit `3157900c` | `git revert 3157900c`. Vuelve el doble conteo de `pro_purchase_started`. No arriesga dinero |
| Commit `20016cbd` | `git revert 20016cbd`. Vuelve el funnel mentiroso |
| Migración | Sección 6 de `20260805020000_...sql`, copiable tal cual. ⚠️ Restaura el anidamiento falso |

---

# Consultas para medir

## A 24 h — ¿la variante hace algo?

```sql
-- Cobertura por brazo: quién fue asignado y qué le pasó.
with assigned as (
  select distinct session_id,
         payload->>'variant' as variant
    from analytics_events
   where event = 'onboarding_variant_assigned'
     and created_at >= now() - interval '24 hours'
)
select a.variant,
       count(*)                                                as installs,
       count(*) filter (where e.event = 'onboarding_activity_ready')   as activity_ready,
       count(*) filter (where e.event = 'onboarding_activity_failed')  as activity_failed,
       count(*) filter (where e.event = 'daily_tactic_started')        as first_action,
       count(*) filter (where e.event = 'daily_tactic_completed')      as completed,
       count(*) filter (where e.event = 'onboarding_closure_shown')    as closure_seen,
       count(*) filter (where e.event = 'onboarding_hub_reached')      as hub_after
  from assigned a
  left join lateral (
    select distinct event
      from analytics_events x
     where x.session_id = a.session_id
       and x.created_at >= now() - interval '24 hours'
  ) e on true
 group by a.variant
 order by a.variant;
```

⚠️ **Verificar antes de creerle:** que `payload` sea el nombre real de la columna JSON de
`analytics_events`. **No se confirmó en esta sesión** — no se tocó producción.

```sql
-- Salud del rail: ninguna razón de fallo debería dominar.
select payload->>'reason' as reason, count(*)
  from analytics_events
 where event = 'onboarding_activity_failed'
   and created_at >= now() - interval '24 hours'
 group by 1 order by 2 desc;
```

```sql
-- Que el dedupe de PRO haya bajado el conteo sin matarlo.
select date_trunc('hour', created_at) as hour,
       count(*)                          as started_events,
       count(distinct session_id)        as installs
  from analytics_events
 where event = 'pro_purchase_started'
   and created_at >= now() - interval '24 hours'
 group by 1 order by 1;
-- Se espera que started_events/installs BAJE hacia ~1. Si sigue en ~1,3 el
-- dedupe no llegó al bundle que corre.
```

## A D1 — ¿mejora sin arruinar la calidad?

Base: `docs/audits/2026-08-05-daily-focus-activation-d1.sql`, **corriendo primero sus
secciones 2a–2e**. Encima, el corte por brazo:

```sql
with cohort as (
  select session_id,
         min(payload->>'variant') as variant,
         min(created_at)::date    as day0
    from analytics_events
   where event = 'onboarding_variant_assigned'
     and created_at >= :day::timestamptz
     and created_at <  (:day::date + 1)::timestamptz
   group by session_id
),
returned as (
  select distinct c.session_id
    from cohort c
    join analytics_events e on e.session_id = c.session_id
   where e.created_at >= (c.day0 + 1)::timestamptz
     and e.created_at <  (c.day0 + 2)::timestamptz
)
select c.variant,
       count(*)                                     as cohort,
       count(r.session_id)                          as returned_d1,
       round(100.0 * count(r.session_id) / nullif(count(*), 0), 2) as d1_pct
  from cohort c
  left join returned r on r.session_id = c.session_id
 group by c.variant
 order by c.variant;
```

- **Frontera de día: UTC.** `created_at` es `timestamptz` y la app nunca escribe una
  clave de día local.
- **"Volvió" = día calendario**, no ventana móvil de 24 h.

## Regla de decisión

**No declarar éxito porque suba `daily_tactic_started`.** Más inicios con caída fuerte de
finalización **no es éxito**. El par que manda es `completed / installs` por brazo, con
D1 como confirmación. Las compras son secundarias. **Y no decidir con un solo día**
(punto 2 de Riesgos).

---

# Cosas deliberadamente NO implementadas

- **BalanceReadHealth (B2)** — argumentado arriba. Sesión aparte.
- **PLAY** — decisión explícita del founder. Extensión posterior, condicionada a
  evidencia positiva en LEARN. `play-hub-client.tsx` **no se tocó** y `HubDailyTile`
  **no** se levantó a controlado ahí.
- **Aplicar la migración `20260805020000`** — parada firmada.
- **Cablear el agregador a las RPC (Fase C)** — fuera de alcance. `dailyFocusFunnel` ya
  existe como campo, así que cuando se haga, la rama Daily entra sin código nuevo de UI.
- **Anidar `computeActivation`** — mueve números vivos; cambio aparte.
- **El estado visual de `pro-extend-link`** — cosmético, no arriesga dinero.
- **`leaderboard_v`** — no se tocó ni se dropeó.
- **Los cuatro archivos sin trackear heredados** — siguen sin decidir.
- **`.env.template`** — no se agregó el flag nuevo, porque el template **tampoco lista**
  `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` ni `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED`. Agregar uno
  solo habría sido inconsistente.
- **Baseline de `CLAUDE.md`** — dice 6515/552; el real es **7384/595**. Sigue sin
  actualizarse (tercera sesión que lo señala).

---

# Estado final del árbol

`main` local, **3 commits por delante de `origin/main`**. Sin cambios sin commitear salvo
lo preexistente más el doc de descubrimiento de esta sesión:

```
 M SESSION.md
?? docs/audits/2026-08-05-cruce-local-script-verification.md
?? docs/audits/2026-08-05-prod-audit-verification.md
?? docs/audits/2026-08-05-session-b-b0-discovery.md      ← nuevo, de esta sesión
?? docs/handoffs/2026-08-05-prod-audit-p0-verification-handoff.md
```

---

# Open questions

1. **¿GO para pushear los tres commits?** No encienden nada: el rollout es 0 %.
2. **¿GO para aplicar `20260805020000`?** Independiente del experimento.
3. **¿Con qué porcentaje arranca la variante?** Recomendado: **10 %**.
4. **¿BalanceReadHealth entra como sesión propia, y con qué prioridad** frente a leer los
   resultados del experimento?
5. **`leaderboard_v`** — la quinta vista stale con el bug de overflow. ¿Se dropea?
6. **Los cinco archivos sin trackear** — ¿se commitean?

---

# Ejecución — 2026-08-05 (apéndice; manda sobre el cuerpo donde difieran)

## Etapa 1 — Push

`origin/main` = **`2666a499`** (4 commits, fast-forward). Flag
`NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` **ausente en los dos proyectos** de Vercel
→ default 0 → control. Auditado antes de pushear.

## ⚠️ Sorpresa 1 — producción NO sigue `main`

El cuerpo de este doc asumía que pushear a `main` desplegaba. **No.** Producción sigue la
rama **`production`**: el alias de `learn.chesscito.com` es
`lite-chesscito-git-**production**-goodwolf.vercel.app`, y `origin/production` = `b90ee4f6`
(2026-08-04 14:29) se corresponde con el deploy Production de las 14:48 del mismo día.
Pushear a `main` genera **Preview** en los dos proyectos.

**Consecuencia grave, anterior a esta sesión:** `git branch -r --contains fbbe33ff`
devolvía **sólo `origin/main``. El commit del **mutex PRO — el P0 del doble cobro —
nunca había llegado a producción.** El handoff de la Sesión A declara los dos P0
"desplegados y verificados en producción"; eso es cierto para la migración de vistas
(se aplica con `supabase db push --linked`, independiente del deploy de la app) y
**falso para el mutex**.

## ⚠️ Sorpresa 2 — `production` estaba indeployable desde el 4 de agosto

El primer push del hotfix falló a los 8 s en los dos proyectos:

```
Running "bash ../../scripts/ops/vercel-should-build.sh web"
bash: ../../scripts/ops/vercel-should-build.sh: No such file or directory
```

El "Ignored Build Step" de ambos proyectos apunta a un script que sólo existía en `main`,
agregado por `4d2d4eaf` el **2026-08-04 18:21** — 3½ h **después** del último deploy
Production exitoso. Nadie había tocado `production` desde entonces, así que el defecto
estaba latente. Los deploys fallidos **no** reemplazaron los alias: no hubo impacto de
usuario en ningún momento.

## Hotfix del P0 en `production`

`origin/production` = `b90ee4f6` → **`b3281c5c`**, por cherry-pick, sin merge de los 29
commits de `main`:

| Commit | Origen | Qué es |
|---|---|---|
| `5a5e3e09` | `fbbe33ff` | mutex PRO + sus tests |
| `b3281c5c` | `4d2d4eaf` | `vercel-should-build.sh` + su test (prerequisito de Vercel) |

Diff contra `b90ee4f6`: **exactamente 4 archivos** — `use-pro-rail.ts` (+17/−1), sus tests
(+161), el script (+119, bit `100755` preservado), su test (+156). Nada de Sesión B, ni
`/stats`, ni migraciones.

**Verificación:** 261 tests del script · 498 vecindario PRO/payments (incluye 14/14 de
`use-pro-rail`) · `tsc` exit 0 · `pnpm build` exit 0 · `bash -n` OK.
⚠️ `shellcheck` **no está instalado** en esta máquina; no corrió.

**Deploys:** `lite-chesscito-3kovz9o3n` y `chesscito-ejrjzrowa`, ambos ● Ready ·
Production. Alias movidos (`learn` + `lite` → learn; `play` → play).

**Log de la decisión de build**, que era el punto de fallo:

```
Cloning ... (Branch: production, Commit: b3281c5)
Running "bash ../../scripts/ops/vercel-should-build.sh web"
[should-build] delegating to turbo-ignore for workspace 'web'
≫   This commit affects "web"
✓ Proceeding with deployment
[should-build] BUILD — turbo-ignore reports this workspace is affected
```

**Trazabilidad del mutex:** alias → `3kovz9o3n` → commit `b3281c5` (del log) → `5a5e3e09`
es ancestro (`merge-base --is-ancestor`, exit 0) → `use-pro-rail.ts` en ese árbol contiene
`payInFlightRef` 5 veces.

⛔ **El doble tap NO se probó contra producción**, por decisión explícita: exige una wallet
con fondos y mueve dinero real — un doble tap contra el bug **sería** el cobro doble. La
evidencia es la reproducción automatizada (el test falla sin el fix con
`expected "vi.fn()" to be called 1 times, but got 2 times`) más la cadena de trazabilidad
de arriba.

## Etapa 2 — Migración aplicada

Proyecto verificado antes de tocar nada: **`brsbdzpuvotxsadmcxyj`** (producción).

`supabase db push --dry-run --linked` resolvió a **exactamente una** migración,
`20260805020000_split_daily_focus_from_training_funnel.sql`. Sin colisiones.

Aplicada. El bloque `do $$` de autoverificación **no abortó**. Historial remoto:
`20260805000000`, `20260805010000`, `20260805020000`.

### Contrato preservado

| Función | Argumentos | Shape | anon | auth | service_role |
|---|---|---|---|---|---|
| `stats_activation_funnel` | `p_surface text DEFAULT NULL, p_container text DEFAULT NULL` | `TABLE(step text, sessions bigint)` | f | f | **t** |
| `stats_daily_focus_funnel` | idem | idem | f | f | **t** |

9 funciones `stats_*` en total: las 8 originales + la nueva.

### 🔎 La evidencia de que el split hacía falta

Contra datos reales de producción:

```
TRAINING  app_opened=5898 | hub_viewed=5797 | exercise_started=1107 | exercise_completed=788
DAILY     app_opened=5898 | hub_viewed=5797 | daily_focus_started=1261 | daily_focus_completed=901
```

Las dos ramas comparten los primeros dos pasos **idénticos** (5898 / 5797) — son hermanas
del mismo tronco. Y **`daily_focus_completed = 901 > exercise_completed = 788`**.

Bajo la definición vieja, `daily_focus_completed` se calculaba como
`s2 and s3 and s4 and s5`, así que **no podía superar 788 por construcción**. Estaba
suprimiendo ≥113 finalizaciones de Daily reales. Es el fenómeno "426 > 415 parece un bug",
medido en vivo.

### Nada fuera de alcance

| Chequeo | Resultado |
|---|---|
| Las 5 vistas | Idénticas al estado post-Sesión A (las 4 cerradas `anon=f`; `leaderboard_v` sigue siendo la excepción legacy conocida) |
| `leaderboard_combined_v` | 10 filas (top-10 intacto) |
| `leaderboard_full_v` | 448 jugadores (era 441 hace un día) |
| `peones_balances` | 4.654 wallets (eran 4.567) |
| `/stats` learn + play | **200**, Leaders renderiza |
| Filas de probe filtradas a prod | **0** |

### Rollback — probado, no sólo documentado

`scripts` del probe en el scratchpad, ejecutado contra el Postgres local dentro de **una
transacción revertida al final**, con un fixture de dos instalaciones (una sólo-Daily, una
sólo-Training):

- Definiciones nuevas → training **4 filas**, daily **4 filas**.
- Cada instalación aparece en **su propia rama** y no en la otra.
- Rollback de la sección 6 → `stats_activation_funnel` vuelve a **5 filas**,
  `stats_daily_focus_funnel` **desaparece** (`to_regprocedure` → NULL).
- `rollback;` → la base local queda sin ninguna de las dos funciones. Intacta.

## Estado al cerrar

| | |
|---|---|
| `origin/main` | `2666a499` |
| `origin/production` | `b3281c5c` (desplegado y sirviendo) |
| Migración | `20260805020000` **aplicada** en `brsbdzpuvotxsadmcxyj` |
| Flag de la variante | **ausente → 0 % → control**. Sin activar |
| `production..main` | **29 commits** |

⚠️ **Rama y base desincronizadas por diseño del flujo actual:** `origin/production` no
contiene las migraciones `20260805*`, pero las tres están aplicadas en la base. Quien
deduzca el schema leyendo la rama se va a equivocar.

## Pendiente

1. Etapa 3 — rollout al 10 % (no arrancó).
2. Reconciliar `production` con `main` sin perder el hotfix. Los dos commits de
   `production` son cherry-picks de commits que ya viven en `main`, así que no hay nada
   que rescatar de ese lado.
