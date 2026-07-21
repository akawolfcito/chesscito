---
title: Auditoría adversarial de entitlements entre Preview y localhost
date: 2026-07-19
status: ready
type: diagnostic-audit-task
scope: PLAY, LEARN, effective Training Pass y assets visuales PRO
execution_mode: read-only
---

# Auditoría adversarial de entitlements entre Preview y localhost

## Mandato

Realizar una auditoría adversarial y exclusivamente diagnóstica sobre una discrepancia de entitlements entre Preview y localhost en Chesscito.

### Prohibiciones absolutas

- No implementar cambios.
- No limpiar datos.
- No modificar variables de entorno.
- No resetear perfiles.
- No crear commits.
- No tocar NFT ni datos mainnet.

Primero se debe inspeccionar el código y presentar evidencia verificable. Si algo no puede confirmarse estáticamente, debe marcarse como hipótesis e indicar la evidencia runtime necesaria.

## Contexto de producto

Chesscito tiene dos aplicaciones o superficies.

### PLAY

- PRO Subscription: USD 1.99 por 30 días.
- PRO puede activar assets visuales diferenciados.
- PRO incluye acceso efectivo al Training Pass de LEARN.

### LEARN

- Season Pass directo: USD 0.99 por 21 días.
- La compra directa entrega +3 Shields.
- PRO también desbloquea el contenido `training_pass`.
- Tener Season Pass directo no debe implicar automáticamente ser PRO.
- Tener acceso efectivo al Training Pass no debe activar por sí solo los assets visuales PRO.
- Solo una suscripción PRO real debe activar los assets PRO, salvo que exista una regla explícita documentada diferente.

### Wallets y dispositivos

MiniPay permite una única wallet por dispositivo:

- Android: `wallet1`.
- iPhone: `wallet2`.

No se están intercambiando wallets dentro de un mismo dispositivo.

### Hosts relevantes

- PLAY Preview: `https://preview.chesscito.com`.
- LEARN Preview: `https://learn-preview.chesscito.com`.
- Localhost: el mismo código reciente se prueba alternando entre PLAY y LEARN.

El código desplegado en Preview y el usado en localhost deberían ser esencialmente equivalentes, pero los estados resueltos son contrarios.

## Escenario A — iPhone / wallet2

### Preview

PLAY en `preview.chesscito.com`:

- No muestra PRO activo.

LEARN en `learn-preview.chesscito.com`:

- Sí muestra un Season Pass directo activo.
- Este Season Pass fue comprado durante pruebas anteriores.
- El estado directo del Season Pass coincide con lo esperado.

### Localhost con la misma wallet2

PLAY local:

- Muestra PRO activo.
- Indica aproximadamente `1D` restante.

LEARN local:

- Muestra Season Pass directo activo.
- Además muestra assets visuales PRO.

### Inconsistencia

- Preview afirma que wallet2 no tiene PRO.
- Localhost afirma que wallet2 sí tiene PRO por aproximadamente un día.
- LEARN local activa assets PRO aunque el entitlement legítimo conocido de wallet2 es el Season Pass directo.

### Estado esperado para wallet2

- `hasPro = false`.
- `hasDirectSeasonPass = true`.
- `effectiveTrainingPass = active`.
- `effectiveTrainingPassSource = direct/season_pass`.
- Assets PRO: `false`.
- Copy de LEARN: Season Pass activo, no “incluido con PRO”.

## Escenario B — Android / wallet1

### Preview

PLAY en `preview.chesscito.com`:

- Sí muestra PRO activo.

LEARN en `learn-preview.chesscito.com`:

- No muestra Season Pass directo comprado.
- Indica `Beneficio PRO incluido`.
- Muestra los assets visuales PRO.

Este comportamiento es coherente.

### Localhost con la misma wallet1

PLAY local:

- Indica que no tiene PRO.

LEARN local:

- Parece no tener Season Pass directo.
- Sí indica `Beneficio PRO incluido`.
- No muestra los assets visuales PRO.

