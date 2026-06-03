# Integration Audit — Labyrinth Standby + MiniPay Readiness Local Commits

**Fecha:** 2026-06-03
**Modo:** read-only. No se ejecuta rebase, merge ni push.
**Pregunta a responder:** ¿cómo integramos `f412cbe5`, `acc90b41`, `51a553e2` con `origin/main` sin perder el trabajo Labyrinth Phase D que ya está allí?

## TL;DR — **No hay divergencia.** Mi local main es lineal sobre `origin/main`. Push es fast-forward, sin rebase, sin merge, sin riesgo a Labyrinth.

Mi mensaje anterior usó la palabra "diverged" erróneamente. La realidad: **3 commits ahead / 0 behind**. Labyrinth está intacto debajo de mis 3 commits MiniPay.

---

## 1. Graph

```
* 51a553e2 (HEAD -> main)        perf(i18n): serve default locale from root paths
* acc90b41                       chore(perf): re-measure PageSpeed mobile + desktop vs www.chesscito.com
* f412cbe5                       docs(submission): switch canonical app URL from vercel.app preview to www.chesscito.com
* 81a8f2df (origin/main, origin/HEAD)  docs(handoff): labyrinth v0.2 phase D.1 sepolia checkpoint
* 5f335d74                       chore(config): document LabyrinthBadges address env var
* ac149a1e                       feat(api): wire sign-labyrinth to LabyrinthBadges address
* ac6e9ae1                       docs(deploy): record LabyrinthBadges Sepolia deployment
* 434e30df                       chore(contracts): add LabyrinthBadges Sepolia smoke script
* 77eba35a                       chore(contracts): add LabyrinthBadges Sepolia deploy script
... (más historia común)
* 5bcdd5ac (origin/production, production)  feat(landing): adopt v0.6 beginners-first narrative
```

**Línea recta** — sin bifurcaciones. Mis 3 commits están literalmente apilados encima del tip de `origin/main`.

Métricas confirmatorias:
- `git rev-list --left-right --count HEAD...origin/main` → **`3 0`** (3 ahead, 0 behind).
- `git merge-base HEAD origin/main` → `81a8f2df` (= tip de `origin/main`).
- `git merge-base --is-ancestor 77eba35a HEAD` → YES.
- `git log HEAD..origin/main` → empty (no hay nada en origin/main que no tenga local).

## 2. Archivos tocados por los 5 commits Labyrinth (`77eba35a..origin/main`)

```
apps/contracts/.env.example
apps/contracts/scripts/smoke-labyrinth-badges.ts
apps/web/.env.template
apps/web/src/app/api/sign-badge/__tests__/route.test.ts
apps/web/src/app/api/sign-labyrinth/__tests__/route.test.ts
apps/web/src/app/api/sign-labyrinth/route.ts
apps/web/src/app/api/sign-score/__tests__/route.test.ts
apps/web/src/app/api/sign-victory/__tests__/route.test.ts
apps/web/src/lib/server/demo-signing.ts
docs/contracts.md
docs/handoffs/2026-06-02-labyrinth-v0.2-phase-d1-handoff.md
```

Total: 11 archivos. Todos relacionados al wire-up de `LabyrinthBadges` Sepolia (deploy script, smoke test, env var, signing route, handoff doc).

## 3. Archivos tocados SÓLO por mis 3 commits MiniPay (`origin/main..HEAD`)

```
apps/web/.env.template
apps/web/src/app/[locale]/layout.tsx
apps/web/src/app/sitemap.ts
apps/web/src/i18n/routing.ts
apps/web/src/middleware.ts
docs/minipay-submission.md
docs/network-manifest.md
docs/pagespeed-report-2026-06-02.md
docs/submission/minipay-form-answers.md
```

Total: 9 archivos. Routing i18n + sitemap + layout metadata + docs de submission/perf/network.

## 4. Conflictos reales

**Intersección directa de archivos:** `apps/web/.env.template`.

Es el único archivo tocado por ambos sets. Verificado vía `git log --stat`:

- **Labyrinth (`5f335d74`)** agregó dos líneas debajo de `NEXT_PUBLIC_BADGES_ADDRESS`: `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS=0x0…` + un nuevo bloque para deploy scripts.
- **MiniPay (`f412cbe5`)** actualizó UN comentario de ejemplo del `NEXT_PUBLIC_APP_URL` (línea 31): `vercel.app` → `www.chesscito.com`.

Las líneas son disjuntas. Más importante: **mi commit `f412cbe5` ya está autoreado encima de `5f335d74` en mi historia local**, así que la fusión ya ocurrió y el HEAD actual contiene ambos cambios coexistiendo. No hay conflicto pendiente.

