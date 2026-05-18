# PRO Tier — Auditoría de estado y roadmap defendible

**Fecha**: 2026-05-18
**Alcance**: solo inventario + roadmap conceptual. **No implementa nada.**
**Objetivo**: entender qué hace hoy PRO, qué NO hace (y por qué el usuario sigue pagando tx), y armar un roadmap creíble para defender "PRO unlocks deeper training" más allá de "una API call ilimitada".

---

## 1. Estado actual de PRO (hoy, 2026-05-18)

### 1.1 Qué desbloquea (Etapas 1 + 2 + 3 ya shipped)

**Único surface gated por PRO = Coach LLM.** Toda la lógica vive en `app/api/coach/analyze/route.ts`.

| Perk activa | Mecanismo | Para el usuario |
|---|---|---|
| Coach sin límite diario | `isProActive(wallet)` salta el decrement de credits | No ve paywall; análisis ilimitados en 30d |
| Coach con memoria de partidas | Backfill Redis→Supabase + `aggregateHistory()` | Cada análisis menciona patrones recurrentes ("vuelves a colgar piezas en el medio juego") |
| Estilo del Coach Preview Card | Prop `proActive` → clase `.is-active` + CTA "JOURNAL" | UX premium en `/arena` |
| Paywall oculto | `shouldShowPaywall({ proActive, credits })` | No se le pide comprar credit packs |
| Historial borrable | `/coach/history` + DELETE endpoint | Auto-servicio sobre sus datos (compliance + confianza) |

**`PRO_COPY.perksRoadmap` (prometido, no live)**:
- Early access to new challenges
- Premium achievements
- Guided by FIDE Master + dev team

### 1.2 Qué NO desbloquea (sigues pagando tx aunque tengas PRO)

Esto es lo que percibiste y es real. **PRO solo bypassa el Coach.** Todas las tx on-chain siguen costando:

| Acción | Costo | PRO bypassa? |
|---|---|---|
| Founder Badge (itemId 1/5) | $0.01 | ❌ No |
| Retry Shield (itemId 2) | precio admin-set | ❌ No |
| Coach credit packs (itemId 3/4) | $0.05 / $0.10 | N/A (PRO ya no los necesita, pero podría comprarlos) |
| Victory NFT Easy | $0.005 | ❌ No |
| Victory NFT Medium | $0.010 | ❌ No |
| Victory NFT Hard | $0.020 | ❌ No |
| Level-up badges | gratis (claim) | N/A |

**Implicación de negocio**: para un usuario PRO regular (juega arena diario + mintea victorias), el gasto mensual es $1.99 PRO + ~$0.30–$1.00 en mints, sin ningún descuento. Esto es lo que se siente como "PRO no cambió nada material salvo el análisis".

### 1.3 Infraestructura existente reusable

- **Daily Tactic ya existe** (`lib/daily/daily-puzzles.ts`): 14 puzzles deterministas con rotación diaria + streak counter. Hoy son gratis para todos, sin gating PRO.
- **Theme system** (`lib/theme.ts`): `default` | `candy`, pero hard-coded por `NEXT_PUBLIC_ASSET_THEME`. No hay selector runtime ni catálogo de skins.
- **Patrón de bypass del Coach** (`analyze/route.ts:85` + `:137`): capture-once + console.info `[pro-bypass]`. **Es el template a reutilizar para cualquier perk PRO server-side futuro.**

### 1.4 Gaps identificados

- **Cero infra de endgame drills** (K+R vs K, K+Q vs K, K+P vs K, opposition, etc.). No existe ni una carpeta `endgame/` ni puzzles de mate forzado.
- **Cero infra de cosmetics on-chain o user-selectable** (board skins, piece skins, board themes intercambiables en runtime).
- **Daily Tactic tiene solo 14 puzzles fijos** y rota deterministamente — pool finito, repite rápido.

---

## 2. Por qué hoy PRO "se siente flaco" (diagnóstico honesto)

1. **PRO = 1 perk real (Coach ilimitado + memoria)**. Las otras dos líneas de `perksActive` son atribución/marketing ("tu contribución mantiene gratis a otros"), no valor adicional para el usuario.
2. **Roadmap prometido es vago**: "early access", "premium achievements", "guided by FIDE Master" — sin nada concreto que el usuario pueda anticipar.
3. **El precio mental ancla en "tx que sigo pagando"**: el usuario percibe el gasto total mensual, no solo los $1.99. Falta o (a) descuentos en tx, o (b) más cosas exclusivas que no requieran tx adicional.

