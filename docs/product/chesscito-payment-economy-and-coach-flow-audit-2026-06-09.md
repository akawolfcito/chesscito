# Chesscito — Auditoría de pagos, economía y consumo de recursos

> 2026-06-09. Auditoría **read-only** (cero código tocado) pedida tras validar el
> Stablecoin Direct Payment Rail. Objetivo: ordenar SaveScore, Victory, Coach y la
> economía de Peones ANTES de seguir con features. Recomendar, no implementar.
>
> Contexto validado: rail funciona — MiniPay+cUSD ✅, MetaMask/web+USDT ✅, 1 tx sin
> approve ✅, `/api/verify-payment` acredita Peones ✅.

## 0. Principio de producto (marco)

Separar **dos planos** y no mezclarlos:

- **Gameplay fluido / leaderboard** → baja fricción: off-chain/server-side, puede
  costar Peones, **nunca** approve/tx en la continuidad natural del juego.
- **Prestige on-chain** → puede requerir contrato/tx: Victory NFT, proof on-chain
  especial, claim de top semanal, trofeos permanentes. **Opcional, no el flujo base.**

Hipótesis confirmada por el audit: hoy `SaveScore` viola este principio (mete una tx
on-chain + endpoint de firma rate-limited en el flujo base). Victory está bien (es
prestige y ya está desacoplado).

---

## 1. Archivos / flows encontrados

**SaveScore**
- UI: `src/components/exercises/exercises-screen.tsx` → `handleSubmitScore()` (~1632-1733);
  botones en `ContextualActionSlot`, `PieceCompletePrompt`, `BadgeEarnedPrompt`.
- Firma: `src/app/api/sign-score/route.ts` (EIP-712 `Scoreboard`).
- On-chain: `src/lib/contracts/scoreboard.ts` → `submitScoreSigned(...)` (nonpayable, sin approve).
- Off-chain: `src/app/api/cache-score/route.ts` → Supabase (`scores`), fire-and-forget.
- Leaderboard: `src/lib/server/leaderboard.ts` + `/api/leaderboard` → lee de **DB** (`leaderboard_v`), NO de la cadena.
- Rate limit: `src/lib/server/demo-signing.ts` `enforceRateLimit(ip, player)`.

**Victory**
- Hook: `src/lib/coach/use-mint-victory.ts` (state machine completa).
- Firma: `src/app/api/sign-victory/route.ts` (EIP-712 `VictoryNFT`, valida el mate por replay).
- On-chain: `src/lib/contracts/victory.ts` → `mintSigned(...)`; approve+transferFrom ERC-20.
- UI: `src/components/arena/victory-celebration.tsx` / `arena-end-state.tsx` /
  `victory-claim-success.tsx` / `victory-claim-error.tsx`; tile en `coach/game-actions-bar.tsx`.
- Off-chain: `src/app/api/cache-victory/route.ts` → Supabase (`victories`).

**Coach**
- Endpoint: `src/app/api/coach/analyze/route.ts`.
- Hook: `src/lib/coach/use-coach-analysis.ts`; gateway `request-coach-analyze.ts`.
- Viewer: `src/app/[locale]/coach/[gameId]/coach-game-client.tsx`.
- Local (sin API): `src/lib/coach/fallback-engine.ts` `generateQuickReview()`.
- Peones spend: `src/lib/peones/coach-spend-fallback.ts`.

---

## 2. Diagnóstico SaveScore

- **Qué hace:** firma EIP-712 (`/api/sign-score`) → el cliente manda una **tx on-chain**
  `submitScoreSigned` al contrato `Scoreboard` (gasful, **sin approve**) → además escribe
  a Supabase (`/api/cache-score`, fire-and-forget) → entrada optimista en sessionStorage.
- **Datos:** `player, levelId, score, timeMs, nonce, deadline`. On-chain + DB.
- **¿On-chain necesario?** **No para el leaderboard.** El ranking ya se sirve **desde la DB**
  (`leaderboard_v`), con un flag `is_verified`. La escritura on-chain es, para ranking,
  **redundante** — su único valor real es "proof verificado".