Para los otros 10 archivos de Labyrinth: mis commits **NO los tocan**. Verificado:
```
git diff --name-only origin/main..HEAD -- 'apps/contracts/'           → empty
git diff --name-only origin/main..HEAD -- 'apps/web/src/lib/server/'  → empty
git diff --name-only origin/main..HEAD -- 'apps/web/src/app/api/sign-labyrinth/' → empty
```

Confirmado: **Labyrinth está intacto en mi HEAD**. No fue tocado, sobrescrito, revertido ni modificado.

## 5. ¿El rebase de mis commits sobre `origin/main` es seguro?

**N/A — no se necesita rebase.** Mi `main` local ya está rebased encima de `origin/main` por construcción. Cuando hice mi primer commit (`f412cbe5`), estaba en un HEAD que ya incluía los 5 commits Labyrinth. Por eso `merge-base` apunta directamente al tip de `origin/main`.

## 6. Rebase vs merge

**Ninguno.** El operador correcto es:

```bash
git push origin main
```

Este push es un **fast-forward**: avanza el puntero `origin/main` de `81a8f2df` a `51a553e2` sin reescribir historia. Cero riesgo a Labyrinth, cero fuerza, cero merge commit.

Si por alguna razón en el momento del push hay un nuevo commit en `origin/main` (alguien push paralelo), el push fallará con `non-fast-forward` y entonces sí discutimos `pull --rebase` con tu confirmación.

## 7. Plan exacto para reconciliar sin perder Labyrinth

### Caso A — origin/main no ha avanzado desde el merge-base actual

```bash
# 1. Fetch para confirmar que origin/main sigue en 81a8f2df.
git fetch origin

# 2. Re-verificar el estado.
git rev-list --left-right --count HEAD...origin/main
# Esperado: "3       0"

# 3. Push fast-forward.
git push origin main
```

Después del push: `origin/main` queda en `51a553e2`, conteniendo a Labyrinth Phase D.1 + las 3 mejoras MiniPay readiness. Labyrinth intacto.

### Caso B — origin/main avanzó (algún commit nuevo no esperado)

```bash
# 1. Fetch + revisar qué llegó.
git fetch origin
git log HEAD..origin/main --oneline   # ver los nuevos commits remotos

# 2. STOP. Mostrarme la salida antes de avanzar.
# Decisión: rebase, merge o pivote, según naturaleza del nuevo trabajo.
```

No ejecutar nada en caso B sin tu confirmación.

## 8. Riesgos de deploy

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Push falla por `non-fast-forward` (caso B) | Baja | Bajo (recupera contexto, no destruye) | El fetch + log de §7 detecta y para |
| R2 | Push exitoso pero CI rompe por interacción i18n + labyrinth (improbable) | Muy baja | Medio | Vercel preview deploy es la siguiente línea de defensa; revisar antes de promote a producción |
| R3 | Production promote dispara antes de que estemos listos | Baja | Medio | `origin/production` está manualmente promovida vía `docs/release/release-process.md` — no auto-promueve desde main |
| R4 | Deploy de mainnet contracts disparado por error | Nula | Alto | Mis commits no tocan `apps/contracts/`. Verificado en §4 |
| R5 | Labyrinth Sepolia smoke tests rompen por cambios i18n | Nula | Bajo | Smoke tests de contracts viven en `apps/contracts/scripts/`; no dependen del routing web |
| R6 | Mis cambios i18n rompen el flow MiniPay UA detection del landing | Baja | Alto si pasa | El UA detection ocurre en `[locale]/page.tsx:34` (server-side), independiente del `localePrefix`. La auditoría `docs/reviews/2026-06-02-i18n-redirect-audit.md` lo confirmó |
| R7 | Sitemap nuevo (EN unprefixed) confunde Google y des-indexa pages mientras re-crawla | Media | Bajo (tráfico SEO chico) | Submission de sitemap a Search Console post-push acelera re-index |

**Sin riesgos para Labyrinth.** El trabajo Phase D.1 preserva su estado exactamente como está en `origin/main` hoy.

## 9. Comandos propuestos (no ejecutados aún)

**Re-verificación previa al push (1 comando, ~3 s):**
```bash
git fetch origin && git rev-list --left-right --count HEAD...origin/main
# Esperar exactamente: "3<TAB>0"
```

**Push (1 comando, ~5 s):**
```bash
git push origin main
```

