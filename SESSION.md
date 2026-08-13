# Session Handoff — 2026-08-13

Sesión larga, dos mitades. **La primera cerró; la segunda queda abierta a propósito.**

## Completed

### Mitad 1 — el builder de ejercicios, cerrado y usado
El mockup del founder entró entero, y después **el founder lo usó de verdad** — de ahí salieron
cinco arreglos que ningún test habría encontrado. Detalle:
`docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md`.

### Mitad 2 — el spec del P2P y el tope de Privy
- **Spec del duelo en 3 documentos**, recortado a su **versión mínima**: dos personas que **ya están
  dentro** se pasan un enlace y juegan una partida completa. **READY para `/tdd`** con una
  condición.
- **Los 499 de Privy analizados** y la **primera capa del tope construida** (`2ca5ff80`, 15 tests).
- Detalle: `docs/handoffs/2026-08-13-p2p-spec-and-privy-cap-handoff.md`.

## Current State
- **Branch**: `main` — **29 commits sin pushear**
- **Build**: `tsc` exit 0; lint sin avisos nuevos; Vitest web **654 archivos / 7996 tests, TODO
  verde**, medido en árbol limpio, 146 s. (Baseline al abrir la sesión: **643 / 7871**.)
- El VR **no aplica** a nada de esta sesión: `visual-regression.spec.ts` tiene **0** referencias a
  `labyrinth-builder`.
- **Uncommitted work**: `SESSION.md` + el handoff nuevo
- **PRs abiertos**: ninguno

## Next Tasks
1. ⚠️ **Decisión tuya que bloquea**: la perilla del tope **sin redeploy**. En Vercel cambiar un env
   var exige redeploy — justo lo que querías evitar. Salidas: **tabla chica de config** (migración,
   necesita tu confirmación de entorno) o **Vercel Edge Config** (sin migración, agrega dependencia
   de plataforma). Sin eso el tope queda con perilla estática: funciona, pero moverlo cuesta deploy.
2. **Cablear el tope**: `GET /api/access/capacity` + el chequeo en `startLogin()`, ⛔ **antes** de la
   llamada a `login()` (`web-access-gate.tsx:120`).
3. **`/tdd` del duelo**, con la condición de "el enlace sobrevive al login".
4. **Monetización** — el frente que el founder quiere abrir (que más gente mintee la partida o
   consuma comprables). ⚠️ **Merece cabeza fresca**, no colgarse del final de otra cosa.
5. **Terminar de convertir**: 30 tableros, sobre todo laberintos de caballo (5) y dama (3).
6. **Escribir descripciones** de ejercicios: ahora rinde el doble — quita el genérico "Exercise N"
   del juego **y** le pone nombre a la fila del builder.

## Blockers
- Ninguno técnico. El único bloqueo es la decisión de la perilla (Next Task 1).

## Open questions
1. **¿Privy permite exportar la clave del usuario?** **No lo verifiqué.** La más barata y la de mayor
   impacto: si sí, el lock-in de las insignias soulbound desaparece y el plan B se elige por precio.
2. **¿Cuál es el número del tope?** Default 460; sólo es cierto que debe ser **< 499**.
3. **¿Cuántas de las cuentas que ya entran generan alguna transacción?** Es una consulta, y decide
   si crecer por web se paga solo.
4. Del duelo: ventana de expiración (propuesta 48 h), dónde vive, notificación de turno, y la
   métrica de éxito (propuesta: **duelos con al menos una jugada de cada asiento**).

## Notes
- ⛔ **Guardar en el builder RECARGA la página, y la recarga le gana a la respuesta.** Estacionar el
  estado **antes** del request → [[feedback_park_state_before_the_write_not_after]]
- ⛔ **En el duelo, ningún identificador del cliente autoriza un asiento.** La wallet **se vincula**,
  nunca autoriza. Es lo que mató a la v2 — y **sigue vivo en prod**: `api/games/route.ts:21` valida
  el formato, no la propiedad.
- ⛔ **El tope de logins es un PRESUPUESTO, no un candado.** Quien concede el acceso sigue siendo el
  allowlist nativo de Privy. Si alguien apaga el allowlist "porque ya tenemos el tope", queda todo
  abierto.
- ⚠️ **El tope cuenta cuentas TOTALES, no MAU**, y está bien: el MAU nunca supera la cantidad de
  cuentas que existen, así que topear el total lo **garantiza**. Pero el número **sólo sube** — si
  algún día estorba, contar sesiones en 30 días, no subir el tope a ciegas.
- ⚠️ **MiniPay no gasta un solo MAU.** El crecimiento por ahí ya es gratis e ilimitado; la web es el
  canal **medido**, no el de crecimiento.
- ⛔ **Nada cuelga del resultado de un duelo, y es una decisión.** El día que cuelgue valor, hay que
  incluir server-verified progress (backlog §4).
- ⚠️ **`account_first_seen.first_container` es `"minipay" | "browser"`** — por eso el contador del
  tope no necesita migración.
- ⚠️ **Un `pnpm dev` arriba invalida la suite de Vitest** — el síntoma es que BAJA el conteo de
  ARCHIVOS. Y `TaskStop` mata el wrapper de pnpm pero deja vivo el `next-server` hijo:
  `pkill -f next-server`.
- ⚠️ **El contenido de prueba del founder rompe 3 tests** derivados de contenido. Si aparecen, mirar
  `git status` antes de culpar al código.
- **Verificar el deploy es del founder**, salvo pedido explícito. **El push a `origin/main` también.**
- Handoffs largos: `docs/handoffs/2026-08-13-exercise-builder-layout-handoff.md` ·
  `docs/handoffs/2026-08-13-p2p-spec-and-privy-cap-handoff.md`
