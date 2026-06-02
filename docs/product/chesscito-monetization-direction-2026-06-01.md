# Chesscito — Dirección de Monetización (M1)

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Estado:** Documento canónico de dirección comercial.
**Alcance:** Define qué es Chesscito como producto, cómo monetiza, qué no debemos prometer, y el rol de cada capa (Free, Luz/Coach, Peones, PRO, Supporters, Victory Cards, Prize Pool).
**Fuente:** `docs/monetization/2026-06-01-strategic-audit.md`.

---

## Tesis central

> **Chesscito no monetiza cerrando el acceso. Chesscito monetiza ayudando al usuario a mejorar.**

Esa frase debe sobrevivir a cualquier decisión de producto, copy o UI. Si una decisión la rompe (cerrar el acceso para empujar al paywall, esconder valor detrás de wallet connect inmediato, vender NFTs como activo especulativo), la decisión se reescribe.

---

## 1. Qué es Chesscito desde producto

Chesscito es un **compañero pre-ajedrecístico distribuido vía MiniPay** que:

- Te enseña los movimientos básicos del ajedrez con ejercicios mobile-first.
- Te deja jugar partidas completas contra una IA local (`js-chess-engine`) en tres dificultades.
- Te da una **explicación humana de lo que pasó** en tu partida (errores, lecciones, motivos) a través de **Luz** (Coach LLM).
- Te permite **guardar tus victorias** como certificados permanentes on-chain (Victory Cards) a precios simbólicos ($0.005–$0.02).
- Te ofrece un **pase mensual PRO ($1.99 / 30 días)** que convierte a Luz en tu compañera diaria de entrenamiento.

Chesscito es **mobile-first, MiniPay-native, mainnet Celo**. Es un producto pedagógico con economía de micropagos, no un juego play-to-earn.

---

## 2. Cómo monetiza

Cuatro capas, en orden de prioridad estratégica:

1. **Luz / Coach** — motor principal de revenue. Margen 80–90% (gpt-4o-mini ≈ $0.001/análisis; packs $0.05 / $0.10).
2. **PRO** — pase mensual recurrente. ARPU sostenido. LTV alto si la retención semanal con Luz funciona.
3. **Peones / micro-ayudas** — Shields, retries, packs Coach, Welcome Pack. Frecuencia alta, ticket bajo.
4. **Supporters / Victory Cards / impacto** — retención, identidad, narrativa. No es revenue core.

**Filtro de decisión:** una superficie nueva solo se construye si entra en una de esas cuatro capas, en ese orden.

---

## 3. Qué NO es Chesscito

- **No es una academia clínica.** No tratamos demencia, Alzheimer, ni "ejercitamos el cerebro". Cero claims médicos.
- **No es una plataforma de inversión.** Las Victory Cards no son activos especulativos.
- **No es play-to-earn.** El usuario paga para aprender mejor, no juega para ganar dinero.
- **No es un casino.** No hay loot boxes ni mecánicas de azar pagadas.
- **No es un Web3 dApp tradicional.** El stablecoin es plomería; el usuario llega a aprender ajedrez, no a hacer DeFi.
- **No es una red social.** Tiene share + leaderboard, pero no es feed, no es chat, no es identidad social principal.

---

## 4. Qué NO debemos prometer

| Promesa prohibida | Razón |
|---|---|
| "Mejora tu memoria / previene Alzheimer / entrena tu cerebro" | Claim médico sin evidencia clínica. Riesgo legal + ético. |
| "Gana dinero jugando ajedrez" | No somos P2E. Prize pool actual NO se distribuye. |
| "Tu NFT subirá de precio" | Especulación sin secundario real. Victory Cards son certificados, no inversión. |
| "Prize pool de $X esta semana" | No hay distribución implementada. Comunicarlo es deuda con el usuario. |
| "IA ilimitada / IA infinita / la mejor IA del mundo" | Hype vacío. Luz es útil, no mágica. |
| "Ranking mundial / torneos oficiales / partidas rankeadas" | No existe. No prometer hasta tener. |
| "Compra ahora antes de que suba el precio" | Manipulación de urgencia falsa. |
| "Soulbound / coleccionable raro" en Founder Badge | Hoy no tiene perks. No es raro. No es soulbound. |

Toda promesa debe ser **verificable hoy en el repo y en mainnet**.

---

## 5. Rol de FREE

**Propósito:** crear hábito y retención D1/D7. **No monetiza.**

**Promesa:** "Practica gratis, todos los días, sin paywall escondido."

**Contenido:**
- Arena Easy ilimitado.
- Ejercicios pre-ajedrecísticos ilimitados (torre actualmente; bishop/knight roadmap).
- **3 créditos Coach iniciales** (Redis seed atómico — ya implementado en `coach/credits/route.ts:23-30`).
- Mercy Shield gratis tras racha de 2 derrotas (propuesto en M1, sin costo).

