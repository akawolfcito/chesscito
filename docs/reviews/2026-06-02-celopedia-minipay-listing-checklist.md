# Chesscito — Checklist Exhaustivo de Listing en MiniPay

**Fecha:** 2026-06-02
**Fuente:** Celopedia skill — `minipay-requirements.md` (PDF oficial Opera MiniPay, last updated 2026-05-13)
**Estado del producto:** LIVE en mainnet, M1 monetization shipped, copy MiniPay-safe aplicado.

---

## ⚠️ Pregunta crítica antes de seguir

**¿Ya tuvieron su primera call con el equipo de MiniPay?**

El listing es **proceso de dos etapas**:

- **Stage 1 — Intake form** (`https://minipay.to/mini-apps`): submission básica → si gusta, agendan call.
- **Stage 2 — Readiness form** post-call: checklist completo de 8 secciones.

**MiniPay triagea por calidad.** Si la submission del Stage 1 luce a medias, deprioriza follow-up. La regla "no enviar app a medias" aplica fuerte aquí.

Este checklist cubre AMBAS etapas, con flag de qué necesita estar listo para Stage 1 vs Stage 2.

---

## Stage 1 — Intake form (lo mínimo visible)

URL: `https://minipay.to/mini-apps`

### Campos del form

| Campo | Estado Chesscito | Notas |
|---|---|---|
| Developer/Company Name | ✅ Wolfcito / @akawolfcito | Ya en `docs/minipay-submission.md` |
| Email contacto | ✅ creativexymyx@gmail.com | Confirmar si quieren email de proyecto |
| App URL | ⚠️ Doc dice `chesscito.vercel.app`; prod es `www.chesscito.com` | **Actualizar antes de enviar** |
| Category | ✅ "education" (mejor que "gaming" — diferencia narrativa) | También válida: "Gaming" si MiniPay lo prefiere |
| Short description (1 frase) | ✅ Ya redactada en submission doc | Sugerencia: enfatizar "first educational game on MiniPay" |
| Does your App already support MiniPay? | ✅ Yes | Verificar zero-click connect en runtime real (ngrok + device físico) |
| App Screenshots | ⚠️ Verificar | PNG/JPG max 500KB cada uno, **mínimo 3 high-quality**. Ya hay material en `docs/business/screenshots/` |
| Smart Contract Address | ✅ 4 contratos en mainnet | Badges, Scoreboard, Shop, VictoryNFT |
| ¿Auditado? | ⚠️ "Internal audit + red team" — no formal | Sé honesto: no formal audit, pero hay reviews documentados |
| Social media | ⚠️ Verificar handles activos | @akawolfcito ya en docs |

### Quick-look items (los mira el reviewer en 5 min)

| Item | Estado | Acción si falta |
|---|---|---|
| Zero-click connect (no botón "Connect Wallet" en MiniPay) | ⚠️ Verificar en device físico | Auto-detect `window.ethereum.isMiniPay === true` |
| No `personal_sign` / `eth_signTypedData` en cliente | ✅ Server-side signing only (sign-victory, sign-badge, sign-score, sign-labyrinth) | Confirmado: matches en grep son server routes + 1 comentario VR fixture |
| No raw `0x…` como identidad primaria | ⚠️ Auditar UI — Account sheet, leaderboard, share grid | Mostrar phone (ODIS lookup) o alias; truncar address solo como hint secundario |
| Copy: "Network fee", "Deposit", "Withdraw", "Stablecoin" (NO gas/onramp/crypto) | ✅ MiniPay safety rule activa | Re-grep "gas" / "onramp" / "crypto" en `editorial.ts` y catálogos i18n |
| 360×640 mobile resolution OK | ⚠️ App es 390px max — verificar que NO rompe a 360px | DevTools device mode + Playwright fixture a 360w |
| Images SVG o WebP | ✅ Image triplet rule (png + webp + avif) | `scripts/optimize-art-assets.sh` ya en uso |
| PageSpeed Insights score | ❌ **54 mobile (2026-03-23)** — MUY POR DEBAJO de 90+ | **Blocker P0** — re-medir + plan de mejora |
| Redirect a Deposit deeplink si balance bajo | ⚠️ Verificar | URL: `https://minipay.opera.com/add_cash` — usar en `tx-progress-steps.tsx` o equivalente |
| App name + logo distintos del branding MiniPay | ✅ Logo Chesscito, narrativa "Wolfcito 🐾" | Confirmar `icon-512.png` no se confunde con MiniPay |
| Contracts verificados en Celoscan | ✅ 4 contratos verificados (links en submission doc) | Listo |

### Recomendación Stage 1

