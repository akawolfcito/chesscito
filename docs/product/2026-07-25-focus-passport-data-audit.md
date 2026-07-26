# Focus Passport — auditoría de datos (2026-07-25)

Acompaña al slice "reordenar el Focus Passport": fila semanal + stats ordenados +
un solo CTA por estado. Documenta **qué dato ya existe** y **qué falta**, sin
crear tablas ni migraciones.

## Fase 1 — dónde vive cada cosa

| Dato | Fuente | Estado |
|---|---|---|
| Panel Mind Challenge / Focus Passport | `components/hub/challenge-card.tsx` | existe |
| Montaje del panel | `components/hub/hub-lite-scaffold.tsx` | existe |
| Contenedor que hidrata | `components/hub/learn-hub-client.tsx` | existe |
| CTA `Join Challenge` | antes `.challenge-card-join`, hoy CTA único `data-cta-state="join"` | migrado |
| CTA `Start Focus` | era `.hub-lite-start-focus` en el scaffold | **oculto** en este slice |
| Season Pass | `useHubData().challengeSeasonPass` (discriminado `pro` / `season_pass`) | existe |
| PRO | misma unión, rama `source: "pro"` | existe |
| Daily de hoy | `focusPassport.todayDone` (`lastCompletedDate === todayUtc()`) | existe |
| Racha diaria | `focusPassport.streak` (`chesscito:daily-progress`) | existe |
| Shields | `lib/shop/use-shields-count.ts` + `MAX_SHIELDS = 3` | existe |
| Fecha UTC del día | `lib/daily/progress.ts` → `todayUtc()` | existe |
| Focus days | derivado: `min(streak, durationDays)` | existe |
| Día del reto (`Day X / 21`) | `seasonPass.dayOfChallenge` | **solo `season_pass`** |

## Gaps encontrados

1. **No existe `completedDates[]`.** `DailyProgress` guarda
   `{ streak, lastCompletedDate, totalCompleted }`. La fila semanal se deriva de
   la corrida contigua de `streak` días que termina en `lastCompletedDate`
   (`lib/daily/week.ts`). Consecuencia aceptada: un día completado **antes** de
   una racha rota se pinta `missed`. Fiel mientras la racha está viva.
2. **`streak` no se normaliza al leer** (solo se resetea en la siguiente
   completación). Por eso la fila usa `lastCompletedDate` como autoridad: sin él,
   una racha rancia pintaría días que el jugador nunca ganó.
3. **No existe estado "Daily empezado pero incompleto".** `CONTINUE FOCUS` queda
   fuera del slice; el CTA cubre 4 estados, no 5.
4. **`shield protected` por día no está modelado.** La fila no lo representa.
5. **PRO no tiene `dayOfChallenge`.** El chip `Day X / 21` se omite en PRO.

## Vocabulario

`Combo` **no** se usa en este panel. Es la métrica de sesión
(`chesscito:streak`, overlay/drawer de ejercicios) según
`docs/product/2026-07-23-combo-streak-vocabulary.md`. El panel muestra la
**racha diaria** con su label canónico (`N-day streak` / `Racha de N días`).

## Contrato del Daily (sin cambios)

Este slice **no toca** el contrato. Sigue igual:

- primera completación válida del día → marca Daily complete, actualiza Focus
  Day, actualiza racha, habilita/reclama reward según la lógica actual;
- ejercicios posteriores → pueden mover métricas internas, **no** suman otro
  Focus Day ni entregan otro reward.

`COME BACK TOMORROW` es un `role="status"`, no un botón: informa y no reentra al
daily. Los shortcuts de piezas, el entrenamiento y la mejora de scores siguen
disponibles en todos los estados.

## Proof of Consistency — disponibilidad (sin implementar la fórmula)

| Señal | ¿Derivable hoy? | De dónde / qué falta |
|---|---|---|
| unique active days | **No** | `totalCompleted` cuenta dailies completados, no días activos. Falta registrar visitas por día. |
| focus days completed | **Sí** | `totalCompleted` (histórico) y `min(streak, 21)` (dentro del reto). |
| current combo | **Sí** | `useStreak()` (`chesscito:streak`), métrica de sesión. |
| longest combo | **No** | Nadie persiste el máximo, ni de combo ni de racha diaria. |
| gaps between completed focus days | **No** | Requiere `completedDates[]`; con `lastCompletedDate` solo se ve el hueco más reciente. |
| daily score average | **No** | No hay score por daily persistido. |
| best daily score | **No** | Idem. |
| difficulty mix | **Parcial** | El catálogo conoce la dificultad por ejercicio; no se guarda qué resolvió el jugador. |
| piece variety | **Parcial** | `completedPerPiece` existe en `useHubData` (por pieza, agregado); no hay corte temporal. |

**Conclusión:** de 9 señales, 2 están completas, 2 parciales y 5 necesitan
persistencia nueva. La barata y de mayor rendimiento es `completedDates[]` en
`chesscito:daily-progress`: desbloquea *unique active days*, *gaps* y una fila
semanal 100% fiel, sin tablas ni migraciones de servidor.