### Inconsistencia

- PLAY local considera que wallet1 no tiene PRO.
- LEARN local parece reconocer acceso efectivo proveniente de PRO.
- La capa visual no reconoce PRO y no activa los assets.
- Copy, entitlement efectivo y assets visuales parecen usar fuentes diferentes.

### Estado esperado para wallet1

- `hasPro = true`.
- `hasDirectSeasonPass = false`.
- `effectiveTrainingPass = active`.
- `effectiveTrainingPassSource = pro`.
- Assets PRO: `true`.
- Copy de LEARN: `Beneficio PRO incluido`.

## Hecho ya validado y fuera de investigación

El vertical slice de Knight’s Tour funciona correctamente:

- Sin entitlement, las variantes premium se bloquean.
- Season Pass directo las desbloquea.
- PRO las desbloquea.
- La variante base permanece disponible.
- Los Tours otorgan cero estrellas.

No auditar ni modificar Knight’s Tour, salvo que sea indispensable para rastrear qué entitlement recibe.

El problema está en la resolución y presentación de:

- PRO real.
- Season Pass directo.
- Training Pass efectivo.
- Source del entitlement.
- Copy.
- Assets visuales PRO.
- Diferencias entre Preview y localhost.

## Objetivo de la auditoría

Determinar por qué la misma wallet produce estados contrarios entre Preview y localhost y por qué algunas capas de UI muestran resultados internamente inconsistentes.

Se debe reconstruir la cadena completa:

```text
wallet/provider
→ wallet normalizada
→ chain/network
→ host/environment
→ endpoint/backend
→ respuesta remota
→ cache/query
→ hasPro
→ direct Season Pass
→ effective Training Pass
→ effective source
→ copy mostrado
→ selección de assets DEFAULT/PRO
```

No presuponer que existe una sola causa. Buscar causas independientes para PLAY, LEARN y Theme Builder/runtime assets.

## Investigación obligatoria

### 1. Identidad y wallet

Localizar cómo cada superficie obtiene y normaliza la wallet:

- MiniPay provider.
- wagmi/viem.
- Wallet context.
- Cookies.
- Query params.
- Fallback guest identity.
- Cuenta persistida.

Verificar si todas las consultas usan la wallet actual normalizada. Comprobar especialmente:

- Casing.
- Wallet anterior retenida.
- Provider anterior.
- Hydration.
- Race conditions.
- Cambios de wallet.
- Query keys que no incluyan la wallet.
- Estados globales compartidos entre PLAY y LEARN local.

### 2. PRO real

Encontrar todas las fuentes que pueden responder si un usuario tiene PRO:

- Hooks.
- Resolvers.
- Endpoints.
- RPC.
- Supabase.
- Redis.
- Contratos.
- `localStorage`.
- Cookies.
- Variables de entorno.
- Mocks.
- Fixtures.
- Dev allowlists.
- Fallbacks.

Identificar la ubicación exacta que produce el estado visible `PRO 1D` y explicar si ese valor proviene de:

- Timestamp remoto.
- TTL de Redis.
- Cálculo local.
- Fixture.
- Fallback.
- Valor hardcodeado.
- Entitlement stale.

### 3. Season Pass directo

Reconstruir cómo LEARN determina:

- Compra directa activa.
- Expiración.
- Bonus de Shields.
- Source directo.
- Estado loading/error/inactive.

Verificar si Preview y localhost consultan el mismo backend y la misma chain.

### 4. Effective Training Pass

Localizar el resolver efectivo compartido y documentar:

- Inputs.
- Precedencia entre Season Pass directo y PRO.
- Output.
- Source.
- Loading.
- Expiry.
- Cache.
- Refresh.

Verificar si `effectiveTrainingPass = true` puede existir mientras `hasPro = false`.

Determinar cuándo esto es válido —Season Pass directo activo— y cuándo sería inconsistente —`source = pro` pero `hasPro = false`—.

### 5. Copy `Beneficio PRO incluido`

