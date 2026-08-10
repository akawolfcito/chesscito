# Red team — spec v2 (`2026-08-09-attempt-save-never-ambushes-v2.md`)

**Fecha:** 2026-08-09
**Veredicto:** ⛔ **NO READY.** Un bloqueante que vuelve a romper el criterio de
aceptación, y tres mayores. El v2 arregla lo que el v1 rompía, pero deja fugas nuevas
**creadas por su propia solución**.

Lo bueno primero, porque es verificable: **`postScoreSave` tiene exactamente dos call
sites** (`exercises-screen.tsx:1130` y `:2380`) y **`ensureScoreSession` se llama sólo
desde `save-client.ts`**. El punto de convergencia que elige §3 es real.

---

## ⛔ BLOQUEANTE 1 — `deny` NO cubre la re-autorización, y ahí se cuela el prompt

§3.1 pone `promptPolicy` en `ScoreSaveClientInput` y asume que con `"deny"` no hay firma.
Pero `postScoreSave` llama a `ensureScoreSession` **dos veces**:

```
save-client.ts:163   const session   = await ensureScoreSession({...})          // la que el spec ve
save-client.ts:178   const first     = await postWithToken(session.token, ...)
save-client.ts:185   clearScoreSession();
save-client.ts:186   const refreshed = await ensureScoreSession({... forceRefresh: true })  // ⛔ la que NO ve
```

**La fuga concreta:** el token está **presente y localmente válido** (no venció por
`expiresAt`), así que la primera llamada lo devuelve **sin firmar** — `deny` no se
activa. El POST sale, y el server responde `invalid_session` / `session_revoked` /
`session_expired` (está en `SESSION_DEAD_REASONS`, `:89-94`). Entonces la línea 186
re-autoriza con `forceRefresh: true` → `authorize()` → **`signMessage` → wallet abierta**,
con `promptPolicy: "deny"` puesto.

⚠️ **Y es exactamente el caso que el spec dice proteger:** el jugador que vuelve al día
siguiente tiene un token **persistido en disco** que puede seguir dentro de su ventana
local mientras el server ya lo dio de baja (revocado, o agotado por `maxSaves`). §2.3
razona sobre el token vencido; **no razona sobre el token muerto server-side**, que es
igual de común y no lo detiene nada.

**Consecuencia:** el criterio de aceptación de §1 vuelve a fallar. **`promptPolicy` tiene
que atravesar las DOS llamadas**, y el spec debe decirlo — con un caso de test para el
token vivo-local / muerto-server.

---

## MAYOR 2 — El guard convierte una entrada fría en un "fallo" visible

`exercises-screen.tsx:2510` fija `autoSaveFailed` cuando el auto-save no prospera, y ese
flag viaja a `MissionDetailSheet` como `saveFailed` (`:3825`) con un
`onRetrySave` (`:3826`).

Con el guard del v2, **toda entrada fría sin sesión produce un `deny` → error → `autoSaveFailed = true`**.
El banner queda callado (bien), pero el jugador que después abre la hoja de misión
—por cualquier motivo— se encuentra un **estado de fallo y un botón de reintento por algo
que nunca hizo**. El v2 sacó el cartel de la pantalla y dejó su hermano adentro de la hoja.

`deny` **no es un fallo**: es "ahora no". Necesita un resultado distinguible
(p. ej. `reason: "session_required"` tratado aparte) para que la UI no lo vista de error.
Sin eso, el fix mueve el defecto en vez de cerrarlo.

---

## MAYOR 3 — Prender `earnedThisSession` NO re-dispara el camino B

§3.2 asume que, una vez que el jugador gana, el camino B pasa a `"allow"` y guarda. El
efecto no coopera:

```
}, [scorePendingNew, isSubmitBusy, localScoreNum]);   // :2514 — earnedThisSession NO está
```

y antes de llamar hace `autoSavedScoreRef.current = localScoreNum` (`:2508`), **latcheando
el score aunque la llamada fracase**.

Dos consecuencias:

1. Prender el gate **no re-ejecuta el efecto**: sus deps no cambiaron.
2. Aunque se re-ejecutara, el ref ya iguala a `localScoreNum` y sale por `:2507`.

Se salva sólo si la victoria **cambia el número de score**. Un replay que no mejora
estrellas —caso soportado y normal, todo ejercicio resuelto es rejugable— deja el score
pendiente **sin guardar durante toda la visita**, y sin banner que lo diga (el banner
mira la cola del camino A, no este flag).

**Exige:** agregar `earnedThisSession` a las deps y mover/condicionar el latch del ref
para que un `deny` no lo consuma.

---

## MAYOR 4 — El hint de §4.2 pide un dato que la UI no tiene

