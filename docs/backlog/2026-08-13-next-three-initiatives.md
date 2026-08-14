# Las tres siguientes — p2p, theme builder, builder de ejercicios

**Fecha:** 2026-08-13 · **Estado:** propuestas del founder, sin spec
**Contexto:** el cluster de Star Sweep cerró (49 de 79 tableros convertidos, todo en verde).

---

## 0. La pregunta que las precede — ¿extraer `/dev/*` a su propia app?

**MEDIDO el 2026-08-13, y la respuesta es NO por ahora.** Builds limpios (`.next` borrado en
ambos), misma máquina, mismo commit:

| build | tiempo | rutas |
| --- | --: | --: |
| con `/dev` | **90 s** | 147 |
| sin `/dev` (35 páginas + 4 API movidas fuera) | **81 s** | 108 |

Las rutas de `/dev` son el **26% de las rutas** y el **10% del tiempo**. Sobre los $6.20 de
Build CPU Minutes del ciclo, extraerlas ahorraría **~$0.62**.

⛔ **Y no aportaría NADA al bundle del jugador**, que era la hipótesis original. Next hace
code-splitting por ruta: `/[locale]/exercises` son 461 kB de First Load y el builder no está
adentro. Lo único común son **89,4 kB** de chunks de framework que el juego necesita igual.

⚠️ **El costo real de separarlas no es mover archivos: es el validador.** El builder comparte
`buildCatalog` con el juego y con el import, y esa unicidad es lo que hace que el 400 del
builder sea el MISMO criterio que el del JSON. Separar apps sin extraer antes un
`packages/core` deja **dos copias de las reglas**, que es el fallo que este repo lleva meses
evitando. El orden obligatorio sería: paquete compartido primero, app después.

**La palanca real del gasto es la FRECUENCIA, no el tamaño.** Un build son 90 s; $6.20 sale de
cuántas veces se buildea. Medir primero: (1) ¿el build-skipping de Vercel está saltando el
landing cuando sólo cambia `apps/web`? (2) ¿cuántos builds por push se disparan?

**Revisar esta decisión si**: el build pasa de ~3 min, o el builder necesita su propio ciclo de
release.

---

## 1. P2P

Sin spec. Es la apuesta grande y **no se cierra en una sesión**. Lo primero es entender qué
tiene que ser antes de escribir una línea: contra quién se juega, qué se apuesta (si algo),
qué pasa cuando alguien abandona, y si es en vivo o por turnos asincrónicos.

⚠️ Entra en contacto con dos cosas ya decididas:
- **El duelo apunta a espectadores que REGALAN piezas** — es techo, no la primera capa
  (`project_duel_spectator_economy`).
- **Server-verified progress sigue sin construirse** y su riesgo está *aceptado* porque hoy
  nada de valor cuelga de un score. **Un p2p con algo en juego cambia esa premisa** y activa
  el disparador escrito en `2026-07-10-backlog-index.md` §4.

## 2. Theme builder

Ya hay base: `project_theme_marketplace_vision` y `project_theme_catalog_decisions` (un slot =
un archivo único). La visión es un **marketplace de creadores**, así que el builder es el medio,
no el fin. Pendiente de spec.

⚠️ Gotchas ya documentados que el spec debe respetar: un slot puede apuntar a una copia
**huérfana**; un `/art/...` escrito en JS **también** pasa por el resolver; tocar un slot de tema
rompe **tres** baselines.

## 3. ✅ Builder de ejercicios — HECHO (2026-08-13)

⛔ **Esta sección quedó vieja el mismo día que se escribió.** Los seis ítems del mockup
entraron, más cinco mejoras que salieron de autorar de verdad. Ver
`docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md`.
**El orden recomendado del final resuelve entonces a: P2P → Theme builder.**
Lo de abajo se conserva como el registro de lo que se pidió.

### (histórico) La propuesta con mockups del founder

La más barata de las tres y la que **multiplica el trabajo que ya está en curso**: quedan 30
tableros por convertir y todo el contenido futuro pasa por acá.

De los mockups, lo que cambia el trabajo diario:

- **La librería muestra NOMBRE, no sólo id.** Hoy dice `rook-9`; el mockup dice
  *"Friendly blocker"*. El autor elige por lo que el tablero ES.
- **Columna TIER con badge** (EASY / MEDIUM / HARD), y la tabla ordenada por dificultad —
  hoy el orden es el del catálogo y el tier no se ve.
- **Fila en estado `Editing`**, para saber cuál se está tocando.
- ⭐ **`Unsaved changes in rook-9` + Discard.** Hoy NO hay señal de cambios sin guardar: se
  puede cargar otro record encima y perder la edición sin aviso.
- **Herramientas con icono y leyenda** (Start / Goal / Star / Wall / Enemy / Erase), incluido
  un **Erase** que hoy no existe como borrador explícito.
- **Selector de Stage y Save draft** en una barra fija al pie.

⚠️ Al implementarlo, respetar lo aprendido: `targets` es **UI-owned** (si viaja en
`extraFields`, quitar una estrella no hace nada) y **el brush `Star` se esconde** donde el sweep
no corre (fuera de exercise/labyrinth, y en el peón).

---

## Orden recomendado

**Builder → P2P → Theme builder.**

El builder es una sesión, es sobre superficie existente y **le ahorra tiempo al founder desde el
día siguiente**, mientras todavía está autorando. P2P es lo grande y merece empezar por un spec
con la cabeza fresca, no encajado al final de otra cosa. El theme builder depende de una visión
de marketplace que no urge.

⚠️ **Si el p2p va a tener algo de valor en juego, su spec debe incluir server-verified
progress.** No es un extra: es el prerrequisito que hoy está aceptado *porque* nada vale.
