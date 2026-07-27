# Handoff — Focus Days 21 en 30

**Fecha**: 2026-07-27 · **Autor del estado**: founder · **Spec**:
`docs/specs/2026-07-27-focus-days-window-21-in-30.md` (+ `-redteam.md`, `-backfill.sql`)

## Estado

Implementación completa y validada localmente.

Commits principales:

* `98d25ee` — spec, red-team y SQL iniciales
* `ec670c4` — coherencia final del spec
* `73d6dd7` — AC2–AC6 y separación semántica
* `9e6da1f` — AC7–AC13
* `580fc7d` — AC14 y corrección visual de la oferta

La rama local está 7 commits por delante de `main`. ⚠️ **Dos de esos siete NO son de
este spec** y viajan en el mismo push:

* `6cc68ce` — `fix(welcome-pack)`: un claim que no acredita devuelve la fila.
* `82581f9` — cierre de LEARN #1 en el backlog + corrección de dos entradas muertas.
  Investigación en `docs/reviews/2026-07-27-claim-3-shields-investigation.md`.

## Contrato final

* `challengeGoalDays = 21`
* `accessDurationDays = 30`
* precio: `$0.99`
* SKU y `seasonId`: sin cambios
* bonus: 3 Shields
* `completed` es terminal
* los días 22–30 son margen para completar, no progreso adicional

## Validación

* Suite completa: `6158 passing / 538 files`
* TypeScript: limpio
* Lint: limpio
* Tests de discriminación 21 ↔ 30: todos rojos bajo mutación
* EN y ES revisados a 390 px sobre la aplicación real
* precio y CTA conservan jerarquía
* explicación de ventana visible y secundaria
* `vr18`: sin drift

## Limitaciones conocidas

1. La hoja de compra no tiene baseline VR propio porque el servidor visual corre en modo
   PLAY y la oferta solo existe en LEARN.
2. El estado activo con countdown fue verificado por contrato, aritmética y fixture, no
   mediante captura de un pase real.
3. Crear `/dev/season-pass-offer` requiere desacoplar `SeasonPassSheet` de `useAccount()`
   y del rail; queda como mejora futura de tooling, fuera de este spec.

## Hallazgo fuera de alcance

En español, `offerBenefitTrainings` muestra "Special Trainings" sin traducir. Registrado
como bug P2 independiente en `docs/backlog/2026-07-10-backlog-index.md` §2.

## Pendiente operacional

El backfill **NO** se ha ejecutado.

Orden obligatorio:

1. integrar y desplegar el código;
2. confirmar producción saludable;
3. ejecutar el `SELECT` previo del backfill;
4. mostrar las 3 filas proyectadas;
5. obtener aprobación explícita;
6. ejecutar el backfill;
7. verificar delta exacto de 9 días y conteos;
8. conservar el rollback.

No ejecutar el backfill antes del deploy.

---

## Anexo — por qué el orden del backfill es ese

Una vez aplicados **ambos**, el inicio de ventana no se mueve:
`(expires_at + 9) − 30 = expires_at − 21`, verificado fila por fila contra producción.
Lo único en juego es el transitorio entre uno y otro:

| Orden | Durante el intervalo | Efecto |
|---|---|---|
| Deploy → backfill | `windowStart = expires − 30` | 9 días **antes**: sobreestima el techo del backfill del ledger |
| Backfill → deploy | `windowStart = (expires+9) − 21` | 9 días **después**: subestima, puede rechazar una fecha legítima |

Se eligió **deploy → backfill** porque sobreestimar un techo no escribe filas de más
(el ledger sólo cuenta filas existentes, y hoy son **cero** en las tres wallets),
mientras que subestimarlo sí puede rechazar una fecha válida.

Datos medidos el 2026-07-27 (consulta read-only, sin wallets en la salida):
6 filas totales · 3 activas (las tres del founder, de prueba) · 3 expiradas ·
`focus_day_ledger` vacío para las tres · una de ellas ya con `focus_ledger_init`
latcheado y 0 filas sembradas.

## Anexo — lecciones que dejó la sesión

* **El typecheck enumera, no decide.** Borrar `durationDays` obligó a visitar los 20 call
  sites; elegir cuál de los dos números va en cada uno es algo que el compilador no puede
  verificar, porque ambos son `number`. La red real son los tests de discriminación, y su
  criterio de validez es la mutación: si intercambiar los valores deja la suite verde, los
  tests no sirven.
* **Un test verde no prueba jerarquía visual.** AC6 verificaba que la nota de la ventana
  dijera 21 y 30, y pasaba — mientras la nota se renderizaba más grande que el precio,
  porque la clase CSS nunca se definió. Lo detectó mirar la pantalla, no la suite.
* **`--update-snapshots` puede no actualizar nada.** Un re-layout completo de una fila
  entró por debajo del `maxDiffPixelRatio: 0.01` compartido y dejó el baseline viejo en su
  lugar, en verde. De ahí el `0.002` de vr18 y la regla de re-baselinear **borrando el PNG**.
* **Agregar comportamiento obliga a releer lo viejo.** `completed` terminal contradijo un
  Edge case escrito antes en el mismo spec. Un spec editado por partes necesita una pasada
  de coherencia sobre Behavior, Edge cases, ACs, migración y observabilidad como un solo
  sistema.
