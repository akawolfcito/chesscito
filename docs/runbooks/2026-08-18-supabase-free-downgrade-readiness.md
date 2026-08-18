# Runbook — bajada de Supabase Pro → Free

**Fecha:** 2026-08-18 · **Tipo:** preparación. ⛔ **El plan NO se cambió.**
**Para:** el founder, que ejecuta. **Estado:** paquete GO/NO-GO.

Etiquetas: **[FACT]** medido hoy · **[INFERENCE]** · **[UNKNOWN]**

---

## 0. Lo que este runbook cambia respecto de la auditoría de ayer

⚠️ **Apareció un riesgo que la auditoría no tenía medido, y no es el disco.**

**[FACT] Las RPC de `/stats` promedian 1,3–1,8 s por llamada, con máximo de 5,9 s — en Pro.**
El insert de telemetría, en comparación, son **2,4 ms** sobre 42.059 llamadas.

⛔ **`/stats` es, por lejos, lo más pesado que hace esta base**, y es exactamente el workload que
más sufre una CPU compartida. La agregación de `/stats` que ayer clasifiqué como *"seguro, no
ahorro"* resulta ser **el principal mitigador del riesgo de esta bajada**.

No lo convierte en bloqueante — pero cambia dónde hay que mirar después de bajar.

---

## PARTE 1 — Backup del estado de producto

✅ **HECHO HOY.** Herramienta nueva y versionada: **`pnpm ops:backup`**.

| | |
|---|---|
| Artefacto | `private/backups/2026-08-18T20-14-19Z/product-state.sql` |
| Tablas | **23** |
| Filas | **41.321** |
| Tamaño | **7,06 MB** |
| SHA-256 | `50587738038929f0…` (completo en `manifest.json`) |
| Duración | **18 s** |
| Servidor | PostgreSQL **17.6** |

**La regla del backup, y por qué es una DENY-list:** vuelca **todo `public` EXCEPTO
`analytics_events`**. Un allow-list se olvidaría de una tabla de producto nueva, que es el
único error que un backup no puede permitirse. Hay un test que lo fija.

`analytics_events` se excluye porque son 164 MB de ~190 y **ya está archivada y verificada** en
Parquet (`06d5815`). Volcarla otra vez haría el backup 8× más grande sin agregar seguridad.

⚠️ **`account_first_seen` y `session_first_seen` SÍ entran**, aunque la auditoría previa las
clasificó como analítica: pesan 2,7 MB, `/stats` las lee, y **no se reconstruyen** desde una
`analytics_events` recortada porque `first_seen` es anterior a cualquier ventana caliente.

⛔ **Gotcha que costó un intento y conviene no repetir: el servidor es PostgreSQL 17.6, así que
`pg_dump` debe ser 17.** El resto del tooling del repo usa la imagen 16 —`psql` 16 habla con 17
sin problema— pero **`pg_dump` 16 se niega en seco**. La imagen quedó pineada y hay un test.

**Seguridad:** vive en `private/backups/` (gitignoreado, verificado con `git check-ignore`);
la contraseña viaja sólo en el env del proceso hijo; los errores pasan por redacción.

---

## PARTE 2 — Prueba de restauración

✅ **PASS.** `pnpm ops:backup:verify <dir>` restaura en un Postgres **desechable** (`--rm`,
misma versión mayor) y compara contra el manifiesto.

| Verificación | Resultado |
|---|---|
| SHA-256 del dump | ✅ OK |
| Errores reales de restauración | ✅ **0** |
| Tablas restauradas | ✅ **23 / 23** |
| Filas | ✅ **41.321**, coincidencia exacta por tabla |
| Primary keys | ✅ **23** |
| Otras constraints (CHECK/UNIQUE/FK) | ✅ **108** |

⛔ **Encontré un defecto en mi propio verificador y lo arreglé antes de confiar en él:** la
primera versión leía sólo **stdout**, y `psql` escribe los errores en **stderr**. Reportó **PASS
sobre una restauración que había registrado 9 errores.** Un verificador que no puede fallar no
es un verificador. Ahora captura `2>&1` y **falla**.

⚠️ **19 errores de "role does not exist" son esperados y NO son un defecto del backup:** los
roles `anon`/`authenticated`/`service_role` son de Supabase y no existen en un contenedor
vanilla, así que las políticas RLS que los nombran no se pueden crear **ahí**. Una restauración
real aterriza en un proyecto Supabase donde sí existen. El verificador los separa de los errores
reales en vez de ignorarlos en bloque.

⚠️ **Consecuencia operativa que sí importa:** este backup **no lleva GRANTs** (`--no-privileges`)
y sus políticas dependen de roles del destino. **Para un desastre real, restaurar en un proyecto
Supabase nuevo, no en un Postgres pelado**, y volver a aplicar las migraciones de privilegios.

