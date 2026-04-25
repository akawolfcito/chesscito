# Chesscito Landing — Narrative v0.5 (locked, ready for build)

*Den Labs / Chesscito artifact — facilitated by Samus Shepard.*

| Field | Value |
|---|---|
| Date | 2026-04-25 |
| Status | v0.5 — locked, cleared for nine-commit implementation |
| Type | Brand strategy + product copy + UX writing |
| Parent docs | [`2026-04-25-why-landing-page-design.md`](./2026-04-25-why-landing-page-design.md) (copy + non-claims policy) · [`2026-04-25-web-landing-architecture.md`](./2026-04-25-web-landing-architecture.md) (URL split + responsive layout) |
| Surface | `/` public landing (web-responsive Spanish v1) |

---

## 1. Why this exists

The first responsive landing shipped at `/` with a kid-and-game-first framing. Approved feedback from product strategy moves the narrative one level up: the product is **cognitive wellness**, the vehicle is chess. This v0.5 captures the locked copy + structure that subsequent commits implement.

This spec supersedes the section-level copy in the previous landing spec where they conflict. Architecture (URL split, MiniPay detection, PhoneFrame mockup) carries over unchanged.

---

## 2. Central narrative

> **Pequeñas jugadas. Grandes hábitos mentales.**
>
> Chesscito convierte el ajedrez en una rutina ligera y diaria para ejercitar atención, memoria, planificación y toma de decisiones. Cualquiera puede empezar gratis. Familias, educadores y aliados ayudan a sostener y ampliar el acceso. Web3 invisible al jugador, real al aliado. Primer experimento de **Den Labs**.

The framing pivots from "chess game with brain bonus" to "cognitive wellness initiative with chess as the gentle vehicle". Chess earns its place in the product because it is the most universally lúdico, low-barrier scaffold for those four cognitive habits — not because the product is *about* chess.

---

## 3. Tone & voice

| Trait | Read like |
|---|---|
| Cálido | A friend explaining, not a clinic prescribing. |
| Premium | Few words, well chosen. No bullet salad, no hype. |
| Esperanzador | Forward-looking, never alarmist. |
| Humano | First and second person. "Tú", "tienes", "te acompaña". |
| Claro | Plain Spanish. Short sentences. No jargon. |
| **No clínico** | Never "cura, trata, previene, diagnóstica". |
| **No exagerado** | Never absolute claims about outcomes. |
| Financiable | Sponsor reads §6–§8 and immediately sees a serious initiative. |

---

## 4. Section structure (10 sections)

1. **Hero** — pitch in five lines.
2. **Problema** — la mente también necesita rutina.
3. **Solución** — ajedrez antes del ajedrez.
4. **Cómo funciona** — una escalera, no una pared.
5. **Habilidades que entrena** — 5 capabilities + disclaimer.
6. **Para quién es** — niños, familias, educadores y comunidades.
7. **Planes / Sostenibilidad** — Gratuito / Familia / Educadores / Aliados.
8. **Impacto y aliados** — pillars + allies row.
9. **Quiénes somos** — Wolfcito, César Alarcón, Den Labs.
10. **CTA final** — back to action + footer with disclaimer (second render).

---

## 5. Locked copy

### §1 · Hero

```
Eyebrow:   BIENESTAR COGNITIVO LÚDICO
Headline:  Pequeñas jugadas. Grandes hábitos mentales.
Subcopy:   Chesscito convierte el ajedrez en retos visuales de
           pocos minutos para ejercitar atención, memoria,
           planificación y toma de decisiones desde edades
           tempranas.
CTA-1:     Empezar gratis        → /hub
CTA-2:     Conocer la iniciativa → smooth-scroll a #problem
Visual:    PhoneFrame + screenshot del play hub (rook + dots)
```

### §2 · Problema

```
Title:   La mente también necesita rutina.

Body:    Tienes rutina para tu cuerpo. Para tu sueño. Hasta para
         tu nutrición. Pero ¿una para tu mente? Atención, memoria,
         planificación y decisiones son habilidades. Como cualquier
         habilidad, se fortalecen con práctica constante.

Three claims:
  🧠  Se fortalecen con repetición consciente, no con esfuerzo bruto.
  🌱  Mientras antes empieces, más fácil es crear el hábito.
  ⏱️  10 minutos diarios pueden construir un hábito poderoso.
```

### §3 · Solución

```
Title:   Ajedrez antes del ajedrez.

Body:    No necesitas saber jugar para empezar. En Chesscito
         conviertes cada pieza en retos cortos, visuales y guiados.
         Aprendes cómo se mueve, resuelves laberintos con ella,
         dominas su identidad. Cuando ya juntas todas las piezas,
         el ajedrez completo se desbloquea solo — sin acantilados,
         sin clases pesadas, sin frustración.

Visual:  PhoneFrame + screenshot pre-chess (board crop con dots)
```

