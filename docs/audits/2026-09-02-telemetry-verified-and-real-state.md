# Telemetría verificada y el estado real de Chesscito

**Fecha:** 2026-09-02 · **Tipo:** auditoría read-only (sin implementación)
**Método:** `pnpm ops:query` contra producción (SELECT-only, sesión `READ ONLY`, salida
redactada). 8 consultas sobre `analytics_events`. Ningún write.
**⚠️ Corrige a:** `2026-09-02-vitals-and-infra-rightsizing.md`

---

## Paso 1 — ¿Está rota la telemetría? **No.**

Tres pruebas independientes, todas negativas:

| Prueba | Resultado |
|---|---|
| **Acantilado vs curva** | No hay corte. La serie diaria baja en pendiente suave desde el 2026-08-06, sin ningún salto de un día a otro. |
| **Cobertura de dimensiones** | `surface`, `container`, `visit_id`, `app_version` al **100,0% todos los días** desde el 2026-07-24. `account_ref` en **91,7% hoy — el máximo histórico**, subiendo. |
| **Variedad de eventos** | Entre 97 y 120 tipos distintos por día durante todo agosto. Hoy 85 y subiendo (el día está a medias). |

Y hay eventos llegando de hace minutos en 25+ tipos distintos: `training_exercise_started`,
`labyrinth_complete`, `arena_game_start`, `exercise_complete`, `daily_tactic_completed`.

✅ **La telemetría está sana. Los números de abajo son gente, no un bug.**

⚠️ Un detalle previo: antes del 2026-07-23 las dimensiones son NULL en el 100% de las filas.
Eso **no es pérdida de datos** — es la migración `20260723040000_analytics_dimensions` que
las agregó ese día. Al día siguiente ya estaba en 99,5%.

---

## Paso 2 — La corrección: mi lectura de ayer estaba mal encuadrada

Ayer escribí *"la actividad cayó 95,5% en cuatro semanas"*. **Ese número compara el día de
hoy contra el día más alto de la historia del producto**, que fue parte de un evento de tres
días. Es el error clásico de medir contra un pico.

La serie real:

| Período | Cuentas/día | Qué es |
|---|---:|---|
| Antes del 2026-08-03 | 2–8 | pre-lanzamiento |
| **2026-08-03 → 08-05** | **1,287 · 2,084 · 1,181** | **el pico: 3 días** |
| 2026-08-06 → 08-08 | 351 · 189 · 177 | la caída del pico |
| 2026-08-09 → 08-28 | **~120–170** | **la meseta real** |
| 2026-08-29 → 09-01 | 80 · 109 · 100 · 100 | la meseta, erosionada |

**El número honesto no es −95%. Es: la meseta pasó de ~150 a ~100 cuentas/día en tres
semanas — cerca de −30%.** Sigue siendo una caída, pero es una erosión, no un colapso, y se
diagnostica distinto.

📉 Por semana (cuentas activas únicas): 5,351 → 934 → 878 → 701. La semana del 08-31 marca
228 pero **está incompleta** (dos días y medio), así que no se compara.

---

## Paso 3 — El hallazgo que importa: **93,4% juega UN solo día**

Desde el 2026-08-03, sobre 7,700 cuentas:

| Días activos | Cuentas | % |
|---:|---:|---:|
| **1** | **7,192** | **93,4%** |
| 2 | 375 | 4,9% |
| 3 | 65 | 0,8% |
| 4 | 19 | 0,2% |
| 5+ | ~49 | 0,6% |

Y el desglose diario lo confirma desde el otro lado: **todos los días entran ~72–115 cuentas
nuevas y vuelven ~25–45.** El grupo que vuelve es chico y **plano** — no crece nunca, ni
siquiera cuando entraron 2,000 personas en un día.

> **La meseta de ~120 cuentas diarias es ~75% gente nueva que no vuelve, más un núcleo
> estable de ~30 personas.**

⛔ Esto reencuadra todo. **No tenemos un problema de tráfico, tenemos un problema de
retención**, y el tráfico decreciente sólo lo hace visible: el producto vive de un caudal
constante de gente nueva, y cuando ese caudal baja, el número baja con él porque **debajo no
hay nada acumulado.**

Los 2,084 del 2026-08-04 no se convirtieron en una base. Se convirtieron en 55 personas que
volvieron al día siguiente.

---

## Paso 4 — El embudo de 30 días (cuentas distintas)

| Evento | Cuentas | Conversión del paso previo |
|---|---:|---|
| `peones_balance_viewed` | 7,443 | — (la puerta: abrió la app) |
| `play_hub_view` | 6,048 | **81%** |
| `arena_start_tap` | 3,753 | **62%** |
| `arena_game_start` | 3,753 | 100% ✅ sin fuga |
| **`arena_game_end`** | **1,938** | **⛔ 52%** |
| `training_exercise_started` | 1,163 | — (carril paralelo) |
| `exercise_complete` | 931 | **80%** ✅ |

⛔ **La fuga más grande del producto: de cada dos partidas que empiezan, una no termina.**
1,815 cuentas arrancaron una partida y la abandonaron a mitad. Es, por lejos, el escalón más
caro del embudo — más que la entrada, más que la conversión a ejercicios.

✅ **Lo que SÍ funciona:** `arena_start_tap → arena_game_start` no pierde a nadie (el botón
cumple), y `training_exercise_started → exercise_complete` convierte al **80%**. Quien entra
al carril de ejercicios lo termina. Los 1,163 de ejercicios generaron **9,217 arranques** —
8 por cuenta: ahí está el núcleo comprometido.

