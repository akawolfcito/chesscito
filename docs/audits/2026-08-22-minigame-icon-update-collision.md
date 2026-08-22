# Audit — la actualización de iconos de minijuegos volvió a pisar los sprites del tablero

**Fecha:** 2026-08-22 · **Base:** `main` en `7372368a`, working tree sucio (sin commitear)
**Veredicto:** ⛔ **NO quedó contenida en la sección de minijuegos del Learn Hub.**
Tres de los seis iconos se escribieron encima de los sprites de pieza que dibujan el
tablero real. Es **exactamente** el incidente que el comentario de
`theme-registry.ts:441-448` documenta como "para que no vuelva a pasar".

---

## Qué cambió realmente

`git status` reporta **12 archivos**, no 3:

| Archivo | Hora (mtime) | ¿Contenido? |
|---|---|---|
| `art/minigames/rook-rail.{avif,png,webp}` | 13:04 | ✅ tile de laberinto — **correcto** |
| `art/redesign/pieces/w-king.{avif,png,webp}` | 13:20 | ⛔ tile de laberinto (Safe Path) |
| `art/redesign/pieces/w-knight.{avif,png,webp}` | 13:20 | ⛔ tile de laberinto (Knight's Tour) |
| `art/redesign/pieces/w-pawn.{avif,png,webp}` | 13:20 | ⛔ tile de laberinto (Promotion Run) |

Verificado **abriendo las imágenes**, no por nombre: `w-pawn.png` ya no es un peón blanco
sobre transparente — es una baldosa verde 1:1 con marco, tablero y una corona dorada.
Lo mismo `w-king` (rey + camino + escudo) y `w-knight` (caballo + ruta amarilla).

## Por qué pasó

Los seis slots de la sección de minijuegos **no comparten base de rutas**. Tres tienen
carpeta propia y tres **apuntan a los sprites de pieza** (`theme-registry.ts:437-470`):

```
hub.minigame.rook-rail      → /art/minigames/rook-rail        ← propio ✅
hub.minigame.pivot-run      → /art/minigames/pivot-run        ← propio ✅
hub.minigame.n-queens       → /art/minigames/n-queens         ← propio ✅
hub.minigame.safe-path      → /art/redesign/pieces/w-king     ← COMPARTIDO ⛔
hub.minigame.knight-tour    → /art/redesign/pieces/w-knight   ← COMPARTIDO ⛔
hub.minigame.promotion-run  → /art/redesign/pieces/w-pawn     ← COMPARTIDO ⛔
```

La carpeta `/art/minigames/` se creó justamente para cortar esta colisión, pero **sólo se
mudaron tres de los seis**. Quien exporta los iconos ve el path que el slot declara y
escribe ahí: el sistema le pidió pisar la pieza.

## Radio de impacto (qué se ve mal ahora, fuera del Learn Hub)

Ninguno de estos falla ni rompe un test — los triplets `.avif/.webp/.png` son válidos.
Sólo se ve.

**`w-pawn` — el más ancho.** Es la moneda de la app:
- `board.piece.white.pawn` → tablero real, `arena-end-state`, `victory-celebration`,
  `victory-claim-error`, `victory-claim-success`, **+7 componentes más** (`theme-registry.ts:1153`)
- `components/peones/peones-balance-chip.tsx` — el chip de saldo de Peones, presente en
  casi toda pantalla
- `components/coach/coach-cost-ribbon.tsx` — `/art/redesign/pieces/w-pawn.png` (pineado en test)
- `app/api/og/victory/[id]/route.tsx` — **la tarjeta social de victoria** (sale del producto)
- `kingdom-anchor` — la posición inicial de 32 piezas
- `PIECE_IMAGES.pawn` en `lib/content/editorial.ts:216` → insignias, badge-sheet

**`w-knight`:** `board.piece.white.knight` → tablero, `badge-sheet`, `diagonal-run-board`,
`knight-tour-board`, **+4 más** (`theme-registry.ts:1148`); `diagonal-run-spike`;
`PIECE_IMAGES.knight`; el peón del `labyrinth-builder`.

**`w-king`:** `board.piece.white.king` → `hub-scaffold`; `kingdom-anchor`; `PIECE_IMAGES.king`;
`labyrinth-builder`.

**No afectado:** `mastery-tile.tsx` lee `/art/pieces/*` (otra carpeta, sprites viejos), y los
temas PRO tienen asset propio bajo `/art/theme-builder/candy-forest/board/piece/white/*/pro`.
El daño es al **tema por defecto** — o sea, a todos los jugadores gratis.

## Por qué ningún test lo detecta

- El VR corre sólo `--project=minipay` y su tolerancia (`maxDiffPixelRatio: 0.005` ≈ 1.646 px
  sobre 390×844) es ~3,7× un chip. Un peón de 23 px cambiando de dibujo no mueve la aguja.
- Los tests de arte afirman **rutas**, no bytes: `coach-cost-ribbon.test.tsx:11` sigue verde
  porque el `src` no cambió.
- Los triplets están completos, así que el guard de formatos pasa.

Es idéntico a lo de la vez anterior: *"Nothing failed: the triplets were valid, every test
stayed green, and only opening the art file showed it."*

---

## Remediación propuesta

1. **Rescatar los tres iconos nuevos** a su carpeta propia:
   `/art/minigames/{safe-path,knight-tour,promotion-run}.{avif,png,webp}`
2. **Restaurar los sprites** — `git checkout -- apps/web/public/art/redesign/pieces/w-{king,knight,pawn}.*`
3. **Repuntar los tres slots** en `theme-registry.ts:460-470` a `/art/minigames/<id>`.
   No agrega slots: los tres ya existen, sólo cambia su `default` → **los conteos pineados en
   tres lugares no se tocan**.
4. **Cerrar el agujero de raíz:** un test que afirme que **los seis** `hub.minigame.*`
   resuelven bajo `/art/minigames/`. Sin eso, el próximo export vuelve a pisar la pieza.
5. Opcional pero barato: aserción de dimensiones/aspect-ratio sobre `redesign/pieces/*`
   (las piezas son verticales sobre transparente; un tile es 1:1 con marco) — detecta la
   clase entera de error, no este caso puntual.

---

## Remediación APLICADA — 2026-08-22

Ejecutada en el orden TDD: test rojo → fix → verde.

1. **Test primero.** `src/lib/themes/__tests__/minigame-icon-isolation.test.ts` falló
   nombrando la colisión exacta:
   ```
   hub.minigame.safe-path shares /art/redesign/pieces/w-king with board.piece.white.king
   hub.minigame.knight-tour shares /art/redesign/pieces/w-knight with board.piece.white.knight
   hub.minigame.promotion-run shares /art/redesign/pieces/w-pawn with board.piece.white.pawn
   ```
   Afirma dos invariantes: los seis `hub.minigame.*` viven bajo `/art/minigames/`, y
   **ninguno comparte su arte con otro slot**. La segunda es la que importa: la carpeta
   es la convención, el sharing es la falla.
2. **Arte rescatada** — los tres iconos nuevos copiados a
   `/art/minigames/{safe-path,knight-tour,promotion-run}.{avif,png,webp}`, verificados
   byte a byte con `cmp` **antes** de restaurar nada.
3. **Sprites restaurados** — los 9 archivos de `redesign/pieces/w-{king,knight,pawn}`
   confirmados idénticos a `HEAD` con `git show | cmp`, y `w-pawn.png` reabierto: vuelve
   a ser el peón blanco.
4. **Registry repuntado** — `theme-registry.ts:460-478`, con el comentario que explica
   por qué el incidente se repitió y qué test lo impide ahora. No se agregaron slots:
   los tres ya existían, sólo cambió su `default` → **los conteos pineados en tres
   lugares quedan intactos.**

### Verificación

| Qué | Resultado |
|---|---|
| `tsc --noEmit` | limpio |
| Suite de themes (25 archivos) | **168/168** |
| **Suite completa de Vitest** | **714 archivos · 9048 passed, 1 todo — 210 s** |
| Sprites vs `HEAD` | 9/9 idénticos (`cmp`) |
| Sin `pnpm dev` compitiendo | verificado con `pgrep` antes de correr |

El `Error: boom` en la cola del log es el stack deliberado de
`primitive-boundary.test.tsx` (un error boundary probado a propósito), no un fallo.

### Pendiente para el founder

⚠️ **El VR de `hub-clean` puede quedar rojo — y sería correcto.** El baseline en git
fotografía los tiles con los sprites de pieza viejos; el cambio de icono es
**intencional**, así que ahí el regrabado es legítimo. Correrlo con
`--project=minipay --update-snapshots=none` primero para ver **qué** cambió, y sólo
regrabar si el diff es la sección de minijuegos y nada más.
