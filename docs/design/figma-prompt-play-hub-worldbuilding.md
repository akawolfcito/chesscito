# Prompt para Figma Designer: Play Hub (Single-Screen, Diegetic / Worldbuilding)

Diseña una versión rediseñada de la experiencia **Play Hub** como una sola pantalla principal de juego, con interacciones secundarias mediante capas superpuestas (modales, sheets, overlays o paneles contextuales).

## Objetivo

- Mantener toda la experiencia funcional en una sola pantalla base.
- Permitir que acciones secundarias se resuelvan en superposiciones sin sacar al usuario del contexto principal.
- Enfocar el lenguaje visual hacia **worldbuilding / diegetic UI**, sin perder claridad de producto.

## Restricciones de diseño

- No asumir la composición actual.
- No reutilizar obligatoriamente la jerarquía visual actual.
- No cambiar la funcionalidad esperada.
- No eliminar estados de error, loading, pending y confirmación.

## Elementos que deben existir en la pantalla base

- Contexto del juego activo (pieza/nivel actual).
- Área de tablero jugable.
- Estado de partida (ready/success/failure).
- Métricas de sesión visibles:
  - score
  - tiempo
  - movimientos
- Acciones principales on-chain:
  - reclamar badge
  - enviar score
- Acciones de sistema:
  - reset de intento
  - acceso a tienda
  - acceso a leaderboard
- Estado de wallet/red:
  - conectado/no conectado
  - red correcta/incorrecta
- Estado de transacciones:
  - última tx hash (si existe)
  - errores legibles (si existen)

## Superposiciones / capas esperadas

### 1) Capa de tienda
- Lista de ítems.
- Por ítem:
  - itemId
  - nombre
  - descripción corta
  - precio
  - disponibilidad (configurado, habilitado/deshabilitado)
- Acción de compra.

### 2) Capa de confirmación de compra
- Resumen de item seleccionado.
- Precio unitario y total.
- Token de pago.
- Dirección de shop (referencia técnica).
- Dirección de token (referencia técnica).
- Estado de compra:
  - aprobando (si aplica)
  - comprando
  - éxito
  - error

### 3) Capa de leaderboard
- Lista resumida de posiciones.
- wallet abreviada
- score
- tiempo
- CTA para vista completa.

## Estados funcionales mínimos que el diseño debe contemplar

- Wallet no conectada.
- Red no soportada o no configurada.
- Contrato sin dirección.
- Nivel no válido.
- Badge ya reclamado.
- Allowance insuficiente (flujo approve + compra).
- Transacción enviada, pendiente, confirmada, fallida.
- Modo MiniPay vs navegador normal.

## Copy/UI hints (sin imponer estilo)

- Microcopy contextual para explicar por qué algunas acciones requieren más de una firma.
- Señales claras de cuándo una acción impacta on-chain.
- Feedback inmediato después de cada acción crítica.

## Entregables esperados del rediseño

- 1 pantalla base de Play Hub.
- Variantes de estado de la pantalla base.
- Variantes de cada capa superpuesta (tienda, confirmación, leaderboard).
- Estados de loading/error/success para acciones on-chain.

