# Chesscito — Rotation + Labyrinths Epics & Stories (v0.1)

**Fecha:** 2026-06-08 · **Author:** John (PM) · **Status:** Backlog draft, pending approval
**Source spec:** `docs/product/chesscito-rotation-and-labyrinths-2026-06-08.md`
**Status:** Approved — las 4 decisiones de producto quedaron cerradas (founder, 2026-06-08). Ver §13.
**Mode:** Pre-launch — no usuarios reales, Production = stable personal/MiniPay snapshot. Calibraciones compactas, ship velocity > ceremonia.

---

## 1. Resumen ejecutivo

- **Hybrid:** progresión por tier (Easy/Medium/Hard) + rotación diaria DENTRO del tier desbloqueado, seed `(wallet|session, fecha, pieza)`.
- **Laberintos:** mínimo 3/pieza + Daily Labyrinth global gratis + segundo Daily Lab para PRO.
- **Guest:** canonical 5 → wallet prompt → `session_uuid` fallback.
- **Cuello real = contenido.** No iniciar refactor técnico hasta tener ≥50% del contenido escrito.
- **Foco MVP:** 90 ejercicios (15/pieza × 6) + 18 laberintos (3/pieza × 6).

---

## 2. Epic 1 — Content authoring (P0)

**Goal:** llenar el pool de ejercicios curados por pieza hasta el target MVP.

| Story | Detalle |
|---|---|
| CA-1 | Backlog inicial: 10/15 ejercicios por pieza (5 Easy + 5 Medium), Hard pending. |
| CA-2 | Backlog completo: subir a 15/15 (agregar 5 Hard por pieza). |
| CA-3 | Clasificar cada ejercicio por tier (Easy/Medium/Hard) con criterio escrito. |
| CA-4 | Validar cada ejercicio con BFS verifier (`optimalMoves` matches catálogo). |
| CA-5 | Human review por Wolf/César (mínimo 1 firma además del autor). |
| CA-6 | Metadata pedagógica mínima: `piece`, `tier`, `objective`, `tags[]`, `verifiedAt`. |

**Acceptance:**
- ≥60 ejercicios sólidos antes de tocar refactor técnico (CA-1 + CA-2 parcial).
- 100% pasan BFS verifier.
- Cada ejercicio tiene metadata mínima completa.

---

## 3. Epic 2 — Labyrinth catalog (P0)

**Goal:** estandarizar floor por pieza y preparar catálogo para Daily Lab.

| Story | Detalle |
|---|---|
| LC-1 | Completar mínimo 3 laberintos por pieza (E/M/H). |
| LC-2 | Agregar King +2 (hoy tiene 1). |
| LC-3 | Agregar Bishop +1 (hoy tiene 2). |
| LC-4 | Clasificar cada laberinto por tier. |
| LC-5 | **Decisión visual obstáculos:** preferir casillas grises/rocas/muros sobre piezas-con-candado para no confundir con piezas reales. |
| LC-6 | Preparar campo `eligibleForDailyLab: boolean` en metadata. |
| LC-7 | Knight conserva 5 (surplus aceptado, no se reduce). |

**Acceptance:**
- ≥18 laberintos totales (3 × 6 piezas).
- Cada laberinto tiene `piece`, `tier`, `objective`, `obstacleModel`, `metadata`.
- Obstáculo visual no se parece a una pieza ajedrecística standard.

---

## 4. Epic 3 — Exercise rotation engine (P1)

**Goal:** seedable daily rotation con tiers respetados.

| Story | Detalle |
|---|---|
| ER-1 | Implementar pool por pieza (15 entries, leído de catálogo). |
| ER-2 | Seed determinístico `hash(wallet|session_uuid, ISODate, pieza)` → set de 5 ids. |
| ER-3 | Mostrar 5 ejercicios por día en `exercises-screen.tsx`. |
| ER-4 | Bias del selector hacia ejercicios menos completados dentro de tiers desbloqueados. |
| ER-5 | Guest first touch ve canonical 5 (override del seed). |
| ER-6 | Guest recurrente: `session_uuid` en sessionStorage, rota como wallet. |
| ER-7 | Chip "Today" en cada pieza; completados con ✓/oro. |

