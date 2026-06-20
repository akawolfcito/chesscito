# Implementation Plan — Focus Passport P1 (streak-based)

**Date:** 2026-06-20
**Status:** PLAN ONLY — no code yet
**Spec:** `docs/specs/2026-06-20-focus-passport-p1.md`
**Scope guard:** streak-based only · no `completedDates[]` · no backend · no
on-chain · Lite-only · Full untouched.

---

## 1. Diagnóstico del código actual

- **Store:** `apps/web/src/lib/daily/progress.ts` → key `chesscito:daily-progress`,
  tipo `DailyProgress { streak, lastCompletedDate, totalCompleted }`. Parser
  defensivo + `getDailyProgress()`, `recordDailyCompletion()`, `todayUtc()`.
- **Consumidores actuales de streak/last/total:**
  - `components/daily/daily-tactic-slot.tsx` — escribe (record) + lee streak.
  - `components/hub/hub-daily-tile.tsx` — lee para el tile diario.
  - `components/hub/hub-scaffold-client.tsx` — lee señales (`isCompletedToday()`,
    `getDailyHistoryCount()`) para el hero CTA.
  - `lib/daily/telemetry.ts` — eventos de streak.
- **Lite gate:** flag de build `CHESSCITO_LITE_MODE` (`@/lib/feature-flags`),
  usado como `{CHESSCITO_LITE_MODE && …}` / `{!CHESSCITO_LITE_MODE && …}` en
  `hub-scaffold.tsx`. ⇒ render condicional = Lite-only, Full intacto.
- **Patrón anti-hydration ya establecido** (`hub-scaffold-client.tsx` ~L289):
  `useState<T|null>(null)` → `useEffect` lee localStorage → mientras `null`
  pinta default seguro. **Reusar tal cual.**
- **UI base reutilizable:** patrón `vitrine-hero-band` (cream-amber) +
  CSS por superficie en `apps/web/src/styles/hub.css`.

> Conclusión: la data y los patrones ya existen. P1 es ensamblaje, no
> infraestructura.

---

## 2. Plan de implementación

**SDD → TDD → EDD.** Pasos atómicos:

1. **Pure helper** `derivePassportView(progress, today)` en
   `lib/daily/passport.ts` (o dentro de `progress.ts`):
   - `filledSlots = clamp(streak, 0, 7)`
   - `todayDone = lastCompletedDate === today`
   - `tier = 0 | 1 | "2-6" | "7+"` (para copy/estado)
   - **Función pura → testeable sin DOM** (TDD primero).
2. **Componente presentacional** `components/hub/focus-passport.tsx`:
   - Props: `{ streak, totalCompleted, todayDone, isLoading }`. Sin acceso
     directo a localStorage (testeable, sin hydration en sí mismo).
   - Renderiza hero card + 7 slots + copy por tier.
3. **Wiring** en `hub-scaffold-client.tsx`:
   - Añadir al `useEffect` de mount la lectura `getDailyProgress()` →
     `useState<DailyProgress|null>(null)`. Mientras `null` → `isLoading`.
   - Pasar props a `<HubScaffold>`.
4. **Mount Lite-only** en `hub-scaffold.tsx`:
   - `{CHESSCITO_LITE_MODE && wrap("FocusPassport", <FocusPassport … />)}`
     en una posición alta del stack (ver §4). Full nunca lo monta.
5. **CSS** en `apps/web/src/styles/hub.css` (solo hub lo usa) — clases
   `.focus-passport*`. No tocar `globals.css`.
6. **Copy / i18n** — strings en el catálogo de copy del hub (mismo lugar que
   el resto del hub Lite), sin "verified"/"on-chain"/médico (ver §… abajo).
7. **Tests** (§7) → **Smoke lite-preview** → VR baseline hub Lite.

---

## 3. Archivos afectados

| Archivo | Cambio |
|---|---|
| `lib/daily/passport.ts` (NEW) | pure `derivePassportView()` + tipos |
| `components/hub/focus-passport.tsx` (NEW) | componente presentacional |
| `components/hub/hub-scaffold-client.tsx` | hidratar progress + pasar props |
| `components/hub/hub-scaffold.tsx` | montar Passport Lite-only |
| `styles/hub.css` | clases `.focus-passport*` |
| copy/i18n del hub | strings del Passport |
| `__tests__/*` (NEW) | unit del helper + del componente |

