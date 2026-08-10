# Spec — el guardado no embosca: ni el cartel al entrar, ni la firma sin gesto

**Fecha:** 2026-08-09
**Estado:** DRAFT — pendiente de red team y de aprobación del founder
**Origen:** playtest en device del founder ("siento algo invasivo") + consulta a Sally (UX) y Samus (game design)
**Superficie:** `/exercises` (LEARN y PLAY)

---

## 0. El defecto, en una línea

La pantalla intenta cobrar una deuda de infraestructura en el momento exacto en que
el jugador entra a jugar — y en el peor caso le abre la wallet para hacerlo.

Son **tres piezas del mismo defecto**, no tres defectos:

| # | Pieza | Dónde |
| --- | --- | --- |
| 1 | El banner aparece en frío, sin que el jugador haya hecho nada | `components/exercises/attempt-save-status.tsx` + montaje en `exercises-screen.tsx:3768` |
| 2 | La cola rehidratada se drena **sola** al montar (`parked` arranca en `false`) | `lib/scores/use-attempt-outbox.ts:252` |
| 3 | Ese drenado puede llegar a `signMessage` **sin ningún guard de gesto** | `lib/scores/session-client.ts:216` → `authorize()` |

---

## 1. Hechos verificados en código

Todos releídos en `main` durante esta sesión. No se derivan de memoria.

1. **El banner sólo se gatea por `pendingCount > 0`** (`attempt-save-status.tsx:55`). El
   montaje en `exercises-screen.tsx:3768` no tiene condición adicional. Cola vieja
   ⇒ visible al entrar.
2. **La cola sobrevive a cerrar la app** (`chesscito:attempt-outbox:v1`, `attempt-outbox-storage.ts:36`).
3. **`hydrated_from_storage` NO parkea** (`use-attempt-outbox.ts:167-176`): `parked`
   queda en `false`, y el efecto de DRAIN (`:252`) sólo se abstiene si `parked`. El
   drenado dispara sin gesto del jugador.
4. **El seam de envío lleva la firma adentro**: `submitAttempt` pasa
   `signMessage: ({message}) => signMessageAsync({message})` (`exercises-screen.tsx:1136`).
5. **`ensureScoreSession` no tiene guard de interactividad** (`session-client.ts:216-261`):
   si no hay sesión usable en memoria ni en disco, va directo a `authorize(...)` →
   `signMessage`. Nada exige que el llamador venga de un click.
6. ⛔ **Y eso viola una invariante ESCRITA del propio módulo** (`session-client.ts:44-45`,
   textual): *"NUNCA pide firma al montar, al abrir el Hub, ni antes de completar un
   ejercicio — solo en el primer save que realmente se va a escribir."* Nadie mintió:
   la cola se agregó después y nadie releyó el contrato del vecino.
7. **El token dura 2 h / 25 saves** (`session-client.ts:31`) y se persiste a disco
   (`:241`). ⚠️ **Correlación venenosa:** una cola vieja, por definición, sobrevivió a
   un cierre de app; si ese cierre duró más de 2 h —"vuelvo mañana"— el token ya
   expiró. **Cola vieja ⇒ casi seguro sin sesión ⇒ el auto-drain pide firma.** No es
   un edge case: es el camino del jugador que vuelve al día siguiente, que es
   justamente el jugador que la racha entera intenta fabricar.
8. **Un rechazo de firma ya se clasifica `retryable`** (`use-attempt-outbox.ts:118-121`,
   el comentario lo dice explícito). El intento no se pierde nunca.
9. **`report()` se niega sin wallet** (`:312`) — sin wallet no hay cola, ni banner.
10. ⚠️ **`retry()` NO llama a la firma: sólo hace `dispatch({type:"unparked"})`** (`:332-334`).
    **El botón del jugador y el drenado automático corren por el MISMO efecto.** Esto
    es lo que hace que "pasar otro `signMessage` en el camino automático" no sea
    suficiente por sí solo — ver §4.

---

## 1b. La lectura del founder, que es el criterio de aceptación real

> *"Al apenas entrar se siente como que es una app insegura que trata de sacarte tus
> fondos — ese es el comportamiento de ese tipo de apps."*
> — founder, 2026-08-09, jugando en device

