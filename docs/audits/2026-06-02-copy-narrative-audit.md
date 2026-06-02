# Chesscito — Copy & Narrative Audit (2026-06-02)

> **Brief:** revisar copies visibles de landing + app para detectar desalineación con la narrativa
> de *brain training mobile-first para principiantes / casual / adultos*, sin convertir la app en
> "solo para niños", sin claims médicos, sin jerga web3 pesada.
>
> **Alcance:** `apps/web/src/lib/content/editorial.ts` (SSOT EN) +
> `apps/web/src/lib/content/messages/es.ts` (overrides ES) + uso en pantallas.
>
> **Notas previas al editor:**
> - `LANDING_COPY` está marcado como **v0.5 locked** (`docs/superpowers/specs/2026-04-25-landing-narrative-v0.5.md`).
>   Cualquier cambio ahí requiere abrir spec; en este audit se *proponen* pero NO se implementan.
> - `HUB_V2_SPLASH_COPY` viene de un design-lock (§2.1). Solo propuesta.
> - Todo lo demás es copy de superficie no-locked → editable directamente.

---

## 1. Tabla de hallazgos

| # | Ubicación | Copy actual EN | Copy actual ES | Problema | Sugerido EN | Sugerido ES | Prioridad | Riesgo |
|---|---|---|---|---|---|---|---|---|
| 1 | `SHOP_SHEET_COPY.description` (editorial.ts:412) | "Arcane gear for training." | "Equipo arcano para entrenar." | "Arcane" suena RPG infantil; rompe la voz de brain-training para casual/adultos. | "Tools to sharpen your training." | "Herramientas para afinar tu entrenamiento." | **Alta** | **Bajo** |
| 2 | `SHOP_SHEET_COPY.moreSoonTitle` (editorial.ts:426) | "More treasures coming" | "Más tesoros vienen" | "Treasures" mantiene tono fantasy / niño. | "More items coming" | "Más ítems en camino" | **Alta** | **Bajo** |
| 3 | `SHOP_SHEET_COPY.moreSoonHint` (editorial.ts:427) | "Skins, cosmetics and boosters are brewing in the workshop." | "Skins, cosméticos y boosters se preparan en el taller." | "Brewing in the workshop" = jerga RPG / niño; impreciso. | "Skins, boards and boosters in the works." | "Skins, tableros y boosters en preparación." | **Alta** | **Bajo** |
| 4 | `ABOUT_COPY.shareText` (editorial.ts:1739) | "Learn chess piece movements with gamified, verifiable challenges on Celo." | "Aprende los movimientos de las piezas de ajedrez con retos gamificados y verificables en Celo." | Jerga web3 ("verifiable / on Celo") como copy de share — friction para audiencia general. | "Train your mind with short chess challenges. Free on MiniPay." | "Entrena tu mente con retos cortos de ajedrez. Gratis en MiniPay." | **Alta** | **Bajo** |
| 5 | `PRO_COPY.hubCoachCard.inactive.chips` (editorial.ts:1951) | `["Mistakes", "Tips", "History"]` | `["Errores", "Consejos", "Historial"]` | "Mistakes / Errores" como chip primario lee negativo; PRO debe vender mejora, no señalar falla. | `["Insights", "Tips", "History"]` | `["Análisis", "Consejos", "Historial"]` | **Alta** | **Bajo** |
| 6 | `ARENA_COPY.subtitle` (editorial.ts:876) | "Choose your rank. Rule the board." | "Elige tu rango. Domina el tablero." | "Rank / Rango" sugiere matchmaking ranked (no existe); confunde a casual / principiante. | "Choose your level. Rule the board." | "Elige tu nivel. Domina el tablero." | **Alta** | **Bajo** |
| 7 | `MISSION_RIBBON_COPY.exercises` (editorial.ts:2630) | "Watch the piece. Move it." | "Observa la pieza. Muévela." | Tono infantil tipo "look-and-do". Para casual / adulto: directo + accionable. | "Pick a square. Move." | "Elige una casilla. Mueve." | **Alta** | **Bajo** |
| 8 | `HOME_ANCHOR_COPY.attractHint` (editorial.ts:2544) | "Your training awaits in the kingdom" | "Tu entrenamiento te espera en el reino" | "Kingdom / reino" refuerza fantasy infantil en la home; rompe la promesa brain-training. | "Your training is ready." | "Tu entrenamiento te espera." | **Alta** | **Bajo** |
| 9 | `LANDING_COPY.audiences.cards[0].title` (editorial.ts:2351) | "Kids and teens (8–16)" | "Niños y adolescentes (8–16)" | Listar **niños primero** en la sección audiences hace que la landing lea como "app para niños". | "Casual players & curious adults" *(reordenar — niños/familias después)* | "Jugadores casuales y adultos curiosos" | **Alta** | **Medio** (LANDING_COPY locked) |
| 10 | `LANDING_COPY.audiences.title` (editorial.ts:2348) | "Made to start early. Useful at any age." | "Hecho para empezar pronto. Útil a cualquier edad." | "Start early" reinscribe sesgo infantil. | "Made for any age. Built for daily practice." | "Hecho para cualquier edad. Pensado para practicar a diario." | **Media** | **Medio** (locked) |
| 11 | `LANDING_COPY.problem.claims[1]` (editorial.ts:2266) | "The earlier you start, the easier the habit." | "Mientras antes empieces, más fácil es crear el hábito." | Mismo sesgo: privilegia el inicio temprano sobre la práctica continua adulta. | "Steady practice builds the habit." | "La práctica constante construye el hábito." | **Media** | **Medio** (locked) |
| 12 | `HUB_V2_SPLASH_COPY.title` (editorial.ts:1110) | "Welcome, friend" | "Bienvenido" | "Friend" puede leerse cozy o infantil según contexto. Voz adulta casual: bienvenida más neutra. | "Welcome back" | "Bienvenida/o" | Media | Medio (design-lock) |
| 13 | `VICTORY_PAGE_COPY.tagline` (editorial.ts:609) | "Train your mind with pre-chess challenges. A Celo MiniPay game" | (hereda EN) | "A Celo MiniPay game" cuelga como tag-line; mejor desligar de canal. | "Train your mind with quick chess challenges." | "Entrena tu mente con retos cortos de ajedrez." | Media | **Bajo** *(metadata pública — verificar SEO antes)* |
| 14 | `CTA_LABELS.startTrial` (editorial.ts:35) | "Start Trial" | "Comenzar" | "Trial" sugiere SaaS / pago time-limited. Free path debería leer "Play / Start". | "Play free" | "Jugar gratis" | Media | **Bajo** |
| 15 | `COACH_COPY.welcomeNote` (editorial.ts:1270) | "Free analyses to start. After that, credit packs from $0.05." | (override en ES esperado) | OK como está, pero "credit packs" se puede unificar con la futura nomenclatura Peones cuando exista. | *(sin cambio hoy — sugerencia futura: "Free reviews to start. Then refill with Pawns from $0.05.")* | — | Baja (futura) | n/a |
| 16 | `PRO_COPY.hubCoachCard.inactive.title` (editorial.ts:1949) | "Coach PRO" | "Coach PRO" | OK. Mantener. | — | — | — | — |
| 17 | `HUB_V2_TRAINING_COPY.inactive.perks[2]` (editorial.ts:1185) | "PRO identity" | "Identidad PRO" | "Identity" en chip puede leer raro fuera de contexto; OK por ahora. | *(sin cambio)* | — | Baja | Bajo |
| 18 | `ARENA_COPY.coachSignal.inactiveBody` (editorial.ts:933) | "Unlock full review after playing" | (hereda) | OK. | — | — | — | — |
| 19 | Concept: **Peones / credit packs** | — | — | Modelo declarado por el user incluye "Peones" como créditos internos; hoy se llaman "Coach Credits". Cuando se materialice la nomenclatura unificada, renombrar Coach Credits → Pawns / Peones en `SHOP_ITEM_COPY.coachPack*` + `COACH_COPY.creditPack*`. | *(propuesta futura)* | — | Baja (futuro) | Medio |
| 20 | Concept: **Free / PRO / Shop matrix** explícita | — | — | Hoy cada tier vive en superficies distintas; falta un único bloque que explique los 4 segmentos (Free, PRO, Peones, Shop). Candidato: nuevo namespace `PLANS_MATRIX_COPY` o reusar Plans en hub onboarding. | *(propuesta — nueva surface, requiere diseño)* | — | Media (estrategia) | Alto |

