# Mini-tour: rework de LEARN (paso Daily) y PLAY (los 3 pasos) — 2026-07-28

**Estado: IMPLEMENTADO (2026-07-28).** Decisiones cerradas por el founder.
Validado en 390 px sobre la app real (LEARN en `:3002`, PLAY en `:3005`).
Supersede el paso 1 de cada hub en `docs/specs/2026-07-12-hub-tour-daily-first-spec.md`.

Código vigente:

| Pieza | Archivo |
|---|---|
| Secuencias y persistencia | `apps/web/src/lib/hub/hub-tour.ts` |
| Presentador del panel | `apps/web/src/components/hub/hub-tour.tsx` |
| Copy EN (fuente de autoría) | `HUB_TOUR_COPY` en `apps/web/src/lib/content/editorial.ts` |
| Copy ES | `apps/web/src/lib/content/messages/es.ts` |
| Call site LEARN | `apps/web/src/components/hub/learn-hub-client.tsx:442` |
| Call site PLAY | `apps/web/src/components/hub/play-hub-client.tsx:84` |
| Tarjeta objetivo del paso 1 de PLAY | `apps/web/src/components/kingdom/kingdom-card.tsx` |

---

## 1. Principio rector de PLAY

El tour de PLAY es de primera visita, así que el orden es:

> **contexto → oferta → acción**

y nunca *compra → acción*. El primer mensaje que recibe el usuario no puede ser
una venta: primero tiene que entender dónde está.

El tour **no abre el selector automáticamente**. El paso 3 explica cómo empezar
y deja la decisión al usuario, que conserva la oportunidad de revisar o comprar
PRO antes de jugar.

---

## 2. PLAY — secuencia cerrada (3 pasos)

### Paso 1 de 3 — contexto

| | |
|---|---|
| Target | `kingdom` — **nuevo**, apunta a toda la `<section class="kingdom-card">` |
| Título | `Welcome to Play Kingdom` |
| Body | `This is your home for matches, Coach Review, and rewards.` |
| Strip | **ninguno** |
| Cierre | `Tap to Continue` |

**Sin strip de beneficios y sin repetir los tres íconos.** La `KingdomCard`
iluminada ya es la ilustración: ya muestra Quick Match, Coach Review y Rewards
como chips con ícono (`kingdom-card.tsx:111-124`). El panel orienta —dice dónde
está el usuario— y no reconstruye el contenido visible de la tarjeta.

Por la misma razón el body **no puede repetir literalmente `kingdomPanelBody`**
("Play matches, sharpen tactics, and improve with Coach"). El body decidido
—"This is your home for…"— es deliberadamente de ubicación, no de enumeración.

### Paso 2 de 3 — oferta

| | |
|---|---|
| Target | `pro` — existente, el CTA morado (`kingdom-card.tsx:129`) |
| Título | `Unlock Chesscito PRO` |
| Body | `Get the Season Pass, unlimited Coach Review, and the complete Play experience.` |
| Strip | `Season Pass · Unlimited Coach · Complete Experience` |
| Precio | `$1.99 · 30 days` — **interpolado**, ver §6 |
| Cierre | `Tap to Continue` |

El strip actual del paso PRO reusa `Quick Match · Coach Review · Rewards`
(`hub-tour.tsx:319-332`), que describe **la navegación del hub**, no los
beneficios de la suscripción. Se sustituye por beneficios propios de PRO.

Esto además garantiza la invariante de §7: los pasos 1 y 2 no comparten strip
ni beneficios. El paso 1 no lleva strip; el paso 2 lleva uno que sólo existe
para PRO.

El usuario puede tocar la franja PRO para comprar, o seguir el tour. La oferta
no obliga.

### Paso 3 de 3 — acción

| | |
|---|---|
| Target | `play` — existente, botón inferior PLAY |
| Título | `Choose How to Play` |
| Body | `Tap Play to choose your match and start when you're ready.` |
| Cierre | `Tap to Explore` |

---

## 3. LEARN — secuencia sin cambios, paso Daily reescrito

La secuencia se mantiene: **Daily → 21-Day Challenge → Rook**. Sólo cambia el
contenido del paso Daily.

### Regla de vocabulario

El nombre real de la funcionalidad es **Daily Tactic**. El tour usa ese
vocabulario. **No se introduce `lesson` sólo dentro del tour.**

No puede haber saltos arbitrarios entre `lesson`, `tactic`, `habit` y
`focus streak` según el estado del usuario: las variantes del mismo paso
describen el mismo ritual con las mismas palabras.

### Variante `dailyStart` (streak = 0, daily sin resolver)

| | |
|---|---|
| Título | `Start your streak today` (sin cambios) |
| Body | `Open your daily gift, complete one quick tactic, and begin building your focus streak.` |
| Strip | `Gift → Quick tactic → Focus streak` |
| Cierre | `Tap to Continue` |

### Variante `dailyKeep` (streak > 0, daily sin resolver)

| | |
|---|---|
| Título | `Keep your focus streak going` |
| Body | `Open your daily gift and complete one quick tactic to continue your focus streak.` |
| Strip | `Gift → Quick tactic → Focus streak` |
| Cierre | `Tap to Continue` |

