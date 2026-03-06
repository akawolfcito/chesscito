# Prompt para Figma Designer (solo campos esperados)

Diseña un rediseño completo de la MiniApp **Chesscito** para mobile-first (MiniPay), manteniendo el alcance funcional actual.

## Instrucciones clave

- No propongas arquitectura técnica ni cambios de contrato.
- No definas layout/composición visual obligatoria.
- Enfócate solo en **qué información y qué acciones deben existir** por pantalla.
- Considera estados: `loading`, `success`, `error`, `disabled`, `empty`.
- Todas las acciones on-chain deben contemplar: `wallet no conectada`, `red incorrecta`, `tx pendiente`, `tx confirmada`, `tx fallida`.

## Pantallas y campos requeridos

### 1) Home (`/`)
- Nombre del producto/app.
- Propuesta de valor breve.
- CTAs principales:
  - Ir a niveles.
  - Ir a Play Hub.
  - Ir a Leaderboard.
- Estado de conexión wallet (conectada/no conectada).
- Red activa (chain id / nombre de red).

### 2) Levels (`/levels`)
- Listado de niveles/piezas disponibles.
- Por cada nivel:
  - `levelId`
  - nombre de pieza
  - dificultad/estado (disponible, próximamente, bloqueado).
- CTA para iniciar nivel seleccionado.

### 3) Play Piece (`/play/[piece]`)
- Identificador de pieza/nivel activo.
- Objetivo del reto.
- Tablero interactivo.
- Métricas de partida:
  - movimientos
  - tiempo transcurrido
  - score local.
- Estados de partida:
  - listo
  - éxito
  - fallo.
- CTA continuar a resultado.

### 4) Result (`/result`)
- Resumen del intento:
  - pieza
  - score
  - movimientos
  - tiempo
  - estado del reto.
- Estado de badge:
  - ya reclamado / no reclamado.
- Acciones on-chain:
  - `Enviar puntaje on-chain`
  - `Reclamar badge`.
- Feedback de transacción:
  - hash
  - enlace a explorer
  - estado (pendiente/confirmada/fallida)
  - mensaje de error legible.
- Bloque de diagnósticos opcional para QA (modo técnico).

### 5) Play Hub (`/play-hub`)
- Selector de pieza.
- Panel de reto rápido:
  - objetivo
  - score
  - tiempo
  - movimientos
  - estado del reto.
- Acciones on-chain:
  - submit score
  - claim badge.
- Módulo tienda:
  - lista de ítems
  - `itemId`
  - nombre
  - descripción corta
  - precio en USDC
  - disponibilidad (`enabled/disabled`).
- Flujo compra:
  - selección de item
  - cantidad
  - total
  - confirmación previa a firma
  - tx hash + explorer link.
- Leaderboard resumido (top filas).
- Errores y advertencias:
  - allowance insuficiente
  - red incorrecta
  - contrato no configurado.

### 6) Leaderboard (`/leaderboard`)
- Tabla/lista de entradas:
  - posición
  - wallet abreviada
  - score
  - tiempo.
- Filtros mínimos:
  - por nivel/pieza
  - por período (si aplica).
- Estado vacío y estado de error.

### 7) Tx Lab (`/tx-lab`) [QA interno]
- Datos de contexto:
  - chain actual
  - addresses activas (Badges/Scoreboard)
  - feeCurrency configurada.
- Acciones de prueba:
  - probe estimate/call
  - matrix A/B/C de envío.
- Salidas de depuración:
  - último payload
  - último resultado de probe
  - último resultado de tx (hash/error).

## Componentes transversales (presentes donde aplique)

- Banner de estado de wallet/red.
- Componente de error reusable con código + mensaje humano.
- Componente de éxito de transacción con hash y deep link a explorer.
- Indicadores de carga para firmas backend y para confirmación on-chain.
- Textos de seguridad para firma/confirmación (qué está autorizando el usuario).

## Campos de datos on-chain que deben estar contemplados en UX copy

- `player`
- `levelId`
- `score`
- `timeMs`
- `nonce`
- `deadline`
- `itemId`
- `quantity`
- `unitPrice`
- `totalPrice`
- `paymentToken` (USDC)
- `treasury`
- `txHash`

