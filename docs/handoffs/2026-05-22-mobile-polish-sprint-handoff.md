# Mobile Polish Sprint — Handoff (2026-05-22)

## Estado — SHIPPED to `main`

Sprint de 5 commits sobre `main`. Cierra la primera tanda de items que abrió el usuario tras desktop frame v4 (`1b67efbe`): descubrimiento de PRO desde el primer instante, reconocimiento cross-app cuando activa, pill `v.<sha>` limpio fuera de `/hub`, y continuidad de la sensación "mundo único" desde landing hasta cualquier pantalla del app.

Tests: **1848 passing** (baseline previo 1814 → +34).

### Commits — orden cronológico

| SHA | Mensaje |
|---|---|
| `570d057e` | feat(hub): add PRO discovery tile to right-rail (v1, refactored 2 commits later) |
| `ee851b19` | refactor(hub): PRO discovery panel — above rail, hidden when active |
| `ce2b1d06` | feat(chrome): scope build-version pill to /hub + /dev/* only |
| `e78f8b35` | feat(chrome): frame informational routes for landing→hub continuity |
| `0b63fab7` | fix(chrome): keep Radix sheets inside the desktop frame |
| `404644c7` | feat(chrome): cross-app PRO recognition via GlobalStatusBar chip |

Push: `1b67efbe..404644c7` → `origin/main`.

---

## Lo que cambia para el usuario

### 1. Descubrimiento de PRO desde el momento 0 (`/hub`)

**Antes:** El chip "PRO" del HUD solo aparecía si ya tenías PRO activo (entonces mostraba "PRO 7d"). Si no tenías PRO, no había prompt visible — el `<PremiumSlot>` inactivo estaba detrás de `showPremiumSlot=false`. El usuario tenía que descubrir la suscripción por casualidad (tocando el avatar, el coach inactivo, etc).

**Después:**
- Usuario sin PRO → ve un panel morado con corona arriba del rail Daily/Mate/Coach. Texto "PRO" + "Unlock the full experience". Tap → abre el ProSheet existente. Cero pantalla nueva.
- Usuario con PRO activo → el panel se desmonta entero. El chip del HUD ("PRO 7d") queda como única recognition surface en `/hub`. Cero duplicación.

Asset: `panel-pro.png` (+ webp/avif) en `apps/web/public/art/hub/`. El asset es solo el marco morado + corona; "PRO" + subtitle se layerea con CSS para que el copy sea editable/localizable sin re-exportar arte.

### 2. Reconocimiento cross-app

**Antes:** En `/exercises`, `/arena`, `/coach`, `/trophies`, `/victory`, `/about`, etc., el `GlobalStatusBar` mostraba un chip "PRO" idéntico estés con PRO o sin PRO. Solo cambiaba el `aria-label` (`proManageLabel` vs `proViewLabel`). Visualmente: cero recognition.

**Después:**
- Chip activo → "PRO 7d" (mismo formato que el chip del HUD en `/hub`)
- Chip inactivo → "PRO" (CTA bare)

Single source of truth: `HUD_COPY.proRemainingFormat(days)`. Si en el futuro el formato cambia (ej. "PRO 7" o "PRO 7 days"), un solo edit lo propaga.

### 3. Pill `v.<sha>` ya no tapa el menú

**Antes:** El pill `v.dev` / `v.<commit-sha>` renderizaba en *toda* ruta via root `template.tsx`. En `/exercises` y `/arena` se traslapaba con el dock/menú inferior.

**Después:** Pill visible solo en `/hub` + `/dev/*`. El resto de rutas: oculto. Allowlist en pure function `shouldShowVersionPill(pathname)` — testeable sin renderizar.

### 4. Continuidad landing → mundo único

**Antes:** `/about`, `/support`, `/why`, `/terms`, `/privacy` rendían full-width en desktop. Romían la sensación de "estás dentro del juego" que el frame estableció para `/hub`, `/exercises`, etc.

**Después:** Las 5 rutas informativas ahora también dentro del frame en desktop. Mobile intacto (todo bajo `@media (min-width: 768px)`). Como `LegalPageShell` ya usaba `max-w-[var(--app-max-width)]`, cero rediseño — el frame solo reutiliza su ancho natural.

Cambio relacionado: `.desktop-app-frame-inner { overflow: hidden → hidden auto }` para que pages largas (terms/privacy) puedan scrollear dentro del frame sin clipearse. App routes con scroll interno propio absorben el gesto antes; la nueva regla solo se activa cuando contenido excede 100dvh.

### 5. Sheets contenidos en el frame (bug discovery durante la sesión)

**Antes:** BadgeSheet, ProSheet, ShopSheet, ProfileSheet, etc. se portaleaban a `document.body` (default de Radix), escapando el frame en desktop. Una bottom-sheet del PRO se estiraba full-width 1440px → Image #15 ("Your Badges" stretched).

**Después:** `DesktopAppFrame` expone su inner element via context (`useDesktopAppFrameContainer`). `SheetPortal` consume el context y pasa `container` a Radix Portal. Cobertura automática para *todos* los sheets sin tocar ninguno individualmente — overlay backdrop también queda contenido en el frame, reforzando la sensación de "todo pasa dentro del teléfono".

Mobile intacto: el `transform: translateZ(0)` que contiene `position: fixed` solo aplica `@media (min-width: 768px)`. En mobile el sheet sigue usando viewport.

---

## Decisiones registradas

1. **PRO discovery panel vs rail-tile.** Primer intento (`570d057e`) puso PRO como una 4ª `HubActionTile` dentro del rail (Daily/Mate/Coach/PRO). User feedback: muy chico, queremos que destaque. Refactor (`ee851b19`) lo movió arriba del rail como panel image-only más grande con texto overlayeado. **El asset `panel-pro.png` no traía texto embebido** — descubrimos durante la primera Playwright capture que es solo marco + corona; el texto se layerea con CSS.

2. **PRO activo: HUD chip es la única recognition en `/hub`.** No duplicamos el panel + chip. El panel se desmonta cuando activo; el chip se queda. En cross-app, el `GlobalStatusBar` chip refleja el mismo state ("PRO 7d") manteniendo el mismo source of truth.

3. **Sheets en frame via Radix `container` prop (no CSS).** Considerado: positioning CSS sobre el sheet (left/right calc del viewport vs frame width). Descartado: el frame ancestor ya tiene `transform: translateZ(0)` → cualquier `position: fixed` portaleado *adentro* del frame queda contenido automáticamente. Una sola linea de prop (`container={ref}`) hace todo el trabajo. Cero CSS adicional, escala a cualquier Radix-based primitive futuro (Dialog, AlertDialog) si se necesita.

4. **Allowlist explícito en `desktop-app-frame.tsx`.** Las rutas que escapan al frame siguen siendo: `/`, `/share/*`, `/dev/*`. Decisión: `/terms` y `/privacy` quedan dentro del frame en v1. Si en el futuro legal/compliance pide que sean full-width-readable en desktop (linkeables desde footers externos / MiniPay submission), una línea las saca del prefix.

5. **Pill `v.<sha>` mantiene `/dev/*` para QA fixtures.** Los `/dev/persist-overlay`, `/dev/tx-progress`, `/dev/coach-history` son superficies de smoke-test — ahí el pill sigue siendo útil. Solo desaparece en rutas de usuario final no-/hub.

---

## Smoke checklist (manual)

Validación local con Playwright ya ejecutada antes de cada push. Pending validation en producción tras deploy auto:

```bash
# 1. /hub — PRO discovery panel visible cuando inactivo
open https://www.chesscito.com/hub
# Esperado: panel morado con corona arriba del rail derecho, texto "PRO / Unlock the full experience"

# 2. /hub?sheet=badges — BadgeSheet dentro del frame
open https://www.chesscito.com/hub?sheet=badges
# Esperado en desktop ≥768px: el sheet "Your Badges" aparece dentro del bezel, no full-width

# 3. /exercises — pill v.<sha> oculto
open https://www.chesscito.com/exercises
# Esperado: NO se ve "v.dev" / "v.<sha>" en bottom-right

# 4. /about, /support, /terms — dentro del frame en desktop
open https://www.chesscito.com/about
# Esperado en desktop: page cream-paper dentro del bezel, scroll interno funciona

# 5. /hub con PRO activo — chip "PRO Nd" en cross-app
# Requiere wallet con PRO activo + navegar a /exercises o /arena
# Esperado: chip arriba-derecha dice "PRO 7d" (o N días según expiry)
```

---

## Trabajo deferido

### 1. PR0 recognition cross-app más rica (low prio, deferred)
El chip "PRO Nd" es la versión minimal. Plan B (no shipped):
- `<ProRecognitionPin>` primitivo (corona pequeña 12-14px) como corner-pin
- Mount en avatar del `ProfileSheet`
- Mount en otros lugares con avatar/identidad

User pidió "no demasiado esfuerzo" así que cerramos en el chip. Si más adelante queremos un cue más prominente (ej. corona overlay en avatar), añadir como follow-up.

### 2. VR baselines drift (task #26 abierto)
El suite `pnpm test:e2e:visual` tenía 12 failures incluso ANTES de mis commits (verificado en `1b67efbe` durante diagnóstico de Commit 1):
- `hub-clean` → renderiza `/exercises` en lugar de `/hub` (bug en el test setup, no en `/hub`)
- 9 timeouts en `/dev/*` fixture routes → environmental (dev-server cold compile thrash)

Además mis commits invalidan baselines de pages que tenían el pill `v.<sha>` visible (about-page, etc.). Y los nuevos backgrounds del frame en info routes cambian visualmente para baselines de hub-daily-tactic-open, etc.

**Acción recomendada:** sesión dedicada a:
1. Investigar el setup del test `hub-clean` — por qué `/hub` rinde como `/exercises`.
2. Refrescar baselines invalidadas por esta sprint:
   - `hub-clean` (PRO panel agregado al rail)
   - `hub-daily-tactic-open` (PRO panel visible detrás del sheet)
   - `hub-shop-sheet-open` (idem)
   - `about-page` (pill removido + ahora dentro del frame en desktop)
3. Capturar baselines nuevas para los 5 info routes inside-frame (desktop variants).

### 3. Bookmark de los `_snap-*.mjs` ad-hoc
Durante la sesión generé 5 scripts Playwright para validación local rápida:
- `apps/web/_snap-pro-tile.mjs`
- `apps/web/_snap-pro-panel.mjs`
- `apps/web/_snap-version-pill.mjs`
- `apps/web/_snap-info-frame.mjs`
- `apps/web/_snap-sheet-frame.mjs`

Quedaron untracked (correcto — son personal). Si valen como template, podrían moverse a `apps/web/scripts/snap/` con un README. Pero igual de aceptable es borrarlos cuando se cierre la siguiente sprint.

### 4. Sheets que escapan del frame en `/share/*` y landing
El context `DesktopAppFrameContext` returna `null` en non-app-routes, por lo que sheets en `/share/*` / `/` siguen portaleándose a `document.body`. Esto está OK porque esas pages no tienen frame en desktop. Pero si en algún momento alguien agrega un Radix Dialog a `/share/score`, el dialog será full-viewport, no contenido. Documentado en el comment del `SheetPortal` para que el patrón sea evidente al próximo dev.

---

## Archivos tocados

```
A apps/web/public/art/hub/panel-pro.avif
A apps/web/public/art/hub/panel-pro.png
A apps/web/public/art/hub/panel-pro.webp
A apps/web/src/components/dev/build-version-gate.tsx
A apps/web/src/components/dev/__tests__/build-version-gate.test.tsx
M apps/web/src/app/globals.css
M apps/web/src/app/template.tsx
M apps/web/src/components/chrome/__tests__/desktop-app-frame.test.tsx
M apps/web/src/components/chrome/desktop-app-frame.tsx
M apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx
M apps/web/src/components/hub/hub-scaffold-client.tsx
M apps/web/src/components/hub/hub-scaffold.tsx
M apps/web/src/components/ui/__tests__/global-status-bar.test.tsx
M apps/web/src/components/ui/global-status-bar.tsx
M apps/web/src/components/ui/sheet.tsx
M apps/web/src/lib/content/editorial.ts
```

---

## Open questions

1. **¿`/terms` y `/privacy` dentro del frame son aceptables para legal?** Hoy sí (consistencia narrative). Si compliance/legal pide full-width readability, sacarlas del prefix con 1 línea.

2. **Telemetry de discovery panel — ¿está midiéndose?** Sí: `track("hub_pro_tile_tap", { pro_active })` se dispara desde el panel. Distinto del `hub_pro_chip_tap` del HUD chip, así podemos comparar conversion rate entre las dos entradas.

3. **¿La GlobalStatusBar PRO chip ya se usa en `/arena`?** Sí — `arena-hud.tsx` consume `<GlobalStatusBar variant="connected">`. Cambio aplica automáticamente sin tocar arena.

4. **¿Falta exposure cross-app del PRO en otras superficies sin status bar?** Trophy page (`/trophies`) y Victory page (`/victory/[id]`) — verificar visualmente que muestran el status bar o agregar otro cue. Diferido.

---

## Próximo paso recomendado

1. **Smoke checklist arriba en producción** tras deploy auto (~2 min).
2. **Validar en MiniPay Android real** flujo completo: abrir `/hub` → ver panel PRO → tocar → ver ProSheet → volver → navegar a `/exercises` → verificar chip "PRO" arriba-derecha (sin "Nd" si no estás suscripto, con "Nd" si lo estás).
3. **Decidir si arrancar Task #26 (VR drift investigation + baseline refresh)** como próxima sesión, o priorizar otros items del backlog.
4. **Cluster Closure Protocol** del CLAUDE.md aplica si esto cierra una iniciativa mayor (no en este caso — fue polish ad-hoc, no un cluster). MEMORY.md no necesita update específico para este sprint.
