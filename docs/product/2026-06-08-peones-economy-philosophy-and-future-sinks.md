# Chesscito — Peones economy philosophy + future sinks

**Owner**: John (PM) · **Founder note**: Wolfcito · **Date**: 2026-06-08
**Status**: Strategic note. NO code action. NO sprint open. Recorded during Sprint 5 Retry smoke.

> **TL;DR**: La economía se siente abundante. NO vamos a meter sinks a la fuerza. Primero cerramos Sprint 5, después polish visual de superficies existentes, y solo entonces calibramos UN sink chico (probablemente Deep Hint o Theme unlock).

## 1. Estado actual de la economía (snapshot post Sprint 5)

| Acción | Peones |
|---|---|
| Daily Tactic (cap 10/UTC-day daily-family) | **+3** |
| Training exercise fresh (0→3★ delta) | **+3** |
| Training exercise 0→2★ | +2 |
| Training exercise 0→1★ | +1 |
| Welcome pack (1× ever) | +1 |
| Hint | **−1** |
| Retry | **−2** |
| Coach Peones path | **−1** |
| Save game (Sprint deferred) | −1 |

**Observación smoke 2026-06-08**: un usuario activo puede recuperar fácilmente lo gastado en una sola sesión. Daily +3 + Training fresh +3 = +6 floor; Hint+Retry = −3. Net positivo de +3 sin esfuerzo.

**Verdad incómoda**: Peones se sienten como número en HUD, no como recurso. Sin scarcity, el PRO pitch se debilita, el welcome pack no genera "wow tengo plata", y los players no aprenden a valorar el spend.

## 2. Principio rector (founder directive)

- **NO resolver la abundancia agregando muchas features rápido.**
- **Priorizar polish visual y estabilidad de flujos existentes** sobre features económicas nuevas.
- **Un sink bien diseñado vale más que cinco sinks improvisados.**
- **NO subir costos de Hint/Retry en caliente.** Eso se siente como tax al aprendizaje, anti-pattern en casual games.
- **Primero observar UX**, después diseñar sinks con intención.

## 3. Sinks futuros posibles (idea bank, NO roadmap)

Ranked por fit pedagógico + scope, sin compromiso de orden:

| Sink | Costo tentativo | Fit | Notas |
|---|---|---|---|
| **Deep Hint** (ruta óptima completa, no solo first move) | 3 Peones | alto pedagógico | Premium tier del Hint actual |
| **Theme / cosmetic packs** (board, piezas, Wolfcito avatar, fondos) | 50-100 Peones | bajo pedagógico, alto vanity | Theme system foundation ya existe (dormant) |
| **Streak Shield Peones-paid** (insurance contra missing un día) | 5 Peones | alto psicológico (loss aversion) | Shield mechanic ya existe; variante pagada nueva |
| **Daily Tactic reroll** (puzzle de hoy muy duro? cambialo) | 3 Peones | medio (mood match) | Retention-positive |
| **Coach deep dive** (longer LLM analysis tier) | 3 Peones | alto pedagógico | Requiere prompt + UI nueva |
| **Undo Move** (revertir UNA jugada) | 3-5 Peones | alto, pero advanced | Ver §4 — NO mezclar con Retry |

## 4. Undo Move — categoría separada

**No es Retry.** Tratar como producto distinto:
- **Retry** reinicia el intento completo: piece a startPos, moves=0, fresh attemptSeq. Ya shipped Sprint 5.
- **Undo Move** revierte UNA jugada específica. Requiere historial confiable de board state previo: posición, moves count, selectedPosition, capturas, stars, timer si aplica.
- Costo tentativo: 3-5 Peones (más caro que Hint, más barato que Retry para limitar abuse).
- Scope: advanced consumable, NO Sprint 5/6 inmediato.
- Implementación requiere: stack de board snapshots, UI con botón Undo durante intento activo, telemetry diferenciada (`peones_spent target=undo_move`).
- Reservar `target: "undo_move"` en `PeonesLedgerSource` ENUM cuando llegue su turno (no preempt).

**Mezclar Undo con Retry es el error a evitar.** Retry vende "fresh start"; Undo vende "I made one bad move, let me fix that". Producto distinto.

## 5. Ideas sociales futuras (post-MVP estable)

Tier muy lejano, mencionado para tracking:

- **P2P matches** (player vs player) — actualmente toda partida es vs CPU
- **Visor / spectator mode** (ver partidas en curso, propio o de otros)
- **Regalar/tippear Peones** a otro jugador
- **Monetización para jugadores** si algún día hay volumen real (torneos, creadores, visualizaciones)
- **Founder ranking / leaderboard social** beyond el actual leaderboard

**Pre-requisitos**:
- Volumen real de usuarios (post-MiniPay official listing)
- SIWC (Sign-In With Celo) o equivalente para identidad estable
- Anti-abuse mechanics (rate limits, sybil resistance, tip limits/day)
- Reglas claras de moderación y tos

**NO arrancar hasta que volumen y producto base estén estables.** Calibration §1: producción es staging personal hoy; estos features no aplican.

## 6. Orden recomendado

1. **Cerrar smoke Sprint 5 Retry** (en curso).
2. **Promote `main → production`** si smoke verde.
3. **Polish visual cluster** — superficies existentes que necesitan rediseño candy/visual-first:
   - Coach modal (panel forest-green pre-Sprint 4)
   - "Coach is thinking…" loading modal
   - Luz onboarding modal
   - Result overlay (variants badge / score / shop / error)
   - Peones chips (HUD + floating)
   - Failure / retry visual feedback (PhaseFlash)
4. **Después de polish**: calibrar UN sink chico, probablemente Deep Hint o Theme unlock. UN sink, no cinco.
5. **Mucho después**: P2P, visor, tipping (visión futura).

## 7. Regla operativa (NO romper)

- Peones deben sentirse útiles, **pero no vamos a forzar scarcity artificial todavía**.
- NO subir costos Hint/Retry/Coach en caliente.
- Primero observar UX vivido + mejorar claridad visual.
- Después diseñar sinks con intención, sprint dedicado.
- Si esta nota se invoca para "deberíamos agregar X sink ya" sin haber polish visual + UN sink calibrado — la respuesta es NO. La nota es un freno deliberado contra feature-creep económico.

## 8. Cuándo revisar esta nota

- Después de promover Sprint 5 → reabrir para decidir polish cluster.
- Cuando volumen real exista (post-MiniPay listing) → reabrir sección §5 social.
- Cuando founder reporte explícitamente "Peones se sienten irrelevantes en MI uso" → reabrir §3 sinks.
- En cualquier otro caso, la regla §7 manda: no agregar sinks impulsivos.