- **¿Por qué falla ahora?** **429 del rate-limiter de firma**, NO approve/send/gas/contrato/UI.
  Política: **5 req/60s por IP + 3 req/60s por wallet** (`demo-signing.ts`). Confirmado:
  `[MiniPayTx] error {label:'submit-score', error:'Rate limit exceeded'}`.
- **Amplificador:** el botón "Try again" del error re-dispara `handleSubmitScore()` **sin
  backoff** → vuelve a pegarle al mismo bucket → 429 en loop hasta esperar 60s.
- **¿Mezcla save con mint/trofeo?** **No.** Save, badge-claim y Victory son paths separados.
- **Fricción base:** sí — el save básico exige firma rate-limited + 1 tx on-chain (confirmación
  en wallet) en la continuidad del juego. Viola el principio §0.

**Veredicto:** SaveScore **no debería ser on-chain en el flujo base**. Debe **dividirse en dos**:

```txt
Save Score básico  → off-chain/server-side (ya escribe a DB; el leaderboard ya lee de DB)
                     costo: 0 o pocos Peones · sin approve · sin tx on-chain obligatoria
On-chain Proof/Trophy → opcional (top semanal, top 10/3, "inmortalizar partida")
                     contrato/NFT/rail según diseño futuro · marca is_verified
```

Respuestas directas: **¿mantener on-chain?** No como base. **¿migrar a off-chain/Peones?** Sí
el básico. **¿dividir en dos flows?** Sí — básico off-chain + proof on-chain opcional.

---

## 3. Diagnóstico Victory

- **Qué hace:** mint de **Victory NFT (ERC-721)** vía `mintSigned`. Firma server valida el
  jaque mate por replay de SAN; el cliente lee allowance → **approve si falta** → `mintSigned`
  (el contrato hace `transferFrom` del stablecoin) → cachea en Supabase.
- **¿NFT? ¿buyItem?** NFT mint propio (no Shop.buyItem), pero **mismo modelo approve +
  transferFrom** (no rail directo). Tokens USDC/USDT/cUSD. Precios Easy $0.005 / Medium $0.01 /
  Hard $0.02.
- **¿Por qué approve?** El `VictoryNFT` cobra con `transferFrom`, que exige autorización previa
  (delegación ERC-20). Es el modelo "pesado", distinto del rail (transfer directo, sin approve).
- **¿Separado de SaveScore?** **Completamente** — tablas, contratos y firma distintos. El
  leaderboard lee solo de `scores`, **no** de `victories`. Mintear victoria no toca el ranking.
- **Cancel UX:** **buena** — estados `cancelled` ("Paused", polite), `timeout`, `error`
  diferenciados; `AddCashCta` (deeplink MiniPay) en insufficient. No filtra errores crudos.
- **¿Puede quedarse como prestige?** **Sí**, ya lo está: no es requisito de leaderboard ni score.

**Veredicto:** mantener Victory **on-chain como prestige por ahora**. Único punto a vigilar a
futuro: el approve+transferFrom podría migrar al rail directo (1 tx) cuando rediseñemos pagos,
pero **no ahora** (out of scope). No bloquea nada del flujo base.

---

## 4. Diagnóstico Coach auto-run (HALLAZGO CRÍTICO)

**SÍ hay auto-run de la API real, sin click.** Severidad **ALTA** (consume crédito/Peones/$).

- **Dónde:** `coach-game-client.tsx` `useEffect` (~305-312) llama `coach.askCoach("viewer")`
  automáticamente al montar `/coach/[gameId]` cuando: hay wallet conectada, `gameRecord.analysis
  === null`, y `coach.phase === "idle"`. No hay gate de intención.
