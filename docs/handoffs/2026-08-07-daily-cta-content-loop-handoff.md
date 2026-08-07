# Handoff — Sprint 1: el CTA post-Daily consume el Content Loop

**Fecha:** 2026-08-07 · **Rama:** `feat/daily-cta-content-loop` (3 commits, **sin pushear**)
**Spec:** `docs/specs/2026-08-07-daily-cta-content-loop.md` (v2, READY)
**Red team:** `…-redteam.md` (4 P0 + 4 P1 resueltos) · **UX:** `…-daily-cta-slot-ux.md` (Sally)
**Roadmap del bloque:** `docs/product/2026-08-07-retention-loop-roadmap.md`

---

## Estado

| | |
|---|---|
| Suite web | **7504 passing / 610 files, EXIT=0, cero `Unhandled Errors`** (baseline previa: 7471 / 607) |
| `tsc --noEmit` | limpio |
| VR | **minipay 62/62**, corrido con `--update-snapshots=none` |
| 390 px | **medido**: las 8 etiquetas en una línea, `overflow=0`, altura 53,2 px |
| Contraste banda | **4,74:1** subtítulo · **7,27:1** título (piso AA 4,50) |
| Árbol | limpio |

### Commits

| Hash | Qué |
|---|---|
| `3e6db69` | `lib/hub/cta-slot.ts` — módulo puro + tabla de verdad (15 tests) + spec/red-team/UX/roadmap |
| `74fd2e4` | card, scaffold, adapter, copy EN/ES, CSS, source guards, `resolveCtaTap` |
| `2235ac0` | probe de `/dev/learn-hub` + un baseline VR regenerado |
| `59a0060` | handoff + regla de VR en `CLAUDE.md` |
| `479168b` | **banda de aviso hundida** (pedido del founder tras ver el device) |

---

## Qué cambió

El slot del CTA de la `ChallengeCard` dejaba de pasar `onFocusTap` en cuanto el día estaba
hecho y pintaba un `<p>` con clases de botón, desaturado (`saturate(.55)`) y con `opacity`
bajada: **el vocabulario de un control roto, servido en el segundo posterior a un éxito.**
El Content Loop derivaba la acción correcta y nadie la renderizaba.

Era una **regresión de integración**: el 2026-07-25 se ocultó el botón standalone START
FOCUS porque dos CTAs apilados hacían el panel ambiguo, y la tarjeta "absorbió su trabajo"
**sólo para el estado `start`**.

- `CtaState` pasa de 4 estados a 3: `join | complete | loop`.
- La tarjeta **ya no lee `focusPassport.todayDone`** para elegir el slot. Era una segunda
  lectura del hecho que el loop ya decide con `isCompletedToday`, hidratada por otro camino.
  El pasaporte sigue siendo dueño de las llamas; dejó de ser dueño del CTA.
- Terminal con clase propia `.challenge-card-cta--quiet`: una leyenda, sin fondo/borde/
  sombra/filtro, **con el `min-height` del botón reservado**.
- Dos notas, no una: `noteDailyReturns` (terminó todo) vs `noteTrainingResumes` (chocó con
  la cuota de sesión, que no es lo mismo). `tomorrowNote` retirada.
- `resolveCtaTap` concentra las dos decisiones que no son JSX — a dónde va y qué evento
  emite — para que el contenedor no crezca una segunda copia y para poder asertarlas sin
  montar el hub.

### Las dos excepciones, declaradas y no escondidas

1. **`daily-pending` conserva `startFocusExerciseDestination`** (`LEGACY_DESTINATION_VARIANTS`).
   El loop apunta a `/exercises?slot=daily`, y ese param tuvo la cuota diaria apagada hasta
   el 2026-08-05. Este sprint arregla el terminal; no mueve el camino más transitado.
   **Borrar esa constante es el trabajo pendiente, no un detalle.**
2. **`hub_start_focus_tap` queda exclusivo del start real.** Las otras seis variantes emiten
   `hub_content_loop_cta_tap` con `{ variant, destination }`. Sin esto, cualquier lectura
   histórica de esa serie se volvía incomparable en silencio.

---

## Baseline de exposición (OQ-2, medido 2026-08-07T19:56Z)

| Métrica | Valor |
|---|---|
| Filas `lite_season_passes` | 16 |
| **Pases activos** (`expires_at > now()`) | **13** |
| Wallets distintas con pase activo | **13** |

**Al 2026-07-27 eran 3: 4,3× en once días.** Misma definición de "activo" que
`readSeasonPassRow()`, para que el baseline y el código no discrepen.

