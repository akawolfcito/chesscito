# Handoff — MiniPay Readiness Session (2026-06-03)

**Session window:** 2026-06-02 → 2026-06-03
**Branch state at handoff:** `main` ahead of `production` by 2 doc/test-only commits — promote deferred to next batch.

---

## Commits cerrados (12 total esta sesión)

In chronological order on `main`:

| Hash | Type | Title | Production? |
|---|---|---|---|
| `f412cbe5` | docs | `docs(submission): switch canonical app URL from vercel.app preview to www.chesscito.com` | ✅ Live |
| `acc90b41` | chore | `chore(perf): re-measure PageSpeed mobile + desktop against www.chesscito.com` | ✅ Live |
| `51a553e2` | perf | `perf(i18n): serve default locale from root paths` | ✅ Live (eliminó 3553ms mobile / 10935ms desktop de redirect) |
| `c99b0a34` | docs | `docs(minipay): add readiness audits and post-deploy runbook` | ✅ Live |
| `ff9fb307` | chore | `chore(perf): record post-deploy PageSpeed after i18n redirect fix` | ✅ Live |
| `8da38794` | test | `test(minipay): add 360x640 viewport coverage` | ✅ Live |
| `6557ed8c` | feat | `feat(minipay): add AddCashCta helper component for low-balance recovery` | ✅ Live |
| `2dfa0820` | feat | `feat(arena): surface AddCashCta on Victory mint insufficient-funds error` | ✅ Live |
| `cacd02c0` | feat | `feat(shop): surface AddCashCta on shop purchase insufficient-funds errors` | ✅ Live |
| `363890b9` | feat | `feat(coach): surface credits purchase errors with AddCashCta in CoachPaywall` | ✅ Live (último production promote) |
| `28ee59c5` | docs | `docs(reviews): record copy sweep extended audit closing P1-8` | ⏳ Pending promote |
| `b1f36bf3` | test | `test(pro): assert PRO never selects CELO and record P1-6 audit` | ⏳ Pending promote |

---

## Estado branches

- **`origin/main`**: `b1f36bf3`.
- **`origin/production`**: `363890b9` (último promote 2026-06-03 ~02:20 UTC).
- **Diff main → production**: 2 commits ahead, 0 behind. Ambos son doc/test-only — sin user-facing impact.
- **Próximo promote**: diferido a batch cuando haya code-level cambios listos (p.ej. al cerrar P0-1 perf cluster).
- **Promote command** (cuando aplique):
  ```bash
  git checkout production
  git pull --ff-only origin production
  git merge --ff-only main
  git push origin production
  git checkout main
  ```

---

## MiniPay readiness — estado por punto

| # | Punto | Estado | Cerrado por |
|---|---|---|---|
| P0-1 | PageSpeed 90+ mobile | 🟡 72 mobile / 95 desktop (gap 18 puntos mobile) | Parcial — i18n redirect kill eliminó el lever más grande; bundle/CSS work pendiente |
| P0-2 | Dominio canónico `www.chesscito.com` | ✅ Live | `f412cbe5` + commits siguientes |
| P0-3 | 360×640 viewport coverage | ✅ Live | `8da38794` + audit `docs/reviews/2026-06-03-viewport-360x640-audit.md` |
| P0-4 | Zero-click connect runtime | ⏳ Requiere device físico MiniPay | Code OK; falta validación runtime |
| P1-5 | `/stats` page MVP | ❌ Sin empezar | — |
| P1-6 | CELO oculto MiniPay | ✅ Cerrado | `b1f36bf3` audit + test strengthening |
| P1-7 | Identity ODIS phone-first | ❌ Scope mayor | — |
| P1-8 | Copy sweep extended a components | ✅ Cerrado | `28ee59c5` audit (no-patch) |
| P1-9 | Low-balance → Add Cash deeplink | ✅ Live en 3 surfaces (mint/shop/coach) | `6557ed8c` + `2dfa0820` + `cacd02c0` + `363890b9` |

**5 de 9 cerrados.** Cluster completo de P1-9 (3 surfaces pagas) + P0-2 + P0-3 + P1-6 + P1-8.

---

## Métricas headline

### PageSpeed (production)