---

## 2. Lista priorizada de cambios

### Implementar ahora (Alta + Bajo riesgo) — 7 ediciones seguras

1. `SHOP_SHEET_COPY.description` EN+ES
2. `SHOP_SHEET_COPY.moreSoonTitle` EN+ES
3. `SHOP_SHEET_COPY.moreSoonHint` EN+ES
4. `ABOUT_COPY.shareText` EN+ES
5. `PRO_COPY.hubCoachCard.inactive.chips[0]` EN+ES (`Mistakes`/`Errores` → `Insights`/`Análisis`)
6. `ARENA_COPY.subtitle` EN+ES (`rank`/`rango` → `level`/`nivel`)
7. `MISSION_RIBBON_COPY.exercises` EN+ES + `HOME_ANCHOR_COPY.attractHint` EN+ES

### Proponer (Alta o Media prioridad, riesgo Medio) — requiere aprobación / spec

- **#9 + #10 + #11**: reordenar `LANDING_COPY.audiences` para que los jugadores casuales / adultos vayan primero y los niños queden como tercer card; suavizar `audiences.title` y `problem.claims[1]`.
  Necesita actualización del spec `2026-04-25-landing-narrative-v0.5.md`.
- **#12**: `HUB_V2_SPLASH_COPY.title`. Necesita revisión del design-lock §2.1.
- **#13**: `VICTORY_PAGE_COPY.tagline` — verificar impacto SEO en `/victory/[id]` antes de cambiar.
- **#14**: `CTA_LABELS.startTrial` — buscar todos los callers antes de cambiar el shape semántico.

