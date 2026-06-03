# Handoff — /stats MVP Closure (2026-06-03)

**Session window:** 2026-06-03 (single session, multi-cluster)
**Cluster closed:** /stats public dashboard MVP (P1-5)
**Branch state at handoff:** `main` and `production` aligned. No drift.

---

## 1. Hashes

| Ref | Hash | Title |
|---|---|---|
| `origin/main` | `923af98f` | docs(stats): close cluster as honest MVP, mark §8 coverage partial |
| `origin/production` | `923af98f` | same — aligned via FF promote |

Zero pending promote. Zero local uncommitted changes (untracked LH JSON snapshots + 2 untracked audit/handoff docs from prior session remain — see §8).

---

## 2. MiniPay readiness checklist

**7 / 9 cerrados.**

| # | Item | Estado | Notas |
|---|---|---|---|
| P0-1 | PageSpeed 90+ mobile | 🟡 **81** | Gap 9 puntos. Cluster previo `9152bc3b..e3da6238` cerró lazy sheets + LCP preload + ProBadge dims + version chip gate. Restantes en §5. |
| P0-2 | Dominio canónico `www.chesscito.com` | ✅ | Live desde 2026-06-03 |
| P0-3 | Viewport 360×640 cobertura | ✅ | `8da38794` |
| P0-4 | Zero-click connect runtime | ⏳ | Bloqueado por device físico MiniPay Android. Code-side validado. Fuera de scope agente. |
| **P1-5** | **/stats MVP** | ✅ | **Cerrado definitivamente esta sesión.** 13 commits, 34/34 tests, 0 deps, 0 mock data. |
| P1-6 | CELO oculto MiniPay | ✅ | `b1f36bf3` |
| P1-7 | Identity ODIS phone-first | ❌ | Scope mayor — `display-name.ts` es mediador, ODIS no integrado. No candidato a sprint corto. |
| P1-8 | Copy sweep extended | ✅ | `28ee59c5` |
| P1-9 | Low-balance Add Cash deeplink | ✅ | `6557ed8c..363890b9`, 3 surfaces |

---

## 3. Live en production hoy (`923af98f`)

### /stats MVP

Route público `https://www.chesscito.com/stats` + `https://www.chesscito.com/es/stats`. Server Component, `revalidate = 3600`.

Contenido renderizado (todos confirmados en HTML prod via curl post-deploy):

- Header `Chesscito Platform Stats` + intro + framing block (platform-level, not player-profile).
- "What this shows" — 3-bullet orientation.
- 3 hero cards: Victory NFTs Minted / Approx. App Sessions (7d) / Victory Mints (30d).
- 5 secondary cards: Victory Mints (7d) / Wallets with Victory Mints / Approx. Sessions (30d) / Welcome Packs Claimed / Welcome Packs (7d).
- Difficulty cards (Easy / Medium / Hard).
- **Platform signals** — 3 narrated insights derived live from snapshot.
- **Activity trend, last 30 days** — 2 SVG sparklines (sessions + mints), pure SVG, zero chart libs.
- **Victory difficulty mix** — horizontal CSS bars complementing the cards.
- Recent Victory Mints (10 latest, wallets truncated).
- Community Leaderboard (Top 10 by score, microcopy `"Based on game scores, not only minted victories."`).
- **Tracked today / Coming next** — bifurcated scope card.
- Methodology footnote.

### Submission docs alineados

- `docs/submission/minipay-form-answers.md` — Q "Public platform metrics" reescrito con `"Status: MVP available, full analytics roadmap pending."` + tabla coverage §8 honesta + roadmap explícito.
- `docs/product/stats-mvp.md` — change history append con la closure entry.

### Footer + sitemap

- Landing footer: 5° link `/stats` junto a privacy/terms/support/about.
- Sitemap bilingual: `/stats` + `/es/stats` entries.

### Cluster founder-status (sub-cluster previo, también live)

`origin/production` también contiene `0bc34d24` Patch 1 + `7538bee0` Patch 2 + `647adee8` audit closure. Estado: mitigated, not cured. C1 Redis write-through diferido.

---

## 4. Hard rules locked

### /stats

- **NO más polish UI/copy de /stats** hasta que un cluster real de instrumentation/indexer abra primero. Cualquier ajuste cosmético es premature optimization vs cerrar el gap §8 real.
- **NO mock data ever**. Cada número en /stats viene de Supabase real. Si una métrica nueva no tiene fuente real, NO va.

### Infraestructura

- **NO Dune** (directiva user).
- **NO PAYG / paid RPC tiers** (Alchemy PAYG, QuickNode paid, Infura growth — vetados por feedback memory `no-payg-rpc`).
- **NO hosted subgraph** (The Graph hosted service en deprecación).

### Scope §8 fallback

- Si MiniPay reviewer rechaza listing citando §8 incompleto → cluster aparte de 2-4 semanas (wallet-tied event stream + on-chain indexer + tx-state ledger + geo telemetry). **NO parche dentro de /stats.**

### Pre-existentes (memorias anteriores siguen vigentes)

- `feedback_no_payg_rpc.md` — sin PAYG/paid RPC.
- `founder-status-mitigated-2026-06-03` — no reabrir sin volumen real o demo trigger.
- `hub-perf-cluster-2026-06-03` — no tocar wagmi/RainbowKit en perf shallow.

---

## 5. Próximo scope recomendado — P0-1 perf shallow cluster

**Objetivo:** mobile `/hub` PSI 81 → 85–87. Sin tocar wagmi/RainbowKit (donde está el grueso del 550ms / 110 KiB).

**Sub-tareas (3 commits proyectados, ~2-3h total):**

