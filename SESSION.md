# Session Handoff — 2026-08-05 (Sesión B)

> 📌 Handoff completo: `docs/handoffs/2026-08-05-session-b-onboarding-experiment-handoff.md`
> — el **apéndice "Ejecución"** manda sobre el cuerpo.
> Descubrimiento: `docs/audits/2026-08-05-session-b-b0-discovery.md`
> Por qué se reconcilió en vez de portar: `docs/audits/2026-08-05-session-b-portability-to-production.md`
>
> **🟢 El experimento Tour → Daily está VIVO al 10 % en LEARN.**
> Este archivo es el checklist; el detalle vive en el handoff.

## Estado

| | |
|---|---|
| `origin/main` | `170bf7af` |
| `origin/production` | `da1cc992` (desplegado y sirviendo) |
| Diferencia | 1 commit, sólo documental |
| Flag | `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT=10`, Production, ambos proyectos |
| Migración | `20260805020000` aplicada en `brsbdzpuvotxsadmcxyj` |

⚠️ **Producción sigue la rama `production`, NO `main`.** Pushear a `main` sólo genera
Preview. Fue el hallazgo que destapó que el P0 del mutex nunca había llegado a producción.

## Completed

- **Funnel Daily/Training separado** (`20016cbd`). `ACTIVATION_FUNNEL` afirmaba que las
  finalizaciones del Daily eran subconjunto de las de training; salen de emisores
  disjuntos. Ahora dos funnels hermanos. `daily_tactic_started` salió de
  `exercise_started` (era la mitad espejo del defecto). Migración `20260805020000`
  escrita, aplicada y verificada: en prod `daily_focus_completed=901 >
  exercise_completed=788`, forma que la definición anidada **no podía representar**.
- **`pro_purchase_started` deja de contar taps** (`3157900c`). El mutex protegía el
  dinero, no la medición: dos taps en el mismo tick daban dos eventos. Ahora se emite
  desde `pay({ onAccepted })`, dentro del mutex. Cubre también `pro-extend-link`.
- **Experimento Tour → primera actividad** (`990b527c`), LEARN-only, instrumentado.
  Reutiliza el `dailyOpen` que el hub ya controlaba: sin superficie nueva, sin wallet,
  sin pago. Asignación pura por hash del install id → estable ante refresh sin persistir
  nada. Idempotencia: el latch es la propia clave del tour.
- **P0 del mutex desplegado por fin** (`5a5e3e09` sobre `production`) — llevaba desde el
  listing sin llegar a producción pese a que el handoff anterior lo daba por desplegado.
- **`production` reconciliada con `main`** (`da1cc992`), merge no-op de contenido: árbol
  byte-idéntico, tree hash `50192a75` en ambas. Levantó el bloqueo de los guards de
  migración, que en `production` **no los colectaba nadie**.
- **Rollout al 10 %** con rebuild real (`NEXT_PUBLIC_*` se inlinea en build).
- **Consultas del handoff corregidas** (`170bf7af`): la columna es `props`, no `payload`;
  y el conteo era `count(*)` sobre un lateral → contaba pares, no instalaciones.

## Next

1. **Revisar el experimento** cuando haya muestra suficiente **y** cohorte D1 madura.
   Consultas corregidas en el handoff. No declarar éxito porque suba
   `daily_tactic_started`: manda completadas/instalaciones por brazo.
2. **BalanceReadHealth** — nunca se implementó; diseño en
   `docs/handoffs/2026-08-05-prod-audit-p0-verification-handoff.md`.
3. **Fase C** — las 9 RPC `stats_*` viven en prod y **nadie las llama**;
   `PublicStats.dailyFocusFunnel` ya existe.
4. **`leaderboard_v`** — quinta vista fuera del historial de migraciones, con el bug de
   overflow ya corregido en el resto. ¿Se dropea?
5. **Baseline de `CLAUDE.md`** — dice 6515/552; el real es **7.384/595**.

## Blockers

- Ninguno. El 10 % corre solo; la próxima revisión la gobiernan los datos, no una tarea.

## Notes

- ⛔ **No subir de 10 %** sin GO explícito.
- ⚠️ **El flag es de build**: cambiar el porcentaje exige redeploy. Apagar = poner `0` y
  redeployar; nadie queda a mitad de camino porque la asignación ocurre una sola vez, al
  terminar el tour.
- ⚠️ Al mergear `main` → `production`, `HEAD` es `production`: la versión de `main` es
  `--theirs`, no `--ours`. Usar `git checkout origin/main -- <archivos>`.
- ⚠️ `supabase db query` apunta a la base **LOCAL** por defecto — pasar `--linked`.
- ⚠️ Las migraciones se aplican desde `main`, **nunca** desde `production`.
- 🔒 Ningún evento de onboarding lleva wallet, email ni texto libre; hay un test que lo
  verifica serializando cada payload.
- Abierto: `pro-sheet.tsx:453-456` (`pro-extend-link`) sigue sin gate visual — no se
  deshabilita durante la compra. Cosmético; el mutex protege la plata.
