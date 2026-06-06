# Chesscito — Dirección de Engagement del Training Loop

**Fecha:** 2026-06-05
**Autor:** John (PM, dirigido por Wolfcito)
**Estado:** Postura de producto consolidada. **Refinada con feedback Wolfcito sesión 2026-06-05.** Reemplaza la propuesta técnica "seeded rotation by wallet" como driver de engagement.
**Alcance:** Define el modelo de rotación, la unificación económica Peones=Estrellas, los laberintos enriquecidos, la política de guests, la reactivación del Founder Badge, gifting, fricción TX y el roadmap visible 10 sprints.
**Tesis hermana:** `chesscito-monetization-direction-2026-06-01.md` ("Chesscito monetiza ayudando al usuario a mejorar").

---

## Tesis central

> **Chesscito gana cuando jugar te da peones, los peones reducen la fricción del próximo paso, y el próximo paso te enseña algo nuevo. La moneda, la pedagogía y la mecánica se cierran en un solo loop.**

El dolor original del fundador ("soso, me sé los 5 de memoria, resuelvo el laberinto y ahí queda") no se cura con randomización cross-wallet. Se cura con tres cambios estructurales:

1. **Loop económico cerrado** — cada estrella ganada ES un peón en tu wallet (unificación de moneda).
2. **Daily Tactic con recompensa material y pool ampliado** — reason-to-return diaria respaldada por Peones.
3. **Laberintos enriquecidos por tier** — recolección, hazard, llaves/puertas. Dejan de ser navegación pura.

Encima de ese loop monta el roadmap social (PvP, Visor con tip-de-piezas, Gifting PRO) y la activación del Founder Badge como vector de revenue identitario.

---

## 1. Modelo de rotación — Senda persistente + Daily Tactic evolucionado

### 1.1 Senda canónica per piece (10 ejercicios fijos)

- Ruta ordenada de **10 ejercicios** por pieza, secuencial, persistente, "best-of-attempts". Los 5 actuales (e.g., `king-1..5`) se mantienen exactos como Tier 1; los 5 nuevos (`king-6..10`) extienden como Tier 2.
- **Igual para todas las wallets** — la senda es pedagogía curada, no juego de variedad. La consistencia es feature, no bug.
- Badge claim a 10★ se preserva exactamente como hoy. Las 5 nuevas son progresión post-badge para usuarios que quieren completar 100%.
- **Cero migración localStorage** — el stars[5] actual sigue mapeando 1:1 a los primeros 5 slots.

### 1.2 Daily Tactic evolucionado (NO un sistema paralelo)

**Hallazgo crítico de discovery:** ya existe un Daily Tactic en el HUB (`apps/web/src/components/daily/*` + `lib/daily/daily-puzzles.ts`). Tiene **14 puzzles globales**, rotando por día UTC, con streaks ya implementados. **NO inventar paralelo.** Evolucionarlo:

| Aspecto | Hoy | Target |
|---|---|---|
| Pool size | 14 puzzles | **30 puzzles** (incluir King, balancear piezas) |
| Recompensa | Solo streak visible | **3 Peones + bonus 3★ + bonus racha 7d** |
| King incluido | No | **Sí** (gap pedagógico real) |
| PRO benefit | Ninguno | **2 extras semanales** (Friday Premium Lab + Sunday Showdown) |
| Tier difficulty | No diferenciado | **Easy / Medium / Hard tagged** + balanceado por día |
| Cap diario | N/A | Máx 10 Peones ganables/día por todas las fuentes Daily combinadas |

### 1.3 Por qué este modelo gana sobre los alternativos

- **Rechazo (a) Banco fijo cross-wallet:** validado por fundador — soso, me sé todo de memoria.
- **Rechazo (c) Daily random puro per piece:** rompe el contrato del 10★ badge y ambigua progresión.
- **Rechazo (b) Duolingo puro:** mata el "vuelve mañana" una vez subes de nivel.
- **Adopto Senda + Daily Tactic evolucionado:** la senda preserva la pedagogía y el contrato del badge; el Daily da reason-to-return material; y nunca dupliamos sistemas.