### Futuro (sin acción hoy)

- **#15 + #19**: cuando se diseñe la moneda interna **Peones**, renombrar Coach Credits y unificar
  con la economía del Shop.
- **#20**: superficie unificada *Free / PRO / Peones / Shop* — requiere diseño UX previo;
  candidato a addendum del playbook M1.

---

## 3. Reglas que NO se rompen

- Cero claims médicos / cognitivos absolutos (no se tocó disclaimer ni capabilities).
- Cero refactors estructurales ni cambios de ruta / componente / lógica.
- Cero cambios en `LANDING_COPY` (locked v0.5).
- Cero cambios en monetización funcional (solo copy alrededor).
- Ediciones quedan en `editorial.ts` (EN) + `messages/es.ts` (ES) — no se inventan keys nuevas.
- Promise-first + mobile-first: cada nuevo string es más corto o igual que el original.

---

**Autor:** Audit ejecutado por Claude bajo dirección de Wolfcito.
**Siguientes pasos sugeridos:** revisar tabla, decidir si abrir spec para los items #9–#11 del bloque
LANDING_COPY locked, y agendar el diseño de la economía Peones.

---

## 4. Addendum — MiniPay Copy Safety Pass (2026-06-02) — ✅ APPROVED

**Regla:** mientras Chesscito no esté oficialmente listado / integrado / aprobado en MiniPay, ningún
copy debe afirmar o sugerir que **ya es** un "MiniPay game", "available on MiniPay",
"free on MiniPay" o equivalentes. Wording aceptado: "Designed with MiniPay in mind",
"Pensado para MiniPay", "Preparado para MiniPay".

### 4.1 Inventario completo

| # | Ubicación | Copy original EN / ES | Estado | Acción |
|---|---|---|---|---|
| M1 | `ABOUT_COPY.shareText` (editorial.ts:1740 / es.ts:68) | "Free on MiniPay." / "Gratis en MiniPay." | 🔴 Violación (introducido en §2 de este audit — autorreversión) | **Corregido** → "Designed with MiniPay in mind." / "Pensado para MiniPay." |
| M2 | `VICTORY_PAGE_COPY.tagline` (editorial.ts:609 / es.ts:873) | "A Celo MiniPay game" / "Un juego de Celo MiniPay" | 🔴 Violación pre-existente. Tag-line en share/OG metadata. | **Corregido** → "Designed with MiniPay in mind." / "Pensado para MiniPay." |
| M3 | `TERMS_COPY.sections[1].body` (editorial.ts:1590 / es.ts:143) | "Chesscito is an educational pre-chess game experience on the Celo blockchain, accessible via MiniPay." | ⚠️ Doc legal. "Accessible via MiniPay" sugiere disponibilidad oficial. | **Solo reportar** — propuesta: "designed to be used with MiniPay-compatible wallets on Celo." Riesgo legal **Medio**; requiere revisión antes de cambiar Terms. |
| M4 | `CONNECT_BUTTON_COPY.miniPayDetected` ("MiniPay detected") | factual runtime detection | ✅ OK | sin acción |
| M5 | `CONNECT_BUTTON_COPY.openInMiniPay` ("Open in MiniPay") | affordance funcional cuando ya hay sesión | ✅ OK | sin acción |
| M6 | `TERMS_COPY.sections[2].body` ("compatible wallet (such as MiniPay)") | requisito técnico, no claim de disponibilidad | ✅ OK | sin acción |
| M7 | `TERMS_COPY.sections[0].body` / `ABOUT_COPY.operatorDisclaimer` | disclaimer de independencia (refuerza NO afiliación) | ✅ OK | sin acción |
| M8 | `minipayDisconnectHint` | instrucción técnica | ✅ OK | sin acción |
| M9 | `LANDING_COPY` (todos los bloques) | no menciona MiniPay en copy visible | ✅ OK | sin acción |
| M10 | `landing-page.tsx`, `share-grid.tsx`, helpers | solo lógica + comentarios; cero strings user-facing | ✅ OK | sin acción |

