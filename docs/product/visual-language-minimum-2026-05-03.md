# Visual Language Minimum — Phase 0.5

> **Spec del lenguaje visual mínimo reusable**
> Soporta el canon en `docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md`.

- **Fecha**: 2026-05-03
- **Estado**: Vivo. Se actualiza con cada commit de Phase 0.5+.
- **Alcance**: piezas que existen hoy, las specced para Bloque B, y las primitivas del Game Home redesign aprobadas en `_bmad-output/planning-artifacts/ux-design-specification.md`. **Cero gameplay, cero promesas nuevas.**
- **Última actualización**: 2026-05-03 — two-atmosphere realignment (Adventure + Scholarly), Adventure palette tokens, asset register para `art/redesign/`, 8 primitivas nuevas (`<KingdomAnchor>`, `<HudResourceChip>`, `<HudSecondaryRow>`, `<RewardColumn>`, `<PremiumSlot>`, `<MissionRibbon>`, `<PrimaryPlayCta>`, `<FrameCraftCard>`).

---

## 1. Para qué sirve este doc

Define **qué primitivas visuales** sostienen la narrativa "academia viva" sin sobre-construir un design system completo. Cada pieza tiene:

- nombre concreto en código (cuando existe);
- estado: ✅ live, 🟡 spec aprobada / pendiente código, ❌ no existe;
- regla de uso clara (cuándo sí, cuándo no);
- enlace a su test si aplica.

Si una superficie nueva necesita una pieza que **no esté en este doc**, propón el patrón aquí antes de implementarlo en código. Mantener el inventario corto es parte del valor.

---

## 2. Inventario de surfaces (cobertura narrativa)

| Surface | Pilar dominante | Disclaimer cognitivo | Atmosphere |
|---|---|---|---|
| `/` (landing) | 1 + 2 + 3 | ✅ `full` ×2 (capabilities + footer) | **Adventure** (hero) + **Scholarly** (capabilities / founders / methodology) |
| `/about` | 3 | ✅ `full` (footer) | **Scholarly** |
| `/play-hub` | 1 + 2 | ❌ NO (decisión 2026-05-03) | **Adventure** |
| `/arena` (selecting) | 1 + 2 | ❌ NO | **Adventure** |
| `/arena` (playing) | 1 | ❌ NO | **Adventure** |
| `/trophies` | 1 | ❌ NO | **Adventure** |
| `/leaderboard` | 1 | ❌ NO | **Adventure** |
| `/victory/[id]` | 1 | ❌ NO | **Adventure** |
| `/support`, `/privacy`, `/terms` | — | ❌ NO | **Scholarly** |
| **PRO sheet** | — | ❌ NO | **Hybrid** — Adventure shell + Scholarly mission ribbon (única surface mixta canonizada) |
| Coach surfaces (gated) | 2 | ❌ NO | **Adventure** shell + **Scholarly** explanation when active |

**Regla derivada — disclaimer**: el disclaimer cognitivo solo vive en superficies de **contenido / contexto** (landing, /about). Toda superficie de **juego, datos o transacción** queda libre de disclaimer y sólo enlaza a `/about` cuando hace falta.

**Regla derivada — atmosphere**: la atmósfera se selecciona **por surface**, no por session. La única surface canonizada como mixta es la PRO sheet. Cualquier nueva mezcla requiere actualizar este doc primero.

---

## 2.5 Two-atmosphere model

### Decisión

El producto carga **dos atmósferas visuales coherentes simultáneamente**, cada una apropiada a una categoría de surface distinta. Comparten la misma type scale, semantic tokens, motion vocabulary, editorial voice y reglas de a11y. Lo que cambia es paleta dominante, asset register y carácter visual.

| Atmosphere | Surfaces | Paleta dominante | Asset register |
|---|---|---|---|
| **Adventure** *(nueva — basada en `art/redesign/`)* | `/play-hub`, `/arena`, Victory celebration, landing hero | Deep blue + gold + emerald forest + Wolfcito-cat-wizard | `splash-loading`, `btn-battle`, `vs-medal`, `player-you`, `bg-ch`, `menu-wall`, `redesign/icons/*` |
| **Scholarly** *(canon previo de este doc)* | `/about`, methodology, legal, cognitive disclaimer, Coach explanations, settings | Warm cream + paper + amber + warm dark brown | `paper-tray`, `<CognitiveDisclaimer>`, `<AboutMethodology>`, candy primitives existentes |

