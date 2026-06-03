# Chesscito — Evaluación desde el Ecosistema Celo

**Fecha:** 2026-06-02
**Fuente:** Celopedia skill (snapshot MiniPay discovery 2026-04-09 + Celo ecosystem refs)
**Audiencia:** founder / equipo Chesscito — input para decisiones de listing y posicionamiento

---

## TL;DR

**Veredicto: muy bien posicionado, con diferenciación real frente al catálogo MiniPay actual.**

Chesscito es el **único juego educativo** en el espacio MiniPay/Celo. El resto del shelf "games" (10+ apps) es casino-loop / spin-to-win / merge / predicciones / play-to-earn de fricción baja. No hay un competidor educativo directo en chess, ajedrez, ni "skill-based learning". Esto es una ventaja narrativa fuerte frente al MiniPay team — que ya tiene saturada la categoría "rewards/casino" y busca diversificación.

**Riesgo principal:** PageSpeed mobile = 54 (capturado 2026-03-23) está MUY por debajo del 90+ que pide MiniPay. Es el blocker técnico más visible para listing.

---

## 1. Posicionamiento competitivo

### Catálogo MiniPay actual (snapshot 2026-04-09, categoría `games`)

| App | Mecánica | Educativo? | Skill-based? |
|---|---|---|---|
| Aqua Pop, Tank War, Daily Treats, Game On, Mini Games | Casual-loop / daily rewards | No | No |
| Tiles, Swift, Spell Tower | Match / merge / palabras | No | Levemente |
| Tradcast, Play to earn | Predicción / cash rewards | No | No |
| MiniPlay | Suite arcade | No | No |

**Brecha que llena Chesscito:**
- Único educativo (no "earn-loop").
- Único skill-based con curva de aprendizaje real (movimientos de piezas → laberintos → arena vs IA).
- Único con NFT coleccionable narrativo (Victory NFT por dificultad + Badges soulbound) en vez de token de farming.
- Único con coach AI (LLM) explicando partidas — diferenciación técnica clara.

### Comparables fuera de MiniPay (Celo y otros L2)

- **PoolTogether V3** (Celo): "no-loss prize games" — financial gaming, no educativo.
- **Topcasters** (Farcaster): "prediction gaming" — apuestas, no skill chess.
- **Sin equivalentes chess educativos en Celo/MiniPay según The Grid y ecosystem.md.**

**Conclusión:** Chesscito tiene un nicho efectivamente vacío. La narrativa "educación + Web3 + emerging markets" embona con la tesis MiniPay (Global South, alfabetización financiera/digital).

---

## 2. Alineación con tendencias Celo 2026

| Tendencia | Alineación Chesscito |
|---|---|
| Celo como L2 (post-mar 2025) + zkEVM | OK — ya operando en Celo Mainnet 42220, contratos upgradeable |
| Fee abstraction (CIP-64, USDC/USDT/USDm) | OK — pricing en USD6, pagos en stablecoins |
| MiniPay como canal principal | OK — mobile-first 390px, copy MiniPay-safe ya aplicado |
| Educación + retención (vs casino-loop) | Diferenciador fuerte |
| AI agents on-chain (ERC-8004, x402) | Oportunidad — Coach v1 ya usa LLM; puede evolucionar a agent verificable |
| Stablecoin payments emerging markets | OK — precios micro ($0.005-$0.02) compatibles con poder adquisitivo Global South |
| Soulbound badges / proof-of-completion | OK — LabyrinthBadges v0.2 spec FROZEN, contrato Phase D listo para implementar |
| Funding programs activos (Verda $25K, Proof of Ship mensual) | Aprovechable — perfil de Chesscito embona con Verda Ventures MiniPay Builder Fund |

---

## 3. Fortalezas (ranked)

1. **Producto en mainnet ya monetizando** — VictoryNFT + Shop + Badges desplegados; M1 monetization funnel LIVE; 16 eventos `monetization.*` instrumentados. La mayoría de submissions MiniPay llegan en estado pre-launch.
2. **Documentación de submission ya preparada** — `docs/minipay-submission.md`, `docs/network-manifest.md`, `docs/submission/minipay-form-answers.md`, `docs/submission/minipay-validation-runbook.md`, business model + pitch deck outline. Esto reduce fricción Stage 1/Stage 2 dramáticamente.
3. **Copy MiniPay-safe** — anti-AI-prose enforcement, MiniPay listing safety (no decir "MiniPay game / Free on MiniPay" antes de aprobación), CTA tokens unificados, promise-first copy. Ya tienes lo que MiniPay requiere en §3 (UI Copy).
4. **Seguridad de contratos** — VictoryNFT pasó code review + red team; LabyrinthBadges spec auditada y v0.2 Phase D frozen. OZ v5, ReentrancyGuard, pausable, upgradeable detrás de TransparentUpgradeableProxy.
5. **Tests de calidad** — 1727 passing baseline + VR baselines + Playwright E2E + telemetría disco para sesiones VR largas.
6. **Diferenciación narrativa real** — "pre-ajedrecístico educativo" no es un copy de Duolingo ni clon de Chess.com; el flujo coach + arena + visor está pulido (cluster C 27 commits 2026-05-29).
7. **Editorial discipline** — single-source-of-truth en `editorial.ts`, 4 audiencias narrativas, sin jargon Web3 al frente.

