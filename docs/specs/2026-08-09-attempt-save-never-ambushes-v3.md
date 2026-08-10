# Spec v3 — el guardado no embosca

**Fecha:** 2026-08-09
**Estado:** DRAFT v3 — reescrito tras el red team del v2
**Reemplaza:** v1 (NO READY) y v2 (NO READY)
**Red teams:** `…-redteam.md` (v1) · `…-v2-redteam.md` (v2)
**Origen:** playtest del founder + Sally (UX) + Samus (game design)

---

## 0. Por qué hay un v3, y qué cambia de forma

Las dos rondas fallaron por el **mismo patrón**: el candado se puso en un camino y quedó
otro abierto.

| Versión | Dónde puso el candado | Puerta que quedó |
| --- | --- | --- |
| v1 | El drenado de la cola de intentos | El auto-save del score (`exercises-screen.tsx:2505`) |
| v2 | `postScoreSave` | Su **segunda** llamada a `ensureScoreSession` (`save-client.ts:186`) |

⛔ **El v3 deja de tapar caminos.** El candado se mueve a **`ensureScoreSession`**: la
única función que puede abrir la wallet, y a la que llama **un solo módulo**
(`save-client.ts`, verificado: no hay otros callers). Si esa función **no compila** sin
que le declaren el derecho a interrumpir, no queda dónde olvidarse.

**El criterio de diseño del v3:** no "acordarse de pasar el flag", sino **que no exista
una forma de no pasarlo**.

---

## 1. El defecto y el criterio de aceptación

> *"Al apenas entrar se siente como que es una app insegura que trata de sacarte tus
> fondos."* — founder, en device

Un pedido de firma no solicitado al cargar una pantalla **es la forma de un phishing**.
Desde el lado del jugador, "reentrega de un intento viejo" y "esta app me pide algo raro"
son indistinguibles: no hizo nada y la wallet se abrió.

**CRITERIO DE ACEPTACIÓN, único:**

> **Ninguna entrada a `/exercises` puede abrir la wallet.**

---

## 2. Hechos verificados en código

### 2.1 Los DOS caminos automáticos

**A — drenado de la cola.** Persiste en `localStorage` (`attempt-outbox-storage.ts:36`),
sobrevive a cerrar la app; `hydrated_from_storage` **no parkea**
(`use-attempt-outbox.ts:167-176`) → el efecto de DRAIN (`:252`) dispara solo al montar.

**B — auto-save del score** (`exercises-screen.tsx:2505`), el que el v1 no vio:

```
scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore  (:1415)
canSaveScore    = Boolean(address) && isConnected && isCorrectChain && levelId > 0n  (:1392)
```

Se satisface **al montar**, sin gesto. `lastSavedScore` sale de `localStorage`.

### 2.2 El seam de firma, y la invariante que ya estaba escrita

`ensureScoreSession` (`session-client.ts:216-261`): sin sesión usable, va directo a
`authorize(...)` → `signMessage`. Sin guard.

⛔ Viola una invariante **escrita en el propio módulo** (`session-client.ts:44-45`):
*"NUNCA pide firma al montar, al abrir el Hub, ni antes de completar un ejercicio — solo
en el primer save que realmente se va a escribir."*

⚠️ Lo que esa invariante **sí autoriza**: después de completar un ejercicio, la firma es
legítima. Ese es el eje.

### 2.3 Token: 2 h / 25 saves, persistido — y dos formas de morir

`session-client.ts:31` y `:241`. Muere de **dos** maneras, y el v2 sólo vio una:

1. **Vencido localmente** (`expiresAt` pasado) → la primera llamada ya no lo usa.
2. ⚠️ **Vivo local, muerto server-side** (revocado, agotado) → la primera llamada **lo
   usa sin firmar**, el POST vuelve con un `SESSION_DEAD_REASONS` (`save-client.ts:89-94`),
   y la **re-autorización de `:186`** abre la wallet.

Cola vieja ⇒ sobrevivió a un cierre de app ⇒ si duró más de 2 h, alguna de las dos
aplica. **Es el camino del jugador que vuelve al día siguiente.**

### 2.4 `/exercises` NO remonta al cambiar de pieza — MEDIDO

- `selectedPiece` es estado del componente (`:489`); los cambios son `setSelectedPiece`.
- `page.tsx:122` monta `<ExercisesScreen>` **sin `key`** → un cambio de searchParam
  re-renderiza sin desmontar.
