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
- ✅ **Las 6 viejas tageadas y borradas** (segunda pasada, ver §Archivo abajo).
- ⏸️ **Conservadas provisionalmente**: los dos `feat/spec-1-*` (worktrees hermanos activos).
- ⛔ **Intactas**: `main`, `production`, `backup/main-before-author-rewrite`.

### Estado final

```
main · production · backup/main-before-author-rewrite
feat/spec-1-candy-polish · feat/spec-1-hub-redesign
```

**40 branches → 5.** Las 5 que quedan tienen las cuatro una función viva.

## Archivo con tags (2026-08-06, segunda pasada)

Siete tags `archive/*`, **todos locales y SIN pushear** — se publican explícitamente en la
próxima ventana de push del founder, nunca con `--tags`. Cada uno se verificó contra el tip
de su branch **antes** de borrarla.

| Tag | Commit | Origen |
|---|---|---|
| `archive/2026-07-observability-lote-1-code` | `68c433fe` | **punto de retoma del Lote 1** |
| `archive/2026-07-observability-lote-1` | `6526c91f` | variante rebaseada |
| `archive/2026-07-observability-privacy-policy` | `d324be56` | la pieza que falta |
| `archive/2026-07-progression-unlocks-celebration-queue` | `c46a62e1` | 2026-07-12 |
| `archive/2026-05-phase-1-ui-zone-map` | `df7fc97e` | 2026-05-01 |
| `archive/2026-03-board-renderer` | `ec910fe8` | 2026-03-04 |
| `archive/2026-03-minipay-gate` | (primera pasada) | ≡ `backup/main-before-author-rewrite` |

### ⚠️ Observabilidad Lote 1: NINGUNA de las dos ramas estaba completa

El trabajo está **en pausa, no abandonado** (founder, 2026-08-06). Al retomarlo importa esto:

`feat/observability-lote-1` y `-lote-1-code` eran **el mismo trabajo rebaseado** — 11 commits
cada una, del mismo día, con SHAs distintos y **10 de 11 con patch-id equivalente**. Pero no
son intercambiables, y ninguna contiene a la otra:

- **`-lote-1-code` es la más avanzada** (+2460): tiene
  `docs/ops/2026-07-23-lote-1-migration-runbook.md`, 184 líneas de runbook de migración y
  smoke de producción que la otra **no tiene**.
- **A `-lote-1-code` le falta el commit de privacy docs.** `git cherry` lo aísla:
  `d81ea919` es el **único** commit de `-lote-1` sin equivalente en `-lote-1-code`.
- **`feat/observability-privacy-policy` (`d324be56`) es exactamente ese commit**: patch-id
  `1fbc2284`, **idéntico** a `d81ea919`. Estaba contenida en `-lote-1`; **no** en `-lote-1-code`.

**Retomar el Lote 1 = `archive/...-lote-1-code` + cherry-pick de `d324be56`.** Tomar
cualquiera de las dos ramas sola pierde el runbook o pierde la declaración de privacidad, y
en los dos casos el hueco es silencioso: el código compila igual.

> **Cómo se midió, porque el método importa más que el resultado:** comparar `--stat` habría
> dicho "son parecidas" y nada más. `git cherry <upstream> <head>` marca con `+` sólo los
> commits **sin equivalente**, y `git patch-id --stable` prueba identidad de contenido a
> través de un rebase, donde el SHA ya no sirve de nada.
