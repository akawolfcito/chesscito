# PLAY hub, CTA primario y sistema de color — handoff

**Fecha:** 2026-08-29 · **Rama:** `main` local · **⛔ NADA DESPLEGADO**
**Sesión previa:** `docs/handoffs/2026-08-28-play-core-loop-implementation.md`
**Evidencia:** `docs/audits/2026-08-28-core-loop-diagnostic.md`

---

## 0. ⛔ Lo primero: nada de esto está vivo

`main` está **54 commits adelante de `origin/main`**. Los 7 de estas dos sesiones son la punta;
**47 ya estaban sin pushear antes de empezar** y no se auditaron. Mandar 54 commits juntos es un
perfil de riesgo distinto a mandar 7 — conviene mirar qué son los otros 47 antes del push.

**Toda decisión de producto pendiente depende de la ventana de medición, y la ventana no
arranca hasta el deploy.** Seguir construyendo encima es acumular apuestas sin cobrar ninguna.

---

## 1. Los 7 commits, y qué hace cada uno

| Commit | Qué |
| --- | --- |
| `0ec18cc0` | **Audit** del core loop — las dos fugas medidas por separado |
| `ce62e065` | JUGAR OTRA pasa a CTA primaria en los 4 end-states (Coach baja en orden, no en prominencia) |
| `baf607a3` | **Replay instantáneo** + la X sale al Hub + telemetría (`game_id`, `first_move_made`, `play_again_game_started`) |
| `2bc4ebf0` | Handoff del ciclo anterior |
| `40b0a119` | **Pase visual** — barra morada full-width con espadas; arreglo del desborde del CTA del Coach |
| `51714cd4` | Inventario de assets regenerado (3 consumidores nuevos de `hub.enter-arena`) |
| `d1190249` | **CTA del hub prendido** + morado derivado + campanita en PLAY + `NEW DUEL` en el Journal |

**Verificación en el último commit:** 727 archivos / 9.243 tests passed, exit 0 · typecheck limpio ·
lint 0/0.

⚠️ El conteo de `CLAUDE.md` (614 archivos / 7.565 tests, 2026-08-09) sigue viejo. Lo medido hoy en
`main` es **727 / 9.243**. Vale actualizar la fecha de referencia.

---

## 2. El siguiente paso, en orden

### Paso 1 — Cerrar el VR (única cosa entre acá y el deploy)

Se acumularon **tres** cambios visuales sin regrabar: jerarquía de CTAs → pase visual → CTA del hub.

1. ⛔ **Bajá el dev server del 3002 primero.** `reuseExistingServer: !CI` hace que Playwright adopte
   el que ya esté corriendo, y ese proceso **nunca recibe el pin de `NEXT_PUBLIC_CHAIN_ID`** del
   `webServer.env`. Se pone rojo por entorno y parece regresión de código.
   ⚠️ En esta sesión quedó uno vivo que **no es nuestro** (PID 67510 al momento de escribir).
2. Corré **`--project=minipay --update-snapshots=none`**. `none` no puede grabar, así que un verde
   ahí sí comparó.
3. **Mirá los `-actual.png` antes de regrabar** (`apps/web/e2e-results/artifacts/<caso>/`).
   Varias rojas que no comparten componente = un banner de dev de tu shell, no un cambio de layout.
   Un `-diff.png` con un bloque rojo sólido arriba es la firma de un banner.
4. Regrabá **una sola vez**, sólo las que cambiaron a propósito.

### Paso 2 — Push (lo hace el founder) y arranca la ventana

### Paso 3 — Instrumentar el abandono

Es lo más barato de la lista y lo único que vuelve medible la fuga más grande. Faltan del mínimo
set del audit §B.3 (2 de 5 ya están hechos):

- ⛔ `arena_game_abandoned` con `game_id`, `moves`, `elapsed_ms`, `reason`, por
  `pagehide`/`visibilitychange` con `sendBeacon`
- ⛔ `reached_board` (o un `arena_board_ready`) al terminar los 1.800 ms de transición
- ✅ `game_id` en `arena_game_start` — hecho
- ✅ `first_move_made` — hecho

