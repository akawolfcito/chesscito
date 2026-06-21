# Handoff — Focus Passport P1.1 Closure

**Date:** 2026-06-20
**Branch at close:** `main` @ `0e78d0a3`
**Decision:** ✅ **Focus Passport P1 + P1.1 CERRADO** (founder smoke passed)

---

## Resumen

Focus Passport (Chesscito Lite) cerrado tras P1 (funcional, streak-based) +
P1.1 (iteración visual). Es la visualización del hábito de Daily Focus, no una
feature nueva: reusa `chesscito:daily-progress` sin schema nuevo, local-only,
Lite-only, sin backend / on-chain / pagos.

### Qué shippeó (orden de merge)

| PR | Commit | Qué |
|---|---|---|
| #155 | `d55004ac` | P1 — card streak-based, 7 slots `min(streak,7)`, Lite-only, hydration anti-flicker |
| #156 | `3e529a09` | P1.1 — slots → llamas (blue=día previo, color=hoy/activo, gray=pendiente+glow), card compacta |
| #157 | `39a5aded`+`c77079e0` | Mover al `hub-scaffold-center-stack` (reemplaza peón+guide+rey en Lite) + fondo = arte `panel-streak` (kicker sutil, sin "Start your streak") |

### Arquitectura final
- Helper puro `apps/web/src/lib/daily/passport.ts`: `derivePassportView`,
  `passportTier`, `passportFilledSlots`, `passportSlots` (deriva las 7 llamas
  de filledSlots+todayDone; sin tocar data).
- Componente `apps/web/src/components/hub/focus-passport.tsx` (presentacional,
  Lite-only mount en `hub-scaffold.tsx` vía `CHESSCITO_LITE_MODE`).
- Assets `apps/web/public/art/focus-passport/` (flame-color/blue/gray +
  panel-streak, tripletes png/webp/avif).
- Copy EN/ES en `editorial.ts` + `es.ts` (sin verified/on-chain/proof/NFT/mint/
  médico).

### Validación
- Founder smoke en lite-preview: **OK** (compacto, llamas no puntos, estados de
  racha correctos, Full sin passport, reload persiste).
- Tests: helper 24, componente 10, gates Lite-render + Full-no-render verdes.
  `tsc --noEmit` limpio.

---

## Screenshots (evidencia) — PENDIENTE founder

Capturar en lite-preview y guardar en `docs/grants/assets/` (enlazar desde el
grant pack `docs/grants/2026-06-20-chesscito-lite-grant-pack.md`):

- [ ] Hub Lite con Focus Passport en el center-stack (streak activo)
- [ ] Estado streak 0 (todas las llamas grises)
- [ ] Estado streak medio (azules + naranja + grises)
- [ ] Detalle del panel-streak en 390px

---

## Riesgos / follow-ups (no bloqueantes)

- **VR baseline** del hub Lite con passport NO capturada (superficie nueva) →
  follow-up.
- **Posicionamiento sobre el arte**: los % absolutos (kicker/llamas/título en el
  pill) quedaron validados por el founder; si el arte `panel-streak` cambia,
  recalibrar.
- **P1.5 diferido**: mini-calendar de fechas reales requiere `completedDates[]`
  (no implementado a propósito).
- Reflejo en Trophies/Progress: diferido (no trivial sin refactor).

---

## Próximo paso (post `/clear`)

**Escribir el spec de Welcome Package** (solo spec, no implementar). Aún NO
implementado: Welcome Package, Focus Stamp transaccional, Challenge Link,
sponsors/ICX, PvP. Mantener jerarquía: Daily Focus = actividad · Focus Day =
día completado · Focus Passport = tracker (cerrado) · Welcome Package = futuro.
