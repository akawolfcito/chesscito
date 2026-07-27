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

## Pendiente operacional — ✅ CERRADO (2026-07-27, 21:5x UTC)

El backfill **se ejecutó**, en el orden obligatorio y completo:

1. ✅ código integrado y desplegado (`432bb664` visible como `v.432bb66` en MiniPay);
2. ✅ producción confirmada sana por el founder, visualmente;
3. ✅ `SELECT` previo (§3) corrido dos veces — por REST y por SQL — con `row_tag`
   coincidentes entre ambos;
4. ✅ 3 filas proyectadas mostradas, idénticas al milisegundo a lo previsto en el spec;
5. ✅ aprobación explícita del founder;
6. ✅ `§4` ejecutado (`INSERT 0 3` → salvaguarda pasa → `COMMIT`);
7. ✅ `§5` verificado: (a) las 3 activas coinciden fila por fila con lo proyectado ·
   (b) 3 expiradas intactas · (c) 6 filas totales · (d) **0** filas con delta ≠ 9 días ·
   (e) `focus_day_ledger` sigue en 0, el backfill no sembró días;
8. ⚠️ rollback: ver abajo.

Resultado, sin wallets:

| row_tag | antes | después |
|---|---|---|
| `8200fe9b` | 2026-08-01 15:23:36.802+00 | 2026-08-10 15:23:36.802+00 |
| `9a10fb66` | 2026-08-13 08:02:59.908+00 | 2026-08-22 08:02:59.908+00 |
| `b3b3cde2` | 2026-08-14 11:19:21.643+00 | 2026-08-23 11:19:21.643+00 |

Verificación end-to-end en el device: la tarjeta pasó de **5 days left** a **14 days
left** para `8200fe9b`. Base → API → UI, cerrado.

### ⚠️ El rollback disponible es (b), no (a)

La temp table de §4 murió al cerrarse la sesión de `psql`, así que el camino preferido
—pegar los valores originales desde `backfill_21in30_rollback`— ya no existe. Queda
**(b): restar 9 días con el mismo filtro**, que es seguro porque el UPDATE corrió
**exactamente una vez** — lo prueba §5(d) con 0 filas de delta incorrecto. Los tres
valores originales están en la tabla de arriba y en §6 del `.sql`.

Sigue en pie: el rollback es **CÓDIGO + DATOS**. Revertir estos datos sin revertir el
deploy de 30 días deja el bug original.

### Cómo se ejecutó (para la próxima)

No hay `psql` en la máquina del founder y el host directo `db.<ref>.supabase.co` es
**IPv6-only** (no sale desde un contenedor en macOS). El camino que funcionó:

* cliente `psql` vía Docker (`postgres:16-alpine`, `--rm`) — la base es **producción**,
  el contenedor es sólo el binario;
* **pooler en session mode**: `aws-1-us-east-1.pooler.supabase.com:5432`, usuario
  `postgres.<ref>`. ⚠️ `aws-0-...` devuelve `FATAL: (ENOTFOUND) tenant/user not found`:
  el prefijo del pooler no es adivinable, y el `-0-` resuelve por DNS igual;
* **session mode importa**: en transaction mode (puerto 6543) la temp table de §4 no
  sobrevive. Aun así, §4 y §5 deben ir en **una sola invocación** — cada corrida de
  `psql` es una sesión nueva;
* la password salió de `SUPABASE_DB_PASSWORD` del `.env` y viajó **sólo por env del
  proceso hijo**: nunca en la línea de comandos, nunca en la salida.

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
