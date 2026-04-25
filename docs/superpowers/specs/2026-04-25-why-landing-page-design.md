# `/why` — Public Landing Page Spec (MVP)

*A Den Labs / Chesscito artifact — facilitated by Samus Shepard.*

| Field | Value |
|---|---|
| Date | 2026-04-25 |
| Author | Wolfcito |
| Status | Spec v0.1 — locked decisions, ready for commit plan |
| Parent doc | [`2026-04-24-chesscito-game-brief.md`](./2026-04-24-chesscito-game-brief.md) §11 |
| Type | Public marketing surface (single-page scroll) |
| Surface | New route `/why`. Does not replace `/`. Does not modify the Play Hub. |

---

## 1. Goal

Ship a public, sponsor-ready landing page that explains **what Chesscito is, why it exists, and who it's for**, without disrupting any existing player flow. The Game Brief notes that "the game communicates through play, but a dedicated marketing surface is needed for sponsor outreach and parent buy-in" (Brief §9). This spec is that surface.

The MVP is *Light Plus*: one new route, copy centralized in `editorial.ts`, components reused from the existing candy-game system, real screenshots, no form / video / heavy custom assets.

## 2. Non-goals

- Replacing `/` (Play Hub) or modifying its routing.
- Audience tabs / multi-pane layouts. Single-page vertical scroll only.
- Contact / signup forms (sponsors reach out via existing Support email + GitHub Issues).
- Video embedding, motion graphics, parallax.
- New heavy art assets (mascot illustrations, custom hero images). Use existing screenshots + the candy aesthetic.
- Localization beyond Spanish for v1. (English version is a follow-up sprint.)
- Clinical / medical claims. **Strict.** See §3.

## 3. Positioning & tone

**What Chesscito *is*** *(say loudly)*:
A playful experience designed to stimulate cognitive abilities — attention, visual memory, planning, pattern recognition, and decision-making — through chess-inspired challenges.

**What Chesscito is *not*** *(never imply)*:
- Not a treatment, therapy, prescription, or substitute for medical care.
- Not a clinical device, app, or validated diagnostic.
- Not a cure or preventive intervention for any specific disease.
- Not "brain training" in the over-promised sense (avoid "boost IQ", "prevent Alzheimer's", etc.).

**Voice**: simple, warm, premium, human, hopeful. Avoid clinical jargon. Avoid sounding like a medtech app. Should feel like a thoughtful game with purpose.

**Required disclaimer** (rendered at least once, in §5 cognitive stimulation section, plus in footer):
> *Chesscito no reemplaza tratamiento médico. Es una experiencia lúdica de acompañamiento cognitivo.*

Den Labs is the parent brand and appears in the footer signature, not as an aggressive co-brand.

---

## 4. Audience hierarchy

The hero block speaks to **players first** because that is the universal entry point that every other audience can also relate to. Subsequent sections widen the lens to parents, sponsors, and institutions.

| Audience | Where they land | What they read |
|---|---|---|
| **Players** (kids 8–16, adults) | Hero | "Juega. Piensa. Entrena tu mente." |
| **Parents** | Sections 2 + 5 | Pre-chess pedagogy + "para acompañar el bienestar cognitivo" |
| **Sponsors / DAOs** | Section 6 + footer | "Construido para impacto" + Den Labs framing |
| **Institutions** (schools, programs) | Section 5 | "Una herramienta simple… educativo, familiar, comunitario, institucional" |

A sponsor or institution reading from top to bottom should arrive at their CTA naturally. There are no audience tabs — the scroll itself is the funnel.

---

## 5. Page structure

Single-page vertical scroll. Mobile-first (max-width 390 px). Each section is a `<section>` that the user can scroll past. Sticky elements: none in v1 (let the page breathe).

### §0. Page chrome

- Top bar: candy back arrow → `/` (Play Hub). Same `CandyBanner name="btn-back"` used by `LegalPageShell`.
- No persistent dock — landing is a marketing surface, not a hub destination.
- Page background: same forest + cream wash treatment as `arena-bg` so the page reads as part of the Chesscito world.

### §1. Hero — *Players first*

| Slot | Content |
|---|---|
| Eyebrow chip | `BIENESTAR COGNITIVO LÚDICO` (small, candy-paper) |
| Headline | **`Juega. Piensa. Entrena tu mente.`** |
| Subcopy | `Una aventura de retos inspirados en ajedrez para fortalecer atención, memoria y toma de decisiones mediante juego.` |
| Primary CTA | `Empezar a jugar` → `/` |
| Secondary CTA | `Conocer el propósito` → smooth-scroll to `#purpose` (section 3) |
| Visual | Real screenshot of the play hub mid-game (rook on board with valid-move highlights), framed in the candy paper-panel + amber halo. |