**Verificación post-push (1 comando, ~2 s):**
```bash
git log origin/main -3 --oneline
# Esperar:
#   51a553e2 perf(i18n): ...
#   acc90b41 chore(perf): ...
#   f412cbe5 docs(submission): ...
```

**NO incluido en este plan** (decisión separada):
- `git push origin production` para promover a producción → eso es la siguiente fase, después de validar el runbook en preview.
- Revisión del runbook de validación: `docs/runbooks/2026-06-02-i18n-post-deploy-verification.md`.

## 10. Espero confirmación

¿Procedo a ejecutar la secuencia de §9 (fetch + push fast-forward), o querés:

- (a) Inspeccionar primero un archivo específico antes del push,
- (b) Esperar a tener más commits del backlog MiniPay readiness en una sola tanda,
- (c) Algún otro pre-check.

Sugerencia de defaults para (b): tengo el commit `chore(docs): add MiniPay readiness review + runbook + audit docs` listo para sacar de untracked → committed con los 6 markdowns que escribí esta sesión (`celopedia-ecosystem-evaluation`, `celopedia-minipay-listing-checklist`, `minipay-readiness-audit`, `commit-1-domain-switch-proposal`, `i18n-redirect-audit`, `i18n-post-deploy-verification` runbook, este mismo doc). Push agrupado tendría 4 commits ahead vs `origin/main`, todos doc-only excepto los 3 ya commiteados. Pero es decisión tuya — si preferís push minimal ahora, el plan en §9 es suficiente.

---

## Apéndice — corrección de mi framing anterior

En el turno previo dije: *"local main y origin/main están diverged"* y usé eso como argumento para escribir el runbook §Appendix A. Eso es **incorrecto**.

Lo que pasó: cuando consulté `git log origin/main -5 --oneline` al principio, vi los 5 commits Labyrinth en el tope y los confundí con "commits nuevos no pulled" cuando en realidad ya eran ancestros de mi HEAD. El hash de session start `77eba35a` que aparecía en el contexto inicial era el tope al momento de iniciar la sesión, pero el repo ya tenía pulled hasta `81a8f2df` antes de mi primer commit (que se hizo encima).

La Appendix A del runbook (`docs/runbooks/2026-06-02-i18n-post-deploy-verification.md`) **necesita corrección** cuando aprueben el push: el bullet sobre "Local `main` and `origin/main` must reconcile (rebase or merge)" debe reemplazarse por "fast-forward push es suficiente". Lo hacemos en el mismo commit del push o en un follow-up; tu decisión.

---

## Apéndice 2 — Findings parciales del audit 360×640 (pausado)

Pre-pivot, alcancé a recolectar señales del audit 360×640 que el user pidió antes de este interrupt. Las guardo aquí para no perderlas:

- **Playwright `minipay` project:** viewport actual = `390 × 844` (Pixel 5 base + custom height) en `apps/web/playwright.config.ts:29`. Sin fixture a 360w.
- **`globals.css:84`**: `--app-max-width: 390px` (token central).
- **`globals.css:8637`**: `.wood-banner-large { width: 360px; height: 80px; }` — fijo. Llenará el viewport edge-to-edge a 360w; sin overflow horizontal pero sin padding lateral tampoco.
- **`globals.css:7545`**: `@media (max-width: 370px)` con ajustes a `hub-v2-root` (padding-inline 10px) y `hub-v2-stage-grid`. **El equipo YA tiene un breakpoint narrow** — sólo cubre el hub redesign, no resto de surfaces.
- **`globals.css:10115`**: `width: var(--app-max-width, 390px)` en `.desktop-app-frame`. Es para desktop frame, no aplica a mobile <390.
- **min-width altos en componentes:** `1793: 260px`, `7140: 220px`, `884/1110: 168px`. Si esos elementos viven dentro de la columna 390px (que a 360 colapsa a 360), pueden empujar overflow horizontal local — depende del padding.
- **Body/html ya tiene `overflow-x: hidden` (líneas 468, 484)** y la app shell tiene `overflow-x: clip` (línea 544). Eso previene SCROLL horizontal global, pero NO previene clipping visual de elementos que excedan.

Conclusión preliminar: el risk a 360w es **bajo a moderado**. Hay overflow-hidden global protegiendo de scroll roto, hay un breakpoint `<370px` ya empezado para hub-v2 (incompleto), y un único elemento fijo a 360 (wood-banner) que casualmente coincide con el viewport. Vale la pena agregar fixture Playwright a 360×640 + screenshots de las surfaces principales para detectar regresiones visuales reales.

Esto se vuelve un **commit posterior al push** cuando retomemos el backlog MiniPay readiness.