⛔ **Esto no es una queja de molestia: es el diagnóstico.** Un pedido de firma no
solicitado al cargar una pantalla **es literalmente la forma de un phishing**. El
jugador no puede distinguir "reentrega administrativa de un intento viejo" de "esta app
me está pidiendo algo raro", porque **desde su lado son idénticos**: no hizo nada y la
wallet se abrió.

En un producto que vive **dentro de una wallet** y cuyo carril on-chain depende de que
una firma signifique algo, esa lectura es el daño más caro que el sistema puede
hacerse.

**Criterio de aceptación:** ninguna entrada a `/exercises` puede abrir la wallet.
Ninguna. Si un cambio deja ese camino abierto "sólo en un caso raro", el cambio no
está terminado.

---

## 2. El principio (de Samus, y es el que ordena todo lo demás)

> **Un aviso sólo puede aparecer como consecuencia de una acción que el jugador acaba
> de hacer. Si aparece sin que él haya jugado, es la máquina hablando de sí misma — y
> eso no va sobre el tablero.**

**Corolario de firma (de Sally, y es el que ordena §4):**

> **El drenado automático puede gastar la RED del jugador sin permiso; nunca puede
> gastar su ATENCIÓN. Una firma es atención.**

Un prompt de wallet **es un modal con otro nombre**: la única superficie que tapa la
app entera con UI de un tercero, sin nuestro copy y sin nuestro control. Este banner
rechazó el modal por buenas razones; aceptar el prompt es aceptar el modal por la
puerta de atrás.

⚠️ Y hay un costo de segundo orden que pesa más que la molestia: el propio repo
argumenta (`session-client.ts:27-29`) que *"un prompt que aparece seguido es un prompt
que el jugador aprende a descartar sin leer, y esa es justo la costumbre de la que
depende el carril on-chain"*. Gastar atención de firma en la reentrega administrativa
de un intento viejo **quema la moneda de confianza que necesita el carril donde una
firma sí mueve dinero**.

---

## 3. Cambio A — el banner sólo habla si el jugador jugó

**Gate maestro: `earnedThisSession`**, que se prende con el primer `report()` de este
montaje y no se apaga. El banner **no puede renderizar con el gate apagado**, sin
importar `pendingCount`. Esa sola condición mata el caso que vio el founder.

| Estado | Entra cuando | Sale cuando | UI |
| --- | --- | --- | --- |
| **S0 · Silent** | default; **toda entrada fría** (`earnedThisSession === false`) | primer `report()` de la sesión | `null` |
| **S1 · Banking** | `earnedThisSession && status === "sending"` | settle (`pendingCount → 0`), o fallo → S2 | pill, **sin** CTA |
| **S2 · Offer** | `earnedThisSession && status === "failed"` | `pendingCount === 0` | pill + hint + CTA |

**Copy exacto (EN)** — reemplaza `ATTEMPT_SAVE_COPY` (`editorial.ts:204`):

```
S1  banking:            "Banking your play…"
    bankingCountFormat: "Banking your plays… ({count})"

S2  offer:              "Your play is safe on this device."
    offerCountFormat:   "{count} plays are safe on this device."
    offerHint:          "Your wallet will ask you to sign. Free — no gas."
    offerCta:           "Sign & save"
    offerCtaAriaLabel:  "Sign in your wallet to save your play"
```

- `"safe on this device"` no acusa **y es literalmente cierto**: nombra dónde está el
  intento, que es la pregunta que el jugador de verdad tiene.
- `offerHint` es la solución del costo oculto: **nombra la firma antes del tap y la
  desarma en la misma respiración**. ⚠️ Ver §3b — **NO se muestra siempre.**
- `"Sign & save"` pone el verbo que se va a ejecutar **en el botón**, no después.
- ⛔ El copy **nunca** dice "on-chain", "mint" ni "gas fee" (brief de lenguaje). El
  `"no gas"` del hint existe para desactivar miedo, no para explicar la cadena.

### 3b. Tamaño: compacto por defecto, palabras sólo donde hacen falta

⚠️ **Tensión real y resuelta.** El founder pidió *"que sea claro pero un ícono, algo un
poquito más reducido"*. La propuesta de UX agregaba una segunda línea de hint, que lo
**agranda**. Las dos cosas son correctas y no se contradicen si el hint deja de ser
permanente:

| Forma | Cuándo | Contenido |
| --- | --- | --- |
| **Compacta** (default) | S1, y S2 **con sesión viva** | ícono + línea corta + CTA. Sin hint. |
| **Con hint** | S2 **sin sesión usable** — el único caso donde el tap abre la wallet | agrega la segunda línea |

El razonamiento: el hint existe para **cotizar la firma antes del tap**. Con sesión
viva el tap **no abre nada**, así que el hint mentiría y además ocuparía espacio por
nada. Se paga el alto extra sólo en el caso que lo justifica — que después del gate de
§3 ya es raro (exige: jugar, fallar la entrega, y no tener sesión).

**Ícono:** reusar un asset canónico existente de `public/art/**`. ⛔ **No crear un SVG
nuevo sin auditar antes lo que ya hay**, y ⛔ **no upscalear** ningún sprite.

**Posición:** sigue `fixed` (esa decisión fue correcta, no se toca). Un cambio: **sólo
en la pantalla del tablero, nunca en el mapa/path** — el founder lo vio en las dos y en
el mapa no tiene razón de existir. Y como S1/S2 ya no pueden preceder a una victoria,
el solapamiento con el tablero dejó de robar nada: cuando aparecen, el tablero ya está
resuelto.

---

## 4. Cambio B — el drenado automático no puede pedir firma

**La regla no es "no drenar".** Si hay sesión viva, drenar en frío y en silencio es el
**mejor resultado del producto entero**: la cola desaparece y el jugador nunca supo que
existió. Parkear siempre mataría ese caso feliz para cubrir uno que se cubre con
precisión.

Lo que se prohíbe es **escalar a una firma sin gesto**.

⚠️ **Cómo, dado el hecho #10.** `retry()` y el auto-drain comparten el efecto, así que
el flag no puede vivir en el call site:

1. El hook lleva un `interactiveRef` (o un campo `interactive` en el estado) que
   **`retry()` prende** y que se apaga cuando la cola drena o vuelve a parkear.
