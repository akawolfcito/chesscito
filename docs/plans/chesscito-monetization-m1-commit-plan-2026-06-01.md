# Chesscito — M1 Monetization Funnel Commit Plan

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Estado:** Plan ejecutable post-aprobación. NO se toca código sin checklist §7 firmado.
**Contrato base:**
- `docs/product/chesscito-monetization-direction-2026-06-01.md`
- `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`

**Ajuste estratégico clave:**

> Luz NO reemplaza a PRO.
> - **Luz** = motor de valor y conversión.
> - **PRO** = motor de **recurrencia**.
> - **Peones** = motor de microconversión.
> - **Victory Cards** = motor de retención / share.
> - **Supporters** = motor de comunidad / impacto.
>
> PRO es el destino natural del usuario que ya usa Luz con frecuencia. M1 trata a PRO como ese destino, no como add-on secundario.

---

## 1. Objetivo de M1

**M1 activa el funnel mínimo viable** usando lo que ya está construido en el repo:

- Pone a **Luz como gancho de conversión** en momentos de fricción real (loss / resign / draw / journal sin analizar / créditos en 0).
- Posiciona a **PRO como destino de recurrencia** ("entrena con Luz todos los días") con value-prop antes del precio.
- **Neutraliza promesas peligrosas** (prize pool sin distribución, NFT como especulativo, SKUs vacíos).
- **Ordena el Shop por intención y valor**, alineado con la arquitectura comercial.
- **Mide el funnel** con eventos de telemetría base que hoy no existen.

**M1 NO intenta resolver:**
- Welcome Pack como bundle real (requiere backend → M2/M3).
- Mercy Shield automático tras racha (telemetría + UX flow → M2 dependiendo de tráfico).
- Cache de análisis Coach `(gameId, locale)` (backend → M2).
- Reconciliador post-tx PRO (backend → M2).
- Distribución real de prize pool (requiere contrato → M5/M6).
- Founder Badge soulbound (requiere contrato → parking lot).
- Cambio de pricing (no se toca).
- Sustitución completa de "credits" por "peones" en internals (solo capa de copy diferida a M3).

**Restricciones duras (no negociables en M1):**
- Sin contratos nuevos.
- Sin SKUs on-chain nuevos.
- Sin cambio de pricing.
- Sin auto-renew implícito.
- Sin forzar wallet connect al inicio.
- Sin prize pool visible como promesa activa.
- Sin claims médicos / cognitivos / especulativos.
- Sin "AI hype" en copy de usuario.
- Sin banners aleatorios.
- Sin interrumpir partida activa.
- Sin meter ideas del Parking Lot.
- Sin implementar economía completa de Peones (solo dejar el copy reservado para M3).

---

## 2. Principios de M1

| # | Principio | Aplicación práctica |
|---|---|---|
| P1 | **Vender donde duele, no donde molesta.** | Coach paywall en loss/resign; NO en celebración o durante partida. |
| P2 | **Promise-first copy ≤5 palabras.** | "Entrena con Luz todos los días" > "Subscribe to PRO membership". |
| P3 | **Una sola superficie comercial activa por momento.** | No apilar PRO + Coach + Shop en la misma pantalla. |
| P4 | **PRO = destino natural del usuario Luz-recurrente.** | Coach paywall siempre ofrece ambos: pack 5/20 (entry) + PRO (alternativa de alto valor). |
| P5 | **Honestidad obligatoria.** | Si no hay distribución del pool, el pool se oculta. Si Founder no tiene perks, se oculta. |
| P6 | **Cada cambio mensurable.** | Cada commit que toca UX comercial añade telemetría o la consume. |
| P7 | **Granular & periodic commits.** | Un commit = un cambio lógico. Run tests antes de commit. |
| P8 | **No tocar contratos.** | Si la palanca correcta exige contrato → al Parking Lot. |
| P9 | **Anti-AI prose hard rule.** | Cero em-dash, cero "powered by GPT", cero "AI ilimitada". CI gate bloquea. |
| P10 | **VR baseline discipline.** | Si toca surface visible → `pnpm test:e2e:visual` antes de push; refresh baselines en mismo PR con diff validado. |

---

## 3. Decisiones bloqueantes antes de código

Wolfcito debe confirmar las siguientes decisiones. **Ningún commit se ejecuta sin todas confirmadas.**

### D-M1.1 — Prize Pool: ocultar vs renombrar a Treasury

**Opción A (recomendada):** **Ocultar completamente** la balance + cualquier copy de "prize pool" en superficies de usuario.
- Pro: cero deuda visible; promesa neutralizada.
- Con: pierde la narrativa de "tu mint contribuye a algo".

**Opción B:** Renombrar a **"Treasury" / "Fondo del juego"** con explicación honesta ("cubre costos operativos y futuras iniciativas comunitarias"), mostrar balance como dato de transparencia, NO como promesa de payout.
- Pro: mantiene transparencia narrativa.
- Con: requiere copy nuevo cuidadoso (riesgo de que se siga leyendo como "premio").

**Mi recomendación: Opción A para M1.** Es más seguro. Opción B se puede activar en M2 con A/B test si la transparencia se valora.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.2 — Founder Badge: ocultar vs teaser de Welcome Pack futuro

