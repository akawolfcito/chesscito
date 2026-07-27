# Session Handoff — 2026-07-27 (noche)

> 📌 El detalle del cluster Focus Days 21-en-30 vive en
> `docs/handoffs/2026-07-27-focus-days-21-in-30-handoff.md`. Este archivo es el
> checklist de la sesión que lo cerró.

## Completed

- **Backfill de producción Focus Days 21-en-30: EJECUTADO Y VERIFICADO.** Las 3 filas
  activas de `lite_season_passes` +9 días, en el orden obligatorio del spec (deploy →
  confirmación del founder → §3 → aprobación → §4 → §5). §5 completo: 3 expiradas
  intactas · 6 filas totales · **0** filas con delta ≠ 9 días · `focus_day_ledger` en 0.
  End-to-end en el device: la tarjeta pasó de **5 → 14 days left**.
- `1c93d347` — handoff del backfill actualizado: el "Pendiente operacional" ahora dice
  ejecutado, con la tabla antes/después (sin wallets), el rollback real y **cómo** se
  ejecutó.
- `92b40d8b` — **fix P2 de i18n**: `offerBenefitTrainings` decía "Special Trainings" en
  español, en la hoja de **pago**. Ahora "Entrenamientos especiales". Guard de regla
  nuevo (`challenge-card-es-parity.test.ts`) + `overflow-wrap` en la baldosa.

## Current State

- **Branch**: `main`, limpio, **2 commits por delante de `origin/main`** (`1c93d347`,
  `92b40d8b`). ⏳ **El push a origin lo hace el founder.**
- **Build**: suite **6160 passing / 539 files, EXIT=0** (código de salida confirmado, no
  solo los conteos). `tsc --noEmit` limpio.
- **Uncommitted work**: no.
- **Producción**: `432bb664` desplegado y sano (`v.432bb66` verificado en MiniPay). La
  base ya está normalizada al contrato 21-en-30.

## Next Tasks

1. **Verificación visual del fix ES** — abrir la hoja de compra en español a 390px y
   mirar que "Entrenamientos especiales" no empuje las baldosas vecinas. **No hay
   baseline VR**: el servidor visual corre en modo PLAY y la oferta sólo existe en LEARN.
2. **Cluster Closure Protocol** del cluster Focus Days (CLAUDE.md): README sync si cambió
   "What's live", branch hygiene. MEMORY.md ya quedó sincronizado.
3. **Theme Builder** — el frente grande elegido el 2026-07-18. Arranca con `/spec`:
   estados de UI + superficies del tablero que pinta un tema + persistencia/distribución.
   Merece sesión propia.

## Blockers

- Ninguno.

## Notes

- **El rollback del backfill es el camino (b), no el (a).** La temp table
  `backfill_21in30_rollback` murió al cerrarse la sesión de `psql`. Queda restar 9 días
  con el mismo filtro — seguro porque el UPDATE corrió **una sola vez**, y lo prueba §5(d)
  con 0 filas de delta incorrecto. Los tres valores originales están en el handoff y en §6
  del `.sql`. **Es CÓDIGO + DATOS**: revertir los datos sin revertir el deploy de 30 días
  deja el bug original.
- **Correr SQL contra prod tiene un camino y sólo uno**: no hay `psql` local, el host
  directo `db.<ref>.supabase.co` es **IPv6-only**, y el pooler es **`aws-1-us-east-1` en
  session mode (5432)** — `aws-0` resuelve por DNS pero devuelve `FATAL: (ENOTFOUND)
  tenant/user not found`. Un UPDATE y su verificación que compartan temp table tienen que
  ir en **una sola corrida**. Detalle en el handoff y en memoria.
- **El pase de prueba `8200fe9b` ya no puede llegar a 21/21**: se compró el 2026-07-11 y
  estuvo 16 días sin uso. El backfill le devuelve la ventana de 30 días que le
  correspondía, no le regala días. Para probar el flujo completo hace falta un pase fresco.
- **Los tres números de la tarjeta miden cosas distintas** y se confunden fácil:
  `N of 21` = ledger server-side · `days left` = vencimiento del pase · `streak` = la llama
  (local).
- **Por qué el bug de ES era invisible**: el bundle ES hace `...en.CHALLENGE_CARD_COPY`,
  así que una traducción faltante **resuelve y renderiza en inglés** en vez de fallar.
  Cualquier bloque de copy con ese patrón tiene el mismo agujero — el guard nuevo cubre
  sólo `CHALLENGE_CARD_COPY`.
