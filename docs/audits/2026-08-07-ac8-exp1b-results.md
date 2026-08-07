# AC8 — EXP1b: ¿un recurso de imagen inline adelanta el FCP?

**Fecha:** 2026-08-07 · **Spec:** `2026-08-07-wallet-shell-skeleton.md`
**Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción, mismo instrumento.

> 🟡 **Gate: FAIL por 228 ms. Hipótesis: VALIDADA.**
> El FCP bajó **2.246 ms** — de 3.974 a 1.728 ms de mediana. No llegó al umbral de 1.500 ms,
> y **la causa del residuo está medida**: no es el skeleton, es el CSS render-blocking.

---

## Resultado

Probe: **misma geometría exacta que EXP1**, única variable cambiada — el primitivo de pintado
pasó de `linear-gradient` a `background-image: url("data:image/svg+xml,…")`.

| | Baseline (8 corridas) | EXP1 gradiente (3) | **EXP1b `data:` SVG (3)** |
|---|---|---|---|
| **FCP mediana** | 3.974 ms | 3.928 ms | **1.728 ms** |
| FCP por corrida | 3912…4068 | 4092 · 3908 · 3928 | **1748 · 1728 · 1696** |
| **Δ vs baseline** | — | −46 ms (ruido) | **−2.246 ms** |
| LCP mediana | 4.422 ms | 4.376 ms | **4.420 ms** |
| T2 mediana | 4.151 ms | 4.159 ms | **4.069 ms** |
| Bytes T2 | 409,3 kB | 409,3 kB | **409,3 kB** |
| Bytes T3 | 420,1 kB | 420,2 kB | **420,2 kB** |
| Requests | 39 / 42 | 39 / 42 | **39 / 42** |
| CLS del probe | — | ninguno | **ninguno** |

### Gate, condición por condición

| Condición | Umbral | Resultado | |
|---|---|---|---|
| FCP mediana | < 1.500 ms | **1.728 ms** | 🔴 **FAIL por 228 ms** |
| Requests nuevos | 0 | **0** (39/42, idénticos) | 🟢 |
| T2 no empeora | tolerancia 150 ms | **−82 ms** (mejora) | 🟢 |
| LCP no empeora | tolerancia 150 ms | **−2 ms** | 🟢 |
| CLS atribuible al probe | ninguno | **ninguno** — el único shift sigue siendo `hub-scaffold-body` / `kingdom-anchor-tagline` a ~4.137 ms | 🟢 |

**Cinco condiciones, cuatro verdes. La que falla, falla por 228 ms.**

⚠️ **`TBT~` pasó de 0 a 40–105 ms y NO es una regresión.** Las long tasks son las mismas (4, con
los mismos máximos): lo que cambió es que ahora el FCP ocurre a 1,7 s, así que tareas que antes
quedaban **fuera** de la ventana de medición (que arranca en FCP) ahora quedan adentro. El
trabajo de CPU es idéntico; lo que se movió es el observador, no lo observado.

---

## Qué pone el piso de 1,7 s — medido, no supuesto

`performance.getEntriesByType("resource")` bajo el mismo perfil:

| Recurso | Empieza | Termina | Peso |
|---|---|---|---|
| `5dfc27a55db4b374.css` | 232 ms | 836 ms | 1 kB |
| **`3f14dc4feb3180d4.css`** | 232 ms | **1.679 ms** | **55 kB** |
| HTML (`responseEnd`) | — | 335 ms | — |
| **first-paint = FCP** | — | **1.740 ms** | — |

⛔ **El FCP ocurre 61 ms después de que termina de bajar el CSS.** El skeleton **no puede**
pintar antes que la hoja de estilos que lo estiliza: el piso no lo pone el skeleton, lo pone el
CSS render-blocking de 55 kB.

📌 Consecuencia directa: **AC10 (< 1.500 ms) es inalcanzable hoy, y deja de serlo si el frente
#4 (CSS render-blocking) avanza.** Los dos frentes están acoplados, y este número le pone precio
al #4 por primera vez: hoy vale ~1,7 s de FCP para todo jugador de MiniPay.

---

## Hallazgo transferible

**Chromium cuenta como *contentful* los RECURSOS de imagen, no la pintura.** Mismo bloque,
misma geometría, mismos píxeles en pantalla:

| Primitivo | Píxeles visibles | FCP reportado |
|---|---|---|
| `linear-gradient` | 194 ms | **3.928 ms** (no cuenta) |
| `url("data:image/svg+xml,…")` | ~1.740 ms | **1.728 ms** (cuenta) |

⚠️ Y hay un detalle incómodo que conviene decir: con el gradiente el jugador veía algo a los
**194 ms**; con el `data:` SVG lo ve a los **1.740 ms**, porque el `data:` URI también depende
del CSS que lo declara… igual que el gradiente. La diferencia de 1,5 s entre "píxeles visibles"
de una técnica y otra es un artefacto de que EXP1 se midió sin que el CSS bloqueara — **no**
una regresión visual del `data:` URI. Ambos aparecen cuando el CSS llega; sólo uno de los dos
mueve la métrica.

---

## Decisión que queda abierta (no la tomo yo)

La instrucción para FAIL era: no probar una tercera técnica, declarar AC10 refutado y
reconvertir el frente a *perceived loading*. **No la aplico automáticamente porque este FAIL no
es el que esa instrucción anticipaba**: la técnica funciona, y lo que falta son 228 ms que
pertenecen a otro frente ya identificado.

| Camino | Qué implica |
|---|---|
| **A — Bajar el umbral de AC10 a lo alcanzable hoy** (p. ej. < 2.000 ms) | El frente se implementa ya, con FCP −2,2 s como resultado real y declarado. |
| **B — Mantener AC10 en 1.500 ms y secuenciar** | Primero el frente de CSS render-blocking, después el skeleton. El umbral se vuelve alcanzable. |
| **C — Reconvertir a *perceived loading*** | La instrucción original para FAIL. ⚠️ Regalaría una mejora de FCP de 2,2 s ya medida. |

**Recomendación: A.** El frente entrega −2,2 s de FCP con 0 requests y sin tocar T2 ni LCP;
mantenerlo bloqueado por 228 ms que dependen de otro frente sería dejar la mejora sin cobrar.
B es igual de defendible si preferís no tocar el skeleton hasta tener el CSS resuelto. ⛔ C ya
no describe la realidad medida.

---

## Estado

- Probe **revertido**; árbol limpio.
- `C3` del spec queda con su primitivo **validado**: `data:image/svg+xml`, nunca gradiente.
- **No se entra a `/tdd`** hasta que elijas A, B o C.