---

## 4. Debilidades / riesgos (ranked por urgencia)

### P0 — Bloqueante para listing

1. **PageSpeed mobile = 54** (capturado 2026-03-23). MiniPay pide **90+ en mobile**. Esto es probablemente el blocker técnico más visible. Necesita re-medición + plan de mejora (imágenes WebP/AVIF ya bien, falta evaluar bundle JS, LCP, CLS).
2. **Dominio en docs de submission desactualizado** — `docs/minipay-submission.md` dice `chesscito.vercel.app`; producción es `www.chesscito.com`. Refresh obligatorio antes de enviar.

### P1 — Alta probabilidad de ser observación en review

3. **Falta página `/stats` o dashboard público** — MiniPay (§8 Analytics) quiere DAU, MAU, retention D1/D7/D30, tx por stablecoin, network fees pagados, failed-tx rate. No se ve en el árbol de rutas. Es requisito explícito post-call.
4. **24h SLA support pipeline** — `/support` existe como page, pero no hay AI agent en Telegram (patrón recomendado). Riesgo operacional si llega tracción rápida.
5. **Single-token UX** — VictoryNFT acepta múltiples tokens (USDC/USDT/CELO), pero MiniPay nunca muestra CELO. Hay que verificar que el selector de payment-token NO ofrezca CELO en runtime MiniPay. Existe `select-payment-token.ts` con test — auditarlo contra la regla "no CELO en MiniPay".

### P2 — Mejoras / oportunidades

6. **Sin grants aplicados activamente** (según memoria) — Verda Ventures $25K MiniPay Builder Fund encaja perfecto con el perfil; vale la pena el outreach paralelo al listing.
7. **Coach v1 es LLM cliente** — puede evolucionar a ERC-8004 agent con identidad verificable, narrativa fuerte para próximo ciclo. No urgente para listing.
8. **No usa Mento local stablecoins** — toda la economía es USD. Para mercados LATAM/África podría considerar surface BRLm/EURm en algún punto. No urgente.
9. **Founder NFT oculto del Shop** (decisión M1) — bien para conversion funnel actual, pero comprime narrativa "coleccionable". Revisitar post-M1.

---

## 5. Recomendaciones de posicionamiento (cómo pitchear a MiniPay)

**Una sola frase:**
> "Chesscito es la primera app educativa skill-based en MiniPay — enseña ajedrez con coleccionables on-chain, en español/inglés, mobile-first para mercados emergentes."

**3 bullets para intake form:**
- Único juego educativo del shelf MiniPay (categoría `games` saturada de casino-loop).
- Contratos desplegados, auditados internamente, en mainnet desde marzo 2026; >100 tx samples disponibles.
- AI coach explica jugadas en lenguaje natural — diferenciación técnica clara frente a juegos casuales.

**Evitar:**
- "P2E", "play-to-earn", "free crypto" — Chesscito NO es earn-loop y eso es la fortaleza, no la debilidad.
- "Chess game" a secas — pierdes el ángulo educativo.

---

## 6. Próximo paso recomendado

Dada la madurez del producto + docs de submission ya escritos, el camino más eficiente es:

1. **Re-medir PageSpeed mobile** contra `www.chesscito.com` (no Vercel preview). Si sigue ~54, abrir cluster de perf optimization antes de submission.
2. **Actualizar `docs/minipay-submission.md`** con dominio definitivo + tx samples Phase D una vez deploye LabyrinthBadges.
3. **Construir `/stats` page** mínima viable: DAU + MAU + tx/día + revenue acumulado en USD. Sin esto, Stage 2 readiness queda incompleta.
4. **Validar selector de payment-token en runtime MiniPay** — confirmar que CELO nunca aparece.
5. **Outreach paralelo a Verda Ventures** — `team@verda.ventures`, $25K builder fund, no requiere haber listed para aplicar.

Detalle exhaustivo del checklist de listing → `docs/reviews/2026-06-02-celopedia-minipay-listing-checklist.md`.