**Opción A (recomendada):** **Ocultar Founder Badge** del Shop en M1 hasta que tenga perks reales o se rediseñe como Welcome Pack.
- Pro: no vender SKU vacío.
- Con: pierde un slot del Shop (cosmético).

**Opción B:** Dejarlo visible con copy honesto: "Apoyo simbólico al proyecto. Sin perks hoy. Próximamente Welcome Pack."
- Pro: capa de supporters / impacto activa.
- Con: comunicación rara; puede confundir.

**Opción C:** Renombrar visualmente a "Welcome Pack (coming soon)" sin alterar contrato — solo placeholder.
- Pro: prepara el rediseño.
- Con: SKU comprable que entrega menos de lo prometido.

**Mi recomendación: Opción A para M1.** Limpio. M2/M3 trae el Welcome Pack server-side como bundle real.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.3 — "Peones": copy ahora vs postergar a M3

**Opción A (recomendada):** **Postergar el cambio de copy a M3** con A/B test. M1 mantiene "Coach credits" / "Shields" como están.
- Pro: M1 se mantiene focalizado en funnel; cambio de lenguaje merece validación con telemetría base.
- Con: el lenguaje "credits" sigue siendo frío.

**Opción B:** Introducir "Peones" como capa de copy desde M1 sin cambios internos (solo strings en `editorial.ts`).
- Pro: identidad de marca más cálida desde el inicio.
- Con: sin telemetría base, no podremos medir el impacto del cambio.

**Mi recomendación: Opción A.** Confirmar A solo si Wolfcito acepta que "credits" sobreviva hasta M3. Si Wolfcito quiere Peones ya, B es viable pero documentamos como rollback fácil si conversion drop.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.4 — Orden exacto de CTAs en endgame

**Loss / Resign:**
- Mi propuesta canónica:
  1. **Primary:** "Vamos a ver qué pasó." → Coach Review (preview gratis si tiene crédito, paywall con preview si tiene 0).
  2. **Secondary:** "Otra vez" → Play Again (mantiene difficulty + color).
- NO Save Victory (no hubo victoria).
- NO Share (no hay nada que celebrar).
- → **¿Wolfcito aprueba estos 2 CTAs en este orden?**

**Draw:**
- Mi propuesta:
  1. **Primary:** "¿Cómo terminó esto?" → Coach Review.
  2. **Secondary:** "Otra vez" → Play Again.
- → **¿Wolfcito aprueba?**

**Win:**
- Mi propuesta:
  1. **Primary:** "Save Victory" → mint flow ($0.005–$0.02 según difficulty).
  2. **Secondary:** "¿Por qué ganaste?" → Coach Review.
  3. **Tertiary:** "Otra vez" → Play Again.
- → **¿Wolfcito aprueba este orden 1-2-3?**

---

### D-M1.5 — Mercy Shield: M1 o M2

**Contexto:** propuesta de dar 1 shield gratis al inicio del próximo intento si el usuario libre acumula 2 derrotas seguidas.

**Opción A (recomendada):** Postergar a **M2** después de tener telemetría base.
- Pro: sin telemetría, no sabemos si la racha de 2 es el umbral correcto.
- Con: pierde una palanca de retención durante M1.

**Opción B:** Incluir en M1 como commit aparte con telemetría adjunta.
- Pro: activa retención inmediato.
- Con: añade superficie nueva sin baseline de medición.

**Mi recomendación: Opción A.** M1 ya tiene 9 commits; el mercy shield no es bloqueante del funnel mínimo.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.6 — Consolidación PRO purchase logic (deuda P0)

**Contexto:** `useShopSheetState` y `exercises-screen.tsx` postean independientemente a `/api/verify-pro`. Es deuda crítica P0.

**Opción A (recomendada):** **Incluir consolidación en M1** como commit 9 (post-funnel, antes de cerrar M1).
- Pro: limpia deuda antes de añadir telemetría que toca ambos paths.
- Con: añade 1 commit al cluster.

**Opción B:** Diferir a M2.
- Pro: M1 más rápido.
- Con: cualquier cambio futuro en flow debe tocar 2 lugares → fragilidad.

**Mi recomendación: Opción A.** Es ahora o nunca, y M2 va a depender de telemetría que requiere un solo flow.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.7 — PRO chip days remaining + renew CTA (< 7 días)

**Contexto:** retención de PRO recurrente. Implementable hoy sin backend extra.

**Opción A (recomendada):** **Incluir en M1.**
- Pro: cierra el loop de PRO (compra → uso → renew).
- Con: requiere lógica de diff de fechas + UI nueva en HUD.

**Opción B:** Diferir a M2.

**Mi recomendación: Opción A.** PRO sin loop de renewal pierde su razón de ser. Si Wolfcito acepta, va como Commit 6.

→ **Requiere decisión de Wolfcito.**

---

### D-M1.8 — Coach paywall preview real

**Contexto:** mostrar el primer mistake con título visible + contenido borroso, en lugar del fallback básico actual.

**Confirmación esperada:** Sí, incluir en M1 como parte del Commit 3 (coach paywall en endgame).

→ **¿Wolfcito confirma este alcance del Commit 3?**

---

## 4. Commits propuestos

Cada commit es **un cambio lógico atómico**. Run `pnpm test` + `pnpm typecheck` antes de cada commit. VR si toca surface visible.

---

### Commit 1 — `chore(prize-pool): hide balance + remove prize promise copy`