| URL | Mobile perf | Desktop perf | Notas |
|---|---|---|---|
| `https://www.chesscito.com/` | null (LH trace bug en landing) | null | FCP 1.5s mobile / 0.8s desktop OK; LCP no detectable |
| `https://www.chesscito.com/hub` | **72** ⭐ (was 53) | **95** ⭐ (was 55) | Gap a target 90+ mobile = 18 puntos |
| `https://www.chesscito.com/en/hub` (legacy) | 73 | — | Back-compat con 1-hop 307 |

**Lever applied this session:** `perf(i18n)` eliminó el redirect 307 → `/en` (3553ms mobile / 10935ms desktop savings per Lighthouse `redirects` audit).

**Top remaining opportunities at `/en/hub` mobile** (informa P0-1 plan):
- `unused-javascript`: 550ms / 110 KiB (wagmi/RainbowKit chunks).
- `render-blocking-resources`: 290ms.
- `unused-css-rules`: 220ms / 39 KiB.
- `modern-image-formats` + `legacy-javascript`: ~100ms combined.

### Test baseline

Vitest: **2459/2459 passing** al inicio de sesión. Cada commit verificado individualmente; no regresiones introducidas. Nuevos tests agregados:
- AddCashCta: 6 cases.
- VictoryClaimError P1-9: 2 cases (8 totales).
- ResultOverlay P1-9: 5 cases (nuevo file).
- CoachPaywall P1-9: 3 cases (14 totales).
- useCoachCreditsPurchase P1-9: 2 cases (6 totales).
- useProSheetState P1-6: 1 case (8 totales).

### Production deploy

- Último production promote: `363890b9` a las ~02:20 UTC (2026-06-03).
- Vercel deploy time: ~1 min entre push y first 200.
- Smoke `/hub` post-promote: ✅ HTTP 200 directo.

---

## Pendientes recomendados (próxima sesión)

### Prioridad de elección (acordada con el usuario)

1. **P0-1 PageSpeed perf cluster** (~half-day, 3 commits proyectados)
   - `perf(bundle): dynamic-import wagmi/RainbowKit for non-landing routes` (~550ms mobile, target 72→80).
   - `perf(css): purge unused Tailwind from hub bundle` (~220ms, +3-5).
   - `perf(head): preconnect to forno.celo.org + walletconnect + supabase` (~290ms, +3-5).
   - **Expectativa:** mobile `/hub` 72 → 85–90. Cierra P0-1 si llega a 90.

2. **P1-5 `/stats` page MVP** (~half-day, decisión arquitectura)
   - Requirements del MiniPay (§8 Analytics): DAU, MAU, retention D1/D7/D30, tx/day/week/month, unique on-chain users, volume per stablecoin, network fees paid, protocol revenue, failed-tx rate.
   - Decisión sink: Supabase queries vs Dune dashboard vs lightweight Blockscout indexer.
   - Public `/stats` route + footer link.

### Bloqueados / mayor scope

- **P0-4 zero-click connect runtime**: requiere device físico Android con MiniPay instalado. Code-side ya validado; falta runtime smoke.
- **P1-7 identity/ODIS**: `display-name.ts` es el mediador. ODIS no aparece integrado. Scope mayor — implementación de phone-first identity completa.

---

## Riesgos / follow-ups

### Riesgos abiertos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | Mobile `/hub` perf 72 — bajo el 90+ que pide MiniPay submission | Media | P0-1 cluster identificado, ejecutable en half-day |
| R2 | Landing `/` perf null en Lighthouse (LH 11 + 12 trace bug) | Baja | No es regresión real; recomendar `pagespeed.web.dev` segundo opinion cuando PSI API quota resetee |
| R3 | Mobile `/hub` CLS 0.187 (was 0.126 pre-fix, expected ~0.038) | Media | Investigación pendiente — probables suspects: Connect button pill swap durante wallet detect, Lottie load, character mount. Plug en P0-1 cluster |
| R4 | LabyrinthBadges Phase D contract aún no deployed a mainnet | N/A — fuera de scope MiniPay | Standby por decisión usuario; preservado intacto debajo de los commits MiniPay readiness |
| R5 | Pre-existing test drift en `home-loads.spec.ts` y `dock-anchor.spec.ts` (assumed legacy selectors del hub-v1; hub-v2 redesign no los actualiza) | Baja | Pre-existente, no regresión; identifies durante el 360 audit (`8da38794`) — separate cleanup ticket |
| R6 | Stale text `chesscito.vercel.app` en handoffs / specs frozen records | Muy baja | Intencional — historical record. Solo docs vivos migrados a `www.chesscito.com` |

