# Handoff — P4 CSS split SHIPPED TO PROD (2026-06-12, sesión 2)

## Resume entry point

> **On "continuemos": P4 YA está en prod.** Paso 0 = **PSI oficial 3 rutas**
> (hub/arena/exercises) en pagespeed.web.dev para medir el delta vs baseline
> (hub 87 / arena 86 / exercises 81) — la cuota de la API PSI se agotó el 2026-06-12,
> correrla cuando resetee o pedir al founder. Paso 1 = **registrar los "detalles de
> flujo a pulir"** que el founder vio en el smoke de preview (PENDIENTE de detallar —
> ver §Open questions). Luego elegir siguiente lever (ver §Next levers).

## State

- `production` = `main` = `83e4f6c7` (P4 CSS split SHIPPED). Era `05bb1a5a` (P2).
- FF promote limpio (production era ancestro de main); 5 commits promovidos.
- Prod deploy `chesscito-aoqy1lj01` Ready; **www smoke PASSED**: cada ruta sirve
  core + su CSS de superficie, ninguna arrastra las otras 3; landing solo core.
- Founder validó preview `preview.chesscito.com` en device: "se ve bastante bien",
  detalles menores que atribuye a flujos (no al split) — pendientes de detallar.
- Branch `feat/p4-css-split` mergeada FF y borrada.

## What shipped (2 commits)

- `d535d212` perf(css): 445 bloques (~103KB raw) extraídos de la región plana de
  globals.css (post-`@layer components`) a `src/styles/{arena,hub,coach,exercises}.css`,
  cargados via route layouts (coach + exercises layouts creados; dev/layout carga todo
  para fixtures VR). Clasificación por grafo de imports transitivo: un bloque se mueve
  solo si TODAS sus clases son consumidas exclusivamente por archivos alcanzables desde
  un único route segment (classNames template-built resueltos por prefix match).
- `8d8b2d15` docs: análisis + resultados + chunk 3620 + regla de estilos en CLAUDE.md.

Tooling del split en `/tmp/css-split/` (parse-blocks / classify / emit) — no commiteado,
reproducible desde el audit doc.

## Validation

- Suite **3669/3669** · VR **49/49 no-refresh** · arena-flow E2E 8/8 · tsc clean.
- Integridad línea-a-línea verificada + **cero selectores duplicados cross-file**.
- Preview smoke: cada ruta carga exactamente core + su CSS de superficie; landing solo core.
- LH local en preview /hub: **render-blocking 510→330ms**, CSS blocking 46.6→37.5KB,
  unused CSS 40→32.9KB. (Score/LCP de preview no comparables al oficial de prod.)

## Results

- CSS gz por ruta: core 35.8KB + hub 4.4 / arena 3.4 / coach 3.3 / exercises 2.5
  → **−14-18% CSS transfer por ruta** (cada una deja de cargar las otras 3 superficies).
- Baseline oficial post-P2 registrado (founder, 2026-06-12): **/hub 87 · /arena 86
  (+9 vs P1) · /exercises 81**. El post-P4 se mide tras promote.

## Decisions (no re-litigar)

- **Fase 2b (región @layer 553–4172) RECHAZADA con números**: solo ~22.5KB raw
  extraíbles (~1KB gz/ruta) vs riesgo real de reposicionar reglas después de utilities
  (flip de conflictos a igual especificidad). Audit §Results.
- **Chunk 3620 IDENTIFICADO = wagmi/viem core** (75.3KB gz / 208KB parsed; viem 33 +
  wagmi 22.8 + noble 9.8 + abitype 5.9 + ox 3). No removible; único lever futuro =
  lazy-load del wagmi provider hasta primer wallet intent — arquitectural, spec propia.
- **Nada borrado**: `.dock-treat-*` parecía muerto pero su familia hermana
  `.badge-treat-*` se construye dinámicamente — dead-CSS pass requiere tooling
  consciente de template classNames; diferido.
- Regla nueva en CLAUDE.md: clase nueva → archivo de superficie solo si NINGUNA otra
  ruta la consume; en duda → globals.css.

## Next levers (en orden de valor)

1. **PSI oficial 3 rutas** post-promote (paso 0 arriba) + registrar detalles de flujo.
2. Responsive images portal/avatar (~31KB): re-check `sizes`/`srcset` una vez antes de
   cerrar permanente (prior triage dijo DPR false-positive).
