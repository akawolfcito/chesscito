# Spec — Obstacle art + tx celebration + Save-On-Chain discoverability

Branch: `feat/obstacle-art-celebration-onchain-discoverability` (desde `main`).
Fecha: 2026-07-23. Entrega: commits atómicos en la misma rama.

Fuente de verdad única para "hay algo pendiente de guardar on-chain": `canSaveOnChain`
(`exercises-screen.tsx:1289`, `deriveCanSaveOnChain`). Es la señal que alimenta los 3 dots
de la Tarea 3 y la que ya gatea el botón "Save proof" del modal MISSION.

---

## Tarea 1 — Arte de obstáculo (piedra) en ejercicios

**Objetivo:** reemplazar el caballo blanco que hoy representa el obstáculo por la piedra
`obstaculo1.png` (64×69). Solo ejercicios. Sin tocar lógica ni distribución. Registrarlo
en el theme-builder como slot propio.

**Estado actual:** el obstáculo se pinta con `pieceAssets.w.knight` en 2 renderers:
- `board.tsx:471` (`blockerSrc = pieceAssets.w.knight`, triplete avif/webp/png, `.is-friendly-blocker`).
- `diagonal-run-board.tsx:69` (`knightSrc`, solo png).
(En modo `labyrinth` el obstáculo NO es caballo — no se toca.)

**Cambios:**
1. Mover asset → `apps/web/public/art/redesign/blocker-stone.png` (png único, sin upscalear;
   no generar avif/webp — se sirve png-only como ya hace diagonal-run).
2. Registrar slot en `theme-registry.ts`:
   - Nueva key en la unión `ThemeAssetKey` (~:288): `"board.blocker.stone"`.
   - Entrada en `THEMES["candy-forest"].assets`: `{ default: "/art/redesign/blocker-stone",
     format: "png", usedIn: [...], exactSize: {w:64,h:69} }` (patrón de los slots single-file).
   - Clasificarlo en la lista de superficie del board (junto a los `board.piece.*`) para que
     NO caiga en `unknown`.
3. Hook de consumo: usar `useThemeAsset("board.blocker.stone")` (o el hook equivalente que ya
   usa el board) en `board.tsx` y `diagonal-run-board.tsx`, reemplazando el `pieceAssets.w.knight`
   del obstáculo. Render png-only (`<img src={`${stone}.png`} .../>`), conservando clase
   `.is-friendly-blocker` y `pointerEvents:"none"`.

**Commit:** `feat(exercises): replace knight obstacle art with stone, registered in theme builder`

---

## Tarea 2 — Celebración al confirmar una transacción (todas las tx)

**Objetivo:** confeti/serpentinas reusando `ConfettiBurst`, en la **parte superior** de la
pantalla, inmediatamente tras confirmar CUALQUIER tx on-chain exitosa.

**Estado actual:** `ConfettiBurst` (`confetti-burst.tsx:65`) ya existe (render puro, sin lib).
Las 3 tx confirmadas (score save, badge claim, shop buy) fijan `resultOverlay` → se renderiza
`ResultOverlay` (`result-overlay.tsx:237`). Ninguna rama monta confeti hoy.

**Cambios:**
1. Añadir un contenedor top-anchored de confeti (fixed, top:0, full-width, `pointer-events:none`,
   z alto) que monte `<ConfettiBurst />` en las ramas de éxito de `ResultOverlay`
   (variants `score` :306, `badge`/`shop` :404). Un solo punto de inserción cubre las 3 tx.
   - Clase nueva en `globals.css` p.ej. `.tx-celebration-top` para el anclaje superior.
2. Verificar que shop-buy efectivamente renderiza `ResultOverlay` (variant shop). Si algún
   flujo de tx NO pasa por `ResultOverlay`, enganchar ahí también.

**Commit:** `feat(exercises): confetti celebration on confirmed on-chain transactions`

---

## Tarea 3 — Descubribilidad de Save-On-Chain

Reusar dot titilante `PinStatusMarker status="pending"` (`pin-status-marker.tsx:16`,
CSS `.action-pin-notif`) — el mismo del DAILY. Host debe ser `position:relative`.
Señal para los 3 dots: `canSaveOnChain`.

### 3.1 Dots titilantes (guían hacia el guardado)
- **Botón Missions** (`mission-panel-candy.tsx:567` `mission-band`): añadir `relative` al button +
  `<PinStatusMarker status="pending" />` cuando `canSaveOnChain`. Pasar la señal como prop a
  `MissionPanelCandy`.
- **Icono LEADERS del dock** (`persistent-dock.tsx` `SideItem` :183, item `leaderboard` :142):
  pasar prop `leaderboardPending` a `PersistentDock`; renderizar `PinStatusMarker` dentro del
  button solo si `item.id === "leaderboard"` y pending. Contenedor a `position:relative`.
- **Bloque own-row en Leaders** (`leaderboard-sheet.tsx:359`): dot pending sobre la fila cuando
  pending (ver 3.2).

### 3.2 Bloque score/wallet de LEADERS = CTA principal
- Convertir el `<div data-testid="leaderboard-own-row">` (`leaderboard-sheet.tsx:359-382`) en
  `<button>` (o wrapper con `onClick`) que dispare `onSaveOnChain`.
  - Estados: si `ownRow.hasOnchain` (ya guardado) → no-CTA (o estado "saved", sin dot).
    Si `canSaveOnChain` → CTA activo + dot + affordance visual de botón (no dato estático).
    Si `isSavingOnChain` → loading/disabled.
- Pasar props a `LeaderboardSheet` (`exercises-screen.tsx:4129`), replicando el wiring del
  MISSION modal (`:3414-3416`): `canSaveOnChain`, `onSaveOnChain={() => void handleSaveScoreOnChain()}`,
  `isSavingOnChain={saveWrite.isBusy}`. Reusa EXACTAMENTE `handleSaveScoreOnChain` (`:2298`).
- Missions queda como acceso **secundario** (no se elimina su botón "Save proof").

**Commits:**
- `feat(hud): notification dot on Missions + Leaders dock icon for pending on-chain save`
- `feat(leaderboard): make own-rank block a Save-On-Chain CTA (primary entry point)`

---

## Verificación
- Typecheck: `pnpm exec tsc --noEmit`.
- Tests: suite Vitest afectada (mission-panel, leaderboard-sheet, result-overlay, board).
  El mock `ConfettiBurst: () => null` ya existe en `phase-flash.test.tsx` — replicar en tests
  nuevos que monten ResultOverlay si hace falta.
- VR: los baselines de board (obstáculo), MISSION modal, Leaders sheet y dock cambiarán —
  regenerar y revisar que la foto sea correcta (no una foto de error de Next).

## Open questions
- ¿El slot de piedra va en superficie LEARN o en una nueva categoría "board/blocker"? (propongo
  clasificarlo junto a los `board.piece.*`).
- ¿El CTA de Leaders debe mostrar algún micro-texto ("Tap to save on-chain") o solo el
  affordance visual + dot? (propongo micro-label corto para claridad).