#### Objetivo
Neutralizar la promesa rota del prize pool en superficies de usuario hasta que exista distribución real. Frame correcto: la balance acumula 20% de cada Victory mint, pero no se distribuye. Mientras tanto, no se comunica.

#### Archivos esperados
- `apps/web/src/components/arena/arena-select-scaffold.tsx` (o el componente que renderiza prize pool)
- `apps/web/src/lib/hooks/use-prize-pool.ts` (verificar consumers)
- `apps/web/src/lib/content/editorial.ts` (purgar copy `prize` / `pool` en surface user)
- `apps/web/src/components/**/*.tsx` (buscar consumers vía grep)

#### Cambios permitidos
- Ocultar el componente que muestra balance del prize pool en `ArenaSelectScaffold`.
- Eliminar copy con palabras "prize pool", "premio", "pool" en superficies user.
- Mantener el hook `usePrizePool` operativo (no borrarlo; podría usarse en Treasury futura o admin).
- Si Wolfcito eligió Opción B en D-M1.1 (Treasury): renombrar con copy honesto.

#### Cambios prohibidos
- NO tocar `VictoryNFTUpgradeable.sol` ni ningún contrato.
- NO modificar el fee split 80/20 (sigue acumulando, solo se oculta UI).
- NO borrar el hook `usePrizePool` (puede usarse en admin / dev).

#### Copy exacto
- **Eliminar:** cualquier string con `prize pool`, `premio`, `pool` visible al usuario.
- **Si renombramos (Opción B):** "Treasury — cubre costos operativos y futuras iniciativas comunitarias."

#### Telemetry
- Ninguna nueva. Si había `prize_pool_viewed` previamente, marcarlo como deprecated.

#### Acceptance criteria
- [ ] No existe ninguna UI que muestre la balance del prize pool al usuario.
- [ ] `grep -r "prize" apps/web/src/lib/content/editorial.ts` retorna cero strings de superficie usuario.
- [ ] `grep -r "Prize Pool" apps/web/src/components/` retorna cero matches en JSX.
- [ ] El contrato sigue acumulando 20% sin cambios (verificable on-chain).
- [ ] Visual regression actualizada para `ArenaSelectScaffold` sin el componente.

#### QA manual
1. Abrir `/arena?fresh=1` en MiniPay (móvil) y en desktop.
2. Verificar que no aparece "prize pool" ni balance en pantalla.
3. Completar una victoria y mintear: confirmar en Celoscan que el 20% sigue yendo al treasury hardcoded.
4. Buscar en toda la app cualquier mención de "premio" o "pool" en español/inglés.

#### Riesgo
- Si algún componente downstream consume `usePrizePool` y rompemos su render condicional, podría haber error.
- VR baseline drift en `ArenaSelectScaffold`.

#### Rollback
- `git revert <hash>` del commit. El componente vuelve, la balance se ve de nuevo (estado pre-M1).

---

### Commit 2 — `feat(arena): endgame loss/resign → Coach Review as primary CTA`

#### Objetivo
Cambiar el orden de CTAs en `arena-end-state.tsx` cuando el resultado es derrota o resignación. Coach Review pasa a ser primary; Play Again secundario.

#### Archivos esperados
- `apps/web/src/components/arena/arena-end-state.tsx`
- `apps/web/src/lib/content/editorial.ts` (constantes ARENA_COPY)

#### Cambios permitidos
- Reordenar tiles de CTA en endgame variant loss/resign.
- Añadir copy "Vamos a ver qué pasó." como label primary.
- Mantener Play Again como secondary.
- NO añadir Save Victory en loss/resign (ya está bien).

#### Cambios prohibidos
- NO tocar la lógica de loss/resign detection.
- NO cambiar el flow de Play Again.
- NO añadir Share modal en loss (no hay nada que celebrar).
- NO modificar `arena-end-state` variant win en este commit.

#### Copy exacto
- **Primary CTA:** "Vamos a ver qué pasó."
- **Secondary CTA:** "Otra vez."
- **Subtitle del overlay (opcional):** "Cada partida enseña algo."

#### Telemetry
- Añadir `coach_review_offered_loss` cuando el overlay loss se renderiza con el nuevo orden.
- Añadir `coach_review_tap_loss` cuando el usuario tappea el primary.
- Añadir `play_again_tap_loss` cuando tappea secondary.

#### Acceptance criteria
- [ ] En endgame loss/resign, "Vamos a ver qué pasó." es el botón visualmente primary.
- [ ] Play Again es visualmente secondary (token de cta-secundario).
- [ ] Los 3 eventos de telemetría disparan en MiniPay.
- [ ] VR baseline refresca para `vr9-arena-end-state-loss` y `vr9-arena-end-state-resign` con rationale en commit message.
- [ ] Tests unitarios actualizados si dependen del orden.

#### QA manual
1. Jugar `/arena?fresh=1` en MiniPay; perder a propósito.
2. Verificar que aparece "Vamos a ver qué pasó." arriba de "Otra vez."
3. Tappear primary → debe ir a Coach review (puede llevar a paywall si free + 0 créditos, ese es Commit 3).
4. Repetir con Resign en lugar de mate.
5. Verificar telemetría en debug console.

#### Riesgo
- VR baseline drift en variants loss/resign.
- Tests E2E que asumen Play Again en posición 1 fallarán.