### §4 · Cómo funciona

```
Title:   Una escalera, no una pared.

Body:    Cada pieza vive en tres niveles. Los dominas por etapas.
         El mapa avanza contigo, una pieza a la vez.

Five steps:
  1. APRENDE   La pieza se mueve así. Simple. Claro. Sin presión.
  2. EXPLORA   Laberintos con obstáculos. Mínimos movimientos,
               máximo de estrellas.
  3. DOMINA    Un reto único por pieza que exprime su identidad.
  4. COMBINA   Torres y alfiles. Después la dama. Después el caballo.
               El tablero crece contigo.
  5. JUEGA     El ajedrez completo se desbloquea solo.
               Lo lograste tú, paso a paso.
```

### §5 · Habilidades que entrena

```
Title:   Cinco habilidades que te acompañan a lo largo del tiempo.

Five capabilities:
  🎯  Atención sostenida           Foco que aguanta los distractores.
  🧠  Memoria visual               Leer y recordar el tablero como patrón.
  🗺️  Planificación                Pensar varios pasos antes de mover.
  🔁  Reconocimiento de patrones   Ver lo familiar en lo nuevo.
  ⚖️  Toma de decisiones           Elegir bajo restricciones simples.

Disclaimer (banner — soft amber card with shield icon):
  Chesscito es una experiencia lúdica de acompañamiento cognitivo.
  No reemplaza diagnóstico, tratamiento médico ni terapia
  profesional.
```

### §6 · Para quién es

```
Title:   Hecho para empezar pronto. Útil a cualquier edad.

Three audience cards:

  Niños y adolescentes (8–16)
  Una etapa clave para cultivar hábitos cognitivos que pueden
  acompañar a lo largo del tiempo.

  Familias
  Una rutina ligera para compartir minutos de juego, conversación
  y crecimiento personal — sin pantallazos infinitos.

  Educadores y comunidades
  Material lúdico que complementa actividades de aula, clubes y
  programas sociales. Sin instalación pesada, sin curva técnica.
```

### §7 · Planes / Sostenibilidad

```
Title:   Un modelo donde nadie se queda fuera.

Body:    Chesscito puede empezar gratis. Las familias, educadores
         y aliados ayudan a sostener y ampliar el acceso. Web3
         hace que cada aporte sea trazable y útil.

──── 1. GRATUITO ────────────────────────
Para empezar.
  ✓ Acceso al ajedrez introductorio
  ✓ 3 primeras piezas con sus tres niveles
  ✓ Insignias de progreso
  ✓ Comunidad pública
CTA: Empezar gratis            → /hub

──── 2. FAMILIA ────────────────────────
Para entrenar juntos en casa.
  ✓ Hasta 4 cuentas vinculadas
  ✓ Todas las piezas y niveles
  ✓ Reportes mensuales de progreso
  ✓ Recordatorios suaves de rutina
  ✓ Sin publicidad, sin distractores
CTA: Activar Familia           → mailto: subject "Plan Familia"

──── 3. EDUCADORES ────────────────────────
Para aulas, clubes y programas.
  ✓ Licencias por estudiante o grupo
  ✓ Panel docente con seguimiento individual
  ✓ Plan de actividades sugerido
  ✓ Soporte directo de un Maestro FIDE
  ✓ Capacitación inicial
CTA: Solicitar licencia        → mailto: subject "Plan Educadores"

──── 4. ALIADOS / SPONSORS ────────────────
Para multiplicar el alcance.
  ✓ Sponsor-a-player: financia a un niño
  ✓ Sponsor-a-school: lleva Chesscito a una escuela
  ✓ Sponsor-a-community: respalda un programa
  ✓ Reportes de impacto trimestrales
  ✓ Reconocimiento on-chain + presencia en landing
CTA: Construir alianza         → mailto: subject "Aliado / Sponsor"
```

### §8 · Impacto y aliados

```
Title:   Construido para impacto.

Body:    Cada partida deja huella. Cada aliado abre una puerta.
         Trazabilidad clara, comunidad creciente, propósito
         explícito.

Three impact pillars:
  📊  Trazabilidad   Cada badge y aporte vive on-chain. Pública.
                     Verificable. Sin opacidad.
  🌎  Escala         El motor pedagógico es reutilizable. Detrás
                     de Chesscito vienen otros verticales cognitivos.
  🤝  Comunidad      DAOs, fundaciones, clubes, escuelas.
                     El círculo crece con cada alianza.

Allies row:  Próximamente.
             (Logos curados manualmente cuando entren los primeros aliados.)
```

### §9 · Quiénes somos

