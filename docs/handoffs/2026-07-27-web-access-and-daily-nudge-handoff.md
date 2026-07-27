# Handoff — Web access polish + el spec de la llama

**Fecha**: 2026-07-27 · **`main`**: `3f2f4cb0` (pusheado por el founder)
**Pendiente de merge**: `docs/daily-streak-nudge-spec` → `10632178` (solo docs)

## Lo que cerró

| commit | qué | estado |
|---|---|---|
| `07f00af7` | El gate de login renderiza dentro del bezel de 390px | en `main` |
| `ea4b2664` | README sincronizado contra el código + 2 comentarios que iban a mentir | en `main` |
| `3f2f4cb0` | Cancelar el login vuelve al gate, no a TRY AGAIN | en `main` |
| `10632178` | Spec + red team de la llama, **READY** | **sin mergear** |

**Suite**: 5914 passing / 522 files, **exit 0**, 0 `Unhandled Errors`, `tsc` limpio.
Verificado leyendo la cola del log, no solo los conteos.

## El bug que encontró el smoke del founder

Cancelar el modal de Privy caía en la pantalla de error. Causa exacta: `onError` marcaba
`error = true` para **cualquier** código, y `exited_auth_flow` **es** el usuario cerrando el
modal a propósito. **Dos tests existentes usaban ese código para disparar la pantalla de
error: estaban fijando el bug.** Ahora usan un código de falla real.

`isUserDismissedLogin()` (puro, en `web-access-state.ts`) separa "cambiaste de idea" de
"fallamos". Códigos desconocidos o ausentes **siguen siendo error** — tragarse uno dejaría al
jugador en un gate cuyo CTA parece muerto.

De paso: la pantalla de error dejó de centrar su stack (caía sobre la cara del lobo) y adoptó
el layout del gate; el botón de MiniPay pasó de vidrio translúcido a `--cta-secondary-cream-*`.

## El spec de la llama: dos rondas, dos veces cambió de forma

**Ronda 1** — "la racha se enciende con el Daily O 3 ejercicios". El red team lo mató:
sobrecargar `lastCompletedDate` golpea a `daily-tactic-card.tsx:78`
(`disabled={isCompletedToday}`), así que encender el día con ejercicios habría **deshabilitado
el botón del Daily**. Habría borrado el ritual que la feature existe para enseñar, con la
suite en verde. El founder recortó el alcance: se enseña, no se cambia la mecánica.

**Ronda 2** — el review pidió un lugar en la cola de celebraciones. El founder preguntó algo
mejor: si el mensaje va en esa cola. **Se midió y no va:**

- `great-focus-session` + `first-great-session` disparan **exacto en la 3ª victoria**
  (umbral 8★; tres soluciones de 3★ dan 9) — `milestones.ts:105-112`
- `first-reward` cae en la 2ª o 3ª (4★ y 2 ejercicios) — `milestones.ts:11-12,63-69`

**La 3ª victoria es el instante de mayor tráfico de celebración de LEARN.** Un cuarto modal
ahí, aunque esté bien encolado, no se lee.

**Forma final**: la 3ª victoria **arma** un latch y no renderiza nada; la pantalla se **cobra
al salir del flujo** (hub o drawer), donde su pedido es la misma clase de decisión que el
jugador ya está tomando. Eso **disuelve** el P0 de orden en vez de parcharlo.

## Estado real de la llama (auditado hoy, no heredado)

La incoherencia **sigue abierta y ahora es decisión, no bug**:

- `recordDailyCompletion` sigue siendo el **único** escritor del streak, con los **mismos 3
  llamadores**. `exercises-screen.tsx` no lo llama ni importa el módulo.
- Great Focus Session **no toca** la llama: `lib/progression/*` solo importa `todayUtc()`.
- `derivePassportView` es puro sobre `DailyProgress`. No hay otra fuente.
- **Hallazgo nuevo**: `challengeDayFromExpiry` (`challenge-day.ts:6`) deriva "Day X of 21" del
  **vencimiento del pase** — reloj de pared, sin actividad. Vive tres líneas arriba de las 7
  llamas. Un jugador que entrena 3 días ve "Day 3 of 21" avanzando sobre 7 llamas apagadas.
  **Fuera del alcance del spec por decisión del founder.** Vuelve al backlog.

## Próximos pasos, en orden

1. **Mergear `docs/daily-streak-nudge-spec`** (solo docs, sin riesgo).
2. **`/tdd` del nudge.** El spec está READY; la única open question (copy en `editorial.ts`,
   techo de 0 em-dashes) no bloquea contratos.
3. **Prender `NEXT_PUBLIC_PRIVY_ENABLED` en prod** — el founder lo iba a hacer. Pre-flight:
   `NEXT_PUBLIC_PRIVY_APP_ID` **en el mismo entorno** (si falta, `requirePrivyAppId()` tira y
   se cae la app web entera, no una pantalla), **redeploy** porque son `NEXT_PUBLIC_*`, y en
   **los dos proyectos** si learn y play están separados en Vercel.
4. Lo que sigue en la lista larga: refactor `dailySlot` + `/dev/learn-hub` + `vr18` · regenerar
   `vr9`–`vr17` · el contador de 21 días · `/api/sign-badge` sin gate server-side.

## Abierto

- El gate de login **no tiene cobertura e2e/VR**: 0 specs lo mencionan. La evidencia de los
  tres fixes de esta sesión es el ojo del founder. Un caso VR exige montar la pantalla sin
  Privy: es trabajo aparte.
- ¿"Day X of 21" mide tiempo o esfuerzo? Si pasa a esfuerzo, el pase debería vencer por
  actividad o la card mostrar los dos hechos; si no, un jugador llega al vencimiento en
  "Day 17 of 21", un número que ya no puede completar.
- Higiene de ramas: hay ~20 ramas locales viejas sin barrer. No las toqué —
  `origin/production` aparece en `--merged origin/main` y un barrido ciego la borra.