Sin esto, **las 1.752 personas que empiezan y no terminan siguen siendo estructuralmente
invisibles**: no hay ningún evento durante la partida, así que "rebotó en 2 s" y "jugó 40
movimientos y cerró" producen la misma traza.

---

## 3. Tres decisiones de producto abiertas (John)

### 3.1 Daily vs Warm-up → **muere el Warm-up**

**[HECHO]** Son el **mismo puzzle**: los dos llaman `getDailyTactic(today)`
(`hub-daily-tile.tsx:123`, `play-tactics-tile.tsx:38`).

| | Daily | Warm-up |
| --- | --- | --- |
| `experience` | `"daily"` | `"play"` |
| Da Peones | **sí** | **no** |
| Alimenta racha | sí | no |
| Personas (jul–ago) | 853 abren / 536 completan | 738 / 400 |

Razones: el Warm-up **no paga nada** (400 personas resolvieron y recibieron cero — enseña que
esforzarse ahí no rinde), y no se pueden validar dos hábitos a la vez con esta población.

⚠️ **Condición que lo hace reversible:** al sacarlo, `daily_tactic_started` debería subir ~el
volumen del warm-up. **Si no sube, los dos jobs eran reales** y vuelve con su propio pool.

### 3.2 El slot de vitrina → segmentar por saldo y bajarlo del CTA

Intención del founder (vitrina de campañas) es correcta; el problema es que **su estado por
defecto es una compra**. Medido: **59,6% de quienes ven la hoja de PRO no tiene un solo
stablecoin** (1.096 de 1.838).

| Segmento | Qué mostrar |
| --- | --- |
| Sin stablecoin (59,6%) | la ruta de **ganar**: Daily → Peones |
| Con saldo | la oferta / campaña |
| Ya PRO | contenido o evento, nunca la venta |

Y va **debajo** del CTA primario, no encima.

### 3.3 Prioridad

`0` medir lo ya enviado → `1` instrumentar abandono → `2` matar Warm-up → `3` segmentar vitrina →
`4` card del Coach (fase 2 de Sally).

⚠️ **Advertencia de atribución:** en dos días entraron replay instantáneo, X al hub, jerarquía
invertida, CTA del hub y sistema de color nuevo. **Todo cae en la misma ventana, sin A/B.** Si el
retorno sube, no se va a saber cuál lo hizo.

---

## 4. El sistema de color, derivado (no elegido)

⛔ **El morado original salió de una imagen generada con IA. Nadie lo eligió.** Estos valores sí
están medidos.

**Ocupación de tono del hub real** (118.885 px de `8.png`):

| Franja | % | Qué es |
| --- | ---: | --- |
| 40–49° dorado | 26,9% | chips, marcos, escudo |
| 200–219° azul | 32,9% | **el cielo** |
| 70–89° verde | ~12% | el paisaje |
| **270–279° morado** | **3,8%** | **el escudo + las espadas** |

**Por qué morado:** es el único tono grande sin trabajo asignado, y ese 3,8% *es la marca*, así que
el CTA se ata al logo en vez de competirle.
**Por qué NO azul:** un tercio del hub es cielo — por eso el CTA azul viejo se hundía. Descartado
por medición, no por gusto.

**Los stops salen del escudo** (61.752 px morados, hue 276–277° en toda la escala):

| Token | Valor | Origen | Contraste vs `#fff8ed` |
| --- | --- | --- | ---: |
| grad claro | `#9251c6` | el stop más claro que aún pasa AA normal | **4,72:1** |
| grad oscuro | `#5a2180` | brand L30 | **10,13:1** |
| border | `#40145d` | brand L20 | — |
| bevel | `#250737` | brand L10 | — |

**Los dos extremos pasan WCAG AA**, así que la etiqueta se lee caiga donde caiga en la barra.

**Contrato vigente:** morado = acción interactiva · dorado = dinero/premium · crema = superficie y
terciario · **verde = el mundo, no un CTA**.

---

## 5. Deudas explícitas