#### Rollback
- `git revert` del commit. Orden vuelve a Play Again primary.

---

### Commit 3 — `feat(coach-paywall): wire paywall in endgame for free user with 0 credits + preview`

#### Objetivo
Invocar `coach-paywall.tsx` desde el flow de Coach Review en endgame cuando el usuario libre tiene 0 créditos. Mostrar **preview real** (primer mistake con título visible, contenido borroso) en lugar del fallback básico.

#### Archivos esperados
- `apps/web/src/app/arena/page.tsx`
- `apps/web/src/components/arena/arena-end-state.tsx`
- `apps/web/src/components/coach/coach-paywall.tsx`
- `apps/web/src/lib/content/editorial.ts`

#### Cambios permitidos
- Routing de "Coach Review" tap → si free + 0 credits → mostrar paywall.
- Preview component dentro del paywall que muestra primer mistake (título visible).
- Mantener la opción PRO como alternativa en el paywall.

#### Cambios prohibidos
- NO modificar `/api/coach/analyze` para añadir lógica de preview (debe usar datos ya disponibles client-side de un mock o primer análisis cacheado).
- NO cobrar para mostrar el preview.
- NO mostrar el contenido completo del primer mistake (solo título + blur).
- NO desactivar PRO bypass.

#### Copy exacto
- **Paywall heading:** "Revisa tu partida con Luz."
- **Preview teaser:** "Esta jugada perdió la torre." (ejemplo de primer mistake con título visible, body borroso)
- **Primary CTA paywall:** "Conseguir 5 análisis" ($0.05)
- **Secondary CTA paywall:** "20 análisis" ($0.10)
- **Tertiary CTA:** "Entrena con Luz todos los días — PRO" ($1.99 / 30 días)
- **Dismiss text:** "Más tarde."

#### Telemetry
- `coach_paywall_view` (con context: `endgame_loss` / `endgame_draw` / `endgame_win` / `journal` / `viewer`)
- `coach_paywall_dismiss`
- `coach_paywall_convert` (con `tier: pack_5` / `pack_20` / `pro`)
- `coach_paywall_preview_view` (cuando el preview real se renderiza)

#### Acceptance criteria
- [ ] Free user con 0 créditos que tappea Coach Review en loss → ve paywall con preview real.
- [ ] El preview muestra título de 1 mistake + content borroso (no fallback básico genérico).
- [ ] Los 3 CTAs del paywall están en el orden: pack 5 → pack 20 → PRO.
- [ ] Dismiss devuelve al endgame overlay sin pérdida de state.
- [ ] PRO user no ve paywall (`useIsProActive` bypass).
- [ ] Free user con ≥1 crédito no ve paywall (consume crédito y va a viewer).
- [ ] Telemetría dispara los 4 eventos.

#### QA manual
1. Jugar arena con wallet free + 0 créditos. Perder. Tappear "Vamos a ver qué pasó." → debe aparecer paywall.
2. Verificar preview con título visible + content blur.
3. Tappear "Conseguir 5 análisis" → flow de compra normal.
4. Repetir con PRO active → debe ir directo a viewer.
5. Repetir desde `coach-history.tsx` chip "Analyze".

#### Riesgo
- Preview real puede gatillar reanálisis costoso si no se cachea correctamente (D-M1.8 + audit §2).
- VR baseline nueva en `vr9-coach-paywall-*` para minipay + desktop.
- Si el primer mistake no está disponible client-side, requiere fallback graceful.

#### Rollback
- `git revert`. Paywall queda como estaba (no invocado en endgame).

---

### Commit 4 — `feat(arena): endgame win/draw CTA order + Coach Review as secondary in win`

#### Objetivo
Aplicar el orden canónico de CTAs en win (Save Victory primary, Coach Review secondary, Play Again tertiary) y en draw (Coach Review primary, Play Again secondary).

#### Archivos esperados
- `apps/web/src/components/arena/arena-end-state.tsx`
- `apps/web/src/components/arena/victory-claim-success.tsx`
- `apps/web/src/lib/content/editorial.ts`

#### Cambios permitidos
- Reordenar tiles win: Save → Coach → Play Again.
- Reordenar tiles draw: Coach → Play Again.
- Añadir copy "¿Por qué ganaste?" y "¿Cómo terminó esto?" según corresponda.
- En `victory-claim-success.tsx`: añadir tile "Revisar con Coach" como secondary, eliminar cualquier banner PRO.

#### Cambios prohibidos
- NO tocar el flow de mint Save Victory.
- NO añadir paywall en win post-mint (Commit 3 ya cubre paywall en Coach review tap).
- NO añadir Share modal cross-sell en este commit (es funcionalmente otra superficie).

#### Copy exacto
- **Win primary:** "Save Victory" (CTA existente, mantener)
- **Win secondary:** "¿Por qué ganaste?"
- **Win tertiary:** "Otra vez"
- **Draw primary:** "¿Cómo terminó esto?"
- **Draw secondary:** "Otra vez"
- **`victory-claim-success` secondary:** "Revisar con Coach"

#### Telemetry
- `save_victory_tap`
- `save_victory_success`
- `coach_review_tap_win`
- `coach_review_tap_draw`
- `play_again_tap_win`
- `play_again_tap_draw`
- `coach_review_tap_from_save` (en `victory-claim-success`)

