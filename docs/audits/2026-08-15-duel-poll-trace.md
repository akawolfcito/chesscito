# Trace operativo del poll del duelo — antes de congelar

**Fecha:** 2026-08-15
**Por qué existe:** para congelar P2P sabiendo que no metimos una bomba silenciosa de
requests, logs o Redis. Pedido explícito del founder en el cierre.
**Método:** inspección de la ruta + medición del payload. ⛔ **No se agregó telemetría para
medir**: el objetivo es detectar trabajo accidental, no crear más.

---

## 1. Qué hace UN poll

La ruta del poll es `GET /api/duel/[id]`. Lo que toca, verificado leyendo el archivo:

| recurso | por poll | evidencia |
| --- | --- | --- |
| Invocación de función | **1** | Un `GET`; `dynamic = "force-dynamic"`, sin caché |
| Queries a Supabase | **1** | `loadMaterialized` → `repo.find(id)`, un `select` por PK |
| Writes a Supabase | **0** | `repo.commit` está detrás de `if (changed)` — ver §2 |
| Comandos Redis / Upstash | **0** | La ruta no importa `getRedis` ni `enforceRateLimit`. Verificado por grep: **0 coincidencias** |
| Writes de analytics | **0** | `recordDuelEvent` **no aparece** en esta ruta. Sólo lo llaman create, join, move y resign |
| Líneas de log | **0** | Los dos `logger.error` son caminos de falla (`duel_read_failed`, excepción no atrapada) |

⛔ **La conclusión que importa:** el poll es **un `select` por clave primaria y nada más**. No
hay rate limit, no hay Redis, no hay evento de analytics, no hay log en el camino normal.

⚠️ Y algo que conviene tener escrito: **el GET no lleva `enforceOrigin`**, a propósito. Es una
lectura pública por diseño — el enlace reenviado da sólo lectura, y la credencial no autoriza
la lectura sino que nombra tu asiento.

---

## 2. El único write, y cuándo ocurre

`loadMaterialized` escribe **una sola vez en la vida del duelo**, y sólo cuando el reloj cambia
algo: la invitación venció, o cayó la bandera. Eso es `changed === true`.

```
repo.find(id)                → siempre (1 select)
materialize(duel, now)       → puro, sin I/O
if (changed) repo.commit(…)  → 1 update, una vez, nunca por poll
```

⚠️ Si ese write falla, el lector **igual recibe el estado calculado**: la expiración es función
del tiempo, no un permiso de escritura.

---

## 3. Por estado

| estado | invocaciones | selects | writes | Redis | analytics | logs |
| --- | --- | --- | --- | --- | --- | --- |
| Esperando rival | 1 cada **1,2 s** | 1 | 0 | 0 | 0 | 0 |
| Partida — tu turno | 1 cada **3 s** | 1 | 0 | 0 | 0 | 0 |
| Partida — turno del rival | 1 cada **3 s** | 1 | 0 | 0 | 0 | 0 |
| **Terminada** | **0 — el poll se detiene** | — | — | — | — | — |
| **Vencida** | **0 — el poll se detiene** | — | — | — | — | — |

⚠️ Con la pestaña oculta la cadencia baja a **30 s** en cualquier estado activo.

El poll de transición —el que materializa la bandera o el vencimiento— es el único que suma
**1 update**, y después el estado es terminal y el poll para.

---

## 4. Tamaño de la respuesta, medido

| jugadas (plies) | bytes |
| --- | --- |
| 0 | 553 |
| 20 | 676 |
| 40 | 787 |
| 80 | 1.027 |
| 120 | 1.269 |

⚠️ **Es el único componente del costo que NO es constante**: `moves` viaja entero en cada poll,
a razón de ~6 bytes por media jugada. Una partida larguísima de 60 movidas contesta con **1,3 KB**.
No es un defecto — el cliente necesita las jugadas para dibujar la estela y para la repetición
triple — pero queda medido en vez de descubierto.

Anclado en `src/lib/duel/__tests__/poll-trace.test.ts` como alarma de regresión.

---

## 5. Criterios de congelamiento (§4 del cierre)

| criterio | estado | evidencia |
| --- | --- | --- |
| El poll de espera hace sólo la lectura mínima | ✅ | 1 select por PK |
| El poll de partida hace sólo la lectura mínima | ✅ | idem |
| No emite un evento de analytics por intervalo | ✅ | `recordDuelEvent` no está en la ruta |
| No emite logs ruidosos en operación normal | ✅ | sólo `logger.error` en fallas |
| No hace llamadas a Redis innecesarias | ✅ | 0 referencias en la ruta |
| Para después de `completed` | ✅ | `shouldPoll`, con test |
| Para después de `expired` | ✅ | `shouldPoll`, con test |
| Para al desmontar | ✅ | cleanup del efecto: `cancelled`, `clearTimeout`, `removeEventListener` |
| Sin loop de reintento desbocado | ✅ | `refresh()` **ignora** el `refetch` de la reacción; el reintento vive sólo en `act()` y corre **una vez** |

⛔ **Los nueve se cumplen. Por lo tanto, según el propio criterio del cierre, la cadencia NO se
toca en esta pasada.** Nada de WebSockets, Realtime, colas, cron ni otro transporte.

---

## 6. El envelope de volumen, verificado

Las estimaciones previas **se sostienen**:

```
duelo de 10 min, dos jugadores      ≈ 450 requests
   (600 s / 3 s) × 2 = 400 polls + jugadas + lecturas iniciales

invitación abandonada, 1 hora       ≈ 3.000 requests
   3600 s / 1,2 s = 3.000 polls, UN jugador mirando la pantalla
```

⚠️ **Y el peor caso es más raro de lo que suena**: una invitación abandonada normalmente
significa que el creador se fue de la pantalla, y ahí el componente se desmonta y el poll **se
detiene del todo**. Los 3.000 son el caso de alguien mirando la pantalla de espera una hora
entera sin hacer nada.

### Disparador para revisar la arquitectura del poll

> Revisar el poll **sólo si** el tráfico observado de P2P afecta materialmente el costo de
> invocaciones de Vercel, el volumen de lecturas de Supabase, la latencia o la tasa de error.

### Primer candidato barato, para cuando ese disparador se active

> Poll adaptativo / con backoff durante esperas prolongadas o cuando **no** es tu turno.

⛔ **No se implementa ahora**: el trace no prueba que haga falta.

---

## 7. Bloqueantes encontrados

**Ninguno.** No hubo nada que arreglar bajo el §5 del cierre.
