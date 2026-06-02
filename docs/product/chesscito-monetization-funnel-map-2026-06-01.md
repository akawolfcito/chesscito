# Chesscito — Funnel Map de Monetización (M1)

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Propósito:** Mapear cada momento del usuario contra emoción/fricción, oferta permitida, oferta prohibida, CTA recomendado, superficies donde debe (y no debe) aparecer, y telemetría.
**Fuente:** `docs/monetization/2026-06-01-strategic-audit.md` + `docs/product/chesscito-monetization-direction-2026-06-01.md`.

---

## Cómo leer este documento

Cada momento es una **fila del funnel**. Para cada uno definimos:

- **Emoción/fricción** — qué está sintiendo el usuario.
- **Oferta permitida** — qué SÍ podemos ofrecer ahí.
- **Oferta prohibida** — qué NO debemos ofrecer ahí.
- **CTA recomendado** — el texto y la acción exacta.
- **Superficies SÍ** — archivos / componentes donde aparece.
- **Superficies NO** — dónde nunca debe aparecer.
- **Telemetría** — eventos que mandan o deberían mandarse.

**Regla maestra:** vender donde duele (fricción genuina), no donde molesta (celebración o flow activo).

---

## Momento 1 — Primera entrada / Onboarding

| Campo | Valor |
|---|---|
| Emoción / fricción | Curiosidad, sin contexto. **No quiere paywall ni wallet.** |
| Oferta permitida | Acceso libre a ejercicios, Easy Arena, 3 créditos Coach gratis (seed atómico ya implementado). |
| Oferta prohibida | Wallet connect forzado. Push de PRO. Mention de NFTs / mint. Mention de prize pool. |
| CTA recomendado | "Empieza a jugar" → ejercicios o `/arena?fresh=1`. |
| Superficies SÍ | `hub-scaffold-client.tsx`, exercises landing. |
| Superficies NO | Cualquier paywall o connect modal pre-juego. |
| Telemetría | `onboarding_started`, `first_exercise_started`, `first_match_started`. |

---

## Momento 2 — Hub idle (sin partida reciente)

| Campo | Valor |
|---|---|
| Emoción / fricción | Exploración / "qué hago ahora". |
| Oferta permitida | Tile contextual a ejercicios; tile a Arena; **chip Coach** mostrando "X de 3 créditos disponibles" si el usuario tiene Coach pendiente. |
| Oferta prohibida | Banner publicitario aleatorio. Push de PRO sin contexto. Carousels (regla `feedback_no_carousels`). |
| CTA recomendado | "Jugar" (Arena) o "Practicar" (Exercises). Si tiene partidas sin analizar: "Revisar tu última partida". |
| Superficies SÍ | `hub-scaffold-client.tsx`, `mission-briefing.tsx`. |
| Superficies NO | Pop-ups intersticiales al entrar al Hub. |
| Telemetría | `hub_viewed`, `hub_coach_teaser_view`, `hub_coach_teaser_tap`. |

---

## Momento 3 — Arena setup (difficulty / color)

| Campo | Valor |
|---|---|
| Emoción / fricción | Decisión. Quiere jugar. |
| Oferta permitida | Selector de dificultad + color. Chip "PRO: Luz ilimitada" **solo si free + `coachCredits === 0`**. |
| Oferta prohibida | "Prize pool de $X esta semana" (no se distribuye → ocultar). Cualquier menú de Shop intersticial. |
| CTA recomendado | "Play" (acción principal del momento). Chip PRO secundario y discreto. |
| Superficies SÍ | `arena/page.tsx` `ArenaSelectScaffold`. |
| Superficies NO | Banner que tape el selector. Modal de wallet antes del Play. |
| Telemetría | `arena_setup_viewed`, `arena_difficulty_selected`, `pro_chip_view_in_setup`, `pro_chip_tap_in_setup`. |

---

## Momento 4 — Durante la partida activa

