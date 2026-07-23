# Combo vs Streak vs Habit — Diagnóstico y Vocabulario Canónico (2026-07-23)

## TL;DR

- **Son dos métricas reales e independientes.** No es el mismo contador con dos nombres,
  ni copy histórica desconectada.
- El `×N COMBO` visible en el overlay de ejercicio **NO usa la racha diaria** — usa una
  métrica real de **aciertos consecutivos dentro de la sesión** (`chesscito:streak`).
  → Por regla, **COMBO se conserva** para esa métrica; no se renombra a Streak.
- **La única ambigüedad es interna (naming de código):** la métrica de combo está
  implementada bajo identificadores llamados `streak` (`use-streak.ts`, `streakCount`,
  `chesscito:streak`, CSS `--streak`), lo que colisiona conceptualmente con la racha diaria.
  Se cierra con **comentarios/JSDoc** (cero riesgo), sin renombrar storage/CSS/hook
  (eso churnearía la suite y resetearía combos en vuelo, con cero beneficio para el usuario).

## Trazado de la fuente

### `×N COMBO` (overlay de ejercicio)
```
mission-panel-candy.tsx:395  ×{streakCount} COMBO   (+ exercise-drawer.tsx:233, icono exercises.combo)
        ↑ streakCount
exercises-screen.tsx:1373     const streakCount = useStreak()
        ↑
lib/exercises/use-streak.ts   localStorage "chesscito:streak"
   = "consecutive successful exercises without a non-shielded failure"
   - éxito en ejercicio FRESCO → bumpStreak()
   - fallo + Use Shield        → preservado
   - fallo + retry/skip        → resetStreak()
```
→ **Métrica de sesión / aciertos consecutivos.** Es exactamente lo que "Session Combo" debe ser.

### Racha diaria (independiente)
```
focus-passport / daily-tactic-slot / hub-daily-tile
        ↑ next.streak, emitDailyStreakUpdated
localStorage "chesscito:daily-progress"   = días consecutivos con Daily Focus válido
Surfacing: "N-day streak" (HUB_V2_MASTERY_COPY.streakLabel, HUD_COPY.streakFormat),
           "Racha diaria" 🔥 (profile/general-stats)
```
→ **Días consecutivos.** Storage distinto, evento distinto, copy distinta.

## Confirmación

| Pregunta | Respuesta |
|---|---|
| ¿Combo y Streak son la misma variable? | **No** — storage distinto (`chesscito:streak` vs `chesscito:daily-progress`). |
| ¿Es copy histórica desconectada? | **No** — ambas están vivas y wired a datos reales. |
| ¿`×N COMBO` usa la racha diaria? | **No** — usa aciertos consecutivos de sesión → COMBO se conserva. |
| ¿Hay duplicación Combo/Streak del mismo contador? | **No.** |
| ¿"Habit" es un contador? | **No** — solo copy motivacional ("Build the habit"). |

## Tabla canónica de vocabulario por superficie

| Concepto | Definición | Fuente real | Storage | Label visible canónico | Usar en |
|---|---|---|---|---|---|
| **Daily Streak** | Días consecutivos con Daily Focus válido | `daily-progress` / `emitDailyStreakUpdated` | `chesscito:daily-progress` | "N-day streak" / "Racha diaria" 🔥 | Hub mastery, HUD, profile, daily sheet |
| **Session Combo** | Aciertos consecutivos en sesión (shield-protegido) | `use-streak.ts` (`useStreak`) | `chesscito:streak` | "×N COMBO" (+ icono `exercises.combo`) | Overlay de ejercicio, exercise drawer tray |
| **Habit** | Concepto motivacional, **no** contador | — (copy) | — | "Build the habit" / "Crea tu hábito" | Daily strip, onboarding, offer copy |

### Reglas de aplicación (resultado)
- ✅ **No** se crea mecánica Combo nueva (ya existe una real).
- ✅ **No** se duplica el mismo contador como Combo y Streak (ya son independientes).
- ✅ `×N COMBO` **no** usa la racha diaria → se conserva como COMBO.
- ✅ Combo queda **exclusivo** para la métrica de aciertos consecutivos de sesión.
- ✅ "Habit" solo como copy secundaria.

### Deuda interna (documentada, no renombrada)
El identificador `streak` para la métrica de combo (`use-streak.ts`, `streakCount`,
`chesscito:streak`, `--streak`) es un *trap* para devs futuros. Se cierra con JSDoc que lo
contrasta explícitamente con `chesscito:daily-progress`. Un rename completo es un refactor
mediano (storage migration + CSS + churn de tests) con **cero** valor de usuario → **fuera de alcance**.
