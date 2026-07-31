# Índice de backlog — 2026-07-10

> Auditado **contra el código**, no contra las listas. Reemplaza al triage del 2026-07-09.
> Antes de trabajar un item, verificá que siga vivo: dos entradas ya estaban muertas la
> última vez que alguien miró.

**Estado:** `main` = `827e7cfe` · 4853 passing / 401 files · smoke de MiniPay cerrado en device.

---

## 0. Cerrado desde el triage anterior — no reabrir

| Item | Cerrado en | Evidencia |
| --- | --- | --- |
| CTA dorado "Save proof" inalcanzable | #183 | `exercises-screen.tsx:1072` usa `deriveCanSaveOnChain()` |
| LEARN #4 Post-Focus Free Practice | #191 | `exercise-drawer.tsx:120` `isExerciseReplayable()` |
| Baseline VR `hub-shop-sheet-open` rojo | `28b2f75` | eran dos fallos: SKUs retirados + env contaminado |
| PLAY #7 Coach HUB icon | **#207** | `play-hub-scaffold.tsx` → `new-icons-chesscito/training.png` |
| Dead-end de cancelación en victory | **#206** | cancelar vuelve a `VictoryCelebration` + toast |

`docs/backlog/2026-07-08-lote2-smoke-findings-learn-play-backlog.md` todavía describe los dos
primeros como abiertos. Es deriva de documentación.

---

## 1. Investigación primero, no código