3. Lazy wagmi provider (chunk 3620, 42KB unused en first load): spec propia si los
   scores piden más JS wins.
4. /exercises **A11y 83** (otras rutas 93-94): triage corto, posible quick win.

## Post-promote QA (founder smoke en prod, 2026-06-12 sesión 2)

Founder reportó 5 cosas tras el promote. Triaje por causa (no por síntoma):

1. **Borde azul-gris arriba de la CHESSCITO-PRO sheet** — NO es del split.
   Preexistente: el variant `side="bottom"` de `ui/sheet.tsx:59` aplica `border-t`
   con el token `--border` (210 24% 90%, gris-azulado, en globals core, siempre
   cargado); el `border-0` de la pro-sheet no lo suprime porque tailwind-merge trata
   `border-0` y `border-t` como grupos distintos. **FIXED**: `border-t-0` en
   `pro-sheet.tsx`. (Misma raíz afecta a cualquier bottom-sheet de fondo transparente;
   solo la PRO lo exponía.)
2. **Botón morado "why did you win?" no dispara análisis + lleva a MATCH REVIEW + no
   muestra icono SAVE/SHARE cuando ya está saved** — NO es del split (el commit
   `d535d212` no tocó NINGÚN .tsx de lógica, solo CSS + layouts-import + tests).
   Bug de FLUJO preexistente en el end-state coach/arena. **CARRIL APARTE — pendiente**:
   founder debe indicar desde qué pantalla exacta dio al morado (popup fin de partida
   en /arena vs visor /coach) para cazarlo. El morado debería disparar el mismo
   análisis que el SAVE VICTORY del MATCH REVIEW.
3. **/exercises A11y 83** (resto 93-94) — backlog, no del split.
4. **Performance PSI post-promote** (un run c/u, alta varianza ±5-10):
   /exercises 86 (+5 vs baseline 81), /arena 77 (−9), /hub 80 (−7), landing 94.
   Veredicto: **inconcluso, mayormente varianza** — si el split degradara por diseño,
   /exercises también bajaría (tiene CSS de superficie extra) pero SUBIÓ. Señal real a
   vigilar: founder vio el filmstrip del hub pasar de ~2 a ~6 frames blancos (posible
   +1 request render-blocking en Slow 4G: antes 2 stylesheets, ahora 3).
5. **"Ingreso tarda más"** — subjetivo, sin medir; consistente con (4).

## Conclusión estratégica: el split NO fue la palanca de las métricas

PSI hub treemap/insights post-promote: **LCP 4.9s (rojo), render-blocking 550ms
(insight #1), unused CSS 32KB, unused JS 42KB (chunk 3620 wagmi/viem), legacy JS 12KB,
images 31KB**. El split repartió las hojas pero el CORE sigue siendo render-blocking y
grande → el lever real quedó casi intacto.

**"¿Pasar a TailwindCSS?" (founder) — NO mueve la aguja.** El CSS de Tailwind sigue
siendo UN stylesheet render-blocking; muchas clases custom (paneles con `image-set`
backgrounds, marcos, animaciones, gradientes) no se expresan como utilidades → conversión
masiva, bajo retorno; y el unused 32KB es del CSS custom, no de Tailwind (que ya purga).

**Palancas reales, en orden (próxima sesión de perf):**
1. **Render-blocking 550ms → critical-CSS inline** (`experimental.optimizeCss`/critters):
   inline el above-the-fold, defer el resto. Ataca LCP 4.9s directo. (Antes lo rechacé
   por "no reduce payload", pero el insight #1 ahora es render-blocking, no payload.)
2. **Unused CSS 32KB** → purga del custom no usado en el core.
3. **Chunk 3620 wagmi (42KB unused JS)** → lazy-load del wagmi provider hasta primer
   wallet intent (spec propia).
4. **Legacy JS 12KB** (browserslist) + **images 31KB** (responsive srcset).

## Backlog explícito (founder, no olvidar)

- **Sally (UX designer / bmad-agent-ux-designer)** para afinar el front del arena: que se
  sienta que jugás contra una PERSONA, no contra un bot. SOLO después de cerrar el cluster
  de performance/QA actual (founder lo condicionó así).

## Open questions

- Founder: ¿device smoke MiniPay del preview antes del promote? (riesgo residual del
  split es visual, no funcional)
- MiniPay Stage-2 form: packet completo, founder debe enviarlo.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` en Vercel: founder decidió dejarla (2026-06-12).
