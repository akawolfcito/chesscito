# Audit — Assets skinnables del app (mapa listo-para-registrar en el theme-builder)

**Fecha:** 2026-07-18 · **Branch:** `feat/theme-builder`
**Objetivo:** enumerar TODOS los assets en uso, agrupados por categoría (derivada del provenance),
para registrarlos por lotes en el theme `candy-forest` (variantes `default`/`pro`) sin hacerlo a mano.

## ⚠️ CORRECCIÓN (2026-07-18, post-review del founder)

Este audit se hizo por **grep de `/art/...` literal** y **SUBCUENTA**. Dos puntos ciegos:
1. Rutas compuestas `` `${BASE}/nombre.ext` `` (el `/art/` vive en una const, p. ej.
   `ASSET="/art/board"` en `game-board.tsx`) — **nunca aparecen literales**. Así se escapó
   `/art/board/borde-tablero-chesscito1` (el borde del tablero jugable, en casi todos los tableros).
2. Bases sin extensión (`const X = "/art/..."`) — descartadas por exigir `.png/.webp/.avif`.

Recontar sin extensión dio **161 tokens** (vs 106), y ni eso capta los compuestos.
**→ No confiar en las cifras/listas de abajo como completas.** El método correcto es **validar por
superficie leyendo los asset consts del componente** (resolviendo cada `${BASE}/...`). Ver
`[[feedback_grep_audit_misses_composed_paths]]`. El board ya se corrigió así (3 fixes).

## El universo real
- **~123 assets distintos** están efectivamente referenciados (106 en código TS/TSX + 17 en CSS).
  **NO son 730** — el resto de `public/art/**` son variantes, no usados, u OG cards.
- Tras excluir lo no-skinnable (ver §Skip), quedan **~100 assets theme-worthy** en ~12 categorías.
- La categoría sale del **archivo consumidor** (provenance): `components/hub/*` → HUB,
  `app/[locale]/exercises` → PLAY, etc. Casi nada se categoriza a mano.

## Los dos conceptos de PRO (crítico — no confundir)
1. **Variante `pro` de un slot** que también tiene `default` → el slot se swapea para PRO.
   Hoy **el único par real** es `hub.portal` (`portal-chesscito-normal` ↔ `portal-chesscito-pro`).
2. **Assets PRO-only** → superficies que **solo ve el suscriptor PRO**; son sus propios slots con
   variante `default` únicamente (categoría `pro.*`): `chesscito-pro/*`, `avatar-pro`, `corona-pro`,
   `pro-chip-active/inactive`, `borde-dorado-avatar-*`.

→ En el registry: (1) es `{ default, pro }` en el mismo slot; (2) es un slot `default`-only en la
categoría `pro`. El badge "reuses default" del catálogo solo aplica al caso (1).

## Reglas de deduplicación (antes de registrar)
- **Triplet**: `.png/.webp/.avif` = un asset (ya lo maneja el registry con basename sin extensión).
- **Responsive `-Nw`**: `-96w/-128w/-160w/-224w/-288w/-340w/-384w` son tamaños srcset de UN asset
  lógico → colapsan a **un solo slot** (el basename sin sufijo).
- **Piezas duplicadas**: existe `/art/pieces/w-*` (theme env "default", **muerto**) y
  `/art/redesign/pieces/w-*` (theme "candy", **el que se renderiza**). Registrar solo `redesign/pieces`.
  ⚠️ Verificar caso por caso: algunos `hub` usan `/art/pieces/w-*` como ilustración estática, no como
  pieza de tablero — esos son otro slot.

## Categoría SHARED (hallazgo) — íconos transversales
Varios assets aparecen en 3+ categorías → NO son de una pantalla, son **UI común**. Van a una
categoría `shared.*`, no duplicados por pantalla:
- `screen-mission/close-icon` (daily, pro, arena, exercises, ui, peones)
- `avatar-small-account` (hub, arena, exercises)
- `new-assets-chesscito/paneles/panel-bg1` (payments, victory, arena, exercises)
- `redesign/icons/star`, `redesign/icons/shield`, `screen-mission/adorno-icon`,
  `screen-mission/avatar-icon`, `screen-mission/panel-mision-icon`

