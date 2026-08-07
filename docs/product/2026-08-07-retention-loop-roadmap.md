# Roadmap de producto — el loop de retención (2026-08-07)

> Decisión del founder al cerrar el bloque de performance de MiniPay. La prioridad **no** es
> "qué se ve más bonito", sino cuánto mueve **retención, regreso y profundidad de juego**.
> Esto es **un bloque de producto, no cinco features independientes**.

## El loop que se quiere probar

```text
Daily → Keep training → Labyrinths / harder challenges → Stars
      → Leaderboard → Weekly reward → Come back
```

Cada sprint agrega **un eslabón** de esa cadena. No se abre P2P hasta que el loop
demuestre que produce gente que vuelve.

---

## Sprint 1 — "No expulsar al jugador" (arranca primero)

**Problema:** el momento inmediatamente posterior a un éxito dice *"ya terminaste, vete"*
en vez de *"bien hecho, ¿qué quieres hacer ahora?"*. Sospecha: está cortando sesiones y
evitando que alguien descubra el contenido que ya existe detrás.

### Lo que hay hoy (verificado en código, 2026-08-07)

- La copy es `ctaTomorrow: "Come Back Tomorrow"` — `lib/content/editorial.ts:3165`
  (ES: `"Vuelve mañana"`, `lib/content/messages/es.ts:1936`).
- ⛔ **Con `ctaState === "tomorrow"` el CTA NO es un botón**: es un
  `<p role="status">` con las mismas clases de botón — `components/hub/challenge-card.tsx:571-583`.
  Renderiza una losa con forma de botón que no se puede tocar. Ese es el defecto real:
  el jugador ve un afordance de acción y no hay acción.
- Ya existe una nota debajo: `tomorrowNote: "Training stays open. Keep improving your
  scores."` (`editorial.ts:3171`), pintada en `challenge-card.tsx:584-588`. O sea: la
  invitación a seguir **ya está escrita, pero como texto, no como destino tocable**.
- 🔑 **Ya existe el motor que sabe qué ofrecer**: `lib/hub/content-loop.ts` deriva la
  *next best action* con 10 variantes en orden de prioridad estricto
  (`daily-pending` → `claim-pending` → `daily-limit-reached` → `daily-max-reached` →
  `continue-path` → `labyrinth-ready` → `improve-stars` → `next-piece` →
  `come-back-tomorrow` → `view-progress`). Cada variante trae `destination`, y
  **`come-back-tomorrow` es la penúltima**: sólo debería ganar cuando de verdad no queda
  nada. Hoy la tarjeta del Daily la muestra por su cuenta, sin consultar esa escalera.

**Consecuencia:** esto NO es escribir copy nueva. Es **cablear la tarjeta del Daily al
Content Loop que ya calcula la respuesta correcta**, y devolverle al CTA su naturaleza de
botón cuando hay destino.

### Forma propuesta

- `DAILY COMPLETE ✓` como estado (no como despedida).
- CTA principal: **KEEP TRAINING** → destino del Content Loop.
- CTA secundaria: **EXPLORE LABYRINTHS** (habilita el puente al Sprint 2).
- Nota chica: `Next Daily Focus unlocks tomorrow` — mantiene la regla diaria **sin expulsar**.

### Riesgos a cubrir en el spec

- La cuota diaria de LEARN (10) puede haberse agotado: `daily-limit-reached` /
  `daily-max-reached` ganan por prioridad. **KEEP TRAINING no puede llevar a una pared.**
- `come-back-tomorrow` legítimo (nada que hacer) tiene que seguir existiendo como estado
  terminal honesto — el fallback es `view-progress` (`/trophies`), nunca pantalla muerta.
- El CTA pasa de `<p role="status">` a `<button>`: cambia el árbol de accesibilidad y hay
  tests que fijan hoy el comportamiento informativo
  (`challenge-card.test.tsx:571`, `hub-lite-scaffold.test.tsx:343`, que documenta
  explícitamente "COME BACK TOMORROW es un estado, no un gate").
- Baselines VR del hub.

**Impacto potencial:** activación secundaria + duración de sesión + descubrimiento.

---

## Sprint 2 — "Hay algo más que Daily" (Laberintos)

**Problema:** si aparecen uno tras otro, se sienten como **otra lista de ejercicios**,
cuando deberían sentirse como un **modo especial**.

### Lo que hay hoy (verificado)

- Confirmado: los laberintos **son nodos del mismo carril** que los ejercicios.
  `TrainingNodeKind = "exercise" | "labyrinth" | "badge" | "mastery"`
  (`lib/training/path.ts:28`), intercalados por pieza, y el primero de cada pieza
  desbloquea a N estrellas de ejercicio (`path.ts:85`). La sensación del founder es
  estructural, no de presentación.