---

## 2. Unificación económica — Peones = Estrellas

**Hoy:** Peones (créditos consumibles) y Estrellas (marcadores de mastery) son dos monedas separadas. El usuario debe aprender ambas. El loop económico está roto: ganar estrellas no te da poder real.

**Postura:** **fusionar. Cada estrella ganada en cualquier ejercicio/laberinto deposita el equivalente en Peones en tu wallet.** Las estrellas siguen siendo visuales (mastery markers) pero su valor económico se materializa como Peones inmediatamente.

### 2.1 Mecánica del loop

| Acción | Estrellas (mastery) | Peones (wallet) |
|---|:--:|:--:|
| Ejercicio 3★ primer try | +3 | +3 |
| Ejercicio 2★ | +2 (best-of) | +2 |
| Ejercicio replay con misma puntuación | 0 (ya tenías) | 0 (no se duplica) |
| Daily Tactic 3★ | +3 (mastery del día) | +3 + bonus 2 |
| Daily Lab 3★ | — | +3 (escalonado por dificultad) |
| Racha 7d Daily | — | +1 bonus |

### 2.2 Caps anti-inflación

- Cap diario combinado: **10 Peones ganables/día** de fuentes Daily (Daily Tactic + Daily Lab + racha bonus).
- Pasado el cap: sigues ganando **estrellas** (mastery) pero no Peones. El usuario sigue progresando, la economía no se infla.
- La Senda canónica NO tiene cap — pero como solo se gana 30 Peones por pieza completa (10 ej × 3★ máx), y son 6 piezas, el total earnable de Senda es 180 Peones lifetime. Suficiente para 6 meses de Coach análisis casual.

### 2.3 Impacto en M1

Un usuario engaged puede ganar ~30-40 Peones/semana solo jugando. Eso es 1 pack de Coach gratis cada 2 semanas. **Esto es feature, no bug** — convierte casuals en activos, los activos en eventuales compradores de packs temáticos / themes / extras Coach. El revenue se desplaza de "comprar Coach para usarlo" → "comprar identidad / contenido temático / unlock recurrente".

---

## 3. Laberintos enriquecidos — Tier T1-T5

El dolor: "resuelvo el laberinto y ahí queda". Diagnóstico: los laberintos actuales son **navegación pura** (de A a B), no laberintos reales. La referencia visual del fundador (camino verde serpenteante entre obstáculos, bandera de inicio, trofeo de meta, recolectables en ruta) define el target.

### 3.1 Modelo de tiers

| Tier | Mecánica | Pedagogía | Effort |
|:--:|---|---|:--:|
| **T1 — Path** | A → B esquivando muros (lo que existe hoy) | Navegación + planning | ✅ existe |
| **T2 — Collect** | A → B recolectando N estrellas/peones en el camino | Optimización de ruta + economía | 🟡 nuevo |
| **T3 — Hazard** | A → B esquivando casillas amenazadas (attackedSquares) | Lectura táctica de tablero | 🟡 nuevo (requiere `attackedSquares` modeling) |
| **T4 — Key & Door** | A → llave → B (puerta solo se abre con llave; llave alcanzable o comprable con Peones) | Secuencia + dependencia + decisión económica | 🔴 nuevo (state machine + economía intra-laberinto) |
| **T5 — Hybrid** | Combinaciones T2+T3+T4 | Síntesis | 🔴 requiere T2+T3+T4 |

### 3.2 Llave de la puerta T4 como vector económico interno

La llave de T4 es el primer caso de **Peones-pagados intra-laberinto**:
- Si llegas a la llave caminando → gratis
- Si compras la llave para saltar el detour → **1 Peón**
- Esto crea decisión micro: "¿gastar Peones para optimizar o jugar más para ganar más?"
- Es la metáfora visual del modelo M1 completo (PRO/Peones reducen fricción opcionalmente)