```
Title:   La gente detrás de Chesscito.

Lead body:
Una mezcla rara y necesaria: tecnología web3, IA y un Maestro
FIDE. Construyendo, validando y enseñando — con la pedagogía
de un profesor con décadas de experiencia en el aula.

Three founder cards:

  ╭── Wolfcito ──────────────────────────╮
  │ Luis Fernando Ushiña                 │
  │ Software Architect · web3 builder    │
  │ Fundador de Den Labs                 │
  │                                      │
  │ Lidera producto, tecnología y la     │
  │ visión de plataforma cognitiva       │
  │ escalable.                           │
  ╰──────────────────────────────────────╯

  ╭── César Alarcón ─────────────────────╮
  │ Maestro FIDE · Entrenador de ajedrez │
  │                                      │
  │ Trayectoria en escuelas e            │
  │ instituciones, incluyendo            │
  │ Concentración Deportiva de Pichincha │
  │ en Ecuador. Aporta la pedagogía y la │
  │ metodología de cada nivel.           │
  ╰──────────────────────────────────────╯

  ╭── Den Labs ──────────────────────────╮
  │ Parent brand                         │
  │                                      │
  │ Laboratorio que combina web2, web3   │
  │ e IA para construir experiencias     │
  │ digitales con propósito. Chesscito   │
  │ es su primer experimento.            │
  ╰──────────────────────────────────────╯
```

### §10 · CTA final

```
Title:    ¿Listo para tu primera jugada?

Subcopy:  Sin descargas. Sin registros largos. Solo el tablero,
          tú y tu próximo movimiento.

CTA-1:    Empezar gratis        → /hub
CTA-2:    Hablar con el equipo  → mailto support
```

### Footer

```
Disclaimer (second render — required):
  Chesscito es una experiencia lúdica de acompañamiento cognitivo.
  No reemplaza diagnóstico, tratamiento médico ni terapia
  profesional.

Privacy · Terms · Support · About

Chesscito · A Den Labs experiment
© 2026 Den Labs
```

---

## 6. CTA microcopy table

| Slot | Copy | Destino |
|---|---|---|
| Hero primary | Empezar gratis | `/hub` |
| Hero secondary | Conocer la iniciativa | `#problem` |
| Plan Gratuito | Empezar gratis | `/hub` |
| Plan Familia | Activar Familia | `mailto:?subject=Plan Familia` |
| Plan Educadores | Solicitar licencia | `mailto:?subject=Plan Educadores` |
| Plan Aliados | Construir alianza | `mailto:?subject=Aliado / Sponsor` |
| Final primary | Empezar gratis | `/hub` |
| Final secondary | Hablar con el equipo | `mailto:` |
| Loading | Preparando… | — |
| Error | Vuelve a intentarlo | — |
| Confirmation | Listo. Te escribiremos pronto. | — |

---

## 7. Risk audit — claims médicos evitados

| Riesgo | Mitigación aplicada |
|---|---|
| Determinismo absoluto ("cambia la trayectoria") | Lenguaje probabilístico ("pueden construir un hábito poderoso") |
| Atrofia / decadencia ("se atrofian") | Marco positivo ("se fortalecen con práctica constante") |
| "Toda la vida" como promesa absoluta | "A lo largo del tiempo" como acompañamiento |
| Edad como ventana cerrada ("la ventana") | "Una etapa clave" sin exclusión de otras |
| Resultado garantizado ("mejor compone") | Habilidad de hábito ("más fácil es crear el hábito") |
| Niños sin pago como compromiso jurídico ("siempre gratis") | Accesibilidad real ("Chesscito puede empezar gratis") |
| Boast pedagógico ("metodología real") | Descripción concreta ("décadas de experiencia en el aula") |
| Promesas terapéuticas | Disclaimer **2× obligatorio** (§5 inline + footer) |

**Auditoría literal**: el spec evita claims de cura, prevención o tratamiento. Las únicas menciones clínicas aparecen dentro del disclaimer para aclarar los límites del producto.

---

## 8. Versions for outreach

### Hero — short alt (for social cards / pitch slides)
> *Pequeñas jugadas. Grandes hábitos mentales.*

### Sponsors — 1-pager body