- El mapa es un drawer de la misma pantalla (`exerciseDrawerOpen`, `:748`).

**Un montaje = una visita real a la ruta.**

### 2.5 Superficie de convergencia — verificada

- `postScoreSave`: **2 call sites** (`:1130`, `:2380`).
- `ensureScoreSession`: llamado **sólo** desde `save-client.ts` (`:163`, `:186`).
- Un rechazo de firma ya es `retryable` (`use-attempt-outbox.ts:118-121`): **el intento
  nunca se pierde**.
- `retry()` no firma: sólo `unparked` (`:332-334`).
- El leaderboard rankea sobre `total_score` agregado server-side (`queries.ts:311`): ese
  dato **sólo existe si el POST llegó**.

---

## 3. Cambio A — el candado vive en el otorgante del permiso

### 3.1 `ensureScoreSession` exige declarar el derecho a interrumpir

`EnsureScoreSessionInput` suma un campo **requerido, sin default**:

```ts
/** ⛔ REQUERIDO. Un default convierte "nadie lo pensó" en "permitido", que es
 *  exactamente como nacieron los dos caminos automáticos. */
promptPolicy: "allow" | "deny";
```

Con `"deny"`, la función **no llama a `authorize()`**: devuelve
`{ ok: false, error: "session_required" }`.

⛔ **Y `postScoreSave` debe pasarlo en sus DOS llamadas** (`:163` y `:186`) — el
bloqueante del v2. Como el campo es requerido, `tsc` obliga a la segunda tanto como a la
primera: **la fuga se vuelve inexpresable**, no "algo a recordar".

⚠️ Esto también resuelve el MENOR 10 del v1: "ningún camino no interactivo alcanza
`authorize()`" no se puede probar con un test de comportamiento (es una cuantificación
universal sobre caminos). Un campo obligatorio la convierte en **error de compilación**.

### 3.1-bis Precisiones incorporadas del red team del v3

**a) El permiso NO se deriva de `silent`** (MAYOR 1). Hoy los dos usos comparten función y
sólo los separa un flag de **presentación**:

```
exercises-screen.tsx:2510   void handleSubmitScore({ silent: true });    // automático
exercises-screen.tsx:3826   onRetrySave={() => void handleSubmitScore()} // tap
```

Derivar `promptPolicy` de `silent` ataría el **permiso de interrumpir** a una decisión de
**UI** — la misma confusión de categorías que produjo el bug original. `handleSubmitScore`
toma **dos ejes con dos nombres**: `{ silent: boolean; promptPolicy: "allow" | "deny" }`.

**b) Un `deny` nunca espera una firma ajena** (MENOR 3). `ensureScoreSession:255`
coalescea concurrentes (`if (inFlight) return inFlight`). Si el camino live abrió un
prompt, un drenado `deny` recibiría **la misma promesa** y quedaría bloqueado mientras el
modal siga abierto — y con él el `inFlightRef` del outbox, que serializa la cola. **Con
`"deny"` se retorna ANTES del coalescing.**

**c) El borrado de sesión de la re-auth se condiciona al policy** (MENOR 4).
`save-client.ts:185` hace `clearScoreSession()` antes de la segunda llamada. Con `"deny"`
eso le cuesta al jugador **la sesión que tenía** por un intento de fondo que no inició, y
ante un rechazo transitorio el próximo tap suyo pediría una firma evitable.
**Decisión: con `"deny"` NO se limpia** — no vamos a destruir credenciales del jugador en
un camino que ni siquiera tiene derecho a pedirle una nueva. Con `"allow"` se limpia como
hoy.

**d) Mecánica de tests** (MENORES 6 y 7). Antes de escribir: confirmar cómo se apaga
`isAttemptLaneEnabled` (si resuelve por env en tiempo de módulo, hace falta `vi.mock`).
Y **cada caso lleva su nivel**: los de token vivo-local/muerto-server son de **unidad de
`save-client`** con `fetch` falso — no se pueden montar con RTL.

### 3.2 `deny` NO es un fallo — es "ahora no"

MAYOR 2 del v2: hoy cualquier error del auto-save prende `autoSaveFailed`
(`exercises-screen.tsx:2510`), que viaja como `saveFailed` a `MissionDetailSheet`
(`:3825`) con su botón de reintento. Sin esto, **una entrada fría pintaría un estado de
fallo por algo que el jugador nunca hizo** — el cartel mudado adentro de la hoja.

