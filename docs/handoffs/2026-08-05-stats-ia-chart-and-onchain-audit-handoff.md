# Handoff — IA de `/stats`, gráfico del trend y auditoría on-chain

**Fecha:** 2026-08-05 · **Rama:** `main` (local)
**`origin/main`:** `b93a6972` · **`main` local:** `c98400ec` — **1 commit sin pushear**

---

## 1. Lo más importante de esta sesión no fue código

**Medí la cadena desde el listing en MiniPay (2026-08-03) y el resultado cambia
la lectura del producto.**

| | Eventos | Wallets | Dinero |
|---|---|---|---|
| **Compras de packs (Shop)** | **0** | 0 | $0 |
| **Victory mints (pagos)** | **216** | **149** | **2,45 USDT + 0,15 cUSD ≈ $2,60** |
| Scores guardados (gratis) | 94 | 67 | — |

Por día: **85** (3 ago) · **106** (4 ago) · **25** (5 ago, parcial).
Ventana: bloques 73.814.442 → 74.008.076.

### Las tres conclusiones

1. **Hay demanda y hay gente que paga.** 149 wallets distintas pagaron en 3
   días. Contra el pico de 2.612 sesiones del 4 de agosto, 106 mints ese día ≈
   **4 % de conversión a wallet pagadora**.
2. **El dinero es $2,60 por el TICKET, no por falta de compradores.**
   216 pagos × $0,01–0,03 (precios leídos del contrato) = $2,60. La aritmética
   cierra exacta.
3. **⚠️ Los ítems que sí valen algo no los compró NADIE.** El Shop tiene packs
   de $1,00 y $1,99 configurados y habilitados: **cero `ItemPurchased` desde el
   lanzamiento**. No es que compren poco — no compran. Eso es producto
   (¿se ve la tienda?, ¿se entiende?, ¿hace falta?), no precio.

### Dos cosas que conviene no olvidar

- **⚠️ El Shop paga a la EOA `0x917497…`, NO al contrato Treasury**
  (leído de `shop.treasury()`). La plata de packs nunca pasa por el treasury.
- **⚠️ Los ~$41 USDT del treasury NO salieron de estos 3 días.** Vienen de antes
  (desarrollo/pruebas) o de un fondeo manual. **La facturación real desde el
  listing son $2,60.**

Repetible: `node scripts/ops/onchain-revenue.mjs --since 2026-08-03`
(read-only, sin keys, sin firmar nada).

---

## 2. Qué se shippeó

```
c98400ec  feat(ops): audit on-chain revenue from a chosen date     ⬅ SIN PUSHEAR
b93a6972  feat(stats): give the trend chart a printed scale
ac7e5e44  feat(stats): plot the 30-day trend as stacked columns
ba2f373c  feat(stats): reorganise the dashboard information architecture
7ecc64da  docs(stats): define dashboard information architecture
01f6a10f  docs(stats): validate consolidated dashboard against production
```

### IA de `/stats` (`ba2f373c`)

Header → **Since MiniPay launch · August 3, 2026** → **At a glance** (5) →
**From first visit to habit** (5 checkpoints, sin porcentajes, con el disclaimer
de "no es un embudo de cohorte") → Engagement → Audience → Activity →
Saved on Celo → Methodology.

Altura móvil **6.794 → 4.815 px (−29 %)**, desktop 6.124 → 4.325. Sin overflow
horizontal en 390/768/1280. Detalle completo:
`docs/handoffs/2026-08-05-stats-information-architecture-review.md`.

### El trend, de tabla a gráfico (`ac7e5e44` + `b93a6972`)

- Columnas apiladas, **los 30 días visibles**; al `<details>` se fue la
  **precisión** (la tabla exacta), nunca los datos.
- **Escala impresa**: pico, su mitad y el **promedio de 30 días**, cada uno con
  su número. ⚠️ Load-bearing: `title` no dispara en pantalla táctil y esto vive
  dentro de MiniPay — sin números impresos las barras son formas.
- Cero JavaScript (flexbox + `%`), cero `"use client"` en toda la página.
- Paleta `#d9821e` / `#8a6818` **validada con script** (CVD ΔE 12,0 protan;
  visión normal 16,1). El WARN de contraste se descarga con leyenda etiquetada
  + tabla, como exige la regla.
- ⛔ Escala logarítmica descartada a propósito: separaría los días chicos pero
  hace que un salto de 13× parezca chico.

---

## 3. Estado

```
suite landing      258 passed / 25 files · 0 skipped   (correr DESPUÉS del build)
tsc --noEmit       exit 0
build              exit 0 · /stats 8,87 kB
sin commitear      SESSION.md  ⬅ queda fuera, siempre
```

⚠️ `apps/web` no se tocó en toda la sesión; su suite no se volvió a correr.
⚠️ Los guards de `.next/static` se saltean sin build: correr la suite del
landing **después** de `pnpm -C apps/landing build`.

---

## 4. Decisiones tomadas en el camino

| Decisión | Por qué |
|---|---|
| **El ranking declara su recorte** (`top 50 of 373 ranked players`) | el censo publica 373 y la tabla renderiza 50; un número que no se puede reconciliar se lee como mentira |
| **La fecha de lanzamiento es constante editorial** | derivarla de telemetría publicaría "cuándo empezamos a medir" como "cuándo lanzamos" |
| **Densidad móvil sólo bajo `md:`** | desktop intacto |
| **El trend muestra los 30 días** | invierte la regla del spec (7 visibles / 23 ocultos) **hacia mostrar más** |

---

## 5. Lo que el founder dejó dicho

- **`/stats` es para pantalla grande**, no móvil. Optimizar altura móvil **no**
  es la prioridad ahí.
- **Las series por fecha se leen en gráfico, no en tabla.**

---

## 6. NEXT ACTIONS

1. **Pushear `c98400ec`** (el script de auditoría). El merge va a `main` local;
   el push a `origin/main` lo hace el founder.
2. **Layout ancho para desktop** — el pendiente explícito. Hoy `/stats` está
   capado en `max-w-[860px]` (`stats-dashboard.tsx`), o sea una columna angosta
   en 1280+. Lo que rinde: ensanchar y pasar a grid de 2–3 columnas para
   Engagement y Audience.
3. **Decidir qué hacer con la tienda.** Es el hallazgo de la sesión: 4 % de
   conversión a wallet pagadora y **cero** compras de los ítems de $1–$2. Antes
   de tocar precios, mirar si la tienda se ve y se entiende.
4. **Opcional — indicador de dirección en el headline** (7 d vs. 7 d previos).
   ⚠️ El spec prohibió ratios nuevos en *At a glance*: necesita OK explícito.

## 7. Open questions

- ¿De dónde salieron los **~$41 USDT** del treasury? No son de estos 3 días.
- ¿Cuánto se perdió en el colapso de la base? El script ya da el lado de la
  cadena; falta el diff contra `peones_ledger` / `victories`.
- La historia completa on-chain (desde el deploy) sigue fuera de alcance sin
  API key de explorer: los RPC públicos capan `eth_getLogs` en ~1.000 bloques.