**Reglas:**
- Free NO debe sentirse castigado, pobre ni "demo".
- Free NO debe forzar wallet connect al inicio.
- Free NO debe romper en MiniPay si el usuario rechaza firmar.

---

## 6. Rol de LUZ / COACH

**Propósito:** convertir momentos de fricción en momentos de aprendizaje. Es el **principal motor de valor y de revenue**.

**Promesa:** "Te explica qué pasó en tu partida — y qué hacer la próxima vez."

**Cuándo debe aparecer:**
- **Después de una derrota o resignación** (loss / resign) — primer CTA en endgame, antes de "Play Again".
- **Después de una victoria** — secondary CTA "¿Por qué ganaste?" en Save Victory success.
- **En el Training Journal** — chip "Analyze" en partidas sin analizar.
- **En partidas guardadas pero no analizadas** — Coach preview en cold-load.
- **Cuando se acaban los créditos** — paywall con preview real (1 mistake con título visible), no fallback básico.

**Cuándo NO debe aparecer:**
- Durante la partida activa (no interrumpir el flow).
- En el Hub estático sin contexto de partida reciente.
- En el momento de share / celebración inmediata (no contamines la victoria con upsell).
- En el onboarding antes de que el usuario haya jugado.

**Cómo NO se comunica:**
- NO "IA ilimitada".
- NO "Powered by GPT-4 / OpenAI / LLM" en superficies de usuario.
- NO "AI coach" como hype tech — usar "Coach" o "Luz" en copy de usuario.
- NO promesas de mejora cuantificada ("subirás 200 ELO").

**Cómo SÍ se comunica:**
- "Te muestra qué pasó."
- "Aprende del que ya jugaste."
- "Tu compañera de práctica."
- "Vamos a ver qué pasó." (post-loss).

---

## 7. Rol de PEONES

**Propósito:** unidad interna de microayudas. **Reemplazo de lenguaje** del concepto frío de "credits".

**Definición:** los "peones" son la moneda blanda del juego. Sirven para:
- Pedir análisis de Coach.
- Pedir pistas (futuro).
- Activar Shields / retries.
- Guardar partidas (Victory Cards).
- Desbloqueos cosméticos pequeños (futuro).

**Estado actual:** internamente todavía existen como **créditos de Coach** + **Shields** + **inventory ítems**. Los "peones" son una **capa de lenguaje y producto**, no requieren contrato nuevo.

**Reglas:**
- El usuario ve "peones" en superficie; el sistema internamente puede mantener `coachCredits` + `shields` por separado durante M1.
- El cambio de lenguaje es **opcional** y debe validarse con copy tests; no se fuerza en M1 si introduce confusión.
- Los peones NO son fungibles on-chain (no son ERC-20). Son contadores server-side.
- Los peones NO se prometen como "moneda intercambiable" ni "token".

**Versión M1:** mantener el lenguaje actual (`Coach credits` + `Shields`) y **proponer migración a "peones" en cluster M3 (copy)** con A/B test.

---

## 8. Rol de PRO

**Propósito:** pase mensual de entrenamiento. **ARPU sostenido, LTV alto.**

**Promesa M1 (frase canónica):** "Entrena con Luz todos los días."
**Alternativa propuesta en audit §8:** "Tu coach personal de ajedrez, 6 centavos al día."

**Qué incluye PRO:**
- **Luz ilimitada** (sin consumo de peones para análisis).
- **Training Journal completo** (historial persistido en Supabase 1 año, no solo Redis hot).
- **Variantes visuales PRO** (theme system dormido en repo — fase F del roadmap).
- **Protección de hábito** (no perder progreso, no perder análisis previos).
- **Identidad PRO** (chip visible, perfil distinto).

**Cómo NO se vende:**
- NO como "suscripción" genérica.
- NO como "IA ilimitada" (hype).
- NO con dark patterns (auto-renew engañoso, cobrar antes de avisar).

**Cómo SÍ se vende:**
- Como **pase de entrenamiento** con Luz.
- Con **renovación manual** consciente (el usuario decide cada mes).
- Con **valor recurrente claro**: Luz + Journal + progreso + identidad.

**Renovación:**
- 30 días, renovación manual (no auto-renew on-chain).
- CTA "Renew" prominente si quedan < 7 días.
- Mostrar fecha exacta de expiración en Account.

**Estado técnico (deuda crítica P1):**
- Hay **lógica duplicada de compra** entre `useShopSheetState` y `exercises-screen.tsx` — debe colapsarse en M1.
- `setItem(6, 1_990_000, true)` aún requerido en mainnet para activar la compra.