- ⚠️ **Las estrellas de laberinto NO suman al total de la pieza** (`path.ts:34`:
  *"exercise stars ONLY — labyrinth stars never count"*). Esto importa para los
  Sprints 3 y 4: hoy la cadena *más dificultad → más estrellas → mejor posición* **está
  cortada en el laberinto**.

### Forma propuesta

Entrada propia:

```
LABYRINTHS
Chess challenges for deeper focus
[ ENTER ]
```

Y adentro Rook Maze · Bishop Maze · Knight's Tour · etc., idealmente como mapa/progresión.
Empalma directo con el Sprint 1: *Daily terminado → **Explore Labyrinths***.

⚠️ Ojo: hay **seis juegos firma**, uno por pieza, y el de la torre *son* los laberintos
curados. La entrada tiene que nombrar bien qué agrupa (ver
`project_signature_games_per_piece`) o promete un modo y entrega otro.

---

## Sprint 3 — "Tengo algo por qué volver" (Leaders + rewards)

Primer mecanismo serio de **re-engagement social**. La competencia **ya apareció sola**
(hay gente que se trepó) — no hay que inventarla, hay que darle escenario.

Mejorar el podio **antes** de anunciar recompensas: cuando se publique *"Top players this
week will receive…"*, la pantalla tiene que valer la pena para querer verse ahí.

- 🥇🥈🥉 con avatar / nombre / score.
- Y abajo, lo más importante: **`Your rank: #18 — 42★`**. El leaderboard no puede ser sólo
  para los tres primeros; la persona necesita saber **qué tan lejos está**.
- ✅ Parcialmente construido: `yourRankLabel: "Your rank"` ya existe
  (`editorial.ts:653`, ES `"Tu posición"`). Auditar qué renderiza hoy antes de specear —
  puede ser menos trabajo del que parece.
- Ya vive **Leaders Weekly** en prod, con ventana lunes 00:00 UTC half-open. Las
  recompensas semanales se pueden lanzar **sin construir una economía grande**.

---

## Sprint 4 — Profundidad (dificultad / multi-★)

Va **después** de ordenar el loop existente. Ventaja: **reutiliza contenido existente
aumentando rejugabilidad** en vez de fabricar cien ejercicios nuevos.

- ⭐ Easy · ⭐⭐ Focused · ⭐⭐⭐ Master — o dentro del mismo ejercicio:
  1★ complete · 2★ great · 3★ perfect.
- Conecta con Leaders: más dificultad → más estrellas → mejor score → mejor posición.
- ⛔ **Precondición descubierta**: mientras las estrellas de laberinto no cuenten al total
  (Sprint 2), esta cadena no cierra. Decidir ahí, no acá.
- ⚠️ Recordar que las estrellas del peón cuentan **fallos**, no movidas
  (`promotionRunStars`): toda corrida ganadora mide `7-fila`. Un rediseño de bandas tiene
  que respetar esa asimetría o el peón queda fuera del esquema.

---

## Sprint 5 — P2P en Play (no tocar todavía)

Podría ser gigantesco, y también es el que más fácil se convierte en **agujero de tiempo**:
matchmaking · presencia · desconexiones · reconexión · turnos · sincronización · cheating ·
abandono · UX de MiniPay · y después posiblemente stakes/rewards.

Primero hay que demostrar que el loop de arriba produce gente que vuelve. **P2P llega sobre
una base sana o no llega.**

📌 Nota de viabilidad ya medida: el duelo asíncrono **por enlace** es ~2–3 días, no meses
(`docs/product/2026-07-13-async-link-duel-feasibility.md`) — `validate-game.ts` ya es el
árbitro y Redis ya está cableado. Es una rampa posible hacia P2P, no P2P.

---

## Cómo se mide

Después del Sprint 3 se miran las métricas antes de abrir el 4. Si mejoran sesión y
retorno, se sigue; si no, se revisa la hipótesis del loop, no se agregan features.

`/stats` ya publica DAU/MAU/retención (es requisito §8 del listing de MiniPay).
⚠️ El techo de contenido está medido: 78 niveles, 177★ — y **434 de 443 jugadores jugaron
un solo día**. Ese número es exactamente el que este bloque intenta mover.

## Lo que este roadmap NO abre

El bloque de performance de MiniPay quedó **cerrado** el 2026-08-07 y no se reabre por
décimas. La deuda declarada ahí (piso de FCP ~1.736 ms, `align-self: stretch` del hub,
telemetría del `componentDidCatch`) sigue **no agendada** a propósito.