`session_required` se propaga como razón distinguible y:

- **NO** prende `autoSaveFailed`.
- **NO** cuenta como intento fallido en telemetría de error.
- **SÍ** deja el intento en la cola (`retryable`, §2.5).

### 3.3 El eje es el ORIGEN, no el tap

| Origen | `promptPolicy` | Por qué |
| --- | --- | --- |
| **Rehidratado** (cola vieja, o `scorePendingNew` satisfecho al montar) | `"deny"` | El jugador no hizo nada. |
| **Live** (completó un ejercicio en esta visita) | `"allow"` | `session-client.ts:44` lo autoriza. Él está mirando: la firma se lee como *firmo mi victoria*. |
| **Explícito** (tap en el CTA, o `onRetrySave` de la hoja) | `"allow"` | Lo pidió. |

**La señal:** `earnedThisSession`, que se prende con la primera completación de la visita.

⛔ **Vive en el HOST y NO depende de la lane** (MAYOR 4 del v1 + MAYOR 5 del v2):

- Si viviera dentro de `report()` **después del latch** (`use-attempt-outbox.ts:313-315`),
  un jugador que **repite** un ejercicio ya resuelto —caso normal, todo resuelto es
  rejugable— no lo prendería.
- Si dependiera de `isAttemptLaneEnabled`, con la lane apagada `report()` sale primero
  (`:309`), el gate nunca se prende, y **el auto-save del score se apagaría entero**. La
  lane significa "pausa del carril de intentos", no "romper el guardado".

### 3.4 El camino B tiene que poder reintentar cuando el gate se prende

MAYOR 3 del v2. Hoy:

```
}, [scorePendingNew, isSubmitBusy, localScoreNum]);   // :2514 — sin earnedThisSession
autoSavedScoreRef.current = localScoreNum;            // :2508 — latchea ANTES de llamar
```

Prender el gate no re-ejecuta el efecto, y aunque lo hiciera, el ref ya iguala. Un replay
que no mejora el score dejaría la jugada sin guardar toda la visita, **sin banner que lo
diga** (el banner mira la cola del camino A).

**Cambios:**
1. `earnedThisSession` entra en las deps del efecto.
2. El latch del ref **sólo se consuma si el intento no fue `session_required`** — un
   `deny` no puede quemar el turno.

---

## 4. Cambio B — ⛔ NO HAY BANNER (decisión del founder, 2026-08-09)

> *"¿Ya no tendríamos banner, cierto? Porque eso para mí es un win: que no moleste,
> exista, ayude cuando se necesita y no meta más gráficos/iconos/assets. Creo que antes
> teníamos algo así y no sé cuándo lo convertimos en un banner todo feo que estorba."*

**Tenía razón, y es verificable.** El banner nació el **2026-07-28** (`c2d43872`,
etapa 4C-3) por decisión suya: *"los fallos retryable siguen SIN timer automático, pero
ahora hay reintento manual visible. Antes un intento fallido era invisible y esperaba
callado a la próxima completación."*

**Por qué se revierte ahora, y por qué no es contradecirse:** el banner existía para
resolver *"el jugador no tiene forma de saber ni de pedir"*. Con el dato que entonces
nadie tenía —que ese camino puede **abrir la wallet**— la ecuación se da vuelta:

- **Pedir** el reintento le cuesta **una firma**.
- **No pedir nada** le cuesta **cero**: la próxima completación drena la cola igual.

O sea, el botón dejó de ser un servicio y pasó a ser una forma de que el jugador pague
por algo que el sistema iba a hacer gratis. Es la posición que Samus recomendó
independientemente ("sacalo de la pantalla de juego, cero estados").

### 4.1 Qué se elimina

`AttemptSaveStatus` se **borra** de `/exercises`, con todo lo que colgaba de él. Esto
cancela, del propio v3:

| Ya no hace falta | Por qué |
| --- | --- |
| Estados S0 / S1 / S2 | No hay superficie que los muestre |
| Las 7 claves de copy nuevas y la migración de las 6 viejas | Se eliminan las 6 y no entran las 7 |
| El ícono (`exercises.save-score`) | No hay dónde ponerlo |
| `hasUsableScoreSession()` y su decisión de reactividad | Existía sólo para condicionar el hint |
| La regla de ocultarlo con `exerciseDrawerOpen` | No hay qué ocultar |
| La clase `.attempt-save-status` en `globals.css` | Queda huérfana |