---

## PARTE 3 — Delta de features en Free

Sólo lo que Chesscito **usa de verdad**.

| Feature | Uso real | En Free | Clasificación |
|---|---|---|---|
| Postgres 17.6 | núcleo | igual | **UNCHANGED** |
| **`pg_cron`** | 1 job: `prune_analytics_events_monthly` | ⚠️ **[UNKNOWN]** si Free lo permite | ⛔ **UNKNOWN** |
| `pgcrypto` · `uuid-ossp` · `plpgsql` | `gen_random_uuid()`, hashing | estándar | **UNCHANGED** |
| `pg_stat_statements` | diagnóstico | disponible | **UNCHANGED** |
| `supabase_vault` | instalada, **sin uso observado** | — | **UNCHANGED** |
| **RLS** | ⛔ habilitada en `analytics_events`, cero políticas | igual | **UNCHANGED** |
| **RPC (9 `stats_*`)** | `/stats` | igual | **UNCHANGED** ⚠️ *pero ver Parte 4* |
| Conexiones | **[FACT] 20 (17 idle, 1 activa)** | menor límite | **REDUCED** |
| **Backups automáticos** | Pro los da | ⛔ **Free NO tiene** | ⛔ **UNAVAILABLE** |
| Logs / observabilidad | panel | retención menor | **REDUCED** |
| **Compute** | Pro dedicado | ⚠️ **Nano / compartido** | ⛔ **REDUCED** |
| Pausa por inactividad | tráfico diario | pausa a la semana sin uso | **UNCHANGED** *(sin riesgo)* |
| Realtime · Edge Functions · Storage | **[FACT] 0 uso** | — | **UNCHANGED** |

⛔ **Dos cosas cambian de verdad:**

1. **Se pierden los backups automáticos.** Es exactamente lo que `pnpm ops:backup` compensa —
   pero **manualmente**. Sin una cadencia acordada, el backup envejece.
2. **`pg_cron` es [UNKNOWN] en Free.** Si no está, el job de prune deja de correr. **No es
   grave**: borra 10.337 filas al mes y **no libera disco igual**. Pero hay que saberlo en vez
   de descubrirlo.

---

## PARTE 4 — Riesgo de compute con el tráfico ACTUAL

**[FACT] Evidencia medida hoy:**

| Señal | Valor |
|---|---:|
| Tráfico | **158 sesiones / 24 h** |
| Conexiones | 20 (17 idle, **1 activa**) |
| Cache hit | **99,99%** |
| Insert de telemetría | **2,4 ms** media, 54 ms máx, 42.059 llamadas |
| ⛔ **RPC de `/stats`** | **1,3–1,8 s media, 5,9 s MÁXIMO** |
| Transacciones acumuladas | 1.039.277 commits / **245 rollbacks** |

### **VEREDICTO: MEDIUM RISK**

**No LOW, y la razón es una sola:** la consulta dominante **ya tarda 1,3–1,8 s en Pro**, con
picos de 5,9 s. En CPU compartida eso empeora en un factor **[UNKNOWN]**, y 5,9 s está cerca de
timeouts habituales.

**Lo que sostiene que igual sea aceptable:**
- **[FACT] `/stats` se llama poco** — cientos de veces en la ventana acumulada de
  `pg_stat_statements`, contra 42.059 inserts de telemetría.
- **[FACT] El juego NO lee `analytics_events`.** Si `/stats` se degrada, **se degrada una página
  pública, no el gameplay.**
- **[FACT] 1 conexión activa de 20.** No hay presión de concurrencia.
- **[FACT] Cache hit 99,99%** con una base de 200 MB.

⛔ **No afirmo capacidad para un pico tipo lanzamiento.** Este veredicto vale **sólo** para
~158–180 sesiones/día, que es lo que se pidió evaluar.

---

## PARTE 5 — Runbook de bajada

> ⏱️ **~25 minutos.** ⚠️ Hacerlo en horario de bajo tráfico y **no un lunes**.

