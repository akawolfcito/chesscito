# Handoff — el playtest volvió con un bug nuevo, y la lista quedó cerrada

**Fecha:** 2026-08-08 · **Rama:** `main` (local, **sin push** — lo hace el founder)
**Base:** `74e20d45` → **HEAD `f1827e38`** · 5 commits nuevos (**18 sin pushear en total**)

> Continúa `docs/handoffs/2026-08-08-consequence-in-completion-overlay-handoff.md`.
> Ese doc cerró el Paso 1; éste cierra su cola de playtest.

---

## Verificación final

| Qué | Resultado |
|---|---|
| Unit completa | **614 archivos / 7553 tests**, `VITEST_EXIT=0`, **0 `Unhandled Errors`**, 132 s |
| VR (`visual-regression.spec.ts`) | **66 passed**, `PLAYWRIGHT_EXIT=0`, `--update-snapshots=none`, **0 PNG nuevos** |
| `tsc --noEmit` | limpio |
| `content:audit` | sin menciones de `badgeLocked`, sin `ES_ORPHAN_KEY` |

614 = los 612 del handoff anterior + los dos archivos de test nuevos. El `next-server`
del founder estaba arriba en **3003**, no en 3002, así que ni contaminó la suite (132 s, no
500) ni fue adoptado por Playwright.

---

## 1. 🔴 El bug que trajo el playtest: la celebración **volvía**

La foto mostraba *All Exercises Complete!* montado sobre un *Well Done!* que estaba
reproduciéndose — confeti y lottie incluidos. `c641a1ee` había intentado arreglar exactamente
eso el día anterior y **no podía**: atacó la causa equivocada.

**No se quedaba. Volvía.** `PhaseFlash` tenía `awaitTap` en el array de dependencias de su
efecto. El host lo baja y abre el menú de continuación **en el mismo commit**
(`handleFlashContinue` → `setAwaitFlashTap(false)`, después la clausura retenida →
`setShowPieceComplete(true)`), y en el último ejercicio nunca llama `resetBoard()`, así que
`phase` se queda en `"success"`. Ese cambio de prop re-ejecutaba el setup, entraba por la rama
de auto-dismiss y **rearmaba la celebración desde cero**: reveal a 600 ms, fade a 3300, hide a
3700.

Por eso el guard `!awaitFlashTap` de `c641a1ee` no podía atajarlo: en ese instante
`awaitFlashTap` **ya es false**.

`awaitTap` pasa a leerse por ref y sale de las deps. Decide cómo se **comporta** un flash que
ya está en pantalla; no puede empezar uno nuevo.

**Descartado a propósito:** `setPhase("ready")` al abrir el menú es lo semánticamente correcto
—el momento terminó— pero `phase` es estado compartido: `exercises-screen.tsx:3815` monta el
`PeonesHintButton` con `phase !== "ready" ? null : …`, así que reaparecería detrás del modal.
Se descartó **por radio de explosión, no por estar mal**. Si alguien quiere la semántica limpia,
va con su propio spec.

---

## 2. 🔴 La X: cierra y se queda en la pieza

Decisión del founder. Sin laberinto pendiente, la X hacía `onNextPiece`.

El argumento que sostenía esa rama ("avoids the stuck on the last level") ya no aplica: detrás
del panel están el dock persistente, el drawer y el pin contextual de `claimBadge`. Cerrar no
encierra a nadie — deja al jugador en la única pantalla que tiene el Claim. Y mandarlo al hub
sería peor: la baldosa de pieza del hub **solo rutea**.

Además la X ya se anunciaba como *"Practice Again"* (`closeLabel` es su nombre accesible), así
que el salto contradecía lo que ella misma decía.

---

## 3. 🔴 El Claim sin wallet ya no es mudo

`handleClaimBadge` devolvía `false` en silencio y el botón se renderizaba igual
(`badgeClaimable` nunca miró la wallet). El guard se parte por lo que el jugador **puede** hacer:

- desconectado / red equivocada → `track` con `stage: "blocked"`, `connectWallet()` /
  `switchChain()`, y un toast que lo dice;
- sin address, sin contrato, sin `levelId` → sigue silencioso. No hay nada que pedirle.

El dock ya hacía esa distinción (`getContextAction`). El drawer, el badge sheet y el CTA del
`UnlockOverlay` desembocan los tres en esta función, así que **una rama cubre las tres**.

Copy reusado: `CONNECT_PROMPT_COPY.badgesSubline` y `STATUS_STRIP_COPY.switchNetwork`.

⚠️ **A propósito un toast y NO `<ConnectPromptToast>`**: `useConnectPrompt` es one-shot por
browser, así que como respuesta a un tap explícito el **segundo** tap volvería a ser mudo.