### 3.3 Hint y retry intra-laberinto

- **Hint del óptimo:** 1 Peón → muestra el siguiente movimiento óptimo
- **Retry sin perder racha:** 2 Peones
- Estos NO son monetización predatoria — son onboarding del modelo Peones-reducen-fricción.

### 3.4 Mínimo viable por pieza

- **Piso:** 3 laberintos locales por pieza (King +2 y Bishop +1 son P0; el resto está aceptable hoy).
- **Target:** 5 laberintos locales por pieza (Easy 2 / Medium 2 / Hard 1).
- Más allá del piso, **el premium real es el Daily Lab global rotativo** (sección 1.2) — un único laberinto del día rotado entre piezas, desde pool de 20-30.

---

## 4. Compendio de TX — cero fricción percibida vía Peones

**Insight Wolfcito (sesión 2026-06-05):** el modelo actual obliga al usuario a firmar múltiples tx para acciones que conceptualmente son micro. Cada tx en MiniPay = abrir wallet, confirmar, esperar gas en cUSD. Esto mata UX.

### 4.1 Matriz de fricción TX por acción

| Acción | Sin PRO + sin Peones | Con Peones | Con PRO |
|---|---|---|---|
| Save partida | tx + cUSD visible | **-1 Peón, sin tx** | Sin tx, sin costo |
| Coach analysis | tx + cUSD visible | **-1 Peón, sin tx** | Gratis ilimitado |
| Hint laberinto | tx + cUSD visible | **-1 Peón, sin tx** | Sin tx, sin costo |
| Llave puerta T4 | tx + cUSD visible | **-1 Peón, sin tx** | Sin tx, sin costo |
| Retry laberinto | tx + cUSD visible | **-2 Peones, sin tx** | Sin tx, sin costo |
| **Badge claim** | tx + gas | tx + gas | tx + gas (siempre — soulbound público) |
| **Mint VictoryNFT** | tx + cUSD visible | tx + cUSD visible | tx + cUSD visible (siempre — coleccionable público) |

**Principio operativo:** TX visibles SOLO cuando hay persistencia pública (badges, NFTs, PRO sub renewal). Todo lo consumible se paga con Peones off-chain → el usuario NO siente fricción de tx.

### 4.2 Implementación técnica

- Ledger off-chain de Peones: Supabase (preferido) o Redis con write-through.
- Cada gasto se firma con wallet + se persiste un **attestation hash** → trazabilidad sin tx onchain.
- Recargas de Peones (compra de packs): 1 sola tx onchain por pack, depositan Peones al ledger.
- Saldo de Peones siempre visible en HUD; gasto visible como decrement inmediato.

### 4.3 Tradeoff aceptado

Pierdes trazabilidad on-chain del consumo granular. Ganas UX brutal + reducción ~70% de tx en flujo normal. **Es el tradeoff correcto** — el usuario casual no quiere auditoría onchain de cada hint, quiere fluidez.

---

## 5. Política de guest experience — Onboarding canónico

**Rechazo brazalete UUID por sesión.** Decisión: guests ven la Senda canónica (mismos primeros 5 ejercicios curados), con CTA explícito ("Conecta tu wallet para guardar tu progreso, ganar Peones y desbloquear el Daily Tactic").

**Razones:**

1. Primera impresión es la decisión más cara — necesitamos saber QUÉ ve el primer usuario para iterar copy/UX. Variabilidad random vuelve los datos ruido.
2. La conversión guest → wallet se mide contra una experiencia controlada, no aleatoria.
3. "Ya jugué esto" como guest reincidente no es el problema real — el problema es que el CTA "conecta para Peones + Daily" no estaba claro.
4. Los 5 primeros de la senda son la lección PEDAGÓGICAMENTE MÁS FUERTE — no son random, son curados.

