# Red team — spec v3 (`2026-08-09-attempt-save-never-ambushes-v3.md`)

**Fecha:** 2026-08-09
**Veredicto:** ✅ **READY CON CAMBIOS.** **Ningún bloqueante.** Un mayor y seis menores,
todos incorporables sin rediseñar.

Es la primera versión que sobrevive. El motivo es estructural y vale nombrarlo: el v1 y
el v2 pusieron el candado en un **camino** (y quedó otro); el v3 lo puso en el **único
lugar que puede abrir la wallet**, con un campo requerido. La diferencia no es que esta
vez se pensaron más casos — es que la clase de error "alguien agrega un camino nuevo y no
se acuerda del guard" **dejó de ser expresable**. Verificado: `ensureScoreSession` sólo
se llama desde `save-client.ts` (`:163`, `:186`), y `postScoreSave` sólo desde
`exercises-screen.tsx` (`:1130`, `:2380`).

---

## MAYOR 1 — `silent` no es lo mismo que "tiene permiso para interrumpir"

§3.3 dice que el tap explícito pasa `"allow"`, pero en el código los dos usos comparten
la misma función y sólo se distinguen por un flag de **presentación**:

```
exercises-screen.tsx:2510   void handleSubmitScore({ silent: true });   // efecto automático
exercises-screen.tsx:3826   onRetrySave={() => void handleSubmitScore()} // tap en la hoja
```

Si la implementación deriva `promptPolicy` de `silent`, está atando el **permiso de
interrumpir** a una decisión de **UI**. Es exactamente la confusión de categorías que
produjo el bug original: `silent` describe si se muestran spinners, no si el jugador
consintió una firma. El día que alguien quiera un auto-save que muestre UI, o un tap que
no la muestre, el permiso viaja con la decisión equivocada.

**Exige:** `handleSubmitScore` toma un segundo eje explícito
(`{ silent: boolean; promptPolicy: "allow" | "deny" }`) y el spec lo dice. Dos ejes, dos
nombres.

---

## MENOR 2 — Ya existe `peekScoreSession()`, y el spec inventa una API vecina

`session-client.ts:197` exporta `peekScoreSession()` — lee **sólo memoria**, no storage, y
no evalúa usabilidad. §4.3 agrega `hasUsableScoreSession(wallet, surface)`. Son dos
funciones parecidas con contratos distintos, y nada en el spec las relaciona.

**Exige:** que la nueva se construya sobre el mismo `isUsable` + el mismo orden
memoria→disco que `ensureScoreSession`, y que el spec diga explícitamente en qué se
diferencian, o el próximo lector usará la equivocada.

---

## MENOR 3 — Un `deny` no debe quedarse esperando un prompt ajeno

`ensureScoreSession:255` coalescea llamadas concurrentes: `if (inFlight) return inFlight`.
Escenario real: el jugador gana (camino live, `allow`) → se abre el prompt → el drenado de
un intento rehidratado (`deny`) entra y **recibe la misma promesa**, quedando bloqueado
mientras el modal de la wallet siga abierto.

No genera un prompt extra —no rompe el criterio de aceptación— pero deja el drenado
colgado, y con él el `inFlightRef` del outbox, que serializa la cola. Si el jugador tarda
un minuto en decidir, la cola no avanza.

**Exige:** con `"deny"`, retornar **antes** del coalescing. Un deny nunca espera una firma.

---

## MENOR 4 — El `clearScoreSession()` de la re-auth corre aunque el policy sea `deny`

`save-client.ts:185` limpia la sesión **antes** de la segunda llamada. Con el fix, la
segunda llamada respetará `deny` y no firmará — pero **el token ya fue borrado de memoria
y de disco** por un intento de fondo que el jugador no inició.

En el caso normal es correcto (el server lo dio de baja: estaba muerto igual). Pero ante
un rechazo transitorio o espurio, un drenado silencioso **le cuesta al jugador la sesión
que tenía**, y el próximo tap suyo pedirá firma que no habría hecho falta.

**Exige:** decidir explícitamente si el `clear` se condiciona al policy, y escribirlo.
No es obvio en ninguna dirección — por eso tiene que estar decidido, no heredado.

---

## MENOR 5 — §4.3 no dice **dónde** se guarda la lectura de sesión