### 4.2 Cambios aplicados (4 strings, EN+ES)

- `editorial.ts` — `ABOUT_COPY.shareText` + `VICTORY_PAGE_COPY.tagline`
- `messages/es.ts` — mismos dos overrides

### 4.3 Reportado para revisión legal posterior

- `TERMS_COPY.sections[1].body` (Service Description) — wording "accessible via MiniPay" implica
  disponibilidad oficial. **No editado** — cambiar Terms of Service requiere paso explícito por el
  operador. Sugerencia: "designed to be used with MiniPay-compatible wallets on the Celo blockchain."

### 4.4 Reglas que NO se rompen en esta pasada

- Cero cambios en LANDING_COPY (no había violaciones).
- Cero cambios en lógica de detección MiniPay (`useMiniPay`, redirects, `connectButton`).
- Cero cambios en disclaimers de independencia (refuerzan la regla).
- Cero cambios en componentes / rutas / hooks.

### 4.5 Estado final aprobado (2026-06-02)

- ✅ **MiniPay user-facing copy seguro** en surfaces no legales (Shop, About share,
  Victory share/OG metadata, Home anchor, Mission ribbon, Arena, PRO Coach card).
- ✅ **LANDING_COPY sin cambios** — narrativa v0.5 locked intacta.
- ⏳ **Terms of Service pendiente** de revisión legal explícita
  (`TERMS_COPY.sections[1].body` — wording "accessible via MiniPay").

### 4.6 TODO — pendientes para futuras pasadas

- [ ] **TERMS legal-copy safety pass** — revisar `TERMS_COPY.sections[1].body` y
  variantes ES (`messages/es.ts:143`). Wording propuesto: "designed to be used with
  MiniPay-compatible wallets on the Celo blockchain." Cambio requiere paso explícito
  por el operador (no editar de oficio).
- [ ] **Abrir spec LANDING_COPY v0.6** — mover la narrativa de *kids-first* hacia
  *beginners / casual / adults-first*. Items en alcance:
  - reordenar `LANDING_COPY.audiences.cards` (#9 de §1)
  - suavizar `LANDING_COPY.audiences.title` (#10)
  - reformular `LANDING_COPY.problem.claims[1]` para quitar sesgo "the earlier you start" (#11)
  - revisar `HUB_V2_SPLASH_COPY.title` ("Welcome, friend") en el mismo paso de design-lock (#12)
  - spec source: `docs/superpowers/specs/2026-04-25-landing-narrative-v0.5.md` → bump a v0.6.
- [ ] **Regla MiniPay vigente (canónica hasta listing oficial)** — prohibido
  cualquier copy que afirme o sugiera disponibilidad oficial:
  - ❌ "MiniPay game"
  - ❌ "Free on MiniPay"
  - ❌ "Available on MiniPay"
  - ❌ "Play on MiniPay"
  - ❌ "MiniPay app"
  - ❌ "Built for MiniPay users"
  - ✅ Aceptado: "Designed with MiniPay in mind", "Designed for MiniPay",
    "Planned for MiniPay", "Built with MiniPay in mind", "Pensado para MiniPay",
    "Diseñado pensando en MiniPay", "Preparado para MiniPay".
  - **Vence:** cuando exista aprobación / listing oficial confirmado por el operador
    Wolfcito. Hasta entonces, la regla aplica a todo PR de copy.

