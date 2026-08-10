# Inventario de trabajo sin mergear — código y base de datos

**Fecha:** 2026-08-10 · **Medido contra:** `main` local en `8d77c00a`
**Pregunta que responde:** qué quedó sin unir, a qué correspondía, y si se debe mergear.

---

## RESUMEN

| Qué | Veredicto |
|---|---|
| `security/peones-spend-authz` | 🔴 **MERGEAR** — fix P0 de hoy, el merge es no-op |
| `docs/2026-08-10-audit-and-experiment-design` | 🟡 Mergear cuando cierres E0 |
| `feat/spec-1-hub-redesign` | ⚪ **BORRAR** — ya llegó a main y fue superado |
| `feat/spec-1-candy-polish` | ⚪ **BORRAR** — idem |
| `backup/main-before-author-rewrite` | ⚪ Backup de marzo, decisión tuya |
| `production` | ✅ Sin nada propio (0 commits) |
| 2 stashes | 🟡 Revisar y descartar |
| 8 tags `archive/*` | ✅ Pausado a propósito, no tocar |
| Base de datos | ✅ **En sync**, salvo una vista legacy conocida |

---

## 1. 🔴 `security/peones-spend-authz` — LO ÚNICO URGENTE

**Un commit, de hoy** (`4641de1c`, 2026-08-10). Es un **fix P0 de seguridad**:

> `POST /api/peones/spend` tomaba la wallet a debitar **del body** y sólo tenía
> `enforceOrigin` (bypassable) + rate-limit; con `service_role` saltea la RLS.
> **Un tercero podía drenar los peones de cualquier wallet pública.**

El fix aplica el patrón del path de scores: la wallet se resuelve desde una write-session
probada por firma, nunca del body.

**Por qué no se terminó de unir:** está detrás de `PEONES_SPEND_REQUIRE_SESSION`, **default
OFF**, para rollout escalonado. Con el flag apagado es un no-op exacto, y **el cliente todavía
no adjunta el token** — encender el flag antes de eso rompería el gasto de peones. La migración
del grantor quedó documentada y **sin aplicar** en `docs/security/2026-08-10-peones-spend-authz.md`.

```
apps/web/src/lib/scores/spend-session-guard.ts          +150
apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts  +177
apps/web/src/app/api/peones/spend/route.ts               +36
apps/web/src/app/api/peones/spend/__tests__/route.test.ts +131
docs/security/2026-08-10-peones-spend-authz.md          +120
```

**Veredicto: mergear ya.** El merge no cambia comportamiento (flag off), y dejar un fix P0
fuera de `main` es cómo se pierde. Después queda pendiente, como trabajo aparte: (1) que el
cliente adjunte el token, (2) aplicar la migración del grantor, (3) prender el flag.

⚠️ **Mientras tanto el agujero sigue abierto en producción.** El commit existe, pero nada de
esto está desplegado ni activo.

---

## 2. 🟡 `docs/2026-08-10-audit-and-experiment-design`

Tres commits de docs, sin código: el audit profundo de producto, el diseño del experimento de
activación/retención y el runbook de rampa de E0 10→50. **Se dejaron fuera a propósito** al
mergear Web Early Access, para mantener el aislamiento que pediste.

**Veredicto:** mergear cuando cierres el ciclo de E0. No hay nada que resolver.

---

## 3. ⚪ `feat/spec-1-hub-redesign` y `feat/spec-1-candy-polish` — YA LLEGARON, POR OTRA VÍA

Del **2026-05-18**. 33 y 38 commits respectivamente. Viven en **worktrees separados**:

```
/…/chesscito-spec-1-hub-redesign    a07720e5
/…/chesscito-spec-1-candy-polish    ab71ac0e
```

`main` tiene **2.816 y 2.800 commits** que ellas no tienen. Están tres meses atrás.

**Qué fue de eso: el trabajo SÍ llegó a `main`**, por squash. Evidencia:

- Sus cinco handoffs (`docs/handoffs/2026-05-18-*.md`) están en `main`.
- Sus archivos también: `e2e/hub-redesign.spec.ts`, `api/profile/stats/route.ts`,
  `hub/settings-sheet-stub.tsx`, `art/scene-rooted/portal-centered.webp`.
