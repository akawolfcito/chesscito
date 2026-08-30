# PLAY hub — se retira el andamio de onboarding · handoff

**Fecha:** 2026-08-30 · **Rama:** `main` local (merge de `feat/play-hub-revision`)
**⛔ NADA DESPLEGADO.** El push a `origin/main` lo hace el founder.
**Spec:** `docs/specs/2026-08-30-play-hub-revision-ux-spec.md`
**Sesión previa:** `docs/handoffs/2026-08-29-play-hub-cta-and-colour-system-handoff.md`

---

## 0. Estado, medido

```
git rev-list --count origin/main..main   →  65
```

⚠️ **Medilo vos, no cites este número**: envejece con cada commit, incluido el de
este handoff. El handoff anterior nació diciendo 54, se guardó en 55, y cuando lo
medí eran 56.

De los 65: **56 ya existían** (auditados en
`docs/audits/2026-08-29-unpushed-commits-audit.md`), **8 son de esta sesión**, y 1
es el merge.

---

## 1. Qué cambió, y por qué

El hallazgo que ordenó todo: **el panel "Play Kingdom" era el placeholder de texto
que sobrevivió a la llegada de la imagen que lo volvía innecesario.** La spec
aprobada de 2026-05-03 pedía un `<KingdomAnchor>` — *"un world render diegético, el
home se convierte en un LUGAR"*. Ese render hoy se envía como fondo. La tarjeta que
lo suplía nunca se quitó. Borrarla no contradice el spec: lo completa.

| Commit | Qué |
| --- | --- |
| `33bed550` | El sobre del header se puede fotografiar (split `InboxTrigger`) |
| `bb9e25c6` | La fila PRO pasa a dorado y deja de competir con el CTA |
| `0d5f9296` | La auditoría de los 56 y la spec del hub |
| `97160329` | El toggle de modo avisa cuando lo tocan |
| `794f4811` | **Baja el andamio**: panel, mini-tour, tiles duplicados; DUEL reposicionado |
| `3592cd04` | El trofeo sale del header, que abría con un cero |
| `4f38b56d` | La campana del Inbox y el header en dos zonas |
| `8e74c286` | Las 13 baselines regrabadas, una sola vez |

**Verificación:** 729 archivos / 9.249 tests passed · typecheck limpio · VR
**68/68 verde con `--update-snapshots=none`**, con 82 baselines antes y después.

---

## 2. Las medidas del layout (device, no derivadas)

| Bloque | Antes | Después |
| --- | ---: | ---: |
| Panel Kingdom | 186px @ top 279 | **fuera** |
| DUEL | top 495 | **top 620** (zona del pulgar) |
| Hueco muerto | **171px** | 0 — pasa a ser paisaje |
| Reino visible | — | **355px** (265 → 620) |
| PLAY PATH | top 742 | top 742 (sin cambios) |
| Tiles del rail | 4 (Duel·Warm-up·Coach·Shop) | **3** (Coach·Shop·PRO) |
| Espadas cruzadas | 5 | **2** |
| `scrollHeight` | 844 | 844 (sin scroll) |

⛔ **La trampa que casi sale mal, y que hay que recordar:** el `margin-top: auto`
vivía en el rail. Borrar el panel sin mover el CTA le habría entregado todo el alto
recuperado a ese hueco: **de 171px a ~387px**. La pantalla se habría visto MÁS sin
terminar, no menos. Mover el `auto` arriba del CTA es la otra mitad obligatoria del
cambio, no un ajuste cosmético.

---

## 3. Tres cosas que afirmé mal y corregí

Quedan escritas porque cada una costó tiempo y puede volver a pasar:

1. **El "2,9× del mini-tour" no era causalidad.** 64,6% de quienes lo terminan
   inician partida contra 21,9% de quienes nunca lo vieron, pero **el grupo que
   nunca lo vio son 169 personas de 6.177** (gente que se fue antes de que se
   dibujara) y el que lo vio y lo abandonó convierte al **4,4%**. Es selección.
   Lo usé para defender el tour antes de mirar la composición de los grupos.