Dice "se lee al entrar a S2, no en cada render", que es la decisión correcta, pero no
nombra el mecanismo (¿estado en la transición? ¿ref?). Calculado en render sería "cada
render" y contradiría la propia regla. Sin eso, quien implemente elige, y la decisión de
reactividad —que el spec argumentó con cuidado— se pierde en la traducción.

---

## MENOR 6 — Los tests 3 y 9 necesitan que la lane sea apagable, y nadie dijo cómo

Dos casos obligatorios dependen de correr con `isAttemptLaneEnabled` en false. Es un
feature flag (`lib/feature-flags`); si se resuelve por env en tiempo de módulo, el test
necesita `vi.mock` y no un simple parámetro. **Confirmar el mecanismo antes de escribir
los tests**, o esos dos casos se van a "adaptar" hasta pasar.

---

## MENOR 7 — El caso 4 no es testeable desde el componente

El caso estrella (token vivo-local / muerto-server) exige que el POST devuelva un
`SESSION_DEAD_REASONS` **después** de que la caché sirvió un token. Eso se arma en el
nivel de `save-client` con un `fetch` falso, no montando la pantalla. El spec lo lista
junto a casos de componente sin decir de qué nivel es cada uno.

**Exige:** marcar el nivel de cada caso (unidad de `save-client` / hook / componente), o
alguien va a intentar el 4 con RTL y va a concluir que "no se puede probar".

---

## Lo que resiste, y por qué importa

- **El candado es inexpresablemente evitable**, no "recordable": campo requerido en la
  única función que puede firmar. Es la primera versión donde agregar un camino nuevo
  **no puede** reabrir el agujero en silencio.
- **§2.3 ahora distingue las dos muertes del token** (vencido local vs. muerto server), que
  es exactamente lo que se le escapó al v2.
- **§3.2 (`deny` no es un fallo)** cierra el efecto de segundo orden que el v2 creaba: la
  entrada fría dejaría de pintar un estado de error dentro de la hoja de misión.
- **§3.3 desacopla el gate de la lane**, que era la fuga más silenciosa del v2: con la lane
  apagada, el guardado del score se habría apagado entero sin que nadie lo notara.
- **§2.4 está medido**, no supuesto.
- **El ícono se resolvió reusando un asset canónico con slot ya registrado**
  (`exercises.save-score`, `theme-registry.ts:862`), consumido por el resolver de temas y
  no por path crudo. Sin iconografía nueva y sin colisión de significado.
- **§4.3 documenta un límite conocido** (el token puede vencer con el banner abierto) en
  vez de fingir que no existe.

---

---

## ⚠️ Nota posterior — decisión del founder que reduce el alcance (2026-08-09)

Después de este review, el founder decidió **eliminar el banner por completo** (§4 del
v3, reescrito). Efecto sobre estos hallazgos:

- **MENOR 2** (`peekScoreSession` vs `hasUsableScoreSession`) → **caduco**: esa API existía
  sólo para condicionar el hint del banner. No se agrega.
- **MENOR 5** (dónde se guarda la lectura de sesión) → **caduco**, misma razón.
- **MAYOR 1** y los menores 3, 4, 6 y 7 → **siguen vigentes**: son del guard de firma, que
  es lo que queda en pie y lo que cumple el criterio de aceptación.

Sacar el banner **no debilita el fix**: `earnedThisSession` no era del banner, es la señal
que decide el `promptPolicy`.

---

## Recomendación

Incorporar el MAYOR 1 y los seis menores **al v3 directamente** — son precisiones, no
rediseños — y **pasar a TDD**. Una cuarta ronda de spec tendría rendimiento decreciente:
los hallazgos de esta ronda ya no tocan la arquitectura de la solución, que es la señal
de que el documento convergió.

⚠️ **Orden sugerido de implementación**, porque el riesgo no está repartido parejo:

1. `promptPolicy` requerido en `ensureScoreSession` + las dos llamadas de `postScoreSave`
   (con los casos 2, 3, 4 y 14 en rojo primero). **Esto solo ya cumple el criterio de
   aceptación**; todo lo demás es calidad.
2. `session_required` distinguible (caso 5).
3. El gate `earnedThisSession` + el arreglo del camino B (casos 8 y 9).
4. El banner: estados, copy, ícono, posición (casos 1, 10, 11, 12, 13).
5. VR una sola vez al final, con `--project=minipay --update-snapshots=none`.