| # | Commit | Gain Esperado | Files críticos |
|---|---|---|---|
| 1 | `perf(head): preconnect to forno.celo.org + walletconnect + supabase` | ~290ms (render-blocking-resources) | `apps/web/src/app/layout.tsx` o equivalente |
| 2 | `perf(css): purge unused Tailwind from hub bundle` | ~220ms / 39 KiB (unused-css-rules) | `tailwind.config.js` + revisar `globals.css` purge boundaries |
| 3 | `perf(images): convert remaining legacy formats to avif/webp` | ~100ms combined (modern-image-formats + legacy-js) | `apps/web/public/art/**/*.png` que falten triplete |

**Aceptación:** PSI `https://www.chesscito.com/hub` mobile ≥85 + CLS 0.

**Baseline antes de empezar:** re-medir PSI primero (puede haber drift).

---

## 6. Qué NO tocar en P0-1 cluster

| Área | Razón |
|---|---|
| /stats UI/copy | Hard rule, cluster cerrado |
| Aggregator de /stats | Estable, queries optimizadas con `.range()` |
| founder-status | Mitigated, C1 backlog |
| Labyrinth (Phase D mainnet) | Standby por decisión usuario; sub-cluster propio cuando se abra |
| wagmi / RainbowKit | Directiva no-perf-deep en cluster shallow |
| ODIS / identity primaria | Scope mayor, requiere cluster dedicado |
| globals.css split | Backlog perf diferido (cluster propio) |
| next/image migration | Backlog perf diferido (cluster propio) |
| MEMORY.md | Solo append (no rewrite history) |
| Submission packet | Solo si Q nueva o coverage cambia |

---

## 7. Comandos para retomar P0-1 en nueva sesión

### Baseline re-measure

```bash
mkdir -p /tmp/psi-p0-1-baseline && cd /tmp/psi-p0-1-baseline
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

### Identify top remaining opportunities

```bash
cat /tmp/psi-p0-1-baseline/lh-_https____www.chesscito.com_hub-.json \
  | jq '.audits | to_entries[] | select(.value.score != null and .value.score < 0.9 and .value.details.overallSavingsMs > 50)
    | { audit: .key, savings_ms: .value.details.overallSavingsMs, savings_kb: (.value.details.overallSavingsBytes // 0) / 1024 }' \
  | head -30
```

### Locate files for each sub-commit

```bash
# Commit 1: preconnect candidates
grep -rE "forno\.celo\.org|walletconnect|supabase\.co" apps/web/src/ | head

# Commit 2: tailwind purge baseline
cat apps/web/tailwind.config.js 2>/dev/null || cat apps/web/tailwind.config.ts

# Commit 3: legacy images missing avif/webp triplet
find apps/web/public/art -name "*.png" -type f | while read f; do
  base="${f%.png}"
  [ -f "$base.avif" ] || echo "MISSING-AVIF $f"
  [ -f "$base.webp" ] || echo "MISSING-WEBP $f"
done | head -20
```

### Post-cluster verification

```bash
# Re-measure
npx --yes lighthouse@12 "https://www.chesscito.com/hub" \
  --quiet --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path=/tmp/lh-prod-post-p0-1-shallow.json \
  --only-categories=performance

# Compare baseline vs post
jq '.categories.performance.score' /tmp/psi-p0-1-baseline/lh-_https____www.chesscito.com_hub-.json
jq '.categories.performance.score' /tmp/lh-prod-post-p0-1-shallow.json
```

### Promote

```bash
git checkout production && git pull --ff-only origin production \
  && git merge --ff-only main && git push origin production && git checkout main
```

---

## 8. Untracked al cierre

```
apps/web/lh-*.json                                              (LH snapshots, ephemeral)
lh-prod-post-p0-3-r2.json, lh-prod-post-p0-3-r3.json            (idem, repo root)
docs/audits/2026-06-03-stats-mvp-architecture-audit.md          (audit base del cluster /stats — never committed)
docs/handoffs/2026-06-03-minipay-readiness-session-handoff.md   (handoff previo de la sesión MiniPay — never committed)
docs/reviews/2026-06-03-low-balance-deeplink-audit.md           (audit P1-9 — never committed)
```

**Acción sugerida próxima sesión:** un `docs:` commit limpiando los 3 audits/handoffs untracked en un sólo batch antes de empezar P0-1.

---

## 9. Closing note

/stats MVP shipped honestly. Cobertura §8 declarada parcial sin pretender lo contrario; submission packet alineado con prod. Memory + MEMORY.md actualizados con la closure y las hard rules. Production al día con main.

P0-1 cluster shallow es el próximo paso natural si se quiere mover el dial PSI mobile sin abrir wagmi. Pero NO bloquea listing solo: P0-4 (zero-click device) es el bloqueador independiente más probable hacia Stage 1.

---

## 10. Refs

- Cluster closure: `docs/product/stats-mvp.md` §10 change history.
- Hard rules + memorias: `project_stats_mvp_closed_2026_06_03.md` + `MEMORY.md` index.
- Architecture audit (untracked): `docs/audits/2026-06-03-stats-mvp-architecture-audit.md`.
- MiniPay submission Q: `docs/submission/minipay-form-answers.md` §"Public platform metrics".
- MiniPay §8 source-of-truth: `docs/reviews/2026-06-02-celopedia-minipay-listing-checklist.md` §8.
- Hub perf prior cluster: `docs/handoffs/2026-06-03-hub-perf-cluster-handoff.md` (commit `8b1064bb`).
- Previous session handoff (untracked): `docs/handoffs/2026-06-03-minipay-readiness-session-handoff.md`.