**CTA progresivo:**
- Ejercicio 1-2: sin presión, solo juego.
- Ejercicio 3: CTA suave "Conecta para guardar progreso".
- Ejercicio 4: aparece counter "🌰 Peones que ganarías si estuvieras conectado: 12".
- Ejercicio 5: CTA fuerte "Conecta para ganar tus 15 Peones + Daily Tactic".

Mostrar el valor antes de pedir la conexión. **El guest no se pierde — el guest aprende que conectarse vale algo.**

---

## 6. Founder Badge reactivación

El Founder Badge se ocultó del Shop en M1 porque "no teníamos forma de entregar valor". Con esta iniciativa hay 5 vectores de valor reales:

### 6.1 Beneficios del Founder Badge

1. **Avatar dorado exclusivo** — visible en HUB, profile, leaderboard, y **embebido en share cards** (viral por diseño).
2. **Theme `founder-gold-leaf`** — distinto al `pro-gold-leaf` (PRO sub), más ornamentado, **lifetime ownership**.
3. **+10% bonus de Peones** en cada compra de packs (LTV multiplier).
4. **Acceso anticipado a Themes nuevos** (Halloween, Christmas drops 7 días antes que público general).
5. **Etiqueta "Founder" en share cards** y badge soulbound permanente — storytelling viral.

### 6.2 Pricing recomendado

**$9.99 USD lifetime one-time**. Posicionado como "Founder Support" no como "producto". La narrativa de apoyar el proyecto importa más que el precio.

### 6.3 Por qué no canibaliza PRO

PRO es **utilidad recurrente** (Coach unlimited, Daily Lab extras, theme PRO). Founder es **identidad lifetime** (avatar dorado, bonus Peones, primera vista de drops). Públicos distintos:
- PRO = "quiero jugar más profundo este mes"
- Founder = "creo en el proyecto, lo apoyo de por vida"

Un Founder puede comprar PRO encima (stacking benefits). Pricing aditivo, no sustituto.

### 6.4 Implementación

- Re-mostrar Founder en Shop con copy nuevo + visuales actualizados.
- Wire de `+10% Peones bonus` en endpoint de compra de packs.
- Theme `founder-gold-leaf` se agrega al registry como tema premium gated por ownership del Founder Badge.
- Avatar dorado: nueva variante `useThemeAsset("avatar.profile", "founder")` con fallback a `default`.

---

## 7. Gifting PRO — feature B2B/social

### 7.1 Caso de uso

Ejemplo concreto (Wolfcito): "Federación Deportiva de Colombia regala 10 PRO a estudiantes del curso vacacional en Medellín". Esto NO está implementable hoy.

### 7.2 Modelo propuesto

- Página `/gift/pro` — compras 1-10 subscripciones PRO en una sola tx
- Asignación dual:
  - (a) Wallets concretas si las tienes
  - (b) **Redention codes** (tipo "CHESS-XX9F-K2LP") si no las tienes — compartibles vía link/QR
- El destinatario redime conectando wallet + ingresando código
- Códigos expiran a 90d si no se redimen
- Refund al comprador del 80% de lo no redimido (mantener trust)

### 7.3 Targets

- **Academias/federaciones de ajedrez** (high-value, B2B, ticket $20-200)
- **Padres → hijos / profesor → alumno** (social storytelling, ticket $2-20)
- **Power-users que apoyan creators/streamers** (donación visible, ticket $2-10)

### 7.4 Implementación

- Redention codes off-chain (Supabase + endpoint sign-pro-grant)
- 1 tx onchain por gift (compra), 0 tx para el destinatario (PRO se otorga off-chain al redimir)
- Sin tocar contracts existentes
- Cluster propio post-MVP, **sprint 9-10**

---

## 8. Persona vs Persona + Visor con tip-de-piezas

