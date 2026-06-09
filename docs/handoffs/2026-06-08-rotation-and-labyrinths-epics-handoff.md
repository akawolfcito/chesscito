# Handoff — Rotation + Labyrinths Spec + Epics (2026-06-08)

**Sesión cerrada en:** PM John entregó spec + epics; awaiting founder decisión sobre 4 puntos antes de bajar a issues / arrancar content authoring.

**Trigger de resume:** cuando el usuario diga **"continuemos"** en la próxima sesión.

---

## 1. Estado al cierre

- **Branch:** `main` (clean)
- **Origin/production:** `ab89628b` (Sprint 5 close — sin cambios en esta sesión)
- **Origin/main:** `920b919d` (Sprint 6 commit C — sin cambios desde push anterior)
- **Cero código tocado** en esta sesión de planificación. Solo docs + memoria.

---

## 2. Artefactos creados en esta sesión

| Archivo | Propósito |
|---|---|
| `docs/product/chesscito-rotation-and-labyrinths-2026-06-08.md` | Spec PM v0.1 — postura híbrida tier + daily rotation, 3 lab/pieza, guest canonical→prompt→session, KPIs, M1 wiring. ~55 líneas. |
| `docs/product/chesscito-rotation-and-labyrinths-epics-2026-06-08.md` | Backlog accionable. 7 epics, 40+ stories en tabla, prioridades P0..P3, dependencias críticas, 4 decisiones pendientes. |
| `memory/feedback_prelaunch_mode.md` | HARD RULE pre-launch: Production = stable personal/MiniPay snapshot. Avanzar directo. |
| `memory/MEMORY.md` (índice) | Entrada agregada para `prelaunch-mode`. |

---

## 3. Resumen de la postura (para reentrada rápida)

- **Rotación:** Hybrid (b)+(c) = progresión por tier Duolingo + rotación diaria DENTRO del tier desbloqueado.
- **Pool:** 15 ejercicios por pieza (5 E / 5 M / 5 H); visible 5/día con seed `(wallet|session, fecha, pieza)`.
- **10★:** suma de estrellas únicas across pool. Contract intacto, trayectoria dinámica.
- **Tiers:** Easy día 1, Medium @ 5★, Hard @ 9★ por pieza.
- **Laberintos:** 3 mínimo/pieza (E/M/H). King +2, Bishop +1, Knight conserva 5. Daily Labyrinth global gratis + 2do Daily Lab PRO.
- **Guest:** canonical 5 → wallet prompt → `session_uuid` fallback.
- **MVP contenido:** 90 ejercicios + 18 laberintos.
- **Hard gate:** no refactor técnico hasta contenido ≥50%.

---

## 4. Decisiones de producto pendientes

Cuatro decisiones bloqueando el avance a backlog GitHub / content authoring:

1. ¿Arrancar refactor técnico con 10/15 ejercicios por pieza (Hard pending) o esperar 15/15?
2. ¿PRO desbloquea tier 1 día antes que free? (FOMO controlado vs gating educativo)
3. ¿OK el guest model canonical 5 → prompt → `session_uuid`?
4. ¿10★ across pool de 15 vs path canónico de 5? (PM recomienda **across pool**)

---

## 5. Próximos pasos cuando el usuario diga "continuemos"

**Opción A — resolver decisiones pendientes (recomendado):**
- Responder las 4 decisiones de §4.
- Si las 4 quedan resueltas, John actualiza el spec + epics en su lugar (no rehacer docs).

**Opción B — bajar epics a GitHub Issues:**
- Crear milestone "Rotation + Labyrinths v0.1".
- Issues por story P0 primero (CA-1, CA-4, CA-5, LC-1, LC-2, LC-5).
- Labels: `epic:content`, `epic:labyrinth`, `epic:rotation`, `priority:P0/P1/P2/P3`.

**Opción C — arrancar content authoring CA-1:**
- Sesión de content authoring con tier classification schema.
- Definir formato canónico para nuevos ejercicios (FEN inicial, optimalMoves, tier, tags).
- Producir primeros 10 ejercicios candidatos por pieza con BFS verifier.

**Opción D — polish slice de Sprint 6:**
- Continuar Sprint 6 visual polish per calibration matrix.
- Candidatos siguientes: Coach result modal, Result overlay 4 variants, Luz onboarding, Badge earned, Peones chip micro-animations.
- Sprint 5 §7.5 autoReset gap ya CERRADO en commit `920b919d`.

---

## 6. Constraints heredadas (no cambian)

- **No tocar:** contratos, 10★ threshold, 3★/ejercicio, on-chain Arena, badge claim per piece, Coach, PRO resolver, Daily/Training earn, payment rails, paid PeonesRetryButton infra.
- **Mobile-first 390px MiniPay.**
- **EN+ES sync obligatorio** en cualquier copy nuevo.
- **No MiniPay listing claims** hasta aprobación (Stage 2 packet ya enviado, en revisión).
- **Pre-launch mode activo:** Production = stable personal, no usuarios reales hasta que Wolfcito confirme.

---

## 7. Reglas operativas relevantes (HARD RULES vigentes)

- `prelaunch-mode` (nueva esta sesión): avanzar directo, no sobre-dilatar por miedo a usuarios.
- `terse-action-bias`: ejecutar plan aprobado sin re-deliberar.
- `bundle-dont-defer`: tasks adyacentes 4-8h al cluster actual.
- `version-pins`, `no-secrets`, `vr-baseline-discipline`: intactas, duras.

---

## 8. Open questions (no bloqueantes)

- Telemetry events de rotation: ¿extender `monetization.*` namespace o crear nuevo `rotation.*`?
- BFS verifier: ¿existe ya en repo o hay que crearlo en epic CA-4?
- Daily Labyrinth surface: ¿hub chip nuevo o tab en `/hub` existente?
- `eligibleForDailyLab` metadata: ¿default true para todos los laberintos legados o opt-in?

Estas se resuelven en su epic correspondiente, no bloquean el arranque.

---

## 9. Comando de re-entrada sugerido

Cuando el usuario diga "continuemos", el siguiente turno debería:

1. Leer este handoff.
2. Leer `docs/product/chesscito-rotation-and-labyrinths-2026-06-08.md` (spec).
3. Leer `docs/product/chesscito-rotation-and-labyrinths-epics-2026-06-08.md` (epics).
4. Preguntar al usuario por las 4 decisiones de §4 (o por cuál opción A/B/C/D de §5 elige).
5. Operar en pre-launch mode (sin sobre-dilatar).