#### Acceptance criteria
- [ ] Endgame win muestra 3 CTAs en orden Save → Coach → Play Again.
- [ ] Endgame draw muestra 2 CTAs en orden Coach → Play Again.
- [ ] `victory-claim-success` muestra "Revisar con Coach" como secondary tile (no banner PRO).
- [ ] Telemetría dispara todos los eventos.
- [ ] VR baselines refrescadas: `vr9-arena-end-state-win`, `vr9-arena-end-state-draw`, `vr9-victory-claim-success`.

#### QA manual
1. Ganar en arena. Ver 3 tiles en el orden esperado.
2. Save → mint → success screen → "Revisar con Coach" tile presente.
3. Forzar draw (3-fold repetition) y ver Coach primary, Play Again secondary.
4. PRO user → Coach Review skip paywall.

#### Riesgo
- VR baseline drift en 3 variants.
- Cambio de orden puede romper tests E2E.

#### Rollback
- `git revert`. Orden vuelve al anterior.

---

### Commit 5 — `feat(editorial): PRO copy → "Entrena con Luz todos los días" (value-before-price)`

#### Objetivo
Reescribir el copy de PRO en `editorial.ts` y en `pro-sheet.tsx` para que el valor aparezca **antes** que el precio. Eliminar "suscripción", "membership", "AI ilimitada", "premium". Posicionar PRO como pase de entrenamiento.

#### Archivos esperados
- `apps/web/src/lib/content/editorial.ts` (block PRO_COPY, VICTORY_MINT_COPY si toca)
- `apps/web/src/components/sheets/pro-sheet.tsx`
- `apps/web/src/components/hub/training-pass-band.tsx`
- `apps/web/src/components/sheets/profile-sheet.tsx` (row PRO)

#### Cambios permitidos
- Cambiar strings de PRO sheet completos.
- Reordenar secciones del PRO sheet para que valor aparezca primero.
- Añadir copy de beneficios concretos (Luz ilimitada + Training Journal + identidad PRO).
- Cambiar CTA labels.

#### Cambios prohibidos
- NO tocar el precio ($1.99 USD).
- NO tocar duración (30 días).
- NO añadir auto-renew copy.
- NO mencionar GPT / OpenAI / LLM / AI.
- NO usar "suscripción" / "membership" / "premium" / "unlock".
- NO usar em-dash / en-dash (CI gate bloquea).

#### Copy exacto

**Heading:** "Entrena con Luz todos los días."

**Subheading:** "Tu pase mensual de entrenamiento."

**Bullets (orden exacto):**
1. "Luz ilimitada — análisis de cada partida que juegues." → SIN em-dash: "Luz ilimitada. Análisis de cada partida."
2. "Training Journal completo. Toda tu historia guardada."
3. "Identidad PRO en tu perfil."

**Pricing line:** "$1.99 USD / 30 días" o alternativa "6 centavos al día."

**Primary CTA:** "Activar PRO."
**Renewal CTA (si aplica):** "Renovar tu entrenamiento."

**Hub HUD chip / training-pass-band:** "Tu coach personal de ajedrez."

#### Telemetry
- Mantener `pro_sheet_view` y `pro_purchase_start` existentes.
- Añadir `pro_chip_view` (cuando el chip se renderiza en Hub HUD).
- Añadir `pro_chip_tap` (cuando se tappea).

#### Acceptance criteria
- [ ] Cero strings con "subscription", "membership", "AI ilimitada", "premium", "unlock more" en superficies user.
- [ ] PRO sheet abre y muestra valor (bullets) antes del precio.
- [ ] Em-dash CI gate sigue pasando.
- [ ] Telemetría `pro_chip_view` y `pro_chip_tap` disparan.
- [ ] VR baselines refrescadas para `pro-sheet`, `training-pass-band`, `profile-sheet`.

#### QA manual
1. Abrir PRO sheet en MiniPay. Leer copy en alto: ¿suena a "pase de entrenamiento" o a "subscription"?
2. Verificar que el valor está arriba del precio visualmente.
3. Buscar global `grep -i "subscription\|membership\|unlock\|AI ilimit"`: cero matches en source de usuario.
4. CI: anti-AI prose gate verde.

#### Riesgo
- Copy demasiado largo puede romper layout móvil 390px.
- Em-dash accidental en nuevo copy → CI fail.

#### Rollback
- `git revert`. Copy vuelve al anterior.

---

### Commit 6 — `feat(pro): show days-remaining chip + renew CTA when < 7 days`

#### Objetivo
Cerrar el loop de PRO recurrente. Mostrar contador de días restantes en Account; activar CTA "Renovar" prominente cuando quedan < 7 días.

#### Archivos esperados
- `apps/web/src/components/sheets/profile-sheet.tsx` (row PRO con días)
- `apps/web/src/lib/hooks/use-is-pro-active.ts` (devolver `daysRemaining` además de `isActive`)
- `apps/web/src/components/hub/hub-scaffold-client.tsx` (chip HUD condicional < 7 días)
- `apps/web/src/lib/content/editorial.ts`

#### Cambios permitidos
- Calcular `daysRemaining` desde Redis `expiresAt` ya devuelto.
- UI nueva: chip de días en Account row + chip HUD si < 7.
- Lógica: mostrar chip HUD máximo una vez por sesión (no spam).

