# Handoff — Slice 3, etapa 4C-3: la cola se ve, y quedó probada contra un build real

**Fecha**: 2026-07-29
**Branch**: `feat/attempt-identity-slice-3`
**Commits**: **27** (los 24 de 4C-2 + 4C-3 + el smoke + este handoff).
**Árbol**: limpio.
**SIN PUSH, SIN MERGE, SIN DEPLOY.**
**Suite**: **6513 passing / 552 archivos, EXIT=0**. `tsc --noEmit` limpio. Lint limpio.
**Build de producción**: `pnpm build` → **EXIT=0**.

> Verificable con `git rev-list --count main..HEAD` (da 26 antes de commitear este
> archivo).

## Estado en una línea

**La lane de intentos está terminada y medida.** Un intento completado llega al
servidor, se archiva con su nota calculada server-side, sobrevive a cerrar la app, y
si falla el jugador **lo ve y puede reintentar**. Un reintento no cuesta nada.

---

## 🟢 Smoke contra un build REAL — todo verde

`pnpm build` + `next start -p 3009` contra el Supabase local, con sesión real
(challenge + firma EIP-191 de una llave descartable). El script quedó en
`scripts/attempt-http-smoke.mjs` con sus instrucciones adentro.

| Llamada | HTTP | `status` | stars | grade | replayed | idx |
| --- | --- | --- | --- | --- | --- | --- |
| carril 1 (`rook-1`, 1 mov) | 200 | `saved` | **3** | graded | false | 1 |
| carril 2 (`rook-rail-two-turns`, 8 mov) | 200 | **`duplicate`** | **3** | graded | false | 2 |
| carril 2 **RETRY, mismo id** | 200 | `duplicate` | 3 | graded | **true** | **2** |
| carril 2, segunda corrida (12 mov) | 200 | `duplicate` | **1** | graded | false | 3 |

### Las mediciones que pidió el founder

| Medida | Valor |
| --- | --- |
| POSTs de intento realizados | **4** |
| Filas en `score_attempts` | **3** |
| `used_saves` antes → después | **0 → 3** |
| Filas en `score_saves` | **1** (una sola: las de carril 2 son `duplicate`) |
| Presupuesto | `max_saves = 100`, **sin tocar** |

**4 requests, 3 unidades.** El presupuesto lo mueve la cantidad de INTENTOS, no la de
requests: el retry consumió **cero** y devolvió el mismo `attempt_index`.

**Las estrellas las calcula el servidor, y se nota**: 8 movimientos sobre un óptimo de 8
dan 3★, y 12 movimientos sobre el MISMO nivel dan 1★. El cliente nunca mandó una
estrella; mandó `{kind:"moves", movesUsed}`.

Filas escritas, verificadas leyendo la DB aparte (el script **no** asserta contra la DB
a propósito: lo que prueba es el cable, y la afirmación de almacenamiento tiene que ser
una mirada separada para que un bug no pueda reportarse a sí mismo):

```
 idx | exercise_id         | measure_kind | value | grade  | stars | source
   1 | rook-1              | moves        |     1 | graded |     3 | client
   2 | rook-rail-two-turns | moves        |     8 | graded |     3 | client
   3 | rook-rail-two-turns | moves        |    12 | graded |     1 | client
```

`attempt_id_source = 'client'` en las tres: el bundle ya mintea, el server ya no
suple.

### Logs del server: limpios

**Cero** `Invariant: incrementalCache missing`, **cero** `catalog_unavailable`, **cero**
`rpc_failed`. `score_attempt_replayed` aparece **una sola vez** — la del retry.
(`origin_absent` sí aparece, y es correcto: el smoke omite el header a propósito, que
es lo que hace el WebView de MiniPay en un fetch same-site.)

---

## La superficie (4C-3)

`AttemptSaveStatus`, arriba del mission panel, donde ya vive el banner del límite
diario. Decisión del founder: **sin timer automático, con reintento manual visible.**

| Estado | Qué muestra |
| --- | --- |
| `pendingCount === 0` | **nada** |
| en vuelo | línea discreta “Guardando progreso…” |
| aparcado (retryable) | mensaje persistente + CTA **Reintentar** |
| más de uno pendiente | lo dice con número |

- **No es modal ni toast.** Un toast se vence justo cuando el jugador está moviendo,
  que es cuando la red está mal, que es cuando este estado existe. Un modal le saca el
  tablero para avisarle de algo que no causó.
- **La UI no puede mintear, reconstruir, reordenar ni descartar.** Lee `status` y
  `pendingCount` y llama `retry()`. La cola es del hook.
- **El CTA existe sólo con la cola aparcada.** Mientras hay un POST en vuelo no hay nada
  que reintentar, y el botón invitaría a un segundo POST del mismo intento.
- **El reintento reusa el mismo `attemptId`** → replay → cuesta cero. Por eso es seguro
  dejárselo tocar dos veces.
- Una **cola vacía no dice nada**: un chip permanente de “todo guardado” entrena al
  jugador a dejar de leer justo el lugar que importa.

## Los casos que faltaban, cerrados

| # | Caso | Cómo quedó |
| --- | --- | --- |
| 1 | queens | coverage contra `optimalMoves + 1` |
| 2 | safe-path | **moves** — es de llegada, no de cobertura |
| 3 | diagonal-run | moves |
| 4 | retryable → CTA → mismo id → settlement | la línea desaparece al resolverse |
| 5 | terminal | sin CTA, y la siguiente entrada sale igual |
| 7 | reload con cola pendiente, misma wallet | reenvía el **mismo** id |

Más uno que salió de una mutación sobreviviente: **no hay CTA mientras hay un POST en
vuelo**.

## Mutaciones verificadas (no por lectura)

| Mutación | Rojos |
| --- | --- |
| Mostrar el CTA siempre (no sólo aparcado) | 1 |
| Renderizar con la cola vacía | 3 |
| (4C-2) Congelar las `runKeys` del ensamblador | 1 |
| (4C-2) Gatear el reporte de carril 2 con `scorePendingNew` | 3 |
| (4C-1) Sacar la guarda del mirror / el latch / terminal→retryable | 1 / 1 / 2 |

## Lo que NO se hizo, y hay que decirlo

- **Nadie miró la superficie en un navegador.** Los tests prueban qué se renderiza y
  cuándo; el juicio visual (dónde queda, si compite con el mission panel en 390px) es
  del founder y le cuesta un vistazo.
- **El presupuesto sigue en 100 y nadie midió una sesión real.** El smoke gastó 3
  unidades en 3 intentos. Una sesión larga de carril 2 podría acercarse al techo, y no
  hay dato todavía.
- **Sin push, sin merge, sin deploy.** El Supabase local quedó **corriendo**
  (`supabase stop` para bajarlo); nada de lo escrito acá depende de eso.

## Próxima sesión

1. **Medir una sesión real** contra el presupuesto de 100 antes de tocarlo.
2. **`clearPersistedOutbox` no lo llama nadie.** Hoy la cola se vacía sola cuando drena
   (`persistOutbox` borra la key con cola vacía), así que no hay fuga — pero la función
   quedó sin consumidor y conviene decidir si tiene uno o se va.
3. Slice 2 (ventanas temporales) ya no está bloqueado: `score_attempts.created_at` **sí**
   significa “jugó”, que es justo lo que `score_saves.created_at` nunca significó.

## Preguntas abiertas

**Ninguna de diseño.** La única que quedaba —si el fallo retryable se queda esperando o
si el jugador puede reintentar— la contestó el founder y está construida.