Visual treatment: the screenshot is shown in a phone-shaped frame to communicate "mobile-first product" at a glance.

### §2. *Ajedrez antes del ajedrez*

| Slot | Content |
|---|---|
| Section title | `Ajedrez antes del ajedrez.` |
| Body | `En Chesscito convertimos piezas, movimientos y decisiones en retos cortos, visuales y fáciles de jugar. No necesitas saber jugar ajedrez para empezar — solo curiosidad.` |
| Visual | Screenshot of an L1 exercise with the rook + star + highlighted lanes. |
| Bullet trio | Three small cards: `Movimientos sencillos` · `Tableros guiados` · `Sin presión de tiempo` |

### §3. Estimulación cognitiva *(anchor: `#purpose`)*

| Slot | Content |
|---|---|
| Section title | `Diseñado para estimular la mente.` |
| Body | `Cada reto está pensado para activar habilidades clave: atención sostenida, memoria visual, planificación, reconocimiento de patrones y toma de decisiones bajo restricciones simples.` |
| Capability list (5 chips with `CandyIcon`) | `Atención`, `Memoria visual`, `Planificación`, `Patrones`, `Decisiones` |
| **Disclaimer block** | `Chesscito no reemplaza tratamiento médico. Es una experiencia lúdica de acompañamiento cognitivo.` Rendered as a soft amber-tinted card so it's noticed but not alarming. |

### §4. Progreso y recompensa

| Slot | Content |
|---|---|
| Section title | `Progreso que se siente como aventura.` |
| Body | `Avanzas por mundos, completas retos, ganas estrellas, desbloqueas piezas y coleccionas insignias que viven contigo. Cada paso suma — sin atajos, sin trampas.` |
| Visual | Screenshot of the trophy / badges sheet (15/15 stars, owned badge, achievements grid). |
| Bullet trio | `Mundos por desbloquear` · `Estrellas por reto` · `Insignias coleccionables` |

### §5. Familias, instituciones, aliados

| Slot | Content |
|---|---|
| Section title | `Una herramienta simple para acompañar el bienestar cognitivo.` |
| Body | `Pensado para que cualquier persona — un niño en casa, una familia, un docente, una comunidad o una institución — pueda integrarlo a una rutina sana de ejercicio mental.` |
| Three use-case cards | **Familias** · **Educadores** · **Comunidades** — cada una con un párrafo de 1–2 líneas. |

Tone: invitational, not transactional. No "buy now" pressure.

### §6. Sponsors / aliados — *Construido para impacto*

| Slot | Content |
|---|---|
| Section title | `Construido para impacto.` |
| Body | `Buscamos aliados que crean en el juego como vehículo de bienestar cognitivo y aprendizaje. Tu apoyo nos ayuda a llegar a más personas — más niños, más comunidades, más impacto.` |
| Den Labs framing | `Chesscito es el primer experimento de Den Labs, un laboratorio que combina tecnología web2/web3 e IA para crear experiencias con propósito.` |
| Contact CTAs | Two text links: `Escríbenos` (mailto: support email) and `GitHub Issues` (existing repo). No form. |

### §7. CTA final

| Slot | Content |
|---|---|
| Headline | `¿Listo para hacer tu primera jugada?` |
| CTA | `Empezar a jugar` → `/` (game-primary, full-width on mobile) |
| Subtle line below | `Sin descargas. Sin registros largos. Solo el tablero, tú y tu próximo movimiento.` |

### §8. Footer

| Slot | Content |
|---|---|
| Disclaimer (repeat) | The same line from §3 in muted text. |
| Brand line | `Chesscito · A Den Labs experiment` |
| Links row | `Privacy` · `Terms` · `Support` · `About` |
| Year | `© 2026 Den Labs` |

---

## 6. Components inventory

### Reused (no new code)

| Component / class | Where |
|---|---|
| `Button` (variants `game-primary`, `game-ghost`) | All CTAs |
| `CandyIcon` | Capability chips, bullet markers |
| `CandyBanner name="btn-back"` | Top-bar back arrow |
| `paper-tray` (CSS class) | Disclaimer card, use-case cards |
| `candy-page-panel` (CSS class) | Optional outer frame |
| `secondary-page-scrim` + `arena-bg` (CSS classes) | Page-wide forest background treatment |
| `Link` from `next/link` | All navigation |

### New (small, scoped to this page)

| Component | Purpose |
|---|---|
| `apps/web/src/app/why/page.tsx` | The page itself (client component for smooth-scroll behavior) |
| `apps/web/src/app/why/layout.tsx` | Metadata (title, description, OG image) |
| Inline `<WhySection>` helper in the same file | DRY for repeated section title + body + visual layout |

