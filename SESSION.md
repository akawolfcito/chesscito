# Session Handoff — 2026-08-05 (Sesión C — capacidad de contenido + cuota diaria)

> 📌 Handoffs y auditorías de esta sesión:
> `docs/handoffs/2026-08-05-daily-quota-slot-bypass-handoff.md` (el rollout, **manda**)
> `docs/audits/2026-08-05-content-capacity-audit.md` (+ `-queries.sql`)
> `docs/audits/2026-08-05-session-limit-and-ranking-integrity.md` (+ `-ranking-integrity-queries.sql`)
>
> **🟢 La cuota diaria de 10 ejercicios está VIVA en LEARN.** Antes no aplicaba a las
> entradas más usadas de la app.

## Estado

| | |
|---|---|
| `origin/main` | `ce5b8a0a` |
| `origin/production` | `ce5b8a0a` — **ancestro estricto de `main`, invariante restaurada** |
| Producción sirviendo | commit `31c74ad` (`chesscito` + `lite-chesscito`, `Ready · Production`) |
| Suite unit | **7397 passing / 0 failing** (+13 casos nuevos) |
| `tsc` / `build` / lint `apps/web` | verdes |
| **VR** | **🔴 11/62** — preexistente, ver Blockers |
| Trabajo sin commitear | no |

⚠️ **Producción sigue la rama `production`, NO `main`** (sigue vigente de la sesión B).
Novedad: `production` fue **reemplazada** por el tip de `main` con `--force-with-lease`;
tenía 2 commits con patch-id idéntico a los de `main` pero distinto SHA, lo que rompía el
`--ff-only` del release process. Backup: `production-backup-2026-08-05` (`da1cc992`).

## Completed

- **Auditoría de capacidad.** 78 niveles alcanzables (59 ejercicios + 19 de carril 2),
  177★ que cuentan (+48 decorativas), techo de ranking **17.700**. Nadie agotó nada:
  máximo **64/78** y **149/177**. **434 de 443 wallets jugaron un solo día** → el cuello
  medido es retención del día 2, no inventario. 15 laberintos autorados quedaron tapados
  por la proyección del carril 2 y hoy rinden cero.
- **A1 resuelto.** El límite en producción era **5** (no el default 10 del código), y la
  compuerta **nunca se aplicaba** si se entraba por `?slot=daily` / `?slot=challenge` — que
  son el CTA principal del hub y la acción #1 del content loop. El contador seguía gastando
  slots que nadie leía.
- **`18f67ba3` — fix.** Quitado el bypass del único productor de `quotaDisplayState`, y
  quitado el candado de cuota sobre carril 2 (pedía un id `labyrinth:` que **nada escribe**,
  así que al límite bloqueaba el carril entero hasta el otro día UTC).
- **Variables a `10`** en Production y Preview de los dos proyectos, con rebuild real.
- **Desplegado + smoke dirigido en producción: 11/11**, cero errores de runtime.
- **Integridad de ranking auditada** (no implementada, por diseño): el hueco resultó ser
  **3 filas de 2 wallets**, todas del pool de 10 del alfil previo al audit B4.3. Nadie tocó
  el headroom de 10×. Diseño de las dos opciones listo en el §C del audit.

## Next

1. **Slice de reparación del VR** (acordado, no abierto). Revisar visualmente los 47 diffs,
   separar cambio legítimo de regresión, estabilizar los 4 timeouts, rebaselinear **sólo lo
   aprobado**. Baselines congeladas desde 2026-07-27 (`30919b23`).
2. **Bound de ranking por pieza (P1)** — §C.1 del audit de integridad. Techo por `level_id`
   (2.700 el alfil, 3.000 el resto) contra los 30.000 actuales.
   ⚠️ Derivar del **baseline compilado + headroom de overlay**, nunca del catálogo merged
   (reintroduce el incidente del 2026-07-09), y **fallar abierto**.
3. **Score derivado en servidor (P1 diferido)** — §C.2. Necesita spec propio: qué pasa con el
   rail on-chain (145 filas sin `exercise_id`) y con el progreso anterior al 2026-07-29.
