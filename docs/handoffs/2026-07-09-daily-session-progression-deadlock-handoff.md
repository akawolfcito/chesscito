# Handoff — Deadlock de progresión de la sesión diaria (2026-07-09)

**Estado: CERRADO y verificado en device.** PR [#191](https://github.com/akawolfcito/chesscito/pull/191)
mergeado a `main` (`0f44eadc`). Suite **4747 passing / 395 files**.
El re-smoke de LEARN pasó completo contra `preview.chesscito.com`.

---

## Qué pasaba

En el teléfono de 18★, el jugador resolvía el ejercicio 5, veía **WELL DONE**, y
no ganaba nada: ni estrellas, ni el ejercicio 6, ni las 10★ del badge. El sheet
de ejercicios mostraba los nodos 6 y 7, **ambos locked**, y nada más. Volver 20
horas después no lo destrababa.

Tres defectos apilados, todos con la suite en verde.

### 1. El freeze anulaba los solves frescos

`shouldFreezeScoring` congelaba **toda** completion una vez agotada la sesión
diaria, incluido el primer solve de un ejercicio. La progresión se calcula sobre
las estrellas persistidas — el drawer desbloquea hasta `lastCompleted + 1` — así
que un ejercicio fresco resuelto pasado el límite dejaba al jugador clavado en
él **para siempre**. El WELL DONE aparecía; las estrellas se tiraban.

**Fix:** el freeze aplica solo a *replays*. El límite diario se aplica bloqueando
contenido nuevo en el drawer, nunca anulando un solve que ya está en el tablero.

### 2. Los laberintos gastaban ranura de sesión

`getLabyrinthForAutoAdvance()` mete al jugador a un laberinto sin pedírselo, así
que el día se consumía como `ej1..ej4 + laberinto` y **el 5.º ejercicio nacía
congelado**. Los laberintos no alimentan el score: no había nada que farmear.

**Fix:** los laberintos salen de la cuota. No gastan ranura ni congelan su best.

### 3. La rotación escondía los ejercicios completados

El sheet filtraba a los ids visibles de hoy y `lockedFor()` los rechazaba otra
vez por la misma regla. Resultado: un sheet sin nada tapeable.

**Fix:** la rotación gatea solo ejercicios frescos. Lo resuelto queda en la senda
y sigue siendo tapeable.

### Por qué "20 horas" no reseteaba

El reset cae en medianoche **UTC**, que en UTC-5 son las 19:00 locales. Una
sesión de noche y una tarde del día siguiente caen en el mismo día UTC. Por eso
el modal ofrecía 7 horas tras 20 de espera. Funciona como fue diseñado, pero es
lo que mantuvo vivo el deadlock entre sesiones.

---

## Por qué la suite estaba verde

`session-quota.test.ts` probaba el predicado `shouldFreezeScoring` **aislado**.
Nadie probaba la composición `congelado → 0★ → gate del drawer`. Otra instancia
de `feedback_tests_green_against_dead_shape`: una suite verde puede verificar una
realidad muerta.

Las dos regresiones nuevas se escribieron contra esa costura. Y el test del
drawer atrapó un segundo gate que se me había pasado: dejar de filtrar la fila no
bastaba, porque `lockedFor()` volvía a bloquear por rotación.

---

## Commits

| Commit | Qué |
| --- | --- |
| `9644ce52` | `fix(exercises)`: el freeze no toca un solve fresco; laberintos fuera de la cuota |
| `bb6c686f` | `fix(exercises)`: los completados vuelven a la senda y son tapeables |
| `624e67e7` | `feat(daily)`: límite de sesión 5 → 10 |

**Producto:** el límite subió a 10 (una pieza completa a 3★ cada uno), porque con
5 la sesión se acababa apenas empezaba y el badge quedaba a dos días.
`NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` es build-time y ya está actualizado en
Preview/Production por el founder. Un registro cubre ambos entornos.

---

## Verificado

- `pnpm exec tsc --noEmit` limpio; eslint limpio en los archivos tocados.
- **4747 passing (395 files)**, corrido antes de cada commit. Baseline 4743.
- Los tests fallaban por la razón correcta antes del fix (4 rojos).
- Ningún baseline VR cubre el drawer de ejercicios; ninguno quedó obsoleto.
- **En device, contra preview:** el ejercicio 5 guarda estrellas, el 6 abre, el
  badge de la torre se clamó ([`0x327e80ae…`](https://celoscan.io/tx/0x327e80aee165a4aa2486458038ad252a453fb9432ed16732c6a67dec9c96ff4b)),
  la torre quedó **Owned**. La save proof no volvió a dar 400.

---

## Próximos pasos

1. **`MAX_STARS` hardcodeado en el modal Badge Earned.** `result-overlay.tsx:113`
   usa `EXERCISES_PER_PIECE * 3` (= 15) en vez del pool real, y `getCardUrl()`
   clampa a 15 (`:181`, `:186`). Con la torre en 12★ y un pool de 10 el modal
   dijo `12/15` y la tarjeta de Share hereda el error. Mismo patrón que #187, que
   arregló el sheet pero no este modal. Cosmético; barato de cerrar.
2. **Decodificar los custom errors.** `BadgeAlreadyClaimed`, `CooldownActive`
   (`0xc1ab61a1`), `DailyLimitReached` (`0xeba8fe8a`). Hoy los tres salen como un
   "Try again" genérico que no dice nada.
3. **Refrescar el baseline VR `hub-shop-sheet-open`** — espera 3 SKUs retirados.
   Deuda previa, no de este PR.

## Preguntas abiertas

- **¿Un laberinto fresco debe poder jugarse pasado el límite?** Ya no gasta
  ranura, pero `isLabReplayable()` lo trata como contenido nuevo y lo bloquea. Es
  coherente con "sesión terminada, nada nuevo", pero ahora es una decisión de
  producto y no una consecuencia del código.
- **¿El reset debe ser UTC o local?** Para un jugador en UTC-5 el día nuevo entra
  a las 19:00, en plena sesión de noche. Cambiarlo a local rompe la rotación
  determinista compartida entre devices; dejarlo confunde. Sin decidir.
- **`/api/sign-badge` no verifica las estrellas.** Firma cualquier `levelId` entre
  1 y 10000 (`sign-badge/route.ts:23`); el gate de 10★ vive solo en el cliente.
  El contrato impide clamar **dos veces**, no clamar **sin merecerlo**. Es el
  "server-verified progress" ya anotado como el único anti-cheat real, y hay que
  cerrarlo antes de que un badge valga dinero.