**Acceptance:**
- Misma wallet + misma fecha + misma pieza → mismo set de 5 (idempotente).
- Día siguiente → set nuevo (mínimo 1 entry distinta).
- Guest first visit ve canonical 5.
- Guest recurrente (sessionStorage) rota.
- No whiplash: set solo incluye tiers desbloqueados.

---

## 5. Epic 4 — Tier progression (P1)

**Goal:** mecánica de unlock + decisión final de cómo se acumulan los 10★.

| Story | Detalle |
|---|---|
| TP-1 | Easy desbloqueado desde día 1 por defecto. |
| TP-2 | Medium desbloqueado @ 5★ en la pieza. |
| TP-3 | Hard desbloqueado @ 9★ en la pieza. |
| TP-4 | **CERRADO (founder 2026-06-08): 10★ across pool de 15** = suma de estrellas únicas (cada ejercicio max 3★ una vez, reintentos no duplican). Badge contract intacto; cambia solo la trayectoria. |
| TP-5 | Copy de mastery: "Maestría de la pieza — 10★" + microhint del tier siguiente. |
| TP-6 | UI: progress bar por tier dentro de la pieza, no solo conteo plano. |

**PM note:** Pre-launch — 10★ across pool se puede aceptar si mejora el producto. No bloquear por miedo a usuarios existentes.

**Acceptance:**
- Progress claro por pieza y por tier.
- Badge 10★ contract intacto (suma ≥10★ → mintable).
- No rompe `badge claim per piece` sin decisión explícita.

---

## 6. Epic 5 — Daily Labyrinth (P2)

**Goal:** el carrot diario que da razón de volver mañana.

| Story | Detalle |
|---|---|
| DL-1 | Daily Labyrinth global gratis (1 por día, todos los usuarios). |
| DL-2 | Seed diario `hash(wallet|session, ISODate)` sobre catálogo `eligibleForDailyLab`. |
| DL-3 | Evitar repetición: no repetir mismo lab en últimos `ceil(catálogo/7)` días por wallet. |
| DL-4 | Registrar completion (`dailyLabCompletions` por wallet+date). |
| DL-5 | Surface: chip/tile permanente en `/hub` o entry desde piezas. |
| DL-6 | Peones Hint disponible dentro de cualquier Daily Lab (sin cambios al spend universal). |

**Acceptance:**
- Free ve 1 Daily Lab/día.
- Catálogo mínimo (≥18) opera con rotación estable sin colisiones.
- Completion persiste y se telemetríza.

---

## 7. Epic 6 — PRO expansion (P3)

**Goal:** palanca de recurrencia sin gating educativo duro.

| Story | Detalle |
|---|---|
| PE-1 | Segundo Daily Labyrinth PRO (premium-curated, dificultad alta). |
| PE-2 | ~~Tier rotation 1 día antes para PRO~~ **DESCARTADO (founder 2026-06-08):** PRO nunca adelanta tiers. Reemplazo: hints/retries incluidos, coach premium, themes, historial extendido, study skip (a validar). |
| PE-3 | Copy: "Dos laberintos al día" en PRO surface. |
| PE-4 | Free puede aprender TODO lo esencial sin PRO. PRO expande, no bloquea. |

**Acceptance:**
- Free completa progresión completa de la pieza sin PRO, al mismo ritmo (5★/9★).
- PRO ve 2 Daily Labs.
- PRO NO tiene ventaja de velocidad en tier unlock (diferenciación solo por expansión: labs, hints, coach, themes, historial).

---

## 8. Epic 7 — Telemetry / KPIs (P3)

**Goal:** poder medir lo que el spec promete.

| Story | Detalle |
|---|---|
| TM-1 | Event `rotation.daily_set_served { wallet, piece, date, ids[] }`. |
| TM-2 | Event `rotation.exercise_completed { wallet, piece, exerciseId, tier, stars }`. |
| TM-3 | Event `daily_lab.served / completed`. |
| TM-4 | Event `daily_lab_pro.served / completed`. |
| TM-5 | Event `guest.canonical_completed`, `guest.wallet_prompt_shown`, `guest.wallet_prompt_converted`. |
| TM-6 | Dashboard mínimo: D1/D7 retention, % wallets 10★ ≥1 pieza @ 14d, Daily Lab participation %. |