#### Cambios prohibidos
- NO tocar el flow on-chain de renovación (sigue siendo manual via Shop).
- NO añadir auto-renew.
- NO mostrar el chip durante partida activa.
- NO usar tono ansioso ("¡Perderás acceso!").

#### Copy exacto
- **Account row:** "PRO — tu pase expira en X días."
- **Account renew CTA (siempre visible si PRO active):** "Renovar."
- **Account renew CTA (< 7 días, énfasis):** "Renovar tu entrenamiento."
- **Hub HUD chip (< 7 días):** "Tu pase expira en X días. Renovar."
- **Post-expire copy (Account):** "Tu pase expiró. Renueva para seguir entrenando con Luz."

#### Telemetry
- `pro_expiring_view` (cuando se muestra chip < 7 días)
- `pro_renew_tap`
- `pro_renew_success`
- `pro_expired_view` (post-expire copy mostrado)

#### Acceptance criteria
- [ ] PRO con 10+ días restantes → solo se muestra row en Account, sin chip HUD.
- [ ] PRO con < 7 días → chip HUD aparece una vez por sesión.
- [ ] PRO con 0 días (expirado) → row de Account muestra post-expire copy.
- [ ] Tappear "Renovar" → flujo de pago Shop existente (sin duplicar lógica).
- [ ] Telemetría dispara los 4 eventos.
- [ ] sessionStorage flag previene chip HUD duplicado en misma sesión.

#### QA manual
1. Wallet con PRO expirando en 3 días → ver chip HUD primer load.
2. Refresh → chip NO aparece de nuevo (flag activo).
3. Tappear renovar → ir a pago.
4. Wallet PRO expirado → ver post-expire copy en Account.
5. Wallet sin PRO → row no muestra contador.

#### Riesgo
- TTL Redis puede desincronizar con `localStorage` cache → cálculo de días off.
- VR baseline en Account + HUB chip.

#### Rollback
- `git revert`. Chip vuelve al estado anterior.

---

### Commit 7 — `style(shop): reorder tiles by value + hide Founder Badge`

#### Objetivo
Ordenar el catálogo del Shop por intención y valor comercial. Coach 20 → PRO → Coach 5 → Shield. Ocultar Founder Badge (per D-M1.2 Opción A).

#### Archivos esperados
- `apps/web/src/components/sheets/shop-sheet.tsx`
- `apps/web/src/lib/contracts/shop-catalog.ts` (solo orden de display si aplica)
- `apps/web/src/lib/hooks/use-shop-sheet-state.ts` (si filtra catalog)

#### Cambios permitidos
- Reordenar render order de tiles.
- Filtrar Founder Badge (itemId=1) del display en M1.
- Mantener la "ghost more coming" tail card existente.

#### Cambios prohibidos
- NO tocar el contrato.
- NO desplegar Founder Badge del catálogo on-chain (sigue siendo comprable si alguien va por ABI directo; solo escondemos en UI).
- NO añadir Welcome Pack (postergado).
- NO cambiar precios.

#### Copy exacto
- Mantener copy actual de cada tile excepto reorder.
- Ghost tail card sigue diciendo "More coming." (o "Más próximamente.")

#### Telemetry
- Mantener `shop_viewed`, `shop_item_tap`, `shop_purchase_start`, `shop_purchase_success`.
- Añadir `shop_item_view` por tile (saber qué se muestra antes del tap).

#### Acceptance criteria
- [ ] Shop muestra orden: Coach 20 → PRO → Coach 5 → Shield → [ghost tail].
- [ ] Founder Badge NO aparece en MiniPay ni en web.
- [ ] CELO sibling (itemId=5) sigue oculto en web non-MiniPay (no cambia).
- [ ] Tappear cualquier tile → flow normal.
- [ ] VR baseline refresca para `shop-sheet`.

#### QA manual
1. Abrir Shop en MiniPay → verificar 4 tiles + ghost en orden exacto.
2. Comprar Coach 5 → flow normal.
3. Comprar PRO → flow normal (consolidación commit 9 si ya está).
4. Verificar que Founder ya no aparece.

#### Riesgo
- VR baseline drift en `shop-sheet`.
- Si algún Account inventory row dependía de Founder visible para link al Shop, romperá ese link (verificar `profile-sheet.tsx`).

#### Rollback
- `git revert`. Orden vuelve y Founder reaparece.

---

### Commit 8 — `feat(telemetry): add monetization funnel events`

#### Objetivo
Centralizar y disparar los 9 eventos mínimos del funnel comercial M1. Algunos ya están parcialmente en commits 2-7; este commit asegura que todos existan y persistan a `analytics_events` o al logger actual.

**Eventos M1 obligatorios:**
1. `coach_paywall_view`
2. `coach_paywall_dismiss`
3. `coach_paywall_convert`
4. `coach_review_offered_loss`
5. `coach_review_tap_win`
6. `pro_chip_view`
7. `pro_chip_tap`
8. `save_victory_tap`
9. `save_victory_success`

#### Archivos esperados
- `apps/web/src/lib/analytics/monetization-telemetry.ts` (nuevo)
- `apps/web/src/lib/analytics/analyze-telemetry.ts` (extender si comparten infra)
- `apps/web/src/components/arena/arena-end-state.tsx` (consumers)
- `apps/web/src/components/coach/coach-paywall.tsx` (consumers)
- `apps/web/src/components/sheets/pro-sheet.tsx` (consumers)
- `apps/web/src/components/hub/hub-scaffold-client.tsx` (consumers)

