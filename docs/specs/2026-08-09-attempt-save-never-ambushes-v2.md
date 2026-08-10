# Spec v2 — el guardado no embosca

**Fecha:** 2026-08-09
**Estado:** DRAFT v2 — reescrito tras el red team del v1
**Reemplaza:** `2026-08-09-attempt-save-never-ambushes.md` (v1, NO READY)
**Red team del v1:** `2026-08-09-attempt-save-never-ambushes-redteam.md`
**Origen:** playtest del founder + consulta a Sally (UX) y Samus (game design)

---

## 0. Qué cambió respecto del v1

El red team encontró que **el v1 apuntaba a un solo mecanismo de dos**. Los tres
bloqueantes, resueltos:

| # | Bloqueante v1 | Resolución en v2 |
| --- | --- | --- |
| 1 | El v1 sólo guardaba el drenado de la cola; hay un **segundo** disparo automático a la firma | §3: el guard se mueve al punto de convergencia y se vuelve **obligatorio por tipos** |
| 2 | `allowPrompt` atado a "interactividad" | §3: el eje es el **origen** del intento, no el tap |
| 3 | `earnedThisSession` "por montaje" indefinido | **MEDIDO** — ver §2. Queda bien definido |

---

## 1. El defecto

La pantalla intenta cobrar una deuda de infraestructura en el momento en que el jugador
entra a jugar — y en el peor caso le abre la wallet para hacerlo.

> *"Al apenas entrar se siente como que es una app insegura que trata de sacarte tus
> fondos — ese es el comportamiento de ese tipo de apps."* — founder, en device

⛔ **Eso no es una queja de molestia: es el diagnóstico.** Un pedido de firma no
solicitado al cargar una pantalla **es la forma de un phishing**. Desde el lado del
jugador, "reentrega administrativa de un intento viejo" y "esta app me está pidiendo
algo raro" son indistinguibles: no hizo nada y la wallet se abrió.

**CRITERIO DE ACEPTACIÓN, único e innegociable:**

> **Ninguna entrada a `/exercises` puede abrir la wallet.** Si un cambio deja ese camino
> abierto "sólo en un caso raro", el cambio no está terminado.

---

## 2. Hechos verificados en código

Releídos en `main` durante esta sesión.

### 2.1 Los DOS caminos automáticos a la firma

**Camino A — el drenado de la cola de intentos.**
La cola persiste en `localStorage` (`attempt-outbox-storage.ts:36`) y sobrevive a cerrar
la app. `hydrated_from_storage` **no parkea** (`use-attempt-outbox.ts:167-176`), así que
el efecto de DRAIN (`:252`) dispara solo al montar. `submitAttempt` pasa la firma real
(`exercises-screen.tsx:1136`).

**Camino B — el auto-save del score.** ⚠️ **El que el v1 no vio.**

```
useEffect(() => {
  if (!scorePendingNew || isSubmitBusy) return;
  ...
  void handleSubmitScore({ silent: true });          // exercises-screen.tsx:2505
}, [scorePendingNew, isSubmitBusy, localScoreNum]);
```

`handleSubmitScore` llama `postScoreSave` con la firma real (`:2391`). Y su condición se
satisface **al montar**, sin gesto:

```
scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore   (:1415)
canSaveScore    = Boolean(address) && isConnected && isCorrectChain && levelId > 0n   (:1392)
```

`lastSavedScore` sale de `localStorage`; `totalStars`, del progreso local. **Ninguno de
los cuatro términos exige un click.** Con la cola vacía y el banner apagado, entrar con
wallet conectada y progreso sin confirmar **basta** para abrir la wallet.

⚠️ **Es el sospechoso más probable del prompt que vio el founder** — su estado (`8/8+`,
sin jugar hacía días) satisface la condición exactamente.

### 2.2 El seam de firma no tiene guard

`ensureScoreSession` (`session-client.ts:216-261`): sin sesión usable en memoria ni en
disco, va directo a `authorize(...)` → `signMessage`. Nada exige que el llamador venga
de un gesto.

⛔ **Y eso viola una invariante ESCRITA del propio módulo** (`session-client.ts:44-45`,
textual): *"NUNCA pide firma al montar, al abrir el Hub, ni antes de completar un
ejercicio — solo en el primer save que realmente se va a escribir."* Nadie mintió: los
dos caminos automáticos se agregaron después y nadie releyó el contrato del vecino.

⚠️ Nótese lo que la invariante **sí** autoriza: *"el primer save que realmente se va a
escribir"* — o sea, **después de completar un ejercicio la firma es legítima.** Ese es
el eje correcto, y el v1 lo tenía mal.

