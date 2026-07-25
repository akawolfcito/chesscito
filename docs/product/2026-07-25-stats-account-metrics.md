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
| **Llegar al valor** | ¿Cuánto tardan en su primer ejercicio? | Activation funnel + tiempo hasta el primer ejercicio | ⚠️ funnel sí, latencia no |
| **Volver** | ¿Vuelven al día siguiente? ¿A los 7? ¿Sostienen 21? | D1/D7 → D21 → días activos por instalación | ⚠️ D1/D7 sí, el resto no |

El hábito de 21 días es el techo del producto y hoy **no se mide**: la retención llega a D7 y se
corta. Sin D21 no hay forma de saber si el juego construye hábito o sólo entretiene una tarde.

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

## Lo que sigue, en orden

### 5. Identidad a nivel de cuenta

Hoy la unidad es `session_id` = el `anonymousId` de localStorage
(`lib/analytics/identity.ts:34`): una **instalación**, no una persona. Dos dispositivos = dos
"usuarios"; borrar storage = usuario "nuevo". Con login obligatorio ya existe un identificador
estable (el embedded wallet de Privy) que el pipeline no registra.

Propuesta: `account_ref = HMAC-SHA256(wallet, secreto de servidor)` calculado **server-side** en
`/api/telemetry`. Nunca se guarda la wallet, se preserva la regla PII-free, y aparece identidad
estable entre dispositivos. Precedente en el repo: `deriveRowId` (Identity Lite) ya hace esta
derivación opaca.

Con eso, y una tabla `account_first_seen`, las definiciones se fijan:

- **nueva**: `first_seen` = hoy
- **activa**: algún evento en los últimos 7 días
- **dormida**: sin eventos hace 8–29 días
- **inactiva / churn**: sin eventos hace 30+ días
- **resucitada**: dormida que vuelve — la métrica que dice si la racha y las notificaciones sirven

"Inactiva" no es un evento: se deriva de la ausencia. Sin `account_first_seen` no hay denominador
y el número no existe.

### 6. Hábito y retención — el techo del producto

- **D21**, no sólo D1/D7. La tabla tiene limpieza a 90 días, así que alcanza.
- **Días activos por instalación en la ventana** (¿vuelven 1 vez o 12?): es el indicador de
  hábito más directo, más que cualquier tasa de retención puntual.
- **Tiempo hasta el primer ejercicio terminado** desde el login: la latencia de valor.
- **Abandono por pieza / por ejercicio**: dónde exactamente se cae la gente en el recorrido.
- **Curva de 21 días por cohorte semanal**: la única vista que responde si el producto cumple
  su promesa.

## Caveats vigentes

- La tendencia diaria ya era diaria (`computeActivityTrend`, 30 buckets UTC densos). Que sólo
  hubiera barras al final significa que `analytics_events` no tenía filas más viejas en la
  ventana, no que el agregado estuviera mal.
- El access funnel es **web-only** por naturaleza: MiniPay no tiene puerta. Para comparar
  contenedores hay que usar el activation funnel, no éste.
