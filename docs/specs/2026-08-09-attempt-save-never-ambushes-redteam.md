# Red team — `2026-08-09-attempt-save-never-ambushes.md`

**Fecha:** 2026-08-09
**Veredicto:** ⛔ **NO READY.** Tres bloqueantes. El primero invalida el criterio de
aceptación del propio spec: A+B no impiden que entrar a `/exercises` abra la wallet.

---

## ⛔ BLOQUEANTE 1 — Hay un SEGUNDO camino automático a la firma, y el spec no lo toca

El spec asume que el único disparo automático es el drenado de la cola de intentos. **Es
falso.** `exercises-screen.tsx:2505` tiene un efecto independiente:

```
useEffect(() => {
  if (!scorePendingNew || isSubmitBusy) return;
  ...
  void handleSubmitScore({ silent: true });
}, [scorePendingNew, isSubmitBusy, localScoreNum]);
```

y `handleSubmitScore` llama a `postScoreSave` con la firma **real**
(`exercises-screen.tsx:2391`: `signMessage: ({message}) => signMessageAsync({message})`).

**El gate se puede satisfacer AL MONTAR, sin que el jugador toque nada:**

```
scorePendingNew = canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore   (:1415)
canSaveScore    = Boolean(address) && isConnected && isCorrectChain && levelId > 0n   (:1392)
```

`lastSavedScore` sale de `localStorage` y `totalStars` del progreso local. Ninguno de los
cuatro términos exige un gesto. **Un jugador con progreso local no confirmado y la wallet
conectada dispara el prompt en el montaje** — con la cola de intentos vacía, con la lane
apagada, con el banner en S0. Los cambios A y B del spec no lo tocan.

⚠️ **Y es el sospechoso más probable de lo que vio el founder**, más que el outbox: su
prompt salió al apretar Save, pero este efecto corre en cada montaje donde el score local
supere al último guardado — que es exactamente su estado (`8/8+`, jugando hace días).

**Consecuencia:** §1b ("ninguna entrada a `/exercises` puede abrir la wallet") **no se
cumple** con el spec como está. El spec arreglaría un mecanismo y dejaría el otro vivo,
con el defecto reproduciéndose igual y la sensación de "app insegura" intacta.

**Qué exige:** el guard no puede vivir en el outbox. Tiene que estar **en el seam de
firma**, donde los dos caminos convergen — `postScoreSave` / `ensureScoreSession` — o
duplicarse explícitamente en los dos efectos, con un test por cada uno.

---

## ⛔ BLOQUEANTE 2 — `allowPrompt` está atado al eje equivocado

§4 ata el permiso de firmar a *"la corrida fue iniciada por el jugador (`retry()`)"*. El
eje correcto es **el origen del intento**, no la interactividad:

- `session-client.ts:44-45` autoriza la firma explícitamente *"en el primer save que
  realmente se va a escribir"* — es decir, **después de completar un ejercicio la firma
  es legítima**, con o sin tap.
- La tabla de Samus lo tenía bien: rehidratado → no auto-drenar al montar; recién
  completado → sí.

Con la regla del spec, un jugador **sin sesión que gana un ejercicio** no guarda en
silencio: el drenado post-victoria corre como "no interactivo", parkea, y le aparece el
banner pidiendo que firme algo que el sistema podía pedirle legítimamente en el momento
en que ganó. **Agrega fricción justo donde la invariante la permite**, y contradice el
espíritu de §4 ("gastar red sí, atención no") en el único caso donde gastar atención
estaba autorizado.

**Qué exige:** reescribir §4 sobre el eje `origen ∈ {rehidratado, live}`, y que
`interactive` sea sólo un tercer permiso (el tap), no el único.

---

## ⛔ BLOQUEANTE 3 — `earnedThisSession` "por montaje" está indefinido

§3 apoya todo en un gate "por montaje" y §9 lo deja como open question. Eso es un estado
indeterminado en el corazón del cambio:

- Si `/exercises` **remonta** al cambiar de pieza (`?piece=`) o al navegar tablero ↔ mapa,
  el gate se apaga y **S2 desaparece con la cola llena** — el jugador pierde la oferta
  sin que nada se haya resuelto.
- Si **no** remonta, la open question es trivial y no debería estar abierta.

No se puede implementar ni testear sin resolverlo. **Medir el comportamiento real de
remount antes de escribir una línea.**

---

## MAYOR 4 — El gate puede no prenderse nunca en un replay

