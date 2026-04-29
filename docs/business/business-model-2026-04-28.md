# Chesscito — Modelo de Negocio MVP

**Fecha:** 2026-04-28
**Autor:** Análisis estratégico (Claude + Wolfcito)
**Estado:** Propuesta para validación
**Alcance:** Aterrizar un modelo comercial simple, reutilizando lo que ya existe en producción.

---

## 0. Tesis ejecutiva

> **Chesscito no necesita primero más features; necesita empaquetar lo que ya existe en una oferta comercial clara, con un camino simple de pago para MiniPay y Web.**

El producto ya tiene tres motores de ingreso desplegados en Celo Mainnet (VictoryNFT, Shop multi-token, Coach con créditos), pero todos funcionan a precios de "demo" (USD 0.005–0.10). El cuello de botella **no es técnico**: es que ningún SKU está empaquetado como un producto que un usuario o partner identifique como "esto vale la pena pagar".

El siguiente paso comercial no requiere reescribir nada. Requiere:

1. **Definir un SKU principal** con ticket mayor (Chesscito PRO mensual).
2. **Encender Coach** (ya construido, oculto detrás de flag) como compra recurrente complementaria.
3. **Cobrar en stablecoins** vía el contrato `ShopUpgradeable` que ya soporta arbitrary itemIds + USDC/USDT/cUSD/CELO + treasury split.

Con eso, en **una semana de trabajo sin tocar contratos**, hay producto comercial validable.

---

## 1. Diagnóstico honesto del estado actual

### 1.1 Qué hay LIVE en Celo Mainnet

| Componente | Estado | Comentario |
|---|---|---|
| `VictoryNFTUpgradeable` | ✅ Mainnet | NFT al ganar Arena. $0.005/$0.01/$0.02. 80/20 treasury/prize-pool hardcoded. |
| `ShopUpgradeable` (proxy) | ✅ Mainnet | Multi-token, multi-itemId, configurable sin redeploy. |
| `BadgesUpgradeable` | ✅ Mainnet | Badges soulbound por nivel. No-monetario directo. |
| `ScoreboardUpgradeable` | ✅ Mainnet | Leaderboard firmado off-chain, persistido on-chain. |
| Founder Badge (itemId 1) | ✅ | $0.10. Pagable USDC/USDT/cUSD; CELO via itemId 5 helper. |
| Retry Shield (itemId 2) | ✅ | $0.025, 3 usos a localStorage. |
| Coach pack 5 créditos (itemId 3) | ✅ Contrato listo | $0.05. UI **oculta** detrás de `NEXT_PUBLIC_ENABLE_COACH`. |
| Coach pack 20 créditos (itemId 4) | ✅ Contrato listo | $0.10. UI **oculta**. |

### 1.2 Surfaces de producto

- `/` → redirect `/play-hub`
- `/play-hub` — ejercicios pre-ajedrez (Torre + tutorial)
- `/arena` — partida completa vs IA (3 dificultades, persistencia 24h, juega como blanco/negro)
- `/trophies` — Hall of Fame + Achievements (7 derivadas) + MyVictories
- `/leaderboard` — top-10 firmado on-chain, cacheado Supabase
- `/victory/[id]` — landing pública por NFT (compartible)
- `/about`, `/why`, `/support`, `/privacy`, `/terms`

### 1.3 Funcionalidades **monetizables HOY** (sin código adicional)

1. **Mint VictoryNFT** — micropago al ganar (live).
2. **Founder Badge** — one-time identity flex (live).
3. **Retry Shield** — consumible defensivo (live).
4. **Coach packs** — créditos de análisis IA (contrato live, **UI oculta**).

### 1.4 Funcionalidades **incompletas / sobre-construidas**

| Item | Diagnóstico | Recomendación MVP |
|---|---|---|
| Coach (OpenAI 6.32 + paywall + history + verify-purchase) | ✅ Construido. Oculto por flag desde hace semanas. | **Encender en Web primero**, validar conversión, luego MiniPay. |
| Prize pool 20% acumulado | Sin método de distribución on-chain. Editorial lo menciona como roadmap. | **Pausar** hasta tener mecánica de torneo. Por ahora es solo treasury. |
| Soporte multi-stablecoin completo (USDT, cUSD) | Soportado en contrato; UI prioriza USDC. | OK como está. No tocar. |
| Encrypted signer key (TORRE_PRINCESA + DRAGON) | Spec + crypto.ts listos; integración pendiente con flujo real. | Diferir, no bloquea ingresos. |
| Talent Protocol verification | Meta tag listo. Sin uso comercial directo. | Solo para credibilidad B2B. |

