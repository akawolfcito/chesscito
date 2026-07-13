# Handoff — LEARN device pass (CERRADO) + Hub Tour spec (listo para construir)

- **Fecha:** 2026-07-12
- **`main` = `2e0d97cf`.** Suite **5026 passing / 423 files**. `tsc` limpio.
- **Modo:** el device pass cerró. El siguiente cluster está especificado, sin arrancar.

---

## Lo que cerró: el device pass de la máquina de hitos

`docs/testing/2026-07-12-minipay-progression-device-pass.md` — **corrido en device, FIRMADO.**

Encontró **cuatro defectos con 5000+ tests en verde**. El pase valía exactamente por esto:
la cuenta del founder (12★ torre, badge minteado) es la única forma que los expone, y
ninguna suite los veía.

| # | Defecto | Fix |
| --- | --- | --- |
| 1 | **Overlay fantasma "Badge Ready to Claim"** | #220 |
| 2 | CTA de Special Training a un hub sin puerta | #219 |
| 3 | Loop de START FOCUS en el último ejercicio de la torre | `27c08be9` + `9dfa36c5` |
| 4 | Piece Unlocked con vocabulario visual viejo | `e8d7a4d2` |

### El hallazgo caro (#220) — leer esto antes que nada

El overlay de badge re-aparecía cada 2–3 ejercicios, en piezas con **9★**, y su CTA no
hacía nada. **Tres eslabones, y arreglar uno solo no lo mataba:**

1. `deriveEarnedMilestones` emitía `piece-badge-eligible` con `pieceStars >= 10` **sin
   mirar `badgeClaimed`** → el derecho a reclamar sobrevivía al reclamo.
2. **`selectPending` es global**: la cola drena TODO lo pendiente sin filtrar por pieza →
   un evento atascado reabría el overlay en cada solve de **cualquier** pieza. El overlay
   no nombra su pieza, así que parecía mentir sobre la pieza en pantalla.
3. Su CTA llamaba a `handleClaimBadge`, que devuelve un **`false` silencioso** sobre un
   badge ya poseído. El caller lo leía como "el jugador canceló" → `releaseAbsorbed`,
   nunca `dismissCurrent` (el único escritor de `celebratedAt`). **El loop se alimentaba
   solo.**

Y el fantasma **también tapaba el menú de continuación**: `PieceCompletePrompt` exige
`celebration.current === null`, y el fantasma lo mantenía no-nulo. El bug del loop y el
del overlay eran **el mismo bug**.

Fixes: los dos eventos de badge son ahora **estados excluyentes**; `repair-claimed-badges.ts`
repara los perfiles ya rotos (un marcador de una sola vez jamás los alcanzaría); el CTA
consume el reconocimiento si el badge ya es tuyo.

---

## Decisiones de producto tomadas (no re-litigar)

1. **Modos: solo LEARN y PLAY. FULL es interno** — [[project_shipped_modes_learn_play]].
   Si el único entry point de un feature vive en `HubScaffold` (FULL), **no existe para
   nadie**. Eso causó #219.
2. **Los EJERCICIOS mandan el avance de pieza. Los laberintos NO retienen el foco.**
   Son contenido lateral: deben verse, no secuestrar el camino.
3. **El Daily Tactic ABRE la sesión.** El Lote 2.5 (Daily como cierre) está
   **⛔ SUPERSEDED**.
4. **El Hub Tour NO es onboarding**: es una introducción versionada a una jerarquía nueva.
   **Todo jugador lo ve una vez**, tenga la historia que tenga.

## Cambio de flujo de trabajo (YA APLICADO)

**Merge local a `main` + UN push.** Nada de pushear ramas ni PRs con auto-merge: eso
disparaba un preview deploy + otro de prod por cada fix chico.
[[feedback_local_merge_single_push]] — reemplaza a `feedback_auto_merge_prs_solo_main`.

---

## ▶️ NEXT: el cluster del Hub Tour

**Spec listo:** `docs/specs/2026-07-12-hub-tour-daily-first-spec.md`. Está completo
(estados, edge cases, copy dinámico, persistencia, no-goals). **No re-especificar.**

Lo que hay que construir:
1. **Tour de 3 pasos** en el hub de LEARN — Daily → Challenge → Start Focus. Llave
   `chesscito:hub-tour:v1`. Copy dinámico según estado (pass ya comprado / daily ya hecho).
2. **Cierre del Daily** — primario **Continue training**, secundario **Join Challenge**.
   Sin esto el Daily sigue desconectado del Content Loop.
3. **Recordatorios del Challenge** — CTA contextual + chip. **Nunca modal.**

**La restricción que puede hundirlo:** el tour monta en el mismo hub que la cola de
celebración, el welcome gift y la SeasonPassSheet. **Es un GATE**: no arranca si hay otro
modal, y mientras corre nadie más monta uno. El test **debe contar `[aria-modal="true"]`**,
nunca `role="dialog"`.

---

## Open questions

- **La llama.** Sigue encendiéndose SOLO con el Daily. El tour lo hace visible, pero la
  incoherencia de fondo (una sesión de 10 ejercicios no enciende el día) **no se resuelve
  con el tour**. Vale una decisión propia después.
- **Persistencia del flag del tour:** local-only en v1. No hay tabla de perfiles. Cambiar
  de device lo hace reaparecer una vez. Aceptado.
- **`path-layout.ts` ya tiene offsets por columna** (arrays indexados como `TILE_PADS`).
  El founder los tunea a mano; los valores actuales son los viejos, sin cambios.

Wolfcito 🐾 @akawolfcito