Estos dos features cierran el loop social y dan a Chesscito su destino aspiracional. **No son implementación inmediata, pero deben estar visibles en roadmap.**

### 8.1 Persona vs Persona (PvP)

- Matchmaking server-side
- Estado de partida sincronizado en tiempo real
- Anti-cheat básico (mover dentro de tiempo, validación server-side de movimientos legales)
- Daily ranked match con prize pool semanal en Peones
- Cluster propio, **sprint 7-8**

### 8.2 Visor con tip-de-piezas (modelo Twitch bits / TikTok diamonds)

**El insight:** convertir Peones en **gifting visual abstracto** durante partidas spectator.

| Pieza-tip | Costo en Peones | Efecto en visor |
|---|:--:|---|
| Peón | 1 | Pequeña animación + texto |
| Caballo | 3 | Animación + sonido + texto destacado |
| Alfil | 3 | Animación + sonido + texto destacado |
| Torre | 5 | Animación grande + alert al jugador |
| Reina | 10 | Animación premium + spotlight |

**Mental abstraction:** el spectator NO siente que gasta $0.50 — siente que "lanzó un caballo" al jugador. Coach mismo se compra como "3 caballos = 9 Peones" — el costo se abstrae en piezas.

**Por qué este modelo funciona:**

- El spectator gasta sin sentir la transacción → loop económico super engaged
- El jugador acumula tips → más razón para jugar bien en visor
- Los Peones tienen DOS sumideros (consumibles personales + gifting social) → economía robusta
- Replica el éxito de Twitch bits ($1B+/año), TikTok gifts, YouTube Super Chat

Cluster propio, **sprint 9-10**.

---

## 9. KPIs comprometidos

| KPI | Baseline (estimado) | Meta post-rollout (90d) |
|---|---|---|
| **DAU 7d rolling** | actual | **+20%** |
| **Retention D1** | ~30% | **+5pp** |
| **Retention D7** | ~10% | **+10pp** |
| **% wallets connected con ≥1 pieza a 10★** | actual | **25%** |
| **Daily Tactic completion rate** | hoy ~? (no instrumentado completo) | **40% de DAU** |
| **Daily Lab attempt rate (PRO)** | nuevo | **70%/week** |
| **Streak ≥7 días Daily Tactic** | nuevo | **15% de DAU connected** |
| **Peones earned/active user/week** | nuevo | **30-40 Peones promedio** |
| **Conversion guest → connected** | actual | **+15%** (vía CTA progresivo §5) |

**Streak ≥7d es el indicador más fuerte de hábito.** Si no llegamos a 15%, el reward (3 Peones) es muy bajo o la fricción de abrir la app es muy alta.

---

## 10. Mínimo viable de contenido por pieza

| Asset | Hoy | Target MVP | Delta autoría |
|---|:--:|:--:|:--:|
| Senda ejercicios (por pieza) | 5 | 10 | +5 |
| Pool Daily Tactic (global) | 14 | 30 | +16 (incluir King) |
| Laberintos locales (por pieza) | 1-5 | 3-5 (piso 3) | King +2, Bishop +1 |
| Pool Daily Lab (global, rotativo) | 0 | 20-30 | +20-30 (puede usar laberintos existentes + nuevos) |

**Authoring effort total:** ~50-60h diseño + verificación BFS de `optimalMoves`. Phaseable en 4 sprints de 1 semana.

---

## 11. Wiring con M1 (sin romper)

**PRO ($1.99/mes) — refuerza valor:**

- 2 Daily Labs extra por semana (Friday + Sunday)
- "Senda PRO" — 5 ejercicios adicionales por pieza, marcados con anillo dorado (post-10★)
- Coach unlimited (ya existe)
- Theme `pro-gold-leaf` activo (foundation ya lista)
- Hints/retries gratis en laberintos (sin gastar Peones)
- Save partida sin costo Peones

**Peones — economía de incentivo unificada:**