| # | Deuda | Por qué no se hizo |
| --- | --- | --- |
| 1 | ⛔ **`PrimaryPlayCta` sigue verde** (6 consumidores: selector, duel setup/arena/end, hub scaffold) | Es **asset-based** (`hub.btn-stone-bg`) y tiene **spec aprobada** en `visual-language-minimum-2026-05-03.md §4.11`. Pide arte nuevo y contradecir un spec. **Hoy conviven dos sistemas de color.** |
| 2 | ⛔ **PRO y DUEL son el mismo morado, apilados a ~80px** | Compiten por el mismo significado. Se resuelve con 3.2 (PRO a dorado + bajarlo). |
| 3 | **VR sin regrabar** | Ver paso 1. |
| 4 | **El rail y el CTA duplican `DUEL`** | Mismo destino (`onArenaPress`). Los aria ya son distintos (defecto a11y cerrado), pero visualmente es redundante. Decisión pendiente: sacar el tile o dejar el atajo. |
| 5 | **El header tiene dos gramáticas** | 3 píldoras con marco (🏆 ♟ EN) + 2 íconos sueltos (✉️ 🎁). El sobre se agregó con el patrón existente, no se rediseñó. |
| 6 | **El regalo del header ES el Daily**, no una promo | La mecánica con 4,4× de retorno está disfrazada de premio gratis. Y **no hay evento de impresión**: no se sabe cuánta gente lo ve. |
| 7 | `lossPlayAgainCta` / `lossSubtitle` sin uso | Se conservan por la paridad de claves del guard ES. |

---

## 6. Presupuesto de copy de botón (nuevo)

> **Máx. 3 palabras / ~18 caracteres. Sin punto final.**

⚠️ **`pnpm content:audit` NO lo hace cumplir.** Umbral **32 caracteres** y **warn-only (`exit 0`
siempre)**. Por eso `"Let's see what happened."` (24) pasó y desbordó su píldora. Hoy reporta 151
hallazgos, de los cuales **sólo 27 son botones reales** (el resto son `ariaLabel`, falso positivo
conocido del heurístico).

---

## 7. Taxonomía vigente

> **PLAY** es la sección · **DUEL** es el modo · **JUGAR** empieza una partida ahora ·
> **JUGAR OTRA** empieza otra inmediatamente · **NUEVO DUELO** abre el selector · **X** sale al Hub.

**Regla:** el label describe lo que pasa **inmediatamente después del tap**.

| Superficie | Label | ¿Inicia partida? | Estado |
| --- | --- | --- | --- |
| Hub | `DUEL` | no, selector | ✅ |
| Selector | `PLAY` | **sí** | label ✅ · color ❌ (deuda 1) |
| End-states (4) | `PLAY AGAIN` | **sí** | ✅ |
| Match Reviewer | `NEW DUEL` | no | ✅ |
| Journal | `NEW DUEL` | no | ✅ |
| Rail del hub | `Duel` | no | ✅ (deuda 4) |

---

## 8. Estado del working tree

- `docs/audits/2026-07-18-theme-runtime-inventory.json` — se regenera solo al correr la app; si
  aparece modificado, es eso.
- `docs/audits/2026-08-28-docker-footprint-audit.md` — **sin trackear, no es de estas sesiones.**
- Docker quedó levantado (se usó para `pnpm ops:query`).
- ⚠️ Un dev server ajeno en el **3002** (PID 67510 al momento de escribir). **Bajarlo antes del VR.**

---

## 9. Números de referencia para medir después

| Métrica | Línea base (2026-07-23 → 2026-08-28) |
| --- | ---: |
| Llegan al hub → inician partida | 5.957 → 3.636 (**61%**) |
| Completan el tour → inician partida | 5.643 → **64,6%** |
| Inician → terminan | 3.636 → 1.898 (**52%**) |
| Terminan 1ª → juegan 2ª | **45,2%** (42,5% el mismo día) |
| `play_again_tap` → partida ≤5 min | **51,8%–63,8%** |
| Entradas al Reviewer vía X | **93,3%** de 2.064 → debería caer a ~0 |
| Terminó ≥2 partidas en D0 (activación) | **12,1%** de alcance, lift **2,47×** |
| Retorno baseline (cohorte ≥7 días) | **6,5%** |

⚠️ Ninguna comparación futura será un experimento controlado: no hay A/B y la población de agosto
llegó casi entera en una semana. Es un before/after, con todo lo que eso no prueba.