4. **Contenido nuevo** — recién después de (2). Con la cuota operativa, los 78 niveles rinden
   ~8 días por jugador; autorar volumen antes de arreglar retención no mueve la aguja.

### Arrastrado de la Sesión B (sigue abierto)

5. **Revisar el experimento Tour → Daily** (10 % en LEARN) con muestra suficiente y cohorte
   D1 madura. Consultas corregidas en su handoff. ⛔ No subir de 10 % sin GO explícito.
6. **BalanceReadHealth** — nunca se implementó; diseño en
   `docs/handoffs/2026-08-05-prod-audit-p0-verification-handoff.md`.
7. **Fase C** — las RPC `stats_*` viven en prod y nadie las llama.
8. **`leaderboard_v`** — vista fuera del historial de migraciones. ¿Se dropea?
9. **Baseline de `CLAUDE.md`** — dice 6515/552; el real ahora es **7397**.

## Blockers

- **La suite VR está roja en `main`: 62 casos, 11 pasan, 51 fallan** (47 diffs de píxeles del
  2 % al 50 %, 4 timeouts de `page.goto`, **0 snapshots faltantes**). **Medido como
  preexistente**: revertir los dos archivos del fix a `cceed76b` da fallos idénticos, y los
  rojos caen en superficies que el diff no toca (`support`, `terms`, `privacy`, arena, coach,
  hubs). El founder autorizó desplegar con la excepción documentada. **No se rebaselineó nada.**
- **El swap de `production` no cura la causa.** Volverá a divergir si entra contenido a
  `production` por fuera del ff-merge.

## Notes

- ⚠️ **`vercel env update` reporta "Updated" sin aplicar el valor** (probado con pipe y con
  redirección de archivo). `vercel env add` desde stdin guarda **cadena vacía**. En la CLI
  58.4.4 el único camino que funciona es **`--value <v>`** — y `--value` guarda como
  **Sensitive**, que no se puede releer (`env run` devuelve `""`). Usar siempre
  **`--value <v> --no-sensitive --force --yes`** y **releer** para confirmar.
- ⚠️ **Producción sirve el acceso web (Privy)** y tapa `/exercises` a un navegador invitado.
  Para automatizar contra prod: emular `window.ethereum.isMiniPay` — lo único que mira
  `isMiniPayEnv()` (`lib/minipay.ts:28`) — en vez de crear identidades en producción.
- ⚠️ **`play.chesscito.com/exercises` REDIRIGE a `learn.chesscito.com`**, igual que la URL
  directa del deployment. El hub de play vive en `/`. Encaja con que la base no tenga ni un
  `score_attempts` con `surface='play'`. Un test de play apuntado a `/exercises` mide learn.
- ⚠️ **Playwright 1.58.2 usa `chromium-1208`, no el 1234.** La versión a conservar es la de
  número **MENOR**; "quedarse con la más nueva" borra el navegador en uso.
- 💾 **Disco**: se liberaron 5 GB (`~/.npm` + `chromium-1234`). El preflight del VR exige 10 GB
  y una corrida completa consume ~2 GB. **`~/Library/pnpm/store` no se toca**: hard links.
- ⚠️ **El pool del alfil tiene 9 ejercicios, no 10** (audit B4.3). Su techo es 2.700 y por eso
  hay 3 filas históricas por encima: progreso legítimo sobre un pool que existía. **No revocar.**
- ⚠️ **El progreso por ejercicio es de DEVICE, no de cuenta.** El servidor sólo guarda un total
  por pieza (`score_saves`) y los intentos desde 2026-07-29 (`score_attempts`). Cualquier
  pregunta del tipo "qué ejercicios completó X" sólo tiene respuesta desde esa fecha.
- 🔑 Backup de la protección de rama: `scratchpad/production-protection-backup.json`.
- Sigue abierto de la sesión B: `pro-sheet.tsx:453-456` (`pro-extend-link`) sin gate visual.
  Cosmético; el mutex protege la plata.