### 2.3 El token y la correlación venenosa

Dura **2 h / 25 saves** (`session-client.ts:31`) y se persiste a disco (`:241`). Una cola
vieja, por definición, sobrevivió a un cierre de app; si ese cierre duró más de 2 h
—"vuelvo mañana"— **el token ya expiró**. Cola vieja ⇒ casi seguro sin sesión ⇒ el
disparo automático pide firma. No es un edge case: **es el camino del jugador que vuelve
al día siguiente**, que es el que la racha entera intenta fabricar.

### 2.4 `/exercises` NO remonta al cambiar de pieza — MEDIDO

Resuelve el bloqueante 3 y la open question #1 del v1.

- `selectedPiece` es estado del componente (`exercises-screen.tsx:489`), y los cambios de
  pieza son `setSelectedPiece` (`:4516`, `:4297`, `:4474`) — estado, no navegación.
- `page.tsx:122` monta `<ExercisesScreen>` **sin `key`**: un cambio de searchParam
  re-renderiza el server component y React reconcilia el mismo tipo en la misma posición
  → **no desmonta**.
- El mapa/path es un **drawer dentro de la misma pantalla** (`exerciseDrawerOpen`, `:748`).

**Conclusión:** un montaje = **una visita real a la ruta**. `earnedThisSession` queda
bien definido y no se apaga al cambiar de pieza ni al abrir el mapa.

### 2.5 Otros hechos que el diseño usa

- Un rechazo de firma ya se clasifica `retryable` (`use-attempt-outbox.ts:118-121`): el
  intento **no se pierde nunca**.
- `report()` se niega sin wallet (`:312`) y tiene un latch de completación (`:313-315`).
- `retry()` **no firma**: sólo `dispatch({type:"unparked"})` (`:332-334`). El tap y el
  drenado automático corren por **el mismo efecto**.
- El leaderboard rankea sobre `total_score` agregado server-side (RPC
  `get_weekly_leaderboard`, `queries.ts:311`): ese dato **sólo existe si el POST llegó**.

---

## 3. Cambio A — el guard vive donde los dos caminos convergen, y lo impone `tsc`

⛔ **No en el outbox.** El v1 falló por poner el guard en un mecanismo; el otro quedó
vivo. Los dos caminos pasan por **`postScoreSave`**, y ahí va.

### 3.1 `promptPolicy` pasa a ser un campo REQUERIDO

`ScoreSaveClientInput` (`save-client.ts`) suma:

```ts
/** Whether this call may open the wallet to mint a session.
 *  ⛔ REQUIRED, sin default: un default convierte "nadie lo pensó" en
 *  "permitido", que es exactamente cómo nacieron los dos caminos automáticos. */
promptPolicy: "allow" | "deny";
```

Con `"deny"`, `ensureScoreSession` no llama a `signMessage`: devuelve
`{ok:false, error:"session_required"}` → `postScoreSave` devuelve `{status:"error"}` →
`classifyAttemptDelivery` ya lo manda a `retryable` (§2.5) → parkea, en silencio.

⚠️ **Por qué requerido y no opcional:** resuelve el MENOR 10 del red team. "Ningún camino
no interactivo alcanza `authorize()`" no se puede probar con un test de comportamiento —
es una cuantificación universal sobre caminos. Un campo obligatorio la vuelve **un error
de compilación**: todo call site futuro está forzado a decidir, y el agujero no se puede
reabrir en silencio.

### 3.2 El eje es el ORIGEN, no el tap

| Origen | `promptPolicy` | Por qué |
| --- | --- | --- |
| **Rehidratado** (cola vieja, o `scorePendingNew` satisfecho al montar) | `"deny"` | El jugador no hizo nada. Es la máquina hablando de sí misma. |
| **Live** (completó un ejercicio en esta visita) | `"allow"` | `session-client.ts:44` lo autoriza: es "el primer save que realmente se va a escribir". Él está mirando, entiende el contexto, y la firma se lee como *firmo mi victoria*. |
| **Explícito** (tap en el CTA) | `"allow"` | Lo pidió. |

**La señal que separa "rehidratado" de "live" es una sola y sirve a los dos caminos:**
`earnedThisSession` — se prende con el primer `report()` de esta visita.

⚠️ **Debe prenderse en el HOST, antes del latch de `report()`** (MAYOR 4 del red team):
si viviera dentro del hook después del `seenRef`, un jugador que **repite** un ejercicio
ya resuelto —caso normal y soportado: todo ejercicio resuelto es rejugable— no lo
prendería, y el banner nunca aparecería aunque su intento fallara.

