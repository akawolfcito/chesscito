# Chesscito — Rotación de Ejercicios + Laberintos (PM Spec v0.1)

**Fecha:** 2026-06-08 · **Author:** John (PM) · **Status:** Approved (founder, 2026-06-08) — las 4 decisiones de §10 quedaron cerradas.
**Constraints:** no toca contratos, 10★, 3★/ejercicio, on-chain Arena, badge per piece. EN+ES sync.

## 1. Postura
**Hybrid: progresión por tier (Duolingo) + rotación diaria DENTRO del tier desbloqueado (crucigrama).** Las dos solas no alcanzan; juntas dan maestría + razón de volver mañana.

## 2. Rotación de ejercicios (Q1)
- Pool por pieza: **15 ejercicios** (5 Easy / 5 Medium / 5 Hard).
- Visible: **5/día**, seed `(wallet|session, fecha, pieza)`.
- Tier desbloquea por estrellas en la pieza: Easy desde día 1, Medium @ 5★, Hard @ 9★. Set diario biaseado hacia menos completados dentro de tiers desbloqueados.
- **10★ = suma de estrellas únicas across pool** (cada ejercicio max 3★ contadas una vez). Contract intacto, trayectoria dinámica.
- Chip "Today" siempre visible; completados muestran ✓/oro.

**Por qué este híbrido:** (a) descartado por fundador. (b) puro Duolingo: terminas el ladder y se acaba. (c) puro daily random: whiplash de dificultad para principiantes. (b)+(c): el set cambia día a día pero dentro de tu nivel.

## 3. Laberintos (Q2)
- **Mínimo viable: 3 laberintos/pieza** (E/M/H). Bishop +1, King +2; Knight conserva 5.
- **Daily Labyrinth global:** uno bonus rotativo del catálogo entero, gratis, todos los días.
- **PRO recurrencia:** PRO ve un SEGUNDO Daily Labyrinth (premium-curated). Copy: "dos laberintos al día".
- Tier difficulty SOLO no basta — necesitamos rotación + variedad.

## 4. Guest experience (Q3)
- **Primera visita:** 5 canónicos curados (mismos para todos). First impression siempre controlado.
- **Post-5:** prompt suave "conecta wallet" → si acepta, seed `(wallet, fecha)`. Si rechaza, `session_uuid` en sessionStorage y rota como wallet.
- Protege el primer-touch sin penalizar al re-visitante.

## 5. KPIs (cohort 30 días)
| Métrica | Target |
|---|---|
| D1 retention | ≥35% |
| D7 retention | ≥18% |
| Wallets con 10★ en ≥1 pieza @ día 14 | ≥25% |
| Avg pieces 10★/wallet activo @ día 30 | ≥1.8 |
| Daily Labyrinth participation (% DAU) | ≥40% |
| PRO conversion lift post-Daily-Lab | +15% baseline |

## 6. Contenido mínimo viable
- **Por pieza:** 15 ejercicios + 3 laberintos.
- **Delta vs hoy:** +60 ejercicios (30→90), +3 laberintos (Bishop +1, King +2). Knight surplus se acepta.
- **No empezar refactor técnico hasta tener ≥50% del contenido escrito.** Refactor sin contenido = deuda andante.

## 7. Conexión M1 (sin romper)
- **PRO (expande, NUNCA adelanta tiers):** la progresión educativa (Medium @ 5★, Hard @ 9★) es idéntica para free y PRO. PRO se diferencia por:
  - Segundo Daily Labyrinth (bonus/Hard premium-curated).
  - Hints/retries incluidos o con bypass.
  - Coach premium.
  - Themes / cosméticos.
  - Historial / records extendidos.
  - Study skip (solo si lo validamos después).
  - **Por qué:** PRO suaviza y expande, no bloquea ni acelera el aprendizaje base. Free no se siente castigado; ética educativa limpia.
- **Peones:** Hint en cualquier ejercicio/laberinto (sin cambios — spend universal).
- **VictoryNFT/Arena:** intacto, funnel separado.
- **Themes (dormido):** futuro "ContentPack temático" (Halloween 2026 candidato) puede debutar puzzles + tema combinados sobre theme foundation. **NO MVP.**

## 8. Out of scope (explícito)
- **Streak diario:** NO en MVP — solo si D1 queda corto en cohort inicial. Es alma del rotativo pero complica UX entrada.
- **Leaderboard social:** post-validación de retention.
- **AI puzzles generativos:** NO. Moat es curación humana, no cantidad infinita.

## 9. Riesgos
- **Content ship lento:** arrancar con 10/15 (Hard pending) + copy honest "Hard coming soon".
- **10★ siente más lento (pool 15 vs 5 visibles):** badge copy = "mastery de la pieza"; clarificar que las estrellas son únicas (no suma de re-intentos).
- **Daily Lab se acaba si catálogo chico:** seed `(wallet, fecha)` permite repeat cada `ceil(catálogo/7)` días.

## 10. Decisiones del fundador (CERRADAS 2026-06-08)

1. **Gate contenido → 10/15.** Arrancar refactor con Easy+Medium completos por pieza; Hard se autoría en paralelo. Copy honest "Hard coming soon".
2. **PRO → mismo ritmo educativo.** PRO NO adelanta tiers; diferencia por 2do Daily Lab, hints/retries, coach premium, themes, historial extendido (ver §7). Tier unlock por mérito (5★/9★) idéntico free/PRO.
3. **Guest → aprobado.** Canónicos 5 en primera visita → prompt suave post-5 → wallet seed `(wallet, fecha)` o `session_uuid` en sessionStorage como fallback. Sin fricción de juego.
4. **10★ → across pool de 15.** Suma de estrellas únicas en todo el pool de la pieza (cada ejercicio max 3★ una vez, reintentos no duplican). Badge contract intacto; cambia solo la trayectoria de maestría. Adoptado ahora en pre-launch antes de tener usuarios con expectativas previas.
