# Handoff — entrar a jugar ya no puede abrir la wallet

**Fecha:** 2026-08-09
**Spec vigente:** `docs/specs/2026-08-09-attempt-save-never-ambushes-v3.md`
**Red teams:** v1, v2 y v3 (`…-redteam.md`, `…-v2-redteam.md`, `…-v3-redteam.md`)
**Commits:** `77202ac` (specs) · `5f9deba` (el candado) · `22c3600` (fuera el banner)

---

## Estado

| Verificación | Resultado |
| --- | --- |
| Suite web | **7582 passing / 617 files, EXIT=0**, cero `Unhandled Errors` |
| `tsc` | limpio |
| `content:audit` | 147 hallazgos — **los mismos que antes**, sin regresión |
| VR | **67 passed** con `--project=minipay --update-snapshots=none`, 3002 libre, **cero PNG nuevos** |

⚠️ El VR necesitó dos corridas: 4 casos de `/dev` fallaron por `page.goto` **timeout de
45 s** (compilación en frío del dev server), no por píxeles. Re-corridos solos: los 4
verdes en 25 s cada uno. **No confundir ese modo de falla con una regresión visual** — el
log dice `TimeoutError`, no diff.

---

## El defecto

> *"Al apenas entrar se siente como que es una app insegura que trata de sacarte tus
> fondos."* — founder, jugando en device

Tenía razón, y no era una exageración: **un pedido de firma no solicitado al cargar una
pantalla es la forma de un phishing**. Desde el lado del jugador, "reentrega de un intento
viejo" y "esta app me pide algo raro" son indistinguibles.

**Dos** caminos distintos disparaban un guardado **solo al montar** `/exercises`:

1. El drenado de la cola de intentos rehidratada (`parked` arranca en `false`).
2. El auto-save del score (`scorePendingNew` se satisface al montar, sin gesto).

Los dos terminaban en `ensureScoreSession`, que sin sesión cacheada iba **directo** a
pedir firma.

⛔ Y eso violaba una invariante **escrita en el propio módulo** (`session-client.ts:44`):
*"NUNCA pide firma al montar…"*. Nadie mintió: los dos caminos se agregaron después y
nadie releyó el contrato del vecino.

---

## Por qué hicieron falta tres versiones del spec

Es el aprendizaje que sobrevive al cluster:

| Versión | Dónde puso el candado | Qué encontró su red team |
| --- | --- | --- |
| v1 | El drenado de la cola | **Había un segundo camino** (el auto-save del score) |
| v2 | `postScoreSave` | **Esa función llama al permiso dos veces**; la re-auth quedaba abierta |
| v3 | `ensureScoreSession`, con campo **requerido** | 0 bloqueantes |

Las dos primeras taparon **caminos**. La tercera hizo que la clase de error
—"alguien agrega un camino nuevo y se olvida del guard"— **dejara de ser expresable**:
`promptPolicy` es obligatorio, así que un call site nuevo **no compila** sin decidir.
Cuando se implementó, `tsc` señaló **cuatro** call sites: dos de producto y dos que no
estaban en el análisis (el "Try again" del overlay de error y el reintento de la hoja).

---

## Lo que quedó construido

- **`promptPolicy: "allow" | "deny"`** requerido en `ensureScoreSession`, reenviado a las
  **dos** llamadas de `postScoreSave`. Con `"deny"` retorna `session_required` **antes**
  del coalescing (si esperara la promesa en vuelo de un `allow`, un drenado de fondo
  quedaría colgado mientras el modal de la wallet siga abierto, y con él la cola entera).
- **Con `"deny"` NO se limpia la sesión** en la re-auth: borrarla costaría un prompt
  evitable en el próximo tap del jugador, por un intento de fondo que no inició.
- **`earnedThisSession`** separa "la máquina hablando de sí misma" de "el jugador acaba de
  ganar". ⛔ Vive en el **host** y **no depende de la lane**: dentro de `report()` se lo
  comían el latch de completación y el flag de la lane, y con la lane apagada el guardado
  del score se habría apagado **entero**, en silencio.
- **`session_required` no es un fallo.** Sin esto, una entrada en frío habría pintado un
  estado de error con botón de reintento dentro de la hoja de misión: el cartel que
  sacamos del tablero, mudado adentro.
- **El latch del score se consuma sólo con `"allow"`**, y `autoPromptPolicy` entró en las
  deps del efecto. Sin las dos cosas, un replay que no mejora el score quedaba sin guardar
  toda la visita.

---

## El banner se eliminó (decisión del founder)

> *"¿Ya no tendríamos banner, cierto? Que no moleste, exista, ayude cuando se necesita y
> no meta más gráficos/iconos/assets."*

Nació el **2026-07-28** (`c2d43872`) — decisión suya también — para que el jugador pudiera
**pedir** el reintento. Arreglada la emboscada, quedó a la vista lo que ese pedido cuesta:
**una firma**. No pedir nada cuesta **cero**: la cola se drena sola en la próxima
completación, con el mismo `attemptId`.

O sea, el botón no era un servicio: era una forma de que el jugador pagara por algo que el
sistema ya hacía gratis. **Samus lo recomendó por su cuenta** antes de que el founder lo
pidiera.

**−310 líneas:** el componente, su test, las 6 claves de copy en los dos bundles y sus 5
reglas de CSS. Quedan comentarios en los tres lugares explicando por qué no reponerlo —
un borrado sin causa escrita se revierte solo.

⚠️ Los dos tests que usaban el CTA como **mecanismo** se reescribieron contra el
comportamiento real (seguir jugando drena lo parkeado). El contrato bajo test —mismo
`attemptId`, FIFO— no cambió; cambió el gesto que lo dispara.

---

## Qué sigue

1. **PUSH a `origin/main`.** Es del founder.
2. **Validación en device — la única que vale:** entrar en frío a
   `/exercises?piece=bishop` con la wallet conectada y progreso sin confirmar, y
   comprobar que **no aparece ningún pedido de firma**.
3. **Fuera de alcance, acordado:** si alguna vez hay que decir algo sobre la cola, va en
   **Account** — un lugar que el jugador visita, no un cartel que lo visita a él. Con el
   tick pasivo "Saved" en el `PhaseFlash` como complemento (los dos son de Samus).

---

## Open questions

1. `retry()` del outbox quedó **sin consumidores** en el producto. Se mantuvo a propósito:
   es lo que usará la línea de Account. Si esa superficie no se construye, es código
   muerto y habrá que decidirlo explícitamente.
2. Los 4 timeouts del VR sugieren que el presupuesto de 45 s para la compilación en frío
   de rutas `/dev` está justo. No es de este cluster, pero va a volver.
