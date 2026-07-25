# /stats — ¿entran, llegan al valor y vuelven?

_2026-07-25 · auditado contra `apps/web/src/lib/stats/*` y `apps/web/supabase/migrations/*`_

## La pregunta

Chesscito no necesita un panel de infraestructura. Necesita que `/stats` responda una sola
pregunta de producto:

> **¿Las personas logran entrar, experimentar valor rápidamente, y regresar para construir el
> hábito de 21 días?**

Son tres verbos y cada uno tiene su medición. Todo lo demás —países, dificultad, on-chain— es
contexto que se cuelga debajo, nunca al revés. Una métrica que no ayuda a decidir qué construir
después no va en esta página.

| Verbo | Pregunta | Métrica dueña | Estado |
|---|---|---|---|
| **Entrar** | ¿Cruzan la puerta obligatoria? | Access funnel: pantalla → ENTER → sesión → wallet → **primer ejercicio terminado** | ✅ implementado |
| **Llegar al valor** | ¿Llegan a su primer ejercicio? | Activation funnel | ✅ funnel · ⚠️ falta la latencia |
| **Volver** | ¿Vuelven al día siguiente? ¿A los 7? ¿Sostienen 3 semanas? | D1 / D7 / semana 3 + días activos por instalación | ✅ implementado |
| **Quiénes** | ¿Cuántas personas, no cuántos navegadores? | Ciclo de vida por cuenta: nuevas / activas / dormidas / inactivas / resucitadas | ✅ implementado |

## Lo que se construyó en esta rama

### 1. Integridad de datos (primero, porque contamina todo lo demás)

Las lecturas usaban `.range(0, 9999)` **sin `.order()`**. PostgREST devolvía cualquier subconjunto
de 10.000 filas, así que un conteo "distinct" podía cambiar entre refrescos sin que nada avisara.

- Toda lectura acotada ahora ordena **newest-first**. El truncado descarta la cola vieja: la
  ventana de 30 días queda intacta y sólo las cifras lifetime degradan, a **cotas inferiores**
  en vez de subconjuntos arbitrarios.
- `dataIntegrity.truncated` nombra **cuáles** lecturas tocaron el techo, y la página lo dice
  arriba de todo. Un read truncado se ve idéntico a una caída real de uso; ésa es la
  confusión que esta página no se puede permitir.

### 2. Access funnel — "¿logran entrar?"

`gate_viewed → login_started → login_succeeded → wallet_ready → first_exercise_completed`.

Dos decisiones de diseño que lo hacen honesto:

- **Termina en el primer ejercicio terminado, no en `wallet_ready`.** Tener wallet es plomería,
  no valor. La puerta se mide hasta donde la persona hace algo que le importa.
- **Todo paso está acotado a la cohorte que vio la puerta.** MiniPay nunca monta el gate; sin
  este scoping sus sesiones aparecerían en el último paso sin figurar en el primero y el funnel
  sería creciente, es decir, basura. Con el scoping la secuencia es monótona por construcción:
  cada caída es una caída real, nunca un artefacto de mezcla.
- Los `web_login_failed` se reportan **al lado** del funnel, no adentro: una sesión puede fallar
  y después entrar. Es fricción, no pérdida.

Los cinco eventos ya se emitían desde `lib/wallet/web-access-analytics.ts` y no se mostraban en
ninguna pantalla.

### 3. Activation funnel

Ya existía; ahora está rotulado como el paso 2 de la pregunta y se lee después de la puerta.
Cubre a todo el mundo que ya está adentro, MiniPay incluido.

### 4. Nuevas vs recurrentes

`DailyBucket` ahora trae `newInstalls` y `returningInstalls`, derivados del **mismo** conjunto
activo del día particionado por `session_first_seen`, de modo que siempre suman `sessions`: el
gráfico no puede contradecir su propio total. Una instalación sin fila en la tabla de cohortes
(anterior a ella) cuenta como recurrente, que es la lectura conservadora.

### 5. Identidad a nivel de cuenta