§4.2 condiciona `offerHint` a "S2 **sin sesión usable**". Hoy la existencia de una sesión
usable es **privada de `session-client.ts`**: vive en el `cached` de módulo y en
`localStorage`, y se evalúa con `isUsable(...)`, que no se exporta. El componente no
puede preguntarlo.

Eso es **API nueva sin especificar**: hace falta un selector de sólo lectura
(`hasUsableScoreSession(wallet, surface)`) y una decisión sobre su reactividad — un
token puede vencer **con el banner en pantalla**, y entonces el hint tendría que
aparecer sin que nada re-renderice. El spec da la regla por resuelta y no la diseña.

---

## MAYOR 5 — El gate depende de la lane, y el camino B no

§5 dice que con `isAttemptLaneEnabled` en false el camino B "debe funcionar igual". Pero
el gate que decide su `promptPolicy` se prende con `report()`, y `report()` **sale
primero si la lane está apagada** (`use-attempt-outbox.ts:309`).

Con la lane off: `earnedThisSession` **nunca se prende** → el camino B queda en `"deny"`
permanente → **el score de un jugador que ganó legítimamente no se guarda nunca**, en
silencio, sin banner (el banner también depende del gate). El flag pasa de "pausa" a
"apagar el guardado", que no es lo que la lane significa.

**Exige:** que el gate sea una señal del host, **independiente de la lane**, y decirlo.

---

## MENOR 6 — `promptPolicy` requerido rompe los tests existentes, y el spec no lo presupuesta

Volver el campo obligatorio es la decisión correcta (§3.1), pero hay suites que
construyen `ScoreSaveClientInput` (`lib/scores/__tests__/**`, y los de la ruta). Van a
romper todas a la vez. Es trabajo previsible que el plan no menciona.

---

## MENOR 7 — El test #11 no es un test de Vitest

§6.11 pide "quitar `promptPolicy` de un call site debe romper `tsc`". Vitest no falla por
eso. Se necesita un `@ts-expect-error` que **falle si el error desaparece**, o un check
de `tsc` en CI declarado como parte del criterio. Como está escrito, nadie sabe qué
archivo escribir.

---

## MENOR 8 — Borrar las 6 claves viejas toca más que los tests

§4.1 dice "se eliminan, junto con sus usos en tests". También hay que revisar el bundle
`es.ts`, el guard de traducción de bundle completo, y el docblock de
`attempt-save-status.tsx`, cuyas decisiones citan el wording viejo (`"Your last attempt
hasn't been saved yet"`). Si el docblock queda citando copy inexistente, el próximo
lector hereda una historia falsa.

---

## MENOR 9 — El ícono sigue abierto y bloquea §4.2

§9 lo admite como único punto abierto, pero §4.2 describe la forma compacta **como
decidida**. No se puede implementar la tabla sin el asset. O se audita `public/art/**`
antes de aprobar el spec, o §4.2 se marca explícitamente como no-implementable todavía.

---

## MENOR 10 — `hub-clean` se declara sin cambio y se pide confirmarlo: elegir uno

§6 dice "no debería cambiar" y luego "afirmarlo con una corrida". Las dos cosas no pueden
ser criterio a la vez. Como el VR corre **sin wallet** y sin wallet no hay cola ni
`canSaveScore`, la predicción es sólida: **declararlo como expectativa y correr el VR una
sola vez al final**, no dejarlo como duda abierta que nadie sabe cuándo se cierra.

---

## MENOR 11 — `clearScoreSession()` en disconnect vs. el gate

`exercises-screen.tsx:449` limpia la sesión al desconectar. Si el jugador desconecta y
reconecta **dentro de la misma visita**, `earnedThisSession` sigue prendido (es por
visita) y el camino B pasará `"allow"` con sesión ya borrada → **prompt tras un
reconnect**, sin que él haya jugado desde entonces. Es defendible (reconectar es un
gesto), pero el spec no lo enumera y su tabla de edge cases dice cubrir los cambios de
wallet.

---

## Lo que resiste

- §2.4 (no hay remount) está **medido**, no supuesto, y cierra bien el bloqueante 3 del v1.
- La elección de `postScoreSave` como punto único de convergencia es **verificable y
  correcta**: dos call sites, un solo seam de sesión.
- Hacer `promptPolicy` obligatorio en vez de opcional es la decisión estructural correcta:
  convierte un olvido en error de compilación, que es exactamente cómo nacieron los dos
  caminos automáticos.
- El eje "origen del intento" (§3.2) está bien fundado en la invariante escrita de
  `session-client.ts:44`.
- §8 ahora sí está verificado contra el código del leaderboard.
