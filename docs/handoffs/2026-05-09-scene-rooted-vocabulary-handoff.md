# Session Handoff — 2026-05-09 (Scene-Rooted UI Vocabulary spec ready)

**Continúa de**: `2026-05-09-m3-shipped-handoff.md` (M3 first migration shipped earlier 2026-05-09).
**Sesión**: M3 closeout + M3.5 spec (Scene-Rooted UI Vocabulary, Sally UX consultation, red-team verdict READY).
**Status**: docs only — spec + red-team + closeout audit + handoff. **No code changes.** Implementation deferred to next session.

## Lo que cerró esta sesión

### M3 cerrado por audit estructural

El backlog M3 original (4 candidatos: `mini-arena-bridge-slot`, `coach-welcome`, `daily-tactic-card`, `coach-paywall`) fue **rechazado** tras audit estructural. Los 4 son CTAs pressable; CandyCard es presentacional por contrato (§15). Mismatch fundamental.

M3 final scope = `welcome-overlay.tsx` solo. Commits `48b339b..1bcc006` ya en `origin/main`.

Detalle en `docs/audits/2026-05-09-m3-closeout-audit.md`.

### M3.5 spec'd con red-team

Pivot a un **vocabulario diegético de 5 primitivos sibling** anclados en assets de escenario que ya existían en `design/new-assets-chesscito/` pero el código nunca consumía. Sally consultation reveló este gap.

5 primitivos:
- `<StonePedestal>` — round tap target sobre piedra (2 surfaces backlog)
- `<TreasureTile>` — cofre con icon-stack (paywall packs)
- `<PrincipalButton>` — primary CTAs ("Play", "Save my Moment") con `principalbutton.png`
- `<WoodBanner>` — listón presentacional, 3 sizes
- `<GemBadge>` + `<GemButton>` — métric pills (split por red-team)

**Verdict del red-team: READY** (4 P0 fixed inline en spec v1.0; 7 P1 decisiones lockeadas; 5 P2 documentados).

### Decisiones clave

- **Asset Versioning Policy**: assets actuales son working drafts, swappable vía CSS-var `--{primitive-kebab}-bg-{variant}` sin cambio de contrato. Tests assert sobre `data-component`/`data-variant`, no sobre filenames.
- **Press feedback obligatorio**: scale(0.96) + box-shadow lift; bajo `prefers-reduced-motion` → border-color flash 200ms (nunca silencio total).
- **Loading + disabled**: loading visual gana; click suppressed por cualquiera.
- **Disabled = `<button disabled>`**: NO polymorphic a `<div>` (a11y requirement).
- **`action-pin tone="claim"` migra via composición**: action-pin internamente renderiza `<PrincipalButton>` cuando `tone="claim"`. Preserva todos los call sites.
- **Trophy state diferido**: el "completed daily-tactic" debe sentir orgullo (no muerto), pero v1 ships disabled-as-disabled. Future spec añade `<StonePedestal variant="trophy">` ligado a "Mint your Moment" feature.
- **Ribbon enum lockeado**: `<TreasureTile ribbon>` solo acepta `"BEST" | "NEW" | "SALE"`. Arbitrario `ReactNode` rechazado.
- **GemPill split**: `<GemBadge>` (presentacional) + `<GemButton>` (pressable) — 2 primitivos explícitos, no dual-mode.

### Assets nuevos generados por usuario

| Asset | Path |
|---|---|
| Wood banner blank short/medium/large | `design/new-assets-chesscito/wood-banner-blank-{short,medium,large}.png` |
| Treasure chest small/large | `design/new-assets-chesscito/treasure-chest-{small,large}.png` |
| Gem pill base | `design/new-assets-chesscito/gem-pill-base.png` |

Total nuevos: 6 archivos. Pre-existentes relevantes: 10 piedras + principalbutton.png.

## Estado del repo

- **Branch**: `main`
- **Working tree**: clean tras commits doc (4 commits granulares: audit, spec, red-team, memory+handoff).
- **Tests**: 1160/1160 passing (sin cambios de código en sesión).
- **Build**: passing.
- **Pendiente push**: 4 commits ahead de `origin/main` al cierre de esta sesión.

## Lo que queda por decidir

**Inmediato**: ¿push de los 4 commits a `origin/main`? No es destructivo — son docs únicamente. No dispara cambios de UI ni redeploys de comportamiento.