**No enviar todavía.** Bloqueantes:
1. PageSpeed mobile 54 → urgente bajar a 90+.
2. Dominio en docs desactualizado.
3. Validar 360w no rompe layouts (apps/web está pinned a 390px).
4. Validar zero-click connect end-to-end en MiniPay device físico.

Sin esos 4 puntos cerrados, alto riesgo de deprioritization en triage.

---

## Stage 2 — Readiness checklist completo (post-call)

### §1. Seamless User Experience

| Requisito | Estado | Notas |
|---|---|---|
| Zero-click connect cuando `isMiniPay === true` | ⚠️ Verificar runtime | Patrón en `minipay-templates.md` §1 |
| No `personal_sign` ni `eth_signTypedData` (cliente) | ✅ Solo server-side EIP-712 | API routes firman; cliente solo `writeContract` |
| No raw `0x…` como identidad primaria | ⚠️ Auditar Account, Leaderboard, Share, Coach viewer | ODIS lookup → phone E.164; trusted issuer MiniPay = `0x7888...` |

### §2. Currency & Stablecoin Logic

| Requisito | Estado | Notas |
|---|---|---|
| Solo USDT / USDC / USDm — NUNCA CELO | ⚠️ Auditar `select-payment-token.ts` | Hay flag/logic para múltiples tokens. Confirmar que CELO está oculto en runtime MiniPay |
| Adapt a stablecoin preferido del usuario | ⚠️ Verificar | Helper canónico en `minipay-templates.md` §6 |
| Graceful degradation single-token | ⚠️ Si solo aceptas USDC en algún flujo, mostrar explainer | "This app accepts USDC only. Swap in MiniPay first." |

**⚠️ Crítico:** revisar que `feeCurrency` para USDC/USDT use **adapter addresses** (no token addresses):
- USDC adapter: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
- USDT adapter: `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72`
- USDm: mismo address (`0x765DE816845861e75A25fCA122bb6898B8B1282a`)

Si pasas token address en `feeCurrency` para USDC/USDT, **la transacción falla**.

### §3. User-Facing Copy (estricto)

| ❌ No decir | ✅ Decir | Estado |
|---|---|---|
| Gas / Gas fee | Network fee | Auditar `editorial.ts` + i18n EN/ES |
| Onramp / Buy crypto | Deposit | Auditar |
| Offramp / Sell crypto | Withdraw | Auditar |
| Crypto / Crypto token | Stablecoin / Digital dollar | Auditar — "promise-first copy" rule ya cubre esto parcialmente |
| Wallet address (primary) | Phone number | Auditar Account / Share / Leaderboard |

**Acción concreta:** correr regex sweep en `apps/web/src/lib/content/**` por términos prohibidos.

### §4. Technical Performance

| Requisito | Estado | Notas |
|---|---|---|
| Responsive a 360w × 640h | ⚠️ App max 390px — verificar 360 NO rompe | DevTools + Playwright fixture 360x640 |
| Images SVG/WebP (no PNG/JPG >few KB) | ✅ Triplet rule activa | AVIF + WebP shipped |
| PageSpeed Insights 90+ mobile | ❌ **54 (2026-03-23)** | Re-medir contra prod actual; abrir cluster perf si sigue <90 |
| URL/origin manifest | ✅ `docs/network-manifest.md` existe | Validar que esté completo + actualizado |

### §5. Smart Contract Standards

| Requisito | Estado | Notas |
|---|---|---|
| Contratos verificados en Celoscan | ✅ Badges, Scoreboard, Shop, VictoryNFT verificados | Pendiente: LabyrinthBadges cuando se deploye (Phase D) |
| Sample tx hashes por método user-facing | ✅ Documentadas en submission doc | Pendiente confirmar buyItem hash (TODO marcado en doc) |

### §6. Integration & Support

| Requisito | Estado | Notas |
|---|---|---|
| Low-balance redirect a Deposit deeplink | ⚠️ Verificar implementación | `https://minipay.opera.com/add_cash` |
| In-app support link (Telegram/WhatsApp/email/web) | ✅ `/support` route existe | Confirmar reachable desde cualquier pantalla (footer/settings) |
| 24h SLA críticos | ⚠️ Sin pipeline AI agent Telegram | Recomendado por MiniPay — patrón canon en `minipay-requirements.md` §6 |

### §7. Branding & Legal

| Requisito | Estado | Notas |
|---|---|---|
| App name + logo prominentes y distintos de MiniPay | ✅ Wolfcito 🐾 + logo propio | OK |
| Terms of Service link in-app | ✅ `/terms` route existe | Confirmar link visible desde footer/settings |
| Privacy Policy link in-app | ✅ `/privacy` route existe | Confirmar link visible desde footer/settings |