### 1.5 Diferencias canal MiniPay vs Web

| Capacidad | MiniPay | Web (URL directa) |
|---|---|---|
| Onboarding wallet | Cero fricción (wallet ya inyectada) | RainbowKit, alta fricción |
| Pago en stablecoins | ✅ USDC/USDT/cUSD | ✅ |
| Pago en CELO nativo | ❌ Por spec MiniPay (stablecoin-only) | ✅ Vía itemId helper 5 |
| Volumen esperado | Alto (audiencia LATAM/África Celo) | Bajo, técnico |
| AI features (Coach) | Funciona pero red más lenta | Mejor UX |
| Compras grandes ($1+) | Posible pero cultura de micropagos | Más natural |

---

## 2. Inventario de activos reutilizables

### 2.1 La joya: `ShopUpgradeable` es genérico

El contrato actual ya permite:

- Crear cualquier `itemId` nuevo con `setItem(id, priceUsd6, true)` desde admin.
- Aceptar cualquier ERC-20 con `setAcceptedToken(addr, true)`.
- Emitir `ItemPurchased` con buyer/itemId/token → la verificación off-chain ya existe en `/api/coach/verify-purchase`.
- Split 100% al treasury (configurable via setTreasury).

**Implicación:** cualquier SKU nuevo (PRO mensual, pack educativo, ticket de torneo) **NO requiere redeploy**. Solo:

1. `setItem(N, priceUsd6, true)` desde admin wallet.
2. Añadir entry en `apps/web/src/lib/contracts/shop-catalog.ts`.
3. Añadir verificación off-chain en `/api/...` (copy-paste de coach/verify-purchase).
4. Granting backend (Supabase row, Redis flag, lo que aplique).

### 2.2 Tabla precio actual vs necesidad de negocio

| SKU | Precio actual | Revenue/100 ventas | Comentario |
|---|---|---|---|
| Victory Easy | $0.005 | $0.50 | Novelty mint |
| Victory Hard | $0.02 | $2.00 | Novelty mint |
| Founder Badge | $0.10 | $10 | One-time |
| Retry Shield | $0.025 | $2.50 | Consumible micro |
| Coach pack 5 | $0.05 | $5 | Micro |
| Coach pack 20 | $0.10 | $10 | Micro |

**Conclusión:** ningún SKU actual sostiene el proyecto. Falta **al menos un SKU de ticket medio** ($1–$5/mes). Esa es la oportunidad principal del MVP comercial.

---

## 3. Distinción crítica: Modelo de Negocio vs Modelo de Pagos

Esta separación evita confundir "qué vendemos" con "cómo cobramos". Son dos decisiones independientes.

### 3.1 Modelo de Negocio (cómo Chesscito gana dinero)

Es la **propuesta de valor empaquetada**. Responde: *¿qué obtiene el usuario a cambio?*

Opciones evaluadas:

| Modelo | Descripción | Encaje con Chesscito hoy |
|---|---|---|
| **Freemium + PRO mensual** | Juego gratis; PRO desbloquea Coach ilimitado, badge exclusivo, sin límite de retries. | ⭐ Mejor encaje. Reutiliza Coach + Shop + Badges. |
| **Créditos / consumibles** | Coach packs, Shields, boost de leaderboard. | ⭐ Ya existe contrato. Complemento natural a PRO. |
| **Compras de items cosméticos** | Tableros premium, skins de piezas, marcos NFT. | Requiere arte adicional + pipeline. **Pausar.** |
| **Torneos pagados** | Ticket de entrada → prize pool 20% ya existente. | Requiere matchmaking + distribución on-chain. **Fase 2.** |
| **Patrocinios / partners** | Branding en Arena, badges patrocinados, contenido educativo. | Posible vía Founder Badge re-tematizado. **Fase 2 B2B.** |
| **B2B colegios/fundaciones** | Licencia mensual, dashboard educativo, métricas de aprendizaje. | Construible sobre Supabase actual. **Fase 2 alta-ticket.** |
| **Packs educativos one-shot** | "Curso de aperturas Coach-asistido" — 50 créditos + contenido. | Reutiliza Coach. Bajo esfuerzo. **Fase 1.5.** |