`report()` sale temprano por el latch de completación (`use-attempt-outbox.ts:313-315`,
`seenRef`). Si `earnedThisSession` se prende **dentro** del hook después del latch, un
jugador que **repite** un ejercicio ya resuelto —caso normal y explícitamente soportado,
todo ejercicio resuelto es rejugable— no prende el gate, y el banner nunca aparece aunque
su intento falle. El spec no dice de qué lado del latch vive el gate. **Debe prenderse
antes del latch, o en el host.**

---

## MAYOR 5 — "Nunca en el mapa/path" es una intención sin mecanismo

§3b lo declara, pero el banner se monta en `exercises-screen.tsx:3768`, fuera del drawer
del mapa. El spec no nombra la condición que lo oculta cuando el drawer está abierto
(¿`drawerOpen`? ¿un portal distinto?). Tal como está, no es implementable sin inventar
la regla, y quien la invente decidirá el comportamiento sin revisión.

---

## MAYOR 6 — La promesa al jugador ("no cuenta para leaderboard ni stats") no está verificada

§8 se lo va a decir al jugador y el spec no lo comprobó contra el código. El proyecto ya
tiene una confusión documentada entre `score_saves` y `score_attempts` sobre qué
significa cada tabla. **Verificar qué lee el leaderboard antes de afirmarlo**, o bajar la
afirmación a algo que sí se sepa.

---

## MAYOR 7 — Falta el estado "presupuesto de sesión agotado"

El token vale 25 saves (`session-client.ts:31`). §5 lista `session_exhausted` como
terminal-drop, pero no especifica el estado del **jugador que sigue jugando después de
agotarlo**: cada nuevo intento fallará, el banner ofrecerá firmar, la firma nueva abrirá
otra sesión… o no. Es un bucle potencial de prompts — exactamente lo que el spec existe
para prevenir. Sin especificar.

---

## MENOR 8 — El copy se auto-exime del brief de lenguaje en una línea

§3 prohíbe "on-chain / mint / gas fee" y en la misma frase aprueba `"Free — no gas"`. La
excepción puede ser correcta, pero está argumentada en una cláusula y no contra el brief.
Riesgo concreto: `pnpm content:audit` y el guard de traducción del bundle ES.

---

## MENOR 9 — No dice qué pasa con las claves de copy viejas

Se agregan 7 claves (`banking`, `bankingCountFormat`, `offer`, `offerCountFormat`,
`offerHint`, `offerCta`, `offerCtaAriaLabel`) y no se dice si las 6 actuales (`saving`,
`savingCountFormat`, `failed`, `failedCountFormat`, `retryCta`, `retryAriaLabel`) se
borran o quedan. Hay tests que las consumen, y el bundle `es.ts` necesita las nuevas o
next-intl imprime el path crudo.

---

## MENOR 10 — El test #7 no es testeable como está escrito

§6 pide *"ningún camino no interactivo alcanza `authorize()`"*. Un test de comportamiento
no puede probar una cuantificación universal sobre caminos. Necesita **un source guard**
(prohibir `signMessageAsync` fuera de un seam único) o una inyección centralizada — si no,
el próximo efecto que llame a `postScoreSave` reabre el agujero en silencio, que es
exactamente cómo nació este bug (BLOQUEANTE 1).

---

## MENOR 11 — El ícono está resuelto y abierto a la vez

§3b lo da por decidido en la tabla ("ícono + línea corta"); §9.3 lo deja como open
question sin candidato. Y el proyecto exige auditar `public/art/**` antes de dibujar
cualquier cosa nueva.

---

## MENOR 12 — No evalúa el impacto en `hub-clean`

§6 descarta el VR como ancla —correcto— pero no afirma si la baseline `hub-clean`
(que fotografía `/exercises`) cambia. Probablemente no, porque el VR corre sin wallet y
sin wallet no hay cola ni score pendiente. **Hay que afirmarlo, no asumirlo.**

---

## Lo que sí resiste

- El diagnóstico de §0 y el principio de §2 son correctos y están bien fundados.
- §1 hecho #6 (la invariante escrita de `session-client.ts:44`) está verificado textual y
  es el mejor argumento del documento.
- §1b como criterio de aceptación es la decisión más valiosa del spec — y es justamente
  la que el BLOQUEANTE 1 demuestra que todavía no se cumple.
- La tabla de edge cases de §5 es sólida en lo que cubre.