---

## 3. Roadmap defendible — "PRO unlocks deeper training"

Cuatro vetas. Todas comparten una propiedad: **el costo marginal por usuario PRO es ~$0 o un LLM call**, lo cual hace sostenible incluirlas en los $1.99.

### Veta A — Coach más profundo (extiende lo ya construido)

Reutiliza el patrón `analyze/route.ts`. Cero infra nueva on-chain. Cada item es un endpoint con `isProActive()` gate al inicio.

| Item | Endpoint nuevo | Valor para el usuario |
|---|---|---|
| **Opening repertoire personal** | `/api/coach/openings` | "Juegas Caro-Kann en 40% de tus partidas con peor winrate que Italian; aquí 3 líneas recomendadas." |
| **Weekly progress report** | cron + Supabase aggregate | Email/in-app: "esta semana mejoraste en endgame, retrocediste en king safety" |
| **Position analysis on demand** | `/api/coach/position` (FEN input) | Pegar FEN y pedir explicación; free tier solo Coach post-match |
| **Compare to similar players** | aggregate query | "Jugadores de tu rating fallan menos en mate-in-2 — practica este drill" |
| **Mistake replay drills** | reconstruir posición + drill | Generar puzzle desde tu propio error de ayer |

**Defensa**: cada uno es un LLM call gated. Marginal cost = 1 OpenRouter call (~$0.001–$0.01). PRO mensual cubre 200–2000 análisis.

### Veta B — Endgame training (infra nueva — el K+R vs K que mencionas)

Crear `lib/endgame/` con drills paramétricos. **Esto sí es infra nueva**, no solo LLM gating.

| Drill | Estado | Acceso |
|---|---|---|
| K+R vs K (mate del molinete) | nuevo | Free: tutorial 1; PRO: 10 variantes + tracking de tiempo |
| K+Q vs K | nuevo | Free: tutorial 1; PRO: 10 variantes |
| K+2B vs K | nuevo | PRO only |
| K+B+N vs K (mate del rincón) | nuevo | PRO only — el famoso "imposible para humanos" |
| K+P vs K (oposición, regla del cuadrado) | nuevo | Free: 3 posiciones clásicas; PRO: 20+ posiciones |
| Lucena, Philidor (R+P endings) | nuevo | PRO only |
| Mate-in-N puzzles | nuevo | Free: M1; PRO: M2, M3, M4 |

**Patrón de gating**: misma estructura que Daily Tactic + flag PRO en el ejercicio. Reusa `getDailyTactic()` para "endgame del día".

**Defensa**: cada drill es contenido curado, no LLM. El argumento "PRO te enseña los mates teóricos que todo jugador necesita" es muy fácil de vender visualmente con un grid de 7 técnicas.

### Veta C — Daily/weekly tactics expansion

Hoy 14 puzzles deterministas. Convertir en:

- **Pool grande gratis** (~50–100 puzzles base, rotación de 30 días).
- **PRO daily**: pool extra de 200+ puzzles, dificultad escalable según historial Coach.
- **PRO weekly themed challenge**: lunes pins, martes forks, miércoles deflexiones, etc. (7 días, 7 motivos tácticos).
- **Streak rewards exclusivas para PRO** (achievements derivables, sin costo on-chain).

**Defensa**: cuanto más juegas, más valor te da. Justifica renovación a los 30 días.

### Veta D — Cosmetics + consumables (la veta "shop")

Esta es la veta que requiere más infra pero también la más vendible visualmente.

**4.1 Board / Piece skins**

- Convertir `theme.ts` hardcoded en selector runtime con persistencia en wallet o localStorage.
- Catálogo inicial: 3–5 boards (madera clásica, neón, candy, mármol, pixel), 3–5 piece sets.
- **Modelos posibles**:
  - **Opción A — incluido en PRO**: PRO desbloquea TODOS los skins. Sin tx extra. Más simple, más vendible.
  - **Opción B — micro-mint individual**: cada skin = $0.10–$0.50 NFT (ERC-1155). PRO da 20% descuento. Más revenue pero más fricción.
  - **Opción C — híbrido**: 2 skins gratis, 4 skins PRO-only, 2 skins NFT premium (coleccionables).