| Campo | Valor |
|---|---|
| Emoción / fricción | Foco total. **No interrumpir.** |
| Oferta permitida | Nada que interrumpa. Solo HUD informativo (timer, dificultad, moves). |
| Oferta prohibida | Pop-ups de PRO. Pop-ups de Shop. Banner de prize pool. Anuncio de Luz. Cualquier toast comercial. |
| CTA recomendado | Ninguno comercial. La pieza, el timer y el board. |
| Superficies SÍ | `arena-hud.tsx` (solo info). |
| Superficies NO | Toasts, modales, banners durante el game. |
| Telemetría | `match_started`, `move_played`, `match_paused`. |

---

## Momento 5 — Racha de derrotas (≥2 losses consecutivas)

| Campo | Valor |
|---|---|
| Emoción / fricción | **Frustración real.** Necesita amparo, no upsell. |
| Oferta permitida | **Mercy Shield gratis** al inicio del próximo intento (sin pago). Copy: "Te damos un escudo. Vuelve a intentarlo." |
| Oferta prohibida | Ofrecer comprar shields aquí. Ofrecer Coach aquí (todavía no perdió la siguiente partida). |
| CTA recomendado | "Reintentar con escudo" (botón ya con shield activo). |
| Superficies SÍ | `arena/page.tsx` (pre-match overlay del intento siguiente). |
| Superficies NO | Endgame inmediato (la mercy entra al INICIO del próximo intento, no al final del actual). |
| Telemetría | `mercy_shield_granted`, `mercy_shield_used`, `mercy_shield_offered_match_id`. |

---

## Momento 6 — Endgame: derrota / resignación

| Campo | Valor |
|---|---|
| Emoción / fricción | Frustración + curiosidad ("qué hice mal"). **Punto más caliente de conversión Coach.** |
| Oferta permitida | **Coach Review como primer CTA** (preview gratis si tiene crédito; paywall con preview si tiene 0). Play Again como secundario. |
| Oferta prohibida | Save Victory (no hubo victoria). Push de PRO antes de Coach. Anuncio de Founder Badge. |
| CTA recomendado | "Vamos a ver qué pasó." → Coach review. Secundario: "Otra vez". |
| Superficies SÍ | `arena-end-state.tsx` (variante loss/resign). |
| Superficies NO | `victory-claim-success.tsx`. |
| Telemetría | `endgame_loss_viewed`, `coach_review_offered_loss`, `coach_paywall_view`, `coach_paywall_convert`, `play_again_tap_loss`. |

---

## Momento 7 — Endgame: victoria

| Campo | Valor |
|---|---|
| Emoción / fricción | Celebración. **No contaminar con upsell ruidoso.** |
| Oferta permitida | Orden fijo: **Save Victory** (primary, $0.005–$0.02) → **Coach Review** (secundario, gratis o paywall) → **Play Again** (terciario). |
| Oferta prohibida | Pop-up de PRO intersticial. Banner Founder Badge. Banner prize pool. "Tu NFT podría valer más". |
| CTA recomendado | "Save Victory" como primary. Coach review como follow-up natural. |
| Superficies SÍ | `arena-end-state.tsx` (variante win). |
| Superficies NO | Coach review como PRIMARY (en win, primary es Save). |
| Telemetría | `endgame_win_viewed`, `save_victory_tap`, `save_victory_success`, `coach_review_tap_win`. |

---

## Momento 8 — Endgame: tablas (draw)

| Campo | Valor |
|---|---|
| Emoción / fricción | Neutral, curiosidad. |
| Oferta permitida | Coach Review opcional. Play Again. |
| Oferta prohibida | Save Victory (no hubo victoria). Push de PRO. |
| CTA recomendado | "¿Cómo terminó esto?" → Coach. Secundario: Play Again. |
| Superficies SÍ | `arena-end-state.tsx` (variante draw). |
| Superficies NO | `victory-claim-success.tsx`. |
| Telemetría | `endgame_draw_viewed`, `coach_review_tap_draw`. |

