# Handoff — Builder kind-aware: etapas 0 y 1 (2026-07-17)

**Estado:** `main` = `81941f2b` · **5398 passing / 457 files** · typecheck limpio.
Dos merges `--no-ff`, dos pushes. Sin PRs, sin ramas vivas.

---

## Lo que hay que leer primero

- **Spec vigente:** `docs/specs/2026-07-17-builder-kind-aware.md` (v2, veredicto READY)
- **Red-team + resolución de los 4 P0:** `docs/specs/2026-07-17-builder-kind-aware-redteam.md`
- **Memoria:** [[project_builder_only_knows_two_kinds]] (actualizada con lo medido)

---

## La sesión empezó desmintiendo su propia premisa (dos veces)

**Primera.** La memoria decía *"puede que `buildCatalog` lo rechace y falle ruidoso"*. Medí:
**19 de 27 flujos realistas se escriben en silencio.** Queens se corrompe con las 3 metas
probadas.

**Segunda, peor: la primera medición era mía y estaba mal.** Reporté *"12 de 15 fallan
ruidoso, el nivel está a salvo"* — artefacto de sonda. Yo mandaba el record **sin meta**, y
**el builder no deja guardar sin meta** (`validate.ts:21`). El flujo que medí **no puede
ocurrir**. En el flujo real la UI te **pide** la meta, la ponés porque te la piden, y ahí se
escribe en silencio. Pasé de "hay protección" a "no hay ninguna" con la misma pregunta.
→ [[feedback_a_probe_that_ignores_the_ui_measures_nothing]]

**Tercera, del founder:** yo iba a construir un visor de amenazas desde cero. Él preguntó si
los probes con `Zones on` no servían de base. Sirven: `safe-path-board.tsx:26` dice, textual,
que **`showWatched` existe para autoría — "the /dev probe, the builder"**. El visor ya
shippea. Y `SafePathBoard` recibe `level: Exercise`, así que **acepta un borrador**.

De ahí salió la arquitectura del lienzo: **Paint** (pintar, con el overlay de amenazas) ↔
**Preview** (jugar el borrador **en el tablero real**). El builder deja de tener un tablero
genérico que finge entender 5 juegos.

---

## Etapa 0 — las herramientas salen a preview, nunca a producción

Regla del founder: *"local, máximo main → preview; pero nunca a production"*.

**Estaba exactamente al revés.** Las páginas `/dev/*` gateaban por `NODE_ENV` → **404eaban en
preview** (el build de preview corre con `NODE_ENV=production`), mientras
`/api/dev/publish:76` gateaba por `VERCEL_ENV` → **el endpoint que ESCRIBE seguía vivo ahí y
su UI no**.

- `lib/dev/dev-surface.ts` — único dueño de la regla. 28 superficies migradas.
  (6 páginas ya estaban bien; `season-pass-celebration` hasta lo explicaba en un comentario.
  El conocimiento estaba en el repo, aplicado en 6 de 25.)
- ⚠️ **El gate que sostiene es el de `app/dev/layout.tsx`** (server component). 19 páginas son
  `"use client"` y **Next no inlinea `VERCEL_ENV` en el bundle del browser** — solo `NODE_ENV`
  y `NEXT_PUBLIC_*`. Un gate dentro de un client component es SSR-only. El del layout es real,
  y una sonda nueva lo hereda en vez de tener que acordarse.
- `canWriteBaseline()` — **Save es solo-local**: el fs del deploy de Vercel es read-only. El
  servidor se lo dice al builder por el GET (es client component, no ve `process.env.VERCEL`),
  y el botón sale deshabilitado **con el motivo**, en vez de tirar un 500 desde `writeFileSync`.

---

## Etapa 1 — el enemigo deja de ser siempre un peón

**Medido, y la afirmación del spec era correcta pero corta.** No era solo la torre de
`pawn-promotion-1`: son **6 de 34 records**.

| Record | El FEN dice | Un load→save escribía |
|--------|-------------|----------------------|
| `king-safe-1` | `n` caballo — *"The Knight Sees"* | `p` peón |
| `king-safe-2` | `n` caballo ×2 | `p` peón ×2 |
| `king-safe-3` | `b` alfil | `p` peón |
| `pawn-promotion-1/2/3` | `r` torre | `p` peón |

**La causa era el TIPO, no una rama de código.** `captures: string[]` **no puede** cargar una
pieza, así que `buildFenBlock` tenía que inventar una, e inventaba `p`. Ahora es
`AuthoredEnemy { square, piece }`.

`deriveStateFromFen` vivía **sin exportar dentro de `page.tsx`** — por eso el par nunca se
pudo testear y la pérdida sobrevivió tanto. Ahora vive al lado de su inverso, y
`fen-round-trip.test.ts` corre los dos sobre los **34 records reales**.

✅ **Verificado load-bearing**: revirtiendo el serializador a `"p"` caen esos 6, y solo esos 6.
(Casi lo salteo: fui de "rojo por import" a "verde con el fix" sin ver nunca el rojo del bug.)

---

## Próxima sesión: etapa 2

**2a — rename `ContentKind` → `ContentBucket`. Commit PROPIO.** Cruza
`api/admin/content{,/stage}` (input de red con token). Medido: 6 archivos.
⚠️ `session-quota.ts:48` declara **el suyo propio** con la misma forma — **no es un import**,
no se toca, y unificarlos está fuera de alcance.

**2b — la raíz.** `BucketedRecord` (bucket y routing kind son ejes distintos), `root`
inyectable en `baseline-write` (sin eso los tests de AC-2 escriben el working tree real), y el
kind preservado en read/save/**disable**.

⛔ **Sigue roto y es lo más visible:** `page.tsx` hace
`enemies: rec.piece === "pawn" ? derived.enemies : []` al cargar → **un safe-path pierde su
amenaza entera**, no solo su tipo. Es política de la UI; la etapa 2 la vuelve kind-aware.

**El P0 más jugoso, para no perderlo (etapa 3):** hay **DOS validadores**. `validateBuilder`
gatea el Save, pero `buildCatalog` decide de verdad — y ya divergen (diagonal-run: uno
warning, `catalog.ts:212` error). Por eso el builder te deja pintar lo que Save rechaza. La
etapa 3 hace que `validateBuilder` **delegue en `buildCatalog`**: no pueden divergir nunca más,
y el lint del alfil + el `promoteTo` salen gratis.

---

## Abierto, sin decidir

- **Piezas del pincel de enemigos** (etapa 7): propuse las 5 sin rey; verificar si
  `attack-map` ya computa un rey negro — puede ser gratis.
- **Costo de delegar en `buildCatalog` en vivo** (etapa 3): ~260ms por catálogo completo de
  22 records; un record suelto debería ser mucho menos, pero los solvers de queens/tour no
  están medidos. Si duele: debounce, **no** dos validadores.
- **Deuda ajena que apareció y NO toqué** (a propósito: meterla acá era contrabando):
  `api/dev/promote/route.ts:8` usa `revalidateTag(tag)` de un solo argumento, deprecado en
  Next 16.

## Notas de proceso

- No verifiqué el deploy ([[feedback_deploy_verification_is_the_founders]]).
- Sin VR: ninguna superficie tocada tiene baseline. El builder es dev-only.