⚠️ **13 es la población expuesta**: son los únicos que pueden ver el estado arreglado
(sin pase, `!isActive` gana y el slot es el banner de $0.99). Con esa n, **un jugador
cambiando de hábito mueve el 7,7%** — no soporta atribución causal fuerte. Lo que sí se
puede afirmar es exposición, y eso lo cuenta `hub_content_loop_cta_tap`.
**Al cerrar, re-medir: si la población creció, la comparación mezcla dos cohortes.**

---

## Adenda — la banda de aviso (`479168b`, tras la revisión en device)

El founder vio el terminal en el teléfono y pidió que ese espacio tuviera **aspecto de
banner**, para que más adelante pueda alojar un tip, un anuncio o un enlace. **Sólo estilo**:
la vitrina rotativa ya había sido descartada y sigue descartada.

**La decisión la tomó Sally y es mejor que ir quitando señales una por una.** El banner del
Season Pass es un objeto **ELEVADO** (`box-shadow: 0 3px 0` hacia afuera): viene hacia vos y
se presiona. La banda va **HUNDIDA** (sombra `inset`, degradé oscuro arriba para que la luz
caiga dentro del hueco). Eso vuelve el contrato de tap **físico, no leído**: elevado se toca,
hundido informa — se siente antes de razonar si hay chevron.

### El guard se REENCUADRÓ, no se aflojó

El guard AC-5 original prohibía `background`, `border` y `box-shadow` en
`.challenge-card-cta--quiet`, y **habría bloqueado esta banda**. Pero la superficie nunca fue
el defecto: lo que decía "roto" era el **atenuado sobre forma de botón**. Ahora prohíbe el
contrato de tap — relieve `0 3px 0`, `is-pulsing`, `cursor: pointer` — y las sombras `inset`
quedan permitidas.

🆕 Y se agregó un guard que **lee el markup**, porque el chevron es un componente y no una
regla CSS: sin él, alguien lo agregaba al terminal y el guard de CSS pasaba en verde con la
banda prometiendo un tap igual.

> **CONTRATO: el chevron y el relieve entran el día que entre el `onClick`, en el mismo
> commit. Nunca uno sin el otro.** Eso es lo que impide que esta banda se vuelva la regresión
> que el sprint acaba de borrar.

### Tres cosas de Sally que evitaron bugs

- **Un `<p>` no puede contener un `<p>`.** El subtítulo pasó a `<span>`; si no, el navegador
  cierra el externo y renderiza un markup que nadie escribió.
- **`min-height: 52px`, NO los 54 del banner.** El guard lo compara contra
  `.principal-button-medium`; copiar el banner rompía el anti-CLS.
- **Sin icono en v1, con el hueco dejado en el markup.** Ningún slot de tema significa
  "noche / descanso"; los más cercanos dicen *"hay algo que hacer"*, lo contrario de este
  estado. Acuñar uno cuesta tres baselines pineados + `tsc`, para decorar el único estado que
  significa "no hay nada que hacer".

### ⚠️ Riesgo abierto que encontró Sally y NO se tocó

**El paso `challenge` del mini-tour es incondicional** (`hub-tour.ts:85`), así que su
spotlight puede iluminar la banda. La flecha animada vive sólo en la rama `join`, así que
**no hay flecha** — pero el spotlight sí. Es **preexistente** (hoy ilumina la leyenda plana) y
la banda lo **agrava**, porque una superficie propia atrae el gesto mucho más que texto
suelto. Fuera del alcance cerrado por el founder. Si se retoma: que el ancla se saltee la fila
cuando `kind === "status"`.

---

## Dos hallazgos que valen más que el sprint

### ⛔ Playwright graba los baselines que faltan y da el test por PASADO

`updateSnapshots: "missing"` es su **default**, sin pasar ninguna flag. La corrida completa
de este sprint reportó **69 passed** habiendo **creado 118 baselines** para `desktop`,
`iphone-safari` y `minipay-360` — proyectos que nunca tuvieron baselines — y comparado casi
nada. Se borraron con `git clean` y se repitió todo con `--update-snapshots=none`.

⇒ **El "VR 62/62" del repo es del proyecto `minipay` y sólo de él.** Regla ya escrita en
`CLAUDE.md`: correr `--project=minipay --update-snapshots=none`. PNG nuevos en el directorio
de snapshots son grabaciones, no cobertura.

### ⛔ El `webServer.env` no protege a un server REUSADO

`reuseExistingServer: !CI` hace que Playwright **adopte el `pnpm dev` que ya tengas en 3002**,
y ese proceso **nunca recibe el pin de `NEXT_PUBLIC_CHAIN_ID=42220`** — salió de tu shell, con
lo que tu shell tenga. Así se pusieron rojas `hub-shop-sheet-open` y `hub-clean` durante esta
sesión, en dos superficies que este diff **no toca**, y parecía una regresión de código.
**Bajá tu dev server antes de correr el VR.**