---

## 9. Rol de SUPPORTERS

**Propósito:** capa de comunidad, impacto y narrativa. **No es motor de revenue inicial.**

**Estado actual:**
- **Founder Badge** ($0.10, itemId=1) está implementado pero **sin perks**. Es un evento `ItemPurchased` derivado por `useFounderStatus()` leyendo logs. **No es soulbound. No es NFT raro.**

**Decisión M1:**
- Founder Badge solo se mantiene visible si **entrega valor simbólico y/o funcional claro**.
- Si M1 no le da perks, **rediseñar como "Welcome Pack"** con bundle visible (ej: 10 peones Coach + 3 shields + perfil cosmético) — propuesta del audit §6, requiere server-side grant logic.
- Si el rediseño no entra en M1, **ocultar Founder Badge del Shop** hasta que tenga utilidad real (no vender vacío).

**Capa supporters futuro (parking lot):**
- Donaciones / tip jar al treasury.
- Sponsored tournaments.
- B2B / educación / clubes.
- Whitelabel mini-app.

Nada de esto se promete hoy.

---

## 10. Rol de VICTORY CARDS

**Propósito:** retención, identidad, share. **No es revenue core.**

**Promesa:** "Guarda tu victoria como certificado permanente."

**Frame correcto:**
- Certificado on-chain permanente.
- Costo simbólico ($0.005–$0.02).
- Asset de share (OG card).
- Trofeo personal.

**Frame prohibido:**
- "NFT coleccionable que sube de precio."
- "Activo especulativo."
- "Lo podrás vender después."
- "Edición limitada / scarcity artificial."
- "Conectado a premios" (mientras prize pool no se distribuya — ver §11).

**Estado técnico:**
- Deployed en mainnet (`0x0eE22F830a99e7a67079018670711C0F94Abeeb0`).
- Validación server-side: replay SAN + checkmate check.
- `timeMs` self-reported (aceptable a $0.02/mint, no escala a v2 sin attestation).
- 80% treasury / 20% prize pool hardcoded en contrato.

**Posición comercial:**
- Save Victory es **secondary CTA**, no primary push.
- No es la palanca de ARPU. Es la palanca de **orgullo y share**.
- ARPU directo despreciable; vale por share + retention loop.

---

## 11. Rol del PRIZE POOL

**Estado actual:** acumula USDC (20% de cada Victory mint) **pero NO distribuye.** No hay payout code, no hay countdown UI, no hay ledger de distribución.

**Decisión M1 (binding):**

> **Si no hay distribución real implementada, el prize pool debe ocultarse o neutralizarse en UI/copy.**

**Acciones concretas M1:**
- Ocultar el balance del prize pool en `ArenaSelectScaffold` hasta que exista mecanismo de distribución.
- Eliminar copy que insinúe "premios" en superficies de usuario.
- Si la balance debe verse (transparencia), renombrar a "**Treasury**" o "**Fondo del juego**" con explicación honesta de que cubre costos operativos + impacto.

**Reglas:**
- NO comunicar prize pool como promesa activa.
- NO mostrar countdown a distribución hasta tener payout implementado.
- NO usar el balance del pool como anzuelo de adquisición.

**Cluster futuro (postergado):** implementar distribución real (ledger Supabase + admin distribution UI + contract method). Ver Parking Lot §2.

---

## 12. Decisiones explícitas (M1)

| # | Decisión | Justificación |
|---|---|---|
| D1 | El motor principal de revenue es **Luz/Coach**, no PRO ni Victory Cards. | Margen alto, valor demostrable, gancho recurrente, ticket bajo. |
| D2 | PRO se posiciona como **"pase de entrenamiento con Luz"**, no como suscripción genérica. | Diferenciación + claridad de valor. |
| D3 | Los "peones" se introducen como **capa de lenguaje** en M3 (copy), no requieren contrato. | Reducir tiempo a entrega; permitir A/B test. |
| D4 | **Founder Badge** se rediseña como Welcome Pack con bundle real, o se oculta. | No vender un SKU vacío. |
| D5 | **Prize pool** se oculta o neutraliza en UI hasta tener distribución real. | Honestidad con el usuario. No prometer lo que no se entrega. |
| D6 | **Victory Cards** se comunican como certificados, no como NFT especulativo. | Frame correcto + sin claims de revalorización. |
| D7 | El upsell de Coach aparece **después de fricción real** (loss, resign, journal sin analizar, créditos en 0), nunca en momentos de celebración o durante partida activa. | Vender donde duele, no donde molesta. |
| D8 | **No se construyen contratos nuevos en M1.** Welcome Pack y prize pool distribution se postergan a M5/M6. | Tiempo de entrega; reducir superficie de auditoría. |
| D9 | **Cero claims médicos / cognitivos / de inversión.** Toda copy se filtra contra `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`. | Riesgo legal + ético. |
| D10 | Free **no se castiga.** Mercy shield + 3 créditos Coach iniciales + Easy ilimitado siguen siendo el piso. | Retención D1/D7 es prerequisito para conversión. |
| D11 | **No se cambia pricing** en M1 sin justificación + flag de "futuro". | Pricing actual está validado para MiniPay LatAm. |
| D12 | **Wallet connect no se fuerza al inicio.** Solo en momento de compra. | MiniPay UX + adquisición. |

