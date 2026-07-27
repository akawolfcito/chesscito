# Handoff — el nudge de la llama, construido

**Fecha**: 2026-07-27 · **Rama**: `feat/daily-streak-nudge` → mergeada a `main` **local**
**Pendiente**: el founder pushea `main` a origin. Nada de esto está en origin todavía.

## Lo que cerró

Spec `docs/specs/2026-07-27-daily-streak-two-paths.md` (v3, READY) implementado completo,
**los 16 acceptance criteria con aserción**.

| commit | qué |
|---|---|
| `2584fb9a` | máquina de estados pura + storage (39 tests) |
| `5fd3ca1c` | pantalla + copy en `editorial.ts` (6 tests) |
| `20e47afb` | `useStreakNudge`, el que difiere la salida (10 tests) |
| `8c7d4233` | cableado en `exercises-screen` + integración (2 tests) |
| `324860f1` | el caso "bloqueado en el 3, paga después del 5" |
| `a6b62fa1` | inventario de themes regenerado |

**Suite**: 5970 passing / 526 files, **exit 0**, 0 `Unhandled Errors`, `tsc` limpio.
Verificado leyendo el exit code y grepeando la cola, no solo los conteos.

## Archivos nuevos

- `lib/daily/streak-nudge.ts` — el latch, puro + storage. Único dueño del estado.
- `lib/daily/use-streak-nudge.ts` — los dos momentos dentro del flujo de ejercicios.
- `components/daily/streak-nudge-screen.tsx` — la pantalla.
- `lib/content/editorial.ts` → `STREAK_NUDGE_COPY` (ambos locales derivan de acá).
- `lib/feature-flags.ts` → `isStreakNudgeEnabled()`.

`DailyProgress` y sus **nueve lectores están intactos**. Nada de esto los toca.

## Tres decisiones que no estaban en el spec

1. **El reloj y el estado del Daily entran como getters, no como valores.** Leerlos en render
   decidiría con estado posiblemente no hidratado y después lo persistiría. Ambos handlers
   corren desde eventos, así que el getter no cuesta nada.
2. **El CTA no puede detener la propagación por sí mismo**: `PrincipalButton` recibe
   `() => void` y nunca ve el evento. Lo hace su **región**, que es lo que decía el spec.
3. **El exit del drawer es `onOpenChange`, no un botón.** Su `SheetTrigger` es interno, así
   que no hay botón que envolver. Cerrar el drawer no es salida y pasa derecho.

## Para probar en Vercel

`NEXT_PUBLIC_STREAK_NUDGE_ENABLED` = `true`, **literal y en minúscula** (el gate es `=== "true"`;
`True` o `1` lo dejan apagado en silencio). Es `NEXT_PUBLIC_*` → **build-time**: setearlo no
hace nada hasta un **redeploy**. Para un preview, setearlo en **Preview**, no en Production.

Repro: tres ejercicios sin tocar el Daily, después back del header **o** abrir el drawer.

**Apagado por defecto: hoy shippea a oscuras.** Eso es el kill switch funcionando, no deuda.

## Abierto, en orden de peso

1. **"Day X of 21" sigue contradiciendo a las llamas.** `challengeDayFromExpiry`
   (`lib/season-pass/challenge-day.ts:16`) hace `ceil((expiry - now) / dayMs)`: reloj de pared
   puro, **cero entrada de actividad**. Se consume en `use-hub-data.ts:418`, junto a las
   llamas. Un jugador que entrena 3 días ve "Day 3 of 21" avanzando sobre 7 llamas apagadas.
   Misma clase de defecto que el nudge acaba de arreglar, y **ya está en pantalla hoy**.

   Lo destraba una decisión de producto, no código: **¿mide tiempo o esfuerzo?** Si esfuerzo,
   el pase debería vencer por actividad. Si tiempo, alguien llega al vencimiento en
   "Day 17 of 21", un número que ya no puede completar. **Merece su propio spec.**

2. **El nudge no existe en play mode.** El armado cuelga del `if (CHESSCITO_LITE_MODE)` de
   `exercises-screen.tsx:1638`, donde ya vivía `recordExtraConsumed`. En play ese ledger no se
   escribe, así que el latch nunca se arma. Es decisión (la racha es producto de LEARN), pero
   **no está en el spec** — se descubriría en QA. Llevarlo a play exige decidir de dónde sale
   el conteo de solves ahí.

3. **Sin cobertura VR/e2e del nudge.** La evidencia son tests unitarios y de integración;
   ninguna foto. Un caso VR exige montar la pantalla con el latch armado: probablemente contra
   una probe `/dev`, trabajo aparte. Mismo hueco que dejó el gate de login.

4. `NEXT_PUBLIC_PRIVY_ENABLED` en prod sigue pendiente (del handoff anterior). Pre-flight:
   `NEXT_PUBLIC_PRIVY_APP_ID` **en el mismo entorno** (si falta, `requirePrivyAppId()` tira en
   render y se cae la app web entera), **redeploy**, y en **los dos proyectos** learn/play.

5. Higiene de ramas: ~20 ramas locales viejas sin barrer. Sin tocar —
   `origin/production` aparece en `--merged origin/main` y un barrido ciego la borra.

## Nota que vale para el próximo

`docs/audits/2026-07-18-theme-runtime-inventory.json` **lo regenera la suite**
(`runtime-coverage.test.ts:8` spawnea `scripts/audit-theme-runtime-coverage.mjs --check`).
Cualquier componente nuevo con `ThemeAssetPicture` lo ensucia. No es ruido: si aparece con
`usesHardcodedPath: true`, ahí sí hay bug — alguien escribió `/art/...` a mano y el Replace
del theme-builder no va a poder moverlo.