**⚠️ Audit copy 2026-06-02** dejó open TODO: "Terms legal review (`accessible via MiniPay`)". Revisar antes de submission.

### §8. Analytics & Operational Visibility

| Requisito | Estado | Notas |
|---|---|---|
| DAU / MAU | ❌ No hay página pública | Telemetría existe (`telemetry.ts` + 16 eventos M1) — falta exponer |
| Retention D1/D7/D30 | ❌ No expuesto | Necesita cohorts |
| Top countries | ❌ No expuesto | Útil dado country targeting MiniPay |
| Transactions per day/week/month/lifetime | ❌ Falta indexer/dashboard | Goldsky, Dune, o lightweight Blockscout |
| Unique on-chain users | ❌ Falta | Distinct `tx.from` |
| Volume per stablecoin | ❌ Falta | USDT/USDC/USDm breakdown |
| Network fees pagados | ❌ Falta | `gasUsed × effectiveGasPrice` → USD |
| Protocol revenue (FeeCollected) | ❌ Falta | Contract VictoryNFT split 80/20 — sumar eventos |
| Failed-tx rate | ❌ Falta | Proxy de UX/contract bugs |

**Acción concreta:** crear `/stats` route mínima, read-only, sin wallet. Alternativa: Dune dashboard linked desde footer.

---

## Resumen de gaps (priorizado)

### Blockers P0 (bloquean Stage 1)

1. **PageSpeed mobile 54 → 90+** (re-medir + perf cluster).
2. **Dominio en docs:** `chesscito.vercel.app` → `www.chesscito.com`.
3. **360w viewport check:** confirmar que app de 390px max no rompe en 360.
4. **Zero-click connect end-to-end** en MiniPay device físico (no emulador).

### Gaps P1 (bloquean Stage 2)

5. **`/stats` page** con métricas usage + on-chain (sección §8 entera).
6. **Selector de payment-token:** confirmar CELO oculto en runtime MiniPay.
7. **Auditar identidad primaria:** ningún `0x…` como primary en UI (Account, Leaderboard, Share).
8. **Copy sweep estricto:** "gas", "onramp", "crypto", "wallet address" → reemplazar.
9. **Low-balance redirect:** wire `https://minipay.opera.com/add_cash` cuando approve/transfer falla por balance.

### Gaps P2 (mejoran review)

10. **AI agent Telegram support** para 24h SLA.
11. **Terms legal review** (open TODO desde audit copy 2026-06-02).
12. **Tx hash buyItem** confirmar en Celoscan (TODO en submission doc).
13. **Phase D LabyrinthBadges deploy + verify** antes de submission si quieren incluirlo.

---

## Roadmap sugerido (orden ejecución)

**Sprint A — Perf + viewport (1 semana)**
- Re-medir PageSpeed en prod → bajar a 90+ mobile.
- Playwright fixture 360×640 → fix layout regressions.
- Update dominio + tx hashes en `docs/minipay-submission.md`.

**Sprint B — Stats page + copy sweep (1 semana)**
- `/stats` route: DAU, MAU, retention, tx breakdown, revenue, failed-tx.
- Regex sweep de jargon prohibido en `editorial.ts` + i18n.
- Audit identidad primaria — refactor Account/Leaderboard/Share si exponen `0x…`.

**Sprint C — Soporte + deploy Phase D (1 semana)**
- AI agent Telegram intake.
- LabyrinthBadges Phase D deploy a Sepolia → audit → mainnet.
- Update submission doc con LabyrinthBadges en lista de contratos verificados.

**Sprint D — Submission (1 día)**
- Re-validar checklist Stage 1 end-to-end en device físico.
- Enviar intake form `https://minipay.to/mini-apps`.
- Outreach paralelo a Verda Ventures (`team@verda.ventures`).

Total: ~3 semanas de trabajo concentrado para llegar listo. Apurarse para enviar antes baja la probabilidad de aprobación.

---

## Referencias

- Oficial: `https://minipay.to/mini-apps` (Stage 1)
- Skill: `~/.claude/skills/celopedia-skill/references/minipay-requirements.md`
- Deeplinks: `https://docs.minipay.xyz/technical-references/deeplinks.html#available-deeplinks`
- Fee abstraction adapters: `~/.claude/skills/celopedia-skill/references/minipay-guide.md`
- Funding: Verda Ventures `team@verda.ventures` ($25K MiniPay Builder Fund); Proof of Ship mensual
- Internal: `docs/minipay-submission.md`, `docs/network-manifest.md`, `docs/submission/minipay-form-answers.md`, `docs/submission/minipay-validation-runbook.md`
