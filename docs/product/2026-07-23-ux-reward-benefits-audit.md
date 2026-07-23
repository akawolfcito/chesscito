# UX Polish Audit — Reward Feedback & Benefits Copy (2026-07-23)

> Alcance: dos slices de **pulido**, sin nueva economía (XP/niveles), sin backend/migraciones.
> Veredicto corto: **Slice A (rewards) ya está maduro — tocar poco. Slice B (benefits copy)
> es el win real, barato y truthful.**

---

## Vocabulario visual de reward existente (reutilizable)

| Componente | Rol | Estado |
|---|---|---|
| `VictoryPopupShell` + `panel-bg1` + `arena-result-*` | Marco canónico de todo modal de fin | ✅ maduro, consistente |
| `result-overlay.tsx` (`ResultOverlay`) | badge / score / shop / error, hero por variante | ✅ sólido |
| `BadgeEarnedPrompt` | Ceremonia con estrellas escalonadas + countdown 15s | ✅ pulido |
| `PieceCompletePrompt` | Narrativa de maestría + avatar peek | ✅ bien |
| `StarsRow` (meter 5 segmentos) | Progreso de estrellas proporcional | ✅ bien resuelto |
| `candy-stat-pill` + `CandyIcon` | Pills de stats (★, shields) | ✅ reutilizable |
| `reward-glow-*`, `reward-ceremony-*`, `reward-star-bounce` | Animaciones de celebración | ✅ ya existen |
| `PHASE_FLASH_COPY.lesson` "You learned: {title}" | Señal de aprendizaje por ejercicio | ✅ existe (flash) |
| `saved-chip.tsx`, `labyrinth-complete-overlay.tsx` | Confirmaciones secundarias | ✅ ok |

## Qué comunica bien vs. qué se siente débil

- **Stars** → bien (pill + meter + share card). No tocar.
- **Shields** → bien (ribbon en dock + shop). No tocar.
- **Peones** → **ya disciplinado**: `score` overlay los oculta deliberadamente
  ("off-chain save is free, so no Peones-spent pills"). La regla "mostrar solo cuando se
  gastan/ganan" ya está aplicada. No tocar.
- **Combo** → **no existe** como mecánica de reward (solo `dailyStripCombo:"Build habit"`,
  label del daily strip, no relacionado). Listarlo fue una suposición del brief. **No inventar.**
- **"What you learned"** → **único gap real de Slice A**: fuerte a nivel ejercicio
  (phase flash), pero **silencioso a nivel pieza/sesión**. `PieceCompletePrompt` muestra
  una narrativa genérica de maestría, no nombra lo aprendido. Mejora de *claridad*, no de sistema.

## Benefits — desactualizados (el hallazgo grande)

**PRO (`PRO_COPY.perksActive`)** — solo promete Coach:
```
"Luz unlimited. Coach review on every game."
"Full Training Journal. Every match kept."
"PRO identity on your profile."
```
No menciona **Special Trainings / Play access**, que PRO **sí** desbloquea
(`source:"pro"` concede `training_pass`). La promesa está **subvendida** y desalineada.

**Season Pass (`CHALLENGE_CARD_COPY`)** — gesticula vago:
`offerBenefitTrainings:"Training+"`, `offerPractice:"Access advanced challenges…"`.
Correcto pero tibio; no conecta con "juegos que van creciendo".

**Dato verificado (no mentira):** `content.access === "training_pass"` gatea los Special
Trainings; base gratis; PRO ⊇ Season Pass en acceso. Nombrarlos en ambos benefits es **truthful**.

---

## Slice mínimo recomendado

**Slice B primero (copy-only, alto impacto / bajo costo):** actualizar `perksActive` (PRO) y
las benefit tiles / `offerPractice` (Season Pass) para expresar la promesa actual con wording
**categórico y a prueba de futuro** — nombrar la *categoría* "Special Trainings", no cada juego:

- PRO perk nuevo (reemplaza/añade 1 bullet): *"Special Trainings — new games added over time."*
- Season Pass: subir "Training+" a algo legible tipo *"Special Trainings"* + micro-copy
  *"Advanced challenges, growing over time."*
- Mantener Coach Review, Daily Focus, Training Journal, PRO identity.
- **Evitar** "incluye exactamente X e Y" → no reescribir cuando entren más juegos.

**Slice A (mini, opcional):** llevar `PHASE_FLASH_COPY.lesson` al cierre de pieza — un recap
"You learned:" en `PieceCompletePrompt` reusando el pill/estilo existente. **Solo si** se ve
débil en device; es claridad, no sistema.

Archivos afectados (ambos slices):
- `apps/web/src/lib/content/editorial.ts` — `PRO_COPY.perksActive`, `HUB_V2_TRAINING_COPY.inactive.perks`, `CHALLENGE_CARD_COPY.offerBenefit*/offerPractice` (copy).
- `apps/web/src/components/payments/season-pass-sheet.tsx` — solo si una tile nueva cambia layout.
- `apps/web/src/components/exercises/result-overlay.tsx` — solo si se hace el recap de Slice A.
- Tests de copy/snapshot que pineen esos strings (ej. `season-pass-sheet.test.tsx`, `pro/__tests__`).

## Red-team (evitar sobre-implementación)

1. **No inventar Combo.** No existe; crearlo es nueva economía. ❌ fuera de alcance.
2. **No tocar Peones/Stars/Shields.** Ya disciplinados; cambiarlos es ruido.
3. **Copy PRO = entitlement real.** El comentario de `PRO_COPY` advierte "roadmap-only, do not
   wire server-side" para Arena/achievements/NFT. Special Trainings **sí** es real vía
   `training_pass` → seguro. Arena/NFT NO → no prometerlos.
4. **No sobre-especificar juegos.** Nombrar cada Special Training obliga a reescribir. Usar categoría.
5. **Slice A puede ser innecesario.** El reward system está bien; el recap "You learned" solo
   vale si el founder lo ve débil en móvil. Default: **no hacerlo** salvo confirmación visual.
6. **No añadir overlays nuevos.** El brief pide claridad, no más superficies.

## Recomendación

Hacer **Slice B (copy-only)** ahora — 1 commit, cero riesgo de layout, truthful.
**Diferir Slice A** hasta confirmar en device que "what you learned" se siente silencioso.
Si la mejora visual real es tan chica → decirlo: es Slice B y listo.
