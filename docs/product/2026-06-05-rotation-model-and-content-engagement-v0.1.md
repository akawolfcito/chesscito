# Chesscito — Modelo de Rotación + Estrategia de Contenido v0.1

**Owner**: John (PM) · **Stakeholders**: Wolfcito (founder), eng
**Date**: 2026-06-05 · **Status**: Direction approved — Post-Sprint 4 Engagement Expansion

> **Frase guía**: La Senda enseña. El Daily sostiene el hábito. PRO suaviza y expande la experiencia.

## 1. Postura

**Rotación híbrida (b)+(c).** Tier progresivo pedagógico pre-badge, daily practice rotativo post-badge. (a) "fixed bank by wallet" descartado: el founder ya lo identificó como tóxico ("soso, me sé todo de memoria"). Esto NO reemplaza Sprint 1-3 — es la dirección de expansión POST-Sprint 4.

## 2. Modelo de rotación de ejercicios

- **Pre-badge (Senda canónica)**: usuario corre tier-1 → tier-2 → tier-3 linealmente. "Current 5" = tier activo. 10★ desbloquea badge ERC-1155 cuando el primer tier llega a 3★×5. **Contrato badge intacto.**
- **Post-badge (Daily Practice)**: el slot muta. En v0.1 inicial, **3 ejercicios rotativos por pieza/día**, seeded por `wallet + day_utc`. Sube a 5 diarios en v0.2 cuando el catálogo madure.
- **Por qué 3 y no 5 en v0.1**: con 15 ejercicios por pieza, mostrar 5 diarios quema el pool en 3 días. 3 diarios = ~5 días de variedad antes de repetir + sostiene la sensación de hábito.
- **Por qué no (c) puro**: random destruye la pedagogía (easy después de hard rompe el flow) y degrada el 10★ a "racha de suerte". (b) puro es finito. Híbrido rescata ambos.

## 3. Laberintos como momento wow

Mínimo viable: **3 laberintos por pieza** (Easy/Medium/Hard tier). Catálogo actual ≈17 → +1 en King + reclasificar Knight (5 ya tiene, queda lujo) y Bishop (2, falta 1).

- **Daily Labyrinth Challenge**: 1 slot global que rota diario del pool agregado de 18. Independiente del progreso de pieza. **Este es el "vuelve mañana" del laberinto.**
- **Replay mechanic**: track best move count + best time per wallet. UI muestra "tu record" vs "intento de hoy". Sin leaderboard global — fuera de scope.
- **PRO framing**: Free ve Daily Labyrinth base. PRO desbloquea **Hard Challenge / Bonus Challenge / Advanced variant** del mismo día. No es restricción del core; es expansión avanzada.

## 4. Guest policy

Híbrido por surface, no monolítico:

- **Piece completion flow (onboarding)**: opción (b) **curated canonical**. Los mismos 5 best-in-show por pieza para todo guest. Primera impresión = momento de conversión wallet. No randomizar.
- **Daily slot home**: opción (a) **sessionStorage UUID seed** → random per session. Guest que vuelve mañana debe ver algo distinto, o el daily hook muere antes de conectar wallet.

## 5. KPIs (4 semanas post-ship v0.1)

| Métrica | Baseline | Target v0.1 |
|---|---|---|
| DAU 7d rolling | actual | +30% |
| D1 retention | ~25% proxy | ≥35% |
| D7 retention | ~10% proxy | ≥15% |
| % wallet-connected reaching 10★ en cualquier pieza | actual | ≥40% en 14d desde primer session |
| Daily Tactic 30-day return | n/a | ≥50% |
| Labyrinth replay rate | n/a | ≥60% de completers re-intentan |

## 6. Contenido mínimo — por fases

| Fase | Ejercicios | Laberintos | Daily Practice |
|---|---|---|---|
| **MVP realista** | **60 (10/pieza)** | 18 (3/pieza) | 3 diarios |
| **v0.1 completo** | 90 (15/pieza) | 18 | 3 diarios |
| **v0.2 expansión** | 90+ | 18+ | 5 diarios + Hard tier completo |

90 sigue siendo el ideal, pero **NO debe bloquear ship**. El bottleneck real es contenido, no código. Si capacity escasea, ship con 60 (Easy+Medium, Hard tier llega en wave 2).

## 7. Monetización M1 — PRO suaviza, no bloquea

**Regla**: PRO monetiza por **suavizar experiencia y expandir challenge**, jamás por gating del aprendizaje base.