### ⛔ Un dev server arriba invalida la suite de Vitest, y no de forma honesta

No la pone roja: hace que **algunos workers no arranquen** (`Failed to start forks worker`),
y esos archivos **no corren**. El resumen dice "todo verde" con `exit 1`, y el error vive en
`Unhandled Errors`, en la **cola** del log.

**El síntoma que lo delata es el conteo de ARCHIVOS, no el de tests.** Medido hoy:

| | archivos | tests | duración |
|---|---|---|---|
| Con dev server + túnel | 610 → 605 → **604** | 7448 | **506 s** |
| Máquina libre | **610** | **7504** | **142 s** |

Una de esas corridas reportó "1 failed" que **no volvió a aparecer**: no era flake del test,
era un worker muriendo. ⛔ **Si el conteo de archivos no da 610, no confíes en la corrida** —
y nunca la reportes como número de commit. Ambas reglas quedaron en `CLAUDE.md`.

### ⚠️ El probe de `/dev/learn-hub` fotografiaba el fallback, no la feature

`fixture.tsx` pasaba `contentLoop: null` a las tres variantes. Tras el cambio, las tres
fotografiaban el estado de **pre-hidratación** — un status — y el VR **no cubría la
presentación de acción en absoluto**. Habría quedado verde sin haber fotografiado nunca un
botón. Corregido: `pro` fotografía la acción, `active` el terminal.

---

## Evidencia, no aserciones

- **Exhaustividad (AC-8)** verificada empíricamente: se agregó una variante sonda a
  `ContentLoopVariant` y `tsc` cayó en `cta-slot.ts(142,9): TS2322: … not assignable to
  type 'never'`. Sonda revertida.
- **390 px** medido con el CSS y la fuente reales sobre el probe: el botón lleva
  `white-space: nowrap`, así que una etiqueta larga **no se parte, se desborda** — por eso
  se midió `scrollWidth − clientWidth`, que dio **0** en las 8. `Prueba el laberinto` (19
  car., el techo declarado) entra. **El fallback `Al laberinto` no hace falta.**
- **VR revisado antes de regenerar**: se leyeron el diff y el actual. `guest` y `pro` pasan
  contra sus baselines **originales sin tocar** ⇒ el botón nuevo renderiza **pixel-idéntico**
  al `start` viejo. Un solo baseline regenerado: `vr18-learn-hub-active`.
- **Guards de CSS por lectura de fuente**, no por layout: jsdom no mide altura, así que un
  test que dijera medirla pasaría verde sin medir nada.

🧯 **Corrección a algo que afirmé a mitad de sesión:** dije que la fila de llamas era
dependiente de la fecha y ensuciaría el baseline. **Falso** — `pro` pasó contra su baseline
original. El único diff real era el slot del CTA.

---

## Próximos pasos

1. ✅ **Revisado en device por el founder** (2026-08-07, vía quick tunnel de cloudflared).
   De ahí salió el pedido de la banda (`479168b`), ya implementado y revisado.
2. ▶️ **Del founder: push de la rama y merge a `main`.** Cinco commits, árbol limpio.
3. Al cerrar el sprint: **re-medir los pases activos** y leer `hub_content_loop_cta_tap`.
4. Sprint 2 del roadmap: **identidad propia de Labyrinths**, que arrastra una decisión de
   modelo — hoy `path.ts:34` dice *"exercise stars ONLY — labyrinth stars never count"*, así
   que la cadena *más dificultad → más estrellas → mejor posición* **está cortada**.

## Open questions

- **OQ-1 (decidida, escrita):** `role="status"` es una live region; al pasar a `<button>` se
  pierde el anuncio automático. Se acepta — ese anuncio pertenece al flujo de celebración,
  no al hub. Queda deliberado, no como efecto lateral.
- **Estado `complete`** (21 días terminados): sigue con `.challenge-card-cta--info`, la regla
  vieja con `saturate()` + `opacity`. Ahora que el terminal es una banda, `complete` es **el
  único estado que sigue vistiendo el botón atenuado** — o sea el defecto original, acotado a
  quien terminó las tres semanas. Fuera de alcance a propósito, pero ya no es simetría: es
  deuda visible.
- **El spotlight del mini-tour sobre la banda** (ver adenda). Preexistente, agravado.
- **¿Qué aloja la banda cuando llegue el primer tip?** Hoy es sólo geometría preparada. El
  contenido, su origen y su cadencia no están decididos — y la vitrina ROTATIVA está
  descartada.
- **¿Los otros tres proyectos VR merecen baselines?** Hoy no los tienen y cualquier corrida
  completa los "pasa" grabándolos. Generarlos son ~118 PNG que nadie revisó nunca.