📊 Otros:
- `tx_progress_view` (2,543) → `tx_progress_done` (1,935) = **76%** de transacciones
  completadas. Sano.
- `hub_view` (LEARN) 655 cuentas vs `play_hub_view` (PLAY) 6,048. **LEARN es ~11% de PLAY.**
- `minigames_open`: **102 cuentas** en 30 días. Prácticamente nadie los encuentra.

⚠️ **`app_opened` está roto como métrica: 12,425 eventos pero sólo 10 cuentas distintas.**
Se emite antes de que exista `account_ref`, así que no sirve para nada que involucre
cuentas. Es exactamente el patrón documentado en [[feedback_funnel_event_names_are_not_what_they_seem]].
**No usarlo en ningún análisis de activación.**

---

## Paso 5 — El canal: MiniPay es el 95–99% de todo

| Día | Sesiones MiniPay | Sesiones browser |
|---|---:|---:|
| 2026-08-18 | 156 | **0** |
| 2026-08-24 | 151 | **0** |
| 2026-09-01 | 121 | **0** |
| 2026-09-02 | 51 | 1 |

**El canal web está efectivamente muerto, y es por diseño** — el allowlist de Privy lo
cierra (ver [[project_web_early_access_is_privy_allowlist]]). Días enteros con literalmente
cero sesiones de navegador.

⚠️ Esto le da peso al análisis de Farcaster: **hoy tenemos exactamente un canal de
distribución.** No es una hipótesis de diversificación, es que no hay un segundo.

---

## Correcciones a la auditoría de ayer

1. ⛔ **El −95,5% estaba mal encuadrado.** Medía contra el pico de 3 días. El número real es
   ~−30% sobre la meseta, en 3 semanas.
2. ⛔ **Los índices de dimensión NO son de columna sola.** Son compuestos
   `(surface, created_at desc)`, `(container, created_at desc)`, `(country, created_at desc)`
   — que es exactamente la forma correcta para "eventos de la superficie X en la ventana W",
   lo que `/stats` filtra. **Mi observación de que eran desperdicio se cae.** La palanca de
   almacenamiento sigue siendo la **retención**, no los índices.
3. ✅ Lo que se sostiene: `analytics_events` es 83% de la base; Redis no se suelta; los
   comandos de Upstash siguen sin poder medirse.

---

## Sobre BMAD: qué puede y qué no

Revisé el catálogo. **Ningún agente de BMAD/GDS lee una base de datos de producción** — son
agentes de *workflow* que producen documentos (PRD, GDD, arquitectura, diseño de tests) a
partir de una conversación. El análisis de arriba no lo hace ninguno; lo hacen `ops:query` y
las herramientas de ops que ya tenemos.

Dónde sí aportarían, **ahora que hay datos**:

- **`gds-agent-game-designer`** — el 93,4% de un-solo-día es un problema de **diseño de
  juego**, no de instrumentación. Es el agente indicado para atacar "por qué no vuelven" y
  "por qué la mitad abandona la partida a mitad".
- **`bmad-agent-analyst`** — para convertir estos hallazgos en decisiones de producto
  priorizadas.
- **`bmad-review-adversarial-general`** — para que alguien ataque estas conclusiones antes de
  que se conviertan en un plan.

⛔ Lo que **no** haría: pedirle a un agente de BMAD que "analice la data". No tiene cómo.

---

## Auditorías read-only que faltan (ninguna implementada)

| # | Pregunta | Herramienta |
|---|---|---|
| 1 | ¿Dónde exactamente abandonan la partida? (movimiento, tiempo, dificultad) | `ops:query` sobre `props` de `arena_game_start`/`end` |
| 2 | ¿Cuánto dinero entró de verdad? | `onchain-revenue.mjs` + `verify-stats-rpcs.ts` |
| 3 | ¿Qué ve el gate de PRO? | `pnpm ops:no-token` |
| 4 | ¿Los `stats_*` RPC dicen lo mismo que estas consultas? | `verify-stats-rpcs.ts` |
| 5 | ¿Qué experimentos/flags están vivos y en qué estado? | lectura de flags contra `docs/specs` |
| 6 | ¿El commit `de3d3856` movió algo? | serie por evento antes/después |
| 7 | ¿Cuántos comandos consume Upstash? | ⛔ bloqueado: faltan 2 env vars |

---

## Lectura de conjunto

Tres frases:

1. **La telemetría está sana** — lo que medimos es real.
2. **El problema no es que dejó de entrar gente; es que nunca se quedó nadie.** 93,4% juega
   un día. El pico de agosto no dejó base: dejó 55 personas que volvieron.
3. **La fuga concreta más grande está adentro de la partida**, no en la puerta: la mitad de
   las partidas que empiezan no terminan.

⛔ Y una consecuencia incómoda para la sesión anterior: **si el 93,4% no vuelve, llevar
Chesscito a Farcaster agrega un canal a un producto que todavía no retiene.** Traería gente
nueva al mismo embudo. Eso no invalida el análisis de Farcaster — el duelo sigue siendo lo
más barato y lo más nativo — pero cambia el orden: **retener primero, o distribuir hacia un
balde con un agujero medido en 93,4%.**

---

*Consultas en el scratchpad de la sesión; no se versionan. Reproducibles con
`pnpm ops:query <archivo.sql>`.*
