# Backlog / Lote 2.5 — Tactical Day Gift + Proof of Consistency

> **Estado:** documentado, NO implementar en Lote 2. Registrado 2026-07-08.
> Cluster siguiente al Lote 2 (off-chain free save). No tocar en esta entrega.

## Flujo objetivo (futuro)

1. Al completar **GREAT FOCUS DAY**, NO mandar directo al HUB.
2. Completar GREAT FOCUS **desbloquea el Tactical Day Gift**.
3. El usuario **resuelve el tactical/gift** como cierre de sesión (experiencia
   completa de ~10–15 min).
4. Tras resolverlo → mostrar **cierre / reward / progreso**.
5. En ese cierre aparece el CTA **opcional**:
   > "Save today's training proof"
6. Si el usuario **no hace la tx** en ese momento (o pierde la pantalla), debe
   poder hacerla **después desde el fuego del día**.
7. El **fuego del día** funciona como **entry point / fallback** para completar
   la *proof of consistency* del día.
8. El gift/tactic **NO** debe estar expuesto directamente en el HUB header como
   acción suelta si eso permite **saltarse** la experiencia completa.

## Reglas de producto asociadas (mantener, no cambiar en Lote 2)

Tres conceptos distintos — no confundir:

| # | Concepto | Qué cuenta | Protegido por |
|---|----------|-----------|---------------|
| 1 | **Exercise COMBO** | Ejercicios consecutivos exitosos dentro de LEARN | Shield actual |
| 2 | **Daily Streak** | Días consecutivos completando el daily | (nada aún) |
| 3 | **Arena Win Streak** | Victorias consecutivas en PLAY | (nada aún) |

- El **Shield actual protege el Exercise COMBO**, NO el Daily Streak.
- **NO** implementar Daily Streak recovery ahora.
- **NO** crear Daily Recovery Shield ahora.
- **NO** cambiar esta lógica en Lote 2.

## Fuera de alcance de Lote 2 (recordatorio)

- No implementar el flujo Tactical Day Gift.
- No implementar el fuego del día como fallback de tx.
- No mover el gift/tactic fuera de su experiencia.

## Open questions (para cuando se retome)

- ¿Dónde vive el estado "proof pendiente del día" (Redis / Supabase / local)?
- ¿El fuego del día ya tiene un componente entry point reutilizable? (ver
  Focus Passport: `lib/daily/passport.ts` + `components/hub/focus-passport.tsx`).
- ¿La proof on-chain reusa el rail de `save today's training proof` on-chain de
  LEARN (gas-only) o define uno nuevo?
- Enumerar estados UI del gift: locked / unlocked / in-progress / solved /
  proof-pending / proof-saved (requisito CLAUDE.md antes de implementar).
