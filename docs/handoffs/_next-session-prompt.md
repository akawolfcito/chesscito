# Next session prompt — post Hub Tour parte 1, esperando smoke en device

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** el mini-tour del hub de LEARN (2 pasos: Daily → Challenge) está
**construido y mergeado a `main`**. Suite **5073 passing / 426 test files**, `tsc` limpio.
**El founder pushea y trae el resultado del smoke en MiniPay real.**

**Leer primero:**
- `docs/handoffs/2026-07-12-hub-tour-part1-handoff.md` — qué se construyó, qué decisiones NO
  se re-litigan, y los dos defectos que encontró el device.
- `docs/specs/2026-07-12-hub-tour-daily-first-spec.md` — **la Parte 2 está especificada y NO
  construida. No re-especificar.**

---

## ▶️ Ruta

1. **Primero: el resultado del smoke.** Preguntá por él antes de escribir código. Cuatro cosas
   a confirmar en device:
   - El "Got it" entra en pantalla y el tour se completa.
   - El flag `chesscito:hub-tour:v1` impide que reaparezca.
   - Con pase ACTIVO: el paso 2 muestra el arte **sin** precio ni "Tap Join Challenge".
   - El CTA **Join Challenge** late, y deja de latir al comprar.
   Si algo falló, eso manda sobre todo lo demás.

2. **Después: Parte 2 del spec** — cierre del Daily (**Continue training** primario,
   **Join Challenge** secundario) + recordatorios del Challenge (CTA contextual + chip,
   **nunca modal**, máximo uno por día) + el test que fija que `recordDailyCompletion` sigue
   teniendo **solo tres llamadores**.

---

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

- **Nunca prefijes con `cd`.** `git -C <ruta>` y `pnpm -C <ruta>`.
- Un comando por llamada. Sin pipes, sin heredocs.
- Typecheck: `pnpm exec tsc --noEmit` pelado.
- `lsof -ti:3000` vacío antes de VR/E2E.
- Para manejar el hub en navegador: server con
  `NEXT_PUBLIC_CHESSCITO_MODE=learn NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`, y el script de
  Playwright **dentro de `apps/web/`** (ahí resuelve el módulo), borrándolo al terminar.

## Decisiones cerradas (NO re-litigar)

- **Solo LEARN y PLAY se envían. FULL es interno.**
- **El Daily ABRE la sesión.** El Lote 2.5 está SUPERSEDED.
- **El tour no es onboarding**: todo jugador lo ve una vez. Sin Skip.
- **El paso 2 PIDE la venta** — es la razón por la que MiniPay nos listaría.
- **Nunca prometer recuperación de racha.** El escudo rescata un **ejercicio fallido**. Hay un
  test con regex sobre el copy que lo fija.
- **Precio/escudos/días se interpolan** desde `rail-config.ts`, jamás se escriben como texto.
- **Nunca construir recovery para el Daily-Streak.**

## La lección de esta sesión

**Dos defectos reales con 5000+ tests en verde**, los dos por confiar en un supuesto de
viewport en vez de medir: jsdom mide todo como 0×0 y un navegador limpio no tiene el chrome de
MiniPay. Los tests ahora protegen **reglas** (el botón entra, el arte cede primero, el dueño
del pase no ve precio), no píxeles.

## Si el usuario dice…

- **"continuemos"** → pedir el resultado del smoke, después arrancar la Parte 2.
- **"qué falta"** → `docs/backlog/2026-07-10-backlog-index.md`.