### 3.2 Modelo de Pagos (cómo se cobra técnicamente)

Es el **rail técnico**. Responde: *¿qué pasa cuando el usuario aprieta "Pagar"?*

| Canal | Token | Mecanismo | Estado |
|---|---|---|---|
| **MiniPay** | USDC, USDT, cUSD | `ShopUpgradeable.buyItem(id, qty)` con approve previo | ✅ Live |
| **Web (RainbowKit)** | USDC, USDT, cUSD | Idem MiniPay | ✅ Live |
| **Web (CELO nativo)** | CELO | itemId helper con priceUsd6 inflado para compensar normalización | ✅ Live (Founder Badge) |
| **Recurrencia mensual (PRO)** | Stablecoin | **A definir** — opciones: pago único renovable, suscripción onchain, off-chain Stripe | 🟡 Pendiente (ver §6) |

**Insight clave:** el modelo de negocio puede evolucionar (PRO → torneos → B2B) sin tocar el modelo de pagos. El rail `ShopUpgradeable` + verify off-chain es suficiente para los próximos 6–12 meses.

---

## 4. Matriz de criterios de decisión

Para cada modelo candidato, evaluar contra:

| Criterio | Peso | Por qué importa |
|---|---|---|
| Menor desarrollo | ⭐⭐⭐ | Time-to-revenue |
| Reutiliza contratos actuales | ⭐⭐⭐ | No requiere auditoría nueva |
| Funciona en MiniPay | ⭐⭐⭐ | Es el canal de distribución principal |
| Puede venderse a partners | ⭐⭐ | Diversifica ingresos B2B |
| Evita nueva arquitectura | ⭐⭐⭐ | Reduce riesgo y mantenimiento |

**Aplicación a candidatos:**

| Modelo | Menor dev | Reutiliza | MiniPay | Partners | Sin arq nueva | TOTAL |
|---|---|---|---|---|---|---|
| **PRO mensual** | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| **Coach credits (encender)** | ✅✅ | ✅ | ✅ | — | ✅ | **4/5** |
| Cosméticos NFT | ❌ (arte) | ✅ | ✅ | — | ✅ | 3/5 |
| Torneos pagados | ❌ (matchmaking + distribución) | ⚠️ (parcial) | ✅ | ⚠️ | ❌ | 2/5 |
| B2B educativo | ⚠️ (dashboard) | ✅ | N/A | ✅✅ | ⚠️ | 3/5 |
| Patrocinios | ✅ | ✅ | ✅ | ✅✅ | ✅ | **5/5** (pero requiere outbound sales) |

**Ganadores claros para MVP:** PRO mensual + Coach credits. Patrocinios como track paralelo no técnico.

---

## 5. Modelo recomendado — Propuesta principal

### 5.1 SKU principal: **Chesscito PRO mensual**

**Pitch al usuario:** "Por menos del precio de un café, juega Chesscito sin límites con tu coach IA personal."

**Precio sugerido:** **USD 1.99/mes** (en stablecoin). Justificación:
- 20× más alto que el SKU más caro actual ($0.10 Founder Badge).
- Aún accesible para audiencia MiniPay (LATAM/África).
- Tickets de mayor monto generan menos sensibilidad a fees de gas en Celo.

**Qué incluye PRO:**

| Beneficio | Reutiliza |
|---|---|
| Coach IA ilimitado por mes | Coach (ya construido, ahora encendido) |
| Retry Shield infinito en Arena | Lógica localStorage existente |
| Badge "PRO" mensual visible en leaderboard | Badges contract |
| Sin cooldown entre partidas Hard | Engine actual |
| Mint Victory NFT a precio cero (gas only) | VictoryNFT (signature endpoint) |

**Implementación técnica MVP:**

1. Crear `itemId 6` = PRO mensual, `priceUsd6 = 1_990_000`.
2. `setItem(6, 1_990_000, true)` desde admin.
3. Backend: tras `ItemPurchased` para itemId 6 → set Redis `pro:expires:<addr>` a `now + 30 días`.
4. UI: comprobar `pro:expires` antes de cobrar Coach / mostrar badge PRO.
5. Renovación: usuario re-compra manualmente. **No on-chain subscriptions en v1.** (Off-chain Stripe-style autopay = Fase 2.)

