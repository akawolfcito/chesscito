# Iniciativa propuesta — *Stats dashboard information architecture*

**Fecha:** 2026-08-05 · **Estado:** **propuesta, no agendada, no empezada**
**Base:** `/stats` consolidada y validada (`b8e58996`) —
`docs/audits/2026-08-05-stats-consolidation-validation.md`

> **Reorganiza lo que YA existe.** Ninguna cifra cambia, ninguna se pierde.

---

## Por qué

La consolidación funcionó: una URL, ocho RPC, cifras correctas en las cinco
combinaciones de filtro, caché sana. Lo que no resolvió es **cómo se lee**.

Hoy la página son **12 secciones en 6.794 px de alto a 390 px** — el viewport de
MiniPay. La tabla de 30 filas del trend es casi la mitad. Un reviewer que abre el
link del listing ve el resumen y después scrollea nueve pantallas de detalle sin
una jerarquía que le diga qué mirar primero.

**El problema no es qué se mide, es en qué orden se cuenta.**

---

## Alcance

### ⛔ Fuera de alcance, terminantemente

- **Las ocho RPC** — no se tocan.
- **La caché** — clave, TTL 900, tag `public-stats`, `no-store` del fetch: intactos.
- **Las fuentes de datos** — ni el agregador ni el bloque on-chain ni el censo.
- **La identidad visual** de Chesscito.

Si una idea de esta lista necesita un dato nuevo, **la idea sale**, no entra la RPC.

### ✅ Dentro de alcance

Sólo `apps/landing/src/components/stats/**` y la copy.

---

## Objetivos

1. **Resumen ejecutivo arriba**, con contexto **«Since MiniPay launch»** — hoy
   cada ventana se declara por separado y ninguna dice desde cuándo existe el
   producto.
2. **Distinguir reach, activation y habit** como tres ideas separadas. Hoy
   conviven como secciones vecinas sin decir que responden preguntas distintas:
   cuánta gente llega, cuánta empieza, cuánta vuelve.
3. **Cinco métricas primero.** El resto, debajo.
4. **Un recorrido explícito:** `Opened → Started → Completed → Daily Focus →
   3+ days`. Los datos ya existen — los cuatro primeros son
   `stats_activation_funnel`, el quinto es el bucket de 3 días de
   `stats_habit_depth`. Hoy están en dos secciones que no se miran entre sí.
5. **Últimos 7 días visibles; 30 días expandibles.**
6. **Top 10 players visibles; ranking completo expandible.**
7. **Reducir la altura móvil.**
8. **Preservar todas las cifras y la metodología.** Nada desaparece: lo que no
   está arriba está a un `<details>` de distancia.

---

## Restricciones heredadas — no negociables

Cada una costó una ronda de esta línea de trabajo:

| Restricción | Por qué |
|---|---|
| **El access journey NO es un embudo** | `wallet_ready` puede superar a `login_succeeded` y es correcto. Checkpoints, sin línea de continuidad ni descenso forzado |
| **Cohorte 0 → «Not enough history yet»**, jamás `0 %` | nadie tuvo oportunidad de volver; un 0 % reporta un fracaso que no ocurrió |
| **`null` → em-dash, NUNCA `0`** | un cero afirma «nadie hizo esto»; un guion dice «no pudimos medirlo» |
| **La nota de `surface` NULL va junto al desglose** | `Learn + Play < Total` es real (15,5 % de filas sin superficie) y un número que el lector no puede reconciliar se lee como mentira |
| **Sin claves técnicas de eventos en pantalla** | `gate_viewed` es esquema, no producto |
| **Sin tabs y sin rutas nuevas** | `/stats` es UNA URL canónica; el listing sólo puede declarar una. Expandir se hace con `<details>`, no con navegación |
| **Sin `"use client"` si se puede evitar** | hoy la página no tiene ni uno, y por eso ningún env puede viajar al bundle |
| **`generatedAt` visible; el censo con su `asOf` propio** | dos relojes distintos, dos sellos distintos |
| **Sin mints en el trend** | la RPC no los devuelve y recuperarlos reintroduciría una lectura truncable |

---

## Riesgos

| # | Riesgo | Nota |
|---|---|---|
| 1 | **Un `<details>` colapsado puede leerse como dato ausente** | si el ranking completo o los 30 días quedan escondidos sin señal clara, el lector concluye que no existen. El resumen del `<summary>` tiene que decir qué hay dentro |
| 2 | **«Since MiniPay launch» necesita una fecha, y hoy no está en ningún dato** | habría que fijarla como constante editorial. ⚠️ Si se intenta derivar de la telemetría, se cae en el alcance prohibido |
| 3 | **El cold start seguirá dando 1,6–7,3 s de TTFB** | esta iniciativa **no lo arregla**: no es caché de datos. Reducir el HTML ayuda al render, no al TTFB |
| 4 | **Tocar la copy roza el guard de traducción** | EN y ES tienen que moverse juntos, y el test de paridad de claves lo exige |

---

## NEXT ACTION

> **Ninguna.** Es una propuesta. Requiere spec antes de implementar y, siendo un
> feature con flujo interactivo (expandir/colapsar), ese spec **debe enumerar
> todos los estados de UI y sus transiciones** antes de escribir código.