No shared component package needs updating.

---

## 7. Assets needed

All assets either already exist in the repo or are generated via Playwright in CI / locally. **No new illustrator work required for v1.**

| Asset | Source |
|---|---|
| Hero screenshot — play hub mid-game | `e2e-results/snapshots/minipay-play-hub.png` (already produced by `pnpm test:e2e:visual`). Cropped + AVIF/WebP encoded into `apps/web/public/art/landing/`. |
| Pre-chess screenshot — exercise with star | New Playwright capture seeded into the same dir. |
| Trophies screenshot | `e2e-results/snapshots/minipay-sheet-badges.png` or `minipay-sheet-trophies.png`. |
| Den Labs wordmark (text-only for v1) | Inline `fantasy-title` text with the existing palette. No logo file required for MVP. |
| Forest background | Existing `arena-bg` / `bg-ch.png` used elsewhere. |

Image filenames + dimensions (PNG/AVIF/WebP triple — same pattern as `art/redesign/board/board-ch.*`):
- `art/landing/hero-play-hub.{png,avif,webp}` — 750×1334 (mobile screenshot crop)
- `art/landing/pre-chess-exercise.{png,avif,webp}` — 750×1334
- `art/landing/progress-trophies.{png,avif,webp}` — 750×1334

Each shown at ~75% viewport width on mobile, with a candy paper frame.

---

## 8. Copy — to be added to `editorial.ts`

A new constant `WHY_PAGE_COPY` collects all strings. Spanish per the user-facing language decision for this surface (the rest of the app stays English in v1).

```ts
export const WHY_PAGE_COPY = {
  meta: {
    title: "Chesscito — Juega. Piensa. Entrena tu mente.",
    description:
      "Una aventura de retos inspirados en ajedrez para fortalecer atención, memoria y toma de decisiones mediante juego.",
  },
  hero: {
    eyebrow: "BIENESTAR COGNITIVO LÚDICO",
    headline: "Juega. Piensa. Entrena tu mente.",
    subcopy:
      "Una aventura de retos inspirados en ajedrez para fortalecer atención, memoria y toma de decisiones mediante juego.",
    primaryCta: "Empezar a jugar",
    secondaryCta: "Conocer el propósito",
  },
  preChess: {
    title: "Ajedrez antes del ajedrez.",
    body:
      "En Chesscito convertimos piezas, movimientos y decisiones en retos cortos, visuales y fáciles de jugar. No necesitas saber jugar ajedrez para empezar — solo curiosidad.",
    bullets: [
      "Movimientos sencillos",
      "Tableros guiados",
      "Sin presión de tiempo",
    ],
  },
  cognitive: {
    title: "Diseñado para estimular la mente.",
    body:
      "Cada reto está pensado para activar habilidades clave: atención sostenida, memoria visual, planificación, reconocimiento de patrones y toma de decisiones bajo restricciones simples.",
    capabilities: [
      { icon: "crosshair", label: "Atención" },
      { icon: "star",      label: "Memoria visual" },
      { icon: "move",      label: "Planificación" },
      { icon: "refresh",   label: "Patrones" },
      { icon: "crown",     label: "Decisiones" },
    ],
    disclaimer:
      "Chesscito no reemplaza tratamiento médico. Es una experiencia lúdica de acompañamiento cognitivo.",
  },
  progress: {
    title: "Progreso que se siente como aventura.",
    body:
      "Avanzas por mundos, completas retos, ganas estrellas, desbloqueas piezas y coleccionas insignias que viven contigo. Cada paso suma — sin atajos, sin trampas.",
    bullets: [
      "Mundos por desbloquear",
      "Estrellas por reto",
      "Insignias coleccionables",
    ],
  },
  community: {
    title: "Una herramienta simple para acompañar el bienestar cognitivo.",
    body:
      "Pensado para que cualquier persona — un niño en casa, una familia, un docente, una comunidad o una institución — pueda integrarlo a una rutina sana de ejercicio mental.",
    cards: [
      {
        title: "Familias",
        body: "Una rutina ligera para compartir minutos de juego y conversación.",
      },
      {
        title: "Educadores",
        body: "Material lúdico que complementa actividades de aula sin pedir instalación.",
      },
      {
        title: "Comunidades",
        body: "Una experiencia abierta que cualquier programa puede ofrecer a sus participantes.",
      },
    ],
  },
  sponsors: {
    title: "Construido para impacto.",
    body:
      "Buscamos aliados que crean en el juego como vehículo de bienestar cognitivo y aprendizaje. Tu apoyo nos ayuda a llegar a más personas — más niños, más comunidades, más impacto.",
    denLabs:
      "Chesscito es el primer experimento de Den Labs, un laboratorio que combina tecnología web2/web3 e IA para crear experiencias con propósito.",
    contactPrimary: "Escríbenos",
    contactSecondary: "GitHub Issues",
  },
  finalCta: {
    headline: "¿Listo para hacer tu primera jugada?",
    cta: "Empezar a jugar",
    note:
      "Sin descargas. Sin registros largos. Solo el tablero, tú y tu próximo movimiento.",
  },
  footer: {
    brand: "Chesscito · A Den Labs experiment",
    year: "© 2026 Den Labs",
  },
} as const;
```