**Por qué pago único renovable y NO suscripción onchain:**
- ERC-20 approve infinito + pull payments = mucha más complejidad.
- Cultura crypto actualmente acepta "renovación manual mensual".
- Mantiene el contrato genérico (no necesita un `Subscriptions.sol` nuevo).

### 5.2 SKU complementario: **Coach Credits**

Mantener Coach packs ($0.05 / $0.10) para usuarios free que quieran probar sin comprometerse a PRO. Funciona como funnel: free → credit → PRO.

### 5.3 Roadmap del SKU principal en 1 frase

> Encender Coach + crear itemId 6 (PRO) + UI de paywall = **5 commits, 1 semana, 0 redeploys de contrato**.

---

## 6. Modelos alternativos (priorizados)

### Alternativa B — Patrocinios / B2B educativo (track paralelo)

**Cuándo activar:** cuando haya 100+ usuarios PRO activos = caso de uso demostrable.

**Mecánica:**
- Founder Badge re-tematizado como "Sponsored by [Partner]".
- Dashboard de métricas de aprendizaje en Supabase (ya tenemos el schema).
- Licencia colegio: $50–200/mes por aula.

**Esfuerzo:** medio. **Bloqueador real:** outbound sales, no código.

### Alternativa C — Torneos con prize pool (Fase 2)

**Cuándo activar:** cuando el prize pool acumulado pase de $50 (sostenible a 5+ rondas).

**Mecánica:**
- Ticket de entrada $1 → contrato.
- Top 3 reciben split del pool acumulado.
- Requiere: `Tournament.sol` nuevo (matchmaking off-chain, distribución on-chain).

**Esfuerzo:** alto. Requiere auditoría nueva. **Posponer hasta validar PRO.**

---

## 7. MiniPay vs Web — Estrategia de canales

### 7.1 Principio: una sola codebase, dos rutas de pago

Toda la lógica de producto es idéntica. Solo cambia el conjunto de tokens ofrecidos en el botón de "Pagar".

| Surface | MiniPay | Web |
|---|---|---|
| /play-hub | ✅ Idéntico | ✅ Idéntico |
| /arena | ✅ Idéntico | ✅ Idéntico |
| Mint Victory | ✅ Stablecoin | ✅ Stablecoin + CELO |
| Founder Badge | ✅ Stablecoin | ✅ Stablecoin + CELO |
| Coach packs | ✅ Stablecoin | ✅ Stablecoin |
| **PRO mensual** | ✅ Stablecoin (USDC/USDT/cUSD) | ✅ Stablecoin + CELO via itemId helper |
| Coach UI | ⚠️ Más lento por red | ✅ |

### 7.2 Detección de canal

Ya existe heurística (RainbowKit no aparece en MiniPay porque la wallet está inyectada). Reutilizar para condicionar UI de tokens:

- **MiniPay detected** → mostrar solo botón "Pagar con USDC".
- **Web** → mostrar selector USDC / USDT / cUSD / CELO.

Esto **ya está implementado parcialmente** en `lib/contracts/tokens.ts` (CELO route separada). Solo falta consolidar el UX.

### 7.3 No duplicar nunca

- **No** crear `/minipay/play-hub` separado.
- **No** mantener dos sets de SKUs.
- **Sí** condicionar el `<TokenSelector>` por contexto detectado.

---

## 8. Herramientas externas — recomendación técnica

### 8.1 Uniswap

**Recomendación: NO integrar en MVP.** Razones:

- El usuario ya tiene la stablecoin necesaria (es el supuesto de MiniPay).
- Añadir swap intra-app aumenta superficie de auditoría y dependencias.
- Uniswap v3/v4 router en Celo no es el rail más natural del ecosistema.

**Cuándo reconsiderar:** Fase 3+, si se quiere aceptar tokens arbitrarios y convertir a stablecoin server-side. Tooling de referencia: `developers.uniswap.org` (consultar pero no implementar ahora).

### 8.2 Mento

**Recomendación: evaluar para Fase 2** si surge necesidad real de swap CELO ↔ cUSD.

Razones a favor:
- Nativo del ecosistema Celo (mismo equipo que cUSD).
- Más simple que Uniswap routers.
- Liquidez profunda para cUSD/CELO específicamente.