- Los dos únicos que faltan —`hub/onboarding-card.tsx` y `hub/secondary-cta.tsx`— **no se
  perdieron: fueron superados** por `hub/hub-tour.tsx` + `use-hub-tour.ts`, el Hub Tour /
  Daily-first de julio.

**Veredicto: borrar las dos branches y sus worktrees.** No hay nada que rescatar y mergearlas
hoy sería revivir una versión del hub que el producto ya dejó atrás dos veces. Ojo: el
worktree ocupa una copia entera del repo cada uno.

---

## 4. ⚪ `backup/main-before-author-rewrite`

Dos commits, último de **2026-03-03**. Es lo que su nombre dice: la foto de `main` antes de
reescribir el autor de los commits. **Veredicto:** no se mergea nunca. Borrala si ya no querés
la red de seguridad; no cuesta nada dejarla.

## 5. ✅ `production`

**0 commits** que `main` no tenga. Coherente con el reemplazo desde `main` del 2026-08-05.

---

## 6. 🟡 STASHES (2)

### `stash@{1}` — ⚪ YA ESTÁ TODO EN `main`

Guardado sobre `288ef3a`. ⚠️ **Su mensaje miente**: dice "gold/silver/bronze text color to
top-3 leaderboard ranks (M25)" porque ése es el commit sobre el que se guardó, **no** lo que
contiene. Toca 7 archivos y son tres cosas distintas:

1. **Pausa de 800 ms antes del overlay de fin de partida**, para que el jugador vea la posición
   final del mate antes de que se la tape (`arena/page.tsx` + `isCheckmatePause` en
   `arena-board.tsx`).
2. **`engineError`** en `ARENA_COPY` + su manejo en `use-chess-game.ts`.
3. Retoques en tres sheets de play-hub.

**Veredicto: descartar.** `main` ya tiene las tres — `isCheckmatePause` (2 archivos),
`showEndOverlay` (1) y `engineError` (2). Además su archivo base, `app/arena/page.tsx`, **ya no
existe**: el árbol se movió a `app/[locale]/`, así que ni siquiera aplicaría.

### `stash@{0}` — 🟡 CONTENIDO AUTORADO, decisión del founder

"builder test experiments (rook-lab-4 etc)", 2026-06-16. Modifica el FEN del primer laberinto
de torre por uno sembrado de caballos, agrega un quinto (`rook-lab-4`) con ese mismo FEN, y
regenera `puzzles.generated.ts` (`optimalMoves` 3 → 5).

`main` tiene hoy **4 laberintos de torre** y `rook-lab-4` **no está**.

**Veredicto: descartar, pero lo decidís vos.** El contenido se autora por el builder y el
catálogo, y `puzzles.generated.ts` se regenera solo, así que reaplicarlo sería pisar contenido
vigente con un scratch de hace dos meses. Es la única pieza que toca **contenido autorado**, y
la regla del repo es confirmar antes de borrar ese tipo de artefacto.

## 7. ✅ TAGS `archive/*` (8)

`2026-03-board-renderer`, `2026-03-minipay-gate`, `2026-05-phase-1-ui-zone-map`,
`2026-07-observability-lote-1`, `-lote-1-code`, `-privacy-policy`,
`2026-07-progression-unlocks-celebration-queue`, `production-backup-2026-08-05`.

Es trabajo **pausado a propósito**, y el mecanismo es deliberado: son tags **locales**, no
branches, para que no aparezcan como ruido. **No tocar.**

---

## 8. BASE DE DATOS — EN SYNC

Comparación hosted vs local (local se reconstruye **sólo** desde migraciones):

| | hosted | local | comunes | sólo hosted |
|---|---|---|---|---|
| Tablas | 22 | 22 | 22 | — |
| Funciones | 34 | 34 | 34 | — |
| Vistas | 5 | 4 | 4 | **`leaderboard_v`** |

Tras aplicar `20260810000000` y registrar las tres versiones, **el ledger quedó al día** y no
hay ninguna tabla ni función en producción que las migraciones no reproduzcan.

### La única excepción: `leaderboard_v`