---

## Momento 9 — Save Victory success (post-mint)

| Campo | Valor |
|---|---|
| Emoción / fricción | Celebración + orgullo. **No interrumpir.** |
| Oferta permitida | UNA secondary action: "¿Por qué ganaste?" → Coach review del mismo gameId. Share como primary. |
| Oferta prohibida | Push de PRO. Banner de comprar más Victory Cards. Cross-sell agresivo. |
| CTA recomendado | "Compartir" (primary) + "Revisar con Coach" (secondary discreto). |
| Superficies SÍ | `victory-claim-success.tsx`. |
| Superficies NO | Banner PRO en esta pantalla. |
| Telemetría | `victory_saved_view`, `share_tap_from_save`, `coach_review_tap_from_save`. |

---

## Momento 10 — Coach paywall (free user, 0 créditos)

| Campo | Valor |
|---|---|
| Emoción / fricción | Quiere análisis, no tiene créditos. **Momento de conversión.** |
| Oferta permitida | **Preview real**: primer mistake con título visible, contenido borroso. Packs **5 ($0.05)** y **20 ($0.10)** + PRO como alternativa. |
| Oferta prohibida | "Powered by GPT-4". Hype tech. Promesas de mejora cuantificada. Mensajes de scarcity falsa. |
| CTA recomendado | Primary: "Desbloquear este análisis" → pack 5. Secundario: "Luz todos los días" → PRO. |
| Superficies SÍ | `coach-paywall.tsx` invocado desde `arena-end-state.tsx` y `coach-history.tsx`. |
| Superficies NO | Hub idle. Onboarding. Durante partida. |
| Telemetría | `coach_paywall_view`, `coach_paywall_dismiss`, `coach_paywall_convert` (`pack_5` / `pack_20` / `pro`). |

---

## Momento 11 — Coach paywall (free user, crédito disponible)

| Campo | Valor |
|---|---|
| Emoción / fricción | Quiere análisis, tiene crédito. **Momento de entrega, no de venta.** |
| Oferta permitida | Análisis directo. Mensaje sutil: "Te quedan X análisis gratis." |
| Oferta prohibida | Forzar compra. Esconder el botón "usar crédito". |
| CTA recomendado | "Analizar (1 de 3)". |
| Superficies SÍ | `coach-panel.tsx`, `coach-game-client.tsx`. |
| Superficies NO | Paywall de pago si tiene crédito. |
| Telemetría | `coach_analysis_started_free`, `coach_credit_consumed`. |

---

## Momento 12 — Coach paywall (PRO activo)

| Campo | Valor |
|---|---|
| Emoción / fricción | Acceso pleno. Ningún paywall. |
| Oferta permitida | Análisis directo + identidad PRO visible. |
| Oferta prohibida | Cualquier upsell. |
| CTA recomendado | "Analizar". |
| Superficies SÍ | `coach-panel.tsx`, `coach-game-client.tsx`. |
| Superficies NO | Cualquier modal de "comprar más". |
| Telemetría | `coach_analysis_started_pro`. |

---

## Momento 13 — Training Journal (partidas sin analizar)

| Campo | Valor |
|---|---|
| Emoción / fricción | Recordatorio + curiosidad ("¿qué pasó en esa?"). |
| Oferta permitida | Chip "Analyze" por fila. Si free + 0 créditos: **preview parcial** del análisis con paywall debajo. |
| Oferta prohibida | Bloquear el journal completo. Ocultar partidas no analizadas. |
| CTA recomendado | "Analyze" por fila → coach viewer. |
| Superficies SÍ | `coach-history.tsx`. |
| Superficies NO | Paywall global que bloquee acceso a la lista. |
| Telemetría | `journal_viewed`, `journal_analyze_tap`, `journal_paywall_view`, `journal_paywall_dismiss`, `journal_paywall_convert`. |

---

## Momento 14 — Share modal post-victoria