- **Recomendación**: empezar con A (PRO unlocks all skins) — alinea con "PRO te da la experiencia completa".

**4.2 Consumables (extender Shop)**

Hoy solo Retry Shield. Posibles:

| Consumible | Uso | Pricing |
|---|---|---|
| Hint Token | Mostrar mejor jugada en tactic/exercise | $0.025 / 5 usos. PRO: 10/mes gratis |
| Undo Move (arena) | Volver una jugada en arena | $0.05 / 3 usos |
| Coach Deep Dive Pack | 1 análisis extra-profundo (think harder) | $0.10 free, gratis para PRO |
| Skin Loot Box | RNG: 1 skin random de pool premium | $0.50 |
| Streak Freeze | Proteger streak un día | $0.05 / 1 uso. PRO: 2/mes gratis |

**Patrón existente**: ShopUpgradeable ya soporta multi-token y multi-item. Solo es agregar itemIds + UI cards.

**4.3 Descuento PRO en VictoryNFT (la queja directa)**

La opción más rápida para que PRO "se sienta": **PRO da 20–30% descuento en cualquier mint VictoryNFT**.

- Implementación: nuevo método `mintSignedDiscounted()` en contrato (requiere upgrade) **O** signing endpoint que aplica precio reducido si verifica PRO active.
- Más simple sin contract upgrade: el `/api/sign-victory` chequea `isProActive()` y firma con el precio descontado; el contrato confía en la firma EIP-712.

**Defensa**: alinea PRO con "premium player" — más juegas, más ahorras. Y resuelve directamente la queja "PRO no me ahorra nada en tx".

---

## 4. Priorización sugerida (más fácil de defender / más visible)

Orden por **ratio (impacto percibido / esfuerzo)**:

1. **Veta D 4.3 — descuento PRO en VictoryNFT** (impacto altísimo en percepción, esfuerzo medio).
2. **Veta D 4.1 opción A — board/piece skins incluidos en PRO** (impacto visual altísimo, esfuerzo medio-alto).
3. **Veta B — endgame drills (K+R, K+Q al menos)** (impacto pedagógico altísimo, esfuerzo alto pero contenido = no tx).
4. **Veta A — opening repertoire personal + weekly report** (impacto altísimo si Coach ya gusta, esfuerzo bajo — solo LLM calls).
5. **Veta C — daily tactics pool ampliado** (impacto medio, esfuerzo medio).
6. **Veta D 4.2 — consumables nuevos** (impacto medio, esfuerzo bajo-medio).

---

## 5. Tagline defendible (para `PRO_COPY`)

Hoy: *"AI Coach: instant analysis, no daily limit"* — flaco.

Propuesto (cuando esté ≥ vetas A + B parcial + D 4.3):

> **PRO unlocks deeper training**:
> Personalized Coach with memory · Endgame mastery drills · Position analysis on demand · 25% off Victory NFTs · All board & piece skins

Cada bullet es defendible y entrega valor distinto: contenido (drills), AI (Coach extendido), ahorro on-chain (mint discount), cosmetic (skins).

---

## 6. Qué NO hacer

- ❌ **No** bypassar Founder Badge o Shop items "antiguos" — eso rompe ledger histórico y narrativa de "compra única coleccionable".
- ❌ **No** prometer en `perksRoadmap` cosas sin ETA realista (lo de "Guided by FIDE Master" hoy es marketing sin compromiso técnico — sacarlo o concretarlo).
- ❌ **No** introducir auto-renewal antes de tener data real de retención (Fase 0 cerró freeze sin medir; necesitas tráfico real primero).
- ❌ **No** convertir cosmetics en NFT obligatorio en v1 — añade fricción de mint a algo que debería ser "instant gratification" para PRO.

---

## 7. Próximos pasos sugeridos (decision points)

Cuando quieras avanzar, decide en este orden:

1. **¿Vamos por descuento PRO en VictoryNFT primero?** (la queja más directa que mencionaste).
2. **¿Endgame drills entran en bundle PRO v2 o como pack pagado aparte?**
3. **¿Skins son PRO-included (Opción A) o catálogo mixto (Opción C)?**
4. **¿Daily tactic se mantiene gratis y PRO suma "weekly themed", o daily se vuelve PRO-extended pool?**

Cada decisión bloquea/desbloquea un spec independiente. Sugiero brainstorm + spec por veta cuando agendes la siguiente.