**No es un hallazgo nuevo ni un descuido.** Es la vista legacy del leaderboard, creada a mano
en producción, y está documentada como tal en
`20260610000000_leaderboard_combined_view.sql:10` — *"which has no versioned baseline DDL, it
lives only in [prod]"*. Hay incluso un test de regresión que **prohíbe** que cualquier
migración le haga DDL (`leaderboard-combined-schema.test.ts:144`).

```sql
SELECT player, sum(best_score) AS total_score,
       rank() OVER (...) AS rank,
       COALESCE(pc.is_verified, false) AS is_verified
FROM (SELECT player, level_id, max(score) FROM scores GROUP BY ...) sub
LEFT JOIN passport_cache pc ON pc.player = sub.player
GROUP BY ... LIMIT 10;
```

**Veredicto: dejarla.** Fue reemplazada por la vista combinada y el código actual no la lee
(`seq_scan` sin registrar). Traerla a una migración sólo para borrarla es riesgo sin premio.

⚠️ **Una cosa sí vale confirmar:** tiene `SELECT` para `anon` y `authenticated`, y **una vista
no hereda la RLS de su tabla base** — es dueña `postgres`, así que expone
`passport_cache.is_verified` de los top-10 saltando el deny-all de esa tabla. Los scores son
públicos por diseño y el badge de verificado en el leaderboard es plausible que sea
intencional, así que **no lo trato como fuga**; pero es exactamente el patrón que cerró
`20260805010000_close_public_access_to_privileged_views.sql`, y si `is_verified` no debía ser
público, esta es la puerta que quedó.

---

## CÓMO SE CIERRA CADA COSA

El principio: **nada se borra sin dejarlo recuperable primero.** El repo ya tiene la convención
—tags `archive/*` locales— y se usa acá también. Un tag pesa cero y revive el trabajo entero.

### 1. ✅ `security/peones-spend-authz` — HECHO

Mergeado a `main` local el 2026-08-10 (`353d17f0`, merge sin fast-forward, cero conflictos).
820 tests verdes, `tsc` limpio. La branch ya se puede borrar.

⚠️ **El merge NO activó el fix.** Sigue pendiente, y es lo único de toda esta lista con
consecuencia de seguridad real:

1. que el cliente adjunte el token de sesión al llamar `/api/peones/spend`;
2. aplicar la migración del grantor de `docs/security/2026-08-10-peones-spend-authz.md`;
3. prender `PEONES_SPEND_REQUIRE_SESSION=true`.

**Hasta el paso 3, el agujero sigue abierto en producción.**

### 2. Las dos branches de spec-1 y sus worktrees

```bash
git tag archive/2026-05-spec-1-hub-redesign  feat/spec-1-hub-redesign
git tag archive/2026-05-spec-1-candy-polish  feat/spec-1-candy-polish
git worktree remove ../chesscito-spec-1-hub-redesign
git worktree remove ../chesscito-spec-1-candy-polish
git branch -D feat/spec-1-hub-redesign feat/spec-1-candy-polish
```

Recupera cualquiera con `git switch -c <nombre> archive/<tag>`. Libera además dos copias
enteras del repo en disco.

### 3. Los stashes

Un stash **es un commit**, así que un tag lo preserva igual de bien y deja de ocupar la lista:

```bash
git tag archive/2026-06-builder-rook-lab-experiments 'stash@{0}'
git tag archive/2026-05-arena-end-overlay-pause      'stash@{1}'
git stash drop 'stash@{1}'   # ya esta todo en main
git stash drop 'stash@{0}'   # solo despues de confirmar el contenido
```

### 4. `backup/main-before-author-rewrite`

De marzo, dos commits, es la foto previa a reescribir autores. No se mergea nunca. Dejala o
convertila en tag y borrá la branch — cuesta lo mismo.

### 5. `docs/2026-08-10-audit-and-experiment-design`

Se mergea cuando cierre el ciclo de E0. No hay nada que resolver.

### 6. `leaderboard_v` — una confirmación, no una acción

Confirmar si exponer `passport_cache.is_verified` de los top-10 a `anon` es intencional. Si lo
es, no se toca nada. Si no, hay que revocarle el `SELECT` a `anon`.

### 7. Tags `archive/*`

No se tocan. Son trabajo pausado a propósito.
