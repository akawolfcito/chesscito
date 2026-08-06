# Auditoría de branches — 2026-08-06

**Medido en** `main` @ `4dbe924d`. **EJECUTADO** el mismo día — ver §Ejecución al final.

## Política de branches (founder, 2026-08-06)

- **`main`**: fuente de verdad del desarrollo integrado.
- **`production`**: exactamente lo desplegado.
- **Branches temporales**: existen mientras hay trabajo activo.
- **Trabajo abandonado pero potencialmente útil**: se archiva con **tags**, no con branches
  eternas.
- **Backups excepcionales**: se conservan temporalmente y se eliminan cuando ya no cumplen
  una función real.

## Resumen

40 branches locales. Sólo **3 existen en `origin`** (`main`, `production`,
`production-backup-2026-08-05`) → **las otras 37 son locales puras**: borrarlas no toca
el remoto ni puede afectar a nadie más.

- **29 mergeadas en `main`** → 24 sueltas, 4 en worktrees, más `production`.
- **11 no mergeadas** → 1 sólo está atrasada, 2 están en worktrees activos,
  y **3 son trabajo real de julio que nunca entró**.
- **4 `worktree-*`** están mergeadas pero **bound a un worktree**: piden
  `git worktree remove` antes del `branch -d`. Los cuatro están limpios.

## Grupo A — Mergeadas, sin worktree, borrado seguro (24)

`chore/art-assets` · `chore/privy-celo-harness` · `docs/daily-streak-nudge-spec` ·
`docs/readme-sync-web-access` · `feat/challenge-card-redistribution` ·
`feat/daily-streak-nudge` · `feat/focus-days-ui` · `feat/leaders-weekly-api` ·
`feat/leaders-weekly-db` · `feat/leaders-weekly-ui` ·
`feat/obstacle-art-celebration-onchain-discoverability` ·
`feat/privy-shared-session-disconnect` · `feat/stats-information-architecture` ·
`feat/stats-landing-aggregator` · `feat/stats-product-funnels` · `feat/web-wallet-provider` ·
`fix/baseline-schema-and-rls-parity` · `fix/daily-quota-slot-bypass` ·
`fix/promotion-picker-diagnosis` · `fix/score-write-path-hardening` · `fix/stats-cache` ·
`fix/web-access-cancel-and-error-layout` · `fix/web-access-gate-inside-frame` ·
`refactor/hub-lite-daily-slot`

## Grupo B — ⛔ NO TOCAR

| Branch | Por qué |
|---|---|
| `production` | Rama viva de release. Aparece en `--merged main` — **un barrido ciego la borra**. |
| `feat/spec-1-candy-polish` | Worktree hermano activo, 38 commits ahead (2026-05-18). |
| `feat/spec-1-hub-redesign` | Worktree hermano activo, 33 commits ahead, 72 archivos (2026-05-18). |
| `backup/main-before-author-rewrite` | Es un **backup deliberado** de `main` previo a un rewrite de autoría (2026-03-03). Sólo lo borra una decisión explícita del founder. |

## Grupo C — Mergeadas pero en worktree de agente (4)

`worktree-feat-pr4-learn-branding` · `worktree-feat-pr5-dock-modes` ·
`worktree-feat-pr6-effective-training-pass` · `worktree-victory-nft-permit-mint`

Viven en `.claude/worktrees/`. **Los cuatro con árbol limpio** y contenido ya en `main`.
Piden `git worktree remove <ruta>` y después `git branch -d`.

## Grupo D — No mergeadas: qué hay adentro

| Branch | Ahead | Último commit | Diff vs `main` |
|---|---|---|---|
| `reconcile/production-with-main` | 3 | 2026-08-05 | **atrasada** — nada que main no tenga |
| `feat/observability-lote-1` | 11 | 2026-07-23 | 30 archivos, +2294 |
| `feat/observability-lote-1-code` | 11 | 2026-07-23 | 29 archivos, +2460 |
| `feat/observability-privacy-policy` | 1 | 2026-07-23 | 2 archivos, +18 |
| `phase-1-ui-zone-map` | 9 | 2026-05-01 | 12 archivos, +1236 |
| `feat/board-renderer` | 2 | 2026-03-04 | 6 archivos, +275 |
| `feat/progression-unlocks-celebration-queue` | 1 | 2026-07-12 | 1 archivo, +128 |
| `chore/minipay-gate` | 6 | 2026-03-03 | 29 archivos, +1102 |