> **Detalle de implementación que no es sólo copy:** hoy `TITLE_KEY`
> (`hub-tour.tsx:32-42`) mapea `dailyKeep` **y** `dailyDone` al mismo key
> `dailyTitle` ("Daily Tactic"). El título nuevo de `dailyKeep` obliga a
> **agregar un key** (`dailyTitleKeep`) y remapear sólo esa variante.
> Cambiar `dailyTitle` en su lugar arrastraría a `dailyDone`, que debe quedar
> igual.

### Variante `dailyDone` (daily ya resuelto)

Se mantiene como está: es un **estado informativo de tarea completada**, no la
explicación del ritual. Copy actual: "Your Daily Tactic lives here. Come back
tomorrow for the next one." — consistente con "Daily Tactic", sin inconsistencia
directa que forzar. El strip no aplica en esta variante (hoy sí se renderiza:
ver §7, punto de verificación).

---

## 4. Memoria compartida entre hubs — cambio intencional, no regresión

Hoy `hub-tour.ts` comparte una sola memoria del Daily entre los dos hubs:
`HUB_TOUR_DAILY_STORAGE_KEY` se escribe cuando **cualquiera** de los dos tours
explicó el regalo, y el otro arranca sin ese paso.

Se acepta explícitamente el cambio:

- PLAY **deja de incluir** el paso `daily`.
- PLAY **deja de escribir** `HUB_TOUR_DAILY_STORAGE_KEY`.
- LEARN **siempre explica el Daily** cuando corresponda.
- El Daily pasa a tener **ownership narrativo en LEARN**, aunque el regalo siga
  visible globalmente (esquina superior en ambos hubs).
- Se limpian de `buildPlayHubTourSteps` y de su call site las dependencias que
  dejan de usarse: `includeDaily`, `dailyDone` y `streak` del
  `PlayHubTourContext`. `proStatus` se conserva.
- **No se elimina** el tipo `HubTourStepId` `"daily"`, ni `dailyStep()`, ni las
  bodyKeys del Daily: LEARN los sigue usando.

Esto está documentado como decisión, no como bug: cualquier test o handoff que
afirme "PLAY explica el regalo primero" queda superado por este spec.

---

## 5. Fuera de alcance

