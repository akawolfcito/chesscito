# MiniPay Readiness — Audit (read-only)

**Fecha:** 2026-06-02
**Scope:** P0/P1 únicamente. Labyrinth Badges en standby.
**Modo:** auditoría sin modificar código.

---

## Diagnóstico por punto

### P0-1 — PageSpeed mobile 54 → 90+

**Hallazgo (de `docs/pagespeed-report-2026-03-23.md`, URL auditada `https://chesscito.vercel.app`):**
- Performance 54, LCP 8.9s, TBT 740ms, FCP 1.1s, CLS 0.
- Unused JS ~197 KiB. Diagnóstico: bundle wagmi/RainbowKit/viem.
- Quick wins ya identificados en el doc: preconnect a `forno.celo.org` + WalletConnect, dynamic imports para wallet/arena, bundle-analyzer, `next/image` para fondos.

**Riesgo:** doc tiene 2+ meses y se midió contra dominio Vercel preview, no `www.chesscito.com`. Hay que re-medir antes de planear fixes.

**Estado:** datos obsoletos. Re-medición es el primer paso real, no la optimización ciega.

---

### P0-2 — Dominio en docs

**Hallazgo:** 21 archivos referencian `chesscito.vercel.app`.

Docs (17):
- `docs/minipay-submission.md` (campos del form, sample tx)
- `docs/network-manifest.md`
- `docs/pagespeed-report-2026-03-23.md` (URL auditada)
- `docs/submission/minipay-form-answers.md`
- `docs/handoffs/2026-05-21-traceability-hygiene-handoff.md`
- `docs/handoffs/2026-05-20-post-domain-migration-addendum-handoff.md`
- `docs/release/2026-05-20-post-domain-migration-addendum-handoff.md`
- `docs/release/2026-05-04-session-close-handoff.md`
- `docs/planning/session-handoff-2026-04-27.md`
- `docs/reviews/red-team-visual-2026-04-21.md`
- `docs/reviews/red-team-2026-04-21.md`
- `docs/superpowers/plans/2026-03-23-minipay-submission.md`
- `docs/superpowers/specs/2026-03-23-minipay-submission-design.md`
- `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md`
- `docs/superpowers/plans/2026-03-13-remotion-promo-video.md`
- `docs/reviews/2026-06-02-celopedia-minipay-listing-checklist.md` (mío)
- `docs/reviews/2026-06-02-celopedia-ecosystem-evaluation.md` (mío)

Código (4):
- `apps/web/.env.template`
- `apps/video/src/scenes/pitch/PitchCTA.tsx`
- `apps/video/src/lib/pitch-copy.ts`
- `apps/video/src/scenes/CtaOutro.tsx`

**Riesgo:** archivos históricos (handoffs viejos, planes 2026-03) son frozen records — no deberían reescribirse. Solo merece reemplazo lo vivo: `docs/minipay-submission.md`, `docs/network-manifest.md`, `docs/submission/minipay-form-answers.md`, `apps/web/.env.template`, los 3 `apps/video/*` si siguen en uso, y los 2 nuevos docs que escribí hoy.

---

### P0-3 — 360×640 layout check

**Hallazgo:** `--app-max-width: 390px` en `globals.css:84`. 14+ referencias hard-coded a 390 en CSS comments + `max-width: var(--app-max-width, 390px)`. No hay fixture Playwright a 360w.

**Riesgo desconocido sin medir:** el max-width 390 NO obliga a romper a 360. El `100%` interno debería colapsar. Pero hay 14+ secciones diseñadas "para 390" que podrían tener paddings/typography no-fluid a 360.

**Estado:** requiere medición Playwright + visual diff, no refactor ciego.

---

### P0-4 — Zero-click connect

**Hallazgo (revisión code paths):**
- `apps/web/src/components/connect-button.tsx:16-22` — si `isMiniPay`, muestra pill estática (no RainbowKit). ✅
- `apps/web/src/components/wallet-provider.tsx:60` — si `isMiniPayEnv() && getInjectedProvider() != null`, auto-conecta. ✅
- `apps/web/src/components/landing/landing-page.tsx:90` — si `isMiniPay`, redirige fuera de landing. ✅
- `apps/web/src/hooks/use-minipay.ts:25` — detecta vía `isMiniPayEnv()`.
- `apps/web/src/lib/minipay.ts:35` — `window.ethereum?.isMiniPay ?? window.provider?.isMiniPay`.

**Veredicto:** lógica zero-click parece correcta. Lo que falta es **runtime validation en device físico** (no se puede auditar desde código).

**Estado:** code-side OK. Verificación de runtime queda pendiente.

---

### P1-5 — `/stats` page mínima

**Hallazgo:**
- Sí existe `/api/profile/stats/route.ts` — pero es **per-address** (recibe `?address=…`), no agregado público.
- No hay `/stats` page pública.
- Telemetría existe (`lib/telemetry.ts`) + 16 eventos `monetization.*` instrumentados → datos están disponibles si hay sink agregador.