### Lo que hay que decidir acá

1. **`reconcile/production-with-main` es basura segura**, pero **no por la razón que decía la
   primera versión de este audit**. `git diff main...reconcile` (tres puntos, contra el
   merge-base) da vacío y se leyó como "mismo contenido que main". El de dos puntos muestra
   lo real: la rama está **3.820 líneas atrasada**. No es que sea igual a `main` — es que no
   tiene **nada** que `main` no tenga. La conclusión aguanta; el fundamento era otro.
   ⚠️ **Tres puntos mide aporte propio, dos puntos mide diferencia.** Para decidir un borrado
   hace falta el segundo.
2. **⚠️ El trío de observabilidad (2026-07-23) es trabajo real que nunca entró.** ~2.400
   líneas, tres branches del mismo día. `-lote-1` y `-lote-1-code` casi se solapan (una es
   probablemente la versión sin docs de la otra). **No borrar sin saber si se abandonó o
   quedó en pausa** — es el único hallazgo con contenido que se perdería.
3. **`chore/minipay-gate` tiene EXACTAMENTE el mismo diff que
   `backup/main-before-author-rewrite`** (29 archivos, +1102/−152). No es coincidencia: son
   el mismo contenido de marzo bajo dos nombres. Si el backup se conserva, la otra es redundante.
4. Las de marzo/mayo (`feat/board-renderer`, `phase-1-ui-zone-map`,
   `feat/progression-unlocks-celebration-queue`) son trabajo viejo no mergeado. Borrarlas
   pierde ese contenido; **archivarlas con un tag** cuesta lo mismo que borrarlas.

## Remotas

`origin/main` · `origin/production` · `origin/production-backup-2026-08-05` (del swap del
2026-08-05, reciente — **conservar**). Nada que limpiar en el remoto.

## Ejecución (2026-08-06, aprobada por el founder)

**40 branches locales → 11.** Todo local: el remoto no se tocó y no se pusheó nada.

- ✅ **Grupo A borrado** (24, con `-d`).
- ✅ **Los 4 worktrees removidos** de `.claude/worktrees/` + sus branches borradas.
- ✅ **`reconcile/production-with-main`** borrada (`-D`).
- ✅ **`chore/minipay-gate`** borrada (`-D`), **precedida de tag**
  `archive/2026-03-minipay-gate`. Sin ese tag, `backup/main-before-author-rewrite` quedaba
  siendo la única copia de ese contenido y dejaba de ser un backup temporal para convertirse
  en archivo permanente — que es justo lo que la política manda hacer con un tag.
- ⏸️ **Conservadas hasta publicar sus tags**: `feat/observability-lote-1`,
  `feat/observability-lote-1-code`, `feat/observability-privacy-policy`,
  `phase-1-ui-zone-map`, `feat/board-renderer`,
  `feat/progression-unlocks-celebration-queue`.
- ⏸️ **Conservadas provisionalmente**: los dos `feat/spec-1-*` (worktrees hermanos activos).
- ⛔ **Intactas**: `main`, `production`, `backup/main-before-author-rewrite`.

### Estado final

```
main · production · backup/main-before-author-rewrite
feat/board-renderer · feat/observability-lote-1 · feat/observability-lote-1-code
feat/observability-privacy-policy · feat/progression-unlocks-celebration-queue
feat/spec-1-candy-polish · feat/spec-1-hub-redesign · phase-1-ui-zone-map
```

**Deuda abierta**: las 6 branches en ⏸️ esperan su tag `archive/*`. Hasta que se publiquen,
la política no está cumplida — son exactamente las "branches eternas" que prohíbe.