## Skip — NO theme-worthy (excluidos del registry)
- `app/api/**` (OG social cards, render server-side) — 13 assets. Se skinnean distinto (fuera de scope).
- `app/dev/**`, `**/__tests__/**` — herramientas y fixtures.
- Root one-offs: `favicon-wolf`, `title-chesscito`, `ring-start-focus`, splash — identidad de marca,
  no theme de juego. (Se pueden registrar aparte en una categoría `brand.*` si querés, pero no urge.)

## Taxonomía + inventario por categoría (registration-ready)

> Naming del slot: `categoria.nombre` (p. ej. `hub.enter-arena`, `board.piece.rook`, `pro.journal`).
> El catálogo agrupa por el prefijo antes del primer punto.

### board (lote #1 — ya planificado en el plan aparte)
Fondo + casillas (en CSS) + 6 piezas (`redesign/pieces/w-*`) + `redesign/board/board-ch`,
`redesign/icons/star`. Ver `2026-07-18-theme-builder-board-slots-plan.md`.

### hub / kingdom (~36) — HUB de LEARN+PLAY (entrada)
`hub/enter-arena`, `hub/train-pieces`, `new-icons-chesscito/{play-chess,training,training-icon-v1,
daily-icon-v1}`, `redesign/banners/btn-battle`, `redesign/icons/shop`, `redesign/bg/bg-new-hub`,
`avatar-lite-hub`, `scene-rooted/guide-secuencia`, `shop/welcome-gift`, `mini-tour/tour-challenge-*`,
`21-day-icon`, `portal-chesscito-normal|pro` (ya registrado). ⚠️ separar avatares PRO (→ `pro`).

### exercises (~24) — PLAY / ejercicios
`avatar-try-again`, `badge-chesscito`, `badge-menu`, `labyrinths/refuge`, `leaderboard-menu`,
`new-assets-chesscito/plant1`, `redesign/bg/{btn-nodo,labyrint-icon}`, `redesign/icons/combo`,
`score-chesscito`, `shop-menu`, `scene-rooted/avatar-chesscito` (ya registrado como hub.avatar — ver ⚠️).

### arena (~13) — PLAY / arena
`new-icons-chesscito/{avatar-blue,save}`, `redesign/bg/wallpaper-exercises`, `redesign/icons/shield`,
`screen-mission/{avatar-icon,panel-mision-icon}`. (varios comparten → `shared`).

### coach (~7)
`new-assets-chesscito/btns/{ask-coach-icon,play,play-again-icon}`, `action-row/trofeo-epico`.

### account (~7)
`new-assets-chesscito/account/{language-icon,network-icon,wallet-icon}`, `shop/{founder,shield}`,
`corona-pro` (→ `pro`).

### pro (~4+) — PRO-only (default variant únicamente)
`chesscito-pro/{chesscito-header-pro-icon,journal-chesscito-pro,panel-suscription-pro,
borde-dorado-avatar-azul,borde-dorado-avatar-rojo}`, `avatar-pro`, `corona-pro`,
`hub/pro-chip-active|inactive`.

### daily (~5)
`avatar-fun`, `bg-sesion-great`, `welldone-sms`.

### peones (~3)
`new-icons-chesscito/{hint-icon-v1,peon-piece-v1}`.

### victory / celebration (~4)
`new-assets-chesscito/fun/avatar-confiado`, `celebration/bg-celebration`.

### long tail (1 c/u): trophies, tactics, landing, welcome-package, pro-mission, hud.

## Lotes de registro recomendados
1. **board** (#1, ya planificado) — 9–11 slots.
2. **hub/kingdom** — la entrada, máximo tráfico.
3. **exercises + arena** (PLAY) — el core del juego.
4. **pro** — desbloquea la variante/categoría PRO completa.
5. **shared** — íconos comunes (una vez, se reusan).
6. **long tail** (coach, account, daily, peones, victory, misc) — oportunista.

## Preguntas abiertas para el founder (filas dudosas)
1. **`brand.*`** (favicon, title, splash): ¿los querés en el theme-builder o quedan fijos?
2. **`shared.*`**: ¿ok agrupar los íconos transversales en una categoría común (no duplicar por pantalla)?
3. **`hub.avatar` vs `exercises`**: `scene-rooted/avatar-chesscito` está registrado como `hub.avatar`
   pero también lo usa exercises. ¿Un solo slot compartido o dos?
4. **Piezas**: confirmás que `/art/redesign/pieces/*` es lo que se renderiza (theme candy) y
   `/art/pieces/*` es muerto → no registrar este último.