#### Cambios permitidos
- Crear helper `trackMonetizationEvent(name, payload)` con sink al logger existente.
- Tipar payloads con TypeScript.
- Reusar el sink actual de Coach (no introducir provider nuevo).

#### Cambios prohibidos
- NO crear tabla `analytics_events` en Supabase en este commit (ese es backend M2).
- NO añadir SDK de analytics externo (Mixpanel, PostHog, etc.).
- NO tocar el sink existente de Coach (extender, no reemplazar).

#### Copy exacto
N/A (no UI changes).

#### Telemetry
- Define `MonetizationEvent` union con los 9 eventos.
- Payload schema: `{ event, context, timestamp, wallet?, gameId?, tier? }`.

#### Acceptance criteria
- [ ] Los 9 eventos disparan en su superficie correspondiente.
- [ ] Eventos van al mismo sink que `coach.*` actuales.
- [ ] Tests unitarios para `trackMonetizationEvent`.
- [ ] Documentación en `docs/monetization/telemetry-events-m1.md` (file nuevo) listando los 9 + payloads.

#### QA manual
1. Ejecutar cada flow de M1 (paywall, endgame, PRO sheet, save victory) y verificar en console que el evento dispara con payload correcto.
2. Verificar que no hay duplicados (ej: `coach_paywall_view` dispara una sola vez por mount).

#### Riesgo
- Spam de eventos si effects no están memoizados.
- Payload typing puede no cubrir todos los casos.

#### Rollback
- `git revert`. Eventos dejan de dispararse pero superficies siguen funcionando.

---

### Commit 9 — `refactor(shop): consolidate PRO purchase flow into useShopSheetState`

> **DEFERRED BY AUDIT (2026-06-02):** Commit 9 did NOT execute the migration. Pre-edit exploration revealed the work is structural refactor (~150-250 LOC in exercises-screen.tsx) with high regression risk in the MiniPay revenue path absent an integration test harness. Decision tomada Opción 3 (defer + document). The M1 commit landed only docs (`docs/monetization/pro-purchase-consolidation-audit-m1.md`) capturing findings + post-M1 plan + acceptance criteria. The deuda P0 stays open until a dedicated cluster ships with integration tests.

#### Objetivo
Resolver deuda técnica P0: lógica de compra PRO duplicada entre `useShopSheetState` y `exercises-screen.tsx`. Migrar todo a `useShopSheetState` y borrar el path legacy.

#### Archivos esperados
- `apps/web/src/lib/hooks/use-shop-sheet-state.ts` (centralizar)
- `apps/web/src/app/exercises/exercises-screen.tsx` (eliminar lógica de compra PRO duplicada)
- `apps/web/src/lib/hooks/use-pro-purchase.ts` (si emerge como helper compartido)
- Tests unitarios afectados.

#### Cambios permitidos
- Extraer la lógica común a un helper.
- Reemplazar el flow en `exercises-screen.tsx` por una llamada al helper o al hook compartido.
- Eliminar imports y código muerto.

#### Cambios prohibidos
- NO cambiar el endpoint `/api/verify-pro` ni su contrato.
- NO modificar el orden de los pasos (firma → tx → verify → state update).
- NO romper idempotencia (`coach:pro:processed-tx:{txHash}`).

#### Copy exacto
N/A.

#### Telemetry
- Mantener `pro_purchase_start`, `pro_purchase_success`, `pro_purchase_failed`.
- Asegurar que ambos paths (cuando existían) ahora disparan idénticamente.

#### Acceptance criteria
- [ ] Una sola implementación de PRO purchase en el repo.
- [ ] `exercises-screen.tsx` ya no postea a `/api/verify-pro` directamente.
- [ ] Tests unitarios pasan (incluyendo test de integración si existe).
- [ ] Comprar PRO desde Shop sheet: funciona.
- [ ] Comprar PRO desde exercises CTA (si quedaba): funciona.

#### QA manual
1. Comprar PRO desde Shop sheet en MiniPay → verificar TX + verify + state activo.
2. Verificar que NO hay dos POST a `/api/verify-pro` por la misma compra.
3. Buscar `grep -r "/api/verify-pro" apps/web/src/` → debe haber un solo callsite client-side.

#### Riesgo
- Regresión silenciosa del flow PRO. Mitigación: tests de integración + QA manual obligatorio antes de merge.
- Si exercises-screen tenía side effects únicos (analytics extras), pueden perderse.

#### Rollback
- `git revert`. Vuelve la duplicación.

---

## 5. Orden recomendado

Ejecutar los commits **en este orden estricto**. Justificación al lado.

