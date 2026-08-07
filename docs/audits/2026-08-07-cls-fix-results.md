# CLS 0,179 — resultados del fix

**Fecha:** 2026-08-07 · **Commit:** `d14b736` · **Spec:** `2026-08-07-hub-anchor-cls-fix.md`
**Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción.

> 🟢 **PASS en los 16 criterios.** El shift de 0,179 desaparece, y —lo que manda— **la causa
> determinista se cierra sola**: `.hub-scaffold-anchor` nunca se observa en 0 × 0.

**El diff de implementación es una línea:** `align-self: stretch`.

---

## 1. Causa determinista — evidencia PRIMARIA (AC1 / AC2 / AC3)

5 corridas:

| Corrida | Muestras en 0 × 0 | Caja | `naturalWidth ≠ 0` | ¿Caja antes? | `center` | Final |
|---|---|---|---|---|---|---|
| run-1 | **0** | 3.818 ms | 3.986 ms | ✅ +168 ms | 234 | 234 × 363,8 |
| run-2 | **0** | 3.694 ms | 3.998 ms | ✅ +304 ms | 234 | 234 × 363,8 |
| run-3 | **0** | 3.745 ms | 4.001 ms | ✅ +256 ms | 234 | 234 × 363,8 |
| run-4 | **0** | 3.762 ms | 3.984 ms | ✅ +222 ms | 234 | 234 × 363,8 |
| run-5 | **0** | 3.699 ms | 3.925 ms | ✅ +226 ms | 234 | 234 × 363,8 |

Antes del fix, esa ventana colapsada duraba **210–264 ms** en las 4 corridas del discovery.
Ahora **no existe**.

## 2. Outcome — evidencia SECUNDARIA (AC5 / AC6)

| Corrida | CLS | Shifts |
|---|---|---|
| run-1 … run-5 | **0,0000** | **0** |

⛔ **Cero shifts, no "el conocido desapareció"**: no aparece ninguno con `sources` distintos,
que era el caso que AC6 se reformuló para detectar (el shift mudándose de nodo).

📌 **Por qué el orden importa.** El baseline daba 0,0000 en 2 de 5 corridas **con el defecto
presente** — el CLS sólo se registra si el estado previo llegó a pintarse. Si acá sólo tuviera
el CLS, no podría distinguir "arreglado" de "esta vez no se pintó". **La causa da verde por sí
sola**, así que el 0,0000 es consecuencia y no coincidencia.

## 3. Resto de los criterios

| AC | Criterio | Baseline | Con el fix | |
|---|---|---|---|---|
| AC4 | Sin medidas nuevas | — | el diff **no contiene un número** | ✅ |
| AC7 | T2 (mediana de 3) | 4.114 ms | **4.089 ms** | ✅ |
| AC8 | LCP (mediana de 3) | 4.360 ms | **4.432 ms** | ✅ dentro de ±150 |
| AC9 | Requests / bytes | 39 / 42 · 409,5 kB | **idénticos** | ✅ |
| AC10 | Estado final | 234 × 363,8 | **234 × 363,8** (5/5) | ✅ |
| AC11 | Suite | 7.468 / 606 | **7.471 / 607** | ✅ |
| AC12 | `tsc --noEmit` | — | limpio | ✅ |
| AC13 | **VR** | 62/62 | **62/62 sin re-baselinear** (2,3 min) | ✅ |
| AC14 | `bundle:guard` | — | 75 chunks, 0 Privy | ✅ |
| AC15 | Guard de fuente | — | `hub-anchor-cls-guard.test.ts` (3 tests) | ✅ |
| AC16 | Re-validación | — | ver §5 | ✅ |

⚠️ **AC8, dicho como es:** el LCP subió 72 ms contra la mediana anterior. Está dentro de la
tolerancia **y** dentro del rango que ya oscilaba en el baseline (4.324–4.568 ms), así que lo
leo como ruido y no como efecto. Lo registro en vez de omitirlo.

**AC13 es el que arbitraba el riesgo principal:** `align-self: stretch` cambia la regla
transversal del item, y los 62 baselines dicen que el resultado visual no cambió.

## 4. ⚠️ El P1 que hay que revalidar si algo se mueve

**Hoy `stretch` y el comportamiento anterior convergen por una relación numérica, no por
diseño:** la columna disponible (234 px) es **menor** que el ancho intrínseco del portal
(256 px), así que el shrink-to-fit siempre topaba con el mismo límite.

**Debe revalidarse si cambia cualquiera de estos tres:**

1. `--app-max-width` (hoy 390 px),
2. la geometría de tracks de `.hub-scaffold-body` (hoy `78px 1fr 78px`),
3. el asset del portal, si se re-exporta **más chico que la columna**.

⛔ **`234 × 363,8` NO es una constante universal**: es el estado final del viewport medido
(390 × 844), no un contrato global. No convertirlo en una expectativa fija fuera de ahí.

## 5. AC16 — cómo re-validar esto en el futuro

La causa (AC1/AC2) **no la puede ver ningún test**: jsdom no calcula layout. Se re-valida con
la sonda de la ventana colapsada, que muestrea `.hub-scaffold-anchor` cada 50 ms contra
`img.naturalWidth` bajo Slow 4G + CPU 4× y verifica que la caja llegue **antes** que la imagen.

```bash
pnpm -C apps/web build
NEXT_PUBLIC_CHAIN_ID=42220 pnpm -C apps/web exec next start -p 3002
# en otra terminal, con la sonda de verify-cls (5 corridas):
#   muestras0x0 debe ser 0 y cajaAntesDeImg debe ser true en TODAS
```

⚠️ Y el criterio de aceptación al re-validar es la **causa**, no el CLS: un 0,0000 aislado no
prueba nada.
