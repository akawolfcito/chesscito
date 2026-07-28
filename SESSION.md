# Session Handoff — 2026-07-27 (cierre del día)

> 📌 Detalle de esta sesión: `docs/handoffs/2026-07-27-score-write-path-handoff.md`
> Auditoría completa: `docs/product/2026-07-27-score-and-leaders-audit.md`
> Sesiones anteriores del día: `docs/handoffs/2026-07-27-icons-vr-coverage-and-pro-sheet-handoff.md`
> y `docs/handoffs/2026-07-27-focus-days-21-in-30-handoff.md`.
> Este archivo es el checklist.

## Completed

- **Auditoría score → Leaders.** Los cuatro conceptos del brief hoy son **uno solo**. El score
  mide inventario, no rendimiento; el desempate real es la dirección de wallet. Recomendación:
  ruta D, más barata de lo que suena (`created_at` y `tier` ya están guardados y ociosos).
- `d7691e31` — **Slice 0**: cualquiera podía escribir cualquier score en la wallet de otro.
  Autoría por firma EIP-191, techo server-side, `surface` validada contra el deployment,
  `SUM(...)::int` → `bigint` (el overflow hacía *raise* a la vista entera, no a una fila).
- `ab1170af` — **Slice 0.1**: una firma por save era un prompt tras casi cada ejercicio.
  Ahora `una firma → una sesión (2h / 25 saves) → N saves silenciosos`. Revocable.
- `edee4713` — sin `NEXT_PUBLIC_CHAIN_ID` el challenge salía 200, pedía la firma, y moría
  después con 400. Ahora 503 con el nombre de la variable en el log.
- `197c774a`, `34f37fc1`, `6f30d711` — scripts de deploy versionados y diagnóstico de landing.
- **Smoke en 2 devices (MiniPay + Privy web): el prompt funciona y se lee completo.** Encontró
  que cerrar MiniPay tiraba la sesión → siempre re-firma. Decisión: persistir (opción A).
- `87e35e35` — **pusheado, ya en `origin/main`.** Token en `localStorage`
  (`chesscito:score-write-session:v1`), solo `token`/`wallet`/`surface`/`expiresAt`. Alcance
  intacto (2h, 25 saves, revocable), solo cambia dónde vive entre aperturas. Corrige además un
  bug propio: el cleanup corría al desmontar, así que ir al Hub y volver borraba un token
  válido.

## Current State

- **Branch**: `main`. `origin/main` está en `87e35e35` (verificado con `ls-remote`). Solo el
  commit de docs de cierre queda local.
- **Build**: passing. Tests 6284 / 543 archivos, exit 0 (suite de `apps/web`). Typecheck y
  lint limpios.
- **Uncommitted work**: no.
- **DB**: migraciones **ya aplicadas** en Supabase (una sola base, preview + prod).
  VERIFY 11/11 OK, 132 filas intactas, 0 sesiones.
- **Preview**: código nuevo. **Prod**: código anterior, funcionando por compatibilidad hacia
  atrás (verificada antes del deploy).

## Next Tasks

1. **Re-hacer el smoke, esperando lo contrario que la vez pasada** (el código ya está en
   preview): firmar una vez, **cerrar MiniPay del todo**, reabrir y hacer un ejercicio nuevo
   → **no debe pedir firma**. Ir al Hub y volver tampoco. Si repregunta, mirar `localStorage`
   → `chesscito:score-write-session:v1`.
3. **Decidir cuándo promover a prod.** Ahí los jugadores reales empiezan a firmar y el texto
   del prompt pasa a ser user-facing.
3. **Builds de `apps/landing`** — poner Ignored Build Step en **`Automatic`** (borrar el
   comando custom). Verificado contra la doc: los builds cancelados por el Ignored Build Step
   **igual ocupan slot concurrente**, así que no ahorran cola; el toggle nativo "Skip
   deployments" (ya Enabled) sí. El Root Directory **está bien** — esa hipótesis era falsa.
   El motivo real de que landing se deploye siempre: `docs/`, `tools/` y `SESSION.md` están
   fuera de `apps/*` → Vercel los trata como cambio global. 101 archivos así en 133 commits.
   Diagnóstico completo en §6 del handoff.
4. **Slice 2 — ventana weekly.** Sin migración (`created_at` ya existe). Mata R3 y R4.
5. **Slice 3 — identidad de intento** (`attemptIndex`, `hintsUsed`). Único hueco estructural.
6. **Renombrar la Mini App en MiniPay**: el prompt dice "Solicitado por: **Mini App Test**".
   Ese string **no está en el repo** (manifest y title dicen "Chesscito Learn") — viene del
   registro externo de la Mini App. Se cambia en ese dashboard, no en código.

## Blockers

Ninguno bloquea. Dos cosas abiertas **por decisión**, no por olvido:

- **R1 sigue abierto en el carril on-chain.** `/api/sign-score` firma lo que le pidan y
  `/api/cache-score` acepta `player` del body. Cuesta gas: frena el abuso masivo, no lo cierra.
- **Usuarios con el bundle viejo** en preview: 401 hasta que recarguen. No pierden progreso.

## Notes

- **Orden de deploy no negociable:** `SQL → VERIFY → push`. Rollback: `ROLLBACK.sql` **antes**
  de revertir código, o todos los saves fallan con 500. Ver `apps/web/supabase/deploy/README.md`.
- **El SQL Editor de Supabase muestra solo el ÚLTIMO statement** — un verify de N SELECTs
  sueltos da falsa tranquilidad. Usar una consulta con UNION ALL.
- **`NOTIFY pgrst, 'reload schema'` no puede vivir en la migración**; sin él `supabase.rpc()`
  sigue viendo la firma vieja (`PGRST202`).
- **Vercel marca las env vars como sensibles por defecto** y las oculta. Un `NEXT_PUBLIC_*`
  marcado así no está protegido: Next lo inlinea en el bundle igual.
- **zsh `noclobber`**: `>` sobre un archivo existente falla y el pipeline anterior "pasa" en
  silencio. Verificar que el archivo se escribió, no que el comando salió 0.