- **Earn:** completar Daily Tactic, 3★ Daily Lab, racha 7d, completar ejercicios senda (cap diario 10 fuentes Daily).
- **Spend:** hints, retries, llaves T4, Coach individual (1 Peón), packs temáticos, tip-de-piezas en visor.
- Loop cerrado: jugar genera Peones → Peones reducen fricción → fricción reducida = más juego.

**Themes (foundation dormida → activación con contenido):**

- Pack temático = skin + 3 ejercicios + 1 laberinto exclusivo
- Ej: "Pack Halloween" trae art + "Caza del Fantasma" (laberinto Knight) + 3 ejercicios temáticos
- Precio sugerido: **$0.50-1.00 por pack** (justificado por contenido extra, no solo cosmético)
- Founders tienen **acceso 7d antes** que público general
- PRO tiene **descuento 20%** en packs temáticos

**Founder Badge — vector de revenue identitario:**

- $9.99 lifetime, posicionado como "Founder Support"
- Avatar dorado + theme `founder-gold-leaf` + bonus Peones + early access drops
- Reactivado en Shop (hoy oculto)

**VictoryNFT (Arena) — sin cambios.** Sigue intacto. Esta iniciativa no toca Arena.

---

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Authoring effort excede capacidad | Alta | Comenzar con 5 nuevos King + 5 Daily Tactic incluyendo King; medir engagement antes de extender. No autorear las 6 piezas a la vez. |
| Daily Tactic se siente "obligatorio" → backlash | Media | Nunca penalizar por perderlo; racha solo da bonus, nunca quita. Copy enfatiza "vuelve cuando quieras". |
| Peones inflation por earn rate alto | Media | Cap diario combinado 10 Peones de fuentes Daily. Senda cap natural (180 Peones lifetime total). |
| PRO no se siente más valioso post-rollout | Media | Daily Lab extras + Senda PRO + hints gratis deben ser ≥40% del valor percibido (no solo Coach). Sin esto, churn sube. |
| Ledger off-chain de Peones se corrompe | Media | Backups Supabase + checksum por wallet + reconciliation diaria + audit log de cada movimiento. |
| Tip-de-piezas se percibe como gambling | Baja-Media | Diseñar copy como "support a jugador", no "apuesta". Sin RNG, sin payout — pure social tip. |
| Gifting PRO con código no redimido genera UX malo | Baja | Refund automático 80% a 90d + reminder email al destinatario a 30/60/85d. |
| Founder Badge canibaliza PRO sub | Baja | Públicos distintos validados (utilidad recurrente vs identidad lifetime). Pricing aditivo. |

---

## 13. Roadmap visible — 10 sprints

> **Importante:** este roadmap está aquí no solo para guiar implementación sino para que stakeholders, contributors y la comunidad **vean la visión completa**. La gente apoya proyectos cuando ve para dónde van, no solo qué hicieron la semana pasada.

| Sprint | Cluster | Entregable | Status |
|:--:|---|---|:--:|
| **1** | King Senda 5→10 | Extender senda Rey, BFS verifier, VR refresh | 🟡 next |
| **2** | Daily Tactic Evolution | Recompensa Peones, King incluido, pool 14→30, racha bonus | 🟡 |
| **3** | Peones=Estrellas + Ledger off-chain | Unificación moneda, Supabase ledger, attestation hash | 🔴 |
| **4** | Compendio TX (Peones reducen fricción) | Coach, hints, retries, llaves T4 vía Peones | 🔴 |
| **5** | Laberintos T2 (Collect) | Recolectables en ruta, 2 labs T2 piloto (Knight + Rook) | 🔴 |
| **6** | Founder Badge reactivación + Theme `founder-gold-leaf` + Halloween Pack pilot | Reactivar Shop, avatar dorado, primer theme pack con contenido | 🔴 |
| **7** | PvP MVP | Matchmaking, game state sync, anti-cheat básico | 🔴 |
| **8** | Laberintos T3+T4 (Hazard + Key/Door) | attackedSquares modeling, state machine T4, economía intra-laberinto | 🔴 |
| **9** | Gifting PRO | Página `/gift/pro`, redention codes, B2B onboarding | 🔴 |
| **10** | Visor con tip-de-piezas | Spectator UI, gifting visual, economía piezas-como-tip | 🔴 |