⚠️ **`earnedThisSession` SE MANTIENE.** No era del banner: es la señal que separa
"rehidratado" de "live" y decide el `promptPolicy` de §3.3. Es el corazón del fix.

### 4.2 El comportamiento resultante, completo

- **Al entrar:** intento silencioso. Con sesión viva, drena y nadie se entera. Sin
  sesión, parkea callado. **Sin wallet, sin cartel, sin nada.**
- **Al ganar un ejercicio:** se manda, y ahí la firma es legítima (§3.3). Si falla, la
  jugada queda en la cola **en silencio**.
- **La cola se drena sola** en la próxima completación exitosa.
- **Si nunca se entrega:** ver §8 — no pierde nada visible; sólo no cuenta para el
  leaderboard.

### 4.3 El único caso que esto descubre, y dónde va

Sally lo marcó: si la entrega falla **siempre**, el jugador nunca se entera de que sus
jugadas no llegan. Es real, y la respuesta **no** es un cartel sobre el tablero:

> Una línea discreta en **Account** con el conteo pendiente y, ahí sí, un botón. Es el
> único lugar del producto donde un pedido de firma es **esperado y legible**: fue a la
> pantalla de su cuenta, tocó un botón de su cuenta, el sistema le pide credenciales de
> su cuenta. Un lugar que **visita**, no un cartel que lo visita a él.

⚠️ **Sigue fuera de alcance de este spec** (§7) — es superficie nueva y el defecto se
cierra sin ella. Pero pasa de "idea de Samus" a **el destino acordado** de esa
información, para que la próxima sesión no reinvente un banner.

---

## 4-bis. (Derogado) — el banner que este spec proponía

**Gate:** `earnedThisSession` (§3.3). Sin él, el banner **no renderiza**, sin importar
`pendingCount`.

| Estado | Entra cuando | Sale cuando | UI |
| --- | --- | --- | --- |
| **S0 · Silent** | default; **toda entrada fría** | primera completación de la visita | `null` |
| **S1 · Banking** | `earnedThisSession && status === "sending"` | settle, o fallo → S2 | compacta, **sin** CTA |
| **S2 · Offer** | `earnedThisSession && status === "failed"` | `pendingCount === 0` | compacta + CTA (+ hint si aplica) |

### 4.1 Copy (EN)

```
S1  banking:            "Banking your play…"
    bankingCountFormat: "Banking your plays… ({count})"

S2  offer:              "Your play is safe on this device."
    offerCountFormat:   "{count} plays are safe on this device."
    offerHint:          "Your wallet will ask you to sign. Free — no gas."
    offerCta:           "Sign & save"
    offerCtaAriaLabel:  "Sign in your wallet to save your play"
```

**Migración de copy** (MENOR 8 del v2). Se eliminan las 6 claves viejas (`saving`,
`savingCountFormat`, `failed`, `failedCountFormat`, `retryCta`, `retryAriaLabel`) y hay
que tocar, en el mismo commit:

1. `editorial.ts` — las 7 nuevas.
2. `messages/es.ts` — las 7, o next-intl imprime el path crudo.
3. Los tests que consumen las viejas.
4. ⚠️ **El docblock de `attempt-save-status.tsx`**, que cita el wording viejo
   (*"Your last attempt hasn't been saved yet"*). Si queda citando copy inexistente, el
   próximo lector hereda una historia falsa.

⚠️ **Excepción de brief, declarada:** `"Free — no gas"` roza el vocabulario de cadena que
el brief evita. Se acepta con criterio explícito — existe para **desactivar el miedo al
costo**, no para explicar la cadena. Si `content:audit` la marca, se documenta; no se
borra sin un reemplazo que cotice el costo.

### 4.2 Tamaño e ícono

> *"Que sea claro pero que sea un ícono, algo un poquito más reducido."* — founder

| Forma | Cuándo | Contenido |
| --- | --- | --- |
| **Compacta** (default) | S1, y S2 **con sesión usable** | ícono + línea corta + CTA. **Sin hint.** |
| **Con hint** | S2 **sin sesión usable** — el único caso donde el tap abre la wallet | + segunda línea |

Con sesión viva el tap no abre nada: el hint mentiría y ocuparía alto por nada.