**Acceptance:**
- Todos los KPIs del spec §5 son computables.

---

## 9. Out of scope (explícito)

Mantener fuera de este cluster:

- P2P / spectator / visor.
- Tipping Peones.
- AI-generated puzzles.
- Leaderboard social.
- Streak diario (revisita si D1 retention queda corto).
- Theme packs / ContentPack temáticos.
- Peones sinks nuevos (founder quiere polish primero).
- Stablecoin packs.
- Payment rails nuevos.

---

## 10. Implementation sequence recomendada

1. **CA-1, CA-3..CA-6** — content authoring (10/15) + LC-1..LC-7 en paralelo. [P0]
2. **LC-1..LC-7** — labyrinth catalog floor + decisión visual obstáculos. [P0]
3. **ER-1..ER-7** — rotation engine arranca cuando CA llega a ≥50%. [P1]
4. **TP-1..TP-6** — tier progression piggyback con rotation. [P1]
5. **DL-1..DL-6** — Daily Labyrinth global. [P2]
6. **PE-1, PE-3, PE-4** — PRO second Daily Lab + expansión (hints/coach/themes/historial). PE-2 descartado (PRO no adelanta tiers). [P3]
7. **TM-1..TM-6** — telemetry + polish final. [P3]

**Gating principle:** ER no arranca técnico hasta CA tenga ≥50%. DL no arranca hasta LC esté completo.

---

## 11. Stories table

| Epic | Story | Priority | Dependencies | Acceptance | Notes |
|---|---|---|---|---|---|
| 1 | CA-1 backlog 10/15 ejercicios/pieza | P0 | — | 60 ejercicios sólidos | Sprint contenido principal |
| 1 | CA-2 subir a 15/15 | P0 | CA-1 | 90 ejercicios totales | Hard tier completo |
| 1 | CA-3 clasificar tier | P0 | CA-1 | Criterio escrito | Necesario para ER-4 |
| 1 | CA-4 BFS verifier pass | P0 | CA-1 | 100% pasa | Hard gate |
| 1 | CA-5 human review Wolf/César | P0 | CA-1 | 1 firma extra/ejercicio | Curación |
| 1 | CA-6 metadata pedagógica | P0 | CA-1 | Schema completo | Para telemetry |
| 2 | LC-1 3 laberintos/pieza | P0 | — | 18 totales | Floor universal |
| 2 | LC-2 King +2 | P0 | LC-1 | King ≥3 | Deuda mayor |
| 2 | LC-3 Bishop +1 | P0 | LC-1 | Bishop ≥3 | Deuda menor |
| 2 | LC-4 clasificar tier laberinto | P0 | LC-1 | E/M/H | Para PE-1 PRO premium |
| 2 | LC-5 visual obstáculos no-pieza | P0 | — | Rocas/grises/muros | Decisión visual clave |
| 2 | LC-6 eligibleForDailyLab flag | P1 | LC-1 | Catálogo etiquetado | Para DL-1 |
| 2 | LC-7 Knight conserva 5 | P0 | — | No reducir | Surplus aceptado |
| 3 | ER-1 pool por pieza | P1 | CA-1 ≥50% | Pool leído de catálogo | Refactor técnico |
| 3 | ER-2 seed determinístico | P1 | ER-1 | Idempotente día+wallet | Crypto hash sha256 |
| 3 | ER-3 mostrar 5/día | P1 | ER-2 | UI render correcto | Reemplaza hardcoded |
| 3 | ER-4 bias menos completados | P1 | ER-2, CA-3 | Bias verificable | Selector ranking |
| 3 | ER-5 guest canonical 5 | P1 | ER-2 | First visit override | Conversion |
| 3 | ER-6 guest session_uuid | P1 | ER-5 | sessionStorage rota | Re-visitante guest |
| 3 | ER-7 chip "Today" | P1 | ER-3 | UI completados ✓ | Discoverability |
| 4 | TP-1 Easy día 1 | P1 | ER-1 | Default unlocked | Trivial |
| 4 | TP-2 Medium @ 5★ | P1 | TP-1 | Gate funcional | Star count |
| 4 | TP-3 Hard @ 9★ | P1 | TP-2 | Gate funcional | Star count |
| 4 | TP-4 10★ across pool (CERRADO) | P1 | TP-1..3 | Suma estrellas únicas pool 15 | Founder 2026-06-08 |
| 4 | TP-5 copy mastery | P1 | TP-4 | EN+ES sync | i18n |
| 4 | TP-6 progress bar por tier | P1 | TP-4 | UI clara | Discoverability |
| 5 | DL-1 Daily Lab gratis | P2 | LC-6 | 1/día visible | Carrot |
| 5 | DL-2 seed diario | P2 | DL-1 | Hash determinístico | Reuse ER-2 helper |
| 5 | DL-3 anti-repetición | P2 | DL-2 | No repeat <N días | N = ceil(catálogo/7) |
| 5 | DL-4 registrar completion | P2 | DL-1 | Persistencia | localStorage + telemetry |
| 5 | DL-5 surface en hub | P2 | DL-1 | Entry visible | UX decision |
| 5 | DL-6 Peones Hint en lab | P2 | DL-1 | Sin cambios spend | Reuse existente |
| 6 | PE-1 segundo Daily Lab PRO | P3 | DL-1 | PRO ve 2 | Recurrencia |
| 6 | PE-2 ~~tier rotation lead~~ DESCARTADO | — | — | PRO no adelanta tiers | Founder 2026-06-08 |
| 6 | PE-3 copy "dos al día" | P3 | PE-1 | EN+ES sync | i18n |
| 6 | PE-4 free no gated en aprendizaje | P3 | — | Test free path | Principio |
| 7 | TM-1 rotation.daily_set_served | P3 | ER-3 | Event emit verificado | Telemetry |
| 7 | TM-2 exercise_completed event | P3 | ER-3 | Existente, extender | Add tier field |
| 7 | TM-3 daily_lab served/completed | P3 | DL-1 | Events emit | Telemetry |
| 7 | TM-4 daily_lab_pro events | P3 | PE-1 | Events emit | Telemetry |
| 7 | TM-5 guest funnel events | P3 | ER-5 | 3 events | Conversion |
| 7 | TM-6 dashboard KPIs | P3 | TM-1..5 | KPIs computables | `/stats` extension |

