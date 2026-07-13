# Spec — Arena Matchup Transition ("Get ready!")

**Fecha:** 2026-07-13
**Superficie:** `/arena` (LEARN/PLAY)
**Estado:** propuesto — pendiente de aprobación

## 1. Objetivo

Reemplazar el placeholder de carga entre "PLAY" y el tablero (hoy: un spinner con
"Preparing AI…") por una pantalla de matchup que presenta al rival y al jugador,
al estilo de las pantallas VS de los juegos casuales.

Flujo confirmado con el founder:

```
/arena?fresh=1 → selector de rival → [tap PLAY] → TRANSICIÓN (~1.8s) → tablero
```

## 2. Hallazgo clave: la ranura ya existe

No hay que crear una ruta ni un estado nuevo. `arena/page.tsx` ya tiene:

- `isPreparing` (`page.tsx:289`) — se activa al dar PLAY (`page.tsx:578`).
- Un timer en `useEffect` (`page.tsx:519-526`) que espera **400 ms**, llama a
  `game.startGame()` y baja el flag. Ese `useEffect` tiene una historia:
  el timer vive ahí a propósito porque bajo React Strict Mode el
  mount→cleanup→remount dejaba al usuario colgado en "Preparing AI…" para siempre.
  **No mover el timer fuera del effect.**
- El placeholder se renderiza en **dos ramas** (`page.tsx:1060` scaffold `?arena=new`,
  y `page.tsx:1199` legacy). Ambas deben pasar a usar el mismo componente.

El cambio es: subir el timer 400 → **1800 ms** y sustituir el spinner por la pantalla.

## 3. Datos — todo existe ya, nada que inventar

| Slot | Fuente |
|---|---|
| Rival (nombre, avatar, marco) | `rivalFor(game.difficulty)` → `lib/game/rivals.ts`. Pipo/Mara/Kairo, `frame` blue/silver/gold |
| Avatar del rival | `/art/rivals/<avatar>-avatar.{avif,webp,png}` (ya en `public/`) |
| Nombre del jugador | `identity-lite.ts` → `formatNicknameCompact()` ("Knight #3842") + tokens de `use-nickname-tokens.ts` |
| Avatar del jugador | `avatar-pro` si es PRO, si no `avatar-lite-hub` |
| Fuente | `--font-game-action` (resuelve a Rowdies, ya cargada en `layout.tsx:25`) |

**Etiqueta del jugador:** `You` como línea principal (Rowdies, tamaño mayor) y el
nickname determinístico debajo en tamaño menor. Si el nickname pasa de 14 chars,
se trunca con ellipsis vía CSS. Decisión del founder: "combinación de YOU + nombre
determinístico", no la address.

## 4. Asset

`design/mini-tour/bg-play-chess-transicion.png` (2.2 MB, 936×1664) — **no se usa crudo**.
Se optimiza a `apps/web/public/art/arena/bg-matchup.{avif,webp,png}` con el mismo
pipeline que el resto de `public/art/**`. Prohibido upscalear.

El BG **ya trae** el escudo VS centrado y un separador de peón dorado abajo
(~80% de la altura). Por lo tanto **no dibujamos un VS propio** — solo posicionamos
encima. Cero SVG nuevos.

## 5. Layout (390px de ancho, mobile-first)

```
┌─────────────────────────┐
│                         │
│   [ cinta rival ]       │  ← top ~14%, avatar dentro del banner
│      Kairo              │  ← Rowdies, nombre bajo la cinta
│                         │
│         ⚔ VS ⚔          │  ← ya viene en el BG, ~50%
│                         │
│   [ cinta jugador ]     │  ← bottom, avatar dentro del banner
│      You                │  ← Rowdies
│      Knight #3842       │  ← nickname, más chico
│                         │
│      Get ready!         │  ← justo ENCIMA del peón del BG (~78%)
│  ─────── ♟ ───────      │  ← peón: ya viene en el BG
└─────────────────────────┘
```

Riesgo de layout conocido: la cinta del jugador y "Get ready!" compiten por la zona
inferior. "Get ready!" se ancla al peón (`bottom: ~20%`) y la cinta del jugador queda
por encima. Si a 390px se solapan, la cinta sube; el peón no se mueve porque es parte
del BG.

## 6. Animación

- Entrada: cinta del rival entra desde la izquierda, la del jugador desde la derecha
  (~300 ms, escalonadas). "Get ready!" hace fade+pop al final.
- Salida: fade a tablero.
- `prefers-reduced-motion`: sin desplazamiento, solo fade; el timer se mantiene en
  1800 ms para no romper la expectativa de ritmo (no es un loader real).
- Sin tap-to-skip (decisión del founder: auto).

## 7. Estados y edge cases

| Caso | Comportamiento |
|---|---|
| Nickname aún no hidratado (guest/wallet cargando) | Mostrar solo "You"; el nickname aparece si llega antes del corte. Sin layout shift: el slot reserva altura fija. |
| Usuario da back durante la transición | `handleBack` limpia y sale; el `clearTimeout` del effect ya cubre el unmount. |
| Strict Mode doble mount | Cubierto por el effect existente — **no tocar esa estructura**. |
| Rama `?arena=new` vs legacy | Mismo componente en ambas; el spec no cambia el flag. |

## 8. Plan de implementación (SDD → TDD → EDD)

1. **Tipos** — `ArenaMatchupTransitionProps` (rival, playerLabel, playerNickname,
   playerAvatarSrc, reducedMotion).
2. **Tests (rojo)** — render del componente: nombre del rival, "You", nickname,
   "Get ready!", avatares con `alt`; truncado del nickname largo; sin animación
   bajo reduced-motion.
3. **Componente** — `components/arena/arena-matchup-transition.tsx`.
4. **CSS** — clases nuevas en `globals.css` (único archivo CSS del app).
5. **Wiring** — sustituir el placeholder en las dos ramas; timer 400 → 1800 ms.
6. **Assets** — optimizar el BG a `public/art/arena/`.
7. **VR** — snapshot Playwright de la transición.

## 9. Preguntas cerradas (founder, 2026-07-13)

- **"Play again" también pasa por la transición.** Resultó no requerir código:
  `handlePlayAgain` hace `game.reset()`, que devuelve al selector, y el único
  camino al tablero es PLAY → `isPreparing`. La consistencia sale por construcción.
- **"Get ready!" se localiza.** `getReady` + `you` agregados a `editorial.ts` (EN)
  y `messages/es.ts` ("¡Prepárate!" / "Tú").

## 10. Correcciones que salieron de la verificación visual

Tres cosas que el spec no anticipó y que solo aparecieron al manejar el flujo real:

1. **El dock se colaba.** `PersistentDock` es *hermano* del selector, no hijo. Al
   renderizar la transición dentro de la rama del selector, el dock seguía en
   pantalla; y al sacarla de flujo (`position: fixed`) el `<main>` quedó con altura
   cero y el dock **flotó al tope**. Solución: la transición hace **early return**
   antes de las ramas del selector — es dueña de la pantalla completa.
2. **Los avatares de rival no son bustos recortados**, son ilustraciones cuadradas
   con su propio fondo. No pueden "asomar" sobre la cinta como en la referencia; van
   enmarcados **dentro** de la cinta, con el nombre al lado.
3. **El jugador cambiaba de cara.** El HUD del tablero usa
   `/art/new-icons-chesscito/avatar-blue.png` (lobo coronado, `PlayerAvatar`
   variant="you"). La transición ahora usa ese mismo asset.