### Por qué dos atmósferas

1. **Asset equity** — la inversión visual previa en `art/redesign/` (Wolfcito-cat-wizard, btn-battle, vs-medal, 19 íconos 3D-render) representa producción al nivel Clash-Royale-grade que el rediseño busca. Tirarlo para mantener una paleta única sería desperdiciar visual equity ya producida.
2. **Surface fit** — el lenguaje Adventure encaja con surfaces de **juego** (excitement, world, action, child-friendly); el lenguaje Scholarly encaja con surfaces de **trust** (parent / educator / sponsor leyendo credenciales y misión).
3. **Three-persona legibility honored** — la misión "academia viva" sigue legible en cada surface de pago vía `<MissionRibbon>` (canon §11). La atmósfera cambia; el canon no.
4. **Cero canon violation** — anti-overclaim, anti-FOMO, anti-casino, no-medical-alarm, mission-before-CTA — todos intactos. La decisión es puramente de presentación visual.

### Reglas operativas

- **Una surface = una atmósfera principal.** La excepción canonizada es PRO sheet (Adventure shell + Scholarly mission ribbon).
- **Cualquier nueva surface** debe declarar su atmósfera en este doc (§2 tabla) **antes** de implementarse.
- **Editorial voice no cambia entre atmósferas.** El tono cálido / paciente / no-pedante del canon §12 es global.
- **Los tokens semánticos (`rose-*` error, `emerald-*` success, `amber-*` warning) son globales** — válidos en ambas atmósferas.
- **El type scale 7-level (#91 cerrado) es global** — no hay variantes tipográficas por atmósfera.
- **La a11y es global** — WCAG AA para ambas atmósferas, los mismos `aria-label` patterns.

Referencia completa: `_bmad-output/planning-artifacts/ux-design-specification.md` §"Visual Realignment 2026-05-03".

---

## 3. Building blocks ya implementados

### 3.1 `<CognitiveDisclaimer />` — ✅ live

- **Archivo**: `apps/web/src/components/legal/cognitive-disclaimer.tsx`
- **Tests**: `apps/web/src/components/legal/__tests__/cognitive-disclaimer.test.tsx` (6 verdes).
- **Copy**: `COGNITIVE_DISCLAIMER_COPY.{short,full}` en `editorial.ts`.
- **Variants**: `short` (in-app footers — actualmente sin uso), `full` (landing + /about).
- **A11y**: `role="note"`, `aria-label="Cognitive disclaimer"`.
- **Estilo**: `text-[11px]`, color cream-muted, `text-center`, sin border, sin background propio. Lectura como footnote.

**Cuándo usar `full`**:
- Landing (rendered inline desde `LANDING_COPY.disclaimer`).
- `/about` al pie del shell.

**Cuándo NO usar**:
- Cualquier surface in-app (play-hub, arena, trophies, leaderboard, victory, sheets, overlays).
- Cualquier surface transitoria (loading, claim flow, success, error).

**Cuándo usar `short`**:
- Hoy: ningún sitio. Reservado para futuras superficies de contenido largo (artículos, página educativa, sección sobre la metodología) donde el disclaimer largo sea visualmente excesivo.

### 3.2 `<AboutMethodology />` — ✅ live (C2)

- **Archivo**: `apps/web/src/components/about/about-methodology.tsx`
- **Tests**: `apps/web/src/components/about/__tests__/about-methodology.test.tsx` (6 verdes).
- **Copy**: `ABOUT_METHODOLOGY_COPY` en `editorial.ts`.
- **Estructura**: section title (`text-xs uppercase tracking-[0.12em]`) + body párrafo + dos chips de atribución (César + Wolfcito) en `<ul>` con `aria-label="Team attribution"`.
- **Estilo**: `paper-tray` shell.

**Cuándo usar**: solo en `/about`. Es una pieza específica, no genérica.

**Anti-uso**: no replicar la atribución César/Wolfcito en otras surfaces — duplicar credenciales reduce su peso. Si una superficie nueva necesita citar al equipo, enlazar a `/about`.

### 3.3 Tokens y clases compartidas

#### 3.3.a — Tokens existentes (ya en `globals.css` / `tailwind.config.js`)

| Token | Uso | Notas |
|---|---|---|
| `text-nano` (0.5rem / 8px) | Labels de dock, piece-rail, microtags | Custom token en `tailwind.config.js`. |
| `paper-tray` | Container con paper bg + sombra suave | Reusado en /about, settings, links. |
| `mission-shell`, `mission-shell-candy`, `atmosphere` | Shells del play-hub | Definidos en `globals.css`. |
| `fantasy-title` | Títulos con énfasis warm | Para encabezados de sheets / surfaces. |
| `chesscito-dock`, `chesscito-dock-item`, `chesscito-dock-center` | Dock persistente | No tocar sin coordinar. |
| Color: `--paper-text`, `--paper-text-muted`, `--paper-text-subtle` | Tipografía sobre paper bg | Definidos en theme. |
| Color: `rgba(63, 34, 8, 0.95)` (warm dark brown) | Texto sobre cream | Canon en chips candy / Scholarly. |
| Color: `rgba(255, 245, 215, 0.55)` (cream paper) | Background de chips/cards Scholarly | Canon. |
| Color: `rgba(110, 65, 15, 0.28)` (warm border) | Borders de chips Scholarly | Canon. |
| `--duration-snap` (120ms), `--duration-enter` (300ms), `--duration-ceremony` (500ms), `--ease-spring` | Motion tokens existentes | No tocar; complementan los nuevos. |

#### 3.3.b — Tokens nuevos (Adventure palette + frame-craft + motion redesign)

Añadidos por el rediseño Game Home. Llegan a `globals.css` durante Phase 1 — primer PR de tokens. Ver UX spec Step 8 para uso por primitive.

| Token | Valor propuesto | Uso |
|---|---|---|
| `--adv-deep-blue` | `#1f2c4a` | Adventure primary background |
| `--adv-blue-highlight` | `#3a5a9c` | Adventure surface highlights |
| `--adv-forest-emerald` | `#2d6b3f` | Adventure secondary surfaces |
| `--adv-gold-warm` | `#e6b34d` | Shared gold accent (compatible con `--gold-base`) |
| `--adv-purple-accent` | `#7c4dad` | Adventure piece tint (Arena black piece) |
| `--adv-stone` | `#5a677d` | Adventure stone-wall texture (de `menu-wall.png`) |
| `--gold-leaf-base` | `#c9962b` | Border principal frame-craft |
| `--gold-leaf-highlight` | `#e8c160` | Highlight superior gold-leaf |
| `--gold-leaf-shadow` | `#8a6818` | Inner shadow gold-leaf |
| `--kingdom-warm-glow` | `rgba(232, 193, 96, 0.18)` | Halo bajo el `<KingdomAnchor>` |
| `--kingdom-deep-shadow` | `rgba(63, 34, 8, 0.42)` | Drop shadow del world render |
| `--hud-chip-elevation` | `rgba(255, 245, 215, 0.78)` | Backplate HUD chips |
| `--mission-ribbon-warm` | `rgba(232, 193, 96, 0.32)` | Background `<MissionRibbon>` |
| `--duration-piece-slide` | `320ms` | Board piece movement |
| `--ease-piece-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Piece slide easing (gentle overshoot) |
| `--duration-mission-ribbon-reveal` | `400ms` | Ribbon entrance |
| `--duration-coach-greeting` | `600ms` | Wolfcito greeting fade-in |

### 3.4 Adventure asset register (`apps/web/public/art/redesign/`)

Los assets ya producidos que sostienen la Adventure atmosphere. Todos en producción, formato triple `.avif/.png/.webp`.

| Asset | Ruta | Uso primario |
|---|---|---|
| Kingdom hero | `bg/splash-loading.{webp}` | `<KingdomAnchor>` Hub (con 1:1 crop o `object-fit:cover`) |
| Forest backdrop | `bg/bg-ch.{webp}` | Atmospheric backdrop más allá del 390px container |
| Stone wall | `bg/menu-wall.{webp}` | Surface frame opcional Adventure |
| Wolfcito-cat-wizard | `avatars/player-you.{webp}` | HUD avatar + Wolfcito greeting |
| Bot opponent | `avatars/player-opponent.{webp}` | Arena AI opponent avatar |
| Player cards | `avatars/card-{bot,you}.{webp}` | Arena pre-match face-off |
| Crossed swords | `banners/btn-battle.{webp}` | `<PrimaryPlayCta>` Hub icon overlay |
| Play / Claim / Back / Resign / Undo | `banners/btn-{play,claim,back,resign,undo}.{webp}` | CTAs por surface |
| Stone backplate | `banners/btn-stone-bg.{webp}` | `<PrimaryPlayCta>` Hub backplate |
| Banner ornaments | `banners/banner-{chess,your-turn}.{webp}` | Arena turn indicators |
| VS medal | `banners/vs-medal.{webp}` | Arena pre-match + celebration polish |
| Chess pieces (12) | `pieces/{w,b}-{rook,bishop,knight,queen,king,pawn}.{webp}` | Arena board + Hub piece-rail |
| Game board | `board/board-ch.{webp}` | Arena chess board |
| HUD / dock íconos (19) | `icons/{trophy,star,shield,crown,time,lock,move,share,crosshair,coach,wallet,shop,close,check,refresh,copy,fingerprint,chevron-down,loading}.{webp}` | HUD chips, dock items, action icons |

**Regla**: cualquier asset nuevo Adventure debe entrar a `art/redesign/` siguiendo el formato triple `.avif/.png/.webp` y registrarse aquí antes de uso productivo.

---

## 4. Spec — piezas pendientes (Bloque B / futuro)

> Estas piezas **no están construidas todavía**. Quedan documentadas para que cuando lleguen al código no haya drift.

### 4.1 `<ComingSoonChip />` — 🟡 spec aprobada (Bloque B C3)

- **Archivo destino**: `apps/web/src/components/ui/coming-soon-chip.tsx`
- **Texto**: `"Soon"` (in-app EN). Ver §6 (idioma).
- **A11y**: `aria-label="Coming soon"`.
- **Variant `tone`**: `default` (gold-muted) | `pro` (amber).
- **Tamaño**: `text-nano` uppercase, padding tight, border 1px, background cream semi-transparente, `rounded-full`.
- **Donde se usa**: items roadmap de PRO sheet (reemplazar el sufijo textual `(coming soon)`). Items "Soon" en `ROADMAP_COPY` cuando llegue su turno.
- **Donde NO se usa**: junto a CTA primaria, dentro de un overlay modal, mezclado con texto `(coming soon)` en la misma surface.

### 4.2 Kicker pequeño "Training Pass" — 🟡 spec aprobada (Bloque B C4)

- **Donde**: header del PRO sheet, sobre el título "Chesscito PRO".
- **Estilo**: `text-nano uppercase tracking-[0.12em]`, color amber-700, espaciado tight con el título debajo.
- **Donde NO**: cards normales, buttons, banners de estado, sheets que no sean PRO.

### 4.3 Status badges — 🟡 patrón canónico

| Concepto | Render in-app (EN) | Render landing (ES) | Tono visual |
|---|---|---|---|
| Estado nuevo | `New` | `Nuevo` | candy-amber |
| Estado PRO | `PRO` | `PRO` | candy-amber pro |
| Estado próximo | `Soon` | `Próximo` | gold-muted |

**Reglas**:
- Los estados son chips cortos (`text-nano` o `text-[11px]`), `rounded-full`, padding tight.
- Etiqueta vive en `editorial.ts` (un solo punto de cambio: `PRO_COPY.comingSoonLabel`, `STATUS_LABELS.new`, etc.).
- Una surface nunca debería renderizar más de un badge por item.

### 4.4 Locked-state pattern — 🟡 spec (Phase 1+)

Para perks PRO o features Phase 1 que aún no están desbloqueados al usuario:

- Ítem renderizado al 60% de opacidad.
- Chip `<ComingSoonChip />` o icono 🔒 minimal a la derecha.
- Tap → bottom sheet explicando "PRO unlocks this" o "Coming soon — track progress here".
- **No bloquear con modal** — el lock es informativo, no agresivo.

### 4.5 `<KingdomAnchor>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/kingdom/kingdom-anchor.tsx`
- **Atmosphere**: Adventure
- **Variants**: `playhub` (1:1) · `arena-preview` (1.3:1, board preview) · `landing-hero` (1.5:1)
- **Asset source**: `redesign/bg/splash-loading.webp` (recomposición / 1:1 crop)
- **States**: `idle`, `attract`, `celebration`, `reduced-motion`
- **A11y**: `role="img"` + `aria-label` from `editorial.ts.HOME_ANCHOR_COPY.alt`
- **Spec completa**: UX spec Step 11 §1

### 4.6 `<HudResourceChip>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/hud/hud-resource-chip.tsx`
- **Atmosphere**: Adventure (uses `redesign/icons/*`) o Scholarly (paper-craft)
- **Variants**: `tone={"default" | "pro" | "trophy"}`, `size={"md" | "compact"}`
- **States**: `default`, `pulse`, `pro`, `loading`, `empty` (no render)
- **A11y**: `role="status"` + `aria-label` per chip + `aria-live="polite"` on updates
- **Spec completa**: UX spec Step 11 §2

### 4.7 `<HudSecondaryRow>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/hud/hud-secondary-row.tsx`
- **Atmosphere**: Adventure
- **Comportamiento**: data-driven; renderiza solo cuando ≥ 1 chip tiene contenido vivo (Streak / Stars / Shields / future ELO)
- **States**: `hidden` (no content), `partial`, `full`
- **A11y**: `role="region"` + `aria-label="Player resources"`
- **Spec completa**: UX spec Step 11 §3

### 4.8 `<RewardColumn>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/kingdom/reward-column.tsx`
- **Atmosphere**: Adventure
- **Comportamiento**: vertical stack, max 3 tiles visibles, overflow `…`
- **States por tile**: `claimable`, `progress`, `locked`
- **A11y**: cada tile es `<button>` con `aria-label` describiendo reward + estado
- **Spec completa**: UX spec Step 11 §4

### 4.9 `<PremiumSlot>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/pro-mission/premium-slot.tsx`
- **Atmosphere**: Adventure
- **Asset source**: `redesign/banners/btn-stone-bg.webp` tinted gold via CSS overlay
- **States**: `inactive`, `active`, `expiring`, `recently-renewed`
- **A11y**: `<button>` + `aria-label` ("Training Pass — 6 of 10 sessions used, 23 days remaining")
- **Spec completa**: UX spec Step 11 §5

### 4.10 `<MissionRibbon>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/pro-mission/mission-ribbon.tsx`
- **Atmosphere**: Adventure (Hub, Arena) o Scholarly (PRO sheet — única surface mixta)
- **Variants**: `tone={"default" | "emphatic"}`, `surface={"hub" | "arena" | "pro-sheet" | "landing-cta-bar"}`
- **States**: `default`, `enter` (fade-in via `--duration-mission-ribbon-reveal`)
- **A11y**: `role="note"` + `aria-label="Mission statement"`
- **Copy**: `editorial.ts.MISSION_RIBBON_COPY[surface]`. Default usa `PRO_COPY.tagline`.
- **Spec completa**: UX spec Step 11 §6
- **Canon honored**: Mission before CTA (canon §11) — siempre renderizado **arriba** del CTA en surfaces de pago.

### 4.11 `<PrimaryPlayCta>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/kingdom/primary-play-cta.tsx`
- **Atmosphere**: Adventure
- **Asset source**: `redesign/banners/btn-stone-bg.webp` + `redesign/banners/btn-{battle,play,claim}.webp` (icon overlay según surface)
- **Variants**: `surface={"playhub" | "arena-entry" | "landing-final-cta"}`, `size={"md" | "compact"}`
- **States**: `default` (con ambient pulse 4s), `hover-equivalent`, `pressed`, `loading`, `disabled`
- **A11y**: `<button>` + `aria-label` from `editorial.ts.CTA_LABELS.play[surface]`
- **Spec completa**: UX spec Step 11 §7

### 4.12 `<FrameCraftCard>` — 🟡 spec aprobada (Game Home redesign)

- **Archivo destino**: `apps/web/src/components/frame-craft/frame-craft-card.tsx`
- **Atmosphere**: Scholarly (uso primario; landing plan tiles, capabilities, founders, achievements grid)
- **Tokens**: `--gold-leaf-{base,highlight,shadow}` para borders
- **Variants**: `tone={"warm" | "scholarly" | "premium"}`, `size={"sm" | "md" | "lg"}`
- **States**: `default`, `hover-equivalent`, `selected`, `disabled`
- **A11y**: pasa `role` + `aria-label` a children
- **Spec completa**: UX spec Step 11 §8

---

## 5. Reglas de uso (resumen ejecutable)

| Sí | No |
|---|---|
| Disclaimer en landing + /about | Disclaimer en play-hub, arena, sheets, overlays |
| Editorial centralizado en `editorial.ts` | Strings inline en componentes |
| Chips con copy de `editorial.ts` (1 punto de cambio) | Chips con copy hardcodeado |
| `<CognitiveDisclaimer variant="full" />` al pie de /about | `variant="short"` mientras no haya surface de contenido apta |
| Atribución a César + Wolfcito **solo** en /about | Repetir credenciales en cada surface |
| `text-nano` para labels micro | `text-[Xpx]` arbitrario (regla type-scale, #91 cerrado) |
| Color `rose-*` para errores, `emerald-*` para éxito, `amber-*` para warning | Mezclar `red-*` / `green-*` legacy |
| Containers `max-w-[var(--app-max-width)]` (390px) | Layouts desktop-first |
| Touch targets ≥ 44px | Botones diminutos en mobile |

---

## 6. Idioma del chip / status (canon)

- **App in-app permanece EN durante Phase 0/0.5.**
- Status labels render: `New` / `PRO` / `Soon`.
- Landing (ES locked v0.5) usa: `Nuevo` / `PRO` / `Próximo`.
- Etiqueta concreta en `editorial.ts` para que un futuro sprint de traducción flippee el render en un solo punto.
- A11y: `aria-label="Coming soon"` (EN) o `aria-label="Próximo"` (ES) según locale.

---

## 7. Anti-patrones (parches que rompen la narrativa)

1. **Disclaimer dentro de overlay/modal** — interrumpe sin contexto. Debe vivir donde el usuario llega buscando contexto.
2. **`ComingSoonChip` junto a una CTA active** — confunde el affordance ("¿este botón funciona o no?").
3. **Múltiples kickers en la misma vista** — pierden jerarquía.
4. **Mezclar `(coming soon)` textual y chip `Soon`** en la misma surface — duplica la señal.
5. **Status badges múltiples** sobre el mismo ítem — el lector no sabe cuál pesa más.
6. **Texto de claim médico** sin disclaimer cercano — viola el filtro §8 del canon.
7. **Atribución FIDE Master en surfaces de juego** — diluye la credencial al volverla decoración.
8. **Mecánicas punitivas** (life systems, FOMO, pérdida de progreso por inactividad) — viola Pilar 3 del canon. Streaks suaves, timers opcionales y misiones cortas son válidos.
9. **Etiquetar como PRO una feature gratis** — rompe la promesa de "free decente" y degrada la marca PRO.
10. **Chips con texto largo** — el chip es etiqueta, no descripción. Un chip > 2 palabras probablemente quería ser un badge o un label.
11. **Mezclar Adventure + Scholarly tokens en la misma surface sin justificación documentada** — el PRO sheet es la **única excepción canonizada** (Adventure shell + Scholarly mission ribbon). Cualquier otra mezcla requiere actualizar §2 y §2.5 de este doc primero.
12. **Usar warm-paper palette en surfaces de juego (Hub, Arena, Victory)** — degrada el world-feel, rompe la Adventure atmosphere y desperdicia el visual equity de `art/redesign/`.

---

## 8. Cómo extender este doc

- Cualquier nueva pieza visual (componente, patrón, token) propuesta en Phase 1+ debe:
  1. Aparecer aquí con estado `🟡 spec aprobada` antes de ir al código.
  2. Pasar por la regla "¿qué pilar sostiene?" del canon §4.
  3. Cumplir los criterios §13 del canon (acceptance criteria para futuras features).
- Si una pieza queda obsoleta, marcarla `❌ retirada (fecha)` y mover el porqué a una nota corta. No borrar — el historial narrativo importa.

---

## 9. Referencias

- Canon: `docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md`
- Plan Phase 0.5: `docs/superpowers/plans/2026-05-03-phase-0.5-narrative-coherence.md`
- Editorial: `apps/web/src/lib/content/editorial.ts`
- Design system raíz: `DESIGN_SYSTEM.md`
- Type scale spec: `docs/superpowers/specs/2026-04-12-type-scale-consistency-design.md`
- **UX spec Game Home redesign**: `_bmad-output/planning-artifacts/ux-design-specification.md`
- **Direction showcase**: `_bmad-output/planning-artifacts/ux-design-directions.html`
- **Asset audit**: `_bmad-output/planning-artifacts/asset-audit-2026-05-03.md`
- **Redesign priorización**: `_bmad-output/planning-artifacts/redesign-priorization-2026-05-03.md`
- **Adventure asset directory**: `apps/web/public/art/redesign/`

---

**Fin del doc.** Próxima edición esperada: cuando Phase 1 del rediseño (Hub migration) lande y los primitives `<KingdomAnchor>`, `<HudResourceChip>`, `<MissionRibbon>`, `<PrimaryPlayCta>` pasen de 🟡 spec aprobada a ✅ live.
