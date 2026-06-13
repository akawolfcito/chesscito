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

## Open questions

- Founder: ¿device smoke MiniPay del preview antes del promote? (riesgo residual del
  split es visual, no funcional)
- MiniPay Stage-2 form: packet completo, founder debe enviarlo.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` en Vercel: founder decidió dejarla (2026-06-12).