**Sprint = 1 semana de trabajo (Wolfcito + Claude pair).** Adjust según realidad de tiempo y bandwidth.

---

## 14. Lo que NO estamos resolviendo (parqueo explícito)

- **Tournament mode** (laberinto semanal con bracket): considerar para v0.3 si Daily Lab valida hábito.
- **On-chain leaderboard de training**: hoy training no sube on-chain (Arena-only). Mantener así hasta que volumen justifique `TrainingScoreboard` contract.
- **Generador procedural de ejercicios**: out of scope para MVP; el pool autorado es suficiente para 6-12 meses.
- **Multiplayer torneo bracket**: sprint 11+, depende de PvP MVP estable.
- **Social feed / following**: no en MVP. Si visor + tip-de-piezas valida engagement social, considerar v0.4.

---

## 15. Open questions para Wolfcito

1. **PRO Daily Lab extras** — ¿2 (Friday + Sunday) o subes a 3 para reforzar upgrade? Tradeoff: más extras = mayor percepción de valor PRO pero más authoring/week.
2. **Peones cap diario de 10** — primer número arbitrario. Justificar con economy modeling en sprint 3.
3. **Founder pricing $9.99** — ¿estás cómodo con ese tier o prefieres $4.99 (más accesible) o $19.99 (más exclusivo)?
4. **Theme packs con contenido** — Halloween pack: ¿revenue inicial (todos pagan) o benefit a PRO subs (regalado)? Recomendación: vender estándar, regalar a Founders + descuento 20% a PRO.
5. **Tip-de-piezas: ¿qué pieza inicial tiene cada usuario?** Sugerencia: empiezas con 5 peones disponibles para tip (no para gastar en otras cosas) — primer experiencia gratuita.
6. **Racha de 30 días → badge soulbound "Devoto"** — propuesto en brief original. ¿Lo agregamos como hito visual sin contrato extra (badge off-chain) o soulbound real (contrato)?
7. **Gifting PRO refund 80%** — ¿es el porcentaje correcto? Tradeoff entre trust y operacional cost.

---

## 16. Métricas de éxito del documento

Este doc es exitoso si en 90 días:

- Sprints 1-4 están shipped y los KPIs de §9 son medibles (no necesariamente alcanzados, pero instrumentados).
- La comunidad de early adopters puede leer §13 y entender hacia dónde va Chesscito.
- Stakeholders / potential investors pueden leer §6, §7, §11 y entender el modelo de revenue.
- Wolfcito puede usar este doc como north star para decisiones tácticas semanales sin re-deliberar.

---

## Cross-references

- **Monetization tesis:** `docs/product/chesscito-monetization-direction-2026-06-01.md`
- **Telemetry contract M1:** `docs/monetization/telemetry-events-m1.md`
- **Theme system foundation:** `docs/superpowers/specs/2026-05-26-theme-system-foundation.md`
- **Training content v0.1 spec:** `docs/superpowers/specs/2026-06-02-training-content-v0.1.md`
- **Labyrinth design v0.1:** `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md`
- **Daily Tactic existing code:** `apps/web/src/components/daily/*` + `apps/web/src/lib/daily/*`
- **PRO purchase audit M1:** `docs/monetization/pro-purchase-consolidation-audit-m1.md`
- **Memory hard rules:** `feedback_ux_pattern_references` (Clash Royale, Duolingo, Wordle, Twitch bits)
- **Red-team de plan técnico previo:** `docs/specs/2026-06-05-exercise-catalog-refactor-redteam.md`