| # | Commit | Razón del orden |
|---|---|---|
| 1 | `chore(prize-pool): hide balance` | Limpia deuda con usuario antes de añadir nuevas surfaces. Sin riesgo de funnel. |
| 2 | `feat(arena): endgame loss/resign → Coach primary` | Activa el upsell donde hay más fricción. Es la palanca más alta. |
| 3 | `feat(coach-paywall): wire paywall in endgame + preview` | Cierra el flow del commit 2 con conversión real. |
| 4 | `feat(arena): endgame win/draw CTA order` | Completa el rework de endgame para los 3 outcomes. |
| 5 | `feat(editorial): PRO copy value-before-price` | Una vez Luz es el gancho, PRO se posiciona como destino natural. |
| 6 | `feat(pro): days-remaining chip + renew CTA` | Cierra el loop de recurrencia que es el rol de PRO. |
| 7 | `style(shop): reorder tiles + hide Founder` | Alinea Shop con la arquitectura comercial. |
| 8 | `feat(telemetry): monetization funnel events` | Mide todo lo anterior. Va al final porque los eventos viven en surfaces que recién existen. |
| 9 | `refactor(shop): consolidate PRO purchase` | Deuda P0. Va al final porque tocar este flow durante commits 5-6 sería arriesgado; mejor cuando ya está estable. |

**Tiempo estimado:** 2-3 sesiones de trabajo (1-2 días).

**Punto de control intermedio:** después del commit 4, validar con Wolfcito el endgame en MiniPay físico antes de seguir.

---

## 6. Qué queda fuera de M1

**Postergado a M2:**
- Mercy Shield automático tras racha de derrotas.
- Telemetry endpoint a Supabase `analytics_events` table (M1 usa sink existente).
- Cache de análisis Coach por `(gameId, locale)`.
- Reconciliador de tx pagada fallida en `/api/verify-pro`.
- Rate limit `/api/verify-pro` por wallet.
- First-month 50% off promo.

**Postergado a M3:**
- Cambio de copy "credits" → "Peones" con A/B test.
- Welcome Pack como server-side bundle.
- Coach paywall preview con segundo y tercer mistake (M1 solo el primero).

**Postergado a M5/M6 (requieren contrato):**
- Welcome Pack `itemId=7` si el bundle server-side no escala.
- Prize Pool distribution real (ledger + admin UI + payout method + cron).
- VictoryNFT v2 con server-side game session attestation.
- Soulbound Founder Badge.
- Sponsored tournament infra.

**Parking lot (no roadmap activo):**
- Torneos pagados, sponsors, B2B colegios, rankings ELO, referidos, season pass, daily challenges, TTS, AI personalities, push notifs, lessons curadas, whitelabel, AA mejorada, multi-tenant, cosméticos por season.

Ver `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`.

---

## 7. Checklist de aprobación antes de implementar

Wolfcito debe firmar este checklist (✅ o cambios solicitados) **antes** de tocar código.

### Decisiones bloqueantes (§3)
- [ ] D-M1.1 — Prize Pool: ¿Opción A (ocultar) o B (renombrar Treasury)?
- [ ] D-M1.2 — Founder Badge: ¿Opción A (ocultar) o B (visible con copy honesto) o C (placeholder "coming soon")?
- [ ] D-M1.3 — Peones: ¿Opción A (postergar M3) o B (copy ya en M1)?
- [ ] D-M1.4 — Orden CTAs endgame:
  - Loss/Resign: Coach Review primary + Play Again secondary ✅ / ❌
  - Draw: Coach Review primary + Play Again secondary ✅ / ❌
  - Win: Save → Coach → Play Again ✅ / ❌
- [ ] D-M1.5 — Mercy Shield: ¿M1 o M2?
- [ ] D-M1.6 — Consolidación PRO purchase: ¿M1 (Opción A) o M2?
- [ ] D-M1.7 — PRO chip días + renew CTA: ¿M1 (Opción A) o M2?
- [ ] D-M1.8 — Coach paywall preview real (primer mistake con título visible): ¿confirma alcance Commit 3?

### Alcance general
- [ ] M1 son **9 commits** (o 8 si D-M1.6 se difiere).
- [ ] Cero contratos nuevos.
- [ ] Cero cambios de pricing.
- [ ] Cero auto-renew.
- [ ] Cero claims médicos / especulativos / AI hype.
- [ ] Editorial.ts queda como single source of truth.
- [ ] VR baselines se refrescan en cada commit que toca surface visible.
- [ ] Tests + typecheck deben pasar antes de cada commit.

### Riesgos aceptados
- [ ] VR baseline drift en `vr9-arena-end-state-*`, `pro-sheet`, `shop-sheet`, `profile-sheet`.
- [ ] PRO purchase consolidation puede introducir regresión silenciosa (mitigado con QA manual obligatorio).
- [ ] Si Wolfcito elige Opción B en D-M1.1 (Treasury), copy debe pasar revisión adicional.

### Punto de validación intermedio
- [ ] Después de Commit 4: smoke test manual en MiniPay físico (Android), validar endgame los 3 outcomes antes de seguir.

### Cierre
- [ ] Al finalizar los 9 commits: handoff `docs/handoffs/2026-06-XX-monetization-m1-handoff.md` + actualizar `MEMORY.md` con estado final.
- [ ] Issues GH cerrados / milestone M1 cerrado.
- [ ] Top-level README sin cambios (M1 no añade features visibles para el README "What's live").

---

## Referencias

- Audit base: `docs/monetization/2026-06-01-strategic-audit.md`
- Dirección: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Funnel map: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Inventory técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Parking lot: `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`
- VR discipline: memoria `feedback_vr_baseline_discipline`.
- Anti-AI prose: memoria `feedback_anti_ai_prose` + `project_anti_ai_prose_ceiling`.
- Plan-before-edit: memoria `feedback_plan_before_edit`.