**Para MVP:** no necesario. Pago directo en stablecoins cubre el 100% de los casos.

### 8.3 Suscripciones recurrentes (PRO autopay)

**Para MVP:** renovación manual.

**Para Fase 2 (si retención lo justifica):**
- Opción A: pull payments con allowance (riesgo de seguridad).
- Opción B: integrar **Sablier** o **Superfluid** (streaming payments en Celo).
- Opción C: off-chain billing (Stripe → mintea on-chain). Híbrido.

---

## 9. Roadmap MVP — 3 fases

### Fase 0 — Preparación (1 semana, sin código de contrato)

**Objetivo:** PRO en producción, validar willingness-to-pay.

- [ ] Definir copy completo de PRO en `editorial.ts` (`PRO_COPY`).
- [ ] Admin: `setItem(6, 1_990_000, true)` en Celo Mainnet.
- [ ] Backend: `/api/verify-pro` (copia de `verify-purchase` adaptado).
- [ ] Backend: helper `lib/pro/is-active.ts` (lee Redis `pro:expires:<addr>`).
- [ ] UI: card PRO en `/play-hub` + paywall en Coach.
- [ ] Encender `NEXT_PUBLIC_ENABLE_COACH=true` en Web.
- [ ] Telemetría: tracking de impresiones / clicks / compras.

**Métrica de éxito:** 10 compras de PRO en los primeros 30 días = señal de demanda.

### Fase 1 — Ampliar el funnel (2 semanas)

- [ ] Encender Coach también en MiniPay.
- [ ] Pack educativo "Aperturas con Coach" — itemId 7, $2.99 one-time.
- [ ] Email opcional para recordatorio de renovación PRO (Supabase).
- [ ] Dashboard básico de revenue en `/admin` (gated por wallet allowlist).

**Métrica de éxito:** 30% de usuarios free intentan al menos 1 análisis Coach.

### Fase 2 — Diversificar (1–2 meses)

- [ ] Outbound a 3 colegios / fundaciones piloto (B2B).
- [ ] `Tournament.sol` minimal (1 torneo/mes, prize pool fixed).
- [ ] Founder Badge edición patrocinada (1 partner).
- [ ] Evaluar Mento si llega tracción que justifique multi-token swap.

---

## 10. Riesgos y próximos commits

### Riesgos principales

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Nadie paga $1.99/mes | Media | Validar en 30 días con Fase 0; ajustar precio o beneficios. |
| MiniPay rechaza recurrencia manual | Baja | Coach packs ($0.05) son fallback ya aprobado. |
| Coach OpenAI cost > revenue | Media | Cap por usuario PRO (ej. 100 análisis/mes); Redis enforced. |
| Treasury wallet comprometida | Baja | Multisig recomendado (no bloqueante para MVP). |
| Cumplimiento (KYC/AML) en B2B | Media | Diferir hasta primer partner real; consultar. |

### Próximos commits sugeridos (orden de ejecución)

1. **`feat(editorial): add PRO_COPY constants`** — texto completo del SKU PRO.
2. **`feat(shop): register itemId 6 (PRO monthly) in catalog`** — `shop-catalog.ts`.
3. **`feat(api): add /api/verify-pro endpoint`** — verifica tx + activa Redis flag.
4. **`feat(pro): add lib/pro/is-active.ts helper`** — utility para gating UI.
5. **`feat(coach): wire PRO bypass to skip credit consumption`** — PRO = unlimited Coach.
6. **`feat(play-hub): add PRO upgrade card`** — primer surface de venta.
7. **`feat(coach): enable in production (remove flag)`** — flip el switch.
8. **`feat(telemetry): track PRO funnel events`** — instrument para validar.

Cada commit es atómico, testable, sin redeploy de contrato.

---

## Apéndice — Checklist de validación antes de codear

Antes de tocar el primer commit, confirmar con el equipo:

- [ ] ¿Precio $1.99/mes está OK o queremos $0.99 / $2.99?
- [ ] ¿Quién es el admin que ejecuta `setItem(6, ...)` en mainnet?
- [ ] ¿Treasury wallet sigue siendo la actual o cambia para PRO revenue separado?
- [ ] ¿Coach se enciende primero en Web o MiniPay simultáneo?
- [ ] ¿OK con renovación manual mensual en v1?

---

**Fin del documento.**