2. El seam recibe esa intención: `submitAttempt(snapshot, { allowPrompt })`.
3. Con `allowPrompt === false`, el `signMessage` que se pasa **rechaza sin abrir la
   wallet**. `postScoreSave` devuelve `{status:"error"}`, y
   `classifyAttemptDelivery` ya lo manda a `retryable` (hecho #8) → parkea, en silencio.
4. **Sólo el tap del jugador pasa el `signMessageAsync` real.**

Cero cambios en el reducer. La cola es at-least-once y persistente: esperar no arriesga
un solo intento.

| Origen del intento | Auto-drain al montar | Con sesión viva | Sin sesión |
| --- | --- | --- | --- |
| Rehidratado (cola vieja) | sí, se intenta | drena invisible ✅ | parkea callado, **sin prompt** ✅ |
| Acuñado en esta sesión | n/a | drena | parkea → S2 ofrece firmar |

---

## 5. Edge cases por estado

⛔ El proyecto exige enumerarlos ANTES de implementar.

| Estado | Caso | Comportamiento |
| --- | --- | --- |
| S0 | Entrada fría, cola vieja, **sesión viva** | Drena solo, invisible, sin prompt. **Mejor caso, preservado a propósito.** |
| S0 | Entrada fría, cola vieja, **sesión expirada** | Rechaza sin firmar → `retryable` → parkea. **Cero prompts, cero banner.** Se dirá en la próxima victoria. |
| S0 | **Sin wallet** | `report()` no encola (#9) → `pendingCount` 0 → S0 permanente. |
| S0 | Lane apagada (`isAttemptLaneEnabled` false) | Hook inerte, cola intacta en disco. Off es pausa, no delete. |
| S0 | Cierra la app con algo in-flight | La cola sobrevive; al volver, S0 (gate apagado). Se recupera en la próxima victoria. |
| S1 | La red muere mid-flight | → S2 en el mismo montaje. Sin culpa en el copy. |
| S1 | Completa un segundo ejercicio mientras el primero vuela | `unparked` + encola; plural. Un solo drain a la vez (FIFO por `inFlightRef`). |
| S2 | **Ignora el banner y sigue jugando** | Próxima completación → `unparked` → S1 → desaparece sola. **El camino feliz es ignorarlo**; el diseño lo premia, no lo castiga. |
| S2 | **Cancela la firma** | Vuelve a S2 con el **mismo copy exacto**. Sin regaño, sin "try again", sin contador, sin cambio de color. Cancelar es una respuesta válida. |
| S2 | **Varios intentos en cola** | Plural. **Una sola firma abre la sesión y drena todos** — jamás un prompt por intento. Si se corta a la mitad, S2 con el count restante. |
| S2 | La cola drena sola con el banner visible | `pendingCount → 0` → desmonta. Sin animación de éxito y **sin chip de "all saved"**: la recompensa de guardar es que el aviso se va. |
| S2 | Cambia de wallet con el banner en pantalla | `wallet_changed` resetea scope y latch → `pendingCount` 0 → S0. La cola de A no se le muestra a B. |
| S2 | Respuesta `terminal` (grading rechazado, `session_exhausted`) | El intento se dropea **sin decirle nada**: no se le reporta una pelea que no puede pelear y que no causó. |

---

## 6. Verificación

⛔ **El VR no sirve para esto y no se va a usar como ancla.** El pill mide ~200×40 ≈
8.000 px, pero el hint de S2 y la diferencia S1/S2 son decenas de píxeles; con
`maxDiffPixelRatio: 0.005` sobre 390×844 la tolerancia es ~1.646 px y se traga la línea
entera sin fallar. **Aserciones de DOM, una por estado.**

Casos obligatorios:

1. Cold mount con cola > 0 → `queryByTestId("attempt-save-status")` es `null`.
2. **Cold mount con cola > 0 y sin sesión → `signMessage` NO fue llamado.** ← el test
   del hallazgo central.
3. Cold mount con cola > 0 y sesión viva → drena, `signMessage` no llamado, banner nunca visible.
4. Post-`report()` con fallo → banner visible, contiene `offerHint`, CTA dice `"Sign & save"`.
5. Tap en CTA → `signMessage` llamado **exactamente una vez** con 3 intentos en cola.
6. Firma cancelada → sigue en S2, mismo texto.
7. Guard de regresión sobre la invariante de `session-client.ts:44`: ningún camino no
   interactivo alcanza `authorize()`.

---

## 7. Fuera de alcance (deliberado)

- **Mudar la cola a Account/perfil** (propuesta de Samus). Es una superficie nueva y
  §3+§4 ya eliminan el defecto reportado. Buena idea, se evalúa después — **no se
  descarta**.
- **El tick pasivo "Saved" en el `PhaseFlash`** (propuesta de Samus). Mismo motivo.
- **El save on-chain** (`submitScoreSigned`, LEADERS y MissionDetailSheet). Es otro
  carril: cuesta gas, es voluntario, y **no se toca**.

---

## 8. Qué pasa si el jugador NUNCA firma

Pregunta del founder, y merece estar en el spec porque es el estado que el diseño tiene
que hacer cómodo, no castigar.

**No pierde nada de lo que ve.** Estrellas, progreso de la pieza, el contador `8/8+`,
la insignia y la racha viven en `localStorage` (`chesscito:progress:<pieza>`) y **no
dependen de este POST**. El intento queda en el disco del teléfono, sobrevive a cerrar
la app, y se reintenta **solo** en la próxima completación. Es at-least-once: no se
descarta nunca.

**Lo único que no ocurre** es que la jugada llegue al servidor — o sea, no cuenta para
el **leaderboard** ni para las **stats**.

⛔ **Cancelar es una respuesta válida y el sistema la trata como tal:** vuelve a S2 con
el mismo texto, sin regaño, sin "try again", sin contador de intentos y sin cambio de
color. Y el camino de no hacer nada **también funciona**: la cola se drena sola la
próxima vez que gane.

---

## 9. Open questions

1. ¿El `earnedThisSession` sobrevive a un cambio de pieza dentro del mismo montaje?
   (Propuesta: sí — es por montaje, no por pieza.)
2. ✅ Resuelta en §3b: el `offerHint` se condiciona a "no hay sesión usable".
3. ¿Qué ícono canónico usa la forma compacta? Exige auditar `public/art/**` antes de
   dibujar nada.
