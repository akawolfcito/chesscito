# Session Handoff — 2026-09-03

## Completed

**Duelo P2P — dos commits en `feat/duel-preflight-p0`, NO mergeados a `main` a pedido del founder**
- `f6d32edd` — los dos P0 del primer contacto del invitado: la pantalla en blanco permanente
  cuando el primer GET falla (`shouldPoll` ahora incluye `loading`, y esa rama renderiza el
  aviso), y el 429 que decía "Try again" sobre una ventana deslizante (aviso propio EN/ES que
  dice cuánto esperar).
- `ca30dab5` — instrumentación: `duel_finished` cuando cae la bandera adentro de un GET
  (era la razón de 1 finished sobre 16 creados), `duel_expired` como denominador, y
  `duel_share_tap` que no existía.
- `882a7d44` (sesión previa, también sin pushear) — salida para el estado `watching` y el nick
  generado en ambos asientos.

**Consejo de revisión del duelo** — 6 agentes read-only. Síntesis en
`docs/audits/2026-09-02-duel-council-review.md`.

**Auditorías de estado** — la telemetría NO está rota; el 93,4% de las cuentas juega un solo
día; un experimento A/B de n=1.264 corrió y nadie leyó el resultado (duplicó la activación y
NO movió la retención). Todo en `docs/audits/2026-09-02-*.md`.

**Downgrade de Supabase Pro → Free** — hecho por el founder, verificado por acá.

**Review de denscope** — `denscope/docs/audits/2026-09-03-indexer-resilience-review.md`
(escrito, NO commiteado en ese repo).

## Current State

- **Branch**: `feat/duel-preflight-p0` (3 commits por delante de `main`, **nada pusheado**)
- **Build**: ✅ `tsc --noEmit` limpio · suite completa **9250 passing / 729 archivos**
- **Uncommitted work**: sí — 10 docs de auditoría sin trackear en `docs/audits/`, más
  `docs/audits/2026-07-18-theme-runtime-inventory.json` modificado (lo regenera la suite,
  deriva preexistente, **no lo commitees sin mirar**)
- **Producción**: 🟢 GREEN post-downgrade. `now()` en 3.605 ms, base 245 MB, 0 errores 5XX.
- **Backup**: `private/backups/2026-09-03T16-54-21Z/` — verificado, 24/24 tablas, paridad exacta

## Next Tasks

1. **Decidir el destino de la rama `feat/duel-preflight-p0`.** El founder pidió que el trabajo
   esté listo pero NO en producción. Está listo. ⚠️ En prod `NEXT_PUBLIC_ENABLE_DUEL` no
   existe (sólo Preview), así que ni siquiera mergeando aparece la tarjeta para crear duelos —
   pero un link ya repartido se juega igual, porque las rutas no leen el flag.
2. **Sacar denscope de la organización de Supabase.** Ocupa ~152 MB de una cuota **compartida
   y dura** de 500 MB (chesscito son 245 MB = 49% por sí solo; la pantalla marca 397/500
   porque suma los proyectos). Crece cada minuto sin retención verificada y falla en silencio.
3. **El playtest del duelo**: repartir ~20 links en MiniPay, desde `preview.chesscito.com`
   (ahí el flag ya está prendido). ⚠️ TTL de invitación **60 minutos** — hay que coordinar, no
   alcanza con mandar el link.
4. **Bucket de rate limit dedicado para el duelo.** Hoy crear un duelo consume 1 de las 5
   req/min del bucket `rl:ip` que comparte con la firma de scores. Todo otro write path del
   repo tiene el suyo.

## Blockers

- **Ninguno técnico.** El duelo está construido, probado y verde.
- ⚠️ **Decisión de producto pendiente, no de código**: el duelo no crea razón de volver
  (el spec lo prohíbe explícitamente: no toca Peones, ranking, insignias ni Season Pass) y un
  experimento ya demostró que forzar actividad del día 1 **no mueve la retención**. Antes de
  invertir más, decidir si el duelo se ataca como retención o sólo como desenlace.

## Notes

### ⛔ Cadencia de backup — cambió con el downgrade

**Free NO incluye backups automáticos ni PITR** ("Not included" en el pricing). El backup
logical de este repo pasó de precaución a **única copia**.

| Cuándo | Qué correr |
|---|---|
| **Antes de cualquier cosa riesgosa** (migración, cambio de esquema, cambio de plan, borrado masivo) | `pnpm ops:backup` — **no negociable** |
| **Semanal**, como piso si es manual | `pnpm ops:backup` |
| **Mensual** | `pnpm ops:backup:verify <dir>` — el dump solo es un archivo; restaurarlo es lo que lo hace backup |

El dump tarda menos de un minuto y pesa 8,69 MB (24 tablas, 50.949 filas). El `--verify`
necesita Docker, por eso va aparte y más espaciado.
⚠️ El backup **excluye `analytics_events`** a propósito (se archiva a Parquet con
`pnpm ops:archive`). **Nadie verificó que ese archivo esté al día** — pendiente.

### Otras cosas que el próximo turno debería saber

- ⛔ **El indexer de producción de denscope es la Edge Function, no `scripts/indexer.ts`.**
  Su `CLAUDE.md` lo dice y esta sesión igual se equivocó de archivo. Leer el mapa primero.
- ⚠️ **`app_opened` es inservible como métrica**: 12.425 eventos, 10 cuentas distintas. Se
  emite antes de que exista `account_ref`. No usarlo en ningún análisis de activación.
- ⚠️ **Ningún evento de duelo lleva `account_ref` ni dimensiones**, porque `recordDuelEvent`
  inserta directo y saltea `/api/telemetry`. No se puede cruzar duelos con retención. **No se
  tocó**: derivarlo exige wallet, y el duelo es deliberadamente wallet-free — es decisión de
  producto.
- ✅ **El Season Pass pausado NO es una fuga.** Se reportó como tal y es falso: es un fallback
  documentado (el jugador paga on-chain antes de que corra la ruta). El gate real que corta
  ventas es `season-pass-sheet.tsx:85`.
- ⚠️ **`NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` sigue en 50 en producción** sin ningún
  consumidor — el propio código pide ponerlo en 0.
- ⚠️ **`NEXT_PUBLIC_I18N_ES_READY` está prendido en Production**, cosa que el código no puede
  decir (default OFF). Verificado con `vercel env ls` y con un curl a `/es/arena` (200, 0 hops).