✅ **Ícono resuelto** (cerraba la última open question del v2). Se reusa el asset canónico
**`exercises.save-score`** — un cofre con estrella
(`/art/new-icons-chesscito/save-score-icon-v1`), ya registrado en
`theme-registry.ts:862` y ya usado por `action-pin.tsx` para "submit score". **Mismo
significado, otra superficie:** no se inventa iconografía ni se colisiona con una
existente. Y el cofre refuerza el encuadre de premio que pidió el founder.

⛔ Se consume **por el slot, vía `ThemeAssetPicture`**, nunca por path crudo: un `/art/...`
escrito en JS también tiene que pasar por el resolver de temas.

### 4.3 Saber si hay sesión usable — API nueva, especificada

MAYOR 4 del v2: hoy eso es privado de `session-client.ts` (el `cached` de módulo +
`localStorage`, evaluado por `isUsable`, no exportado). Se agrega:

```ts
/** Sólo lectura. No acuña, no borra, no promete: responde si HOY hay token usable. */
export function hasUsableScoreSession(wallet: string, surface: ScoreSaveSurface): boolean;
```

⚠️ **Reactividad, decidida:** se lee **en el momento de entrar a S2**, no en cada render.
Un token puede vencer con el banner en pantalla; si eso pasa, el hint no aparece y el tap
abre la wallet sin haberla anunciado. **Se acepta**: es una ventana de minutos, el costo
es un prompt anunciado a medias —no un prompt sorpresa al entrar, que es lo que este
spec existe para matar— y hacerlo reactivo obligaría a un timer que despierta la pantalla
por nada. Documentado como límite conocido, no como olvido.

### 4.4 Posición

Sigue `fixed` (decisión correcta del cluster anterior). Un cambio: **oculto mientras el
mapa está abierto**, condición concreta `exerciseDrawerOpen` (`:748`).

---

## 5. Edge cases

| Estado | Caso | Comportamiento |
| --- | --- | --- |
| S0 | Entrada fría, **sesión viva** | Los dos caminos drenan solos, invisibles. **Mejor caso, preservado.** |
| S0 | Entrada fría, **token vencido local** | `deny` en la 1ª llamada → `session_required` → parkea. Cero prompts, cero banner. |
| S0 | ⚠️ Entrada fría, **token vivo local / muerto server** | 1ª llamada no firma (usa cache) → POST rechazado → **la re-auth de `:186` también recibe `deny`** → `session_required`. **Cero prompts.** ← el bloqueante del v2 |
| S0 | **Sin wallet** | `report()` no encola; `canSaveScore` false. S0 permanente. |
| S0 | **Lane apagada** | El gate no depende de la lane (§3.3): el camino B sigue guardando normalmente. |
| S0 | Cambia de pieza / abre el mapa | **No remonta** (§2.4): el gate no se apaga. |
| S1 | La red muere mid-flight | → S2 en la misma visita. Sin culpa en el copy. |
| S1 | Gana un 2º ejercicio con el 1º en vuelo | `unparked` + encola; plural. Un drain a la vez (FIFO por `inFlightRef`). |
| S2 | **Ignora el banner y sigue jugando** | Próxima completación → S1 → desaparece sola. **El camino feliz es ignorarlo.** |
| S2 | **Cancela la firma** | Vuelve a S2, **mismo copy**. Sin regaño, sin "try again", sin contador, sin cambio de color. |
| S2 | **Varios intentos en cola** | Plural. **Una firma drena todos**; jamás un prompt por intento. |
| S2 | Drena sola con el banner visible | Desmonta. Sin animación de éxito y **sin chip de "all saved"**. |
| S2 | Cambia de wallet | `wallet_changed` resetea scope y latch → S0. |
| S2 | ⚠️ **Desconecta y reconecta en la misma visita** (MENOR 11 del v2) | `clearScoreSession()` corre al desconectar (`:449`), pero **`earnedThisSession` NO se resetea**: es por visita, y el jugador efectivamente jugó. Al reconectar, el camino live puede pedir firma. **Aceptado**: reconectar es un gesto explícito y el prompt es legible. |
| S2 | **Presupuesto agotado (25 saves)** | `session_exhausted` es **terminal**: se dropea el intento y el banner **NO** ofrece firmar de nuevo — otra firma acuñaría una sesión para volver a agotarla, que es el bucle que este spec impide. ⛔ 25 saves / 2 h es un techo que un jugador normal no toca. |
| S2 | `terminal` por grading rechazado | Se dropea **sin decirle nada**: no se le reporta una pelea que no puede pelear. |

