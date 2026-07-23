# Handoff — Terminology + Benefits (Slice B) — 2026-07-23

Branch: `polish/terminology-and-benefits` (2 commits, no PR yet).

## Estado
- **Combo vs Streak diagnosticado.** Dos métricas reales independientes:
  Session Combo (`chesscito:streak`, aciertos consecutivos) vs Daily Streak
  (`chesscito:daily-progress`, días). `×N COMBO` usa la de sesión → se conserva.
  Ambigüedad interna cerrada con JSDoc + doc canónico. **Sin rename** de storage/CSS.
- **Slice B (benefits) implementado.** PRO + Season Pass ahora nombran "Special Trainings"
  con wording categórico a prueba de futuro. Solo perks respaldados por entitlement real
  (`training_pass`). Arena/NFT quedan roadmap-only.
- EN en `editorial.ts`, ES en `messages/es.ts`, test `season-pass-sheet` actualizado.

## Commits
1. `624fd0b` docs(vocab): disambiguate Session Combo from Daily Streak
2. `0231914` feat(benefits): surface Special Trainings in PRO + Season Pass copy

## Verificación
- Typecheck (`tsc --noEmit`): limpio.
- Focused: anti-ai-prose + season-pass-sheet + pro-sheet → **56/56 green**.
- Suite completa: 5692 passing. **2 fallas pre-existentes** ajenas a este trabajo
  (`landing-assets`, `runtime-coverage`) — confirmadas fallando en base limpia (stash),
  causadas por el commit de assets 4795e40a.

## Próximos pasos / open questions
- **PR + merge** de la branch cuando el founder valide el copy en device.
- **2 fallas de theme pre-existentes**: `landing-assets` (assets no byte-identical entre
  las dos apps) y `runtime-coverage` (catálogo). Merecen su propio fix; no bloquean esto.
- **Slice A (mini recap "You learned")**: NO implementado por instrucción. Pendiente de
  confirmar en device si se siente silencioso. Ver `docs/product/2026-07-23-ux-reward-benefits-audit.md`.
- ¿"Special Trainings" debe quedar en inglés en ES (como "Training Journal") o traducirse?
  Decisión tomada: se mantiene como nombre-feature en inglés en ambos locales.
