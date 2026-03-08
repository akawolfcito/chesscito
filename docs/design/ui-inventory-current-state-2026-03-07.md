# UI Inventory (Current State) - 2026-03-07

Este documento lista solo los elementos que existen hoy en la UI.

## Rutas/pantallas activas
- `/` Home
- `/play-hub` Play Hub
- `/leaderboard` Leaderboard
- `/tx-lab` Tx Lab (herramienta de pruebas)

## Navegación global (header)
- Componente `Navbar` sticky en todas las rutas.
- Links principales:
  - `Home` -> `/`
  - `Play Hub` -> `/play-hub`
  - `Leaderboard` -> `/leaderboard`
- Botón/contenido de wallet (`ConnectButton`):
  - Estado `MiniPay detected`
  - Estado `Open in MiniPay` (link externo a docs de Celo)
  - Estado RainbowKit connect (cuando hay provider)
- Menú móvil (hamburger):
  - Toggle `Menu/X`
  - Panel dropdown con los 3 links + wallet
  - Backdrop para cerrar

## Pantalla `/` (Home)
- Shell con:
  - Eyebrow: `MiniPay MiniApp`
  - Título: `Chesscito`
  - Descripción corta del producto
- 3 cards informativas:
  - `Focus`
  - `Proof`
  - `Mode`
- CTAs:
  - `Entrar al Play Hub`
  - `Leaderboard`

## Pantalla `/play-hub` (principal de juego)

### Bloque superior (Mission Panel)
- Label superior: `Arcane Play Hub`
- Título: `Realm Tactics Console`
- Texto descriptivo de misión
- Selector de pieza (chips/botones):
  - `Torre` (habilitado)
  - `Alfil` (deshabilitado)
  - `Caballo` (deshabilitado)
- Caja de objetivo:
  - Texto: `Objetivo: capturar h1 en un movimiento.`
- Board embebido
- Mensaje contextual por estado:
  - `ready` (instrucción)
  - `failure` (jugada incorrecta)
  - `success` (objetivo completado)

### Board (dentro de Mission Panel)
- Grid 8x8 interactivo
- Pieza actual: Torre
- Objetivo visible: `h1`
- Card informativa `Piece`
- Card informativa `Target square`

### Panel inferior fijo (acciones + estado)
- Sección de métricas (4 cards):
  - `Score`
  - `Time`
  - `Level`
  - `Moves`
- `QA mode` (visible cuando `NEXT_PUBLIC_QA_MODE=1`):
  - `Level ID override` input numérico
  - Mensaje de validez/invalidez
- Botones principales:
  - `Claim badge`
  - `Guardar score`
- Botones secundarios:
  - `Store`
  - `Leaderboard`
  - `Reset board`

### Estado y feedback de transacciones
- Bloque de estado:
  - `Estado` wallet/red
  - `Chain`
  - `Mision`
  - `Badge`
- Cards de feedback transaccional (`TxFeedbackCard`):
  - Submit: pendiente / éxito
  - Claim: pendiente / éxito
  - Compra: pendiente / éxito
  - Error genérico
- Enlace por tx hash a Celoscan (cuando existe hash)

### Overlays/Sheets en `/play-hub`
- `ShopSheet` (bottom sheet):
  - Título `Arcane Store (USDC)`
  - Lista de ítems con:
    - label, subtitle, precio, estado
    - botón `Comprar`
- `LeaderboardSheet` (bottom sheet):
  - Título `Hall of Rooks`
  - Filas rank/player/score
  - Link `Ver leaderboard completo`
- `PurchaseConfirmSheet` (bottom sheet):
  - Título `Confirmar compra`
  - Detalle item, precio, estado, chain, direcciones
  - Botón `Confirmar compra`
  - Estados del botón: `Aprobando USDC...` / `Comprando...`

## Pantalla `/leaderboard`
- Shell con:
  - Eyebrow `Leaderboard`
  - Título `Top 10`
  - Descripción
- Lista mock de filas con:
  - rank
  - player
  - time
  - score
- CTAs:
  - `Volver al Play Hub`
  - `Inicio`

## Pantalla `/tx-lab`
- Título `Tx Lab (MiniPay / Sepolia)`
- Bloque de contexto:
  - chain actual
  - scoreboard address
  - badges address
  - feeCurrency
- Botones:
  - `Probe estimate/call errors`
  - `A) sendTransaction minimal`
  - `B) minimal + feeCurrency`
  - `C) with gasPrice x1.25`
- Secciones de salida:
  - `Last payload`
  - `Last probe result`
  - `Last tx result (txHash/error)`
