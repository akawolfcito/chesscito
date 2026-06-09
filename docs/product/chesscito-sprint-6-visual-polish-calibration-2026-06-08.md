# Chesscito — Sprint 6 Calibration: Visual Polish Cluster

**Owner**: John (PM) · **Stakeholders**: Wolfcito (founder), eng
**Date**: 2026-06-08 · **Status**: Calibration — no code, awaiting founder sign-off on §9

> **Frase guía**: "Antes de agregar más cosas, hacer que lo que ya existe se sienta excelente."

Sprint 6 NO es feature sprint. Es polish puro de surfaces existentes para alinearlas al sistema candy/board/Peones. Cero economía nueva, cero sinks, cero endpoint cambios.

## 1. Tesis Sprint 6

Sprint 5 cerró el spend loop con economía generosa. La nota de filosofía Peones (2026-06-08) congela features económicas hasta que polish visual aterrice. Sprint 6 ataca esa deuda con UN principio: las superficies pre-Sprint 4 (Coach, Luz, result overlay, failure flash) se ven como heredadas de otra era — paneles forest-green, texto largo, modales sueltos que no matchean la HUD candy + chips morphing + sprite-driven que iteramos sprints 3-5.

## 2. Estado actual (snapshot 2026-06-08 post-promote)

### Lo que YA está live + polished

- Peones economy (earn / balance / Hint / Retry plumbing / Coach Peones path / PRO bypass / welcome pack)
- HUD Peones chip (pawn sprite, single-line, no jitter)
- Hint chip (morphing single-line, bottom-right floating, board glow reveal)
- Daily Tactic + Training earn + Coach analyze
- Drag-to-move (Sprint 4)
- Browser zoom disabled globally (game gesture hygiene)
- Welcome pack +1 Peón seed
- Production en `ab89628b`

### Deuda visual reconocida

| Surface | Heredada de | Sprint que la tocó por última vez |
|---|---|---|
| Coach result modal | Coach Cluster C (mayo 2026) | Pre-Sprint 4 |
| Coach loading "Coach is thinking" | Coach Cluster C | Pre-Sprint 4 |
| Luz onboarding modal | Coach welcome flow | Pre-Sprint 4 |
| Result overlay (badge / score / shop / error) | Stabilization Sprint 2026-05 | Pre-Sprint 4 |
| Failure visual (PhaseFlash + autoReset 1.5s) | Original training flow | Pre-Sprint 3 |
| Badge earned overlay | Original badge claim | Pre-Sprint 3 |

## 3. Principios visuales (sprint-6 contract)

1. **Visual-first, poco texto** — reveals on-board, no text banners. Aplica al hint glow, aplica a failure (no más "TRY AGAIN" gigante si podemos comunicar con animación).
2. **Consistencia con sistema candy/board** — paneles, chips, sprites comparten lexicon. Forest-green modales pre-Sprint 4 quedan fuera del sistema.
3. **Peones se sienten como moneda propia** — el sprite pawn + label "N Peones" ya está. Cualquier spend feedback debe reusar el lexicon, no inventar otro.
4. **Coach debe sentirse premium/útil** — no genérico. Modal debe transmitir que pagaste por algo, no que cargó un panel cualquiera.
5. **Failure guía, no castiga** — la wolf wizard "TRY AGAIN" es expresivo pero estático. Failure debe sentirse como "ok, intentá de nuevo así" no como "fallaste".
6. **Loading se siente vivo** — "Coach is thinking…" con spinner muerto pierde 5-10s de atención del usuario.
7. **Modales como parte de Chesscito** — heredan el board's grass-green + warm-amber palette, sprites del wolfcito, sin painterly green forest pre-Sprint 4.
8. **Mobile/MiniPay-first** — 390px viewport, hit-targets ≥44px, sin scroll-trap dentro de modales.

## 4. Matriz de superficies