### Follow-ups documentados (no bloqueantes)

| Origen | Follow-up | Cuándo |
|---|---|---|
| `docs/reviews/2026-06-02-celopedia-minipay-listing-checklist.md` | Update `NEXT_PUBLIC_APP_URL` env en Vercel Preview + Production a `https://www.chesscito.com` (hoy apunta al apex; sitemap usa apex en `<loc>` por consecuencia) | Pre-submission, no urgente |
| `docs/reviews/2026-06-02-i18n-redirect-audit.md` Appendix A | Errata del runbook corregida en commit subsiguiente | ✅ Cerrado |
| `docs/runbooks/2026-06-02-i18n-post-deploy-verification.md` | Runbook listo para futuras re-mediciones post i18n changes | Tooling |
| `docs/audits/2026-06-02-copy-narrative-audit.md` (open TODO desde 2026-06-02) | Terms legal review (`accessible via MiniPay` wording) | Pendiente legal counsel |
| `docs/reviews/2026-06-03-celo-minipay-runtime-audit.md` §6 | Consolidar `exercises-screen.tsx` legacy CELO logic onto `useShopSheetState` (DRY) | Refactor separado |
| `docs/pagespeed-report-2026-06-03.md` §CLS | Hub mobile CLS 0.187 investigation | Plug en P0-1 cluster |
| Audit doc P1-9 (`docs/reviews/2026-06-03-low-balance-deeplink-audit.md`) | Audit doc UNTRACKED al cierre — agregar al próximo doc commit junto con otros docs `2026-06-03-*` | Próximo doc commit |

### Untracked docs al cierre

```
docs/reviews/2026-06-03-low-balance-deeplink-audit.md
```

(El doc `2026-06-03-copy-sweep-extended-audit.md`, `2026-06-03-celo-minipay-runtime-audit.md`, `2026-06-03-viewport-360x640-audit.md`, `2026-06-02-i18n-redirect-audit.md`, `2026-06-02-celopedia-*`, `2026-06-02-minipay-readiness-audit.md`, `2026-06-02-commit-1-domain-switch-proposal.md`, `2026-06-03-integration-audit-labyrinth-vs-minipay.md` ya están commiteados en sesiones anteriores de la sesión).

**Acción para próxima sesión:** decidir si agregar el untracked audit doc en su propio commit `docs(reviews): add low-balance deeplink audit` o bundlearlo con otros docs futuros.

---

## Apéndice — comandos útiles para próxima sesión

### Re-medición PageSpeed contra production

```bash
mkdir -p /tmp/psi-after && cd /tmp/psi-after
for url in "https://www.chesscito.com" "https://www.chesscito.com/hub"; do
  for preset in "" "--preset=desktop"; do
    name=$(echo "$url-$preset" | tr "/:" "__" | tr -s "_")
    npx --yes lighthouse@12 "$url" \
      --quiet --chrome-flags="--headless=new --no-sandbox" $preset \
      --output=json --output-path="lh-$name.json" \
      --only-categories=performance 2>&1 | tail -2
  done
done
```

### Smoke runbook (post any deploy)

```bash
PROD="https://www.chesscito.com"
for path in "" "/hub" "/support" "/terms" "/privacy" "/about" "/exercises" "/arena" "/trophies" "/en" "/en/hub" "/es" "/es/hub"; do
  printf "%-15s → " "${path:-/}"
  /usr/bin/curl -sI -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" "$PROD$path"
done
```

### Promote (when ready)

```bash
git checkout production
git pull --ff-only origin production
git merge --ff-only main
git push origin production
git checkout main
```

---

## Closing note

Sesión productiva: **5 de 9 puntos MiniPay readiness cerrados** + **redirect perf fix shipped live**. El gap principal hacia submission es PageSpeed mobile 90+ (P0-1 cluster, half-day) y la validación zero-click runtime en device físico (P0-4).

Próxima sesión: usuario decide entre P0-1 (perf) o P1-5 (`/stats`). Mi sesgo: P0-1 primero por ser hard requirement de listing; `/stats` puede surface después con métricas reales acumuladas.