**Aplicación a los dos caminos:**

- Camino A (`submitAttempt`): `promptPolicy: earnedThisSession ? "allow" : "deny"`.
- Camino B (auto-save, `:2510`): **la misma expresión**. El tap manual de
  `handleSubmitScore` no silencioso pasa `"allow"`.

---

## 4. Cambio B — el banner sólo habla si el jugador jugó

**Gate:** `earnedThisSession` (el mismo de §3.2). El banner **no puede renderizar con el
gate apagado**, sin importar `pendingCount`. Eso mata el caso que vio el founder.

| Estado | Entra cuando | Sale cuando | UI |
| --- | --- | --- | --- |
| **S0 · Silent** | default; **toda entrada fría** | primer `report()` de la visita | `null` |
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

⛔ **Las 6 claves viejas** (`saving`, `savingCountFormat`, `failed`, `failedCountFormat`,
`retryCta`, `retryAriaLabel`) **se eliminan**, junto con sus usos en tests (MENOR 9).
Las 7 nuevas van a `editorial.ts` **y** a `messages/es.ts` — sin la entrada ES, next-intl
imprime el path crudo.

⚠️ **Excepción de brief declarada** (MENOR 8): el brief prohíbe hablar de cadena, y
`"Free — no gas"` la roza. Se acepta **con criterio explícito**: la frase existe para
**desactivar el miedo al costo**, no para explicar la cadena — es la mitad que evita el
pánico en MiniPay. Si `pnpm content:audit` la marca, se documenta la excepción; no se
borra sin reemplazo que cotice el costo.

### 4.2 Tamaño: compacto por defecto (pedido del founder)

> *"Me gustaría que fuera claro pero que sea un ícono, algo un poquito más reducido."*

| Forma | Cuándo | Contenido |
| --- | --- | --- |
| **Compacta** (default) | S1, y S2 **con sesión usable** | ícono + línea corta + CTA. **Sin hint.** |
| **Con hint** | S2 **sin sesión usable** — el único caso donde el tap abre la wallet | agrega la segunda línea |

Con sesión viva el tap **no abre nada**, así que el hint mentiría y ocuparía alto por
nada. Se paga el alto extra sólo donde se justifica — que tras el gate de §4 ya es raro
(exige jugar, fallar la entrega, y no tener sesión).

**Ícono:** ⛔ auditar `public/art/**` y reusar un asset canónico. No crear SVG nuevo sin
auditar; no upscalear. **Candidato a elegir en implementación** — es el único punto
abierto del spec.

### 4.3 Posición

Sigue `fixed` (decisión correcta del cluster anterior, no se toca). Un cambio:
**oculto mientras el mapa está abierto** — condición concreta: `exerciseDrawerOpen`
(`exercises-screen.tsx:748`), que es el estado que ya abre el drawer (MAYOR 5). El
founder lo vio en las dos pantallas y en el mapa no tiene razón de existir.

Y como S1/S2 ya no pueden preceder a una victoria, el solapamiento con el tablero dejó
de robar nada: cuando aparecen, el tablero ya está resuelto.

---

## 5. Edge cases por estado