**Próxima sesión**: arrancar implementación TDD de los primitivos.

## Cómo arrancar la próxima sesión

### Agente recomendado

Claude Code default. El spec lockea contratos, slots, asset paths, performance budgets. El red-team documentó decisiones. Implementación es ejercicio mecánico: TDD por primitivo, con red phase clara.

### Checklist pre-sesión

- [ ] Decidir push de los 4 commits doc.
- [ ] `git pull` si hay cambios upstream.
- [ ] Reset opcional del contexto Claude Code para arrancar limpio.
- [ ] Verificar que assets en `design/new-assets-chesscito/` siguen presentes (no se borraron).

### Prompt para pegar al inicio

```
Continúo el trabajo de Chesscito. M3 cerrado 2026-05-09 (welcome-overlay
único migrado). M3.5 spec'd con red-team verdict READY:

  docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-design.md
  docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-redteam.md

5 primitivos diegéticos a implementar:
  <StonePedestal>, <TreasureTile>, <PrincipalButton>, <WoodBanner>,
  <GemBadge> + <GemButton>

Próximo paso: TDD implementation siguiendo el orden del red-team:
  1. StonePedestal (highest reuse)
  2. TreasureTile (paywall blocker)
  3. PrincipalButton
  4. WoodBanner (spec-doc only o minimal — no v1 migration target)
  5. GemBadge + GemButton (spec-doc only o minimal)

Pre-requisitos antes de TDD:
  - Copiar assets de design/new-assets-chesscito/ a apps/web/public/art/scene-rooted/
  - Verificar tamaño de cada asset vs. budget (spec §"Asset performance budget")
  - Añadir CSS vars a apps/web/src/app/globals.css

Patrón TDD por primitivo:
  - Red phase test (renders, slot composition, press class, disabled, aria-label)
  - Green implementation
  - Manual screenshot baseline en apps/web/e2e/screenshots/scene-rooted/
  - Commit granular por primitivo

Halt antes de cualquier migración de surface. Await mi confirmación
para arrancar el canary (daily-tactic-card compact path → StonePedestal).

Antes de arrancar, lee:
  - Closeout audit: docs/audits/2026-05-09-m3-closeout-audit.md
  - Spec: docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-design.md
  - Red-team: docs/superpowers/specs/2026-05-09-scene-rooted-ui-vocabulary-redteam.md
  - Este handoff: docs/handoffs/2026-05-09-scene-rooted-vocabulary-handoff.md

Presenta plan TDD por primitivo y pide confirmación antes del primer test.
```

## Notas

- **Sally UX consultation funcionó**. La pregunta táctica original (`<CandyButton>` con variantes `pin|banner|tile`) era estructural-correcta pero conceptualmente plana. Sally re-encuadró a "diegetic vocabulary rooted in scene assets". Resultado: 5 primitivos con identidad propia en lugar de 1 con 4 modos.
- **Asset gap descubierto este session**: `design/new-assets-chesscito/` lleva existiendo, pero las migraciones M1/M2/M3 no lo conocieron. Por eso el play-hub se siente "limpio pero anónimo". Esta sesión cierra el gap a nivel spec; implementación los lleva al código.
- **"Mint your Moment" capturado como feature near-future**. Daily-tactic completed state + share imagen + on-chain TX para preservar el momento. Conecta con el patrón VictoryNFT existente (Arena win → mint), extendiéndolo a daily-tactic + posiciones brillantes en partida arbitraria. Out of scope este sprint, pero en el radar — y `<PrincipalButton>` ya tiene listo el slot "Save my Moment".
- **Leaderboard Royal Match-style** mostrado por usuario como destino de polish futuro. NO presionado este sprint. Filosofía del usuario: completar el flow primero, polir surface por surface después.
- `feedback_plan_before_edit.md` cumplido: 5 confirmaciones explícitas durante la sesión (pivot ruta 1, naming `<CandyButton>` → `<StonePedestal>` etc., assets P0, dirección diegetic completa, cierre).
- `feedback_execution_initiative.md` cumplido: globs/reads de auditoría sin pedir cada vez; user input solo en decisiones estratégicas.

---

**TL;DR**: M3 cerrado con 1 surface migrado. M3.5 spec + red-team listos para 5-primitivo diegetic vocabulary (stone/treasure/principal/wood/gem). Próxima sesión = TDD impl. PUSH PENDIENTE — confirmar antes de empujar 4 commits doc.
