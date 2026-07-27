-- Backfill — Focus Days 21-en-30
-- Fecha: 2026-07-27 · Entorno objetivo: PRODUCCIÓN (proyecto brsbdz…)
-- Naturaleza: normalización de datos de PRUEBA activos. No hay compradores
-- reales (verificado read-only 2026-07-27: 6 filas, 3 activas, 3 expiradas;
-- las 3 activas son pases de prueba del founder).
--
-- Qué se pierde si sale mal: el `expires_at` de 3 pases de prueba.
-- Reversible: sí (§6). No hay borrado de filas en ningún punto.
--
-- ORDEN respecto del deploy: deploy PRIMERO, backfill después, con minutos de
-- diferencia (razón en el spec, §Migración).
--
-- ⚠️ NO EJECUTAR sin aprobación explícita, y sin haber mirado la salida de §3.
-- Secuencia: §3 → aprobar → §4 → §5 → conservar §6.

---------------------------------------------------------------------------
-- §1. El UPDATE exacto
---------------------------------------------------------------------------
-- Reproducido aquí para lectura. La versión ejecutable, con la salvaguarda y
-- la captura para rollback, es §4 — no correr este bloque suelto.
--
--   UPDATE lite_season_passes
--      SET expires_at = expires_at + INTERVAL '9 days'
--    WHERE season_id  = '21day-mind-challenge-2026-q3'
--      AND expires_at > now()
--   RETURNING wallet, expires_at;
--
-- Por qué 9: accessDurationDays (30) − durationDays vieja (21) = 9. Se suma al
-- expires_at existente en lugar de recalcular desde la fecha de compra, porque
-- la fecha de compra NO existe en esta tabla: sólo se puede derivar como
-- expires_at − 21d, y derivar-para-volver-a-sumar introduce un redondeo que
-- sumar 9 días no tiene.
--
-- Efecto neto sobre el inicio de ventana: NINGUNO, una vez desplegado el
-- código de 30 días. (expires+9) − 30 = expires − 21. Verificado fila por fila.

---------------------------------------------------------------------------
-- §2. El filtro, y por qué no puede alcanzar otra cosa
---------------------------------------------------------------------------
--   season_id = '21day-mind-challenge-2026-q3'
--     → es el único seasonId que existe hoy (rail-config.ts:151), pero se
--       nombra explícito para que una temporada futura no herede este UPDATE
--       si alguien lo reejecuta.
--
--   expires_at > now()
--     → excluye las 3 filas expiradas, que quedan intactas por decisión del
--       founder. Además son inertes: readSeasonPassRow filtra por lo mismo
--       (read-season-pass-row.ts:34), así que una fila vencida no alimenta
--       ninguna reconstrucción de ventana.
--
-- Ninguna condición menciona wallets, y ninguna salida las imprime.
--
-- SALVAGUARDA (§4): aborta salvo que el UPDATE haya modificado EXACTAMENTE 3
-- filas. El conteo sale del RETURNING del propio UPDATE — no de un SELECT
-- previo, que mediría una lectura distinta a la escritura (ambos evalúan
-- `now()` en instantes distintos, y una fila puede vencer en el medio).

---------------------------------------------------------------------------
-- §3. SELECT PREVIO — correr esto PRIMERO y mostrar la salida
---------------------------------------------------------------------------
-- Sin wallets. `row_tag` es un hash corto y estable: alcanza para parear una
-- fila entre el antes y el después sin identificar a su dueño.
SELECT
  left(md5(wallet), 8)                        AS row_tag,
  season_id,
  supporter_status,
  shields_credited,
  expires_at                                  AS expires_at_actual,
  expires_at + INTERVAL '9 days'              AS expires_at_proyectado
FROM lite_season_passes
WHERE season_id = '21day-mind-challenge-2026-q3'
  AND expires_at > now()
ORDER BY expires_at ASC;

-- Esperado: 3 filas. Con los datos del 2026-07-27, los proyectados son
--   2026-08-01T15:23:36.802Z → 2026-08-10T15:23:36.802Z
--   2026-08-13T08:02:59.908Z → 2026-08-22T08:02:59.908Z
--   2026-08-14T11:19:21.643Z → 2026-08-23T11:19:21.643Z
-- Si aparecen 4+, o un season_id distinto: PARAR y volver a revisar.

---------------------------------------------------------------------------
-- §4. EL UPDATE — con captura para rollback y aborto por conteo REAL
---------------------------------------------------------------------------
BEGIN;

-- Tabla de rollback. Se llena desde el RETURNING del UPDATE, así que contiene
-- exactamente las filas modificadas — ni una más, ni una menos. Sobrevive al
-- COMMIT (vive mientras dure la sesión), que es lo que la hace útil en §6.
CREATE TEMP TABLE backfill_21in30_rollback (
  wallet              text        PRIMARY KEY,
  expires_at_original timestamptz NOT NULL,
  expires_at_nuevo    timestamptz NOT NULL
);

