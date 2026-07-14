# Next session prompt — Frente 1: pulir ejercicios y primera sesión

Decí **"continuemos"** y el agente lee este archivo y lo sigue.

---

**Estado al arrancar:** `main` limpio y sincronizado con `origin/main`. Sin PRs abiertos. La sesión
anterior **no escribió código de producto: corrigió el rumbo.**

## 📍 Leer PRIMERO, antes de tocar nada

1. **`docs/product/2026-07-13-direction-where-we-are.md`** — **la directriz vigente.** Modelo de
   **frentes → capas → gates**. La tabla de §2 es el índice: **toda idea nueva se ubica ahí antes de
   diseñarla.**
2. `SESSION.md` — el handoff de la sesión (e).

**El principio que gobierna todo:**

> Construir la capa mínima que demuestre valor, medirla, y dejar que el resultado desbloquee la
> siguiente.

---

## ▶️ La tarea: Frente 1 — pulir el aprendizaje actual

**Es el frente principal.** Directriz §6.

**NO es construir contenido nuevo. Es pulir lo que el usuario ya ve.**

1. **Definir qué aborda el usuario primero en cada sesión** y simplificar el primer recorrido.
2. **Revisar ejercicios**: instrucciones y dificultad.
3. **Ocultar el contenido que no esté a la altura** — incluye **mejorar o esconder temporalmente el
   laberinto de peones** si daña la percepción.
4. Aprovechar que muchos usuarios **tardan** en desbloquear contenido avanzado: es tiempo regalado
   para pulirlo antes de que lleguen.

**Empezá preguntándole al founder qué le molesta HOY del primer recorrido.** No auditar a ciegas: él
tiene el juicio de producto, y este frente es de percepción, no de corrección técnica.

**Gate:** comprensión y finalización aceptables.
⚠️ **Los umbrales concretos se definen ANTES del experimento, no ahora** (directriz §14). Un número
inventado sin instrumentación es falsa precisión, y es peor que la ambigüedad porque parece medido.

---

## Reglas del roadmap que NO se re-litigan

- **El duelo NO está congelado** — se construye por capas. **D1 = abrir un enlace y jugar, SIN
  wallet**, en cualquier navegador móvil o PWA. **No depende de MiniPay.**
- **El spec v3 del duelo NO es el plan de D1** (es wallet-first, marcado ARTEFACTO HISTÓRICO).
- **MiniPay está EN REVISIÓN, sin pedidos oficiales abiertos.** Es un **canal**, no un bloqueo.
- **Las cifras de Peones son HIPÓTESIS.** Inventariar fuentes y sinks **antes** de tocar precios.
- **Cuando una iniciativa parezca menor, preguntar por su TECHO antes de descartarla.** Ya pasó dos
  veces en una sesión (themes → marketplace; duelo → economía de espectadores).

## Paralelo barato (NO desplaza al Frente 1)

- **Peones**: inventariar fuentes y sinks. No existe y es la primera tarea del frente.
- **Themes / catálogo de arte**: página `/dev` que lista cada slot con sus dimensiones. Destraba el
  cuello de botella real, que es **el arte**, no el código.

## Flujo de trabajo

**Merge local a `main` + UN push.** NO pushear ramas, NO abrir PRs con auto-merge.

```
git -C <ruta> checkout -b <rama>      # trabajar, commits atómicos
git -C <ruta> checkout main
git -C <ruta> merge --no-ff <rama>
git -C <ruta> push origin main        # UNA vez
git -C <ruta> branch -d <rama>
```

El gate de calidad es **suite verde + `tsc` limpio ANTES del merge local**, no CI después.

## Higiene de comandos

- **Nunca prefijes con `cd`.** Usá `git -C <ruta>` y `pnpm -C <ruta>`.
- Un comando por llamada. Sin pipes, sin heredocs.
- Typecheck: `pnpm exec tsc --noEmit` pelado.
- `lsof -ti:3000` vacío antes de VR/E2E.

## Si el usuario dice…

- **"continuemos"** → preguntar qué le molesta hoy del primer recorrido, y arrancar el Frente 1.
- **"qué falta"** → la directriz, §12 (activo / en preparación / diferido).
- **"y el duelo?"** → no está congelado; la próxima capa es D1 y **no depende de MiniPay**.
