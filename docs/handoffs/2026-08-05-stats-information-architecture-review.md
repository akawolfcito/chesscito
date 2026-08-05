# Review — Stats dashboard information architecture

**Fecha:** 2026-08-05 · **Rama:** `feat/stats-information-architecture`
**Base:** `7ecc64da` · **Estado: implementado, verificado, SIN commitear** (parada
declarada en el handoff de cierre §9)

> Reorganiza lo que ya existía. **Cero RPC, cero SQL, cero agregador, cero caché,
> cero fuentes, cero rutas.** Ninguna cifra cambió de valor.

---

## 1. Qué se hizo

| Archivo | Cambio |
|---|---|
| `components/stats/stats-dashboard.tsx` | reescrito: 9 bloques en el orden aprobado, dos `<details>`, tablas extraídas a `TrendTable` / `PlayersTable` |
| `components/stats/primitives.tsx` | `SubSection` + `Disclosure` nuevos; `data-testid` en card/valor/label; densidad móvil |
| `lib/stats/copy.ts` | 17 claves nuevas EN+ES · `MINIPAY_LAUNCH_DATE` · `formatLaunchDate` · `withTokens`/`withCount` |
| `components/stats/__tests__/stats-dashboard-ia.test.tsx` | **22 tests nuevos**, contra el DOM renderizado |

### Jerarquía entregada

`Header → Since MiniPay launch · August 3, 2026 → **At a glance** (5) →
**From first visit to habit** (5 checkpoints) → Engagement → Audience →
Activity → Saved on Celo → Methodology`

Las doce mediciones anteriores siguen todas en pantalla, agrupadas bajo la idea
que sirven (`SubSection`, `h3`): Engagement = activación + acceso + retención +
hábito · Audience = personas + Learn/Play + países + ranking · Activity = trend.

### At a glance — exactamente cinco

Sessions (7d) · Active people (7d) · Exercises started · Exercises completed ·
**Early habit signal** (bucket de 3+ días, con el aviso de maduración **en la
tarjeta**). ⛔ Ningún ratio nuevo: los cinco son lecturas que ya existían.

### El recorrido

`app opened → exercise started → exercise completed → daily focus completed →
active on 3+ days`, escala compartida, **sin porcentajes entre pasos**, con el
disclaimer obligatorio inmediatamente debajo. Un checkpoint no medido **se cae
de la lista** en vez de dibujarse en cero — una barra vacía al final de un
recorrido se lee como «nadie llegó».

---

## 2. Medición — antes y después

Medido con Playwright sobre el HTML **servido por el componente real** con datos
a escala de producción (30 días de trend, 373 jugadores, 8 países) y el CSS del
build.

```
                   390 px      768 px     1280 px
antes (7ecc64da)   6.794       6.210       6.124
después            4.815       4.425       4.325
                  −29,1 %     −28,7 %     −29,4 %
overflow horizontal: ninguno en los tres · con TODOS los <details> abiertos: 6.870 px, sin overflow
filas visibles: 83 → 20 (7 de trend + 10 de ranking + 3 del desglose)
```

⚠️ **La metodología está validada, no asumida:** el probe con el código viejo
devolvió **6.794 / 6.124 px exactos**, los mismos números que el handoff de
cierre midió contra la página desplegada.

---

## 3. Decisiones que no estaban en el spec

1. **El recorte de 50 filas del ranking ahora se declara en pantalla**
   (`This table lists the top 50 of 373 ranked players.`), debajo de la tabla y
   **fuera** del `<details>`. El censo publica 373 y la tabla renderiza 50: sin
   esa línea el lector no puede reconciliar los dos números. Es la lección de
   [[feedback_an_unauditable_number_reads_as_a_lie]], y el defecto ya existía
   antes de esta iniciativa (la página vieja cortaba en 50 sin decirlo).
2. **`Show 40 more players`**, no «los 40 restantes»: quedan 323 sin renderizar,
   así que «restantes» habría sido falso.
3. **Densidad móvil por breakpoint** (`gap`/`padding`/tamaño del valor sólo bajo
   `md:`): desktop queda intacto, que es la prioridad declarada del proyecto.

---

## 4. Restricciones heredadas — verificadas una por una

| Restricción | Cómo quedó |
|---|---|
| Access journey NO es embudo | sigue en tarjetas independientes, con su nota |
| Cohorte 0 → «Not enough history yet» | `RetentionRow` intacto |
| `null` → em-dash, nunca `0` | test: 4 dashes con activación/hábito/personas caídos |
| Nota de `surface` NULL junto al desglose | sí, y **nunca** colapsada |
| Sin claves técnicas de eventos | `stepLabel` para los cinco pasos del recorrido |
| Una URL, sin tabs | test: cero `role="tab"` |
| Sin `"use client"` | `<details>` nativo; el bundle de `/stats` no creció por JS |
| `generatedAt` ≠ `census.asOf` | los dos sellos siguen separados y visibles |
| Sin mints en el trend | intacto |
| `locale` fuera de toda clave de datos | no se tocó el snapshot |

**Nunca colapsado:** `generatedAt`, metodología, aviso de integridad, nota de
`surface` NULL, reloj del censo, recorte del ranking. Hay un test que borra los
`<details>` del HTML y exige que sigan presentes.

---

## 5. Verificación

```
suite landing      252 passed / 25 files · 0 skipped   (corrida DESPUÉS del build)
tsc --noEmit       exit 0
build              exit 0 · /stats 8,9 kB
altura móvil       6.794 → 4.815 px @ 390
```

⚠️ `apps/web` **no se tocó**; su suite no se volvió a correr.
⚠️ El `next start` local **no tiene credenciales de Supabase**: `/stats` sirve
vacío ahí. Por eso la medición va contra el probe con fixture, no contra el
server local — un `next start` sin datos habría medido una página que no existe.

---

## 6. Riesgos abiertos

| # | Riesgo | Nota |
|---|---|---|
| 1 | **El cold start (1,6–7,3 s de TTFB) sigue igual** | esta capa no lo toca; es lo primero que ve un reviewer del listing |
| 2 | **`Engagement` (1.399 px) y `Audience` (1.621 px) siguen siendo los bloques largos** | bajar más exigiría colapsar mediciones que el spec no autorizó a esconder. **Decisión del founder**, no mía |
| 3 | **`MINIPAY_LAUNCH_DATE` es un dato editorial** | si la fecha real no fue el 3 de agosto, la página miente y ningún test lo puede saber |
| 4 | **La copy nueva no pasó por `pnpm content:audit`** | el guard de lenguaje del monorepo cubre `apps/web`; acá lo cubre el test de brief en `presentation.test.ts` (sin «on-chain», NFT ni mint) |
| 5 | **Sin VR** | la suite de Playwright no fotografía el landing |

---

## 7. NEXT ACTION

> Revisión visual del founder en móvil. Si pasa: **un solo commit de producto**,
> y con él viajan los **dos commits documentales** de `main` local
> (`01f6a10f`, `7ecc64da`) en **un push y un build**.
>
> ⛔ Nada commiteado todavía. `SESSION.md` sigue fuera.