| Campo | Valor |
|---|---|
| Emoción / fricción | Quiere compartir. |
| Oferta permitida | Cards de share (OG, IG strip si aplica). **Una sola línea**: "¿Quieres que Luz analice tu próxima?" |
| Oferta prohibida | Paywall en este momento. Push de PRO interruptivo. |
| CTA recomendado | "Compartir" (primary). "Activar Luz para próxima" (terciario discreto). |
| Superficies SÍ | `share-modal.tsx`. |
| Superficies NO | Nada que reduzca share completion rate. |
| Telemetría | `share_modal_view`, `share_completed`, `share_to_coach_tap`. |

---

## Momento 15 — PRO próximo a expirar (< 7 días)

| Campo | Valor |
|---|---|
| Emoción / fricción | Riesgo de perder hábito. **Momento de retención.** |
| Oferta permitida | CTA "Renew" prominente. Fecha exacta de expiración. Recordatorio una vez por sesión. |
| Oferta prohibida | Auto-renew sin consentimiento. Cargo sin aviso. Banner intrusivo en cada pantalla. |
| CTA recomendado | "Renovar tu entrenamiento" → flow de pago. |
| Superficies SÍ | `profile-sheet.tsx`, `pro-sheet.tsx`, Hub HUD chip (si quedan días < 7). |
| Superficies NO | Modal intersticial durante partida. |
| Telemetría | `pro_expiring_view`, `pro_renew_tap`, `pro_renew_success`. |

---

## Momento 16 — Post-expiración PRO

| Campo | Valor |
|---|---|
| Emoción / fricción | Hábito interrumpido, pérdida de identidad PRO. |
| Oferta permitida | "Tu pase expiró. Renueva para seguir entrenando con Luz." Historial sigue accesible (no se pierde). |
| Oferta prohibida | Borrar análisis previos. Quitar acceso a journal por completo. Dark pattern de "última oportunidad". |
| CTA recomendado | "Renovar" → flow de pago. Secundario: continuar como free. |
| Superficies SÍ | `pro-sheet.tsx`, hub HUD chip post-expire. |
| Superficies NO | Bloqueo completo del juego. |
| Telemetría | `pro_expired_view`, `pro_post_expire_renew_tap`, `pro_post_expire_renew_success`. |

---

## Momento 17 — Shop sheet (acceso directo)

| Campo | Valor |
|---|---|
| Emoción / fricción | Intención de compra activa. |
| Oferta permitida | Catálogo ordenado por valor: **Coach 20 → PRO → Coach 5 → Shield → Welcome Pack** (Founder oculto si no tiene perks). Tile "Sponsor a player" cuando exista. |
| Oferta prohibida | Founder Badge "raro" o "limited" sin justificación real. SKU vacío sin perks. |
| CTA recomendado | Tap por tile → confirmación de compra. |
| Superficies SÍ | `shop-sheet.tsx`. |
| Superficies NO | Auto-open de Shop sin intención del usuario. |
| Telemetría | `shop_viewed`, `shop_item_tap`, `shop_purchase_start`, `shop_purchase_success`, `shop_purchase_failed`. |

---

## Momento 18 — Account / inventory

| Campo | Valor |
|---|---|
| Emoción / fricción | "¿Qué tengo? ¿Dónde uso esto?" |
| Oferta permitida | Inventory rows: Coach credits, Shields, Founder/Welcome, PRO status. Cada row con destino claro (tap → contexto de uso). |
| Oferta prohibida | Inventory de ítems que el usuario no tiene visible como "comprar aquí". |
| CTA recomendado | Tap Coach row → coach history (no Shop). Tap PRO row → renew flow. Tap Shield row → contexto de uso. |
| Superficies SÍ | `profile-sheet.tsx`. |
| Superficies NO | Shop redirect desde inventory rows que no son "0". |
| Telemetría | `account_viewed`, `account_coach_row_tap`, `account_pro_row_tap`, `account_shield_row_tap`. |

---

## Momento 19 — Cold load partida guardada (Coach viewer)

