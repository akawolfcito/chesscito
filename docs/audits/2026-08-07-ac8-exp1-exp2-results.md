# AC8 — resultados de EXP1 y EXP2 (gates bloqueantes)

**Fecha:** 2026-08-07 · **Spec:** `2026-08-07-wallet-shell-skeleton.md`
**Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción, mismo instrumento.

> 🔴 **EXP1: FAIL.** 🟢 **EXP2: PASS.**
> El frente **se detiene tal como está escrito**. La causa está medida, no razonada, y **no
> es la que el spec suponía**.

---

## EXP1 — ¿`linear-gradient` adelanta el FCP? **NO.**

Probe: un solo bloque `position: fixed` con `background-image: linear-gradient(...)` dentro del
`WalletShell`. Build de producción, 3 corridas.

| | Baseline (8 corridas) | Probe (3 corridas) | Δ |
|---|---|---|---|
| **FCP (mediana)** | **3.974 ms** | **3.928 ms** | **−46 ms** |
| FCP por corrida | 3912 · 3928 · 3944 · 3972 · 3976 · 4024 · 4056 · 4068 | **4092 · 3908 · 3928** | — |
| T1 | ~4.150 ms | 4.274 · 4.088 · 4.112 | +~10 ms |
| T2 | ~4.151 ms | 4.313 · 4.135 · 4.159 | +~8 ms |
| LCP | ~4.422 ms | 4.360 · 4.432 · 4.376 | −~46 ms |
| Encoded bytes (T2) | 409,3 kB | 409,3 kB | **0** |
| Encoded bytes (T3) | 420,1 kB | 420,2 kB | **+0,1 kB** |
| Requests | 39 / 42 | 39 / 42 | **0 nuevos** |

**Umbral del spec: mediana de FCP < 1.500 ms. Resultado: 3.928 ms. FAIL por 2,4 segundos.**
El Δ de −46 ms está dentro del ruido del propio baseline (que abarca 156 ms).

### El filmstrip dice lo contrario que la métrica — y ahí está el hallazgo

| Frame | Qué se ve |
|---|---|
| **194 ms** | **El bloque ya está pintado.** |
| 2.027 ms | El bloque sigue en pantalla |
| 4.720 ms | Hub completo |

⛔ **Los píxeles están en pantalla 3,8 segundos antes de que la métrica diga "first contentful
paint".** Es decir: **Chromium no cuenta un gradiente CSS como contentful.** La hipótesis C3 del
spec —"`background-image: linear-gradient` cuenta como imagen para FCP"— es **falsa en este
browser**, aunque la especificación de Paint Timing hable de background images.

📌 Esto es exactamente para lo que existía EXP1. Sin él se habría mergeado una silueta completa
que cumple el criterio de producto y **deja la métrica clavada donde estaba**, y el frente se
habría declarado ganado con un número que no se movió.

### Lo que EXP1 sí demostró, y no es poco

- **La pantalla deja de estar vacía a los ~194 ms** en vez de ~4.000 ms. El criterio de
  producto (#2 de tu lista de PASS) **se cumple con creces**.
- **Cero requests nuevos** y +0,1 kB. El costo es nulo.
- **T2 y LCP no empeoran** (dentro del ruido).
- El bloque `position: fixed` no introdujo ningún shift propio: el único CLS registrado sigue
  siendo el 0,179 conocido de `hub-scaffold-body` / `kingdom-anchor-tagline`.

⚠️ Observación menor: entre el frame de 194 ms y el de 2.027 ms el bloque cambia de tamaño y
posición — es el `viewport meta` aplicándose. No generó CLS medible, pero si se construye la
silueta habrá que mirarlo.

### Consecuencia para el spec

El spec **no se puede implementar como está escrito**: su AC10 (FCP < 1,5 s) es inalcanzable
con gradientes. Quedan dos caminos, y **ninguno se toma sin tu decisión**:

| Camino | Qué implica |
|---|---|
| **A — Aceptar el frente como mejora de percepción** | La silueta se construye igual: pantalla no vacía desde ~194 ms, 0 requests. **Se baja AC10**: el FCP no mejora y se dice así en el informe. |
| **B — EXP1b: probar un recurso de imagen sin request** | Un `<svg>` inline o un `background-image: url("data:image/svg+xml,…")` **sí** es un recurso de imagen para Chromium. Si eso mueve el FCP, el spec sobrevive entero. Cuesta un build. |

⛔ No cambio el criterio por mi cuenta ni declaro victoria con el argumento de que "se ve
mejor". El umbral era tuyo; el resultado es FAIL contra ese umbral.

---

## EXP2 — ¿El shell llega por SSR? **SÍ.**

`curl` al HTML servido por `next start` sobre el build de producción:

| Ruta | HTTP | `data-wallet-shell` en el HTML inicial | Probe en el HTML inicial |
|---|---|---|---|
| `/` | 200 | ✅ presente | ✅ presente |
| `/es` | 200 | ✅ presente | ✅ presente |
| `/terms` | 200 | ✅ presente | ✅ presente |
| `/en` | **307 → `/`** | n/a (redirect, sin cuerpo) | n/a |

**PASS en lo que EXP2 tenía que decidir:** el shell **no** depende de la hidratación. Está en el
HTML inicial y se pinta a los 194 ms, confirmado por el filmstrip. El Plan B del red team
(P0-2) **no hace falta por esta razón**.

⚠️ **`/en` devuelve 307 a `/` y eso es correcto**, no un defecto: el routing de locale es
`as-needed`, así que el inglés vive en la raíz. Cualquier chequeo futuro de `/en` debe seguir el
redirect o el resultado se lee como "falta el shell".

### Lo que EXP2 NO validó, y hay que decirlo

`/terms` **también** trae el probe, porque el shell de hoy no distingue rutas. Es exactamente el
problema que C1 del spec describe: la silueta del hub aparecería en rutas que nunca van a
mostrar un hub.

⛔ **La parte de C1 que sigue sin verificar es `usePathname()` durante el prerender estático.**
No se implementó, así que no se midió. Si se sigue por el camino A o B, ese chequeo vuelve a
ser bloqueante antes de escribir la silueta.

---

## Estado

- Probe **revertido**; el árbol queda limpio.
- El spec queda en READY **con su AC10 refutado**: no se entra a `/tdd` hasta decidir A o B.