**Gap:** falta página read-only sin wallet que exponga DAU/MAU/retention/tx-per-stablecoin/revenue/failed-tx. Necesita decisión: ¿de qué sink se leen? (Supabase queries, Dune dashboard linked, lightweight indexer sobre Blockscout).

**Estado:** decisión de arquitectura antes de implementar.

---

### P1-6 — Payment-token: CELO oculto en MiniPay runtime

**Hallazgo:**
- `apps/web/src/lib/contracts/tokens.ts:13` — comment explícito: "MiniPay never offers CELO — its product spec is stablecoin-only".
- `apps/web/src/lib/contracts/shop-catalog.ts:13-26` — `FOUNDER_BADGE_CELO_ITEM_ID = 5n` con comentario "CELO button stays hidden — same safe-default as itemId 2".
- `apps/web/src/components/exercises/exercises-screen.tsx:995` y `lib/shop/use-shop-sheet-state.ts:288`: ambos hacen `const showCeloOnFounder = !isMiniPay && celoSibling != null;` ✅
- `lib/contracts/select-payment-token.ts` es token-agnóstico (recibe `readonly T[]`) — no filtra CELO; el filtrado vive en consumidores.

**Tests:**
- `__tests__/select-payment-token.test.ts:87` cubre "single-token array (e.g. CELO-only path)" — el helper acepta CELO si se lo pasas.
- `__tests__/tokens.test.ts:21` valida que CELO NO está en `STABLECOIN_ADDRESSES_LOWER` (allowlist Coach verify-purchase).

**Riesgo residual:** el filtro depende de que TODO consumidor del catálogo respete la guarda `!isMiniPay`. Hay 2 puntos hoy (exercises-screen + use-shop-sheet-state) — si hay un 3er consumidor del catalog sin la guarda, CELO se filtra. Hay que grep completo del catalog.

**Estado:** lógica presente, falta auditoría completa de consumidores + 1 test que valide "ningún consumidor expone CELO cuando `isMiniPay === true`".

---

### P1-7 — Ningún `0x…` como identidad primaria

**Hallazgo:**
- `lib/wallet/format.ts` + `lib/profile/display-name.ts` — helpers de truncado y display name (probablemente phone → alias → 0x…abc como fallback). Necesitan inspección.
- `components/profile/profile-banner.tsx` — banner de perfil.
- `components/exercises/leaderboard-sheet.tsx` — leaderboard usa truncado de address.
- `components/trophies/trophy-card.tsx` — trophy card.
- `components/ui/global-status-bar.tsx` — barra de status global.
- `lib/og/og-utils.ts` — OG images (server, no MiniPay-visible).
- `editorial.ts:1643,1691` — menciones de "wallet address" están en Terms/Privacy (contexto legal correcto, NO copy de UI).

**Estado:** la mayoría parece usar `display-name.ts` como mediador. Hay que inspeccionar: ¿muestra phone E.164 vía ODIS? ¿qué fallback usa? ¿hay screens donde el address truncado es la única identidad mostrada?

ODIS no se observó implementado en grep `isMiniPay` ni en `lib/`. **Es posible que la integración phone-first esté ausente** — solo se ven aliases o truncados. Esto sería P1 mayor para MiniPay §1.

**Estado:** requiere inspección profunda de `display-name.ts` + un walkthrough de las 6 surfaces antes de decidir scope.

---

### P1-8 — Copy sweep (jargon prohibido)

**Hallazgo:** grep en `apps/web/src/lib/content/**` por `\bgas\b|onramp|offramp|\bcrypto\b` (case-insensitive) → **0 matches**. ✅

`anti-ai-prose-ceiling` ya bloquea em-dashes en CI. La regla `promise-first-copy` ya evita jargon Web3 en entry surfaces.

**Estado:** parece ya clean en `lib/content`. Falta extender el sweep a:
- `apps/web/src/components/**` (componentes que escriben texto inline — debería ser cero, pero hay que verificar).
- Test fixtures.
- Posibles strings hard-coded en alerts/errors.

---

### P1-9 — Low-balance → MiniPay Add Cash deeplink

**Hallazgo:** grep `add_cash|opera\.com/add` en `apps/web/src` → **0 matches**. ❌

Sí hay manejo de "insufficient" en 18 archivos (error helpers + shop + coach + arena). Pero NINGUNO redirige al deeplink oficial.

**Estado:** gap confirmado. CTA esperado: "Deposit in MiniPay" / "Agregar fondos" → `https://minipay.opera.com/add_cash`. Requiere wire en `lib/errors.ts` o en cada handler tx (`use-mint-victory`, `use-coach-credits-purchase`, `exercises-screen` shop flow).

---

## Resumen ejecutivo