**Prioridades resumen:**
- **P0** (cuello bottleneck — contenido): CA-1..6, LC-1..5, LC-7.
- **P1** (rotation engine + tiers): LC-6, ER-1..7, TP-1..6.
- **P2** (Daily Labyrinth global): DL-1..6.
- **P3** (PRO extras + telemetry): PE-1..4, TM-1..6.

---

## 12. Critical dependencies

- **CA → ER:** rotation engine no se justifica sin pool de contenido. Hard gate.
- **LC-1..5 → DL-1:** Daily Lab necesita catálogo etiquetado y floor estandarizado.
- **TP-4 (10★ across pool) → ER-3:** la UI del rotation engine refleja la mecánica de stars; necesita decisión antes de implementar.
- **ER-5/ER-6 → TM-5:** guest funnel events solo tienen sentido con el modelo guest implementado.
- **CA-3 (tier classification) → ER-4 (bias) → TP-2/TP-3 (gates):** tier es metadata que atraviesa 3 epics.

---

## 13. Decisiones de producto (CERRADAS — founder 2026-06-08)

1. **Refactor arranca con 10/15 (CA-1).** Easy+Medium completos; Hard (CA-2) en paralelo. Copy "Hard coming soon".
2. **PRO NO adelanta tiers (PE-2 descartado).** Mismo ritmo educativo 5★/9★ free y PRO. PRO diferencia por 2do Daily Lab, hints/retries, coach premium, themes, historial extendido, study skip (a validar).
3. **Guest model aprobado (ER-5/ER-6).** Canónicos 5 → prompt suave post-5 → wallet seed o `session_uuid` fallback.
4. **10★ across pool de 15 (TP-4).** Suma de estrellas únicas; badge contract intacto. Adoptado en pre-launch.
