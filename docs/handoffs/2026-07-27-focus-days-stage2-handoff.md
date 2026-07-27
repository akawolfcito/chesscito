# Handoff — Focus Days Stage 2 completo (2026-07-27, sesión tarde/noche)

**Spec**: `docs/specs/2026-07-27-focus-days-ledger.md` (APPROVED) + su red-team.
**Estado anterior**: S2.1 · S2.2a · S2.2b+S2.3 mergeados, con `main` local
**bloqueado para push** por un defecto funcional.
**Estado ahora**: **Stage 2 completo (S2.1 → S2.6)**. El bloqueo funcional está
levantado. Queda **una sola cosa**: la validación visual del founder.

---

## Qué se construyó

### S2.4 — el único slice que ESCRIBE (3 commits)

`7977536` · `a528f19` · `1caf6c1`

1. **Un evento propio para la completación** (`lib/daily/events.ts`).
   El POST **no** cuelga de `chesscito:daily-progress-changed`: ese evento se
   despacha desde dos lugares y los tests lo emiten a mano, así que colgar una
   escritura de él dejaría que cualquier rerender mintiera una fila. El canal
   nuevo (`chesscito:daily-completed`) se emite en el **único** punto de
   escritura (`recordDailyCompletion`) y **sólo** en la rama de cambio real —
   nunca en el no-op del mismo día — y lleva la fecha en el `detail`.

2. **`lib/season-pass/use-focus-day-recorder.ts`** — dos caminos, un endpoint:
   - **completación** → POST **sin** `date`. La fecha es del servidor; un reloj
     de device adelantado no puede acuñar un día.
   - **retry en mount** → POST con `date = lastCompletedDate`, acotado a
     [ayer, hoy]. Reconcilia un día que nunca llegó al ledger (offline).

   El retry dispara **sin saber** si esa fecha ya está registrada, y no puede
   saberlo: `/status` devuelve un conteo, no fechas. Lo que lo hace seguro es el
   UNIQUE `(wallet, season_id, date_utc)`.

   Un ref `(wallet, date)` **reclamado antes del await** evita el POST doble
   cuando la completación y el retry caen en el mismo tick. Un POST fallido
   **libera** su clave: el día sigue debiéndose y el próximo mount lo reintenta.

3. **El cableado + la relectura** (`learn-hub-client.tsx`).
   Esto **no estaba en el diseño** y sin ello el bug seguía vivo con otra cara:
   el POST escribía, pero la tarjeta ya había leído el conteo **antes** y
   quedaba congelada hasta el próximo mount. `useLearnFocusDays` toma ahora un
   `refreshToken` que el recorder bumpea al confirmar la escritura.

### S2.5 — borrar el ordinal de reloj de pared (AC1)

`e3a94a5`. `challenge-day.ts`, su test, el campo `dayOfChallenge` del tipo y sus
11 referencias, borrados juntos. Ese módulo derivaba "Day N of 21" de la
expiración del pase, así que el número **avanzaba mientras el jugador salteaba
días**. El typecheck es la red que prueba que no quedó ninguna referencia.

### S2.6 — AC20 + AC18

`207d878`, `focus-days-real-path.test.tsx` (4 casos).

- **AC20 — el camino real.** Monta `LearnHubClient` con `use-hub-data` **real**
  (sólo la red y la cadena mockeadas) y va desde la respuesta de `/status` hasta
  el texto en pantalla: provider → `resolveEffectiveTrainingPass` →
  `use-hub-data` → `buildChallengeProgressView` → `ChallengeCard`. Cubre pase
  expirable, PRO unbounded y `degraded`.
  *Por qué importa*: todo el resto del cluster le pasa a la tarjeta una vista
  armada a mano, o sea prueba que renderiza lo que recibe y **nada** sobre quién
  se la da.
- **AC18 — llegar a 21 no acredita nada.** Los cuatro caminos espiados por
  nombre (Peones spend/earn · el contador de shields · Coach · toda escritura de
  `expires_at` vía las rutas de pago), los cuatro en cero. Es un test de
  ausencia, así que verifiqué que **discrimina**: con una ruta que sí se llama en
  la lista, se pone rojo.

### Extra — `/dev/challenge-card`

`6e50e32`. Los **9 estados** de la tarjeta apilados al ancho real de 390px, con
toggle **EN/ES**. Existe porque esos estados **no se alcanzan clickeando**:
piden pase vivo, respuesta del ledger y, en dos casos, una falla. Fixtures
puros — sin localStorage, sin wagmi, sin red. Hereda el gate de `/dev`
(local + preview, nunca producción). Verificado: HTTP 200 con los 9 presentes.

---

## Verificación

- Suite **6137 passing / 537 files, `EXIT=0`, 0 `Unhandled Errors`**.
- `tsc --noEmit` limpio · `next lint` limpio.
- **Mutación, no sólo verde**:
  - las 4 guardas del recorder que un cuerpo inerte satisfacía (entitlement,
    PLAY, fecha vieja, fecha futura) → confirmadas rojas al romperlas;
  - la aserción de AC18 → confirmada roja con una ruta que sí se llama.
- ⚠️ **Honestidad**: 3 de las 7 guardas del bloque "no escribe" pasan
  **estructuralmente** (sin wallet, sin hidratar, sin historial): no hay nada que
  postear, así que un stub también las satisface. No están verificadas por
  mutación.

---

## Gotchas que dejó la sesión

- ⚠️ **`proExpiresAt` viaja como epoch en NÚMERO, no ISO.** Con un ISO string el
  validador (`use-season-pass-status.ts:105`) descarta el **body entero** y la
  tarjeta cae al `offer` **en silencio** — sin error, sin log; simplemente un
  pase que "no existe". Me mordió en un fixture y costó un ciclo entero.
- ⚠️ **Un POST y un GET al mismo recurso no se ordenan solos.** El conteo se lee
  por una llamada distinta de la que escribe, y la escritura llega segunda: sin
  el `refreshToken` el número correcto existe en la base y **no** en la pantalla.
- 📌 En PRO la tarjeta **dice lo mismo dos veces**: "PRO Benefit included" en el
  chip y "Included with PRO" donde iría el countdown. Es copy, no bug —
  decisión del founder.

---

## Próximos pasos

1. 🚦 **Validación visual** (founder) en **`/dev/challenge-card`**. El punto de
   ruptura más probable no es el texto sino la fila **progreso + countdown +
   racha** en 390px, y rompe primero en **español**. Salida preferida si no
   respira: **wrap controlado a dos líneas**, NO achicar tipografía ni convertir
   todo en chips.
2. **Push de `main`** (lo hace el founder). Hay **16 commits** locales.
3. Cuando el founder quiera, ya sin bloqueo:
   - `/dev/learn-hub` + `vr18-learn-hub-*` — desbloqueado desde el refactor del
     daily slot; los 5 estados ya son fotografiables por `data-progress-state`.
   - `hub-clean` → `exercises-clean` (~39 fotos, fuera del camino crítico).

## Open questions

- **Spec B (ventana 21-en-30) sigue sin escribir.** Sin él, "12 of 21" sigue
  siendo incompletable tras un salteo — pero ahora **visible**, que era
  exactamente el punto de Spec A. La pregunta de producto queda abierta: ¿se
  amplía la ventana, se perdona un día, o se acepta que el desafío se pierda?
- **La copy duplicada de PRO** (arriba): ¿sobra uno de los dos?
- **Higiene de branches**: siguen ~25 branches locales sin auditar. No se tocó.
