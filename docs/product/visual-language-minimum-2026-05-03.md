# Visual Language Minimum — Phase 0.5

> **Spec del lenguaje visual mínimo reusable**
> Soporta el canon en `docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md`.

- **Fecha**: 2026-05-03
- **Estado**: Vivo. Se actualiza con cada commit de Phase 0.5+.
- **Alcance**: solo piezas que existen hoy o están especificadas para Bloque B. **Cero gameplay, cero promesas nuevas.**

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

| Surface | Pilar dominante | ¿Lleva disclaimer cognitivo? | Notas |
|---|---|---|---|
| `/` (landing) | 1 + 2 + 3 | ✅ `full` ×2 (capabilities + footer) | Locked v0.5. |
| `/about` | 3 | ✅ `full` (footer) | C2 añadió Methodology + disclaimer. |
| `/play-hub` | 1 + 2 | ❌ NO (decisión 2026-05-03) | El disclaimer in-app comprimía el board y no aporta en surface de juego activo. |
| `/arena` (selecting) | 1 + 2 | ❌ NO (mismo motivo) | El usuario que necesite contexto cognitivo llega vía `/about`. |
| `/arena` (playing) | 1 | ❌ NO | Surface transitoria; jamás llevará disclaimer. |
| `/trophies` | 1 | ❌ NO | Vitrina; orgullo, no contexto. |
| `/leaderboard` | 1 | ❌ NO | Datos. |
| `/victory/[id]` | 1 | ❌ NO | OG share / viralidad. |
| `/support`, `/privacy`, `/terms` | — | ❌ NO | Legal/operativo, no narrativo. |
| Coach surfaces (gated) | 2 | ❌ NO (cuando se activen) | El disclaimer no entra a Coach. La atribución metodológica sí (Phase 1+). |

**Regla derivada**: el disclaimer cognitivo solo vive en superficies de **contenido / contexto** (landing, /about). Toda superficie de **juego, datos o transacción** queda libre de disclaimer y sólo enlaza a `/about` cuando hace falta.

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

### 3.3 Tokens y clases compartidas (ya en `globals.css`)

| Token | Uso | Notas |
|---|---|---|
| `text-nano` (0.5rem / 8px) | Labels de dock, piece-rail, microtags | Custom token en `tailwind.config.js`. |
| `paper-tray` | Container con paper bg + sombra suave | Reusado en /about, settings, links. |
| `mission-shell`, `mission-shell-candy`, `atmosphere` | Shells del play-hub | Definidos en `globals.css`. |
| `fantasy-title` | Títulos con énfasis warm | Para encabezados de sheets / surfaces. |
| `chesscito-dock`, `chesscito-dock-item`, `chesscito-dock-center` | Dock persistente | No tocar sin coordinar. |
| Color: `--paper-text`, `--paper-text-muted`, `--paper-text-subtle` | Tipografía sobre paper bg | Definidos en theme. |
| Color: `rgba(63, 34, 8, 0.95)` (warm dark brown) | Texto sobre cream | Canon en chips candy. |
| Color: `rgba(255, 245, 215, 0.55)` (cream paper) | Background de chips/cards | Canon. |
| Color: `rgba(110, 65, 15, 0.28)` (warm border) | Borders de chips | Canon. |

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

---

**Fin del doc.** Próxima edición esperada: tras C3/C4 (cuando `<ComingSoonChip />` y "Training Pass" kicker pasen de spec a código).