Encontrar la condición exacta que muestra ese texto. Confirmar si depende de:

- `hasPro`.
- `effectiveTrainingPass`.
- `effectiveTrainingPass.source`.
- Ausencia de compra directa.
- Un flag persistido.
- Una condición visual separada.

Verificar si puede mostrar “incluido por PRO” aunque el source real no sea `pro`.

### 6. Assets visuales PRO

Encontrar la condición exacta que selecciona:

- DEFAULT assets.
- PRO assets.
- `inherit`.
- `none`.

Determinar si depende de:

- `hasPro`.
- `effectiveTrainingPass`.
- Source del entitlement.
- Modo PLAY/LEARN.
- Theme Builder.
- Tema persistido.
- `localStorage`.
- Cookie.
- URL.
- Environment flag.
- Un hook diferente.

Verificar explícitamente esta regla:

- El Season Pass directo desbloquea contenido `training_pass`.
- El Season Pass directo no activa assets PRO.
- PRO real sí activa assets PRO.

Reportar cualquier lugar donde Training Pass y PRO visual se traten como sinónimos.

### 7. Diferencias de entorno

Comparar las variables y endpoints efectivos usados por:

- PLAY Preview.
- LEARN Preview.
- PLAY localhost.
- LEARN localhost.

Incluir:

- API base URL.
- Supabase URL/project.
- Redis/API proxy.
- Chain ID.
- RPC URL.
- Contract addresses.
- Entitlement endpoints.
- Feature flags.
- PRO overrides.
- Mocks.
- Theme Builder config.
- Flags preview/prod/local.

No exponer secretos. Reportar únicamente nombres de variables, presencia, destino no sensible y diferencias.

### 8. Caches y persistencia

Enumerar todas las capas persistidas por origin:

- `localStorage`.
- `sessionStorage`.
- IndexedDB.
- Cache Storage.
- Service worker.
- Cookies.
- Zustand/Redux persistido.
- React Query.
- SWR.
- Cache del browser/provider.

Para cada capa indicar:

- Clave.
- Contenido.
- Wallet asociada.
- TTL.
- Invalidación.
- Si Preview y localhost usan orígenes separados.
- Si cambiar de wallet invalida el valor.
- Si alternar PLAY/LEARN reutiliza el valor.

### 9. Fallbacks y errores

Buscar fallbacks permisivos o de desarrollo:

- `isDevelopment`.
- `localhost`.
- `NODE_ENV`.
- `forcePro`.
- `mockPro`.
- `devPro`.
- `preview`.
- `fallback`.
- `cached ?? true`.
- Respuestas ante timeout/error.
- Estados que conviertan `unknown` en `active`.

Confirmar si una consulta fallida puede producir:

- PRO activo.
- PRO por un día.
- `source = pro`.
- Assets PRO.
- `Beneficio PRO incluido`.

### 10. Reset profile

Documentar exactamente qué elimina el reset actual:

- Progreso local.
- Milestones.
- Focus Passport.
- Achievements.
- Caches.
- Season Pass.
- PRO.
- Redis.
- Backend.
- NFT/on-chain data.

Explicar por qué un reset de perfil no debe usarse como solución antes de identificar la fuente.

## Pruebas estáticas y reproducción

Sin modificar código, construir pasos de reproducción para los dos escenarios.

### A. wallet2 / iPhone

1. Preview PLAY sin PRO.
2. Preview LEARN con Season Pass directo.
3. PLAY local con PRO `1D`.
4. LEARN local con Season Pass y assets PRO.

### B. wallet1 / Android

1. Preview PLAY con PRO.
2. Preview LEARN incluido por PRO y con assets PRO.
3. PLAY local sin PRO.
4. LEARN local incluido por PRO pero sin assets PRO.

## Instrumentación DEV propuesta, sin implementar

Proponer una instrumentación mínima que permita observar en una única pantalla o consola:

- Host.
- Environment.
- Wallet raw.
- Wallet normalizada.
- Chain ID.
- PRO status.
- PRO source.
- PRO expiry.
- Direct Season Pass status.
- Direct expiry.
- Effective Training Pass.
- Effective source.
- Effective expiry.
- Visual PRO status.
- Selected theme variant.
- Endpoints consultados.
- Estados loading/error.

No implementar esta instrumentación durante la auditoría diagnóstica.

## Entregable obligatorio

Crear un informe diagnóstico con las siguientes secciones.

### 1. Resumen ejecutivo

Sintetizar discrepancias, hallazgos confirmados, hipótesis restantes y nivel de confianza.

### 2. Matriz observada

| Wallet | Host | hasPro | directPass | effectivePass | effectiveSource | visualPro | Copy |
|---|---|---|---|---|---|---|---|
| wallet1 | PLAY Preview | | | | | | |
| wallet1 | LEARN Preview | | | | | | |
| wallet1 | PLAY localhost | | | | | | |
| wallet1 | LEARN localhost | | | | | | |
| wallet2 | PLAY Preview | | | | | | |
| wallet2 | LEARN Preview | | | | | | |
| wallet2 | PLAY localhost | | | | | | |
| wallet2 | LEARN localhost | | | | | | |

### 3. Tabla de fuentes de verdad

| Estado | Función/hook | Endpoint/origen | Query/cache key | TTL | Consumidores |
|---|---|---|---|---|---|
| PLAY PRO | | | | | |
| Direct Season Pass | | | | | |
| Effective Training Pass | | | | | |
| Effective source | | | | | |
| “Included with PRO” | | | | | |
| PRO assets | | | | | |

### 4. Comparación de configuración

| Superficie | API/backend | Chain | PRO resolver | Pass resolver | Visual resolver |
|---|---|---|---|---|---|
| PLAY Preview | | | | | |
| LEARN Preview | | | | | |
| PLAY localhost | | | | | |
| LEARN localhost | | | | | |

### 5. Cadenas de resolución

Documentar la cadena completa, separadamente, para wallet1 y wallet2.

### 6. Hallazgos confirmados

Cada hallazgo debe incluir archivo y línea, evidencia, impacto y nivel de confianza.

### 7. Hipótesis descartadas

Indicar evidencia que permitió descartar cada hipótesis.

### 8. Causas raíz o hipótesis restantes

Ordenarlas por probabilidad e incluir para cada una:

- Evidencia.
- Escenarios que explica.
- Escenarios que no explica.
- Forma de confirmarla.

### 9. Claves de storage/cache potencialmente eliminables

Listar las claves que podrían borrarse de forma segura e individual, pero no borrarlas.

### 10. Propuesta de fix mínimo

Separar la propuesta por cada causa raíz. No implementar ningún fix durante esta tarea.

### 11. Riesgos de regresión

Cubrir PLAY, LEARN, Season Pass directo, PRO real, Training Pass efectivo, copy, assets y cambios de wallet/host.

### 12. Plan de pruebas posterior al fix

Definir casos unitarios, integración, runtime y matriz Preview/localhost para ambas wallets.

## Reglas de ejecución y evidencia

- No asumir que es “solo caché”.
- No asumir que Preview y localhost usan el mismo backend.
- No confundir Training Pass efectivo con PRO real.
- No confundir acceso a contenido premium con selección visual PRO.
- No modificar código.
- No borrar datos.
- No cambiar entitlements.
- No resetear perfiles.
- No tocar NFT ni datos mainnet.
- No generar commit.
- Citar siempre archivo y línea para cada hallazgo.
- Separar evidencia estática, evidencia runtime e inferencias.
- Marcar como hipótesis todo lo que no pueda confirmarse estáticamente.
- Especificar la observación runtime exacta necesaria para confirmar o descartar cada hipótesis restante.

## Condición de finalización

La tarea termina cuando el informe permite explicar, o aislar con evidencia runtime concreta, cada divergencia de wallet1 y wallet2 entre Preview y localhost sin haber alterado código, configuración, datos, perfiles ni entitlements.