La unidad era `session_id` = el `anonymousId` de localStorage
(`lib/analytics/identity.ts:34`): una **instalación**, no una persona. Dos dispositivos = dos
"usuarios"; borrar storage = usuario "nuevo".

Ahora existe `account_ref = HMAC-SHA256(dirección en minúsculas, TELEMETRY_ACCOUNT_SECRET)`,
truncado a 128 bits y calculado **server-side** en `/api/telemetry`.

- **Es HMAC con secreto, no un hash pelado.** El conjunto de wallets reales es enumerable: un
  SHA-256 sin clave de una dirección lo revierte cualquiera con una lista de wallets — sería una
  columna de wallets disfrazada. Con el secreto en el servidor el valor no es vinculable a una
  persona, y rotar el secreto huérfana el histórico a propósito.
- **La wallet nunca se persiste ni se loguea.** Llega en el body, se consume en una línea y se
  reemplaza. Ese route **no tiene logging de request a propósito**: loguear el body pondría
  direcciones crudas en el log drain, que es exactamente la fuga que `account_ref` evita.
- **`deriveRowId` no sirve para esto.** Es un hash no criptográfico para mostrar avatares;
  usarlo acá sería reversible.
- El cliente publica la dirección vía `TelemetryAccountBridge`, montado en
  `ProductContextProviders` — el único wrapper que montan **ambas** ramas de wallet.

Definiciones fijadas en `computeAccountLifecycle`:

- **nueva**: `first_seen` = hoy
- **activa**: algún evento en los últimos 7 días
- **dormida**: último evento hace 8–29 días
- **inactiva / churn**: sin eventos en los últimos 30 días
- **resucitada**: activa esta semana tras un silencio de 8–29 días — la métrica que dice si la
  racha y las notificaciones sirven

`activas + dormidas + inactivas === conocidas` por construcción: son una partición, así que el
bloque no puede describir más ni menos gente de la que existe. "Inactiva" no es un evento, se
deriva de la ausencia — por eso `account_first_seen` se lee **sin cota temporal**: recortarlo a
30 días definiría a los churneados fuera de la existencia.

### 6. Hábito y retención

- **Retención de semana 3**, no sólo D1/D7. Deliberadamente es una **ventana** (algún evento en
  los días 15–21 desde la instalación), no un día exacto como D1/D7. Preguntar por el día 21
  exacto mide si alguien abrió la app justo ese martes: a este volumen da ~0 y no dice nada de
  hábito. El campo se llama `week3` y no `d21` para que la diferencia de forma se vea en cada
  call site.
- **Días activos distintos por instalación** (`computeHabitDepth`), en cortes acumulativos
  1/3/7/14/21 + mediana. Es la promesa de 21 días hecha verificable: una tasa de retención puede
  verse sana mientras todo el mundo entra dos veces; esto no.

## Lo que sigue

- **Tiempo hasta el primer ejercicio terminado** desde el login: la latencia de valor.
- **Abandono por pieza / por ejercicio**: dónde exactamente se cae la gente en el recorrido.
- **Curva por cohorte semanal**, no rolling: la vista que muestra si el producto mejora entre
  cohortes.

## Requisito de despliegue

`TELEMETRY_ACCOUNT_SECRET` (server-only, **sin** `NEXT_PUBLIC_`) tiene que existir en el entorno.
Sin él `deriveAccountRef` devuelve `null` por diseño: la columna queda vacía y el bloque de
cuentas se oculta, en vez de escribir un pseudónimo débil. Hay que agregarlo a `.env.template` y
a Vercel — no lo toqué porque las reglas del repo me impiden leer o escribir archivos `.env`.

También hay que correr la migración `20260725000000_account_level_identity.sql`.

## Caveats vigentes

- La tendencia diaria ya era diaria (`computeActivityTrend`, 30 buckets UTC densos). Que sólo
  hubiera barras al final significa que `analytics_events` no tenía filas más viejas en la
  ventana, no que el agregado estuviera mal.
- El access funnel es **web-only** por naturaleza: MiniPay no tiene puerta. Para comparar
  contenedores hay que usar el activation funnel, no éste.