- **PRO**:
  - Daily Labyrinth **Hard / Bonus / Advanced challenge** (no reemplaza el base; lo amplía).
  - **Study skip** (saltar tier-2 con 5★ en tier-1).
  - Hints/retries incluidos o con menor costo en Peones.
  - Coach analysis premium.
  - Themes cosméticos.
  - Historial/records extendidos.
- **Hard tier de ejercicios = LIBRE**. Nunca PRO-only. PRO no es paywall educativo.
- **Peones (créditos)**: 5 = hint, 10 = retry sin penalty estelar. Reusa el daily cap del Sprint 3 ledger — sin economía nueva.
- **Themes (foundation dormida)**: reskin **visual** del daily labyrinth (Halloween bg, PRO-gold-leaf board variant). **NO content packs** — fragmentar el catálogo lo vuelve ingobernable.
- **VictoryNFT/Arena**: untouched.

## 8. Peones — economía del Daily

Daily Practice post-badge **debe dar Peones**, dentro del cap diario de la familia Daily (Sprint 3 ledger). No crea economía paralela.

| Acción | Peones |
|---|---|
| Daily Tactic | +3 |
| Daily Practice post-badge | +1 a +3 según performance |
| Daily Labyrinth (base) | +3 |
| Daily Labyrinth (Hard/Bonus, PRO) | +5 |
| Training normal (Senda) | delta positivo de estrellas |

Daily-family respeta cap diario de **10 Peones/wallet/UTC-day** ya enforced en Sprint 3 (`PEONES_DAILY_CAP_SOURCES`).

> **Nota técnica futura (ledger)**: Daily Practice post-badge debe modelarse como fuente **Daily-family**. Recomendación: cuando se implemente, agregar `source: "daily_practice"` al ledger e incluirlo en `PEONES_DAILY_CAP_SOURCES`. **NO reutilizar `exercise_completion`** — esa fuente NO está sujeta al cap diario (es delta de estrellas en la Senda), y Daily Practice SÍ debe respetar el cap de 10 Peones/wallet/UTC-day. Confundir las fuentes rompería el cap silenciosamente.

## 9. Open questions con decisión recomendada

1. **¿Quién produce el contenido?**
   Recomendado: Wolf + Professor César definen criterio pedagógico → AI/Clausita genera candidatos → BFS verifier valida `optimalMoves` → humano aprueba calidad final. Roadmap: primero +30 ejercicios (llegar a 60 MVP), luego +30 más (llegar a 90 v0.1 completo).
2. **¿Daily Practice da Peones?**
   Recomendado: **Sí, con cap diario.** Se integra con el ledger de Sprint 3 sin invención de economía paralela.
3. **¿Hard tier de ejercicios es PRO-only?**
   Recomendado: **No.** Hard ejercicios queda libre. PRO se enfoca en Daily Labyrinth Challenge, study skip, consumibles incluidos y experiencia premium.

## 10. Timing recomendado

- **Este modelo NO reemplaza Sprint 1-3.**
- **Este modelo NO se implementa antes de estabilizar Peones.**
- Queda parqueado como **dirección "Post-Sprint 4 Engagement Expansion"**.
- Pre-requisitos para arrancar el cluster:
  1. Validar Sprint 3 en hosted Supabase (en curso).
  2. Cerrar Sprint 4 calibration (spend endpoint + UX consumo Peones).
  3. Definir spend / Compendio TX.
  4. Decidir convivencia Coach credits vs Peones (¿unificar? ¿paralelos?).

## 11. Conexión con lo ya construido

| Ya construido | Cómo habilita este modelo |
|---|---|
| King extendido a 9 ejercicios | Primer paso hacia tiers |
| BFS verifier hard-fail | Permite producir contenido validado |
| Daily Tactic pool 30 | Base del daily loop |
| Peones ledger Sprint 3 | Permite rewards reales |
| HUD Peones | Hace visible la economía |
| PRO extras plumbing | Base para Daily Labyrinth PRO |
| Stablecoin research | Base para packs/recargas futuras |

## 12. Decisión final

| Tema | Decisión |
|---|---|
| Modelo de rotación | Híbrido b+c |
| Badge 10★ | Intacto |
| Guest onboarding | Canónico |
| Guest daily slot | Random/session-day |
| Daily Practice da Peones | Sí, con cap |
| Hard ejercicios PRO-only | No |
| Hard Labyrinth PRO | Sí, como challenge extra |
| Contenido mínimo | 60 primero, 90 como v0.1 completo |
| Timing | Post-Sprint 4 Engagement Expansion |