No se toca: `progress.ts` schema (sin campos nuevos), env, contratos, pagos,
rutas, Full surfaces.

---

## 4. UI propuesta

- **Dónde:** Hub Lite, **arriba** (ancla de retorno), encima/junto al daily
  tile. Reusar shell `vitrine-hero-band` cream-amber.
- **Layout:**
  - Línea 1: streak grande ("🔥 N day streak" / "Start your streak").
  - Línea 2: fila de **7 slots** (lleno = sello/llama; vacío = outline).
  - Subline: "Current streak" (no "estos 7 días").
- **Reflejo en Trophies/Progress (DECISIÓN):** **opcional, mismo PR si trivial.**
  El componente es reutilizable; si encaja en el hero band de Trophies sin
  refactor, incluirlo; si requiere adaptación → diferir a follow-up. P1 mínimo
  = solo Hub. (Recomendado: Hub-only primero, reflejo como follow-up de 1 línea.)

---

## 5. Estados (por streak)

- **0** (`isLoading` o streak 0): 7 slots vacíos + "Start your streak. Solve
  today's focus." Mientras `null` → mismo render vacío (sin parpadeo, sin días
  falsos).
- **1**: 1 slot lleno + "Day 1. Come back tomorrow."
- **2–6**: N slots llenos + "N day streak. Keep going."
- **7+**: 7 slots llenos (milestone) + "7-day focus. Nice." Semana 2 repite.
- **todayDone=true**: slot de hoy resaltado/celebrado. **false** (streak>0):
  slot de hoy "pendiente" + CTA suave.
- **Streak roto**: se maneja solo (el store ya resetea a 1 al próximo solve);
  copy neutro, sin "perdiste".

---

## 6. Riesgos

- **Hydration flicker** → mitigado por patrón `null`-default existente; SSR pinta
  vacío, cliente rellena. No leer localStorage en render.
- **Días falsos** → slots = `min(streak,7)`, NUNCA fechas; copy "current
  streak"; mientras `null` no pintar nada como hecho.
- **Romper Full** → gate `CHESSCITO_LITE_MODE` en el mount; test que verifica
  no-render en Full.
- **UTC vs local** (medianoche) → heredado del store; aceptable, documentar.
- **localStorage wipe / por-dispositivo** → sin DB no hay backup ni
  cross-device; copy no promete permanencia ni "tu cuenta".
- **VR drift** → refrescar baseline del hub Lite en el mismo PR.
- **Scope creep** → prohibido `completedDates[]`, multi-fuente, WP, recompensas.

---

## 7. Tests / smoke requeridos

- **Unit (helper, TDD primero):** `derivePassportView` para streak
  `0,1,3,7,10` → slots `0,1,3,7,7`; `todayDone` por `lastCompletedDate`; tier.
- **Unit (componente):** render por estado §5; estado `isLoading` no muestra
  días llenos; copy **no** contiene `verified|on-chain|NFT|mint|cure|brain
  health` (test de regresión-ceiling, estilo anti-AI-prose).
- **Lite gate:** Passport no se renderiza con `CHESSCITO_LITE_MODE=false`.
- **Smoke lite-preview:** Hub muestra Passport; resolver daily → slot de hoy se
  llena + streak +1; reload → persiste; Full preview → sin Passport, sin
  regresión.
- **VR:** baseline hub Lite (empty + streak>0).

---

## 8. Recomendación final

**IMPLEMENTAR como P1 pequeño.** Es ensamblaje sobre datos y patrones
existentes: 1 helper puro + 1 componente presentacional + wiring de hidratación
+ CSS de superficie + tests. Sin backend, sin schema nuevo, sin riesgo para
Full (gate de build). El único elemento que quedaría fuera (mini-calendar de
fechas exactas) ya está correctamente diferido a P1.5 por falta de
`completedDates[]`.

**Tamaño estimado:** 1 sesión acotada (≤ ~8 archivos, mayoría nuevos/pequeños).
**Pre-requisito:** ninguno — listo para ejecutar si se aprueba.

### Copy seguro (referencia, no decir "verified"/"on-chain")

- ✅ "N day streak", "Current streak", "Start your streak", "Keep going",
  "7-day focus", "Come back tomorrow", "Fresh start".
- ❌ Evitar: "verified", "on-chain", "NFT", "mint", "proof", y cualquier claim
  médico ("brain training", "improves focus/memory", "cognitive health").