**"Claim 3 Shields" (LEARN #1) — CERRADO el 2026-07-27.**
Investigación completa: `docs/reviews/2026-07-27-claim-3-shields-investigation.md`.

Las tres preguntas quedaron respondidas y **dos describían un bug ya arreglado**:
pertenece al **Welcome Pack** (gratis, variante C del rescate); lo de "manda a la tienda"
era un argumento descartado en silencio por una asignación que TypeScript acepta, arreglado
el **2026-07-13** — tres días *después* de que se escribiera esta entrada, que nadie volvió
a cerrar; y **no duplica** (UNIQUE en `welcome_pack_claims` + rama 23505 sin acreditar).

El único defecto real era el **opuesto**: si el INSERT entraba y el `INCRBY` fallaba, la
fila marcaba el pack como reclamado con el saldo intacto y todo reintento caía en
"ya reclamado" ⇒ 3 escudos perdidos para siempre. Cerrado en `6cc68ce`: la fila insertada
en ese request se revierte si el crédito no aterriza.

---

## 2. Barato (1–3 h), sobre superficie existente

- **Decoder de custom errors** — `docs/backlog/2026-07-10-custom-errors-decoder.md`. GO con
  evidencia, **no bloquea estabilidad**: los reverts ya se interceptan, no producen éxito
  falso, y hay fallback genérico. Hoy `BadgeAlreadyClaimed`, `CooldownActive` y
  `DailyLimitReached` salen los tres como "Try again". El extractor está escrito; falta el
  generador de error-ABIs desde `artifacts/` y el mapa nombre → copy.
- ~~**P2 — `offerBenefitTrainings` sin traducir al español**~~ (2026-07-27) — **hecho**:
  dice "Entrenamientos especiales", el mismo término que ya usa la senda. La causa era el
  spread `...en.CHALLENGE_CARD_COPY`, que hace que una traducción faltante **resuelva y
  renderice en inglés** en vez de fallar. Queda un guard de regla —no de copy pineada— en
  `challenge-card-es-parity.test.ts`: ningún valor ES puede ser idéntico al inglés salvo
  que no tenga nada que traducir (`"{count}"`, `"{day}: {state}"`).
- ~~**Esa misma regla, pero sobre TODO el bundle**~~ — **hecho el 2026-07-30** (`ddd3b83`).
  El guard de arriba miraba un solo namespace. Generalizado en
  `bundle-translation-parity.test.ts`, destapó **24 claves más** en inglés sobre pantalla
  española: el nudge de racha entero, el 404, la tarjeta de Peones, las baldosas del riel y
  el chip de razones. La mayoría **nunca estuvo en `es.ts`**: resolvían por el spread.
  Decisión de vocabulario del founder: `Daily` → **"Diaria"** (no "Diario", que se lee como
  periódico). El switch LEARN/PLAY pasó a i18n en `c748b3b`, que era lo que ataba
  `mateLabel` al inglés. Audit: `docs/audits/2026-07-30-i18n-and-orphan-art-audit.md`.
- ~~**Arte huérfano del landing**~~ — **hecho el 2026-07-30** (`ddfccdb`, `4270eb8`):
  42 archivos / ~19.6 MB en `apps/landing` (restos del rediseño de slides del 29) + 5 en
  `apps/web` (`bg-card-og`, `torre-selected`). Con ellos se fueron los 12 slots
  `deprecated` del registro. ⚠️ **Quedan ~7.5 MB en `apps/web` SIN verificar**
  (`/scene-rooted`, raíz de `/art`, `/redesign/avatars`): pide chequeo familia por familia,
  no barrido.
- **PLAY #8 — quitar la confirmación redundante de LUZ.** Tocar Coach Review lanza análisis
  directo; LUZ conserva personalidad en loading y resultado. Borra una pantalla.
- ~~**Leaders: el hero cuenta el CORTE, no la población**~~ (visto en device 2026-07-29)
  — **hecho el 2026-07-29** (`40893b1`, `483f0c9`, `899b6db`). El hero lee `total`, contado
  con `count: "exact", head: true` sobre las relaciones **sin cortar**
  (`leaderboard_full_v` · `leaderboard_weekly_full_v` filtrada por surface). **Sin migración**:
  las dos vistas ya tienen una fila por jugador rankeado.
  ⚠️ Lo que queda fijado para el próximo que toque esto:
  - `total` va **sólo** en las formas windowed; las dos legacy siguen congeladas y **no
    disparan el conteo** (hay test de que la función no se llama).
  - **Conteo fallido ⇒ el campo se omite y el hero borra la cifra.** Nunca `rows.length`
    (es el defecto) ni `0` (afirma un board vacío sobre uno poblado). Hay un **source guard**
    que prohíbe `count: rows.length`: la versión mala renderiza bien y sólo miente cuando la
    población pasa el corte, así que ningún test de comportamiento la obliga a aparecer.
  - Con el flag ON el tab all-time pasó a pedir `?window=alltime` (la forma legacy no puede
    llevar `total`); con el flag OFF sigue en la URL legacy y el hero muestra sólo los puntos.
  - El conteo semanal **no toma ventana** — `leaderboard_weekly_full_v` calcula siempre la
    semana UTC actual. Un request que cruce el lunes 00:00 UTC entre las dos queries mezcla
    conteo nuevo con filas viejas; se autocorrige al refetch. **Si algún día hay board de
    semanas pasadas, esto deja de alcanzar.**
- ~~**Cobertura VR del play hub**~~ — **hecho**: `vr17-play-hub-{guest,connected,pro}`.
  El hub **LEARN** también, desde el 2026-07-27: `vr18-learn-hub-{guest,active,pro}` sobre
  `/dev/learn-hub`.

---

## 3. Medio (medio día), necesitan ojo de diseño (GOAL → Sally → mock → código)

- **PLAY #9 Coach Analysis Loading Overlay** + **PLAY #10 Save Match Success Celebration** —
  ambos son "cerrar el loop emocional después de una acción". Agrupables.
- **LEARN #2 Post-Claim Gift Overlay** — mismo patrón: mostrar QUÉ ganó y para qué sirve.
- **Modal `Piece Unlocked` fuera del vocabulario visual** —
  `docs/backlog/2026-07-09-piece-unlocked-modal-visual-vocabulary.md`.
- **PLAY #11 Dock de 4 slots** — simetría/espaciado tras ocultar Leaderboard. No es swap de
  asset. Ojo en device + baseline VR.
- **LEARN #5 Shop Active State** — con Season Pass activo el Shop solo muestra un modal. Hay
  una pregunta de producto adentro: ¿merece slot en el dock?
- **PLAY #6 Coach Review Flow** — sin PRO, el diario no debe quedar enterrado. Valor mínimo
  visible para free.
- **Icono de Shop sin marco** (nuevo). Tactics y Coach son badges enmarcados; Shop no. No
  existe asset enmarcado de shop → **pedido de arte**, no cambio de código.

---

## 4. Deuda con consecuencias — decidir, no postergar

- ⚠️ **`/api/sign-badge` firma cualquier `levelId` 1..10000 sin verificar estrellas**
  (`route.ts:23`). El gate de 10★ es **client-only**. El contrato bloquea reclamar *dos veces*,
  no reclamar *sin merecerlo*. Cierra con server-verified progress.
- **Server-verified progress** — el único anti-cheat real. Requerido antes de que haya dinero
  colgando de un score. **Feature, no un `if`.**
  Diseño ya decidido: un umbral proporcional evaluado en vivo **des-califica retroactivamente**
  a medida que crece el pool. Usar un bit monótono `qualified(player, piece)` escrito al cruzar
  por primera vez; `sign-badge` lee el bit, no el catálogo vivo. Guardar el mapa disperso
  `exerciseId → stars`, nunca un `totalStars`.
- **`timeout` ofrece *Try Again*** aunque la tx ya se firmó y transmitió
  (`WaitForTransactionReceiptTimeoutError`). Reintentar sobre un mint que quizá aterrizó
  necesita evidencia. **Medir antes de tocar.**

---

## 5. Diferidos de `project_receipt_status_verification`

- Fallo silencioso de `/api/cache-score` (`.catch(() => {})`): tras un receipt exitoso, el
  leaderboard no ve el score y no hay señal.
- Divergencia score/badge si la app se cierra durante `confirming`. El badge se auto-cura
  leyendo la cadena; el score **no** reconcilia.
- `Invalid player address` se clasifica como `unknown`.

---

## 5.1 Nombre custom: hoy es una promesa que solo ve su dueño (2026-07-17)

El chip **Chesscito ID** de la Account sheet muestra el nick **generado** a propósito:
`useDisplayName().name` resuelve custom > generado, pero el nombre custom vive **solo** en
`localStorage` y **nunca viaja al servidor** (la ruta de guardado de scores no lo lleva). El
leaderboard le muestra al resto siempre el generado — `leaderboard-sheet.tsx:148-154` solo pisa
tu propia fila, en tu propio device.

Consecuencias, en orden:

- **El lápiz de edición NO va en el chip** hasta que el nombre custom sea real. Editar un
  "Chesscito ID" que ningún otro jugador ve es una promesa falsa. El esfuerzo no es la razón:
  `DisplayNameDialog` + el lápiz de `ProfileBanner` **ya existen y están cableados** en
  `ProfileSheet`, con tests.
- **Ese editor hoy es casi inalcanzable**: `ProfileSheet` solo abre por el deep-link
  `?sheet=profile`, y en modo LEARN está apagado (`learn-hub-client.tsx:180`). O sea que en el
  build que shippea, nadie tiene un nombre custom. Decidir si el editor **vuelve** (con el
  nombre viajando al server) o si se **retira** — hoy es superficie muerta que igual mantenemos.

El feature real no es "poner el lápiz": es **que el nombre elegido llegue al leaderboard de los
demás**. Eso toca server + una pregunta de moderación (`validateNickname` ya tiene el blocklist,
pero nadie lo llama).

---

## 6. Grande — no abrir sin decidirlo

- **Belt System** (#189) — espina aceptada, **no agendada**. No abrir hasta que cierren
  MiniPay/slides. Único item con reloj: `BADGE_THRESHOLD` → proporción, barato mientras haya
  exactamente un badge minteado.
- **Lote 2.5** — Tactical Day Gift + Proof of Consistency
  (`docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`).
  El shield protege el COMBO, **no** el Daily. **Nunca construir recovery para el Daily-Streak.**

---

## 7. Issues de GitHub abiertos

| # | Prioridad | Título |
| --- | --- | --- |
| 104 | P1 | Treasure hunt — pieza única móvil |
| 101 | P2 | Prize pool distribution v2 (falta método en el contrato) |
| 67 | P2 | Exercise world map — visual progression path |

---

## 8. Otros docs de backlog, sin agendar

- `2026-06-17-edge-walls-on-borders.md`
- `2026-06-17-isolate-dev-tools-into-separate-app.md`
- `2026-06-26-exercises-sheet-open-slide-unification.md`

### Fix: `verify-payment` no congela el `season_id` en el payload de Redis

Abierto 2026-07-27, destapado por el spec `focus-days-ledger`. El fast path de
`/api/season-pass/status` sirve `configuredPass.seasonId` (config, `route.ts:65`)
mientras la rama de Supabase sirve `data.season_id` (fila comprada, `route.ts:122`):
la misma wallet recibe dos temporadas según qué rama la atendió.

Spec A **neutraliza** la divergencia resolviendo el `seasonId` en un punto canónico
desde Supabase, pero **el payload de Redis sigue siendo incorrecto** y puede afectar
a consumidores futuros durante un rollover de season. Hoy es inocuo: nada más
consume el campo.

### Tabla paginada de jugadores en `/stats` (acordado 2026-07-29, PIDE SPEC)

Nace de una pregunta del founder: el hero de Leaders dice "17 players" sobre una lista de 10,
y **un número que nadie puede auditar se siente como una mentira** aunque sea verdadero. El
label `TOP 10 OF 17` (`27b61de`) tapa el hueco de percepción, pero **la lista completa no
existe en ninguna superficie**.

Reparto decidido: **Leaders** = podio + tu posición (sigue cortado); **`/stats`** = la tabla
completa, que es donde el número se audita. `/stats` es el hogar correcto porque ya es página
pública de agregados read-only y **ya está linkeada desde el landing**
(`apps/landing` · `landing-page.tsx`; la copia muerta de `apps/web` se borró el 2026-07-30)
— no es rincón de ops. ⚠️ **Ya NO está en `sitemap.ts`** (`5595722`, 2026-07-30): sigue
abierta y linkeada, pero `noindex`. Auditable ≠ indexable.

> ✅ **CONSTRUIDO 2026-07-30** — `docs/handoffs/2026-07-30-stats-players-census-handoff.md`.
> Spec + red team: `docs/specs/2026-07-30-stats-full-players-table{,-redteam}.md`.
> Validado visualmente por el founder. **Sin migración.**
> Resoluciones de las preguntas que este item dejaba abiertas:
> - **La tabla NO respeta los filtros** (decisión del founder): all-time es global y da 17,
>   weekly es surface-scoped y da 4. Global ⇒ el conteo cierra por construcción. Su
>   encabezado lo declara.
> - **Por lo tanto NO quedó amarrada a la open question de Slice 2** — se desató sola.
> - **Se AGREGA después del podio**, no lo reemplaza. `PAGE_SIZE = 10`, paginador desde 11.
> - ⚠️ `PAGE_SIZE` y `BOARD_CUT` valen 10 **por casualidad**: constantes separadas.
> - ⚠️ Abierto y diferido: el desempate de all-time es por **dirección de wallet**, invisible
>   en pantalla y distinto del de weekly. Alinearlo pide migración → su propio cluster.

- **Forma recomendada**: la tabla viaja dentro del snapshot horario y se pagina **en el
  cliente**, con techo de filas (~500). Encaja con la arquitectura de la página
  (`revalidate = 3600` + `unstable_cache` por combinación de filtros, `Promise.allSettled`,
  `null` = dato no disponible). La alternativa —endpoint con paginado server-side— es correcta
  a escala grande pero se sale del snapshot y agrega una superficie que puede divergir.
- **Pregunta de producto SIN RESOLVER, y está amarrada a otra**: ¿la tabla respeta los filtros
  `surface`/`container` que la página ya tiene en el querystring? Si los respeta, el número que
  muestre tiene que ser el conteo **de lo que está en la tabla**, y el estado sin filtros tiene
  que dar **exactamente** el mismo número que Leaders, o no audita nada. Eso choca con la open
  question de Slice 2 (*¿all-time debería scopearse por surface?*): **las dos decisiones se
  toman juntas o divergen.**
- ⚠️ **El corte vive en SQL, no en TS.** `BOARD_CUT` en `leaderboard-sheet.tsx` es un espejo de
  `leaderboard_combined_v ... LIMIT 10` / `get_weekly_leaderboard ... limit 10`. Si la tabla de
  `/stats` introduce otro límite, que sea **una sola constante compartida** — dos cortes que
  pueden discrepar van a discrepar.

### ✅ CERRADO — métricas de negocio indexadas en `/stats` (hallado 2026-07-29, cerrado 2026-07-30)

**El defecto era la indexación, no la publicación.** Cerrado en `5595722`: `/stats` fuera de
`STATIC_PATHS` y `robots: { index: false, follow: false }` en `apps/web` **y** `apps/landing`.
Primer test sobre `sitemap.ts`.

⛔ **La otra mitad de este item —"mover el grupo de negocio a admin"— se RECHAZA, y no hay que
volver a proponerla.** MiniPay lo **exige**: sus requisitos de listing (§8) piden una página de
stats *"public-or-shared"* con **DAU, MAU, retention D1/D7/D30 y top countries**, publicada como
*"a `/stats` page inside the Mini App, read-only, no wallet required"*, y es ítem con casilla en
el checklist de pre-listing. El código ya lo sabía: `public-aggregator.ts` comenta el bloque
on-chain como *MiniPay Stage-2* y la página trae un **Tracked today / Coming next** escrito
contra esa lista. Recortarla rompe el listing.

📌 La lección que sobrevive: **alcanzable e indexable son propiedades distintas**, y sólo la
segunda era el defecto. Una sesión entera se fue clasificando funnels como "internos" a partir
de la premisa equivocada.

⚠️ **Verificar §8 con MiniPay** en la próxima llamada — la fuente es un snapshot del PDF oficial
(2026-05-13), no `docs.minipay.xyz`. Si la lista cambió, la clasificación se revisa.

### 🅿️ Export de `/stats` con x402 — SPEC ESCRITO, APARCADO SIN FECHA (founder, 2026-07-30)

**Spec listo y sin red team:** `docs/specs/2026-07-30-stats-paid-export-x402.md`.
Aparcado por decisión del founder: buen feature, **no necesario ahora**. Retomarlo desde el spec,
no desde cero.

**Decisiones ya tomadas** (no re-litigar al retomar):
- Precio **0.01 USDC**, configurable por entorno (`STATS_EXPORT_PRICE_USDC`). **No existe ni hace
  falta ningún token propio** — el "1 CVT" de la conversación era "un centavo".
- Rail **x402 sobre Celo**. USDC tiene **6 decimales**: `0.01` = `10000` unidades.
- **El pago se verifica ANTES de cualquier query cara.** La validación de `format`/filtros va
  antes del pago: cobrar por un request que igual termina en 400 es peor que no cobrar.
- Payload = **los agregados que ya se ven**, leídos del mismo snapshot horario del dashboard.
  Cero campos nuevos, ninguna wallet.
- El dashboard **no cambia**: ni lo que muestra, ni quién entra. El 402 va delante del archivo,
  **nunca delante del HTML** (rompería MiniPay §8).

**Simplificaciones que caen solas** y que conviene no reintroducir: sin parámetro de fechas no
hay rango máximo que imponer; con el archivo en el cuerpo del 200 no hay enlace que expirar; y
el rate limit por wallet **se decidió NO construir en v1** (el pago ya es el límite, y x402
gatea por pago, no por identidad).

⛔ **Incógnita que puede mover el plan entero: ¿existe un facilitator de x402 en Celo?** Sin uno
público hay que auto-hospedarlo, y eso es un frente propio, no una etapa. **Un spike corto
responde esto antes de comprometer nada.**

🧯 **Corrección a la nota vieja de abajo**: decía *"la página sigue gratis e indexada"*. Ya no es
indexada, por decisión propia (ver el item cerrado arriba). El argumento que sí sigue en pie
para no poner 402 delante del HTML es **MiniPay §8**, no el SEO.

🧯 **Y a un supuesto que casi escribo como bloqueo**: Celopedia dice que MiniPay prohíbe message
signing. **Es falso** — este repo lo midió en device: `eth_signTypedData_v4` funciona
([[project_minipay_platform]]), así que el flujo canónico EIP-3009 de x402 es viable dentro del
mini app. Y como lo settlea el facilitator, **el usuario no manda tx**, lo que importa porque
las wallets de MiniPay no tienen CELO.

### Export de `/stats` con x402 (idea del founder 2026-07-29, SIN AGENDAR)

Ver la tabla en la página es gratis (y copiarla a mano también); **descargarla** en formato
procesable se paga. Cobra **conveniencia y formato, no acceso**: la página sigue gratis e
indexada y no hay que distinguir "interno" de "externo" — que era el agujero de la idea
anterior, porque x402 gatea por **pago, no por identidad**, y cualquiera conecta una wallet en
cinco segundos.

Lo que hay que tener escrito antes de construirlo:

- **No tiene valor de enforcement, y no hay que pretender que lo tenga.** El HTML ya trae los
  datos; si además la tabla se pagina en cliente sobre el snapshot, **el dataset completo ya
  viaja en el payload** y el "download" es reformatear algo que el cliente ya tiene. Precio
  honesto = conveniencia. **No construir anti-scraping.**
- **Qué se exporta importa más que el precio.** Con `rowId` opaco + score es inofensivo. El día
  que incluya wallets es otro producto con una decisión de privacidad adentro: hoy **las
  wallets no salen del servidor** y hay un test que lo fija (`JSON.stringify(body)` no contiene
  `"0x"`).
- El límite gratis/pago se resuelve **server-side**, con lo que x402 pide: facilitator,
  settlement y verificación de recibo con protección de replay.
- **No poner 402 delante del HTML** — mata el indexado y la señal de transparencia, que es el
  trabajo de esa página.

## 9. No scopeado

Social login · gift-able PRO (`project_pro_growth_ideas_backlog`) · specs de Welcome Package y
Exercises Save Flow · Focus Passport P1.5 calendar · Deep Hint · observability tracker +
deuda de `onProTap`.

**Caveat aceptado:** `MAX_SHIELDS=3` es cap de activos/display; `credited` es monótono y
bufferea el excedente. Un cap duro real es cambio de modelo.