La **ayuda contextual del Daily Gift en PLAY al primer tap** ("Open it each day
to collect your reward and keep your Chesscito routine going") **no entra en
este cambio**. Es una feature separada que requiere coach-mark propio,
persistencia propia, estados propios y spec independiente.

---

## 6. Precio de PRO — no se escribe a mano

El precio se muestra como `$1.99 · 30 days`, pero **`$1.99` no se tipea en el
copy**. `KingdomCard` ya lo deriva de `PRO_PRICE_USD6` (`shop-catalog.ts`) vía
`formatUsd`, y el paso PRO del tour ya recibe `pro.price` por props
(`HubTourProps.pro`).

El key debe ser una plantilla interpolada. Hoy es
`proPrice: "{price} · subscription"`; pasa a `"{price} · 30 days"`.

Un `"$1.99"` literal en `editorial.ts` se pudre en silencio el día que el
catálogo cambie y **ningún test se pondría rojo**. Misma regla que ya rige
`challengePrice`.

Igualmente, los **30 días** deben salir de la misma fuente que la duración real
de la suscripción si existe una constante; si no la hay, queda como literal
documentado aquí y anotado en §9.

---

## 7. Validaciones exigidas antes de dar el cambio por cerrado

### Visual

- [ ] Verificación visual en **viewport mobile de 390 px** (`--app-max-width`).
- [ ] El panel del paso 1 de PLAY **cabe** apuntando a una tarjeta alta. El
      presentador elige arriba/abajo según espacio libre (`spaceAbove` /
      `spaceBelow`, `MIN_PANEL_HEIGHT = 220`, `GAP = 18`, `RING_PAD = 12` en
      `hub-tour.tsx:59-63,162-176`); con un target del alto de la `KingdomCard`
      el panel puede quedar sin aire. Medir, no derivar.
- [ ] El contador sigue visible y correcto: `1 of 3`, `2 of 3`, `3 of 3` en
      ambos hubs.

### Tests

- [ ] Actualizar los tests de **secuencia, targets y conteo**:
      `lib/hub/__tests__/hub-tour.test.ts`,
      `components/hub/__tests__/hub-tour.test.tsx`,
      `components/hub/__tests__/play-hub-scaffold.test.tsx`,
      `components/kingdom/__tests__/kingdom-card.test.tsx`.
- [ ] Cobertura nueva: **PLAY ya no escribe** `HUB_TOUR_DAILY_STORAGE_KEY`.
- [ ] Cobertura nueva: **LEARN sigue mostrando el Daily** aunque PLAY haya sido
      visitado y completado antes.
- [ ] Cobertura nueva: el body del paso 1 de PLAY **no es igual** a
      `PLAY_HUB_COPY.kingdomPanelBody`.
- [ ] Cobertura nueva: los pasos 1 y 2 de PLAY **no presentan el mismo strip ni
      los mismos beneficios** (el paso 1 no renderiza `hub-tour-benefits`).
- [ ] Verificar qué hace el strip en la variante `dailyDone`: hoy `isDaily`
      incluye las tres variantes (`hub-tour.tsx:90-93`), así que un usuario que
      ya resolvió el daily ve el strip del ritual junto a un texto que dice
      "vuelve mañana". Decidir y cubrir.

### Contenido

- [ ] **Paridad EN/ES**: todo key nuevo de `HUB_TOUR_COPY` necesita su override
      en `messages/es.ts`, o `messages/__tests__/bundle-parity.test.ts` va a
      rojo — que es exactamente para lo que existe.
- [ ] `messages/__tests__/t-key-scan.test.ts` sigue verde: si algún key nuevo se
      declara como **helper función** en `editorial.ts`, necesita mirror ICU en
      `messages/en.ts` o EN renderiza el path crudo en pantalla.
- [ ] `pnpm content:audit` verde (brief de lenguaje: el copy user-facing no dice
      "on-chain" ni NFT).

---

## 8. Keys de copy afectados

### `HUB_TOUR_COPY` — modificar

| Key | Cambio |
|---|---|
| `dailyStart` | body nuevo (`quick tactic` / `focus streak`) |
| `dailyKeep` | body nuevo, alineado a `dailyStart` |
| `dailyStripGift` | `Open gift` → `Gift` |
| `dailyStripTactic` | `Solve 1 tactic` → `Quick tactic` |
| `dailyStripCombo` | `Build habit` → `Focus streak` |
| `proTitle` | `Meet Chesscito PRO` → `Unlock Chesscito PRO` |
| `proJoin` | body nuevo de la oferta |
| `proPrice` | `{price} · subscription` → `{price} · 30 days` |
| `playTitle` | `Ready to Play` → `Choose How to Play` |
| `playStart` | body nuevo |

### `HUB_TOUR_COPY` — agregar

| Key | Valor |
|---|---|
| `dailyTitleKeep` | `Keep your focus streak going` |
| `kingdomTitle` | `Welcome to Play Kingdom` |
| `kingdomBody` | `This is your home for matches, Coach Review, and rewards.` |
| `proBenefitSeasonPass` | `Season Pass` |
| `proBenefitUnlimitedCoach` | `Unlimited Coach` |
| `proBenefitCompleteExperience` | `Complete Experience` |

`dailyStripCombo` conserva su nombre aunque su valor deje de hablar de "combo";
renombrar el key es opcional y ortogonal a esta decisión.

---

## 9. Riesgos y contradicciones que quedan abiertas

1. **RESUELTO con una desviación que hay que conocer — los íconos PRO se
   COPIARON desde `apps/landing`.** Los assets aprobados
   (`season-pass-icon`, `pro-suscription-icon`) existían **sólo** en
   `apps/landing/public/art/landing-slides/`. Un slot de web apuntando ahí
   no resuelve: cada app sirve su propio `public/`. Se copiaron los seis
   archivos (avif/webp/png de cada uno) a
   `apps/web/public/art/landing-slides/`. **No se generó arte** y no se
   sustituyó ningún concepto: son los mismos bytes. Consecuencia: ahora hay
   dos copias del mismo asset en el repo y un Replace en una no mueve la otra.

   | Beneficio | Slot | Ruta real | Extensiones |
   |---|---|---|---|
   | Season Pass | `hub.pro-benefit-season-pass` | `/art/landing-slides/season-pass-icon` | avif, webp, png |
   | Unlimited Coach | `hub.pro-benefit-coach` | `/art/new-assets-chesscito/btns/ask-coach-icon` | avif, webp, png |
   | Complete Experience | `hub.pro-benefit-complete` | `/art/landing-slides/pro-suscription-icon` | avif, webp, png |

   Sólo el de Coach ya vivía en `apps/web`.

2. **RESUELTO — la duración SÍ tiene fuente canónica.**
   `PRO_DURATION_DAYS = 30` en `lib/contracts/shop-catalog.ts:40`, junto a
   `PRO_PRICE_USD6`. `proPrice` es `"{price} · {days} days"` y el panel
   interpola ambos; no hay literal en el copy.

3. **RESUELTO — `data-tour-target="kingdom"` puesto en la `<section>`**, con el
   test que lo exige (`kingdom-card.test.tsx`) verificado por mutación: al
   quitarlo, el test falla.

4. **RESUELTO — `dailyDone` ya no muestra el strip.** `isDailyRitual` cubre
   sólo `dailyStart` y `dailyKeep`; el body cae por la rama genérica.

5. **ABIERTO — el conteo visible sigue siendo 3 antes y después.** Una
   regresión de secuencia no se delata sola en pantalla. Los tests de §7 son
   la única red; tres de ellos fueron verificados por mutación.

6. **ABIERTO (pre-existente, no introducido acá) — el panel reporta
   `scrollHeight > clientHeight` en los pasos con benefits** (challenge en
   LEARN, pro en PLAY). En 390 px no se cortó contenido: los seis pasos
   renderizaron completos. Es el `maxHeight` del presentador rozando su
   contenido, no una pérdida visible.