- **Por qué se dispara al reingresar/cancelar Victory:** al cerrar (X) el popup de Victory,
  `arena/page.tsx` hace `router.push(/coach/{gameId})`. Si el análisis aún no está cacheado
  (race con la persistencia en Redis, cold-load, bookmark, o expiró a 30d), el `useEffect`
  **dispara la API**. `autoLoadAnalysisRef` evita el doble-fire, pero **no** el primero.
- **Local vs API:** boundary claro — sin `gameId` u offline → `generateQuickReview()` local
  (gratis, sin API). Con `gameId` + online → **API real** (cuesta 1 crédito / 1 Peón).
- **PRO:** salta el welcome modal y hace `void startCoachAnalysis()` directo (use-coach-analysis
  ~375-378). PRO no paga, pero igual **dispara sin tap explícito** en ese path.
- **Gating:** orden correcto (seed 3 créditos → PRO bypass → Peones → Redis → 402 paywall),
  **pero el auto-load lo saltea**: si hay créditos o PRO, **consume en silencio**.
- **Señal en telemetría:** `coach_analyze_request{source:"viewer"}` **sin** un
  `coach_viewer_ask_coach_tap` previo = auto-run no intencional.

**Veredicto:** el Coach real **debe ser user-triggered**. Hay que **quitar/gatear** el
auto-load del viewer.

**Cómo gatear (recomendación):**
1. **No** llamar `askCoach("viewer")` en el `useEffect` de cold-load. En su lugar: render del
   **Quick Review local** (gratis, instantáneo) + botón explícito **"Ask Coach"**.
2. La API real solo dispara con tap en `Ask Coach` / `Why did you win?` / `Analyze`
   (entradas `immediate` / `victory-mint` / `history` ya son user-triggered — se mantienen).
3. **PRO:** que el salto de welcome **no** auto-arranque el análisis; mostrar el botón con copy
   **"Included with PRO"** (acción explícita, no "gratis/infinito"). Free: botón con costo en
   Peones o upsell.
4. Nada de auto-run al cerrar partida, cancelar Victory, reabrir pantalla o entrar al review.

**Dónde vive el trigger manual:** el CTA "Ask Coach" del viewer (ya existe el evento
`coach_viewer_ask_coach_tap`); solo hay que dejar que el cold-load **no** lo dispare solo.

---

## 5. Payment / economy matrix

| Flow | Mecanismo actual | ¿Approve? | ¿Gameplay base? | ¿Peones/rail directo? | Recomendación |
|---|---|---:|---:|---:|---|
| Get Peones | Stablecoin direct rail | No | Sí (compra) | Sí | **Keep** |
| SaveScore (básico) | EIP-712 + tx on-chain `Scoreboard` | No | Sí | **Sí, off-chain/Peones** | **Migrar a off-chain** |
| Score Proof/Trophy | (no existe aún) | — | No, prestige | Sí (futuro) | **Nuevo, opcional** |
| Victory NFT | `sign-victory` + approve + `mintSigned` | **Sí** | No, prestige | Más adelante | **Keep on-chain** |
| Coach real/API | Créditos → Peones → PRO | No tx | Opcional/manual | Peones/PRO | **Gate manual (quitar auto-run)** |
| Local review | Reglas locales | No | Sí | Gratis | **Keep** |
| Founder Badge | Shop/contract | Sí | No | No ahora | **Keep legacy** |
| PRO | `/api/pro/status` + compra | TBD | Opcional | Posible | **Wave 2** |

Insight transversal: el leaderboard **ya** es DB-backed, así que mover SaveScore a off-chain
es bajo riesgo (la fuente de verdad del ranking no cambia).

---

## 6. Dirección de la economía de Peones

Estado: se ganan con ejercicios/daily; ya se compran (50 = $0.50). Falta **gasto** real → sin
sinks, los Peones se acumulan y pierden valor. Proponer sinks **útiles**, no artificiales:

| Sink | Tipo | Costo tentativo |
|---|---|---:|
| Hint básico | Ayuda gameplay | 1 |
| Coach real/manual | Insight/API | 1–3 (o PRO bypass) |
| Deep Hint | Ayuda premium | 3 |
| Save Score enhanced / leaderboard entry | Utility | 1–2 |
| Streak Shield | Retención | 5 |
| Theme/cosmetic unlock | Vanity | 50–100 |
| On-chain Score Proof / Trophy | Prestige | stablecoin/rail/NFT (no decidir ahora) |

**Packs:** `peones_pack_50` = $0.50→50 (live). `peones_pack_100` = $1.00→100 (siguiente).
`peones_pack_500` futuro. **No** agregar más packs hasta validar el **gasto** primero.

Recomendación: arrancar con **1–2 sinks** ya soportados por el producto (Coach manual = el sink
natural #1, porque ya existe el spend de Peones; Deep Hint o Streak Shield como #2). Calibrar
con datos antes de sumar el resto.

---

## 7. Prioridad recomendada

Entre A) hotfix SaveScore · B) score off-chain/Peones · C) separar Victory de score ·
D) gate Coach auto-run · E) finish Get Peones handoff/promote · F) más packs ·
G) Deep Hint/más sinks · H) Labyrinths:

1. **D — Gate Coach auto-run.** Es bleed silencioso de API/$ y va contra la regla "user-triggered".
   Mayor valor, menor esfuerzo, sin tocar contratos. **Primero.**
2. **A→B — SaveScore.** Diagnóstico ya hecho (429 del rate-limiter). Decidir y mover el básico a
   **off-chain/Peones** (B); A (hotfix de backoff/copy del 429) solo si necesitamos un parche
   inmediato mientras llega B.
3. **E — Cerrar Get Peones (handoff + promote).** Surface listo; cerrarlo libera el bloque.
4. **G (parcial) — 1–2 sinks** (Coach manual como sink #1; un segundo sink calibrado).
5. **C** confirmar separación Victory (ya está; esfuerzo casi nulo) y **H — Labyrinths** al final.

Coincide con tu preferencia: Coach auto-run → SaveScore → Get Peones → 1–2 sinks → Labyrinths.

---

## 8. Riesgos

- **Coach auto-run** (ALTO): cada cold-load sin cache consume crédito/Peón sin consentimiento;
  erosiona confianza y costo de API. Mitigación: §4.
- **SaveScore 429 loop** (MEDIO): el "Try again" sin backoff empeora el rate limit; mala UX en
  la continuidad del juego.
- **Migración de score** (MEDIO): mover a off-chain debe preservar `is_verified` y no romper la
  vista `leaderboard_v` ni la entrada optimista; requiere TDD sobre el path DB.
- **Economía sin sinks** (MEDIO): seguir vendiendo packs sin gasto real degrada el valor del Peón.
- **Victory approve** (BAJO, diferido): friction de 2 pasos, aceptable como prestige; migrar al
  rail es futuro, no ahora.
- **Confusión de primitivas** (BAJO): documentado en `2026-06-09-tx-primitives-and-shop-direction.md`.

---

## 9. Próximo commit recomendado

**Gate del Coach auto-run** (item D): en `coach-game-client.tsx`, reemplazar el `useEffect` que
llama `askCoach("viewer")` por: mostrar el **Quick Review local** + CTA explícito **"Ask Coach"**
(con copy "Included with PRO" para PRO). Sin auto-fire de la API en cold-load / post-cancel /
re-entry. Es el cambio de mayor valor, aislado, sin contratos ni economía. TDD: test que afirme
que montar el viewer sin análisis **no** dispara `/api/coach/analyze` y que el tap **sí**.

---

## 10. Confirmación

**Cero código tocado.** Esta auditoría es solo análisis + recomendación. No se modificaron
contratos, endpoints, hooks ni UI. Implementación pendiente de tu aprobación del orden en §7.

## 11. Out of scope (confirmado)

No Labyrinths · no P2P · no tipping · no cambiar contratos sin aprobación · no migrar Victory NFT
todavía · no rail nativo CELO/ETH/AVAX · no economía con muchos sinks sin calibración.