```
CHESSCITO · BIENESTAR COGNITIVO LÚDICO

Chesscito es la primera plataforma latinoamericana de bienestar
cognitivo gamificado para niños y adolescentes, con ajedrez como
vehículo. Construida sobre Celo (web3) para sostenibilidad y
trazabilidad pública.

EL PROBLEMA
Las habilidades cognitivas — atención, memoria, planificación,
decisiones — son habilidades como cualquier otra. Hoy, casi
ningún niño tiene una rutina estructurada para fortalecerlas.

LA SOLUCIÓN
Una escalera de retos cortos, visuales y guiados donde niños de
8 a 16 años aprenden ajedrez por etapas. Y, con él, fortalecen
los hábitos cognitivos que pueden acompañarles a lo largo del
tiempo.

EL MODELO
Chesscito puede empezar gratis. Las familias, educadores y
aliados ayudan a sostener y ampliar el acceso. Web3 invisible
al jugador, transparente al aliado.

TU ROL COMO ALIADO
  · Sponsor-a-player        — financia el progreso de un niño
  · Sponsor-a-school        — lleva Chesscito a una escuela
  · Sponsor-a-community     — respalda un programa social

Cada inversión es trazable on-chain, recibe reportes de impacto
trimestrales y aparece en nuestra red pública de aliados.

EL EQUIPO
Wolfcito (Luis Fernando Ushiña) — Software Architect, builder
web3, fundador de Den Labs.
César Alarcón — Maestro FIDE, entrenador con trayectoria en
escuelas e instituciones (Concentración Deportiva de Pichincha,
Ecuador).
Den Labs — laboratorio de experiencias con propósito.

CONTACTO
hablar@chesscito.app
```

### Pitch deck (7 slides)

1. **Problem** — La mente también necesita rutina. Y casi nadie la tiene.
2. **Insight** — Atención, memoria, planificación y decisiones son habilidades. Se fortalecen con práctica.
3. **Solution** — Chesscito convierte el ajedrez en retos visuales de pocos minutos. Sin clases. Sin presión. Sin acantilados.
4. **Model** — Chesscito puede empezar gratis. Familias, educadores y sponsors ayudan a sostener y ampliar el acceso.
5. **Vision** — Primer experimento de Den Labs. Detrás vienen otros verticales: memoria, razonamiento espacial, planificación.
6. **Team** — Wolfcito (web3 architect) · César Alarcón (Maestro FIDE) · Den Labs.
7. **Ask** — Aliados para sponsor-a-player, sponsor-a-school, sponsor-a-community. Reportes trimestrales. Impacto trazable.

---

## 9. Implementation plan — nine commits

| # | Commit | Scope |
|---|---|---|
| 1 | `docs(spec): landing narrative v0.5` | This file. No UI yet. |
| 2 | `feat(content): expand WHY_PAGE_COPY` | Hero rewrite + new fields (problem, howItWorks, plans, founders, impact). Single source of truth for copy. |
| 3 | `feat(landing): §2 Problem section` | New section before pre-chess. |
| 4 | `feat(landing): §4 How it works` | New 5-step ladder. |
| 5 | `feat(landing): §6 audiences rework` | Reuse community card pattern with new copy. |
| 6 | `feat(landing): §7 Plans (4 tiers)` | New pricing/sustainability section. |
| 7 | `feat(landing): §8 Impact + allies row` | Split impact from sponsors. |
| 8 | `feat(landing): §9 Quiénes somos` | Founders section new. |
| 9 | `style(landing): tone polish + microcopy + meta` | Final pass: remove gaming-y leftovers, update meta, lock CTA microcopy. |

**Constraints carried over from prior specs**:
- No new top-level deps.
- Reuses existing PhoneFrame, CandyIcon, Button, paper-tray.
- Mobile-first preserved (single column under 768 px).
- Disclaimer rendered at least twice (§5 + footer).
- All copy lives in `editorial.ts`; no inline strings.

---

## 10. Acceptance criteria

1. ✅ Hero matches the locked copy block exactly.
2. ✅ §2 title reads "La mente también necesita rutina."
3. ✅ All four claim phrases use the softened wording in this spec.
4. ✅ §7 body uses "Chesscito puede empezar gratis…" — never "Los niños siempre juegan gratis".
5. ✅ §9 lead body uses "pedagogía de un profesor con décadas de experiencia en el aula" — never "metodología real".
6. ✅ Disclaimer renders twice (§5 inline + footer).
7. ✅ All four plan CTAs route to their target (`/hub` or specific mailto subject).
8. ✅ "Construir alianza" subject line is "Aliado / Sponsor".
9. ✅ TypeScript clean, ESLint clean, all unit tests + visual snapshots pass after each commit.
10. ✅ No clinical or absolute claim slips into copy outside the disclaimer.

---

## 11. Out of scope (future work)

- English (`/en`) version of the landing.
- Logos, photos or illustrations of César Alarcón or Wolfcito (placeholder text only in §9 v1).
- Real partner logos in §8 (placeholder "Próximamente").
- Pricing tiers actually wired to a checkout (mailto only in v1).
- Custom illustrated wolf mascot for the hero.
- Stripe / sponsor on-chain donation integration.
- Self-serve sponsor dashboard.