-- El UPDATE y la captura, en una sola sentencia: lo que se guarda para
-- revertir ES lo que se modificó, por construcción.
WITH updated AS (
  UPDATE lite_season_passes
     SET expires_at = expires_at + INTERVAL '9 days'
   WHERE season_id  = '21day-mind-challenge-2026-q3'
     AND expires_at > now()
  RETURNING
    wallet,
    expires_at - INTERVAL '9 days' AS expires_at_original,
    expires_at                     AS expires_at_nuevo
)
INSERT INTO backfill_21in30_rollback (wallet, expires_at_original, expires_at_nuevo)
SELECT wallet, expires_at_original, expires_at_nuevo FROM updated;

-- Salvaguarda: cuenta las filas REALMENTE modificadas (las que el RETURNING
-- entregó), no las que un SELECT anterior había visto. Si no son 3, la
-- excepción aborta la transacción entera y el UPDATE se deshace solo.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM backfill_21in30_rollback;
  IF n <> 3 THEN
    RAISE EXCEPTION
      'Alcance inesperado: el UPDATE modifico % filas, se esperaban exactamente 3. Transaccion abortada.', n;
  END IF;
END $$;

-- Antes de cerrar: revisar lo que se va a commitear, sin wallets.
SELECT
  left(md5(wallet), 8) AS row_tag,
  expires_at_original,
  expires_at_nuevo
FROM backfill_21in30_rollback
ORDER BY expires_at_nuevo ASC;

-- Si algo no cuadra: ROLLBACK;  (y no queda rastro)
COMMIT;

---------------------------------------------------------------------------
-- §5. SELECT POSTERIOR — verificación
---------------------------------------------------------------------------
-- (a) Las 3 activas con su nueva expiración. Deben coincidir fila por fila,
--     vía `row_tag`, con `expires_at_proyectado` de §3.
SELECT
  left(md5(wallet), 8) AS row_tag,
  season_id,
  expires_at           AS expires_at_nuevo
FROM lite_season_passes
WHERE season_id = '21day-mind-challenge-2026-q3'
  AND expires_at > now()
ORDER BY expires_at ASC;

-- (b) Las expiradas siguen intactas: 3. Si bajó, el UPDATE alcanzó algo que
--     no debía.
SELECT count(*) AS filas_expiradas_intactas
FROM lite_season_passes
WHERE season_id = '21day-mind-challenge-2026-q3'
  AND expires_at <= now();

-- (c) El total no cambió: 6. Este UPDATE no crea ni borra filas.
SELECT count(*) AS filas_totales FROM lite_season_passes;

-- (d) Cada fila se movió exactamente 9 días. Cero filas es lo correcto.
SELECT count(*) AS filas_con_delta_incorrecto
FROM lite_season_passes p
JOIN backfill_21in30_rollback r ON r.wallet = p.wallet
WHERE p.expires_at <> r.expires_at_original + INTERVAL '9 days';

---------------------------------------------------------------------------
-- §6. ROLLBACK
---------------------------------------------------------------------------
-- ⚠️ El rollback es una unidad CÓDIGO + DATOS. Revertir esto sin revertir el
-- deploy de 30 días deja el bug original; revertir el código sin revertir esto
-- deja windowStart 9 días tarde. Ver la tabla en el spec, §Rollback coordinado.
--
-- Antes del COMMIT: `ROLLBACK;` y no queda rastro.
--
-- Después del COMMIT, dos caminos:
--
-- (a) PREFERIDO — con la temp table de §4 viva en la sesión. Pega los valores
--     originales exactos, sin aritmética, y es idempotente:
--
--       UPDATE lite_season_passes p
--          SET expires_at = r.expires_at_original
--         FROM backfill_21in30_rollback r
--        WHERE p.wallet = r.wallet;
--
-- (b) Si la sesión se cerró y la temp table se perdió — restar lo mismo que se
--     sumó. Seguro SÓLO si el UPDATE corrió una vez: correrlo dos veces sumó 18
--     días y esto revierte 9. Por eso (a) es el camino preferido:
--
--       UPDATE lite_season_passes
--          SET expires_at = expires_at - INTERVAL '9 days'
--        WHERE season_id = '21day-mind-challenge-2026-q3'
--          AND expires_at > now();
--
-- Los tres valores originales, transcritos por si ambos caminos fallan
-- (sin wallets; parear por orden de expiración ascendente):
--   1) 2026-08-01T15:23:36.802+00:00
--   2) 2026-08-13T08:02:59.908+00:00
--   3) 2026-08-14T11:19:21.643+00:00