---

## 4. 🟡 El copy de estrellas: uno estaba muerto, el otro salía del teléfono

`484e3d7c` arregló dos textos. Sobrevivían dos más.

- `badgeLockedFormat` — cero consumidores, citando el gate viejo. Borrado de **los dos bundles
  a la vez** (solo-ES rompe `bundle-parity`; solo-EN emite `ES_ORPHAN_KEY`).
- **`SHARE_COPY.badge` tenía el denominador clavado en 15.** Copy **vivo**. El alfil tiene 27
  estrellas: el panel pintaba *"27/27"* y el texto que el jugador comparte decía *"27/15"*.

⚠️ **El segundo consumidor no lo encontró `tsc`.** Los argumentos ICU no están tipados, así que
`/share/badge` compilaba limpio pasando solo `{stars}`. Esa página **ya normalizaba `maxStars`**
—lo usaba para la imagen OG y para el canonical— y la frase debajo seguía diciendo `/15`. Lo
encontró un grep.

El guard nuevo no es una allowlist: camina `src/` y falla nombrando cualquier
`tShare("badge", …)` sin `maxStars`.

---

## 5. 🟡 El flake: **no se reprodujo**

`wallet-branch-lazy.test.tsx` — 10/10 aislado y 3/3 dentro de `src/components/__tests__`, antes
y después. Lo que sí se corrigió es una causa mecánica confirmable **por lectura**: los
`afterEach` corren LIFO, así que el del archivo corría **antes** del `cleanup()` del setup —
desarmando spies y env stubs con el árbol de React montado.

⚠️ **Riesgo residual NO tocado, anotado en el archivo:** AC23 y AC20 aseveran conteos exactos de
llamadas al loader, que dependen de que el `useMemo([mounted, attempt])` de
`wallet-provider-boundary` nunca se recompute. React no lo garantiza. Si vuelve rojo, la
corrección es aseverar **comportamiento** (¿se remontó?), no conteos.

---

## Las tres lecciones de método

### 1. ⛔ Un test que avanza el reloj **de más** pasa en verde con el bug puesto

El primer test del rearme avanzaba 5000 ms y **pasaba** — porque para entonces la celebración
rearmada ya se había auto-escondido sola. La ventana del bug es **600 → 3700 ms**. Muestrear
fuera de la ventana de un fenómeno transitorio no lo mide: lo esquiva.

### 2. ⛔ `handleAction` difiere 250 ms — y eso hacía trivial una aserción existente

Todos los CTA del `PieceCompletePrompt` corren su callback **después** de la animación de
salida. El test viejo clickeaba y aseveraba en el acto, así que su
`expect(onNextPiece).not.toHaveBeenCalled()` pasaba con **cualquier** implementación, incluida
una que lo llamara. Ahora hay fake timers, un `drainExitAnimation()` y las **dos** aserciones.

### 3. ⛔ `tsc` no ve los argumentos ICU

Un `t("key", {…})` al que le falta un placeholder compila limpio y rompe en runtime. Si una
plantilla gana un argumento, el compilador **no** encuentra los call sites: hay que greparlos, y
dejar un guard que los camine.

---

## Lo que queda abierto

1. **El guard silencioso duplicado** en `apps/web/src/lib/badges/use-badge-sheet-state.ts:143-151`
   — alimenta los badge sheets del **Hub** y de **Arena**. Mismo bug, otra superficie. Quedó
   fuera a propósito: el tráfico del Paso 1 cae en la pantalla de ejercicios.
2. **OQ-2 sigue siendo humana.** `lane_complete` dice *"your badge is waiting in Exercises"* sin
   botón. La prueba es llevar a alguien al 8º ejercicio y preguntarle *"¿qué te pasó y qué harías
   ahora?"*. Con esa respuesta en mano la próxima sesión arranca sabiendo.
3. **El Paso 2 hereda trabajo no contado**: la baldosa del hub no reclama, solo rutea. Para que
   ofrezca la acción, hay que ponérsela.
4. **Sin cobertura VR** para el subtítulo *"Your badge is ready to claim."* — el fixture de
   `/dev/exercises-popups` no tiene variant de `PieceCompletePrompt` con
   `hasEarnedBadge && !hasClaimedBadge`.
5. `SHARE_COPY.badge` sigue diciendo *"Saved on Celo forever"*. No se tocó — es otra discusión
   (brief de lenguaje), no la de las estrellas.

---

## Estado del árbol

- `main` local, **18 commits sin pushear**. El push lo hace el founder.
- ⚠️ `apps/web/rook-rails-shots/` sin trackear, **no es de esta sesión**. No se tocó.
- ⛔ **Ningún deploy verificado** — es tarea del founder por regla vigente.
