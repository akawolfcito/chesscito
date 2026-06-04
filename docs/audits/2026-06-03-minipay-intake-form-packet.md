# MiniPay Intake Form — Packet (Chesscito)

**Date:** 2026-06-03
**Form URL:** `https://minipay.to/mini-apps`
**Status:** Draft ready to submit — pending operational TODOs (see §3)
**Sources:** `celopedia-skill / minipay-requirements.md` §2 + this session

---

## 1. Form Fields (10 base + 1 optional)

| # | Campo | Valor | Notas |
|---|-------|-------|-------|
| 1 | Developer / Company Name | `Wolfcito @akawolfcito · DenLabs` | Handle personal + GitHub org paraguas (no entidad legal todavía) |
| 2 | Email | `hello@chesscito.com` | ⚠️ Confirmar inbox activo antes de submit; SLA Stage 2 §6.4 depende |
| 3 | App URL | `https://www.chesscito.com` | Landing auto-redirige a `/hub` cuando detecta MiniPay (`landing-page.tsx:90-94`) — funciona para reviewer humano + WebView |
| 4 | Category | `Gaming` | Primario; badges son mecánica interna, no producto |
| 5 | Short Description | *"Chesscito teaches chess piece by piece through quick daily exercises, rewarding progress with collectible badges on Celo."* | 18 palabras; cumple `promise-first-copy` + `anti-ai-prose` + `minipay-listing-safety` (sin "MiniPay game") |
| 6 | Supports MiniPay? | `Yes` | Evidencia: P0-4 zero-click 6/6 PASS at HEAD `08a50a72` (`docs/audits/2026-06-03-minipay-zero-click-runtime-results.md`) |
| 7 | Screenshots (≥3, ≤500KB c/u) | 5 archivos en `design/evidence-minipay/` | Orden de upload: ver §2 |
| 8 | Smart Contract Address (opcional) | `0xf92759E5525763554515DD25E7650f72204a6739` | Badges (ERC-1155, BadgesUpgradeable, source verified en Celoscan, deployer `akawolfcito.eth`). Otros 3 contratos reservados para Stage 2 |
| 9 | Smart contract audited? | `No` + nota libre | Nota: *"No third-party audit yet. Internal coverage: 97/97 test suite. OpenZeppelin upgradeable pattern, TransparentUpgradeableProxy with separate ProxyAdmin. External audit planned post-listing."* |
| 10 | Social media? | `Yes` | Listar: X `@akawolfcito` (600 followers, builder personal) + GitHub `https://github.com/denlabs` + `https://github.com/akawolfcito`. NO listar `@chesscito` X (1 user) ni Telegram (1 user) |
| 11 | On-chain performance analytics link (optional) | `https://www.chesscito.com/stats` | MVP live (memory `stats-mvp-closed-2026-06-03`). 3/9 métricas cubiertas (DAU proxy via session_id, victory mints, mint-only wallets); 6/9 declaradas "Coming next" honestamente. Ver §4 para framing recomendado |

---

## 2. Screenshots — orden de upload

Todos los archivos en `design/evidence-minipay/` (originales preservados en `originals/`):

| # | Archivo | Peso | Surface | Justificación |
|---|---------|------|---------|----------------|
| 1 | `chesscito-hub.jpg` | 398K | Hub entrada | Mobile-first + zero-click landing + daily tile (engagement loop visible) |
| 2 | `chesscito-gameboard.jpg` | 309K | Arena gameplay | Demuestra gameplay real (no vaporware) |
| 3 | `chesscito-coach-analysis.jpg` | 288K | Coach viewer post-victoria | Reward mechanic + badge collectible visible |
| 4 | `chesscito-exercises.PNG` | 473K | Ejercicio activo | Refuerza "pre-chess teaches piece by piece" |
| 5 | `chesscito-badges.PNG` | 446K | Account vitrine | Progresión persistente + colección |

Mixed PNG + JPG (form acepta ambos). Todos <500KB.

---

## 3. Pre-submit TODOs (operacionales, ~15-30 min)

- [ ] **Verificar inbox `hello@chesscito.com`** activo y monitoreado (Google Workspace / Cloudflare Email Routing apuntando a `creativexymyx@gmail.com` funciona)
- [ ] **Pin tweet en `@chesscito` X** con link a `chesscito.com` + tagline + screenshot del hub (señal de vida si reviewer abre el handle)
- [ ] **Pin tweet en `@akawolfcito` X** anunciando Chesscito + link (conecta los 600 followers al proyecto)
- [ ] **Landing footer:** agregar línea sutil `"Built by @akawolfcito"` con link a X (conecta dot reviewer → builder real)
- [ ] **Visual QA**: abrir cada screenshot en Preview para confirmar sin artefactos visibles (especialmente los JPG con texto)

Skip Telegram entirely. No tocar `@denlabs` X (no existe presencia real).

---

## 4. Field 11 — On-chain analytics framing recomendado

**Link a registrar:** `https://www.chesscito.com/stats`

**Por qué incluirlo (no marcar "N/A"):**
- Aunque es "(if applicable)", tener algo > nada. /stats live demuestra que conocemos la operación del producto.
- Reduce fricción del reviewer en Stage 2 (§8 readiness checklist pide stats page).
- Honesto: declara MVP scope + roadmap "Coming next" sin pretender más de lo que hay.

**Nota opcional (versión confirmada por usuario 2026-06-03, less technical):**

> *"Public stats page live at https://www.chesscito.com/stats. It shows real Chesscito activity metrics including app sessions, Victory mints, minter wallets, recent mints, difficulty mix, and leaderboard activity. Stablecoin volume, revenue, failed transaction rate, and retention cohorts are listed as coming next."*

**Si el form permite múltiples links** (no si es campo singular): agregar Celoscan address page de Badges como referencia on-chain complementaria.
`https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739`

⚠️ **Regla:** el link principal del campo debe ser `/stats`. Celoscan y Dune NO sustituyen — sólo complementan si hay espacio.

---

## 5. Open questions parking lot (para el grupo MiniPay/Celo)

Mientras se espera la primera review del intake, esperar respuesta del grupo a las 5 preguntas en `docs/design-patterns/minipay-identity-design.md` §10. No bloqueante para submission.

---

## 6. Cross-refs

- Audit base: `docs/audits/2026-06-03-minipay-submission-readiness-audit.md`
- Identity decision: `docs/design-patterns/minipay-identity-design.md`
- Zero-click runtime results: `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md`
- Stats MVP architecture: `docs/audits/2026-06-03-stats-mvp-architecture-audit.md`
- Source: `celopedia-skill / minipay-requirements.md` §2 (intake form spec)
