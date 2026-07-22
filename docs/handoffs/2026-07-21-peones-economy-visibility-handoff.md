# Handoff — Visibilidad de la economía de Peones

**Fecha:** 2026-07-21 · **Rama:** `feat/peones-economy-visibility` (sin mergear)

La tabla de abajo lista los **8 commits de implementación**. La rama tiene **9**: el noveno
(`2c97e02`) es el commit de docs que trae este handoff y la auditoría, y no puede listarse a
sí mismo. Un décimo (`copy`) ajusta el estado sin pista a "Hint unavailable".
**Auditoría previa:** `docs/audits/2026-07-21-peones-ux-visibility-audit.md`

---

## Qué se cerró

El loop `ganar → ver → gastar → entender` en `/exercises`. Sin XP, sin niveles, sin moneda
nueva, sin migración, sin tocar precios.

| # | Commit | Qué resuelve |
|---|---|---|
| 1 | `ff3f7ff` | Bus `chesscito:peones-changed` (payload-free + razón opcional) |
| 2 | `9cd7c15` | `usePeonesBalance` refetchea con el bus → las 4 instancias convergen |
| 3 | `1510e1d` | Dispatch tras earn/spend confirmado (spend en el choke point único) |
| 4 | `97876db` | **Fix:** no cobrar una pista que no puede revelar nada |
| 5 | `76df5a7` | Precio del Hint visible antes de pagar |
| 6 | `3651c8e` | Saldo en la fila Z2 de `/exercises`, encima del tablero |
| 7 | `135d244` | Delta flotante `+1 Peón` / `−2 Peones · Hint` |
| 8 | `58351af` | Celebración del pack: saldo nuevo + para qué sirven |

**Verificación:** 5583 tests passing / 493 archivos, **exit 0**, cero *unhandled errors*
(chequeado explícitamente — una suite verde puede salir non-zero).
`tsc --noEmit` limpio. ESLint sin warnings.

---

## Las tres decisiones que sostienen esto

**1. El delta se DERIVA del saldo que se movió, no de lo que el llamador dice que gastó.**
Es lo que hace que las dos reglas negativas se cumplan por construcción y no por disciplina:
un duplicado idempotente no vuelve a debitar → no hay delta que mostrar; un spend fallido
nunca despacha → no hay refetch ni cambio. Un `−2` solo puede renderizarse porque dos Peones
realmente salieron. El bus solo lleva la *razón* (etiqueta), que no puede contradecir al ledger.

**2. El bus, no React Query.** `usePeonesBalance` ya era un `useState`+`useEffect` instanciado
4 veces. Suscribirlo al bus las converge sin provider, sin caché compartida y sin migrar a
React Query. El repo ya tenía este primitivo 5 veces (`shield-events` y hermanos); faltaba el
de Peones. Sigue sin haber polling: el disparo es por evento.

**3. El saldo entra a la fila EXISTENTE del tray (Z2), no a una fila nueva.** Coste vertical
para el tablero: cero. La compresión cae en el piece-picker, cuyo label es lo reducible.
No revierte la spec §6 (2026-07-06): el header (Z1) sigue siendo Account-only; lo que se gana
y se gasta jugando es contexto de juego, la misma zona que estrellas y escudos.

---

## Lo que hay que mirar antes de mergear

**⚠️ Baselines de VR.** `/exercises` cambió visualmente: el tray tiene un cuarto chip y el pin
de Hint ahora muestra su precio. **No regeneré baselines a propósito** — un VR verde puede ser
la foto de un error, y aprobar un cambio visual es decisión tuya, no mía. Hay que correr la
suite de Playwright y revisar los diffs a ojo antes de aceptarlos.

**Verificación visual (tus criterios de aceptación).** Son de mirada, no de polling:
1. Entrar a `/exercises` → el saldo aparece sobre el tablero.
2. A 390px, estrellas + escudos + combo + Peones legibles a la vez.
   ⚠️ Ojo: escudos solo se pintan con `shieldCount > 0` y combo con `streakCount >= 2`.
   Para ver los cuatro hace falta racha ≥2 y ≥1 escudo — si no, ese caso no es observable.
3. Gastar una pista → el contador baja **sin volver al Hub**, con el delta rojo.
4. Recargar → el saldo sale del endpoint (el hook no escribe localStorage).

---

## Lo que quedó explícitamente afuera

- **Hint en el carril 2** (safe-path, promotion-run, queens, labyrinth) y en Lite. Es una
  vertical propia: cada juego tiene su noción de "mejor jugada" y `computeExerciseBfs` no
  aplica. Hoy esos tableros no montan el Hint en absoluto.
- Sistema genérico de overlays, modal por cada earn/spend, historial de transacciones,
  XP/niveles, fuentes o sinks nuevos.
- `HudSecondaryRow` y `/hub` no se tocaron: el hub ya mostraba el saldo.
- `/coach` no se tocó: ya tenía su `coach-cost-ribbon`.

---

## Preguntas abiertas

1. **¿El Hint debería desbloquearse tras el primer intento fallido?** Hoy está disponible desde
   el inicio de `phase === "ready"`. La arquitectura lo soporta (hay `attemptSeq`), pero no había
   señal de producto para cambiarlo, así que no lo toqué.
2. **¿"No hint" es la copy correcta** para el estado sin pista computable? Es un borde real
   (BFS irresoluble), no el camino común, pero es la primera vez que el pin aparece muerto.
3. **¿El delta debería mostrarse también en `/hub`?** El chip es el mismo componente, así que
   ya funciona ahí — pero no lo verifiqué visualmente en esa superficie.