---

## 9. Implementation constraints

- Mobile-first; max content width 390 px (existing `--app-max-width`).
- No new motion / parallax / scroll-snap libraries. Smooth-scroll uses native CSS `scroll-behavior: smooth`.
- Page must render statically (no client-side data fetching). Client component only for smooth-scroll handler on the secondary CTA.
- Lighthouse perf budget: ≥ 90 mobile. Hero screenshot must be served as AVIF with WebP/PNG fallbacks.
- No tracking pixels beyond the existing `track()` telemetry helper. CTAs emit `why_cta_click` events for funnel analysis.
- Disclaimer must appear at least twice (§3 inline card + §8 footer). Required.
- Nothing on this page reads, writes, or claims any blockchain state.

---

## 10. Acceptance criteria

A reviewer should be able to verify each of these without writing new test cases.

1. ✅ Visiting `/why` on a fresh browser session renders the full page without redirecting.
2. ✅ The page is mobile-first; on a 390 px viewport every section reads cleanly with no horizontal scroll.
3. ✅ Both hero CTAs work: primary navigates to `/`, secondary smooth-scrolls to `#purpose`.
4. ✅ The cognitive disclaimer appears in §3 (inline) and §8 (footer).
5. ✅ All copy strings live under `WHY_PAGE_COPY` in `editorial.ts`. No inline copy in JSX.
6. ✅ No new top-level dependencies in `package.json`.
7. ✅ Lighthouse mobile score ≥ 90 for `/why` against a local prod build.
8. ✅ Telemetry: `why_cta_click` event fires with a `slot` attribute for `hero-primary`, `hero-secondary`, `final-primary`, `sponsors-email`, `sponsors-github`.
9. ✅ Visual snapshot at desktop + mobile registered in `e2e/visual-snapshot.spec.ts` PAGES list.
10. ✅ `/why` linked from `/about` so anyone who lands there can find the public landing.
11. ✅ TypeScript clean, ESLint clean, all existing tests pass.
12. ✅ Copy never makes a clinical claim (manual review of `WHY_PAGE_COPY`).

---

## 11. Commit plan

Five granular commits, in order. Each pushes after verification.

1. **`feat(why): copy + meta scaffolding`** — adds `WHY_PAGE_COPY` to `editorial.ts` plus `app/why/{page,layout}.tsx` skeleton with hero only. Validates routing + metadata.
2. **`feat(why): pre-chess + cognitive sections with disclaimer`** — sections 2 + 3, including the soft amber disclaimer card.
3. **`feat(why): progress + community + sponsors sections`** — sections 4 + 5 + 6.
4. **`feat(why): final CTA + footer + telemetry`** — section 7 + 8, wires `why_cta_click` events.
5. **`chore(why): landing screenshots + visual snapshot test + about link`** — generates the three landing screenshots, registers them in `art/landing/`, adds `/why` to the visual snapshot test, links from `/about`.

After commit 5: full E2E + visual + lighthouse pass, then PR description points to this spec.

---

## 12. Open questions

| # | Question | Decision needed before |
|---|---|---|
| Q1 | Do we want a tiny "Why?" link in the play-hub footer area, or only via `/about`? | Commit 5 |
| Q2 | Spanish-only for v1 or do we ship `/why/en` from day one? | Commit 1 |
| Q3 | Should the sponsors section show real partners' logos when we have any (later sprint)? | Future |
| Q4 | Do we want a downloadable one-pager PDF for sponsors, or is the URL itself the artifact? | Future |

---

## Appendix A — Section visual rhythm

Approximate vertical heights on a 667 px viewport (iPhone SE / minipay reference):

| Section | Approx height |
|---|---|
| Top bar | 56 px |
| §1 Hero | 720 px (above + below the fold) |
| §2 Pre-chess | 480 px |
| §3 Cognitive (with disclaimer) | 560 px |
| §4 Progress | 480 px |
| §5 Community | 520 px |
| §6 Sponsors | 440 px |
| §7 Final CTA | 320 px |
| §8 Footer | 220 px |

Total scroll length: roughly 3.8 viewport heights, comparable to a tight Duolingo product page.