| # | Paso | Comando / acción | Criterio |
|---|---|---|---|
| 1 | Congelar deploys ajenos | — | Nada en vuelo |
| 2 | **Backup fresco** | `pnpm ops:backup` | 23 tablas, ~41k filas |
| 3 | **Verificar el backup** | `pnpm ops:backup:verify private/backups/<stamp>` | **PASS, 0 errores reales** |
| 4 | Salud previa | `pnpm ops:health` | Guardar la salida |
| 5 | Uso previo | Panel de Supabase | DB, egress, conexiones |
| 6 | Smoke previo | Parte 6 | Todo verde **antes** |
| 7 | **Bajar a Free** | Dashboard → Billing | — |
| 8 | Esperar la transición | ~2–5 min | Proyecto activo |
| 9 | **Smoke posterior** | Parte 6 | Comparar con el paso 6 |
| 10 | Salud posterior | `pnpm ops:health` | Comparar con el paso 4 |
| 11 | **Observar 60 min** | Parte 7 | Decidir |
| 12 | KEEP FREE o **ROLLBACK** | Dashboard → Pro | Umbrales de la Parte 7 |

⛔ **Los pasos 2 y 3 no son opcionales y no se hacen "después".** Un backup sin verificar no es
un backup, y ya vimos hoy que la verificación puede mentir si está mal escrita.

✅ **La red de seguridad es real: volver a Pro tiene efecto inmediato**, y el tiempo prepagado no
usado queda como crédito de la organización que no vence.

---

## PARTE 6 — Smoke mínimo

⛔ **REGLA DURA: ninguna sonda que pueda LIQUIDAR un pago.** No comprar PRO, no mintear, no
gastar Peones. Se preserva SEC-OPS-01.

**PLAY** — landing/hub carga · Arena carga · lectura de estado (Peones, PRO) · **una escritura
segura**: completar un ejercicio y ver el score persistido.
**LEARN** — carga · lectura de progreso · **una escritura segura** de progreso.
**Servidor** — `/stats` responde y con números ⚠️ *(el más lento: cronometrarlo)* · leaderboard ·
`/api/telemetry` acepta un lote.
**Estado** — Peones, PRO, scores y victorias leen los mismos valores que antes.
**P2P** — ⛔ **sólo lectura**, no tocar. El flag sigue cerrado.
**Pagos** — ⛔ **nada**. Se verifica que la **lectura** de estado de pago responde, y ahí termina.

Cierre: **`pnpm ops:health`**.

⚠️ **Cronometrar `/stats` explícitamente** es el único paso del smoke que este runbook agrega
por evidencia nueva: es la consulta que decide si Free aguanta.

---

## PARTE 7 — Umbrales GO / ROLLBACK

**QUEDARSE EN FREE si, durante 60 minutos:**
- HTTP 200 en PLAY y LEARN, sin aumento apreciable de 5XX
- Las escrituras de estado tienen éxito (score, progreso, Peones)
- `/stats` responde ⚠️ **aunque tarde más** — un `/stats` lento no es un incidente
- Sin agotamiento de conexiones
- El estado de usuario coincide con el previo
- La telemetría sigue insertando (**~270 filas/hora** es la línea base)

**VOLVER A PRO si:**
- ⛔ Timeouts de DB **repetidos** (no uno suelto)
- ⛔ **Fallan escrituras de estado** — cualquier pérdida de progreso es rollback inmediato
- ⛔ Fallan lecturas de estado de pago
- ⛔ `/stats` pasa de lento a **error**
- ⛔ Agotamiento de conexiones
- ⛔ Latencia sostenida que se nota **en el juego** (no en `/stats`)

⚠️ **Regla anti-sobrerreacción:** ninguna decisión con una sola muestra. **Dos ocurrencias en 15
minutos, o una degradación sostenida de 10 minutos.** ⛔ **Excepción sin discusión: un fallo de
escritura de estado de usuario es rollback a la primera.**

---

## PARTE 8 — Amarillo de telemetría (cola para Fase 2, sin tocar nada)

**[FACT]** `ops:health` en **YELLOW** por un único disparador: **42,07 eventos/sesión** contra un
umbral de 35.

⚠️ **Y la media miente:** **[FACT] p50 = 17, p95 = 156, máx = 660.** ⛔ **La mediana está a la
MITAD del umbral.** El amarillo lo produce una cola pesada, no una sesión típica —
exactamente lo que ya se sabía de esta métrica.

| Evento | 24 h | Clasificación | Razonamiento |
|---|---:|---|---|
| `peones_balance_viewed` | **557** | ⛔ **RENDER_DRIVEN** | Lo tocan el 99,7% de los wallets; se dispara al pintar, no al decidir |
| `play_hub_view` | 339 | **MEANINGFUL_VIEW** | Es una pantalla real ⚠️ pero 3,4/sesión sugiere re-render |
| `arena_coach_signal_viewed` | 231 | ⛔ **RENDER_DRIVEN** | 3,0/sesión y empata casi exacto con `arena_select_view` (1.531 vs 1.518 en W2) |

**[FACT] Del audit de costo, y es el candidato más limpio:** `arena_game_start` y
`arena_start_tap` tienen conteos **idénticos** en dos ventanas (4.862/4.862 y 1.127/1.127). **Son
dos eventos para un mismo instante.**