| # | Surface | Problema actual | Riesgo | Impacto | PM call |
|---|---|---|---|---|---|
| 1 | **Coach result modal** | Painterly forest-green panel + texto largo (summary/mistakes/lessons). Choca con HUD candy. Es la "premium experience" pero NO se siente premium. | Medio (mucha lógica detrás, layout complejo). | **ALTO** — surface paga, alta visibility usuarios PRO + free credits. | **Atacar primero**. |
| 2 | **Coach loading "Coach is thinking…"** | Forest panel + texto + hourglass sprite. Estática durante 5-10s del LLM. | Bajo (overlay sencillo). | Alto — todo Coach call pasa por acá. | Atacar junto con #1 (mismo cluster Coach). |
| 3 | **Luz onboarding modal** | "Hi I'm Luz" + texto descriptivo + 2 CTAs. Aparece UNA vez por wallet (gate localStorage). Forest-style. | Bajo (modal aislado). | Bajo-medio (one-shot, first impression). | Segundo o tercero. |
| 4 | **Result overlay (badge/score/shop/error variants)** | Variants existentes ya tienen iteración. Algunos chips muestran style consistente; modal frame sigue forest-leaning. | Medio (4 variants, varios callsites). | Medio — aparece en submit-score / claim-badge / shop-buy / error states. | Tercero — más complejo, no urgente. |
| 5 | **Failure visual (PhaseFlash + autoReset)** | TRY AGAIN gigante + wolf wizard + auto-reset 1.5s. Founder confirmó: cubre el bottom rail, RETRY button queda inalcanzable. UX confusa. | Medio (toca timing + overlay placement). | Alto — todos los players fallidos lo viven. | Cuarto — ataca confusion del Sprint 5 smoke. |
| 6 | **Peones Hint chip / spend feedback** | Iterado Sprint 4 commits M / L / N. Single-line morph + bottom-right floating + zoom disable. **Poca deuda real**. | Mínimo. | Bajo. | **Light touch solo** — micro-animations on success/insufficient, NO rediseño. |
| 7 | **Badge earned overlay** | Visual badge celebration cuando llegás a 10★. Original art still strong, pero el modal frame puede match-ear el system candy mejor. | Bajo. | Bajo-medio (one-shot per piece). | Quinto, slice chico visual-only. |
| 8 | **Purchase / PRO modal** | Cubre PRO sub + Founder claim + Coach credits buy + Peones packs (futuro). Hereda forest-style. | **ALTO — toca monetización M1 live**. | Alto. | **DEFER**. NO incluir Sprint 6 a menos que sea polish 100% sin tocar callsites. |

## 5. Orden recomendado

| Slice | Surface | Justificación |
|---|---|---|
| **A** | Coach result modal + Coach loading (cluster Coach) | Surface paga, off-brand pre-Sprint 4, alta visibility, atacarlos juntos comparte lexicon nuevo |
| **B** | Failure visual (PhaseFlash + autoReset rework) | Founder reporte directo del smoke: RETRY oculto, TRY AGAIN domina pantalla. Cierra UX confusion |
| **C** | Result overlay (4 variants) | Toca varios callsites, requiere el lexicon ya establecido en A. Después de A queda fácil |
| **D** | Luz onboarding modal | One-shot, first impression, no bloquea más |
| **E** | Badge earned overlay | Slice chico, visual-only |
| **F** | Peones chip micro-polish | Light touch — micro animations, no rediseño |
| ❌ | Purchase / PRO | DEFER. Riesgo de touch monetización M1 live. Revisar cuando polish core aterrice |

**Por qué Coach primero y no failure**: Coach es donde el usuario PAGA. La calidad visual percibida ahí afecta retention/PRO upgrade pitch directamente. Failure es importante pero más rescatable visualmente con cambio chico.

## 6. Plan de commits

| Slice | Scope | Acceptance |
|---|---|---|
| **A** | Calibration doc (este archivo) | Founder approves §9 |
| **B** | Coach modal redesign — frame candy + sprite-driven + tighter typography; same data payload | Coach result renderiza con frame nuevo, todos los CoachPanel tests siguen verdes; VR /coach/[gameId] refresh |
| **C** | Coach loading redesign — animation viva, no spinner muerto; reusa wolfcito sprite | "Coach is thinking" overlay matchea el lexicon nuevo; sin cambio en duración |
| **D** | Failure visual rework — PhaseFlash reposition + RETRY button accessible OR auto-reset confirmation visual | RETRY funciona o queda obviamente innecesario; VR failure baselines refresh |
| **E** | Result overlay 4 variants — frame consistency con A | badge/score/shop/error variants matchean Coach modal frame |
| **F** | Luz onboarding redesign — first-impression polish | One-shot modal con copy tight + visual hook |
| **G** | Badge earned polish + Peones chip micro-animations + handoff | Small slices bundled; smoke + VR + handoff doc |