---

## 13. Riesgos detectados

### Riesgos de producto

- **Prize pool sin distribución** es deuda activa con el usuario. Si se mantiene visible sin payout, erosiona confianza.
- **Founder Badge sin perks** vende aire. O se le da valor, o se oculta.
- **PRO sin comunicación de valor antes del paywall** = baja conversión. "Renew" sin contexto no convierte.
- **Coach paywall no se invoca consistentemente** desde Arena endgame cuando free user tiene 0 créditos (audit §2). El gancho más caliente está apagado.
- **Cambio de "credits" a "peones"** puede confundir si no se ejecuta con A/B + telemetría.

### Riesgos técnicos

- **Lógica duplicada de compra PRO** (`useShopSheetState` + `exercises-screen.tsx`) → bugs futuros.
- **Sin reconciliador** de tx pagada que falla en `/api/verify-pro` → usuario paga, no recibe PRO.
- **Sin caché de análisis Coach** por `(gameId, locale)` → reanálisis paga LLM dos veces.
- **`forceLocale`** puede gatillar reanálisis costoso → vector de abuso.
- **`/api/verify-pro` sin rate limit por wallet** (solo origin + IP).

### Riesgos comerciales / regulatorios

- **Comunicar prize pool como "premio activo"** sin distribución = falsa promesa.
- **Comunicar Victory Cards como activo de inversión** = exposición regulatoria sin upside real.
- **Claims médicos / cognitivos** = exposición legal en mercados con regulación de health claims.
- **Auto-renew implícito** en PRO sin consentimiento explícito = dark pattern.

### Riesgos operativos

- **Sin distribución real del prize pool** = compromiso pendiente que debe resolverse antes de Q3 o reformularse.
- **VictoryNFT a $0.005–$0.02** = ARPU despreciable; no es palanca de revenue.
- **Founder Badge sin scarcity ni perks** = SKU que ocupa espacio de Shop sin convertir.

---

## 14. Criterios de aceptación (M1)

Esta dirección se considera **lograda** cuando, sin tocar contratos nuevos:

- [ ] El **endgame loss/resign** muestra Coach review **antes** que Play Again.
- [ ] El **endgame win** mantiene Save Victory como secondary; Coach Review aparece como tercera opción si el usuario tiene créditos o paywall si no.
- [ ] El **Coach paywall** aparece en endgame cuando free user tiene 0 créditos, con **preview real** (al menos 1 mistake con título visible).
- [ ] El **prize pool balance está oculto o renombrado** en `ArenaSelectScaffold` hasta tener distribución.
- [ ] El **Founder Badge** está rediseñado como Welcome Pack **o** oculto en Shop.
- [ ] El **PRO chip** muestra días restantes + CTA renew si < 7 días.
- [ ] No existe ninguna copy con claims médicos / cognitivos / especulativos.
- [ ] No existe ninguna copy que prometa premios activos sin distribución.
- [ ] El **lenguaje de PRO** está alineado con "pase de entrenamiento" (no "suscripción IA").
- [ ] Telemetría base: `coach_paywall_view / dismiss / convert`, `pro_chip_tap`, `shield_granted_mercy` están enviando eventos.
- [ ] La lógica de compra PRO está consolidada en `useShopSheetState` (sin duplicado en `exercises-screen.tsx`).
- [ ] El reglamento de copy de este documento está enlazado desde `editorial.ts` o desde `CLAUDE.md`.

**KPIs target T+30d (ver audit §11):**
- `coach_paywall_view` rate ≥ 60% del endgame_views free.
- `coach_paywall_convert` ≥ 5% de paywall_views.
- PRO renewal D30 ≥ 25%.
- Coach cost / DAU < $0.005.

---

## 15. Referencias

- Auditoría base: `docs/monetization/2026-06-01-strategic-audit.md`
- Funnel detallado: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Inventario técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Reglas de copy: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Parking lot: `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`
- Memory: `feedback_promise_first_copy`, `feedback_anti_ai_prose`, `feedback_no_carousels`, `project_arena_play_timer_fragility`.
