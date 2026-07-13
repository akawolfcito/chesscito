# Session Handoff — 2026-07-12

## Completed
- **Hub Tour (Daily-first), Parte 1 del spec** — mini-tour de **2 pasos** en el hub de LEARN:
  **Daily → Challenge**. Flag versionado `chesscito:hub-tour:v1`, gate que cuenta
  `[aria-modal="true"]`, copy que se adapta al estado real del jugador, paso 2 con arte
  (título + hero) que **igual pide la venta**, pulso en el regalo del Daily y en el CTA
  **Join Challenge**.
- **Revisión de producto aplicada (founder + Linita):** el paso de Start Focus se **eliminó**
  (es el control más grande del hub y no cambió), se **retiró el Skip**, títulos en **Rowdies**.
- **Dos defectos encontrados en device real**, los dos arreglados:
  1. El tour **no se podía terminar** en MiniPay — su chrome come alto, la card queda más abajo
     y el "Got it" se salía por abajo. El panel ahora mide el espacio de ambos lados, toma el
     más holgado y se capa a lo que hay; si no alcanza, **se cae el arte, nunca el botón**.
  2. El panel **le cobraba $0.99 a quien ya tenía el pase**: `useState` congelaba los objetos
     de los pasos (copy incluido) al montar. Ahora solo se congelan los IDs alcanzables.
- Handoff: `docs/handoffs/2026-07-12-hub-tour-part1-handoff.md`.
- Spec actualizado en el mismo commit (era un spec aceptado: si no, le decía al próximo que
  construyera el paso que borramos).

## Current State
- **Branch**: `main` local, 5 merges de este cluster. **SIN PUSHEAR — el founder pushea.**
- **Build**: suite **5073 passing / 426 files**, `tsc` limpio.
- **Uncommitted work**: ninguno.
- **Open PRs**: ninguno.

## Next Tasks
1. **Smoke en MiniPay real** (lo trae el founder). Cuatro cosas: ¿entra el "Got it"? ¿el flag
   impide que reaparezca? ¿un dueño del pase ve el paso 2 **sin** precio? ¿late el CTA Join
   Challenge y deja de latir al comprar?
2. **Parte 2 del spec** (no empezada): cierre del Daily (**Continue training** primario,
   **Join Challenge** secundario) + recordatorios del Challenge (CTA + chip, **nunca modal**)
   + test que fije los **tres únicos llamadores** de `recordDailyCompletion`.
3. Replay del tour desde Settings (estado `replay` del spec) — no construido.
4. Sigue pendiente desde 2026-06-07: revisión de telemetría de `enforceOrigin`.

## Blockers
- Nada bloquea código. Abierto: el título del paso 2 es **arte con las palabras en inglés**
  (el `alt` lleva la traducción, pero un usuario ES **ve inglés**). Si molesta, hace falta una
  segunda pieza de arte en ES.

## Notes
- **La lección, por tercera vez:** dos defectos reales con 5000+ tests en verde, ambos por
  confiar en un supuesto de viewport en vez de medir. **jsdom mide todo como 0×0** y un
  navegador limpio **no tiene el chrome de MiniPay**. Los tests nuevos protegen *reglas* (el
  botón entra, el arte cede primero, el dueño del pase no ve precio), no píxeles.
- **Nunca prometer que el pase perdona un día perdido.** El escudo rescata un **ejercicio
  fallido**; la recuperación de racha es *never build*. Hay un test con regex sobre el copy de
  venta que se pone rojo si alguien lo vuelve a prometer — la tentación es real, porque es
  justo lo que más convertiría.
- **Precio/escudos/días se interpolan** desde `rail-config.ts`. Un `$0.99` escrito como texto
  se pudre el día que el precio se mueva **sin poner un solo test en rojo**, y el repo ya tiene
  dos precios vivos ($0.99 pase, $1.99 PRO).