| # | Punto | Estado | Decisión necesaria |
|---|---|---|---|
| P0-1 | PageSpeed | Data 2.5 meses stale | Re-medir prod actual antes de tocar nada |
| P0-2 | Dominio docs | 21 archivos hits — mezcla live/frozen | Decidir qué docs son "live" vs "historical record" |
| P0-3 | 360w layout | No verificado | Necesita fixture Playwright nuevo |
| P0-4 | Zero-click connect | Code OK, runtime no validado | Validación en device físico (manual) |
| P1-5 | /stats page | API per-address sí, agregado no | Decidir sink (Supabase / Dune / indexer) |
| P1-6 | CELO hidden | Lógica presente, audit completo no | 1 test de invariante + grep consumidores |
| P1-7 | Identity primaria | display-name.ts es el mediador — sin auditar | ¿ODIS está implementado? sino, scope mayor |
| P1-8 | Copy sweep | Clean en lib/content — falta extender | Decidir alcance: solo lib/content o todo src |
| P1-9 | Low-balance redirect | Gap confirmado, 0 implementación | Decidir surface: lib/errors central o per-handler |

---

## Propuesta — primer commit

**Comienzo por P0-2 (dominio docs) porque:**
- Bajo riesgo (solo docs vivos + .env.template).
- Reversible.
- Desbloquea P0-1 (PageSpeed contra URL correcta) y eventual envío de submission.
- No depende de runtime, build, ni decisiones de arquitectura.

**Commit propuesto:** `docs(submission): switch app URL from vercel.app preview to www.chesscito.com`

**Archivos a tocar (live records únicamente):**

1. `docs/minipay-submission.md` — campo "App URL", "Support URL", "ToS", "Privacy" → `www.chesscito.com/*`
2. `docs/network-manifest.md` — manifest debe declarar dominio canónico
3. `docs/submission/minipay-form-answers.md` — respuestas del form
4. `apps/web/.env.template` — variable de URL pública (si aplica)

**Archivos que NO toco en este commit (justificación):**

- `docs/handoffs/*` y `docs/release/*` — frozen records de sesiones pasadas; reescribir cambiaría la historia.
- `docs/planning/session-handoff-2026-04-27.md` — frozen record.
- `docs/reviews/red-team-*-2026-04-21.md` — frozen audit context.
- `docs/superpowers/plans/*` y `docs/superpowers/specs/*` — frozen specs.
- `docs/pagespeed-report-2026-03-23.md` — frozen measurement record. Se reemplazará por un NUEVO doc cuando re-midamos (no se edita el viejo).
- `docs/reviews/2026-06-02-celopedia-*` — los míos de hoy, ya están con `www.chesscito.com` o referencian el problema; los reviso por si quedó `chesscito.vercel.app`.
- `apps/video/src/scenes/*` y `apps/video/src/lib/pitch-copy.ts` — separados del web app. Sugiero commit aparte específico a `apps/video` si siguen en uso de pitch, porque pueden tener narrativa pegada al dominio.

**Verificación post-commit:**
- `grep -rn "chesscito.vercel.app" docs/ apps/web/.env.template` → 0 hits en los 4 archivos modificados.
- Re-grep global para confirmar que los hits restantes son frozen records intencionales.
- No corre build ni tests (solo docs + env template no consumido en build).

**Estimado:** 1 commit, ~10 minutos, sin tests.

---

## Plan de commits propuesto (orden ejecución)

| # | Commit | Scope | Verificación |
|---|---|---|---|
| 1 | `docs(submission): switch app URL ...` | 4 archivos live | grep limpio en docs vivos |
| 2 | `docs(submission): refresh apps/video dominio` (si video sigue activo) | 3 archivos video | grep limpio en apps/video |
| 3 | `chore(perf): re-medir PageSpeed mobile vs prod actual` | Nuevo doc `docs/pagespeed-report-2026-06-02.md` | Lighthouse run, sin code change |
| 4 | (decisión) si <90 → cluster perf optimizations | TBD por nro 3 | TBD |
| 5 | `test(e2e): add 360x640 viewport fixture` | nuevo fixture Playwright | run visual, identifica breakpoints |
| 6 | (decisión) si VR rompe → fix de layouts a 360 | TBD por nro 5 | TBD |
| 7 | Validación zero-click manual en device | (sin commit, doc en handoff) | runbook |
| 8 | `test(catalog): add invariant — no CELO surfaces when isMiniPay` | tokens.ts test + audit consumidores | tests verdes |
| 9 | `chore(copy): extend jargon sweep a components` | grep + fixes si hay hits | tests + lint |
| 10 | `feat(errors): low-balance redirect a MiniPay Add Cash` | `lib/errors.ts` + CTA en surfaces | unit test + manual |
| 11 | `feat(identity): audit/refactor primary identity surfaces` (puede partirse) | display-name.ts + 6 surfaces | tests + VR |
| 12 | `feat(stats): /stats page MVP` | nueva route + lectura sink | unit + manual |

---

## Pregunta para desbloquear el primer commit

¿Confirmas que el dominio canónico es **`www.chesscito.com`** (no `chesscito.com` apex)? Per `share-previews` rule MEMORY: apex 307s a www → quiero usar `www` directo en todos los campos de submission para evitar redirect-in-WebView. Si confirmas, procedo con el commit 1.