2. **El "vacío de 200–350px" que diagnostiqué era del fixture.** `/dev/play-hub`
   tiene fondo azul liso; el fondo real se aplica a nivel de página. Caí en la
   trampa que el repo ya documenta (*un fixture fotografía menos de lo que se
   envía*) justo mientras la citaba.
3. **El `+` de la píldora de Peones no es un botón.** Es un `<span aria-hidden>`;
   la píldora entera es el control. Construí sobre eso una regla de "contadores vs
   puertas" que no se sostiene: **las cinco cosas del header abren algo.**

---

## 4. Deudas y riesgos abiertos

| # | Qué | Estado |
| --- | --- | --- |
| 1 | ⚠️ **`TRAINING` quedó sin explicación.** El paso 1 del tour era la otra superficie que lo nombraba | **Instrumentado**: `app_mode_switch_tap` ya emite. Si la entrada a TRAINING cae en la ventana, el tour vuelve con su propio pool |
| 2 | ⚠️ **`/trophies` perdió su única entrada desde el hub.** Sobrevive por `TrophiesSheet` en el arena | **Verificar abriéndolo** antes de dar la sesión por cerrada |
| 3 | ⚠️ Falta verificar el layout en **`minipay-360`** (640px de alto, 204 menos) | La spec lo pide explícitamente; no se hizo |
| 4 | ⚠️ Una corrida de Vitest dio **1 roja no identificada** que no reprodujo | Sospecha: el test de cobertura de temas ESCRIBE el JSON del inventario mientras otro test podría leerlo. Anotado, no resuelto |
| 5 | El idioma quedó `🇺🇸 EN`, no `EN ˅` como el mockup | `LanguageChip` lo comparte LEARN; cambiarlo movería baselines de otra superficie |
| 6 | `PrimaryPlayCta` sigue verde en 6 consumidores | Sin cambios respecto del handoff anterior |
| 7 | Migración `inbox_v0` sin aplicar en prod | Degrada sin badge, **no rompe el hub** (verificado en código) |

---

## 5. ⛔ La trampa del VR, otra vez, con una variante nueva

La primera corrida completa dio **21 rojas, no 13**. Las 8 de más eran `support`,
`about`, `terms`, `privacy`, `frame-tablet-600`, `hub-clean`,
`hub-daily-tactic-open` y `hub-shop-sheet-open` — **páginas que no comparten un
solo componente con el hub**, que es la firma de un problema de entorno.

Había un `next-server` ajeno vivo en el **3002** y Playwright lo **reusó**. Al
empezar la sesión ese puerto estaba libre; el proceso apareció después.

⚠️ **La variante nueva:** esta vez **no era el banner ámbar**. El test de `privacy`
fotografió la **pantalla de acceso entera** ("Unlock your Chesscito journey /
ENTER"): el server reusado tenía el gate de Privy activo y se tragaba todas las
páginas. Con el 3002 libre, las ocho volvieron a verde **sin tocar una línea**.

> **La regla se confirma y se amplía:** varias rojas sin código en común son
> entorno. Y el síntoma no siempre es un banner arriba — puede ser otra pantalla
> completa. **Mirá el `-actual.png` antes de tocar nada.**

---

## 6. Lo que sigue, en orden

1. **Verificar la deuda 2** (`/trophies` por el arena) y la **3** (360×640).
2. **Push a `origin/main`** — lo hace el founder. Arranca la ventana de medición.
3. **Instrumentar el abandono** (`arena_game_abandoned`, `reached_board`): sigue
   siendo lo más barato y lo único que vuelve medible la fuga más grande. Las 1.752
   personas que empiezan y no terminan siguen siendo invisibles.
4. **Decisiones congeladas hasta que corra la ventana**: segmentar la vitrina de
   PRO por saldo (3.2) y la card del Coach.

⚠️ **Advertencia de atribución, ahora peor que en el handoff anterior.** A los
cambios de agosto (replay instantáneo, X al hub, jerarquía invertida, CTA del hub,
sistema de color) se suman ahora la baja del panel, la del tour, el rail nuevo y el
header nuevo. **Todo cae en la misma ventana, sin A/B.** Si el retorno sube, no se
va a saber cuál lo hizo. Sigue siendo un before/after, con todo lo que eso no
prueba.
