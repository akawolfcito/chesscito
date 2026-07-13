# Spec — Hub Tour + Daily-First (LEARN)

- **Fecha:** 2026-07-12 · **Estado:** propuesto, sin implementar
- **Reemplaza:** `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`

---

## Las dos decisiones de producto

**1. El Daily Tactic ABRE la sesión.** No la cierra.

El Lote 2.5 proponía lo opuesto (Great Focus → desbloquea el gift → resolverlo cierra el
día). Son diseños incompatibles. Founder eligió Daily-first, así que 2.5 queda superseded.

Es la lectura correcta porque **el sistema ya lo sabe y no lo dice**: `recordDailyCompletion`
es el ÚNICO escritor de la racha, y `daily-pending` es la variante #1 del Content Loop.
Falta el momento, no la lógica.

**2. El tour NO es onboarding. Es la introducción a una jerarquía nueva del Hub.**

> **Todo jugador —nuevo o existente— ve esta versión del tour UNA vez, sin importar su
> progreso.** Completarlo o saltarlo cuenta como visto.

No se suprime por tener historia. Esto **no contradice** la regla de la máquina de hitos
("un veterano nunca ve overlays retroactivos"): esa regla existe para no celebrar cosas ya
ganadas. Un tour no celebra nada — informa sobre una pantalla que cambió, y el veterano es
justamente quien necesita que le expliquen qué se movió.

**Regla general:** el Daily crea el hábito; el Challenge lo convierte en compromiso (y en
transacción).

---

## Parte 1 — El tour (3 pasos)

En el HUB de LEARN (`/`). Botones: **Next** (1–2), **Got it** (3), **Skip tour** en los tres.

| # | Señala | Copy — estado A | Copy — estado B |
| --- | --- | --- | --- |
| 1 | Regalo del header | **Daily pendiente:** "Open this daily gift to solve 1 short tactic and protect your streak." | **Daily hecho hoy:** "Your Daily Tactic lives here. Come back tomorrow for the next one." |
| 2 | Mind Challenge card | **No inscrito — Join Challenge:** "Turn your daily practice into a 21-day commitment and track your focus days." | **Inscrito — Mind Challenge:** "Track your focus days and complete your 21-day commitment." |
| 3 | CTA Start Focus | "Begin a training session and keep improving step by step." | — |

**El copy es dinámico por necesidad, no por lujo.** Como todo jugador recibe el tour,
muchos ya tendrán el pass o ya habrán hecho el Daily de hoy. Mostrarles "Join Challenge"
cuando ya pagaron es mentirles.

**El tour no navega.** Es informativo: señala, explica, avanza. Los spotlights no son
clickables (ver No-goals).

### Estados

| Estado | Comportamiento |
| --- | --- |
| `not-seen` | Se lanza en el próximo Hub elegible (post-splash, sin otro modal en pantalla) |
| `step-1/2/3` | En curso |
| `completed` | Llegó a *Got it*. No vuelve automáticamente |
| `skipped` | Eligió *Skip tour*. No vuelve automáticamente — **saltar es una decisión, no un aplazamiento** |
| `replay` | Lanzado a mano desde Settings/Help. Nunca automático |

### Edge cases

- **Tap fuera del panel** → no-op. Se sale por *Skip* o completando.
- **App cerrada a mitad del tour** → reinicia en el paso 1. El flag se escribe SOLO al
  completar o saltar: un tour a medias no es un tour dado.
- **Target no montado** (la card no renderiza) → **saltar ese paso**. Un tour de 2 pasos
  es mejor que una flecha al vacío.
- **Resize / rotación** → el highlight se re-mide contra el target real.
- **PLAY** → el tour no existe. LEARN-only.

### Persistencia

**Llave versionada: `chesscito:hub-tour:v1`.** Cuando el Hub cambie estructuralmente otra
vez, `v2` se lanza sola sin tocar el historial.

**NO reusar `chesscito:onboarded`** — la consume `use-splash-loader.ts:7` para el splash.
Dos significados en una llave se rompen el día que uno de los dos cambia.

**v1 es local-only, y es una limitación consciente.** No hay tabla de perfiles todavía
(Identity Lite PR2 no arrancó), así que persistir por wallet no es construible hoy:
cambiar de dispositivo hará que el tour reaparezca una vez. Aceptado. Cuando exista
`player_profiles`, el flag se sincroniza y esta nota se borra.

---

## Parte 2 — El flujo

1. Jugador (nuevo o existente) entra al Hub tras el rollout.
2. Post-splash, y **solo si no hay otro modal en pantalla**, aparece el tour.
3. Daily → Challenge (adaptado a su estado) → Start Focus.
4. Completa o salta → se persiste `v1`.
5. **El Hub queda libre.** El Daily conserva su énfasis visual si está pendiente, pero el
   jugador elige lo que quiera. *(Intención de UX, no una garantía: el tour no fuerza el
   tap ni bloquea Start Focus.)*
6. Si abre el Daily: resuelve 1 táctica → arranca/protege la racha → celebración breve.
7. **Cierre del Daily:** primario **Continue training**; secundario **Join Challenge**
   (solo si no está inscrito).
8. Si no se une: entrena sin bloqueo. **El reto nunca es un muro.**

### El Daily es un ritual aislado — y ya lo es

Tocar **Daily Tactic** inicia el Daily. Tocar **Start Focus** inicia entrenamiento normal.
**Un ejercicio normal NUNCA cuenta como Daily.**

Esto **ya se cumple en el código**: `recordDailyCompletion` tiene exactamente tres
llamadores (`daily-tactic-slot`, `hub-daily-tile`, `/challenge/daily`) y `exercises-screen`
**no es uno de ellos**. No hay nada que arreglar; hay algo que **no romper**. Un test lo fija.

### Recordatorios del Challenge (cerrado, no abierto)

- Post-Daily: **CTA secundario contextual**.
- Día 2 o 3: **chip/banner en el Hub**.
- **Nunca un modal automático.** Máximo **uno por día**.
- Al inscribirse: **desaparece de inmediato**.

---

## Implementation constraints

- **Exactamente un `aria-modal` a la vez.** El tour monta en el mismo hub que la cola de
  celebración, el regalo de bienvenida y la SeasonPassSheet. **El tour es un GATE**:
  mientras corre, nada más renderiza un modal; y no arranca si ya hay uno.
- El test que lo verifique **debe contar `[aria-modal="true"]`, nunca `role="dialog"`**
  (`LabyrinthCompleteOverlay` usa `role="alert"`; contar roles pasa en verde con dos
  diálogos apilados).
- **Reuso:** `VictoryPopupShell` (panel) + `PrincipalButton` (primario) + iconos canónicos
  de `public/art/**`. **Auditar antes de crear arte.**
- **Lo único nuevo:** el spotlight (scrim + anillo de highlight sobre el target + flecha
  con label).
- Las referencias visuales del founder son **no estrictas en detalle**: se toma la forma
  (panel + mensaje claro + señalamiento), no los pixeles.

---

## No-goals

- **Spotlights clickables.** Ideal, caro. Fase 2, con su propia decisión.
- **Tour en PLAY.**
- **Bloquear la app** hasta completar el tour. *Skip* siempre disponible.
- **Recovery de racha.** Prohibido, regla permanente.
- **Persistencia server-side del flag.** No hay backend de perfiles todavía.