### Qué medir ANTES de borrar o deduplicar nada

1. ⛔ **Por sesión, no en total.** Un total baja al bajar el tráfico y no prueba nada.
2. **Distinguir "se disparó varias veces por render" de "el jugador lo hizo varias veces"** —
   hoy no son distinguibles, y es la pregunta central.
3. **Confirmar el par duplicado** con una sesión instrumentada, no por igualdad de conteos.
4. ⚠️ **Antes de tocar `peones_balance_viewed`, saber qué se pierde:** es el 8,7% del volumen
   **y la única señal de alcance universal** que existe hoy.
5. ⛔ **Reconsiderar el umbral, no sólo el emisor.** Con p50 = 17, un umbral sobre la media puede
   estar midiendo la métrica equivocada.

⛔ **Nada de esto se ejecuta en Fase 1.**

---

## PARTE 9 — Vercel / Railway (registro de decisión, sin acción)

- Vercel sigue siendo la plataforma preferida para **experimentos**.
- Chesscito puede salir porque **es comercial pero no justifica su piso de hosting**.
- Railway es candidato **reversible**.
- **Empezar por LEARN**, que tiene mucho menos tráfico.
- Observar costo y runtime reales antes de mover PLAY.
- Si Railway resulta peor, se vuelve a Vercel.

⚠️ **Sigue en pie la condición que puede invertir el signo:** sacar Chesscito sólo ahorra si el
equipo de Vercel puede bajar a Hobby, y Hobby prohíbe uso comercial. **Si queda otro proyecto
comercial ahí, migrar agrega costo.** ⛔ **Nada implementado. Sin canary.**

---

```
PRODUCT STATE BACKUP:
READY — 23 tablas, 41.321 filas, 7,06 MB, SHA-256 registrado, en private/backups/

LOCAL RESTORE:
PASS — 23/23 tablas, 41.321 filas exactas por tabla, 23 PKs, 108 constraints,
0 errores reales (19 de rol ausente, esperados en un Postgres vanilla)

CURRENT DB SIZE:
~200 MB de 500 MB  →  40%

CURRENT EGRESS:
0,407 GB de 5 GB (ciclo 2026-08-04 → 2026-09-04)  →  8,1%

FREE LIMIT HEADROOM:
Disco 60% · Egress 92% · MAU ~97% · Storage 100% · Proyectos 1 de 2

CURRENT TRAFFIC COMPUTE RISK:
MEDIUM — no por volumen sino por UNA consulta: las RPC de /stats promedian
1,3–1,8 s con máximo de 5,9 s YA EN PRO. El juego no depende de ellas.

FEATURE BLOCKERS:
NONE bloqueante. Dos cambios reales a aceptar conscientemente:
  1. Se pierden los backups automáticos → los reemplaza pnpm ops:backup, MANUAL
  2. pg_cron en Free es [UNKNOWN] → si se apaga, el prune mensual no corre
     (borra 10.337 filas/mes y no libera disco igual)

POST-DOWNGRADE SMOKE:
READY — diseñado, sin ninguna sonda capaz de liquidar un pago

ROLLBACK TO PRO:
PROVEN OPERATIONALLY — el upgrade tiene efecto inmediato y el tiempo prepagado
queda como crédito que no vence. ⚠️ Probado por la propiedad de facturación
declarada por el founder, NO ejecutado por mí.

TELEMETRY YELLOW:
NON-BLOCKING — p50 = 17 contra un umbral de 35. Es cola pesada, no la sesión
típica, y no toca la base de datos.
```

---

# READY FOR FOUNDER-OPERATED SUPABASE DOWNGRADE

Los tres bloqueantes de la auditoría de ayer están resueltos o acotados: **el tamaño no bloquea**
(40%), **el egress tampoco** (8,1%, ya medido por vos), y **existe un backup verificado con
restauración probada**, que es lo que ayer faltaba.

⚠️ **Lo que llevás sabiendo, no descubriendo:**

1. **`/stats` es la apuesta.** Es lo único pesado y ya tarda 1,3–1,8 s en Pro. **Cronometralo en
   el smoke.** Si se degrada, degrada una página pública — no el juego.
2. **Se pierden los backups automáticos.** `pnpm ops:backup` los reemplaza, pero es manual: sin
   una cadencia acordada, envejece.
3. **`pg_cron` en Free es [UNKNOWN].** Consecuencia baja, pero mejor verificarlo que descubrirlo.

⛔ **No bajé el plan, no toqué producción salvo lecturas y el `pg_dump`, y no ejecuté nada del
runbook.** La decisión y la ejecución son tuyas.