| Campo | Valor |
|---|---|
| Emoción / fricción | Vuelve a ver una partida pasada. |
| Oferta permitida | Coach review si ya está analizada. Si no: chip "Analyze" + preview. |
| Oferta prohibida | Re-cobrar por análisis ya pagado (cache `(gameId, locale)` debe existir — TODO M4). |
| CTA recomendado | "Ver análisis" o "Analyze" según estado. |
| Superficies SÍ | `coach/[gameId]/coach-game-client.tsx`. |
| Superficies NO | Reanálisis silencioso pagado al cambiar locale. |
| Telemetría | `coach_viewer_viewed`, `coach_viewer_analyze_tap`, `coach_cache_hit`, `coach_cache_miss`. |

---

## Momento 20 — Free user con 0 créditos Coach (fuera de endgame)

| Campo | Valor |
|---|---|
| Emoción / fricción | Curiosidad sin urgencia. |
| Oferta permitida | Chip discreto "Te quedan 0 análisis. Pack desde $0.05." en Hub o Account. |
| Oferta prohibida | Pop-up intersticial. Modal full-screen. Hype de "última oportunidad". |
| CTA recomendado | "Conseguir análisis" → Shop pre-filtered. |
| Superficies SÍ | Hub HUD chip, Account inventory row. |
| Superficies NO | Pre-match. Durante match. |
| Telemetría | `zero_credits_chip_view`, `zero_credits_chip_tap`. |

---

## Resumen de eventos de telemetría (M1)

**Críticos (gating del go-live de M1):**
- `coach_paywall_view`
- `coach_paywall_dismiss`
- `coach_paywall_convert` (con `pack_5` / `pack_20` / `pro`)
- `pro_chip_tap`
- `pro_sheet_view`
- `pro_purchase_start`
- `pro_purchase_success`
- `pro_renew_tap`
- `mercy_shield_granted`
- `mercy_shield_used`

**Importantes (mide funnel):**
- `endgame_loss_viewed` / `endgame_win_viewed` / `endgame_draw_viewed`
- `coach_review_offered_loss` / `coach_review_tap_win` / `coach_review_tap_draw`
- `save_victory_tap` / `save_victory_success`
- `journal_paywall_view` / `_dismiss` / `_convert`
- `share_modal_view` / `share_completed` / `share_to_coach_tap`

**De salud técnica:**
- `coach_cache_hit` / `coach_cache_miss`
- `pro_expired_view` / `pro_expiring_view`
- `shop_purchase_failed` con `reason`
- `coach_analysis_failed` con `reason`

**Ya implementados (audit §2):** `coach.analyze.request`, `coach.analyze.idempotent_hit`, `coach.analyze.failed`, `coach.viewer.viewed`, `coach.ask_coach.tap`, `coach.mint_receipt.write`.

**Backend pendiente (M2):** `analytics_events` table en Supabase + writer en routes (TODO en `coach/analyze/route.ts:172`).

---

## Reglas transversales de aparición

1. **Una sola superficie comercial activa por momento.** No apilamos PRO + Coach + Shop en la misma pantalla.
2. **Cero ofertas durante partida activa.** El game loop es sagrado.
3. **Cero ofertas en momentos de celebración.** Save Victory success y Share modal son momentos de reward, no de venta.
4. **Cero carousels.** Regla `feedback_no_carousels` — single screen / contextual modal / inline affordance.
5. **Cero banners aleatorios.** Toda oferta tiene contexto de fricción o de inventario en 0.
6. **Cero pricing changes en M1** sin justificación documentada + flag de futuro.
7. **Cero claims médicos / cognitivos / especulativos.** Filtrar contra `chesscito-commercial-copy-rules-2026-06-01.md`.
8. **Cero promesas de prize pool activo** mientras no haya distribución.

---

## Referencias

- Dirección: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Audit base: `docs/monetization/2026-06-01-strategic-audit.md`
- Copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Inventory técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