---

## 6. Verificación

⛔ **El VR no es ancla.** El pill ronda 200×40 ≈ 8.000 px, pero el hint y la diferencia
S1/S2 son decenas de píxeles; la tolerancia de `hub-clean` (~1.646 px) se los traga.
**Aserciones de DOM, una por estado.**

**Expectativa declarada sobre `hub-clean`** (MENOR 10 del v2): **no cambia**, porque el VR
corre sin wallet y sin wallet no hay cola (`report()` se niega) ni `canSaveScore`. Se
corre **una sola vez al final** del cluster para confirmarlo, con
`--project=minipay --update-snapshots=none` y el 3002 libre.

⚠️ **Los casos 1, 10, 11, 12 y 13 quedaron derogados por §4** (eran del banner). Se
reemplazan por **un solo caso**: `AttemptSaveStatus` no se monta en ningún estado.

### Casos obligatorios

1. **En ningún estado se renderiza `attempt-save-status`** — cola vacía, cola llena,
   `sending`, `failed`, antes y después de completar. Es un caso de ausencia, y ausencia
   es lo único que el VR nunca puede afirmar.
2. Cold mount, cola > 0, sin sesión → **`signMessage` NO llamado** (camino A).
3. Cold mount, `scorePendingNew` true, sin sesión → **`signMessage` NO llamado**
   (camino B). ⚠️ **Con la lane de intentos APAGADA**, para probar que B está guardado
   por su cuenta.
4. ⚠️ **Token vivo-local / muerto-server → `signMessage` NO llamado.** ← el bloqueante
   del v2; el POST devuelve `invalid_session` y la re-auth debe respetar `deny`.
5. `deny` en frío → **`autoSaveFailed` sigue false** y la hoja de misión no muestra fallo.
6. Cold mount con sesión viva → drena, banner nunca visible, `signMessage` no llamado.
7. Completar un ejercicio sin sesión → `"allow"` → `signMessage` llamado **una vez**.
8. Repetir un ejercicio ya resuelto (sin mejorar score) → el gate se prende **y** el
   camino B reintenta (§3.4).
9. Con la lane apagada, completar un ejercicio → el camino B guarda igual.
10. S2 con sesión usable → **sin** `offerHint`; sin sesión → **con** hint. CTA
    `"Sign & save"`.
11. Tap en CTA con 3 intentos en cola → `signMessage` **exactamente una vez**.
12. Firma cancelada → sigue en S2, mismo texto.
13. `exerciseDrawerOpen === true` → banner oculto.
14. **Compile-time** (MENOR 7 del v2): un `@ts-expect-error` sobre una llamada a
    `ensureScoreSession` sin `promptPolicy`. Falla si el error **desaparece** — o sea, si
    alguien le pone un default.

⚠️ **Presupuesto que el plan reconoce** (MENOR 6 del v2): volver el campo obligatorio
rompe todas las suites que construyen la entrada (`lib/scores/__tests__/**` y las de la
ruta). Es trabajo previsible, va en el mismo commit.

---

## 7. Fuera de alcance (deliberado, NO descartado)

- **Mudar la cola a Account/perfil** (Samus) — superficie nueva; §3+§4 ya cierran el defecto.
- **Tick pasivo "Saved" en el `PhaseFlash`** (Samus) — mismo motivo.
- **El save on-chain** (`submitScoreSigned`, LEADERS y MissionDetailSheet) — otro carril,
  cuesta gas, es voluntario. **No se toca.**

---

## 8. Qué pasa si el jugador NUNCA firma

**No pierde nada de lo que ve.** Estrellas, progreso de pieza, el `8/8+`, la insignia y la
racha viven en `localStorage` y no dependen de este POST. El intento queda en el disco del
teléfono, sobrevive a cerrar la app, y se reintenta solo en la próxima completación.
At-least-once: no se descarta nunca.

**Lo único que no ocurre** es que la jugada llegue al servidor: no cuenta para el
**leaderboard** (que rankea sobre `total_score` agregado server-side, §2.5) ni para las
**stats**.

⛔ Cancelar es una respuesta válida y el sistema la trata como tal. No hacer nada también
funciona.

---

## 9. Open questions

Ninguna. El ícono se resolvió en §4.2 y la reactividad del hint en §4.3.