| Estado | Caso | Comportamiento |
| --- | --- | --- |
| S0 | Entrada fría, cola vieja o score pendiente, **sesión viva** | Los dos caminos drenan solos, invisibles, sin prompt. **Mejor caso, preservado a propósito.** |
| S0 | Entrada fría, **sesión expirada** | `promptPolicy:"deny"` → no firma → `retryable` → parkea. **Cero prompts, cero banner.** |
| S0 | **Sin wallet** | `report()` no encola; `canSaveScore` es false. S0 permanente. |
| S0 | Lane apagada (`isAttemptLaneEnabled` false) | Hook inerte, cola intacta. Off es pausa, no delete. ⚠️ Camino B **no** depende de la lane: su guard debe funcionar igual. |
| S0 | Cambia de pieza / abre el mapa | **No remonta** (§2.4): el gate no se apaga. |
| S1 | La red muere mid-flight | → S2 en la misma visita. Sin culpa en el copy. |
| S1 | Completa un segundo ejercicio mientras el primero vuela | `unparked` + encola; plural. Un solo drain a la vez (FIFO por `inFlightRef`). |
| S2 | **Ignora el banner y sigue jugando** | Próxima completación → `unparked` → S1 → desaparece sola. **El camino feliz es ignorarlo.** |
| S2 | **Cancela la firma** | Vuelve a S2 con el **mismo copy exacto**. Sin regaño, sin "try again", sin contador, sin cambio de color. |
| S2 | **Varios intentos en cola** | Plural. **Una sola firma drena todos** — jamás un prompt por intento. Si se corta, S2 con el count restante. |
| S2 | Drena sola con el banner visible | Desmonta. Sin animación de éxito y **sin chip de "all saved"**: la recompensa es que el aviso se va. |
| S2 | Cambia de wallet con el banner en pantalla | `wallet_changed` resetea scope y latch → S0. La cola de A no se le muestra a B. |
| S2 | Respuesta `terminal` (grading rechazado) | Se dropea **sin decirle nada**: no se le reporta una pelea que no puede pelear. |
| S2 | ⚠️ **Presupuesto agotado (25 saves)** — MAYOR 7 | `session_exhausted` es **terminal**: se dropea el intento y **el banner NO ofrece firmar de nuevo**. Firmar acuñaría una sesión nueva para volver a agotarla: un bucle de prompts, que es justo lo que este spec existe para impedir. Con la cola vacía por drop, S0. ⛔ 25 saves/2 h es un techo que un jugador normal no toca; si se tocara, es un problema de presupuesto, no de UI. |

---

## 6. Verificación

⛔ **El VR no es ancla.** El pill mide ~200×40 ≈ 8.000 px, pero el hint y la diferencia
S1/S2 son decenas de píxeles; con `maxDiffPixelRatio: 0.005` sobre 390×844 la tolerancia
es ~1.646 px y se traga la línea entera. **Aserciones de DOM, una por estado.**

⚠️ **`hub-clean` no debería cambiar** (MENOR 12): el VR corre **sin wallet**, y sin wallet
no hay cola (`report()` se niega) ni `canSaveScore`. **Afirmarlo con una corrida**, no
asumirlo.

Casos obligatorios:

1. Cold mount, cola > 0 → `queryByTestId("attempt-save-status")` es `null`.
2. **Cold mount, cola > 0, sin sesión → `signMessage` NO fue llamado.** (Camino A.)
3. **Cold mount, `scorePendingNew` verdadero, sin sesión → `signMessage` NO fue llamado.**
   ⚠️ **EL test del bloqueante 1.** Con la lane de intentos APAGADA, para probar que el
   camino B está guardado por su cuenta.
4. Cold mount con sesión viva → drena, banner nunca visible, `signMessage` no llamado.
5. Completar un ejercicio sin sesión → `promptPolicy:"allow"` → `signMessage` llamado una vez.
6. Post-`report()` con fallo → banner visible; con sesión usable **no** trae `offerHint`;
   sin sesión **sí**; CTA dice `"Sign & save"`.
7. Tap en CTA con 3 intentos en cola → `signMessage` llamado **exactamente una vez**.
8. Firma cancelada → sigue en S2, mismo texto.
9. Repetir un ejercicio ya resuelto → el gate se prende igual (MAYOR 4).
10. `exerciseDrawerOpen === true` → banner oculto.
11. **Compile-time:** quitar `promptPolicy` de un call site debe romper `tsc`.

---

## 7. Fuera de alcance (deliberado, NO descartado)

- **Mudar la cola a Account/perfil** (Samus). Superficie nueva; §3+§4 ya eliminan el defecto.
- **Tick pasivo "Saved" en el `PhaseFlash`** (Samus). Mismo motivo.
- **El save on-chain** (`submitScoreSigned`, LEADERS y MissionDetailSheet): otro carril,
  cuesta gas, es voluntario. **No se toca.**

---

## 8. Qué pasa si el jugador NUNCA firma

**No pierde nada de lo que ve.** Estrellas, progreso de pieza, el `8/8+`, la insignia y
la racha viven en `localStorage` y **no dependen de este POST**. El intento queda en el
disco del teléfono, sobrevive a cerrar la app y se reintenta solo en la próxima
completación. At-least-once: no se descarta nunca.

**Lo único que no ocurre** es que la jugada llegue al servidor: **no cuenta para el
leaderboard** (que rankea sobre `total_score` agregado server-side, §2.5) **ni para las
stats**.

⛔ Cancelar es una respuesta válida y el sistema la trata como tal. Y no hacer nada
**también funciona**.

---

## 9. Open questions

1. ¿Qué ícono canónico usa la forma compacta? Exige auditar `public/art/**` antes de
   dibujar nada. **Único punto abierto.**
