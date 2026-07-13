# Spec — Hub Tour + Daily-First Onboarding (LEARN)

- **Fecha:** 2026-07-12
- **Estado:** propuesto, sin implementar
- **Reemplaza:** `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`

---

## La decisión que este spec toma

**El Daily Tactic ABRE la sesión.** No la cierra.

El Lote 2.5 proponía lo contrario: Great Focus → desbloquea el Tactical Day Gift →
resolverlo cierra el día. Son diseños **opuestos** y no pueden convivir. El founder
eligió Daily-first (2026-07-12), así que el Lote 2.5 queda **superseded**, no diferido.

**Por qué es correcto:** la llama de la racha ya se enciende **solo** con el Daily
(`recordDailyCompletion`, único escritor del streak). Y el Content Loop ya prioriza el
Daily por encima de todo (`daily-pending` es la variante #1). El sistema **ya sabe** que
el Daily es lo primero — lo que falta es **decírselo al jugador**. Falta el momento, no
la lógica.

**Regla general:** el Daily crea el hábito; el Challenge convierte el hábito en
compromiso (y en transacción).

---

## Parte 1 — El tour de 3 pasos

Un tour de bienvenida en el HUB de LEARN (`/`), **solo la primera vez**.

| # | Paso | Señala | Mensaje |
| --- | --- | --- | --- |
| 1 | **Daily Tactic** | El regalo del header | "Open this daily gift to solve 1 short tactic and protect your streak." |
| 2 | **Join Challenge** | La Mind Challenge card | "Turn your daily practice into a 21-day commitment and track your focus days." |
| 3 | **Start Focus** | El CTA principal | "Begin a training session and keep improving step by step." |

- Botones: **Next** (pasos 1–2), **Got it** (paso 3), **Skip tour** en los tres.
- Al terminar o saltar: el jugador vuelve al Hub intacto y decide.
- **El tour no navega a ningún lado.** Es informativo. Los spotlights **no** son
  clickables (ver No-goals).

### Estados de UI (requisito de CLAUDE.md)

| Estado | Condición | Comportamiento |
| --- | --- | --- |
| `not-started` | Flag ausente | El tour arranca al montar el hub, después del splash |
| `step-1/2/3` | En curso | Scrim oscuro + highlight del target + panel + flecha/label |
| `completed` | *Got it* en el paso 3 | Flag escrito. Nunca más |
| `skipped` | *Skip tour* en cualquier paso | Flag escrito. **Nunca más** — saltar es una decisión, no un aplazamiento |
| `suppressed` | Jugador con historia | Nunca corre (ver Migración) |

### Edge cases

- **Tap fuera del panel** → no-op. El tour no se cierra por accidente; se sale por
  *Skip* o completándolo.
- **Cerrar la app a mitad del tour** → al volver, **reinicia en el paso 1**. El flag se
  escribe SOLO al completar o saltar. Un tour a medias no es un tour dado.
- **Target no montado** (ej. la Mind Challenge card no renderiza) → **saltar ese paso**,
  no mostrar un panel que apunta a la nada. Un tour de 2 pasos es mejor que una flecha
  al vacío.
- **Rotación de pantalla / resize** → el highlight se re-mide contra el target real.
- **PLAY** → el tour **no existe**. Es LEARN-only.

### Persistencia

Llave nueva: **`chesscito:hub-tour`**. **NO reusar `chesscito:onboarded`** — esa la
consume `use-splash-loader.ts:7` para el splash, y colgarle un segundo significado
rompería el splash el día que uno de los dos cambie.

### Migración (jugadores existentes)

Un jugador con historia **nunca** debe ver el tour. Sembrar el flag como completado si
al montar existe cualquier progreso previo (progreso de pieza, daily, o milestones
sembrados). Misma lección que la máquina de hitos: **el estado se preserva, el overlay
se suprime**.

---

## Parte 2 — El flujo de la primera sesión

1. **Hub** → tour de 3 pasos → el jugador toca **Daily Tactic**.
2. **Primer Daily:** resuelve 1 ejercicio → **arranca su racha** → celebración breve.
3. **Después del Daily:** CTA primario **Continue training**; secundario **Join Challenge**.
4. **Si se une:** conecta wallet → paga → activa el reto de 21 días → vuelve al Hub.
5. **Si no se une:** sigue con **Start Focus**, sin bloqueo. El reto **nunca** es un muro.
6. **Días siguientes:** Hub → Daily destacado → 1 ejercicio → racha protegida →
   entrenamiento opcional.

### Recordatorios del Challenge

Solo si **no** se ha unido: después del Daily, o al 2.º/3.º día. **Nunca más de uno por
día.** Un recordatorio que se repite es un anuncio.

---

## La restricción de ingeniería (load-bearing)

**Exactamente un `aria-modal` a la vez.** Esta es la regla que el cluster de progresión
ganó a golpes, y el tour es el candidato perfecto para romperla: monta en el hub, al
mismo tiempo que la cola de celebración, el regalo de bienvenida y la SeasonPassSheet.

**El tour es un GATE:** mientras corre, nada más puede renderizar un modal. Y como
`LabyrinthCompleteOverlay` usa `role="alert"`, el test que lo verifique **debe contar
`[aria-modal="true"]`**, nunca `role="dialog"`.

Un jugador nuevo no tiene hitos que celebrar, así que en el caso feliz no hay colisión.
Pero "el caso feliz no colisiona" **no es un guard** — hay que escribirlo.

---

## Reuso (no inventar arte)

- **Panel:** `VictoryPopupShell` (el marco de los overlays de progresión).
- **Primario:** `PrincipalButton` (el verde/dorado de la familia).
- **Iconos:** los canónicos de `public/art/**`. **Auditar antes de crear.**
- **Nuevo, mínimo:** el spotlight (scrim que oscurece + anillo de highlight sobre el
  target + flecha con label). Es lo único que no existe.

Las imágenes de referencia del founder son **no estrictas en detalle**: lo que se toma es
la forma (panel + mensaje claro + señalamiento), no los pixeles.

---

## No-goals (explícitos)

- **Spotlights clickables.** El founder lo marcó como ideal pero de costo alto. El tour
  es **informativo**: señala, explica, avanza. Clickable = fase 2, con su propia decisión.
- **Tour en PLAY.**
- **Bloquear la app** hasta completar el tour. *Skip* siempre disponible.
- **Recovery de racha.** Sigue prohibido (regla permanente).

---

## Open questions

1. **¿El tour corre antes o después del splash?** Asumo después (el splash ya tiene su
   propia llave y su propio momento).
2. **¿"Continue training" post-Daily entra en este cluster o en el siguiente?** Es la
   pieza que conecta el Daily con el Content Loop, y hoy no existe.
3. **¿El recordatorio del Challenge es un modal o un chip?** Un modal al 2.º día, sin
   pedirlo, es intrusivo. Propongo chip/banner, no modal.