**Cada commit es visual-first, cero economía**. Si algún slice descubre que necesita data shape change → para y reabrir calibration.

## 7. Riesgos

1. **Romper layout MiniPay 390px** — modales heredan w-max constraints variados. Riesgo de over-scroll si frame nuevo es taller.
2. **Over-polish con demasiado texto** — la tentación de "agregar contexto" puede meter copy nuevo. **HARD RULE: cero copy nuevo en este sprint salvo trim**.
3. **Inconsistencia entre modales** — si C, D, E, F no comparten el frame primitive, terminamos con 4 modales nuevos en lugar de 1.
4. **VR baselines explotan** — Coach modal tiene baselines /coach/[gameId]. Cada slice requiere refresh + validación que el diff es intencional.
5. **Mezclar polish con features** — la tentación de "ya que estoy ahí, mejoro X". HARD RULE: si emerge feature idea, queda en separate handoff doc, no se mezcla.
6. **Tocar flujo económico por accidente** — un slice de Coach modal podría mover el `peones_spend_bypassed` emit. HARD RULE: telemetry shape NO cambia.

## 8. Out of scope (explícito)

- ❌ Deep Hint (nueva tier de Hint)
- ❌ Theme packs (sink futuro)
- ❌ Streak Shield Peones-paid
- ❌ Undo Move
- ❌ Save game surface
- ❌ Daily Labyrinth Challenge
- ❌ Labyrinth key spend
- ❌ P2P matches
- ❌ Visor / spectator
- ❌ Tipping / regalar Peones
- ❌ Peones packs / stablecoin top-up
- ❌ Cualquier cambio de costos (Hint 1, Retry 2, Coach 1, save 1, daily +3)
- ❌ Endpoint changes (`/api/peones/*`, `/api/coach/analyze`)
- ❌ Ledger / schema changes
- ❌ Payment rails

## 9. Preguntas bloqueantes (PM recommendation)

1. **¿Coach primero o Result overlay primero?**
   **PM**: Coach primero. Surface paga, mayor visibility, mayor diferencial percibido.

2. **¿Usamos un shell/modal común para superficies candy?**
   **PM**: Sí — extraer UN `<CandyModalFrame>` primitive en slice B (Coach modal redesign). Reusable en C/D/E/F. NO crear design system gigante — un solo componente con slots para header/body/footer.

3. **¿Peones chips se pulen ahora o después?**
   **PM**: Light touch solo (slice F). Ya iteramos heavy Sprint 4 commits M/L/N. Micro-animations on transition (insufficient → idle, revealed → fade), nada más.

4. **¿Badge earned entra en este sprint?**
   **PM**: Sí, slice E. Visual-only, scope chico, badge earned es high-emotion moment que vale polish-ear.

5. **¿Purchase / PRO modal entra?**
   **PM**: **NO**. Riesgo monetización M1 live demasiado alto para combinarlo con polish puro. Si polish básico de Coach modal frame se puede reusar en Purchase modal después, ese es slice propio en Sprint 7+.

6. **¿Failure visual rework toca el autoReset gap (Sprint 5 §7.5)?**
   **PM**: Sí, aprovechamos para resolver el gap de la mano. Slice D incluye: ya sea (a) reposicionar PhaseFlash para que RETRY quede accesible, ó (b) hacer el RETRY button obviamente innecesario y wirearautoReset al guard. Ambas options resuelven la observability gap + UX.

7. **¿Lottie está permitido?**
   **PM**: NO. Memory rule `feedback_no_lotties.md` sigue activa. Para animaciones usar inline SVG, CSS keyframes, o sprite sheet de PNG/AVIF. Authoring time es el bottleneck.
